import { layerText, type CaptionLayer, type CaptionScene } from '@kc/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { formatTime } from '../../lib/format';
import { useEditorStore } from '../../stores/editorStore';

/**
 * The timeline.
 *
 * Scenes on top, layers underneath, playhead across both. Its main job beyond
 * scrubbing is making the *structure* legible: which words share a screen, how
 * long each composition holds, and where a caption starts relative to the word
 * being spoken.
 */

interface Props {
  waveform: Float32Array | null;
}

export function Timeline({ waveform }: Props) {
  const state = useEditorStore((s) => s.state);
  const timeMs = useEditorStore((s) => s.timeMs);
  const playing = useEditorStore((s) => s.playing);
  const selection = useEditorStore((s) => s.selection);
  const setTime = useEditorStore((s) => s.setTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const select = useEditorStore((s) => s.select);

  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const duration = state?.project.durationMs ?? 1;
  const scenes = state?.design.scenes ?? [];

  const pct = useCallback((ms: number) => `${(ms / Math.max(1, duration)) * 100}%`, [duration]);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      setTime(Math.round(fraction * duration));
    },
    [duration, setTime],
  );

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: PointerEvent) => seekFromEvent(e.clientX);
    const onUp = () => setScrubbing(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [scrubbing, seekFromEvent]);

  const waveformPath = useMemo(() => buildWaveformPath(waveform), [waveform]);

  // The scene under the playhead is the one whose layers are on screen, so it is
  // the only one whose layers can meaningfully be edited.
  const activeScene = scenes.find((s) => timeMs >= s.startMs && timeMs <= s.endMs) ?? null;

  if (!state) return null;

  return (
    <div className="flex h-full flex-col bg-ink-900">
      {/* transport */}
      <div className="flex items-center gap-3 border-b border-ink-800 px-4 py-2">
        <button
          className="btn-outline h-8 w-8 !px-0"
          onClick={() => setPlaying(!playing)}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="flex items-baseline gap-1 font-mono text-xs tabular-nums">
          <span className="text-ink-100">{formatTime(timeMs, true)}</span>
          <span className="text-ink-600">/ {formatTime(duration)}</span>
        </div>

        <button
          className="btn-ghost ml-3 text-[11px]"
          disabled={!activeScene}
          title={
            activeScene
              ? 'Add a text layer starting at the playhead'
              : 'Move the playhead over a scene first'
          }
          onClick={() => {
            if (!activeScene) return;
            useEditorStore.getState().addLayer(activeScene.id, timeMs);
          }}
        >
          + Text
        </button>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-ink-500">
          <span>{scenes.length} scenes</span>
          <span className="text-ink-700">·</span>
          <span>{state.transcript.words.length} words</span>
        </div>
      </div>

      {/* tracks */}
      <div
        ref={trackRef}
        // touch-none, or on a phone a drag scrolls the page instead of
        // scrubbing and the timeline is effectively read-only.
        className="relative flex-1 cursor-text touch-none select-none overflow-y-auto overflow-x-hidden px-4 py-2"
        onPointerDown={(e) => {
          setScrubbing(true);
          seekFromEvent(e.clientX);
        }}
      >
        {/* waveform */}
        <div className="relative mb-1.5 h-8 overflow-hidden rounded bg-ink-950/60">
          {waveformPath && (
            <svg
              className="h-full w-full"
              viewBox="0 0 1000 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path d={waveformPath} fill="rgba(217,197,160,0.28)" />
            </svg>
          )}
        </div>

        {/* scenes */}
        <div className="relative mb-2 h-11 shrink-0">
          {scenes.map((scene) => {
            const active = timeMs >= scene.startMs && timeMs <= scene.endMs;
            const selected = selection.sceneId === scene.id;
            return (
              <button
                key={scene.id}
                className={cn(
                  'absolute top-0 flex h-full flex-col justify-center gap-0.5 overflow-hidden rounded-md border px-2 text-left text-[11px] transition',
                  active
                    ? 'border-accent/70 bg-accent/15 text-accent-soft'
                    : selected
                      ? 'border-ink-500 bg-ink-800 text-ink-200'
                      : 'border-ink-700 bg-ink-850 text-ink-400 hover:border-ink-600',
                )}
                style={{ left: pct(scene.startMs), width: pct(scene.endMs - scene.startMs) }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  select(scene.id, null);
                  setTime(scene.startMs + 40);
                }}
                title={scene.layers.map(layerText).join(' / ')}
              >
                <span className="block truncate leading-[1.15]">
                  {scene.layers.map(layerText).join(' ') || '—'}
                </span>
                <span className="block truncate text-[9px] uppercase tracking-wider text-ink-500">
                  {scene.compositionId}
                </span>
              </button>
            );
          })}
        </div>

        {/* layers of the active scene */}
        <LayerTrack scene={activeScene} duration={duration} pct={pct} />

        {/* playhead */}
        <Playhead trackRef={trackRef} timeMs={timeMs} duration={duration} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layer track                                                         */
