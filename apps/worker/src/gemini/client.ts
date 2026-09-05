import { HttpError, type Env } from '../lib/env';

/**
 * Gemini / Gemma client.
 *
 * The interesting part here is model resolution.
 *
 * Model names churn - `gemini-3.5-transcribe` and `gemma-4-31b-it` may or may
 * not exist on a given key at a given time, and hardcoding one means the whole
 * product returns 404 the day it is renamed. So instead of a constant, each
 * capability has an ordered *preference chain*, and on first use we ask the API
 * which models this key can actually see and take the best available match.
 *
 * The result is cached in KV (or in memory) so it costs one extra call a day.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type Capability = 'transcribe' | 'analyze' | 'design';

/**
 * Ordered best-to-worst, and used as a *runtime* chain rather than just a
 * lookup: if the first model returns an empty response, the next is tried.
 *
 * That matters because a model can be listed, accept the request, report
 * `finishReason: STOP` and still return zero parts. `gemini-3.5-transcribe`
 * does exactly that for audio today - it bills the audio tokens and produces
 * nothing - which is why the general multimodal model leads the transcription
 * chain despite the dedicated one existing. Verified against real audio; revisit
 * if the dedicated endpoint starts returning content.
 */
const PREFERENCES: Record<Capability, string[]> = {
  transcribe: [
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-3.5-transcribe',
    'gemini-2.5-pro',
    'gemini-flash-latest',
  ],
  analyze: [
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
  ],
  design: [
    'gemma-4-31b-it',
    'gemma-4-26b-a4b-it',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-flash-latest',
  ],
};

interface ModelEntry {
  name: string;
  supportedGenerationMethods?: string[];
}

let memoryCache: { models: string[]; at: number } | null = null;
const CACHE_MS = 60 * 60 * 1000;

