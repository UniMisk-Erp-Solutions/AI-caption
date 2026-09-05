import { editorStateSchema, type EditorState } from '@kc/shared';
import {
  deleteLocalProject,
  getLocalProject,
  listLocalProjects,
  loadLocalState,
  markSynced,
  patchLocalProject,
  putLocalProject,
  saveLocalState,
  type LocalProject,
} from '../db/local';
import {
  completeUpload,
  deleteObject,
  performUpload,
  requestDownloadUrl,
  requestUploadUrl,
} from './api';
import { hasApi, hasSupabase } from './env';
import {
  createRemoteProject,
  deleteRemoteProject,
  getRemoteProject,
  listRemoteProjects,
  parseRemoteState,
  recordAsset,
  saveRemoteState,
  updateRemoteProject,
} from './supabase';

/**
 * Project repository.
 *
 * One interface over two very different storage arrangements, so no UI
 * component ever has to ask "are we in local mode".
 *
 * The design is local-first in both modes. IndexedDB always holds a copy, and
 * the cloud is a sync target rather than the source of truth. That is what
 * makes the editor survive a dropped connection: an autosave that cannot reach
 * Supabase is still safely on disk, and gets pushed on the next successful
 * write or the next time the project is opened.
 */

export interface ProjectSummary {
  id: string;
  title: string;
  status: LocalProject['status'];
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  thumbnailUrl: string | null;
  updatedAt: number;
  /** True when the local copy has edits that have not reached the server. */
  dirty: boolean;
}

export interface OpenedProject {
  project: LocalProject;
  state: EditorState | null;
  sourceBlob: Blob | null;
  /** Set when we recovered newer local edits over the server's copy. */
  recoveredUnsynced: boolean;
}

/* ------------------------------------------------------------------ */
/* Listing                                                             */
/* ------------------------------------------------------------------ */

