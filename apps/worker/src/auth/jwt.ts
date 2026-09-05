import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { HttpError, type Env } from '../lib/env';

/**
 * Supabase token verification.
 *
 * The user id always comes from a cryptographically verified token, never from
 * the request body. That single rule is what makes the "does this user own this
 * project" check meaningful - otherwise a client could simply claim to be
 * someone else.
 *
 * Supabase issues asymmetric (ES256/RS256) tokens signed with keys published at
 * the project's JWKS endpoint, so we verify against that rather than holding a
 * shared secret in the Worker.
 */

export interface AuthedUser {
  id: string;
  email?: string;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(supabaseUrl: string) {
  const url = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`;
  let jwks = jwksCache.get(url);
  if (!jwks) {
    // createRemoteJWKSet caches keys internally and refetches on rotation, so
    // one instance per project URL is exactly what we want.
    jwks = createRemoteJWKSet(new URL(url), { cooldownDuration: 30_000 });
    jwksCache.set(url, jwks);
  }
  return jwks;
}

export async function requireUser(request: Request, env: Env): Promise<AuthedUser> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) throw new HttpError(401, 'Missing access token.', 'no_token');
  if (!env.SUPABASE_URL) throw new HttpError(500, 'Auth is not configured.', 'no_auth_config');

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, jwksFor(env.SUPABASE_URL), {
      issuer: `${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1`,
    });
    payload = verified.payload;
  } catch (error) {
    throw new HttpError(401, 'Your session has expired. Please sign in again.', 'bad_token');
  }

  const id = typeof payload.sub === 'string' ? payload.sub : '';
  if (!id) throw new HttpError(401, 'Token has no subject.', 'bad_token');

  // Anonymous and service tokens must not reach the AI endpoints.
  if (payload.role && payload.role !== 'authenticated') {
    throw new HttpError(403, 'This token cannot be used here.', 'bad_role');
  }

  return { id, email: typeof payload.email === 'string' ? payload.email : undefined };
}

/**
 * Confirm the caller owns a project.
 *
 * Uses the caller's own token against PostgREST, so Supabase's row-level
 * security does the authorisation - the Worker never needs a service role key,
 * and there is no second copy of the ownership rules to drift out of sync.
 */
export async function assertProjectOwnership(
  env: Env,
  request: Request,
  projectId: string,
): Promise<void> {
  const token = (request.headers.get('Authorization') ?? '').slice(7).trim();
  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}&select=id`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      // PostgREST requires an apikey header; the user's own JWT serves as one
      // and keeps every query bound to their RLS policies.
      apikey: token,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new HttpError(403, 'Could not verify project access.', 'ownership_check_failed');
  }

  const rows = (await response.json()) as Array<{ id: string }>;
  if (rows.length === 0) {
    throw new HttpError(404, 'Project not found.', 'no_project');
  }
}