async function listModels(env: Env): Promise<string[]> {
  if (memoryCache && Date.now() - memoryCache.at < CACHE_MS) return memoryCache.models;

  const cached = await env.USAGE?.get('models:list');
  if (cached) {
    const models = JSON.parse(cached) as string[];
    memoryCache = { models, at: Date.now() };
    return models;
  }

  const response = await fetch(`${API_BASE}/models?key=${env.GEMINI_API_KEY}&pageSize=200`);
  if (!response.ok) {
    // If the listing itself fails we fall back to the preference order as-is
    // and let the generate call report the real problem.
    return [];
  }

  const body = (await response.json()) as { models?: ModelEntry[] };
  const models = (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') ?? true)
    .map((m) => m.name.replace(/^models\//, ''));

  memoryCache = { models, at: Date.now() };
  await env.USAGE?.put('models:list', JSON.stringify(models), { expirationTtl: 3600 });
  return models;
}

/** Pick the best model this key can actually use for a capability. */
export async function resolveModel(env: Env, capability: Capability): Promise<string> {
  const available = await listModels(env);
  const wanted = PREFERENCES[capability];

  if (available.length === 0) return wanted[0];

  for (const candidate of wanted) {
    // Exact match first, then a prefix match so `gemini-2.5-flash` picks up
    // `gemini-2.5-flash-002` when only the dated variant is published.
    const exact = available.find((m) => m === candidate);
    if (exact) return exact;
    const prefixed = available.find((m) => m.startsWith(`${candidate}-`));
    if (prefixed) return prefixed;
  }

  // Nothing from the chain: take any flash-class model rather than failing.
  return available.find((m) => m.includes('flash')) ?? wanted[0];
}

/**
 * Every model from the chain that this key can actually see, in preference
 * order. Used by `generateWithFallback` so an empty response is survivable.
 */
export async function resolveModelChain(env: Env, capability: Capability): Promise<string[]> {
  const available = await listModels(env);
  if (available.length === 0) return [PREFERENCES[capability][0]];

  const chain: string[] = [];
  for (const candidate of PREFERENCES[capability]) {
    const match =
      available.find((m) => m === candidate) ?? available.find((m) => m.startsWith(`${candidate}-`));
    if (match && !chain.includes(match)) chain.push(match);
  }

  if (chain.length === 0) {
    const anyFlash = available.find((m) => m.includes('flash'));
    if (anyFlash) chain.push(anyFlash);
  }
  return chain.length > 0 ? chain : [PREFERENCES[capability][0]];
}

export async function resolveAllModels(env: Env): Promise<Record<Capability, string>> {
  const [transcribe, analyze, design] = await Promise.all([
    resolveModel(env, 'transcribe'),
    resolveModel(env, 'analyze'),
    resolveModel(env, 'design'),
  ]);
  return { transcribe, analyze, design };
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

export interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GenerateOptions {
  model: string;
  parts: Part[];
  /**
   * Gemma models reject a `systemInstruction` field, so for those the caller's
   * system prompt is prepended to the first user part instead.
   */
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask for `application/json`. Not supported by Gemma, so it is conditional. */
  jsonMode?: boolean;
  signal?: AbortSignal;
}

/** Separator used when a system prompt has to ride inside the user turn. */
const SYSTEM_SEPARATOR = '\n\n---\n\n';

/**
 * Not every model accepts the extras a chat model does.
 *
 * Gemma has no system role at all, and the transcription models reject both
 * `systemInstruction` ("Developer instruction is not enabled for this model")
 * and a forced JSON response type. Rather than maintain a growing list of
 * special cases, `generate` starts optimistic and retries without whichever
 * feature the API actually objected to.
 */
const isGemma = (model: string) => model.toLowerCase().includes('gemma');
const isTranscribeModel = (model: string) => model.toLowerCase().includes('transcribe');

function supportsSystemInstruction(model: string): boolean {
  return !isGemma(model) && !isTranscribeModel(model);
}

function supportsJsonMime(model: string): boolean {
  return !isGemma(model) && !isTranscribeModel(model);
}

/** Errors that mean "drop that option and try again", not "give up". */
function unsupportedFeature(message: string): 'system' | 'json' | null {
  const m = message.toLowerCase();
  if (m.includes('developer instruction') || m.includes('system_instruction') || m.includes('systeminstruction')) {
    return 'system';
  }
  if (m.includes('response_mime_type') || m.includes('responsemimetype') || m.includes('json mode')) {
    return 'json';
  }
  return null;
}

export async function generate(env: Env, options: GenerateOptions): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(500, 'The AI key is not configured on the server.', 'no_api_key');
  }

  let useSystemField = Boolean(options.system) && supportsSystemInstruction(options.model);
  let useJsonMime = Boolean(options.jsonMode) && supportsJsonMime(options.model);

  const build = (): Record<string, unknown> => {
    const parts = [...options.parts];

    // When the model has no system role, fold the instructions into the first
    // user turn instead. The prompt still lands, it just travels differently.
    if (options.system && !useSystemField) {
      parts.unshift({ text: options.system + SYSTEM_SEPARATOR });
    }

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: options.temperature ?? 0.6,
        maxOutputTokens: options.maxOutputTokens ?? 8192,
        ...(useJsonMime ? { responseMimeType: 'application/json' } : {}),
      },
      safetySettings: [
        'HARM_CATEGORY_HARASSMENT',
        'HARM_CATEGORY_HATE_SPEECH',
        'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        'HARM_CATEGORY_DANGEROUS_CONTENT',
      ].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' })),
    };

    if (options.system && useSystemField) {
      body.systemInstruction = { parts: [{ text: options.system }] };
    }
    return body;
  };

  const send = async (): Promise<Response> =>
    fetch(`${API_BASE}/models/${options.model}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(build()),
      signal: options.signal,
    });

  let response = await send();

  // A 400 naming an option we sent means this model does not support it. Drop
  // that option and retry once, so a model with a narrower feature set works
  // without having to be listed here first.
  if (response.status === 400) {
    const detail = await response.clone().text().catch(() => '');
    const unsupported = unsupportedFeature(detail);

    if (unsupported === 'system' && useSystemField) {
      useSystemField = false;
      response = await send();
    } else if (unsupported === 'json' && useJsonMime) {
      useJsonMime = false;
      response = await send();
    }
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 429) {
      throw new HttpError(429, 'The AI service is rate limited right now. Try again shortly.', 'ai_rate_limit');
    }
    if (response.status === 404) {
      throw new HttpError(502, `The model ${options.model} is not available on this API key.`, 'model_unavailable');
    }
    console.error('Gemini error', options.model, response.status, detail.slice(0, 500));
    throw new HttpError(502, `The AI service rejected the request (${response.status}).`, 'ai_error');
  }


  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (payload.promptFeedback?.blockReason) {
    throw new HttpError(422, 'The content was blocked by the AI safety filter.', 'blocked');
  }

  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

  if (!text) {
    throw new HttpError(
      502,
      candidate?.finishReason === 'MAX_TOKENS'
        ? 'The AI response was cut off. Try fewer scenes.'
        : 'The AI returned nothing.',
      'empty_response',
    );
  }

  return text;
}

/* ------------------------------------------------------------------ */
/* JSON extraction                                                     */
/* ------------------------------------------------------------------ */

/**
 * Pull JSON out of a model response.
 *
 * Even with an explicit "raw JSON only" instruction, models wrap output in
 * fences, prefix it with "Here is the JSON:", or append a closing remark. This
 * strips all of that and, failing that, takes the outermost balanced braces.
 */
export function extractJson(raw: string): unknown {
  const text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim());
    } catch {
      /* try the next strategy */
    }
  }

  // Balanced-brace scan, ignoring braces inside string literals.
  const start = text.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = !inString;
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}' && --depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }

  throw new HttpError(502, 'The AI response was not valid JSON.', 'bad_json');
}

/* ------------------------------------------------------------------ */
/* Chain execution                                                     */
/* ------------------------------------------------------------------ */

/**
 * Run a generation against a capability's chain, moving on when a model
 * produces nothing usable.
 *
 * A model that returns zero parts with `finishReason: STOP` is the failure mode
 * that motivated this: it looks like success at the HTTP layer, so without an
 * explicit check the pipeline silently degrades to "no transcript" and the user
 * gets a video with no captions and no explanation.
 */
export async function generateWithFallback(
  env: Env,
  capability: Capability,
  options: Omit<GenerateOptions, 'model'>,
  isUsable: (text: string) => boolean = (text) => text.trim().length > 0,
): Promise<{ text: string; model: string }> {
  const chain = await resolveModelChain(env, capability);
  let lastError: unknown = null;

  for (const model of chain) {
    try {
      const text = await generate(env, { ...options, model });
      if (isUsable(text)) return { text, model };
      console.warn(`Model ${model} returned nothing usable for ${capability}; trying the next.`);
    } catch (error) {
      // A rate limit will hit every model in the chain, so stop rather than
      // burning the remaining quota on requests that cannot succeed.
      if (error instanceof HttpError && error.status === 429) throw error;
      lastError = error;
      console.warn(`Model ${model} failed for ${capability}:`, (error as Error)?.message);
    }
  }

  if (lastError instanceof HttpError) throw lastError;
  throw new HttpError(
    502,
    `No available model produced a usable ${capability} response. Tried: ${chain.join(', ')}.`,
    'all_models_failed',
  );
}
