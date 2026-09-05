import { HttpError, type Env } from '../lib/env';
import { immichProvider } from './immich';
import { r2Provider } from './r2';
import type { StorageProvider } from './types';

/**
 * Storage provider selection.
 *
 * `STORAGE_PROVIDER` picks explicitly; otherwise we infer from whichever set of
 * credentials is actually present, so a deployment that only configured one
 * backend simply works.
 */
export function getStorageProvider(env: Env): StorageProvider {
  const explicit = (env.STORAGE_PROVIDER || '').trim().toLowerCase();

  if (explicit === 'immich') return immichProvider;
  if (explicit === 'r2') return r2Provider;

  if (env.IMMICH_URL && env.IMMICH_API_KEY) return immichProvider;
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID) return r2Provider;

  throw new HttpError(
    500,
    'No storage backend is configured. Set either the Immich or the R2 variables.',
    'no_storage_config',
  );
}

/** True when at least one backend is usable - used by /health. */
export function hasStorage(env: Env): boolean {
  return Boolean(
    (env.IMMICH_URL && env.IMMICH_API_KEY) || (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID),
  );
}

export { immichProvider, r2Provider };
export * from './types';
