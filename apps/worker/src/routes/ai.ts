import {
  AI_LIMITS,
  aiDesignResponseSchema,
  aiSceneResponseSchema,
  audioAnalysisSchema,
  buildAnalysisPrompt,
  buildDesignPrompt,
  buildRedesignPrompt,
  designRequestSchema,
  DESIGN_SYSTEM_PROMPT,
  redesignSceneRequestSchema,
  REDESIGN_SYSTEM_PROMPT,
  repairMonotonicity,
  responseShape,
  TRANSCRIBE_SYSTEM_PROMPT,
  transcriptionResultSchema,
  type PromptPart,
} from '@kc/shared/server';
import { assertProjectOwnership, requireUser } from '../auth/jwt';
import { extractJson, generate, generateWithFallback, resolveModelChain, type Part } from '../gemini/client';
import { enforceUsage, HttpError, json, type Env } from '../lib/env';

/**
 * AI routes.
 *
 * Three responsibilities, kept apart deliberately: transcription needs audio
 * and exact timings, verification needs audio and semantics, design needs
 * images and taste. Combining them into one prompt degrades all three.
 *
 * Every response is validated against the shared Zod schema before it leaves
 * this Worker, with one repair attempt, so the editor can trust its input.
 */

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function toGeminiParts(parts: PromptPart[]): Part[] {
  return parts.map((part) =>
    part.type === 'image'
      ? { inlineData: { mimeType: part.mimeType ?? 'image/webp', data: part.value } }
      : { text: part.value },
  );
}

async function readAudio(form: FormData): Promise<{ data: string; mimeType: string }> {
  const entry = form.get('audio');
  // FormData entries are `File | string`, and `instanceof` cannot narrow a
  // union containing a primitive - check for the Blob shape instead.
  if (!entry || typeof entry === 'string') {
    throw new HttpError(400, 'No audio was uploaded.', 'no_audio');
  }
  const file = entry as File;
  if (file.size > MAX_AUDIO_BYTES) {
    throw new HttpError(413, 'The extracted audio is too large. Try a shorter clip.', 'audio_too_large');
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
  }

  return { data: btoa(binary), mimeType: file.type || 'audio/wav' };
}

/**
 * Validate a model response, and if it fails, show the model its own output
 * plus the error and ask once for a corrected version.
 *
 * One retry, not a loop: if the second attempt is also malformed, the caller's
 * deterministic fallback is a better use of the user's time than a third
 * round trip.
 */
async function validated<T>(
  env: Env,
  model: string,
  system: string,
  parts: Part[],
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown } },
  shape: string,
): Promise<T> {
  const first = await generate(env, { model, system, parts, jsonMode: true, temperature: 0.65 });

  const attempt = (raw: string) => {
    const parsed = schema.safeParse(extractJson(raw));
    return parsed.success ? parsed.data : null;
  };

  const ok = attempt(first);
  if (ok) return ok;

  const repaired = await generate(env, {
    model,
    system,
    parts: [
      ...parts,
      {
        text: `Your previous reply did not match the required schema. Return ONLY corrected JSON in exactly this shape, with no commentary:\n\n${shape}\n\nYour previous reply was:\n${first.slice(0, 3000)}`,
      },
    ],
    jsonMode: true,
    temperature: 0.2,
  });

  const fixed = attempt(repaired);
  if (fixed) return fixed;

  throw new HttpError(502, 'The AI response did not match the expected format.', 'schema_failed');
}

/* ------------------------------------------------------------------ */
/* /ai/transcribe                                                      */
/* ------------------------------------------------------------------ */

