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

/**
 * An upload instruction from the Worker.
 *
 * Not just a URL, because the two storage backends genuinely differ: R2 wants a
 * raw PUT to a presigned URL, while Immich wants a multipart POST carrying an
 * API key and metadata fields. Describing the whole request keeps that
 * difference on the server, where it belongs.
 */
export interface UploadTicket {
  method: 'PUT' | 'POST';
  url: string;
  headers: Record<string, string>;
  /** When present, send multipart/form-data with these fields plus the file. */
  formFields?: Record<string, string>;
  fileField?: string;
  /** Null when the backend assigns the id and reports it in the response. */
  objectKey: string | null;
  /** Field of the JSON upload response holding the assigned id. */
  objectKeyFrom?: string;
  expiresAt: number;
  provider: 'r2' | 'immich';
}

export async function requestUploadUrl(input: {
  projectId: string;
  mimeType: string;
  size: number;
  kind: 'source_video' | 'thumbnail' | 'export';
  fileName?: string;
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
 * Perform an upload described by a ticket, and return the final object key.
 *
 * Large files never pass through the Worker when the backend supports direct
 * uploads; when it does not, the ticket simply points back at the Worker and
 * this same code path handles it.
 */
export async function performUpload(
  ticket: UploadTicket,
  blob: Blob,
  fileName: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  let body: XMLHttpRequestBodyInit;
  const headers = { ...ticket.headers };

  if (ticket.formFields) {
    const form = new FormData();
    for (const [key, value] of Object.entries(ticket.formFields)) form.append(key, value);
    form.append(ticket.fileField ?? 'file', blob, fileName);
    body = form;
    // Never set Content-Type for FormData - the browser must add the multipart
    // boundary itself, and overriding it produces an unparseable request.
    delete headers['Content-Type'];
  } else {
    body = blob;
    headers['Content-Type'] = headers['Content-Type'] ?? blob.type ?? 'application/octet-stream';
  }

  // The Worker's own routes need the user's token; a presigned URL must not
  // receive it, or S3 rejects the request for having two auth mechanisms.
  if (ticket.url.includes('/storage/upload')) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const responseText = await new Promise<string>((resolve, reject) => {
    // XHR rather than fetch, purely because fetch still has no upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open(ticket.method, ticket.url, true);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.responseText)
        : reject(new ApiError(`Upload failed (${xhr.status}) ${xhr.responseText.slice(0, 200)}`, xhr.status));
    xhr.onerror = () => reject(new ApiError('Upload failed - could not reach storage.', 0));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });

  if (ticket.objectKey) return ticket.objectKey;

  // The backend assigned the id, so read it out of the response.
  const field = ticket.objectKeyFrom ?? 'id';
  try {
    const parsed = JSON.parse(responseText) as Record<string, unknown>;
    const assigned = parsed[field] ?? parsed.objectKey;
    if (typeof assigned === 'string' && assigned.length > 0) return assigned;
  } catch {
    /* fall through to the error below */
  }

  throw new ApiError('The storage backend did not return an object id.', 502);
}

/** Report a direct upload so the server can file it and record the key. */
export async function completeUpload(input: {
  projectId: string;
  kind: 'source_video' | 'thumbnail' | 'export';
  objectKey: string;
}): Promise<void> {
  await request('/storage/complete', { method: 'POST', json: input });
}

/* ------------------------------------------------------------------ */
/* AI                                                                  */
/* ------------------------------------------------------------------ */

export async function transcribeAudio(
  projectId: string,
  audio: Blob,
  options: { mode: 'auto' | 'speech' | 'song'; language?: string; durationMs?: number },
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append('projectId', projectId);
  form.append('mode', options.mode);
  // Lets the server reject a transcript that stops short of the audio.
  if (options.durationMs) form.append('durationMs', String(Math.round(options.durationMs)));
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
