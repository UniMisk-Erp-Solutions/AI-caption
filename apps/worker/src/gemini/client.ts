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
 * Ordered best-to-worst. The first entry is the model the architecture asks
 * for; the rest are the fallbacks that keep the feature working if it is not
 * available on this key.
 */
const PREFERENCES: Record<Capability, string[]> = {
  transcribe: [
    'gemini-3.5-transcribe',
    'gemini-3-pro',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
  analyze: [
    'gemini-3.5-flash',
    'gemini-3-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ],
  design: [
    'gemma-4-31b-it',
    'gemma-3-27b-it',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
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

const isGemma = (model: string) => model.toLowerCase().includes('gemma');

export async function generate(env: Env, options: GenerateOptions): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(500, 'The AI key is not configured on the server.', 'no_api_key');
  }

  const gemma = isGemma(options.model);
  const parts = [...options.parts];

  if (options.system) {
    if (gemma) {
      // Gemma has no system role - fold the instructions into the first turn.
      parts.unshift({ text: `${options.system}\n\n---\n\n` });
    }
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: options.temperature ?? 0.6,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
      ...(options.jsonMode && !gemma ? { responseMimeType: 'application/json' } : {}),
    },
    safetySettings: [
      'HARM_CATEGORY_HARASSMENT',
      'HARM_CATEGORY_HATE_SPEECH',
      'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      'HARM_CATEGORY_DANGEROUS_CONTENT',
    ].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' })),
  };

  if (options.system && !gemma) {
    body.systemInstruction = { parts: [{ text: options.system }] };
  }

  const response = await fetch(
    `${API_BASE}/models/${options.model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 429) {
      throw new HttpError(429, 'The AI service is rate limited right now. Try again shortly.', 'ai_rate_limit');
    }
    if (response.status === 404) {
      throw new HttpError(502, `The model ${options.model} is not available on this API key.`, 'model_unavailable');
    }
    console.error('Gemini error', response.status, detail.slice(0, 500));
    throw new HttpError(502, 'The AI service rejected the request.', 'ai_error');
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