export async function listProjects(): Promise<ProjectSummary[]> {
  const local = await listLocalProjects();
  const byId = new Map(local.map((p) => [p.id, p]));

  if (hasSupabase) {
    try {
      // Projects created on another device exist remotely but not locally.
      // Surface them as stubs so they can be opened and pulled down.
      for (const remote of await listRemoteProjects()) {
        if (byId.has(remote.id)) continue;
        byId.set(remote.id, {
          id: remote.id,
          title: remote.title,
          status: (remote.status as LocalProject['status']) ?? 'ready',
          width: remote.width,
          height: remote.height,
          fps: remote.fps,
          durationMs: remote.duration_ms,
          createdAt: Date.parse(remote.created_at),
          updatedAt: Date.parse(remote.updated_at),
        });
      }
    } catch {
      /* offline - the local list is still correct and complete enough */
    }
  }

  const summaries = await Promise.all(
    [...byId.values()].map(async (p) => {
      const localState = await loadLocalState(p.id);
      return {
        id: p.id,
        title: p.title,
        status: p.status,
        width: p.width,
        height: p.height,
        fps: p.fps,
        durationMs: p.durationMs,
        thumbnailUrl: p.thumbnail ? URL.createObjectURL(p.thumbnail) : null,
        updatedAt: p.updatedAt,
        dirty: Boolean(localState && !localState.synced),
      } satisfies ProjectSummary;
    }),
  );

  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ------------------------------------------------------------------ */
/* Creating                                                            */
/* ------------------------------------------------------------------ */

export async function createProject(input: {
  id: string;
  title: string;
  file: Blob;
  fileName: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  thumbnail: Blob | null;
}): Promise<void> {
  await putLocalProject({
    id: input.id,
    title: input.title,
    status: 'processing',
    width: input.width,
    height: input.height,
    fps: input.fps,
    durationMs: input.durationMs,
    sourceBlob: input.file,
    sourceMimeType: input.file.type,
    sourceName: input.fileName,
    thumbnail: input.thumbnail ?? undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  if (hasSupabase) {
    await createRemoteProject({
      id: input.id,
      title: input.title,
      width: input.width,
      height: input.height,
      fps: input.fps,
      durationMs: input.durationMs,
    }).catch(() => undefined);
  }
}

/**
 * Push the source video to cloud storage.
 *
 * Deliberately fire-and-forgettable: the editor works off the local blob, so a
 * failed upload delays cross-device access but does not block the user.
 */
export async function uploadSource(
  projectId: string,
  file: Blob,
  fileName = 'source.mp4',
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!hasApi) return null;

  const ticket = await requestUploadUrl({
    projectId,
    mimeType: file.type || 'video/mp4',
    size: file.size,
    kind: 'source_video',
    fileName,
  });

  const objectKey = await performUpload(ticket, file, fileName, onProgress, signal);

  // Direct uploads to a backend that assigns its own id have to be reported, so
  // the server can file the asset and we can record the key.
  if (!ticket.objectKey) {
    await completeUpload({ projectId, kind: 'source_video', objectKey }).catch(() => undefined);
  }

  await recordAsset({
    projectId,
    kind: 'source_video',
    provider: ticket.provider,
    objectKey,
    mimeType: file.type || 'video/mp4',
    sizeBytes: file.size,
  });

  await updateRemoteProject(projectId, { source_object_key: objectKey, status: 'ready' }).catch(
    () => undefined,
  );
  await patchLocalProject(projectId, { status: 'ready' });
  return objectKey;
}

/* ------------------------------------------------------------------ */
/* Opening                                                             */
/* ------------------------------------------------------------------ */

/**
 * Open a project, resolving local against remote.
 *
 * The rule is simple and always the same: whichever copy has the higher
 * revision wins, and a local copy that wins is flagged so the UI can say
 * "unsynced changes recovered" rather than silently overwriting the server.
 */
export async function openProject(projectId: string): Promise<OpenedProject | null> {
  let project = await getLocalProject(projectId);
  const localRow = await loadLocalState(projectId);
  let state = localRow?.state ?? null;
  let recoveredUnsynced = false;

  if (hasSupabase) {
    try {
      const remote = await getRemoteProject(projectId);
      if (remote) {
        const remoteState = parseRemoteState(remote.editor_state);

        if (!project) {
          // First time on this device: materialise a local shell.
          project = {
            id: remote.id,
            title: remote.title,
            status: (remote.status as LocalProject['status']) ?? 'ready',
            width: remote.width,
            height: remote.height,
            fps: remote.fps,
            durationMs: remote.duration_ms,
            createdAt: Date.parse(remote.created_at),
            updatedAt: Date.parse(remote.updated_at),
          };
          await putLocalProject(project);
        }

        if (remoteState && (!state || remoteState.revision > state.revision)) {
          state = remoteState;
          await saveLocalState(projectId, remoteState, true);
        } else if (state && remoteState && state.revision > remoteState.revision && !localRow?.synced) {
          recoveredUnsynced = true;
          // Push the newer local copy straight back up so the two agree again.
          await saveRemoteState(projectId, state)
            .then(() => markSynced(projectId, state!.revision))
            .catch(() => undefined);
        }
      }
    } catch {
      /* offline - carry on with the local copy */
    }
  }

  if (!project) return null;

  let sourceBlob = project.sourceBlob ?? null;

  // The blob lives only on the device that uploaded it, so on a second device
  // we pull it back down from R2 once and cache it locally.
  if (!sourceBlob && hasApi) {
    const remote = hasSupabase ? await getRemoteProject(projectId).catch(() => null) : null;
    if (remote?.source_object_key) {
      try {
        const { url } = await requestDownloadUrl(remote.source_object_key);
        const response = await fetch(url);
        if (response.ok) {
          sourceBlob = await response.blob();
          await patchLocalProject(projectId, { sourceBlob });
        }
      } catch {
        /* the editor will show a "source unavailable" state */
      }
    }
  }

  return {
    project,
    state: state ? editorStateSchema.parse(state) : null,
    sourceBlob,
    recoveredUnsynced,
  };
}

/* ------------------------------------------------------------------ */
/* Saving                                                              */
/* ------------------------------------------------------------------ */

export async function saveState(projectId: string, state: EditorState): Promise<void> {
  await saveLocalState(projectId, state, !hasSupabase);
  if (!hasSupabase) return;
  await saveRemoteState(projectId, state);
  await markSynced(projectId, state.revision);
}

export async function renameProject(projectId: string, title: string): Promise<void> {
  await patchLocalProject(projectId, { title });
  if (hasSupabase) await updateRemoteProject(projectId, { title }).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Deleting                                                            */
/* ------------------------------------------------------------------ */

/**
 * Delete everywhere. Orphaned source videos in R2 are the fastest way to eat
 * the 10GB free allowance, so object cleanup runs before the row disappears.
 */
export async function deleteProject(projectId: string): Promise<void> {
  if (hasSupabase && hasApi) {
    try {
      const remote = await getRemoteProject(projectId);
      const keys = [remote?.source_object_key, remote?.thumbnail_key].filter(
        (k): k is string => Boolean(k),
      );
      await Promise.all(keys.map((key) => deleteObject(key).catch(() => undefined)));
    } catch {
      /* best effort - the row still goes */
    }
  }

  if (hasSupabase) await deleteRemoteProject(projectId).catch(() => undefined);
  await deleteLocalProject(projectId);
}

/** Retry any local edits that never reached the server. Called on app start. */
export async function flushUnsynced(): Promise<void> {
  if (!hasSupabase) return;
  const { unsyncedProjectIds } = await import('../db/local');
  const ids = await unsyncedProjectIds();

  for (const id of ids) {
    const row = await loadLocalState(id);
    if (!row) continue;
    try {
      await saveRemoteState(id, row.state);
      await markSynced(id, row.state.revision);
    } catch {
      break; // Still offline - stop trying and let the next edit retry.
    }
  }
}
