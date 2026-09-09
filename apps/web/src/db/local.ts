import Dexie, { type Table } from 'dexie';
import type { EditorState } from '@kc/shared';

/**
 * Local persistence.
 *
 * This is layer 2 of the three-layer autosave (memory -> IndexedDB -> Supabase)
 * and it is the layer that actually saves people's work. Network calls fail,
 * tabs get closed, laptops sleep - IndexedDB is written on every meaningful
 * edit and is what we compare against on reopen.
 *
 * In local mode it is also the *only* store, including for the video blob
 * itself, which is why `sourceBlob` lives here rather than being a cloud-only
 * concern.
 */

export interface LocalProject {
  id: string;
  /**
   * Who this project belongs to.
   *
   * IndexedDB is per-browser, not per-account. Without this every read
   * returned every project the browser had ever seen, so signing out and in as
   * somebody else showed them the previous account's projects - titles,
   * thumbnails and the source video itself. The server was never the leak: RLS
   * scopes Supabase correctly. The local cache simply had no notion of an
   * owner.
   *
   * Undefined means a row written before this column existed. Those are
   * claimed on sign-in, but only for a user the server agrees owns them - see
   * `claimLegacyProjects`.
   */
  userId?: string;
  title: string;
  status: 'draft' | 'uploading' | 'processing' | 'ready' | 'error';
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  /** Present in local mode; in cloud mode the source lives in R2. */
  sourceBlob?: Blob;
  sourceMimeType?: string;
  sourceName?: string;
  thumbnail?: Blob;
  createdAt: number;
  updatedAt: number;
}

export interface LocalEditorState {
  projectId: string;
  state: EditorState;
  /** Bumped locally; compared with the server revision on reopen. */
  revision: number;
  updatedAt: number;
  /** False until the debounced Supabase write confirms. */
  synced: boolean;
}

export interface LocalExport {
  id: string;
  projectId: string;
  blob: Blob;
  width: number;
  height: number;
  fps: number;
  sizeBytes: number;
  createdAt: number;
}

class KineticDb extends Dexie {
  projects!: Table<LocalProject, string>;
  editorStates!: Table<LocalEditorState, string>;
  exports!: Table<LocalExport, string>;

  constructor() {
    super('kinetic-caption-studio');
    this.version(1).stores({
      projects: 'id, updatedAt, status',
      editorStates: 'projectId, updatedAt, synced',
      exports: 'id, projectId, createdAt',
    });

    // v2 indexes the owner. Existing rows keep userId undefined and are
    // deliberately NOT assigned here: which account they belong to is not
    // knowable from inside the database, and guessing would hand one user's
    // work to whoever happens to sign in next.
    this.version(2).stores({
      projects: 'id, updatedAt, status, userId',
      editorStates: 'projectId, updatedAt, synced',
      exports: 'id, projectId, createdAt',
    });
  }
}

export const db = new KineticDb();

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

/**
 * Projects belonging to `userId`.
 *
 * The owner is required rather than optional so a caller cannot accidentally
 * ask for "everything" - which is exactly what every caller used to get.
 * Unclaimed legacy rows are excluded: they are shown only once the server has
 * confirmed who owns them.
 */
export async function listLocalProjects(userId: string): Promise<LocalProject[]> {
  const rows = await db.projects.orderBy('updatedAt').reverse().toArray();
  return rows.filter((row) => row.userId === userId);
}

/**
 * One project, but only if this user owns it.
 *
 * Filtering the list is not enough on its own: project ids appear in the URL,
 * so /project/<id> would otherwise open another account's work directly.
 */
export async function getLocalProject(
  id: string,
  userId: string,
): Promise<LocalProject | undefined> {
  const row = await db.projects.get(id);
  if (!row) return undefined;
  return row.userId === userId ? row : undefined;
}

export async function putLocalProject(project: LocalProject): Promise<void> {
  await db.projects.put({ ...project, updatedAt: Date.now() });
}

/**
 * Adopt pre-v2 rows for a user the server confirms owns them.
 *
 * `ownedIds` comes from Supabase under RLS, so it can only ever contain
 * projects this user really owns - the claim cannot be spoofed from the client.
 * A legacy row missing from that list stays unclaimed and invisible rather than
 * being deleted: it may be the only copy of work made before cloud sync worked,
 * and it becomes visible again as soon as the server knows about it.
 */
export async function claimLegacyProjects(userId: string, ownedIds: string[]): Promise<number> {
  if (ownedIds.length === 0) return 0;
  const owned = new Set(ownedIds);
  let claimed = 0;

  await db.transaction('rw', db.projects, async () => {
    const rows = await db.projects.toArray();
    for (const row of rows) {
      if (row.userId !== undefined || !owned.has(row.id)) continue;
      await db.projects.update(row.id, { userId });
      claimed++;
    }
  });

  return claimed;
}

export async function patchLocalProject(id: string, patch: Partial<LocalProject>): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: Date.now() });
}

/**
 * Delete a project and everything hanging off it. Orphaned video blobs are the
 * fastest way to fill a user's disk quota, so this is deliberately thorough.
 */
export async function deleteLocalProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.editorStates, db.exports, async () => {
    await db.projects.delete(id);
    await db.editorStates.delete(id);
    await db.exports.where('projectId').equals(id).delete();
  });
}

/* ------------------------------------------------------------------ */
/* Editor state                                                        */
/* ------------------------------------------------------------------ */

export async function loadLocalState(projectId: string): Promise<LocalEditorState | undefined> {
  return db.editorStates.get(projectId);
}

export async function saveLocalState(
  projectId: string,
  state: EditorState,
  synced = false,
): Promise<void> {
  await db.editorStates.put({
    projectId,
    state,
    revision: state.revision,
    updatedAt: Date.now(),
    synced,
  });
}

export async function markSynced(projectId: string, revision: number): Promise<void> {
  const existing = await db.editorStates.get(projectId);
  // Only clear the dirty flag if nothing has been edited since the write we are
  // confirming - otherwise we would lose the newer changes on the next reopen.
  if (existing && existing.revision === revision) {
    await db.editorStates.update(projectId, { synced: true });
  }
}

export async function unsyncedProjectIds(): Promise<string[]> {
  const rows = await db.editorStates.filter((r) => !r.synced).toArray();
  return rows.map((r) => r.projectId);
}

/* ------------------------------------------------------------------ */
/* Exports                                                             */
/* ------------------------------------------------------------------ */

export async function saveLocalExport(record: LocalExport): Promise<void> {
  await db.exports.put(record);
}

export async function listLocalExports(projectId: string): Promise<LocalExport[]> {
  const rows = await db.exports.where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteLocalExport(id: string): Promise<void> {
  await db.exports.delete(id);
}

/* ------------------------------------------------------------------ */
/* Usage                                                               */
/* ------------------------------------------------------------------ */

/** Rough bytes held in IndexedDB, for the storage meter on the dashboard. */
export async function estimateLocalUsage(): Promise<{ used: number; quota: number }> {
  if (!navigator.storage?.estimate) return { used: 0, quota: 0 };
  const est = await navigator.storage.estimate();
  return { used: est.usage ?? 0, quota: est.quota ?? 0 };
}
