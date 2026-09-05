import {
  AI_LIMITS,
  artDirectionSchema,
  expandAiDesign,
  getPreset,
  groupIntoScenes,
  buildFromAiScene,
  type EditorState,
} from '@kc/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '../../components/ui';
import { cn } from '../../lib/cn';
import { hasApi } from '../../lib/env';
import { generateDesign, redesignScene } from '../../lib/api';
import { formatTime } from '../../lib/format';
import { openProject, renameProject, saveState } from '../../lib/projectRepo';
import { computeWaveform } from '../../media/audio';
import { extractSceneFrames, releaseFrames } from '../../media/frames';
import { setRemoteSaver, useEditorStore } from '../../stores/editorStore';
import { ExportDialog } from '../export/ExportDialog';
import { CanvasStage } from './CanvasStage';
import { InspectorPanel } from './InspectorPanel';
import { StylePanel } from './StylePanel';
import { Timeline } from './Timeline';
import { TranscriptPanel } from './TranscriptPanel';

/**
 * The editor shell.
 *
 * Owns loading, the save indicator, keyboard shortcuts and the AI actions.
 * Everything visual lives in the four panels around it.
 */

export function EditorPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();

  const state = useEditorStore((s) => s.state);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const load = useEditorStore((s) => s.reset);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled');
  const [recovered, setRecovered] = useState(false);
  const [waveform, setWaveform] = useState<Float32Array | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<'style' | 'transcript'>('style');
  // Which panel the bottom sheet shows on small screens. Null = canvas only.
  const [sheet, setSheet] = useState<'style' | 'words' | 'transcript' | null>(null);

  const sourceRef = useRef<Blob | null>(null);

  /* ---------------------------------------------------------------- */
  /* Load                                                              */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setRemoteSaver(saveState);

    (async () => {
      try {
        const opened = await openProject(projectId);
        if (cancelled) return;

        if (!opened) {
          setError('That project could not be found on this device.');
          setLoading(false);
          return;
        }

        setTitle(opened.project.title);
        setRecovered(opened.recoveredUnsynced);
        sourceRef.current = opened.sourceBlob;

        if (opened.sourceBlob) {
          objectUrl = URL.createObjectURL(opened.sourceBlob);
          setVideoUrl(objectUrl);
        }

        if (opened.state) {
          useEditorStore.getState().load(projectId, opened.state);
        } else {
          setError('This project has no caption data yet.');
        }

        setLoading(false);

        // The waveform is nice-to-have, so it loads after the editor is usable.
        if (opened.sourceBlob) {
          computeWaveform(opened.sourceBlob)
            .then((w) => !cancelled && setWaveform(w))
            .catch(() => undefined);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not open this project.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      useEditorStore.getState().reset();
    };
  }, [projectId, load]);

  /* ---------------------------------------------------------------- */
  /* Keyboard                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never steal a key from a field the user is typing into.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const store = useEditorStore.getState();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? store.redo() : store.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        store.redo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'd' && store.selection.layerId) {
        event.preventDefault();
        store.duplicateLayer(store.selection.layerId);
        return;
      }

      switch (event.key) {
        case ' ':
          event.preventDefault();
          store.setPlaying(!store.playing);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          store.setTime(Math.max(0, store.timeMs - (event.shiftKey ? 1000 : 100)));
          break;
        case 'ArrowRight':
          event.preventDefault();
          store.setTime(store.timeMs + (event.shiftKey ? 1000 : 100));
          break;
        case 'Delete':
        case 'Backspace':
          if (store.selection.layerId) {
            event.preventDefault();
            store.deleteLayer(store.selection.layerId);
          }
          break;
        case 'Escape':
          store.select(store.selection.sceneId, null);
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------------------------------------------------------------- */
  /* AI actions                                                        */
  /* ---------------------------------------------------------------- */

  const runAiAction = useCallback(
    async (instruction: string, scope: 'project' | 'scene') => {
      const store = useEditorStore.getState();
      const current = store.state;
      const source = sourceRef.current;
      if (!current || !source || !hasApi) return;

      const label =
        scope === 'scene'
          ? instruction || 'Redesign this scene'
          : instruction || 'Regenerate whole design';

      setAiBusy(label);
      setAiError(null);

      try {
        const dims = { width: current.project.width, height: current.project.height };
        const preset = getPreset(current.design.direction.preset);
        const groups = groupIntoScenes(current.transcript.words, {
          targetWords: preset.sceneWordTarget,
        });
        const wordsById = new Map(current.transcript.words.map((w) => [w.id, w]));

        if (scope === 'scene') {
          const scene =
            current.design.scenes.find((s) => store.timeMs >= s.startMs && store.timeMs <= s.endMs) ??
            current.design.scenes[0];
          if (!scene) return;

          const [frame] = await extractSceneFrames(source, [
            { sceneId: scene.id, timestampMs: scene.keyframeTimestampMs },
          ]);

          const index = current.design.scenes.findIndex((s) => s.id === scene.id);
          const neighbours = [
            current.design.scenes[index - 1]?.compositionId,
            current.design.scenes[index + 1]?.compositionId,
          ].filter((c): c is string => Boolean(c));

          const response = await redesignScene({
            projectId,
            dimensions: dims,
            direction: {
              preset: current.design.direction.preset,
              note: current.design.direction.note,
            },
            scene: {
              id: scene.id,
              startMs: scene.startMs,
              endMs: scene.endMs,
              words: scene.wordIds.map((id) => ({ id, text: wordsById.get(id)?.text ?? '' })),
              frame: frame?.base64,
            },
            neighbourCompositions: neighbours,
            instruction: instruction || undefined,
          });

          const group = groups.find((g) => g.id === scene.id) ?? {
            id: scene.id,
            startMs: scene.startMs,
            endMs: scene.endMs,
            wordIds: scene.wordIds,
            keyframeTimestampMs: scene.keyframeTimestampMs,
          };

          const rebuilt = buildFromAiScene(
            response.scene,
            group,
            wordsById,
            current.design.direction,
            dims,
            index + 1,
          );
          if (rebuilt) store.replaceScene(rebuilt);
          if (frame) releaseFrames([frame]);
          return;
        }

        /* whole project */
        const sampled =
          groups.length <= AI_LIMITS.maxFramesPerRequest
            ? groups
            : groups.filter((_, i) => i % Math.ceil(groups.length / AI_LIMITS.maxFramesPerRequest) === 0);

        const frames = await extractSceneFrames(
          source,
          sampled.map((g) => ({ sceneId: g.id, timestampMs: g.keyframeTimestampMs })),
        );
        const framesById = new Map(frames.map((f) => [f.sceneId, f]));

        const response = await generateDesign({
          projectId,
          dimensions: dims,
          style: current.design.direction.preset,
          contentType: current.transcript.contentType,
          mood: '',
          scenes: groups.map((g) => ({
            id: g.id,
            startMs: g.startMs,
            endMs: g.endMs,
            words: g.wordIds.map((id) => ({ id, text: wordsById.get(id)?.text ?? '' })),
            frame: framesById.get(g.id)?.base64,
          })),
          instruction: instruction || undefined,
        });

        const direction = artDirectionSchema.parse({
          ...current.design.direction,
          preset: response.direction.preset,
          palette: getPreset(response.direction.preset).palette,
          motionLevel: response.direction.motionLevel ?? current.design.direction.motionLevel,
          rotationLevel: response.direction.rotationLevel ?? current.design.direction.rotationLevel,
          heroContrast: response.direction.heroContrast ?? current.design.direction.heroContrast,
          note: response.direction.note ?? current.design.direction.note,
        });

        const scenes = expandAiDesign(response, direction, {
          dims,
          words: current.transcript.words,
          groups,
        });

        store.setDirection(direction);
        store.replaceScenes(scenes);
        releaseFrames(frames);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'The AI request failed.');
      } finally {
        setAiBusy(null);
      }
    },
    [projectId],
  );

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-3 text-sm text-ink-400">
        <Spinner /> Opening project…
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-ink-300">{error ?? 'Nothing to edit.'}</p>
        <Link className="btn-outline" to="/">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-900 px-4 py-2.5">
        <Link to="/" className="font-display text-lg leading-none text-ink-100 hover:text-accent">
          Kinetic
        </Link>

        <input
          className="min-w-0 max-w-xs flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-ink-200 outline-none hover:border-ink-700 focus:border-ink-600"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void renameProject(projectId, title.trim() || 'Untitled')}
        />

        <SaveIndicator status={saveStatus} />

        {recovered && (
          <span className="chip border-amber-800/60 text-amber-300">Unsynced changes recovered</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11px] text-ink-600 xl:inline">
            {state.project.width}×{state.project.height} · {formatTime(state.project.durationMs)}
          </span>
          <UndoRedo />
          <button className="btn-primary hidden lg:inline-flex" onClick={() => setExportOpen(true)}>
            Export
          </button>
        </div>
      </header>

      {aiError && (
        <div className="shrink-0 border-b border-red-900/50 bg-red-950/30 px-4 py-1.5 text-[11px] text-red-300">
          {aiError}
          <button className="ml-2 underline" onClick={() => setAiError(null)}>
            dismiss
          </button>
        </div>
      )}

      {/* body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Desktop: a fixed left column. Mobile: this lives in a bottom sheet. */}
        <aside className="hidden w-[300px] shrink-0 flex-col border-r border-ink-800 bg-ink-900 lg:flex">
          <div className="flex shrink-0 border-b border-ink-800">
            {(['style', 'transcript'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className={cn(
                  'flex-1 px-3 py-2 text-[11px] font-medium uppercase tracking-wider transition',
                  leftTab === tab
                    ? 'border-b-2 border-accent text-accent-soft'
                    : 'text-ink-500 hover:text-ink-300',
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {leftTab === 'style' ? (
              <StylePanel onAiAction={runAiAction} aiBusy={aiBusy} />
            ) : (
              <TranscriptPanel />
            )}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 bg-ink-950 p-2 sm:p-4 lg:p-6">
            <CanvasStage videoUrl={videoUrl} />
          </div>
          <div className="h-[150px] shrink-0 border-t border-ink-800 sm:h-[190px]">
            <Timeline waveform={waveform} />
          </div>
        </main>

        <aside className="hidden w-[320px] shrink-0 border-l border-ink-800 bg-ink-900 lg:block">
          <InspectorPanel />
        </aside>
      </div>

      {/* Mobile: panels as a bottom sheet, driven by a tab bar. Editing on a
          phone needs the canvas visible while a panel is open, so the sheet
          covers at most 70% of the viewport and the canvas stays above it. */}
      <div className="lg:hidden">
        {sheet && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/40"
              onClick={() => setSheet(null)}
              aria-hidden
            />
            <div className="fixed inset-x-0 bottom-[56px] z-40 flex h-[70vh] flex-col rounded-t-2xl border-t border-ink-700 bg-ink-900 shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-ink-800 px-4 py-2.5">
                <span className="text-sm font-medium capitalize text-ink-200">{sheet}</span>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setSheet(null)}>
                  Done
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {sheet === 'style' && <StylePanel onAiAction={runAiAction} aiBusy={aiBusy} />}
                {sheet === 'words' && <InspectorPanel />}
                {sheet === 'transcript' && <TranscriptPanel />}
              </div>
            </div>
          </>
        )}

        <nav className="fixed inset-x-0 bottom-0 z-50 flex h-[56px] items-stretch border-t border-ink-800 bg-ink-900 pb-[env(safe-area-inset-bottom)]">
          {([
            ['style', 'Style'],
            ['words', 'Text'],
            ['transcript', 'Words'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSheet(sheet === key ? null : key)}
              className={cn(
                'flex-1 text-xs font-medium transition',
                sheet === key ? 'bg-ink-800 text-accent-soft' : 'text-ink-400',
              )}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setExportOpen(true)}
            className="flex-1 bg-accent text-xs font-semibold text-ink-950"
          >
            Export
          </button>
        </nav>
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        projectId={projectId}
        source={sourceRef.current}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SaveIndicator({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    idle: { label: '', className: '' },
    saving: { label: 'Saving…', className: 'text-ink-500' },
    saved: { label: 'Saved', className: 'text-ink-500' },
    offline: { label: 'Offline — saved locally', className: 'text-amber-400' },
    error: { label: 'Sync failed — saved locally', className: 'text-amber-400' },
  };
  const entry = map[status] ?? map.idle;
  if (!entry.label) return null;
  return <span className={cn('text-[11px]', entry.className)}>{entry.label}</span>;
}

function UndoRedo() {
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  return (
    <div className="flex items-center gap-1">
      <button className="btn-ghost px-2" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">
        ↺
      </button>
      <button
        className="btn-ghost px-2"
        disabled={!canRedo}
        onClick={redo}
        title="Redo (Ctrl+Shift+Z)"
      >
        ↻
      </button>
    </div>
  );
}

export type { EditorState };
