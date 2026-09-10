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
import { ResizeHandle } from '../../components/ResizeHandle';
import { usePersisted } from '../../lib/usePersisted';
import { TranscriptPanel } from './TranscriptPanel';

/**
 * The editor shell.
 *
 * Owns loading, the save indicator, keyboard shortcuts and the AI actions.
 * Everything visual lives in the four panels around it.
 */

/**
 * Geometry of the floating mobile tab bar.
 *
 * Shared by the bar, the sheet that stacks above it and the page padding that
 * keeps it from covering the timeline. Three places have to agree, so the
 * numbers live here rather than being repeated as literals.
 */
const MOBILE_NAV_H = 56;
const MOBILE_NAV_GAP = 10;
const MOBILE_NAV_INSET = `env(safe-area-inset-bottom, 0px) + ${MOBILE_NAV_H + MOBILE_NAV_GAP * 2}px`;

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

  /*
   * Layout preferences, kept across reloads.
   *
   * The timeline was a fixed 176-190px for every device, which is cramped on a
   * phone and wasteful on a desktop - and there was no way to change it. All
   * three of these are decisions the user makes once.
   */
  const [timelineHeight, setTimelineHeight] = usePersisted('kc.layout.timelineHeight', 220);

  /*
   * How tall the timeline is allowed to get.
   *
   * A flat 560px ceiling is taller than a phone in landscape, which would let
   * the canvas be squeezed to nothing and leave no way back. Tracking the
   * viewport keeps the limit proportional on every device, and the stored
   * height is clamped on the way out so a value saved on a large screen cannot
   * strand a small one.
   */
  const [viewportH, setViewportH] = useState(() =>
    typeof window === 'undefined' ? 900 : window.innerHeight,
  );
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const timelineMax = Math.max(180, Math.round(viewportH * 0.55));
  const timelineH = Math.min(timelineHeight, timelineMax);
  const [leftOpen, setLeftOpen] = usePersisted('kc.layout.leftPanel', true);
  const [rightOpen, setRightOpen] = usePersisted('kc.layout.rightPanel', true);
  const [leftWidth, setLeftWidth] = usePersisted('kc.layout.leftWidth', 300);
  const [rightWidth, setRightWidth] = usePersisted('kc.layout.rightWidth', 320);

  // True while either panel is showing, so one button can collapse both and
  // restore both without getting stuck on a half-open state.
  const panelsOpen = leftOpen || rightOpen;
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
          if (store.selection.layerIds.length > 0) {
            event.preventDefault();
            // Delete acts on everything selected. Copied first because each
            // delete rewrites the selection underneath us.
            for (const id of [...store.selection.layerIds]) {
              useEditorStore.getState().deleteLayer(id);
            }
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
    /*
     * The mobile tab bar floats, so the page has to reserve its height plus the
     * gap beneath it plus the home indicator - otherwise it sits on top of the
     * timeline, which is how the timeline came to look absent on mobile.
     * MOBILE_NAV_INSET keeps that arithmetic in one place; the sheet above the
     * bar reads the same value, so the two cannot drift apart.
     */
    <div
      /*
       * A class, not an inline style: an inline paddingBottom would beat
       * `lg:pb-0` and leave 76px of dead space along the bottom of every
       * desktop window. The literal has to stay in step with
       * MOBILE_NAV_INSET above - Tailwind only emits arbitrary values it can
       * see spelled out in the source, so it cannot be interpolated.
       */
      className="flex h-[100dvh] flex-col overflow-hidden pb-[calc(env(safe-area-inset-bottom,0px)+76px)] lg:pb-0"
    >
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

          {/* Panel toggles. Desktop only - on mobile the panels are sheets, so
              there is nothing to collapse. */}
          <div className="hidden items-center gap-1 lg:flex">
            {/*
              * Both panels at once, which is the common case: clearing the
              * chrome to look at the video, then putting it back. Doing that
              * through the two individual toggles takes two clicks each way
              * and leaves a half-collapsed state in between.
              *
              * "Any open" collapses, "none open" restores both, so the button
              * always does the obvious thing from whatever state it is in -
              * including the half-open states the individual toggles create.
              */}
            <button
              onClick={() => {
                const next = !panelsOpen;
                setLeftOpen(next);
                setRightOpen(next);
              }}
              title={panelsOpen ? 'Hide both panels' : 'Show both panels'}
              aria-label={panelsOpen ? 'Hide both panels' : 'Show both panels'}
              aria-pressed={panelsOpen}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition',
                panelsOpen
                  ? 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600 hover:text-ink-100'
                  : 'border-accent/40 bg-accent/10 text-accent-soft hover:border-accent/60',
              )}
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden fill="none" stroke="currentColor">
                {/* Arrows pointing outwards to expand, inwards to collapse. */}
                {panelsOpen ? (
                  <>
                    <path d="M6.5 4.5 L3.5 8 L6.5 11.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9.5 4.5 L12.5 8 L9.5 11.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                ) : (
                  <>
                    <path d="M3.5 4.5 L6.5 8 L3.5 11.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12.5 4.5 L9.5 8 L12.5 11.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )}
              </svg>
              {panelsOpen ? 'Focus' : 'Panels'}
            </button>

            <span className="mx-0.5 h-5 w-px bg-ink-800" aria-hidden />

            <PanelToggle
              side="left"
              open={leftOpen}
              onToggle={() => setLeftOpen(!leftOpen)}
            />
            <PanelToggle
              side="right"
              open={rightOpen}
              onToggle={() => setRightOpen(!rightOpen)}
            />
          </div>

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
        {/* Desktop: a resizable, collapsible left column. Mobile: a sheet. */}
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-ink-800 bg-ink-900',
            leftOpen && 'lg:flex',
          )}
          style={{ width: leftWidth }}
        >
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
              <StylePanel />
            ) : (
              <TranscriptPanel />
            )}
          </div>
        </aside>

        {leftOpen && (
          <ResizeHandle
            size={leftWidth}
            onResize={setLeftWidth}
            min={220}
            max={520}
            grows="right"
            label="Panel width"
            className="hidden lg:block"
          />
        )}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 bg-ink-950 p-2 sm:p-4 lg:p-6">
            <CanvasStage videoUrl={videoUrl} />
          </div>
          {/* Drag the divider to trade canvas for timeline. The handle is
              deliberately present on every size, not just desktop: a fixed
              height is worst exactly where the screen is smallest. */}
          <ResizeHandle
            size={timelineH}
            onResize={setTimelineHeight}
            min={140}
            max={timelineMax}
            grows="up"
            label="Timeline height"
          />
          <div className="shrink-0 overflow-hidden" style={{ height: timelineH }}>
            <Timeline waveform={waveform} />
          </div>
        </main>

        {rightOpen && (
          <ResizeHandle
            size={rightWidth}
            onResize={setRightWidth}
            min={260}
            max={560}
            grows="left"
            label="Inspector width"
            className="hidden lg:block"
          />
        )}

        <aside
          className={cn(
            'hidden shrink-0 border-l border-ink-800 bg-ink-900',
            rightOpen && 'lg:block',
          )}
          style={{ width: rightWidth }}
        >
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
            <div
              className="fixed inset-x-2 z-40 flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900/95 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
              style={{
                bottom: `calc(${MOBILE_NAV_INSET} + 8px)`,
                maxHeight: `calc(100dvh - ${MOBILE_NAV_INSET} - 96px)`,
                height: '70vh',
              }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-ink-800 px-4 py-2.5">
                <span className="text-sm font-medium capitalize text-ink-200">{sheet}</span>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setSheet(null)}>
                  Done
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {sheet === 'style' && <StylePanel />}
                {sheet === 'words' && <InspectorPanel />}
                {sheet === 'transcript' && <TranscriptPanel />}
              </div>
            </div>
          </>
        )}

        {/*
          * A floating glass bar rather than a full-width strip welded to the
          * bottom edge.
          *
          * It sits inset on all sides, so the rounded corners are actually
          * visible and the page's own background shows through beneath it -
          * which is what makes the blur read as glass rather than as a grey
          * panel. The safe-area inset is added to the offset, not as padding
          * inside the bar, so the pill keeps its shape on a notched phone
          * instead of growing a tall dead strip along the bottom.
          *
          * Its height is fixed at MOBILE_NAV_H and the page reserves exactly
          * that plus the gaps, so nothing it floats over can be covered.
          */}
        <nav
          className={cn(
            'fixed inset-x-3 z-50 flex items-stretch gap-1 rounded-[26px] p-1',
            // Layered translucency: a tinted ground, a hairline highlight on
            // the top edge, and a soft drop shadow to lift it off the canvas.
            'border border-white/10 bg-ink-900/70 shadow-[0_10px_40px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/5',
            // Blur only where it is supported; without the fallback the bar
            // would be semi-transparent over live video and unreadable.
            'supports-[backdrop-filter]:bg-ink-900/55 supports-[backdrop-filter]:backdrop-blur-2xl supports-[backdrop-filter]:backdrop-saturate-150',
          )}
          style={{
            height: MOBILE_NAV_H,
            bottom: `calc(env(safe-area-inset-bottom, 0px) + ${MOBILE_NAV_GAP}px)`,
          }}
        >
          {([
            ['style', 'Style'],
            ['words', 'Text'],
            ['transcript', 'Words'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSheet(sheet === key ? null : key)}
              aria-pressed={sheet === key}
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center rounded-[20px] px-1 text-[11px] font-medium transition',
                sheet === key
                  ? 'bg-white/10 text-accent-soft shadow-inner ring-1 ring-white/10'
                  : 'text-ink-300 active:bg-white/5',
              )}
            >
              <span className="truncate">{label}</span>
            </button>
          ))}
          <button
            onClick={() => setExportOpen(true)}
            className="flex min-w-0 flex-1 items-center justify-center rounded-[20px] bg-accent px-1 text-[11px] font-semibold text-ink-950 shadow-lg transition active:brightness-95"
          >
            <span className="truncate">Export</span>
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