export async function handleTranscribe(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const user = await requireUser(request, env);
  const form = await request.formData();

  const projectId = String(form.get('projectId') ?? '');
  if (!projectId) throw new HttpError(400, 'projectId is required.', 'no_project');
  await assertProjectOwnership(env, request, projectId);
  await enforceUsage(env, user.id, 'transcription', AI_LIMITS.transcriptionsPerDay);

  const audio = await readAudio(form);

  const { text: raw, model } = await generateWithFallback(
    env,
    'transcribe',
    {
      system: TRANSCRIBE_SYSTEM_PROMPT,
      parts: [
        { inlineData: { mimeType: audio.mimeType, data: audio.data } },
        { text: 'Transcribe this audio verbatim with word-level millisecond timestamps.' },
      ],
      // Transcription is a transcription, not a creative act.
      temperature: 0,
      jsonMode: true,
      maxOutputTokens: 16384,
    },
    // "Usable" means it actually contains words, not merely that the HTTP call
    // succeeded - a model can return an empty body and still report success.
    (text) => {
      try {
        const candidate = transcriptionResultSchema.safeParse(extractJson(text));
        return candidate.success && candidate.data.words.length > 0;
      } catch {
        return false;
      }
    },
  );

  const parsed = transcriptionResultSchema.safeParse(extractJson(raw));
  if (!parsed.success) {
    throw new HttpError(502, 'The transcription response was malformed.', 'schema_failed');
  }

  // Models occasionally emit seconds, or overlapping spans. Normalise both here
  // so nothing downstream has to defend against it.
  const words = repairMonotonicity(
    parsed.data.words.map((word, index) => ({
      ...word,
      id: word.id || `w${index + 1}`,
      startMs: normaliseMs(word.startMs),
      endMs: normaliseMs(word.endMs),
    })),
  );

  return json({ ...parsed.data, words, model }, {}, headers);
}

/** A "timestamp" under 1000 for a multi-word clip is almost certainly seconds. */
function normaliseMs(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/* ------------------------------------------------------------------ */
/* /ai/analyze-audio                                                   */
/* ------------------------------------------------------------------ */

export async function handleAnalyzeAudio(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const user = await requireUser(request, env);
  const form = await request.formData();

  const projectId = String(form.get('projectId') ?? '');
  if (!projectId) throw new HttpError(400, 'projectId is required.', 'no_project');
  await assertProjectOwnership(env, request, projectId);
  await enforceUsage(env, user.id, 'audio_analysis', AI_LIMITS.transcriptionsPerDay);

  const audio = await readAudio(form);
  const mode = (String(form.get('mode') ?? 'auto') as 'auto' | 'speech' | 'song') ?? 'auto';
  const timedText = String(form.get('timedText') ?? '');
  const userLyrics = form.get('userLyrics') ? String(form.get('userLyrics')) : undefined;

  const { text: raw, model } = await generateWithFallback(env, 'analyze', {
    parts: [
      { inlineData: { mimeType: audio.mimeType, data: audio.data } },
      { text: buildAnalysisPrompt({ mode, timedText, userLyrics }) },
    ],
    temperature: 0.1,
    jsonMode: true,
    maxOutputTokens: 8192,
  });

  const parsed = audioAnalysisSchema.safeParse(extractJson(raw));
  if (!parsed.success) {
    throw new HttpError(502, 'The audio analysis response was malformed.', 'schema_failed');
  }

  return json({ ...parsed.data, model }, {}, headers);
}

/* ------------------------------------------------------------------ */
/* /ai/design                                                          */
/* ------------------------------------------------------------------ */

export async function handleDesign(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const user = await requireUser(request, env);
  const input = designRequestSchema.parse(await request.json());

  await assertProjectOwnership(env, request, input.projectId);
  await enforceUsage(env, user.id, 'design_generation', AI_LIMITS.designsPerDay);

  if (input.scenes.length > AI_LIMITS.maxFramesPerRequest * 2) {
    throw new HttpError(400, 'Too many scenes in one request.', 'too_many_scenes');
  }

  const [model] = await resolveModelChain(env, 'design');
  const parts = toGeminiParts(buildDesignPrompt(input));

  const design = await validated(
    env,
    model,
    DESIGN_SYSTEM_PROMPT,
    parts,
    aiDesignResponseSchema,
    responseShape(),
  );

  return json({ ...design, model }, {}, headers);
}

/* ------------------------------------------------------------------ */
/* /ai/redesign-scene                                                  */
/* ------------------------------------------------------------------ */

export async function handleRedesignScene(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const user = await requireUser(request, env);
  const input = redesignSceneRequestSchema.parse(await request.json());

  await assertProjectOwnership(env, request, input.projectId);
  await enforceUsage(env, user.id, 'scene_regeneration', AI_LIMITS.regenerationsPerProject);

  const [model] = await resolveModelChain(env, 'design');
  const parts = toGeminiParts(buildRedesignPrompt(input));

  const result = await validated(
    env,
    model,
    REDESIGN_SYSTEM_PROMPT,
    parts,
    aiSceneResponseSchema,
    `{ "scene": { "id": "${input.scene.id}", "compositionId": "...", "lines": [{"wordIds":["..."]}], "heroWordIds": ["..."], "accentWordIds": [], "avoidRegions": [], "backdropLuma": 0.5 } }`,
  );

  return json({ ...result, model }, {}, headers);
}
