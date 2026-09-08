import {
  activeLayers,
  hitTestLayers,
  measureLayerRect,
  renderFrame,
  sceneAt,
  sceneOfLayer,
  type CaptionLayer,
} from '@kc/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ensureSceneFonts } from '../../fonts/fonts';
import { cn } from '../../lib/cn';
import { useActiveScene, useEditorStore } from '../../stores/editorStore';

/**
 * The preview stage.
 *
 * A `<video>` element for the footage with a canvas on top for the captions.
 * The captions are drawn by `renderFrame` from the shared package - the exact
 * function the exporter calls - so the preview is not an approximation of the
 * output, it is the output with a different destination.
 *
 * Playback drives the clock. We read `video.currentTime` each frame rather than
 * running our own timer, because any independent clock will drift against the
 * decoder and the captions will slowly slide off the words.
 */

interface Props {
  videoUrl: string | null;
  className?: string;
}

type DragMode =
  | { kind: 'none' }
  /*
   * Every mode carries the starting state of the whole selection, not just the
   * layer under the cursor.
   *
   * Transforms are applied as one delta computed from the primary layer and
   * then handed unchanged to every member, rather than each member being
   * recomputed from the pointer. That is what keeps relative spacing exact: a
   * per-layer recomputation accumulates rounding and drifts the arrangement
   * apart over a long drag, which is precisely the alignment this is meant to
   * preserve. Snapping is likewise resolved once, on the primary.
   */
  | {
      kind: 'move';
      layerId: string;
      grabX: number;
      grabY: number;
      originX: number;
      originY: number;
      origins: Array<{ layerId: string; x: number; y: number }>;
    }
  | {
      kind: 'scale';
      layerId: string;
      startSize: number;
      startDist: number;
      sizes: Array<{ layerId: string; fontSize: number }>;
    }
  | {
      kind: 'rotate';
      layerId: string;
      centerX: number;
      centerY: number;
      startAngle: number;
      startRotation: number;
      rotations: Array<{ layerId: string; rotation: number }>;
    };

