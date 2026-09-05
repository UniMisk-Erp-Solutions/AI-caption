import type { Env } from '../lib/env';

/**
 * The storage provider interface.
 *
 * Two backends implement this: Cloudflare R2 and a self-hosted Immich server.
 * They differ in one architecturally important way, and the interface is shaped
 * around that difference rather than pretending it does not exist:
 *
 *   R2     can mint a presigned URL scoped to a single object for ten minutes.
 *          Nothing secret ever reaches the browser, for uploads or downloads.
 *
 *   Immich has no presigned URLs at all - only a long-lived `x-api-key`. So we
 *          split the credential in two: an *upload-only* key that the browser
 *          is allowed to hold (a leak lets someone add junk to the library, but
 *          never read it), and a full key that stays on the server and is used
 *          for reads, album management and deletion.
 *
 * Hence `UploadTicket` describes an HTTP request for the browser to make rather
 * than just a URL, and `getReadUrl` may return a URL pointing back at this
 * Worker instead of at the storage host.
 */

export type AssetKind = 'source_video' | 'thumbnail' | 'export';

/**
 * Everything the browser needs to perform the upload itself. Large files never
 * pass through the Worker on either backend.
 */
export interface UploadTicket {
  method: 'PUT' | 'POST';
  url: string;
  /** Headers to set on the upload request. May carry an upload-scoped key. */
  headers: Record<string, string>;
  /**
   * When present, send `multipart/form-data` with these fields plus the file
   * under `fileField`. When absent, send the raw body.
   */
  formFields?: Record<string, string>;
  fileField?: string;
  /**
   * The key we will store in Supabase. Null when the backend assigns the id
   * itself (Immich), in which case the browser reads it from the upload
   * response and reports it to `/storage/complete`.
   */
  objectKey: string | null;
  /** Where in the JSON upload response the assigned id lives, if any. */
  objectKeyFrom?: string;
  expiresAt: number;
}

export interface StorageProvider {
  readonly id: 'r2' | 'immich';

  /** Prepare a browser-performed upload. */
  createUploadTicket(input: {
    env: Env;
    userId: string;
    projectId: string;
    kind: AssetKind;
    mimeType: string;
    size: number;
    fileName: string;
  }): Promise<UploadTicket>;

  /**
   * Called after the browser reports a successful upload. Providers use it for
   * bookkeeping the browser cannot do with its limited credential - filing the
   * asset into a per-user album, for instance.
   */
  finalizeUpload(input: {
    env: Env;
    userId: string;
    projectId: string;
    kind: AssetKind;
    objectKey: string;
  }): Promise<void>;

  /**
   * A URL the browser can fetch the object from.
   *
   * For R2 this is a presigned GET straight to R2. For Immich it points back at
   * this Worker's streaming proxy, because the read credential must not leave
   * the server.
   */
  getReadUrl(input: {
    env: Env;
    request: Request;
    userId: string;
    objectKey: string;
  }): Promise<{ url: string; expiresAt: number }>;

  /** Fetch the object server-side. Used by the streaming proxy. */
  fetchObject(input: {
    env: Env;
    objectKey: string;
    range: string | null;
  }): Promise<Response>;

  deleteObject(input: { env: Env; objectKey: string }): Promise<void>;

  /**
   * Reject a key that does not belong to this user.
   *
   * The download and delete endpoints take a key from the client, so without
   * this any authenticated user could read or destroy another user's video by
   * guessing one.
   */
  assertOwnership(input: { env: Env; userId: string; objectKey: string }): Promise<void>;
}
