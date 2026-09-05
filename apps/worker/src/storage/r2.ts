import { AwsClient } from 'aws4fetch';
import { HttpError, type Env } from '../lib/env';
import type { AssetKind, StorageProvider, UploadTicket } from './types';

/**
 * Cloudflare R2 provider.
 *
 * The straightforward case: R2 speaks S3, so both uploads and downloads are
 * presigned URLs scoped to a single object with a short expiry, and no
 * credential ever reaches the browser.
 */

const TTL_SECONDS = 600;

function client(env: Env): AwsClient {
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ACCOUNT_ID) {
    throw new HttpError(500, 'R2 storage is not configured on the server.', 'no_storage_config');
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
function buildObjectKey(userId: string, projectId: string, kind: AssetKind, extension: string): string {
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

export const r2Provider: StorageProvider = {
  id: 'r2',

  async createUploadTicket({ env, userId, projectId, kind, mimeType }): Promise<UploadTicket> {
    const objectKey = buildObjectKey(userId, projectId, kind, extensionFor(mimeType));

    const signed = await client(env).sign(
      new Request(`${endpoint(env, objectKey)}?X-Amz-Expires=${TTL_SECONDS}`, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
      }),
      { aws: { signQuery: true } },
    );

    return {
      method: 'PUT',
      url: signed.url,
      headers: { 'Content-Type': mimeType },
      objectKey,
      expiresAt: Date.now() + TTL_SECONDS * 1000,
    };
  },

  async finalizeUpload() {
    // R2 needs no bookkeeping - the key already encodes the owner and project.
  },

  async getReadUrl({ env, objectKey }) {
    const signed = await client(env).sign(
      new Request(`${endpoint(env, objectKey)}?X-Amz-Expires=${TTL_SECONDS}`, { method: 'GET' }),
      { aws: { signQuery: true } },
    );
    return { url: signed.url, expiresAt: Date.now() + TTL_SECONDS * 1000 };
  },

  async fetchObject({ env, objectKey, range }) {
    const headers = new Headers();
    if (range) headers.set('Range', range);
    return client(env).fetch(endpoint(env, objectKey), { headers });
  },

  async deleteObject({ env, objectKey }) {
    const response = await client(env).fetch(endpoint(env, objectKey), { method: 'DELETE' });
    // 404 means it is already gone, which is the outcome we wanted anyway.
    if (!response.ok && response.status !== 404) {
      throw new HttpError(502, 'Could not delete that file.', 'delete_failed');
    }
  },

  async assertOwnership({ userId, objectKey }) {
    // The key is a path we generated, so ownership is readable straight off it.
    if (!objectKey.startsWith(`users/${userId}/`) || objectKey.includes('..')) {
      throw new HttpError(403, 'That object does not belong to you.', 'forbidden_key');
    }
  },
};
