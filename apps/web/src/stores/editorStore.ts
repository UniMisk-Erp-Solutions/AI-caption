import {
  AUTOSAVE,
  autoDesign,
  buildScene,
  captionLayerSchema,
  applyCase,
  editorStateSchema,
  getPreset,
  groupIntoScenes,
  resolveCollisions,
  resolveVoice,
  type ArtDirection,
  type CaptionLayer,
  type CaptionScene,
  type EditorState,
  type TextRun,
  type TextTransform,
  type TranscriptWord,
} from '@kc/shared';
import { create } from 'zustand';
import { saveLocalState } from '../db/local';
import { newId } from '../lib/id';

/**
 * The editor store.
 *
 * Three responsibilities, deliberately kept in one place so they cannot drift:
 *
 *  1. Hold the authoritative `EditorState`.
 *  2. Record undo history around every mutation.
 *  3. Drive the autosave ladder (memory -> IndexedDB -> Supabase).
 *
 * Every mutation goes through `commit()`, which is the only function that
 * writes `state`. That single choke point is what makes undo reliable: there is
 * no path that changes the document without pushing a history entry.
 */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

interface Selection {
  sceneId: string | null;
  layerId: string | null;
  runId: string | null;
}

interface EditorStore {
  projectId: string | null;
  state: EditorState | null;

  past: EditorState[];
  future: EditorState[];

  selection: Selection;
  timeMs: number;
  playing: boolean;
  saveStatus: SaveStatus;
  lastSyncedRevision: number;

  /* lifecycle */
  load(projectId: string, state: EditorState): void;
  reset(): void;

  /* playback */
  setTime(ms: number): void;
  setPlaying(playing: boolean): void;

  /* selection */
  select(sceneId: string | null, layerId?: string | null, runId?: string | null): void;

  /* history */
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;

  /* mutations */
  updateLayer(layerId: string, patch: Partial<CaptionLayer>, options?: { transient?: boolean }): void;
  updateRun(layerId: string, runId: string, patch: Partial<TextRun>): void;
  setRunCase(layerId: string, runId: string, mode: TextTransform): void;
  setRunText(layerId: string, runId: string, text: string): void;
  mergeRuns(layerId: string): void;
  setRunEmphasis(layerId: string, runId: string, emphasis: TextRun['emphasis']): void;
  setLayerText(layerId: string, text: string): void;
  splitRunAtWord(layerId: string, runId: string, wordIndex: number): void;
  duplicateLayer(layerId: string): void;
  deleteLayer(layerId: string): void;
  addLayer(sceneId: string): void;
  replaceScene(scene: CaptionScene): void;
  replaceScenes(scenes: CaptionScene[]): void;
  setDirection(patch: Partial<ArtDirection>): void;
  regenerateWithPreset(presetId: string): void;
  updateWord(wordId: string, patch: Partial<TranscriptWord>): void;

  /* persistence */
  setSaveStatus(status: SaveStatus): void;
  markRemoteSynced(revision: number): void;
}

/* ------------------------------------------------------------------ */
/* Autosave plumbing                                                   */
/* ------------------------------------------------------------------ */

let localTimer: ReturnType<typeof setTimeout> | null = null;
let remoteTimer: ReturnType<typeof setTimeout> | null = null;

/** Set by the editor page so the store does not have to know about the API. */
let remoteSave: ((projectId: string, state: EditorState) => Promise<void>) | null = null;

export function setRemoteSaver(fn: typeof remoteSave): void {
  remoteSave = fn;
}

