import { HttpError, type Env } from '../lib/env';

/**
 * Short-lived read tokens.
 *
 * This is the piece that gives Immich the one property it lacks: a URL that
 * grants access to exactly one asset, for one user, for a few minutes, and
 * carries no reusable credential.
 *
 * The token is an HMAC over (userId, objectKey, expiry) signed with a server
 * secret. It goes in a query string so a plain `<video src>` can use it - no
 * headers, which is the whole point, since a video element cannot set them.
 */

interface TokenClaims {
  userId: string;
  objectKey: string;
  expiresAt: number;
}

function secretFor(env: Env): string {
  // Fall back to the Supabase URL only so local dev works without extra setup;
  // a deployed Worker must set a real secret or tokens are guessable.
  const secret = env.STORAGE_TOKEN_SECRET || env.SUPABASE_URL;
  if (!secret) {
    throw new HttpError(500, 'Storage tokens are not configured.', 'no_token_secret');
  }
  return secret;
}

async function hmacKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretFor(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** URL-safe base64 without padding. */
function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function signReadToken(env: Env, claims: TokenClaims): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(payload));
  return `${payload}.${b64url(signature)}`;
}

export async function verifyReadToken(env: Env, token: string): Promise<TokenClaims> {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    throw new HttpError(401, 'Malformed access token.', 'bad_token');
  }

  // Verify before parsing, so we never act on attacker-controlled JSON.
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(env),
    unb64url(signature),
    new TextEncoder().encode(payload),
  );
  if (!valid) {
    throw new HttpError(401, 'Invalid access token.', 'bad_token');
  }

  let claims: TokenClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(unb64url(payload))) as TokenClaims;
  } catch {
    throw new HttpError(401, 'Malformed access token.', 'bad_token');
  }

  if (!claims.expiresAt || Date.now() > claims.expiresAt) {
    throw new HttpError(401, 'That link has expired. Reload the project.', 'expired_token');
  }

  return claims;
}
