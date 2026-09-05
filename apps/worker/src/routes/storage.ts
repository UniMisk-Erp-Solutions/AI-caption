import { UPLOAD_LIMITS } from '@kc/shared/server';
import { z } from 'zod';
import { assertProjectOwnership, requireUser } from '../auth/jwt';
import { HttpError, json, type Env } from '../lib/env';
import {
  assertImmichOwnership,
  immichMode,
  proxyUpload,
  uploadFields,
  WORKER_BODY_LIMIT,
} from '../storage/immich';
import { getStorageProvider } from '../storage';
import { verifyReadToken } from '../storage/token';

/**
 * Storage routes.
 *
 * Backend-agnostic: everything goes through the selected `StorageProvider`, so
 * the same four endpoints serve R2 presigned URLs and Immich's API-key model
 * without the browser needing to know which is in use.
 */

const uploadRequestSchema = z.object({
  projectId: z.string().uuid(),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().positive(),
  kind: z.enum(['source_video', 'thumbnail', 'export']),
  fileName: z.string().min(1).max(200).default('upload'),
});

const completeSchema = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(['source_video', 'thumbnail', 'export']),
  objectKey: z.string().min(1).max(500),
});

const keyRequestSchema = z.object({ objectKey: z.string().min(1).max(500) });

/* ------------------------------------------------------------------ */
/* Ownership                                                           */
/* ------------------------------------------------------------------ */

/**
 * R2 encodes the owner in the object key, so it can be checked locally. Immich
 * ids are opaque, so ownership is checked against the `assets` table, which is
 * behind RLS and therefore only returns the caller's own rows.
 */
async function assertObjectOwnership(
  env: Env,
  request: Request,
  userId: string,
  objectKey: string,
): Promise<void> {
  const provider = getStorageProvider(env);
  if (provider.id === 'immich') {
    await assertImmichOwnership(env, request, objectKey);
    return;
  }
  await provider.assertOwnership({ env, userId, objectKey });
}

/* ------------------------------------------------------------------ */
/* POST /storage/upload-url                                            */
/* ------------------------------------------------------------------ */

export async function handleUploadUrl(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const user = await requireUser(request, env);
  const input = uploadRequestSchema.parse(await request.json());

  await assertProjectOwnership(env, request, input.projectId);

  if (input.size > UPLOAD_LIMITS.maxSizeBytes) {
    throw new HttpError(413, 'That file is larger than the 250 MB limit.', 'too_large');
  }

  // Only the source upload is restricted to video types; exports and thumbnails
  // are produced by us and have their own expected types.
  if (input.kind === 'source_video') {
    const accepted = UPLOAD_LIMITS.acceptedMimeTypes as readonly string[];
    if (!accepted.includes(input.mimeType)) {
      throw new HttpError(415, `${input.mimeType} is not a supported video type.`, 'bad_type');
    }
  }

  const provider = getStorageProvider(env);

  // In Immich proxy mode the body travels through the Worker, which Cloudflare
  // caps at 100 MB. Say so up front rather than failing mid-upload.
  if (provider.id === 'immich' && immichMode(env) === 'proxy' && input.size > WORKER_BODY_LIMIT) {
    throw new HttpError(
      413,
      'This file is over 100 MB, which is the limit when uploads are proxied. Add an upload-only Immich key (IMMICH_UPLOAD_KEY) to upload directly with no size limit.',
      'proxy_too_large',
    );
  }

  const ticket = await provider.createUploadTicket({
    env,
    userId: user.id,
    projectId: input.projectId,
    kind: input.kind,
    mimeType: input.mimeType,
    size: input.size,
    fileName: input.fileName,
  });

  // A relative URL means "post this back to the Worker" - resolve it here so the
  // browser does not have to know the deployment's own origin.
  const url = ticket.url.startsWith('RELATIVE:')
    ? new URL(ticket.url.slice('RELATIVE:'.length), request.url).toString()
    : ticket.url;

  return json({ ...ticket, url, provider: provider.id }, {}, headers);
}

/* ------------------------------------------------------------------ */
/* POST /storage/upload   (Immich proxy mode only)                     */
/* ------------------------------------------------------------------ */

