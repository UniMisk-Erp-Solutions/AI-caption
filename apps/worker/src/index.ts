import { ZodError } from 'zod';
import { resolveAllModels } from './gemini/client';
import { corsHeaders, errorResponse, HttpError, json, type Env } from './lib/env';
import { handleAnalyzeAudio, handleDesign, handleRedesignScene, handleTranscribe } from './routes/ai';
import {
  handleComplete,
  handleDelete,
  handleDownloadUrl,
  handleProxyUpload,
  handleStream,
  handleUploadUrl,
} from './routes/storage';
import { getStorageProvider, hasStorage } from './storage';
import { immichMode } from './storage/immich';

/**
 * The API gateway.
 *
 * Small on purpose. Its whole job is: verify who is calling, check they own
 * what they are asking about, enforce the quota, and forward to Google or R2
 * with credentials the browser never sees.
 */

type Handler = (request: Request, env: Env, headers: HeadersInit) => Promise<Response>;

const ROUTES: Record<string, { method: string; handler: Handler }> = {
  '/storage/upload-url': { method: 'POST', handler: handleUploadUrl },
  '/storage/upload': { method: 'POST', handler: handleProxyUpload },
  '/storage/complete': { method: 'POST', handler: handleComplete },
  '/storage/download-url': { method: 'POST', handler: handleDownloadUrl },
  '/storage/stream': { method: 'GET', handler: handleStream },
  '/storage/delete': { method: 'POST', handler: handleDelete },
  '/ai/transcribe': { method: 'POST', handler: handleTranscribe },
  '/ai/analyze-audio': { method: 'POST', handler: handleAnalyzeAudio },
  '/ai/design': { method: 'POST', handler: handleDesign },
  '/ai/redesign-scene': { method: 'POST', handler: handleRedesignScene },
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (path === '/health' || path === '/') {
        return await handleHealth(env, headers);
      }

      const route = ROUTES[path];
      if (!route) {
        throw new HttpError(404, `No route for ${path}.`, 'not_found');
      }
      if (route.method !== request.method) {
        throw new HttpError(405, `${path} expects ${route.method}.`, 'bad_method');
      }

      return await route.handler(request, env, headers);
    } catch (error) {
      // Zod failures are the client's fault, so report them as 400 with the
      // specific field rather than a generic 500.
      if (error instanceof ZodError) {
        const first = error.errors[0];
        return json(
          {
            error: `Invalid request: ${first?.path.join('.') || 'body'} ${first?.message ?? ''}`.trim(),
            code: 'invalid_request',
          },
          { status: 400 },
          headers,
        );
      }
      return errorResponse(error, headers);
    }
  },
};

/**
 * Health check.
 *
 * Reports which models actually resolved for this key, which is the fastest way
 * to answer "why is the design step failing" without reading Worker logs.
 */
async function handleHealth(env: Env, headers: HeadersInit): Promise<Response> {
  const configured = {
    gemini: Boolean(env.GEMINI_API_KEY),
    supabase: Boolean(env.SUPABASE_URL),
    storage: hasStorage(env),
    usageCounters: Boolean(env.USAGE),
  };

  // Report the storage arrangement, because "why is my upload failing" is
  // almost always a missing key or the wrong upload mode.
  let storage: Record<string, unknown> | null = null;
  if (configured.storage) {
    try {
      const provider = getStorageProvider(env);
      storage = {
        provider: provider.id,
        ...(provider.id === 'immich'
          ? {
              url: env.IMMICH_URL,
              uploadMode: immichMode(env),
              note:
                immichMode(env) === 'proxy'
                  ? 'Uploads stream through the Worker and are capped at 100 MB. Set IMMICH_UPLOAD_KEY (scope: asset.upload) for direct uploads with no cap.'
                  : 'Uploads go straight from the browser to Immich.',
            }
          : { bucket: env.R2_BUCKET_NAME }),
      };
    } catch {
      storage = null;
    }
  }

  let models: Record<string, string> | null = null;
  if (configured.gemini) {
    models = await resolveAllModels(env).catch(() => null);
  }

  return json({ ok: true, configured, storage, models }, {}, headers);
}
