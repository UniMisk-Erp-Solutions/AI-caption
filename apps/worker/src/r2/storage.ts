import { AwsClient } from 'aws4fetch';
import { HttpError, type Env } from '../lib/env';

/**
 * R2 signed URLs.
 *
 * Large files never pass through the Worker. The browser asks for permission,
 * this code decides the object key and hands back a short-lived presigned PUT,
 * and the upload goes straight to R2.
 *
 * The key point: the *server* composes the object key from the verified user
 * id. A client that sends `users/someone-else/...` gets its own path anyway,
 * so there is no way to write into another user's prefix.
 */

const SIGNED_URL_TTL_SECONDS = 600;

export type AssetKind = 'source_video' | 'thumbnail' | 'export';

function client(env: Env): AwsClient {
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ACCOUNT_ID) {
    throw new HttpError(500, 'Storage is not configured on the server.', 'no_storage_config');
  }
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
}

function endpoint(env: Env, objectKey: string): string {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${objectKey}`;
}

/** Deterministic, server-owned object key. Never accept one from the client. */
export function buildObjectKey(
  userId: string,
  projectId: string,
  kind: AssetKind,
  extension: string,
): string {
  const base = `users/${userId}/projects/${projectId}`;
  switch (kind) {
    case 'source_video':
      return `${base}/source/original-${crypto.randomUUID()}.${extension}`;
    case 'thumbnail':
      return `${base}/thumbnail/thumbnail.webp`;
    case 'export':
      return `${base}/exports/export-${Date.now()}.${extension}`;
  }
}

/**
 * Confirm a key belongs to this user before signing a read or a delete.
 *
 * Cheap, and it closes the obvious hole: the download and delete endpoints take
 * a key from the client, so without this check any authenticated user could
 * read or destroy any other user's video by guessing a path.
 */
export function assertKeyOwnedBy(userId: string, objectKey: string): void {
  if (!objectKey.startsWith(`users/${userId}/`) || objectKey.includes('..')) {
    throw new HttpError(403, 'That object does not belong to you.', 'forbidden_key');
  }
}

export async function signPut(env: Env, objectKey: string, contentType: string): Promise<string> {
  const signed = await client(env).sign(
    new Request(`${endpoint(env, objectKey)}?X-Amz-Expires=${SIGNED_URL_TTL_SECONDS}`, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
    }),
    { aws: { signQuery: true } },
  );
  return signed.url;
}

export async function signGet(env: Env, objectKey: string): Promise<string> {
  const signed = await client(env).sign(
    new Request(`${endpoint(env, objectKey)}?X-Amz-Expires=${SIGNED_URL_TTL_SECONDS}`, {
      method: 'GET',
    }),
    { aws: { signQuery: true } },
  );
  return signed.url;
}

export async function deleteObject(env: Env, objectKey: string): Promise<void> {
  const response = await client(env).fetch(endpoint(env, objectKey), { method: 'DELETE' });
  // 404 means it is already gone, which is the outcome we wanted anyway.
  if (!response.ok && response.status !== 404) {
    throw new HttpError(502, 'Could not delete that file.', 'delete_failed');
  }
}

export function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-matroska': 'mkv',
    'image/webp': 'webp',
    'image/png': 'png',
  };
  return map[mimeType] ?? 'bin';
}

export { SIGNED_URL_TTL_SECONDS };
