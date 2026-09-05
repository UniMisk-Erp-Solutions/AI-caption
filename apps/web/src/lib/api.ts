import {
  aiDesignResponseSchema,
  aiSceneResponseSchema,
  audioAnalysisSchema,
  transcriptionResultSchema,
  type AiDesignResponse,
  type AiSceneResponse,
  type AudioAnalysis,
  type DesignRequest,
  type RedesignSceneRequest,
  type TranscriptionResult,
} from '@kc/shared';
import { env, hasApi } from './env';
import { getAccessToken } from './supabase';

/**
 * Worker API client.
 *
 * Nothing here talks to Google or R2 directly - the browser never sees an API
 * key. Every call carries the Supabase access token and the Worker derives the
 * user from it, so a client cannot ask for someone else's project by editing a
 * request body.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thrown when the app is in local mode and something needs the Worker. */
export class ApiUnavailableError extends Error {
  constructor(what: string) {
    super(`${what} needs the API to be configured. Set VITE_API_BASE_URL to enable it.`);
    this.name = 'ApiUnavailableError';
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
  signal?: AbortSignal,
): Promise<T> {
  if (!hasApi) throw new ApiUnavailableError(path);

  const headers = new Headers(init.headers);
  const token = await getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, { ...init, headers, body, signal });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = text || response.statusText;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(text) as { error?: string; code?: string };
      message = parsed.error ?? message;
      code = parsed.code;
    } catch {
      /* non-JSON error body - use it as-is */
    }
    throw new ApiError(message, response.status, code);
  }

  return (await response.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

export interface UploadTicket {
  uploadUrl: string;
  objectKey: string;
  expiresAt: number;
}

export async function requestUploadUrl(input: {
  projectId: string;
  mimeType: string;
  size: number;
  kind: 'source_video' | 'thumbnail' | 'export';
}): Promise<UploadTicket> {
  return request<UploadTicket>('/storage/upload-url', { method: 'POST', json: input });
}

export async function requestDownloadUrl(objectKey: string): Promise<{ url: string; expiresAt: number }> {
  return request('/storage/download-url', { method: 'POST', json: { objectKey } });
}

export async function deleteObject(objectKey: string): Promise<void> {
  await request('/storage/delete', { method: 'POST', json: { objectKey } });
}

/**
 * Upload straight to R2 with the signed URL.
 *
 * Deliberately not routed through the Worker: a 200MB body through a Worker
 * costs CPU time and gains nothing, and the signed PUT is already scoped to one
 * object key that the server chose.
 */
export async function uploadToSignedUrl(
  url: string,
  blob: Blob,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  // XHR rather than fetch, purely because fetch still has no upload progress.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(`Upload failed (${xhr.status})`, xhr.status));
    xhr.onerror = () => reject(new ApiError('Upload failed', 0));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

/* ------------------------------------------------------------------ */
/* AI                                                                  */
/* ------------------------------------------------------------------ */

export async function transcribeAudio(
  projectId: string,
  audio: Blob,
  options: { mode: 'auto' | 'speech' | 'song'; language?: string },
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append('projectId', projectId);
  form.append('mode', options.mode);
  if (options.language) form.append('language', options.language);
  form.append('audio', audio, 'audio.wav');

  const raw = await request<unknown>('/ai/transcribe', { method: 'POST', body: form }, signal);
  return transcriptionResultSchema.parse(raw);
}

export async function analyzeAudio(
  projectId: string,
  audio: Blob,
  options: { mode: 'auto' | 'speech' | 'song'; timedText: string; userLyrics?: string },
  signal?: AbortSignal,
): Promise<AudioAnalysis> {
  const form = new FormData();
  form.append('projectId', projectId);
  form.append('mode', options.mode);
  form.append('timedText', options.timedText);
  if (options.userLyrics) form.append('userLyrics', options.userLyrics);
  form.append('audio', audio, 'audio.wav');

  const raw = await request<unknown>('/ai/analyze-audio', { method: 'POST', body: form }, signal);
  return audioAnalysisSchema.parse(raw);
}

export async function generateDesign(
  input: DesignRequest,
  signal?: AbortSignal,
): Promise<AiDesignResponse> {
  const raw = await request<unknown>('/ai/design', { method: 'POST', json: input }, signal);
  return aiDesignResponseSchema.parse(raw);
}

export async function redesignScene(
  input: RedesignSceneRequest,
  signal?: AbortSignal,
): Promise<AiSceneResponse> {
  const raw = await request<unknown>('/ai/redesign-scene', { method: 'POST', json: input }, signal);
  return aiSceneResponseSchema.parse(raw);
}

export async function apiHealth(): Promise<{ ok: boolean; models?: Record<string, string> }> {
  return request('/health', { method: 'GET' });
}
