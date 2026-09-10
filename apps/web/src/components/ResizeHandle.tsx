import { useCallback, useRef } from 'react';
import { cn } from '../lib/cn';

/**
 * A draggable divider.
 *
 * Pointer events rather than mouse events, so the same handle works with a
 * trackpad, a finger and a stylus - a timeline you can only resize with a
 * mouse is not resizable on the devices where the default height hurts most.
 * `touch-none` is what stops a drag from scrolling the page underneath.
 *
 * The size is reported as a delta from where the drag started rather than from
 * the pointer's absolute position, so the handle does not jump to sit under the
 * cursor on the first move.
 */

export interface ResizeHandleProps {
  /** Current size in px of the panel being resized. */
  size: number;
  onResize: (next: number) => void;
  min: number;
  max: number;
  /**
   * The pointer direction that makes the panel BIGGER.
   *
   * Named after the gesture rather than after the panel's position, because
   * the two are opposite and conflating them is how this went wrong: a single
   * "horizontal" mode is correct for a panel pinned to the right edge (whose
   * handle is on its left, so dragging left grows it) and exactly backwards
   * for one pinned to the left edge (handle on its right, dragging right grows
   * it). Stating the gesture leaves nothing to infer.
   *
   *   'up'    - panel below the handle   (the timeline)
   *   'right' - panel left of the handle (the style panel)
   *   'left'  - panel right of the handle (the inspector)
   */
  grows: 'up' | 'left' | 'right';
  /** Keyboard step, and the nudge applied by arrow keys. */
  step?: number;
  label: string;
  className?: string;
}

export function ResizeHandle({
  size,
  onResize,
  min,
  max,
  grows,
  step = 24,
  label,
  className,
}: ResizeHandleProps) {
  const start = useRef<{ pointer: number; size: number } | null>(null);
  const vertical = grows === 'up';
  // +1 when moving towards larger coordinates grows the panel.
  const sign = grows === 'right' ? 1 : -1;

  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);

  const onPointerDown = (event: React.PointerEvent) => {
    start.current = { pointer: vertical ? event.clientY : event.clientX, size };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const from = start.current;
    if (!from) return;
    const now = vertical ? event.clientY : event.clientX;
    onResize(clamp(from.size + (now - from.pointer) * sign));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    start.current = null;
    const el = event.currentTarget as Element;
    if (el.hasPointerCapture?.(event.pointerId)) el.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      aria-label={label}
      aria-valuenow={Math.round(size)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onResize(clamp(Math.round((min + max) / 2)))}
      onKeyDown={(event) => {
        // Keyboard access matters more than usual here: a divider is otherwise
        // the one piece of layout that cannot be reached without a pointer.
        // The arrow keys mirror the drag exactly, for the same reason.
        const grow = vertical ? 'ArrowUp' : grows === 'right' ? 'ArrowRight' : 'ArrowLeft';
        const shrink = vertical ? 'ArrowDown' : grows === 'right' ? 'ArrowLeft' : 'ArrowRight';
        if (event.key === grow) {
          event.preventDefault();
          onResize(clamp(size + step));
        } else if (event.key === shrink) {
          event.preventDefault();
          onResize(clamp(size - step));
        }
      }}
      className={cn(
        'group relative shrink-0 touch-none bg-ink-900 transition-colors',
        // A hairline that reads as a border, with a much larger invisible grab
        // area around it - 4px is a fine line to look at and a poor thing to
        // hit, especially with a finger.
        vertical
          ? 'h-3 w-full cursor-row-resize border-y border-ink-800'
          : 'h-full w-3 cursor-col-resize border-x border-ink-800',
        'hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60',
        className,
      )}
      title={`${label} — drag, double-click to reset, or use the arrow keys`}
    >
      {/* The grip. Purely visual; the whole bar is the target. */}
      <span
        className={cn(
          'pointer-events-none absolute rounded-full bg-ink-700 transition group-hover:bg-accent/70',
          vertical
            ? 'left-1/2 top-1/2 h-[3px] w-9 -translate-x-1/2 -translate-y-1/2'
            : 'left-1/2 top-1/2 h-9 w-[3px] -translate-x-1/2 -translate-y-1/2',
        )}
      />
    </div>
  );
}