/**
 * Stream an upload through to Immich using the server-side key.
 *
 * Only reachable in proxy mode. It exists so the setup works with a single
 * full-scope Immich key; adding an upload-only key makes this route unnecessary.
 */
export async function handleProxyUpload(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const user = await requireUser(request, env);

  const provider = getStorageProvider(env);
  if (provider.id !== 'immich') {
    throw new HttpError(400, 'This backend uploads directly, not through the Worker.', 'not_proxy');
  }

  const form = await request.formData();

  const projectId = String(form.get('projectId') ?? '');
  const kind = String(form.get('kind') ?? 'source_video') as 'source_video' | 'thumbnail' | 'export';
  if (!projectId) throw new HttpError(400, 'projectId is required.', 'no_project');
  await assertProjectOwnership(env, request, projectId);

  const file = form.get('assetData');
  if (!file || typeof file === 'string') {
    throw new HttpError(400, 'No file was uploaded.', 'no_file');
  }

  // Rebuild the form rather than forwarding the client's: this guarantees the
  // metadata Immich stores is ours, not whatever the browser chose to send.
  const outbound = new FormData();
  for (const [key, value] of Object.entries(uploadFields(projectId, kind, (file as File).name || 'upload'))) {
    outbound.set(key, value);
  }
  outbound.set('assetData', file as File);

  const { id, duplicate } = await proxyUpload(env, outbound);
  await provider.finalizeUpload({ env, userId: user.id, projectId, kind, objectKey: id });

  return json({ id, objectKey: id, duplicate }, {}, headers);
}

/* ------------------------------------------------------------------ */
/* POST /storage/complete                                              */
/* ------------------------------------------------------------------ */

/**
 * Reported by the browser after a direct upload, since backends that assign
 * their own id (Immich) only reveal it in the upload response.
 */
export async function handleComplete(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const user = await requireUser(request, env);
  const input = completeSchema.parse(await request.json());

  await assertProjectOwnership(env, request, input.projectId);

  const provider = getStorageProvider(env);
  await provider.finalizeUpload({
    env,
    userId: user.id,
    projectId: input.projectId,
    kind: input.kind,
    objectKey: input.objectKey,
  });

  return json({ ok: true, objectKey: input.objectKey }, {}, headers);
}

/* ------------------------------------------------------------------ */
/* POST /storage/download-url                                          */
/* ------------------------------------------------------------------ */

export async function handleDownloadUrl(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const user = await requireUser(request, env);
  const { objectKey } = keyRequestSchema.parse(await request.json());

  await assertObjectOwnership(env, request, user.id, objectKey);

  const provider = getStorageProvider(env);
  const result = await provider.getReadUrl({ env, request, userId: user.id, objectKey });

  return json(result, {}, headers);
}

/* ------------------------------------------------------------------ */
/* GET /storage/stream?token=...                                       */
/* ------------------------------------------------------------------ */

/**
 * Serve an object using a short-lived signed token.
 *
 * The token carries the authorisation, so no header is needed - which is the
 * point, because a `<video src>` cannot set one. Range requests are forwarded
 * so the browser can seek instead of downloading the whole file first.
 */
export async function handleStream(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) throw new HttpError(400, 'Missing token.', 'no_token');

  const claims = await verifyReadToken(env, token);
  const provider = getStorageProvider(env);

  const upstream = await provider.fetchObject({
    env,
    objectKey: claims.objectKey,
    range: request.headers.get('Range'),
  });

  if (!upstream.ok && upstream.status !== 206) {
    throw new HttpError(upstream.status === 404 ? 404 : 502, 'Could not read that file.', 'read_failed');
  }

  // Stream the body straight through - never buffer a video in Worker memory.
  const out = new Headers(headers);
  for (const header of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag']) {
    const value = upstream.headers.get(header);
    if (value) out.set(header, value);
  }
  out.set('Cache-Control', 'private, max-age=900');

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

/* ------------------------------------------------------------------ */
/* POST /storage/delete                                                */
/* ------------------------------------------------------------------ */

export async function handleDelete(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const user = await requireUser(request, env);
  const { objectKey } = keyRequestSchema.parse(await request.json());

  await assertObjectOwnership(env, request, user.id, objectKey);
  await getStorageProvider(env).deleteObject({ env, objectKey });

  return json({ ok: true }, {}, headers);
}
