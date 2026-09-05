/**
 * Worker bindings and shared helpers.
 *
 * Everything secret lives here and nowhere else. The browser never receives a
 * Gemini key, an R2 credential or a Supabase service role - it sends a user
 * access token and this Worker does the privileged work on its behalf.
 */

export interface Env {
  /** Google AI Studio key. Used for both transcription and design. */
  GEMINI_API_KEY: string;

  /** Supabase project URL, used to fetch the JWKS for token verification. */
  SUPABASE_URL: string;
  /**
   * Supabase anon key. Required as PostgREST's `apikey` header - a user access
   * token is not accepted there. Authorization still carries the user's JWT, so
   * RLS remains in force and this grants no extra privilege.
   */
  SUPABASE_ANON_KEY: string;

  /** 'r2' | 'immich'. Omit to infer from whichever credentials are present. */
  STORAGE_PROVIDER?: string;

  /* ---- Cloudflare R2 ---- */
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;

  /* ---- Self-hosted Immich ---- */
  /** Base URL, e.g. https://immich.example.com */
  IMMICH_URL?: string;
  /**
   * Full-scope key. Server-side only - it can read the whole library, so it
   * must never be sent to a browser.
   */
  IMMICH_API_KEY?: string;
  /**
   * Optional key scoped to `asset.upload` ONLY. When set, the browser uploads
   * straight to Immich and skips the Worker's 100 MB body limit. Safe to expose
   * precisely because it cannot read anything.
   */
  IMMICH_UPLOAD_KEY?: string;
  /** Album name prefix; one album is created per user. */
  IMMICH_ALBUM_PREFIX?: string;

  /** HMAC secret for short-lived read tokens. Required in production. */
  STORAGE_TOKEN_SECRET?: string;

  /** Comma-separated list of origins allowed to call this Worker. */
  ALLOWED_ORIGIN: string;

  /** Optional. Usage counters and the resolved-model cache. */
  USAGE?: KVNamespace;
}

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);

  // Echo the origin only when it is on the list. A wildcard would let any site
  // spend this project's Gemini quota using a logged-in user's token.
  const match = allowed.includes(origin) ? origin : allowed[0] ?? '';

  return {
    'Access-Control-Allow-Origin': match,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(data: unknown, init: ResponseInit = {}, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(extraHeaders)) },
  });
}

export function errorResponse(error: unknown, headers: HeadersInit = {}): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message, code: error.code }, { status: error.status }, headers);
  }
  // Never leak an internal message to the client - log it instead.
  console.error('Unhandled worker error', error);
  return json({ error: 'Something went wrong.' }, { status: 500 }, headers);
}

/* ------------------------------------------------------------------ */
/* Usage limits                                                        */
/* ------------------------------------------------------------------ */

/**
 * Count a metered action against a per-user daily budget.
 *
 * Best-effort by design: without a KV binding the Worker still runs, it just
 * does not enforce quotas. That keeps local development frictionless while the
 * deployed Worker protects the free tier.
 */
export async function enforceUsage(
  env: Env,
  userId: string,
  type: string,
  limit: number,
): Promise<void> {
  if (!env.USAGE) return;

  const day = new Date().toISOString().slice(0, 10);
  const key = `usage:${userId}:${type}:${day}`;

  const current = Number((await env.USAGE.get(key)) ?? '0');
  if (current >= limit) {
    throw new HttpError(
      429,
      `Daily limit reached for ${type} (${limit}/day). Try again tomorrow.`,
      'quota_exceeded',
    );
  }

  // Two days of TTL so a request near midnight cannot resurrect a stale count.
  await env.USAGE.put(key, String(current + 1), { expirationTtl: 60 * 60 * 48 });
}
