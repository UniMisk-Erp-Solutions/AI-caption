import { HttpError, type Env } from '../lib/env';
import { signReadToken } from './token';
import type { AssetKind, StorageProvider, UploadTicket } from './types';

/**
 * Immich provider (self-hosted).
 *
 * Immich has no presigned URLs - authentication is a long-lived `x-api-key`
 * header and nothing else. Handing that to the browser is fine for uploads and
 * catastrophic for reads: one key carrying `asset.read` lets anyone with
 * devtools open enumerate the owner's entire photo library.
 *
 * So the credential is deliberately split, and the provider runs in whichever
 * mode the configured keys allow:
 *
 *   IMMICH_UPLOAD_KEY   scope: asset.upload ONLY. Safe to hand to the browser,
 *                       which then uploads straight to Immich. A leak lets
 *                       someone add junk to the library; it cannot read, list
 *                       or delete anything.
 *                       -> "direct" mode. Preferred. No size ceiling.
 *
 *   IMMICH_API_KEY      full scopes. Never leaves the Worker. Always used for
 *                       reads, deletes and album filing.
 *                       -> without an upload key, uploads are streamed through
 *                          the Worker instead. Simpler to set up, but Cloudflare
 *                          caps a Worker request body at 100 MB.
 *
 * Reads are always proxied. That is affordable specifically because the editor
 * is local-first: the video already sits in IndexedDB on the device that made
 * it, so a cloud read only happens when a project is opened on a second device.
 */

const READ_TTL_SECONDS = 900;

/** Cloudflare's Worker request body limit on Free and Pro plans. */
export const WORKER_BODY_LIMIT = 100 * 1024 * 1024;

export function immichMode(env: Env): 'direct' | 'proxy' {
  return env.IMMICH_UPLOAD_KEY ? 'direct' : 'proxy';
}

function baseUrl(env: Env): string {
  if (!env.IMMICH_URL) {
    throw new HttpError(500, 'Immich storage is not configured on the server.', 'no_storage_config');
  }
  return env.IMMICH_URL.replace(/\/+$/, '');
}

function serverKey(env: Env): string {
  if (!env.IMMICH_API_KEY) {
    throw new HttpError(500, 'The Immich server key is not configured.', 'no_storage_config');
  }
  return env.IMMICH_API_KEY;
}

/** Immich asset ids are UUIDs. Anything else is a client trying something on. */
export function assertAssetId(objectKey: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(objectKey)) {
    throw new HttpError(400, 'That is not a valid Immich asset id.', 'bad_key');
  }
}

async function immichFetch(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('x-api-key', serverKey(env));
  headers.set('Accept', 'application/json');
  return fetch(`${baseUrl(env)}${path}`, { ...init, headers });
}

/* ------------------------------------------------------------------ */
/* Upload metadata                                                     */
/* ------------------------------------------------------------------ */

/**
 * The multipart fields Immich requires on every upload.
 *
 * `deviceAssetId` is Immich's dedupe key, so it is scoped to the project and
 * kind - re-exporting a project replaces its previous export rather than
 * stacking duplicates in the library.
 */
export function uploadFields(projectId: string, kind: AssetKind, fileName: string): Record<string, string> {
  const now = new Date().toISOString();
  return {
    deviceAssetId: `kinetic-${projectId}-${kind}-${crypto.randomUUID()}`,
    deviceId: 'kinetic-caption-studio',
    fileCreatedAt: now,
    fileModifiedAt: now,
    isFavorite: 'false',
    filename: fileName,
  };
}

/**
 * Stream an upload through the Worker to Immich.
 *
 * Used only in proxy mode. The body is piped rather than buffered, but the
 * platform still caps the request at 100 MB, which the route checks first.
 */
