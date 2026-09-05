import { UPLOAD_LIMITS } from '@kc/shared/server';
import { z } from 'zod';
import { assertProjectOwnership, requireUser } from '../auth/jwt';
import { HttpError, json, type Env } from '../lib/env';
import {
  assertKeyOwnedBy,
  buildObjectKey,
  deleteObject,
  extensionFor,
  signGet,
  signPut,
  SIGNED_URL_TTL_SECONDS,
} from '../r2/storage';

const uploadRequestSchema = z.object({
  projectId: z.string().uuid(),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().positive(),
  kind: z.enum(['source_video', 'thumbnail', 'export']),
});

const keyRequestSchema = z.object({
  objectKey: z.string().min(1).max(500),
});

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

  const objectKey = buildObjectKey(user.id, input.projectId, input.kind, extensionFor(input.mimeType));
  const uploadUrl = await signPut(env, objectKey, input.mimeType);

  return json(
    { uploadUrl, objectKey, expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 },
    {},
    headers,
  );
}

export async function handleDownloadUrl(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const user = await requireUser(request, env);
  const { objectKey } = keyRequestSchema.parse(await request.json());

  assertKeyOwnedBy(user.id, objectKey);
  const url = await signGet(env, objectKey);

  return json({ url, expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 }, {}, headers);
}

export async function handleDelete(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const user = await requireUser(request, env);
  const { objectKey } = keyRequestSchema.parse(await request.json());

  assertKeyOwnedBy(user.id, objectKey);
  await deleteObject(env, objectKey);

  return json({ ok: true }, {}, headers);
}