/**
 * Collapse or reveal a side panel.
 *
 * An icon rather than a label so the header does not grow, and the glyph shows
 * the direction the panel will travel - a chevron pointing at the edge means
 * "tuck it away", pointing inwards means "bring it back".
 */
function PanelToggle({
  side,
  open,
  onToggle,
}: {
  side: 'left' | 'right';
  open: boolean;
  onToggle: () => void;
}) {
  const label = `${open ? 'Hide' : 'Show'} ${side} panel`;
  // Left panel open -> chevron points left (out). Right panel open -> right.
  const pointsLeft = side === 'left' ? open : !open;

  return (
    <button
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={open}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md border transition',
        open
          ? 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600 hover:text-ink-100'
          : 'border-accent/40 bg-accent/10 text-accent-soft hover:border-accent/60',
      )}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor">
        {/* The panel edge, then the chevron beside it. */}
        <rect
          x={side === 'left' ? 1.5 : 9.5}
          y="2.5"
          width="5"
          height="11"
          rx="1.5"
          strokeWidth="1.2"
          className={open ? 'opacity-100' : 'opacity-40'}
        />
        <path
          d={pointsLeft ? 'M12.5 5.5 L9.5 8 L12.5 10.5' : 'M3.5 5.5 L6.5 8 L3.5 10.5'}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

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