export function CanvasStage({ videoUrl, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const dragRef = useRef<DragMode>({ kind: 'none' });

  const state = useEditorStore((s) => s.state);
  const timeMs = useEditorStore((s) => s.timeMs);
  const playing = useEditorStore((s) => s.playing);
  const selection = useEditorStore((s) => s.selection);
  const setTime = useEditorStore((s) => s.setTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const select = useEditorStore((s) => s.select);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const updateLayers = useEditorStore((s) => s.updateLayers);
  const toggleLayerSelected = useEditorStore((s) => s.toggleLayerSelected);
  const scene = useActiveScene();

  const [box, setBox] = useState({ width: 0, height: 0 });
  const [editing, setEditing] = useState<{ layerId: string; value: string } | null>(null);

  const frameW = state?.project.width ?? 1080;
  const frameH = state?.project.height ?? 1920;

  /* ---------------------------------------------------------------- */
  /* Sizing                                                            */
  /* ---------------------------------------------------------------- */

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const aspect = frameW / frameH;
      // Letterbox inside the available area, never crop.
      let width = rect.width;
      let height = width / aspect;
      if (height > rect.height) {
        height = rect.height;
        width = height * aspect;
      }
      setBox({ width: Math.floor(width), height: Math.floor(height) });
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [frameW, frameH]);

  /* ---------------------------------------------------------------- */
  /* Font readiness                                                    */
  /* ---------------------------------------------------------------- */

  // Canvas silently substitutes a fallback face for a font that has not loaded,
  // so a scene must have its faces ready before it is first painted.
  useEffect(() => {
    if (scene) void ensureSceneFonts(scene);
  }, [scene]);

  /* ---------------------------------------------------------------- */
  /* Render loop                                                       */
  /* ---------------------------------------------------------------- */

  const draw = useCallback(
    (atMs: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !state) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw in frame coordinates and let the transform handle the preview
      // scale, so every number in the state is resolution-independent.
      const scale = canvas.width / frameW;
      ctx.scale(scale, scale);
      renderFrame(ctx, state, atMs, frameW, frameH);
    },
    [state, frameW, frameH],
  );

  useEffect(() => {
    const video = videoRef.current;

    const tick = () => {
      if (video && !video.paused && !video.ended) {
        const ms = Math.round(video.currentTime * 1000);
        // The video decoder owns the clock; the store follows it.
        useEditorStore.getState().setTime(ms);
        draw(ms);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Redraw on any state change while paused (scrubbing, editing, undo).
  useEffect(() => {
    if (!playing) draw(timeMs);
  }, [draw, timeMs, playing, state]);

  /* ---------------------------------------------------------------- */
  /* Playback                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, [playing, setPlaying]);

  // Seek the element when the store's time moves independently (timeline drag).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || playing) return;
    const target = timeMs / 1000;
    if (Math.abs(video.currentTime - target) > 0.04) video.currentTime = target;
  }, [timeMs, playing]);

  /* ---------------------------------------------------------------- */
  /* Pointer interaction                                               */
  /* ---------------------------------------------------------------- */

  const toNormalized = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      };
    },
    [],
  );

  const measuringCtx = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas?.getContext('2d') ?? null;
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!state) return;
    const ctx = measuringCtx();
    if (!ctx) return;

    // Hit test exactly what was painted. Visibility follows each layer's own
    // window rather than its parent scene's, so a layer trimmed past a scene
    // boundary is still both drawn and clickable - and one that is off screen
    // is neither, which is what stops a click landing on invisible text.
    const point = toNormalized(event);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const layer = hitTestLayers(ctx, activeLayers(state, timeMs), point, frameW, frameH);

    if (!layer) {
      // Empty video selects the scene under the playhead, or clears when the
      // playhead sits in a gap where nothing is on screen at all.
      select(sceneAt(state, timeMs)?.id ?? null, null);
      return;
    }

    const owningSceneId = sceneOfLayer(state, layer.id)?.id ?? null;

    // Shift-click builds a selection instead of replacing it, and deliberately
    // starts no drag: the gesture is "also this one", and moving the group on
    // the same press would make a mis-click hard to undo.
    if (event.shiftKey) {
      toggleLayerSelected(owningSceneId, layer.id);
      return;
    }

    // Clicking a layer that is already part of a multi-selection keeps that
    // selection and drags the group. Without this, grabbing one of several
    // selected captions would silently collapse the selection to it.
    const inSelection = selection.layerIds.includes(layer.id);
    if (!inSelection) select(owningSceneId, layer.id);

    const groupIds = inSelection && selection.layerIds.length > 1 ? selection.layerIds : [layer.id];
    const origins = groupIds
      .map((id) => {
        const member = findLayer(id);
        return member ? { layerId: id, x: member.x, y: member.y } : null;
      })
      .filter((o): o is { layerId: string; x: number; y: number } => o !== null);

    (event.target as Element).setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: 'move',
      layerId: layer.id,
      grabX: point.x,
      grabY: point.y,
      originX: layer.x,
      originY: layer.y,
      origins,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (drag.kind === 'none' || !state) return;

    const point = toNormalized(event);

    if (drag.kind === 'move') {
      let x = drag.originX + (point.x - drag.grabX);
      let y = drag.originY + (point.y - drag.grabY);

      // Snap the primary to the thirds and centre lines unless shift is held.
      // Shift is also the multi-select modifier, but it cannot be held during a
      // move - shift-click never starts one - so the two never collide.
      if (!event.shiftKey) {
        x = snap(x, [0.5, 1 / 3, 2 / 3, 0.1, 0.9], 0.012);
        y = snap(y, [0.5, 1 / 3, 2 / 3, 0.25, 0.75], 0.012);
      }

      // The snapped primary defines the delta; everyone moves by exactly that,
      // so the arrangement is rigid and one caption snapping carries the rest
      // with it rather than closing the gap between them.
      const dx = x - drag.originX;
      const dy = y - drag.originY;

      // transient: a drag emits dozens of updates and only the last one should
      // become an undo step.
      updateLayers(
        drag.origins.map((origin) => ({
          layerId: origin.layerId,
          patch: {
            x: clamp(origin.x + dx, -0.1, 1.1),
            y: clamp(origin.y + dy, -0.1, 1.1),
          },
        })),
        { transient: true },
      );
      return;
    }

    if (drag.kind === 'scale') {
      const layer = findLayer(drag.layerId);
      if (!layer) return;
      const dist = Math.hypot(point.x - layer.x, (point.y - layer.y) * (frameH / frameW));
      const ratio = dist / Math.max(0.001, drag.startDist);

      // One ratio for the whole group, applied to each layer's own starting
      // size. Anchors are left alone: scaling positions about a centroid would
      // move captions the user had placed, and relative size is what "resize
      // them together" actually means here.
      updateLayers(
        drag.sizes.map((entry) => ({
          layerId: entry.layerId,
          patch: { fontSize: clamp(entry.fontSize * ratio, 0.012, 0.3) },
        })),
        { transient: true },
      );
      return;
    }

    if (drag.kind === 'rotate') {
      const angle = Math.atan2(point.y - drag.centerY, point.x - drag.centerX);
      let degrees = drag.startRotation + ((angle - drag.startAngle) * 180) / Math.PI;
      if (!event.shiftKey) degrees = Math.round(degrees / 5) * 5;
      const delta = degrees - drag.startRotation;

      updateLayers(
        drag.rotations.map((entry) => ({
          layerId: entry.layerId,
          patch: { rotation: clamp(entry.rotation + delta, -180, 180) },
        })),
        { transient: true },
      );
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = { kind: 'none' };
    if (drag.kind === 'none') return;

    // Re-commit the settled values without `transient`, so the whole drag
    // collapses into exactly one undo entry - for every layer that moved, not
    // just the one under the cursor.
    const ids =
      drag.kind === 'move'
        ? drag.origins.map((o) => o.layerId)
        : drag.kind === 'scale'
          ? drag.sizes.map((e) => e.layerId)
          : drag.rotations.map((e) => e.layerId);

    const patches = ids
      .map((id) => {
        const layer = findLayer(id);
        return layer
          ? {
              layerId: id,
              patch: {
                x: layer.x,
                y: layer.y,
                fontSize: layer.fontSize,
                rotation: layer.rotation,
              },
            }
          : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (patches.length > 0) updateLayers(patches);
  };

  function findLayer(layerId: string): CaptionLayer | null {
    if (!state) return null;
    for (const s of state.design.scenes) {
      const found = s.layers.find((l) => l.id === layerId);
      if (found) return found;
    }
    return null;
  }

  const onDoubleClick = () => {
    if (!selection.layerId) return;
    const layer = findLayer(selection.layerId);
    if (!layer) return;
    setEditing({ layerId: layer.id, value: layer.runs.map((r) => r.text).join(' ') });
  };

  /* ---------------------------------------------------------------- */
  /* Selection overlay                                                 */
  /* ---------------------------------------------------------------- */

  const selectedLayer = selection.layerId ? findLayer(selection.layerId) : null;
  // A frame around text that is not on screen is a box floating over bare
  // video, and its handles drag something invisible. Show it only while its
  // layer is actually being drawn.
  const selectionVisible =
    !!selectedLayer && timeMs >= selectedLayer.startMs && timeMs <= selectedLayer.endMs;
  const selectionRect = (() => {
    const ctx = measuringCtx();
    if (!ctx || !selectedLayer || !selectionVisible) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return measureLayerRect(ctx, selectedLayer, frameW, frameH);
  })();

  /*
   * Everything selected, in selection order, skipping anything that has since
   * been deleted. Transform handles act on this whole set, so it has to be
   * resolved from ids each render rather than captured once.
   */
  const selectedGroup = selection.layerIds
    .map((id) => findLayer(id))
    .filter((l): l is CaptionLayer => l !== null);

  /*
   * Outlines for the other members. Only the primary gets handles - a group
   * needs one place to grab, and drawing scale and rotate affordances on every
   * member would suggest they each transform alone. Same visibility rule as the
   * primary: a box over text that is not on screen is a box over bare video.
   */
  const companionRects = (() => {
    const ctx = measuringCtx();
    if (!ctx || selectedGroup.length < 2) return [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return selectedGroup
      .filter((l) => l.id !== selection.layerId && timeMs >= l.startMs && timeMs <= l.endMs)
      .map((l) => ({ id: l.id, rotation: l.rotation, rect: measureLayerRect(ctx, l, frameW, frameH) }));
  })();

  return (
    <div ref={wrapRef} className={cn('relative flex h-full w-full items-center justify-center', className)}>
      <div
        className="relative overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-ink-800"
        style={{ width: box.width, height: box.height }}
      >
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            muted={false}
            preload="auto"
            onEnded={() => setPlaying(false)}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              if (timeMs > 0) video.currentTime = timeMs / 1000;
            }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-ink-500">
            Source video unavailable on this device
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="preview-canvas absolute inset-0 h-full w-full touch-none"
          width={Math.max(1, Math.round(box.width * window.devicePixelRatio))}
          height={Math.max(1, Math.round(box.height * window.devicePixelRatio))}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        />

        {!editing &&
          companionRects.map(({ id, rect, rotation }) => (
            <div
              key={id}
              className="pointer-events-none absolute rounded-[2px] border border-dashed border-accent/70"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
                transform: `rotate(${rotation}deg)`,
              }}
            />
          ))}

        {selectionRect && !editing && (
          <SelectionFrame
            rect={selectionRect}
            rotation={selectedLayer?.rotation ?? 0}
            onScaleStart={(event) => {
              if (!selectedLayer) return;
              const point = toNormalized(event);
              dragRef.current = {
                kind: 'scale',
                layerId: selectedLayer.id,
                startSize: selectedLayer.fontSize,
                startDist: Math.hypot(
                  point.x - selectedLayer.x,
                  (point.y - selectedLayer.y) * (frameH / frameW),
                ),
                sizes: selectedGroup.map((l) => ({ layerId: l.id, fontSize: l.fontSize })),
              };
            }}
            onRotateStart={(event) => {
              if (!selectedLayer) return;
              const point = toNormalized(event);
              const cx = selectionRect.x + selectionRect.width / 2;
              const cy = selectionRect.y + selectionRect.height / 2;
              dragRef.current = {
                kind: 'rotate',
                layerId: selectedLayer.id,
                centerX: cx,
                centerY: cy,
                startAngle: Math.atan2(point.y - cy, point.x - cx),
                startRotation: selectedLayer.rotation,
                rotations: selectedGroup.map((l) => ({ layerId: l.id, rotation: l.rotation })),
              };
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        )}

        {editing && (
          <InlineTextEditor
            value={editing.value}
            onCancel={() => setEditing(null)}
            onCommit={(value) => {
              useEditorStore.getState().setLayerText(editing.layerId, value);
              setEditing(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Selection chrome                                                    */
/* ------------------------------------------------------------------ */

function SelectionFrame({
  rect,
  rotation,
  onScaleStart,
  onRotateStart,
  onPointerMove,
  onPointerUp,
}: {
  rect: { x: number; y: number; width: number; height: number };
  rotation: number;
  onScaleStart: (event: React.PointerEvent) => void;
  onRotateStart: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: () => void;
}) {
  const style: React.CSSProperties = {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center',
  };

  const handle =
    'absolute h-3 w-3 rounded-full border-2 border-ink-950 bg-accent shadow pointer-events-auto touch-none';

  return (
    <div
      className="pointer-events-none absolute border border-accent/70"
      style={style}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className={cn(handle, '-bottom-1.5 -right-1.5 cursor-nwse-resize')}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture(e.pointerId);
          onScaleStart(e);
        }}
        title="Drag to resize"
      />
      <div
        className={cn(handle, '-top-6 left-1/2 -translate-x-1/2 cursor-grab')}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture(e.pointerId);
          onRotateStart(e);
        }}
        title="Drag to rotate"
      />
      <div className="absolute -top-4 left-1/2 h-4 w-px -translate-x-1/2 bg-accent/50" />
    </div>
  );
}

function InlineTextEditor({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <div className="absolute inset-x-4 bottom-4 rounded-lg border border-accent/50 bg-ink-950/95 p-3 shadow-2xl backdrop-blur">
      <textarea
        ref={ref}
        className="field min-h-[64px] resize-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onCommit(draft);
          }
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
        <span>Enter to save · Esc to cancel</span>
        <div className="flex gap-2">
          <button className="btn-ghost px-2 py-1" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary px-3 py-1" onClick={() => onCommit(draft)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function snap(value: number, targets: number[], tolerance: number): number {
  for (const target of targets) {
    if (Math.abs(value - target) < tolerance) return target;
  }
  return value;
}
