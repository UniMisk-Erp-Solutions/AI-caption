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
   * Which way a positive drag grows the panel. `up` suits a panel pinned to
   * the bottom (dragging the divider upwards makes it taller); `left` suits one
   * pinned to the right edge.
   */
  direction: 'up' | 'left';
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
  direction,
  step = 24,
  label,
  className,
}: ResizeHandleProps) {
  const start = useRef<{ pointer: number; size: number } | null>(null);
  const vertical = direction === 'up';

  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);

  const onPointerDown = (event: React.PointerEvent) => {
    start.current = { pointer: vertical ? event.clientY : event.clientX, size };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const from = start.current;
    if (!from) return;
    const now = vertical ? event.clientY : event.clientX;
    // Both supported directions grow as the pointer moves towards the origin,
    // hence the negated delta.
    onResize(clamp(from.size + (from.pointer - now)));
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
        const grow = vertical ? 'ArrowUp' : 'ArrowLeft';
        const shrink = vertical ? 'ArrowDown' : 'ArrowRight';
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