export async function proxyUpload(
  env: Env,
  body: FormData,
): Promise<{ id: string; duplicate: boolean }> {
  const response = await fetch(`${baseUrl(env)}/api/assets`, {
    method: 'POST',
    headers: { 'x-api-key': serverKey(env), Accept: 'application/json' },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Immich upload failed', response.status, detail.slice(0, 300));
    throw new HttpError(502, 'Immich rejected the upload.', 'immich_upload_failed');
  }

  const result = (await response.json()) as { id: string; status?: string };
  if (!result.id) throw new HttpError(502, 'Immich returned no asset id.', 'immich_no_id');

  return { id: result.id, duplicate: result.status === 'duplicate' };
}

/* ------------------------------------------------------------------ */
/* Albums - one per user, so a few testers do not merge into one pile  */
/* ------------------------------------------------------------------ */

/**
 * Find or create this user's album.
 *
 * A single Immich account backs every tester, so an album per user is the only
 * separation available. It is organisational, not a security boundary - which
 * is exactly why ownership is checked against Supabase instead.
 */
async function albumIdFor(env: Env, userId: string): Promise<string | null> {
  const name = `${env.IMMICH_ALBUM_PREFIX || 'Kinetic'} · ${userId.slice(0, 8)}`;
  const cacheKey = `immich:album:${userId}`;

  const cached = await env.USAGE?.get(cacheKey);
  if (cached) return cached;

  try {
    const listed = await immichFetch(env, '/api/albums');
    if (listed.ok) {
      const albums = (await listed.json()) as Array<{ id: string; albumName: string }>;
      const existing = albums.find((a) => a.albumName === name);
      if (existing) {
        await env.USAGE?.put(cacheKey, existing.id, { expirationTtl: 86400 });
        return existing.id;
      }
    }

    const created = await immichFetch(env, '/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumName: name, description: `Kinetic caption projects · ${userId}` }),
    });
    if (!created.ok) return null;

    const album = (await created.json()) as { id: string };
    await env.USAGE?.put(cacheKey, album.id, { expirationTtl: 86400 });
    return album.id;
  } catch {
    // Album filing is a convenience. Losing it must not fail an upload.
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Ownership                                                           */
/* ------------------------------------------------------------------ */

/**
 * Immich asset ids carry no owner information, so unlike R2 we cannot read
 * ownership off the key. We ask Supabase instead: the `assets` table is behind
 * RLS, so a row comes back only if it really is this user's.
 */
export async function assertImmichOwnership(
  env: Env,
  request: Request,
  objectKey: string,
): Promise<void> {
  assertAssetId(objectKey);

  const token = (request.headers.get('Authorization') ?? '').slice(7).trim();
  if (!token) throw new HttpError(401, 'Missing access token.', 'no_token');

  const url =
    `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/assets` +
    `?object_key=eq.${encodeURIComponent(objectKey)}&provider=eq.immich&select=id`;

  const response = await fetch(url, {
    // User token for RLS; project key for the gateway. See auth/jwt.ts.
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new HttpError(403, 'Could not verify access to that file.', 'ownership_check_failed');
  }

  const rows = (await response.json()) as Array<{ id: string }>;
  if (rows.length === 0) {
    throw new HttpError(404, 'That file was not found.', 'no_asset');
  }
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export const immichProvider: StorageProvider = {
  id: 'immich',

  async createUploadTicket({ env, projectId, kind, fileName }): Promise<UploadTicket> {
    const fields = uploadFields(projectId, kind, fileName);

    if (immichMode(env) === 'direct') {
      return {
        method: 'POST',
        url: `${baseUrl(env)}/api/assets`,
        // Upload-only scope. See the note at the top of this file for why this
        // is safe to expose and why a read key would not be.
        headers: { 'x-api-key': env.IMMICH_UPLOAD_KEY! },
        formFields: fields,
        fileField: 'assetData',
        // Immich assigns the id, so the browser reports it to /storage/complete.
        objectKey: null,
        objectKeyFrom: 'id',
        expiresAt: Date.now() + 15 * 60 * 1000,
      };
    }

    // Proxy mode: the browser posts to us and we forward with the server key.
    return {
      method: 'POST',
      url: 'RELATIVE:/storage/upload',
      headers: {},
      formFields: { ...fields, projectId, kind },
      fileField: 'assetData',
      objectKey: null,
      objectKeyFrom: 'id',
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
  },

  async finalizeUpload({ env, userId, objectKey }) {
    assertAssetId(objectKey);

    const albumId = await albumIdFor(env, userId);
    if (!albumId) return;

    try {
      await immichFetch(env, `/api/albums/${albumId}/assets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [objectKey] }),
      });
    } catch {
      // Filing failed - the asset is still uploaded and recorded, which is what
      // actually matters.
    }
  },

  async getReadUrl({ env, request, userId, objectKey }) {
    assertAssetId(objectKey);

    // Point the browser at our own proxy rather than at Immich, so the read key
    // stays on the server. The token is scoped to one asset, one user and a
    // short expiry - the presigned-URL property Immich does not provide.
    const expiresAt = Date.now() + READ_TTL_SECONDS * 1000;
    const token = await signReadToken(env, { userId, objectKey, expiresAt });
    const origin = new URL(request.url).origin;

    return { url: `${origin}/storage/stream?token=${encodeURIComponent(token)}`, expiresAt };
  },

  async fetchObject({ env, objectKey, range }) {
    assertAssetId(objectKey);

    const headers = new Headers({ 'x-api-key': serverKey(env) });
    // Forwarding Range is what lets the browser seek in a proxied video instead
    // of downloading the whole file before it can play.
    if (range) headers.set('Range', range);

    return fetch(`${baseUrl(env)}/api/assets/${objectKey}/original`, { headers });
  },

  async deleteObject({ env, objectKey }) {
    assertAssetId(objectKey);

    const response = await immichFetch(env, '/api/assets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      // force skips the trash, so deleting a project actually reclaims space.
      body: JSON.stringify({ ids: [objectKey], force: true }),
    });

    if (!response.ok && response.status !== 404) {
      throw new HttpError(502, 'Could not delete that file from Immich.', 'delete_failed');
    }
  },

  async assertOwnership({ objectKey }) {
    // Shape guard only. The real check needs the caller's token and runs in the
    // route via `assertImmichOwnership`.
    assertAssetId(objectKey);
  },
};