/* ------------------------------------------------------------------ */

/** Shortest a layer may be trimmed to. Below this it cannot be grabbed again. */
const MIN_LAYER_MS = 120;
/** How close (in pixels) an edge must come to a landmark before it snaps. */
const SNAP_PX = 6;
/*
 * Row geometry.
 *
 * Was 15px per row carrying a 13px bar of 9px text - legible only just, and a
 * hopeless drag target on touch, which is what made the whole track read as
 * cramped. Now that the panel height is adjustable there is room to spend, so
 * the bar is tall enough to read and to grab.
 */
const ROW_HEIGHT = 26;
const BAR_HEIGHT = 22;

type LayerDrag = {
  kind: 'move' | 'trim-start' | 'trim-end';
  layerId: string;
  pointerX: number;
  fromMs: number;
  toMs: number;
  /** The rest of the selection, with their own starting spans. Move only. */
  others: Array<{ layerId: string; fromMs: number; toMs: number }>;
};

/**
 * The editable layer track.
 *
 * Bars can be dragged along the track, trimmed from either edge, selected and
 * deleted - the operations any timeline is expected to have, over the whole
 * clip rather than only inside the parent scene.
 *
 * That freedom is only safe because visibility is decided per layer: the
 * renderer draws any layer whose own window contains the playhead, from any
 * scene. While it was scene-scoped, time granted outside the parent scene was
 * time the caption could never appear in, so the track had to clamp to the
 * scene or it would have produced captions that silently never showed. Now the
 * only real boundary is the clip itself.
 */
