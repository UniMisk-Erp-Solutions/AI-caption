import { editorStateSchema, type EditorState } from '@kc/shared';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabase } from './env';

/**
 * Supabase client and project persistence.
 *
 * The client is null in local mode, and every function here degrades to a no-op
 * or a local-only path rather than throwing. That is what lets the same editor
 * code run with or without a backend configured.
 *
 * Only the anon key ever reaches the browser. RLS on every table does the
 * actual authorisation - the app never relies on hiding an id in the UI.
 */

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export async function signUp(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Accounts are not configured.');
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Accounts are not configured.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Accounts are not configured.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard` },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export interface RemoteProject {
  id: string;
  user_id: string;
  title: string;
  status: string;
  width: number;
  height: number;
  fps: number;
  duration_ms: number;
  editor_state: EditorState | null;
  source_object_key: string | null;
  thumbnail_key: string | null;
  created_at: string;
  updated_at: string;
}

export async function listRemoteProjects(): Promise<RemoteProject[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RemoteProject[];
}

export async function getRemoteProject(id: string): Promise<RemoteProject | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as RemoteProject) ?? null;
}

export async function createRemoteProject(input: {
  id: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
}): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase.from('projects').insert({
    id: input.id,
    user_id: userId,
    title: input.title,
    status: 'draft',
    width: input.width,
    height: input.height,
    fps: input.fps,
    duration_ms: input.durationMs,
  });
  if (error) throw error;
}

export async function updateRemoteProject(
  id: string,
  patch: Partial<{
    title: string;
    status: string;
    width: number;
    height: number;
    fps: number;
    duration_ms: number;
    source_object_key: string;
    thumbnail_key: string;
  }>,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('projects').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * Push editor state.
 *
 * `revision` is compared server-side so a slow request that lands after a newer
 * one cannot overwrite it - out-of-order autosaves are the classic way to lose
 * a user's last edit.
 */
export async function saveRemoteState(projectId: string, state: EditorState): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('projects')
    .update({
      editor_state: state,
      duration_ms: state.project.durationMs,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .lt('editor_state->>revision', String(state.revision));

  // A no-row update here means the stored revision is newer, which is fine -
  // the newer state wins and this write is correctly discarded.
  if (error) throw error;
}

export async function deleteRemoteProject(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export function parseRemoteState(raw: unknown): EditorState | null {
  if (!raw) return null;
  const parsed = editorStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/* ------------------------------------------------------------------ */
/* Transcripts and exports                                             */
/* ------------------------------------------------------------------ */

export async function saveRemoteTranscript(input: {
  projectId: string;
  language: string;
  contentType: string;
  fullText: string;
  words: unknown;
  provider: string;
}): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;

  const { error } = await supabase.from('transcripts').upsert(
    {
      project_id: input.projectId,
      user_id: userId,
      language: input.language,
      content_type: input.contentType,
      full_text: input.fullText,
      words: input.words,
      provider: input.provider,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id' },
  );
  if (error) throw error;
}

/**
 * Record an uploaded asset.
 *
 * This is not just bookkeeping. With Immich, asset ids carry no owner
 * information, so the Worker proves ownership by looking the key up in this
 * table - which is behind RLS and therefore only ever returns the caller's own
 * rows. If this insert does not happen, playback and deletion will correctly
 * refuse the file.
 */
export async function recordAsset(input: {
  projectId: string;
  kind: 'source_video' | 'thumbnail' | 'export';
  provider: string;
  objectKey: string;
  mimeType?: string;
  sizeBytes?: number;
  durationMs?: number;
}): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;

  const row = {
    user_id: userId,
    project_id: input.projectId,
    type: input.kind,
    provider: input.provider,
    object_key: input.objectKey,
    mime_type: input.mimeType ?? null,
    size_bytes: input.sizeBytes ?? null,
    duration_ms: input.durationMs ?? null,
  };

  const { error } = await supabase.from('assets').upsert(row, { onConflict: 'provider,object_key' });
  if (!error) return;

  // 42P10 means the unique index this upsert targets does not exist yet, i.e.
  // migration 0002 has not been applied. Fall back to a plain insert so the app
  // still works; the only cost is a duplicate row on re-upload.
  if (error.code === '42P10') {
    const { error: insertError } = await supabase.from('assets').insert(row);
    if (insertError && insertError.code !== '23505') throw insertError;
    return;
  }
  throw error;
}

export async function recordRemoteExport(input: {
  projectId: string;
  objectKey: string;
  width: number;
  height: number;
  fps: number;
  sizeBytes: number;
}): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;

  const { error } = await supabase.from('exports').insert({
    project_id: input.projectId,
    user_id: userId,
    object_key: input.objectKey,
    width: input.width,
    height: input.height,
    fps: input.fps,
    size_bytes: input.sizeBytes,
    status: 'complete',
  });
  if (error) throw error;
}
