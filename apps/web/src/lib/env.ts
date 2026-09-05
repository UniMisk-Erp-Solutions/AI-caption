/**
 * Runtime configuration.
 *
 * The app has two modes, and which one it is in is decided entirely by whether
 * these variables are set:
 *
 *   Local mode  - nothing configured. Projects live in IndexedDB, the video
 *                 never leaves the browser, and captions come from the built-in
 *                 deterministic designer. Everything in the editor works,
 *                 including export. This exists so the project is runnable the
 *                 moment you clone it, with no accounts to create.
 *
 *   Cloud mode  - Supabase and the Worker are configured. Accounts, R2 storage,
 *                 Gemini transcription and Gemma design all come online.
 *
 * The UI never branches on "is this local" beyond a badge - the storage and AI
 * layers are adapters that present the same interface either way.
 */

const raw = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
} as Record<string, string | undefined>;

const clean = (v: string | undefined): string | null => {
  const t = (v ?? '').trim();
  return t.length > 0 ? t.replace(/\/+$/, '') : null;
};

export const env = {
  supabaseUrl: clean(raw.supabaseUrl),
  supabaseAnonKey: clean(raw.supabaseAnonKey),
  apiBaseUrl: clean(raw.apiBaseUrl),
};

/** True when accounts and cloud project storage are available. */
export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/** True when the Worker (and therefore Gemini/Gemma and R2) is reachable. */
export const hasApi = Boolean(env.apiBaseUrl);

export const isLocalMode = !hasSupabase;

export const modeLabel = isLocalMode ? 'Local mode' : hasApi ? 'Cloud' : 'Cloud (no AI)';
