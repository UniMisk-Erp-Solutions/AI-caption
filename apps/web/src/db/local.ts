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
  }
}

export const db = new KineticDb();

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export async function listLocalProjects(): Promise<LocalProject[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function getLocalProject(id: string): Promise<LocalProject | undefined> {
  return db.projects.get(id);
}

export async function putLocalProject(project: LocalProject): Promise<void> {
  await db.projects.put({ ...project, updatedAt: Date.now() });
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