function LayerTrack({
  scene,
  duration,
  pct,
}: {
  scene: CaptionScene | null;
  duration: number;
  pct: (ms: number) => string;
}) {
  const selection = useEditorStore((s) => s.selection);
  const timeMs = useEditorStore((s) => s.timeMs);
  const select = useEditorStore((s) => s.select);
  const toggleLayerSelected = useEditorStore((s) => s.toggleLayerSelected);

  // Group members can live in other scenes now that layers are not confined to
  // one, so resolve ids against the whole document rather than this scene.
  const layersById = useEditorStore((st) => {
    const map = new Map<string, CaptionLayer>();
    for (const sc of st.state?.design.scenes ?? []) for (const l of sc.layers) map.set(l.id, l);
    return map;
  });
  const rowsRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<LayerDrag | null>(null);

  const layers = useMemo(
    () => [...(scene?.layers ?? [])].sort((a, b) => a.startMs - b.startMs || a.zIndex - b.zIndex),
    [scene],
  );

  // Pack bars into rows so two layers sharing a moment never sit on top of each
  // other - overlapping bars are unclickable, which is most of why the track
  // felt broken.
  const placed = useMemo(() => {
    const rowEnds: number[] = [];
    return layers.map((layer) => {
      let row = rowEnds.findIndex((end) => layer.startMs >= end);
      if (row < 0) {
        rowEnds.push(layer.endMs);
        row = rowEnds.length - 1;
      } else {
        rowEnds[row] = layer.endMs;
      }
      return { layer, row };
    });
  }, [layers]);

  const rowCount = placed.reduce((max, p) => Math.max(max, p.row + 1), 1);

  /* Snap targets: the scene's own edges, the playhead, and every other bar. */
  const draggingId = drag?.layerId ?? null;
  const snapTargets = useMemo(() => {
    if (!scene) return [];
    const targets = [scene.startMs, scene.endMs, timeMs];
    for (const layer of layers) {
      // Never snap a bar to itself, or it sticks to where it started.
      if (layer.id === draggingId) continue;
      targets.push(layer.startMs, layer.endMs);
    }
    return targets;
  }, [scene, layers, timeMs, draggingId]);

  // Read through a ref inside the drag, so a transient update - which changes
  // `layers` and therefore `snapTargets` - does not tear down and rebuild the
  // window listeners on every animation frame.
  const snapRef = useRef(snapTargets);
  snapRef.current = snapTargets;

  const sceneStartMs = scene?.startMs ?? 0;
  const sceneEndMs = scene?.endMs ?? 0;

  useEffect(() => {
    if (!drag) return;

    const el = rowsRef.current;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    const msPerPx = duration / Math.max(1, width);
    const snapMs = SNAP_PX * msPerPx;

    const snap = (ms: number, enabled: boolean): number => {
      if (!enabled) return ms;
      let best = ms;
      let bestGap = snapMs;
      for (const target of snapRef.current) {
        const gap = Math.abs(target - ms);
        if (gap < bestGap) {
          bestGap = gap;
          best = target;
        }
      }
      return Math.round(best);
    };

    const onMove = (event: PointerEvent) => {
      const deltaMs = (event.clientX - drag.pointerX) * msPerPx;
      const snapping = !event.shiftKey;
      let startMs = drag.fromMs;
      let endMs = drag.toMs;

      // The clip is the only hard boundary. Scene edges remain as snap targets
      // below, so they still guide a drag without trapping it.
      if (drag.kind === 'move') {
        const span = drag.toMs - drag.fromMs;
        startMs = snap(drag.fromMs + deltaMs, snapping);
        // Keep the length exactly - a move must never resize.
        startMs = Math.min(Math.max(startMs, 0), Math.max(0, duration - span));
        endMs = startMs + span;
      } else if (drag.kind === 'trim-start') {
        startMs = snap(drag.fromMs + deltaMs, snapping);
        startMs = Math.min(Math.max(startMs, 0), drag.toMs - MIN_LAYER_MS);
      } else {
        endMs = snap(drag.toMs + deltaMs, snapping);
        endMs = Math.max(Math.min(endMs, duration), drag.fromMs + MIN_LAYER_MS);
      }

      // transient: a drag emits dozens of updates and only the last one should
      // become an undo step.
      //
      // The snapped primary defines the shift, and the rest move by exactly
      // that, so a group keeps its internal spacing instead of collapsing
      // together when one bar snaps.
      const shift = Math.round(startMs) - drag.fromMs;
      useEditorStore.getState().updateLayers(
        [
          { layerId: drag.layerId, patch: { startMs: Math.round(startMs), endMs: Math.round(endMs) } },
          ...(drag.kind === 'move'
            ? drag.others.map((other) => ({
                layerId: other.layerId,
                patch: {
                  startMs: Math.max(0, other.fromMs + shift),
                  endMs: Math.max(1, other.toMs + shift),
                },
              }))
            : []),
        ],
        { transient: true },
      );
    };

    const onUp = () => {
      // Re-commit the settled values without `transient`, so the whole drag
      // collapses into exactly one undo entry.
      const current = useEditorStore.getState().state;
      const layer = current?.design.scenes
        .flatMap((s) => s.layers)
        .find((l) => l.id === drag.layerId);
      if (layer) {
        useEditorStore.getState().updateLayer(layer.id, { startMs: layer.startMs, endMs: layer.endMs });
      }
      setDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag, sceneStartMs, sceneEndMs, duration]);

  const begin = (kind: LayerDrag['kind'], layer: CaptionLayer) => (event: React.PointerEvent) => {
    // The track behind this starts scrubbing on pointerdown; a bar drag is not
    // a scrub.
    event.stopPropagation();

    // Shift-click builds a selection here exactly as it does on the canvas, and
    // likewise starts no drag.
    if (event.shiftKey) {
      toggleLayerSelected(scene?.id ?? null, layer.id);
      return;
    }

    const inSelection = selection.layerIds.includes(layer.id);
    if (!inSelection && scene) select(scene.id, layer.id);

    // Trimming stays single-layer: dragging one edge of several bars with
    // different lengths has no one obvious meaning, and guessing would be worse
    // than the current, predictable behaviour. Moving is unambiguous.
    const groupIds =
      kind === 'move' && inSelection && selection.layerIds.length > 1
        ? selection.layerIds
        : [layer.id];

    const others = groupIds
      .filter((id) => id !== layer.id)
      .map((id) => {
        const member = layersById.get(id);
        return member ? { layerId: id, fromMs: member.startMs, toMs: member.endMs } : null;
      })
      .filter((o): o is { layerId: string; fromMs: number; toMs: number } => o !== null);

    setDrag({
      kind,
      layerId: layer.id,
      pointerX: event.clientX,
      fromMs: layer.startMs,
      toMs: layer.endMs,
      others,
    });
  };

  if (!scene) {
    return (
      <div className="relative flex h-16 items-center justify-center text-[10px] text-ink-600">
        No scene at the playhead
      </div>
    );
  }

  return (
    <div
      ref={rowsRef}
      className="relative overflow-y-auto"
      style={{ height: 64, minHeight: 64 }}
      // No handler here on purpose: a pointerdown on empty track must fall
      // through to the scrub, and scrubbing should not clear the selection.
    >
      <div className="relative" style={{ height: Math.max(ROW_HEIGHT + 6, rowCount * ROW_HEIGHT + 4) }}>
        {placed.map(({ layer, row }) => {
          const selected = selection.layerId === layer.id;
          const dragging = drag?.layerId === layer.id;
          return (
            <div
              key={layer.id}
              className={cn(
                'absolute flex items-center overflow-hidden rounded border text-left text-[11px] leading-tight transition-colors',
                selected
                  ? 'border-accent bg-accent/25 text-accent-soft'
                  : 'border-ink-700 bg-ink-800 text-ink-400 hover:border-ink-500',
                dragging ? 'cursor-grabbing' : 'cursor-grab',
                'touch-none',
              )}
              style={{
                left: pct(layer.startMs),
                // True duration, so the bar is an honest picture of the range it
                // covers; `minWidth` only keeps a very short one grabbable.
                width: pct(layer.endMs - layer.startMs),
                minWidth: 22,
                height: BAR_HEIGHT,
                top: row * ROW_HEIGHT,
              }}
              onPointerDown={begin('move', layer)}
              title={`${layerText(layer)} · ${formatTime(layer.startMs, true)}–${formatTime(layer.endMs, true)} · drag to move, edges to trim, Del to remove`}
            >
              {/* trim handles: generous hit area, subtle appearance */}
              <span
                // Wider on touch: 1.5 units is a comfortable mouse target and
                // an impossible finger one.
                className="absolute inset-y-0 left-0 w-3 touch-none cursor-ew-resize bg-accent/0 hover:bg-accent/60 sm:w-1.5"
                onPointerDown={begin('trim-start', layer)}
                title="Drag to change when this caption appears"
              />
              <span className="pointer-events-none truncate px-2">{layerText(layer) || 'New text'}</span>
              <span
                className="absolute inset-y-0 right-0 w-3 touch-none cursor-ew-resize bg-accent/0 hover:bg-accent/60 sm:w-1.5"
                onPointerDown={begin('trim-end', layer)}
                title="Drag to change when this caption leaves"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The playhead is positioned in pixels against the measured track rather than
 * as a percentage, because the track has horizontal padding and a percentage
 * would drift from the scene bars by exactly that padding.
 */
function Playhead({
  trackRef,
  timeMs,
  duration,
}: {
  trackRef: React.RefObject<HTMLDivElement>;
  timeMs: number;
  duration: number;
}) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const inner = el.clientWidth - 32; // px-4 either side
    setLeft(16 + (timeMs / Math.max(1, duration)) * inner);
  }, [trackRef, timeMs, duration]);

  return (
    <div className="pointer-events-none absolute inset-y-1 z-20 w-px bg-accent" style={{ left }}>
      <div className="absolute -left-[3px] top-0 h-1.5 w-1.5 rounded-full bg-accent" />
    </div>
  );
}

function buildWaveformPath(waveform: Float32Array | null): string | null {
  if (!waveform || waveform.length === 0) return null;
  const n = waveform.length;
  const top: string[] = [];
  const bottom: string[] = [];

  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 1000;
    const amp = Math.min(1, waveform[i]) * 48;
    top.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${(50 - amp).toFixed(1)}`);
    bottom.unshift(`L${x.toFixed(1)},${(50 + amp).toFixed(1)}`);
  }
  return `${top.join('')}${bottom.join('')}Z`;
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M3 1.5v9l7-4.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M3 1.5h2.5v9H3zM6.5 1.5H9v9H6.5z" />
    </svg>
  );
}