function scheduleSave(projectId: string, state: EditorState): void {
  if (localTimer) clearTimeout(localTimer);
  localTimer = setTimeout(() => {
    void saveLocalState(projectId, state, false);
  }, AUTOSAVE.localDebounceMs);

  if (!remoteSave) return;

  if (remoteTimer) clearTimeout(remoteTimer);
  useEditorStore.getState().setSaveStatus('saving');
  remoteTimer = setTimeout(() => {
    remoteSave?.(projectId, state)
      .then(() => useEditorStore.getState().markRemoteSynced(state.revision))
      .catch(() => {
        // The IndexedDB copy is already safe, so a failed sync is a status
        // change, not data loss. It retries on the next edit or on reopen.
        useEditorStore.getState().setSaveStatus(navigator.onLine ? 'error' : 'offline');
      });
  }, AUTOSAVE.remoteDebounceMs);
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export const useEditorStore = create<EditorStore>((set, get) => {
  /**
   * The single write path. `transient` skips the history push, for the stream
   * of intermediate states a drag produces - otherwise one drag would fill the
   * undo stack with sixty entries.
   */
  function commit(next: EditorState, options?: { transient?: boolean }): void {
    const { state, projectId, past } = get();
    if (!state || !projectId) return;

    const stamped: EditorState = { ...next, revision: state.revision + 1, updatedAt: Date.now() };

    set({
      state: stamped,
      past: options?.transient ? past : [...past, state].slice(-AUTOSAVE.maxHistoryStates),
      future: options?.transient ? get().future : [],
    });

    scheduleSave(projectId, stamped);
  }

  function mapScenes(state: EditorState, fn: (scene: CaptionScene) => CaptionScene): EditorState {
    return { ...state, design: { ...state.design, scenes: state.design.scenes.map(fn) } };
  }

  function withLayer(
    state: EditorState,
    layerId: string,
    fn: (layer: CaptionLayer) => CaptionLayer,
  ): EditorState {
    return mapScenes(state, (scene) =>
      scene.layers.some((l) => l.id === layerId)
        ? { ...scene, layers: scene.layers.map((l) => (l.id === layerId ? fn(l) : l)) }
        : scene,
    );
  }

  function findLayer(state: EditorState, layerId: string): { scene: CaptionScene; layer: CaptionLayer } | null {
    for (const scene of state.design.scenes) {
      const layer = scene.layers.find((l) => l.id === layerId);
      if (layer) return { scene, layer };
    }
    return null;
  }

  return {
    projectId: null,
    state: null,
    past: [],
    future: [],
    selection: { sceneId: null, layerId: null, runId: null },
    timeMs: 0,
    playing: false,
    saveStatus: 'idle',
    lastSyncedRevision: -1,

    load(projectId, state) {
      set({
        projectId,
        state,
        past: [],
        future: [],
        selection: { sceneId: state.design.scenes[0]?.id ?? null, layerId: null, runId: null },
        timeMs: 0,
        playing: false,
        saveStatus: 'saved',
        lastSyncedRevision: state.revision,
      });
    },

    reset() {
      if (localTimer) clearTimeout(localTimer);
      if (remoteTimer) clearTimeout(remoteTimer);
      set({
        projectId: null,
        state: null,
        past: [],
        future: [],
        selection: { sceneId: null, layerId: null, runId: null },
        timeMs: 0,
        playing: false,
        saveStatus: 'idle',
      });
    },

    setTime(ms) {
      set({ timeMs: Math.max(0, ms) });
    },

    setPlaying(playing) {
      set({ playing });
    },

    select(sceneId, layerId = null, runId = null) {
      set({ selection: { sceneId, layerId, runId } });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    undo() {
      const { past, state, future, projectId } = get();
      if (past.length === 0 || !state || !projectId) return;
      const previous = past[past.length - 1];
      set({ state: previous, past: past.slice(0, -1), future: [state, ...future].slice(0, AUTOSAVE.maxHistoryStates) });
      scheduleSave(projectId, previous);
    },

    redo() {
      const { future, state, past, projectId } = get();
      if (future.length === 0 || !state || !projectId) return;
      const next = future[0];
      set({ state: next, future: future.slice(1), past: [...past, state].slice(-AUTOSAVE.maxHistoryStates) });
      scheduleSave(projectId, next);
    },

    updateLayer(layerId, patch, options) {
      const { state } = get();
      if (!state) return;
      commit(
        withLayer(state, layerId, (layer) =>
          captionLayerSchema.parse({ ...layer, ...patch, locked: true }),
        ),
        options,
      );
    },

    updateRun(layerId, runId, patch) {
      const { state } = get();
      if (!state) return;
      commit(
        withLayer(state, layerId, (layer) => ({
          ...layer,
          locked: true,
          runs: layer.runs.map((r) => (r.id === runId ? { ...r, ...patch } : r)),
        })),
      );
    },

    /**
     * Change a run's case without losing information.
     *
     * `rawText` holds the words as spoken, so going uppercase and back to title
     * case round-trips exactly. Transforming the already-transformed text would
     * not - once it is UPPERCASE there is no way to know it was "New York".
     */
    setRunCase(layerId, runId, mode) {
      const { state } = get();
      if (!state) return;

      const wordsById = new Map(state.transcript.words.map((w) => [w.id, w]));

      commit(
        withLayer(state, layerId, (layer) => ({
          ...layer,
          locked: true,
          runs: layer.runs.map((run) => {
            if (run.id !== runId) return run;
            const raw =
              run.rawText ||
              run.wordIds.map((id) => wordsById.get(id)?.text ?? '').join(' ').trim() ||
              run.text;
            return { ...run, rawText: raw, textTransform: mode, text: applyCase(raw, mode) };
          }),
        })),
      );
    },

    /** Retype one run, leaving every other run's styling untouched. */
    setRunText(layerId, runId, text) {
      const { state } = get();
      if (!state) return;
      const trimmed = text.trim();
      if (trimmed.length === 0) return;

      commit(
        withLayer(state, layerId, (layer) => ({
          ...layer,
          locked: true,
          runs: layer.runs.map((run) =>
            run.id === runId
              ? { ...run, rawText: trimmed, text: applyCase(trimmed, run.textTransform) }
              : run,
          ),
        })),
      );
    },

    /**
     * Collapse adjacent runs that share a style back into one.
     *
     * Splitting a run to restyle one word leaves fragments behind; without this
     * a line slowly turns into a dozen single-word runs that are tedious to
     * edit and slower to lay out.
     */
    mergeRuns(layerId) {
      const { state } = get();
      if (!state) return;

      commit(
        withLayer(state, layerId, (layer) => {
          const merged: TextRun[] = [];
          for (const run of layer.runs) {
            const prev = merged[merged.length - 1];
            const same =
              prev &&
              prev.fontId === run.fontId &&
              prev.fontWeight === run.fontWeight &&
              prev.italic === run.italic &&
              prev.color === run.color &&
              prev.emphasis === run.emphasis &&
              Math.abs(prev.sizeScale - run.sizeScale) < 0.001 &&
              Math.abs(prev.letterSpacing - run.letterSpacing) < 0.0001 &&
              Math.abs(prev.opacity - run.opacity) < 0.001;

            if (same) {
              merged[merged.length - 1] = {
                ...prev,
                text: `${prev.text} ${run.text}`.trim(),
                rawText: `${prev.rawText || prev.text} ${run.rawText || run.text}`.trim(),
                wordIds: [...prev.wordIds, ...run.wordIds],
                tuckAfter: run.tuckAfter,
              };
            } else {
              merged.push(run);
            }
          }
          return { ...layer, locked: true, runs: merged };
        }),
      );
    },

    /**
     * Promote or demote a run between the preset's voices.
     *
     * This is the control that matters most in the properties panel: it is how
     * a user says "no, *this* is the word the frame should be about", and it
     * has to reapply the whole voice - face, size, case, colour, baseline -
     * not just swap the font, or the pairing stops looking intentional.
     */
    setRunEmphasis(layerId, runId, emphasis) {
      const { state } = get();
      if (!state) return;
      const preset = getPreset(state.design.direction.preset);
      const voice = resolveVoice(preset, emphasis, state.design.direction);

      commit(
        withLayer(state, layerId, (layer) => ({
          ...layer,
          locked: true,
          runs: layer.runs.map((r) =>
            r.id === runId
              ? {
                  ...r,
                  emphasis,
                  fontId: voice.fontId,
                  fontWeight: voice.weight,
                  italic: voice.italic,
                  sizeScale: voice.sizeScale * (emphasis === 'hero' ? state.design.direction.heroContrast : 1),
                  letterSpacing: voice.tracking,
                  baselineShift: voice.baselineShift,
                  color: state.design.direction.palette[voice.colorIndex] ?? r.color,
                }
              : r,
          ),
        })),
      );
    },

    /**
     * Replace a layer's whole text. Styling is preserved by keeping the run
     * structure and redistributing the new words across it proportionally, so
     * fixing a typo does not blow away the pairing.
     */
    setLayerText(layerId, text) {
      const { state } = get();
      if (!state) return;
      const found = findLayer(state, layerId);
      if (!found) return;

      const words = text.split(/\s+/).filter(Boolean);
      if (words.length === 0) return;

      const runs = found.layer.runs;
      const total = runs.reduce((n, r) => n + r.text.split(/\s+/).filter(Boolean).length, 0) || 1;

      let cursor = 0;
      const nextRuns: TextRun[] = runs.map((run, i) => {
        const share = run.text.split(/\s+/).filter(Boolean).length / total;
        const take = i === runs.length - 1 ? words.length - cursor : Math.max(1, Math.round(share * words.length));
        const slice = words.slice(cursor, cursor + take);
        cursor += take;
        return { ...run, text: slice.join(' ') };
      });

      commit(
        withLayer(state, layerId, (layer) => ({
          ...layer,
          locked: true,
          runs: nextRuns.filter((r) => r.text.length > 0),
        })),
      );
    },

    /** Break a run so a single word inside it can be styled on its own. */
    splitRunAtWord(layerId, runId, wordIndex) {
      const { state } = get();
      if (!state) return;

      commit(
        withLayer(state, layerId, (layer) => {
          const index = layer.runs.findIndex((r) => r.id === runId);
          if (index < 0) return layer;
          const run = layer.runs[index];
          const words = run.text.split(/\s+/).filter(Boolean);
          if (words.length < 2 || wordIndex < 0 || wordIndex >= words.length) return layer;

          const pieces: TextRun[] = [];
          const before = words.slice(0, wordIndex).join(' ');
          const target = words[wordIndex];
          const after = words.slice(wordIndex + 1).join(' ');

          if (before) pieces.push({ ...run, id: newId('run'), text: before, tuckAfter: 0 });
          pieces.push({ ...run, id: newId('run'), text: target });
          if (after) pieces.push({ ...run, id: newId('run'), text: after, tuckBefore: 0 });

          return {
            ...layer,
            locked: true,
            runs: [...layer.runs.slice(0, index), ...pieces, ...layer.runs.slice(index + 1)],
          };
        }),
      );
    },

    duplicateLayer(layerId) {
      const { state } = get();
      if (!state) return;
      commit(
        mapScenes(state, (scene) => {
          const layer = scene.layers.find((l) => l.id === layerId);
          if (!layer) return scene;
          const id = newId('layer');
          return {
            ...scene,
            layers: [
              ...scene.layers,
              {
                ...layer,
                id,
                x: Math.min(0.95, layer.x + 0.03),
                y: Math.min(0.95, layer.y + 0.04),
                zIndex: layer.zIndex + 1,
                locked: true,
                runs: layer.runs.map((r) => ({ ...r, id: newId('run') })),
              },
            ],
          };
        }),
      );
    },

    deleteLayer(layerId) {
      const { state, selection } = get();
      if (!state) return;
      commit(mapScenes(state, (scene) => ({ ...scene, layers: scene.layers.filter((l) => l.id !== layerId) })));
      if (selection.layerId === layerId) {
        set({ selection: { ...selection, layerId: null, runId: null } });
      }
    },

    addLayer(sceneId) {
      const { state } = get();
      if (!state) return;
      const scene = state.design.scenes.find((s) => s.id === sceneId);
      if (!scene) return;

      const preset = getPreset(state.design.direction.preset);
      const voice = resolveVoice(preset, 'base', state.design.direction);
      const layerId = newId('layer');

      const layer = captionLayerSchema.parse({
        id: layerId,
        wordIds: [],
        role: 'tail',
        startMs: scene.startMs,
        endMs: scene.endMs,
        x: 0.5,
        y: 0.5,
        maxWidth: 0.8,
        fontSize: preset.baseSize,
        lineHeight: preset.leading,
        textAlign: 'center',
        shadow: preset.shadow,
        zIndex: 5,
        locked: true,
        runs: [
          {
            id: newId('run'),
            text: 'New text',
            wordIds: [],
            emphasis: 'base',
            fontId: voice.fontId,
            fontWeight: voice.weight,
            italic: voice.italic,
            sizeScale: 1,
            letterSpacing: voice.tracking,
            baselineShift: 0,
            color: state.design.direction.palette[0],
          },
        ],
      });

      commit(mapScenes(state, (s) => (s.id === sceneId ? { ...s, layers: [...s.layers, layer] } : s)));
      set({ selection: { sceneId, layerId, runId: null } });
    },

    /**
     * Replace one scene, keeping layers the user has already edited.
     *
     * This is what makes "redesign this scene" safe: an AI regeneration must
     * never silently discard a manual change somewhere on screen.
     */
    replaceScene(scene) {
      const { state } = get();
      if (!state) return;
      commit(
        mapScenes(state, (existing) => {
          if (existing.id !== scene.id) return existing;
          const kept = existing.layers.filter((l) => l.locked);
          return { ...scene, layers: [...scene.layers, ...kept] };
        }),
      );
    },

    replaceScenes(scenes) {
      const { state } = get();
      if (!state) return;
      const lockedByScene = new Map(
        state.design.scenes.map((s) => [s.id, s.layers.filter((l) => l.locked)]),
      );
      commit({
        ...state,
        design: {
          ...state.design,
          scenes: scenes.map((s) => {
            const kept = lockedByScene.get(s.id) ?? [];
            return kept.length > 0 ? { ...s, layers: [...s.layers, ...kept] } : s;
          }),
        },
      });
    },

    setDirection(patch) {
      const { state } = get();
      if (!state) return;
      commit({
        ...state,
        design: { ...state.design, direction: { ...state.design.direction, ...patch } },
      });
    },

    /**
     * Re-run the deterministic designer under a new preset.
     *
     * Locked (user-edited) layers survive, everything else is redrawn in the
     * new art direction. This runs entirely locally - swapping style should be
     * instant and free, not another round trip to the model.
     */
    regenerateWithPreset(presetId) {
      const { state } = get();
      if (!state) return;

      const direction: ArtDirection = { ...state.design.direction, preset: presetId as ArtDirection['preset'] };
      const preset = getPreset(presetId);
      const dims = { width: state.project.width, height: state.project.height };

      // Reuse the existing scene boundaries so timing does not shift under the
      // user just because they tried a different look.
      const groups = state.design.scenes.map((s) => ({
        id: s.id,
        startMs: s.startMs,
        endMs: s.endMs,
        wordIds: s.wordIds,
        keyframeTimestampMs: s.keyframeTimestampMs,
      }));
      const fresh = autoDesign(
        state.transcript.words,
        direction,
        dims,
        groups.length > 0
          ? groups
          : groupIntoScenes(state.transcript.words, { targetWords: preset.sceneWordTarget }),
      );

      const lockedByScene = new Map(state.design.scenes.map((s) => [s.id, s.layers.filter((l) => l.locked)]));
      const previous = new Map(state.design.scenes.map((s) => [s.id, s]));

      commit({
        ...state,
        design: {
          direction,
          scenes: fresh.map((s) => {
            const kept = lockedByScene.get(s.id) ?? [];
            const merged = { ...s, layers: [...s.layers, ...kept] };
            // Carry over whatever the AI knew about this frame.
            const old = previous.get(s.id);
            return old
              ? resolveCollisions(
                  { ...merged, avoidRegions: old.avoidRegions, backdropLuma: old.backdropLuma },
                  dims,
                )
              : merged;
          }),
        },
      });
    },

    /**
     * Edit one transcript word and push the change into every caption run that
     * references it, so the transcript view and the canvas cannot disagree.
     */
    updateWord(wordId, patch) {
      const { state } = get();
      if (!state) return;

      const words = state.transcript.words.map((w) => (w.id === wordId ? { ...w, ...patch } : w));
      const updated = words.find((w) => w.id === wordId);
      if (!updated) return;

      const scenes = state.design.scenes.map((scene) => {
        if (!scene.wordIds.includes(wordId)) return scene;
        return {
          ...scene,
          layers: scene.layers.map((layer) => {
            if (!layer.wordIds.includes(wordId)) return layer;
            return {
              ...layer,
              runs: layer.runs.map((run) => {
                const index = run.wordIds.indexOf(wordId);
                if (index < 0) return run;
                const parts = run.text.split(/\s+/).filter(Boolean);
                if (index >= parts.length) return run;
                parts[index] = updated.text;
                return { ...run, text: parts.join(' ') };
              }),
            };
          }),
        };
      });

      commit({
        ...state,
        transcript: { ...state.transcript, words },
        design: { ...state.design, scenes },
      });
    },

    setSaveStatus(status) {
      set({ saveStatus: status });
    },

    markRemoteSynced(revision) {
      set({ saveStatus: 'saved', lastSyncedRevision: revision });
    },
  };
});

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function useActiveScene(): CaptionScene | null {
  return useEditorStore((s) => {
    if (!s.state) return null;
    const t = s.timeMs;
    return (
      s.state.design.scenes.find((scene) => t >= scene.startMs && t <= scene.endMs) ??
      s.state.design.scenes.find((scene) => scene.id === s.selection.sceneId) ??
      null
    );
  });
}

export function useSelectedLayer(): CaptionLayer | null {
  return useEditorStore((s) => {
    if (!s.state || !s.selection.layerId) return null;
    for (const scene of s.state.design.scenes) {
      const layer = scene.layers.find((l) => l.id === s.selection.layerId);
      if (layer) return layer;
    }
    return null;
  });
}

/** Build a fresh design for a transcript - used after transcription completes. */
export function designFromTranscript(
  words: TranscriptWord[],
  direction: ArtDirection,
  dims: { width: number; height: number },
): CaptionScene[] {
  const preset = getPreset(direction.preset);
  return autoDesign(words, direction, dims, groupIntoScenes(words, { targetWords: preset.sceneWordTarget }));
}

export { buildScene, editorStateSchema };
