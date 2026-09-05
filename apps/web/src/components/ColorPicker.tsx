import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';

/**
 * HSV colour picker.
 *
 * The native `<input type="color">` is a different dialog on every platform,
 * cannot show the project palette, and on mobile often covers the very frame
 * you are trying to match. So this is hand-built: a saturation/value field, a
 * hue rail, hex entry, the palette, and - where the browser supports it - an
 * eyedropper for sampling a colour straight out of the video.
 *
 * Pointer events throughout, so dragging works identically with a mouse, a
 * finger or a pen.
 */

interface Props {
  value: string;
  onChange: (hex: string) => void;
  /** The project palette, offered as one-tap swatches. */
  palette?: readonly string[];
  /** Recently used colours, newest first. */
  recent?: readonly string[];
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Colour maths                                                        */
/* ------------------------------------------------------------------ */

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];

  const to = (n: number) =>
    Math.round((n + m) * 255).toString(16).padStart(2, '0').toUpperCase();

  return `#${to(r)}${to(g)}${to(b)}`;
}

const isHex = (value: string) => /^#?[0-9a-fA-F]{6}$/.test(value.trim());

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ColorPicker({ value, onChange, palette = [], recent = [], className }: Props) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [draft, setDraft] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Follow external changes (selecting a different layer) without fighting the
  // user's own drag: hue is preserved when the hex round-trips to the same
  // colour, so a fully desaturated pick does not reset the rail to red.
  useEffect(() => {
    const next = hexToHsv(value);
    setHsv((prev) => (hsvToHex(prev.h, prev.s, prev.v) === value.toUpperCase() ? prev : next));
  }, [value]);

  const commit = useCallback(
    (h: number, s: number, v: number) => {
      setHsv({ h, s, v });
      onChange(hsvToHex(h, s, v));
    },
    [onChange],
  );

  const trackDrag = useCallback(
    (
      ref: React.RefObject<HTMLDivElement>,
      event: React.PointerEvent,
      handler: (fx: number, fy: number) => void,
    ) => {
      const el = ref.current;
      if (!el) return;
      el.setPointerCapture(event.pointerId);

      const apply = (clientX: number, clientY: number) => {
        const rect = el.getBoundingClientRect();
        handler(
          Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
          Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
        );
      };

      apply(event.clientX, event.clientY);

      const move = (e: PointerEvent) => apply(e.clientX, e.clientY);
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [],
  );

  const pickFromScreen = async () => {
    // Chromium only. Sampling the actual frame beats guessing a hex.
    const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } })
      .EyeDropper;
    if (!EyeDropperCtor) return;
    try {
      const result = await new EyeDropperCtor().open();
      onChange(result.sRGBHex.toUpperCase());
    } catch {
      /* the user dismissed it */
    }
  };

  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;
  const swatches = [...new Set([...palette, ...recent])].slice(0, 12);

  return (
    <div className={cn('space-y-2.5', className)}>
      {/* saturation / value field */}
      <div
        ref={fieldRef}
        className="relative h-32 w-full cursor-crosshair touch-none rounded-md"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(hsv.h, 1, 1)})`,
        }}
        onPointerDown={(e) => trackDrag(fieldRef, e, (fx, fy) => commit(hsv.h, fx, 1 - fy))}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: value }}
        />
      </div>

      {/* hue rail */}
      <div
        ref={hueRef}
        className="relative h-4 w-full cursor-ew-resize touch-none rounded-full"
        style={{
          background:
            'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        }}
        onPointerDown={(e) => trackDrag(hueRef, e, (fx) => commit(fx * 360, hsv.s, hsv.v))}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)]"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hsvToHex(hsv.h, 1, 1) }}
        />
      </div>

      {/* hex + eyedropper */}
      <div className="flex items-center gap-2">
        <span
          className="h-8 w-8 shrink-0 rounded-md border border-ink-700"
          style={{ backgroundColor: value }}
        />
        <input
          className="field py-1 font-mono text-xs uppercase"
          value={draft ?? value}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            if (isHex(e.target.value)) {
              const hex = `#${e.target.value.replace('#', '')}`.toUpperCase();
              setHsv(hexToHsv(hex));
              onChange(hex);
            }
          }}
          onBlur={() => setDraft(null)}
        />
        {hasEyeDropper && (
          <button
            type="button"
            className="btn-outline shrink-0 px-2 py-1.5"
            title="Pick a colour from anywhere on screen"
            onClick={() => void pickFromScreen()}
          >
            <EyeDropperIcon />
          </button>
        )}
      </div>

      {swatches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {swatches.map((colour) => (
            <button
              key={colour}
              type="button"
              title={colour}
              onClick={() => {
                setHsv(hexToHsv(colour));
                onChange(colour.toUpperCase());
              }}
              className={cn(
                'h-6 w-6 rounded-full border transition',
                value.toLowerCase() === colour.toLowerCase()
                  ? 'border-accent ring-2 ring-accent/40'
                  : 'border-ink-600 hover:border-ink-300',
              )}
              style={{ backgroundColor: colour }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EyeDropperIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M11 2.5a2 2 0 0 1 2.8 2.8l-1.1 1.1 1 1-1.4 1.4-1-1-5 5-2.6.6.6-2.6 5-5-1-1L9.7 3.4l1 1 1.1-1.1z" />
    </svg>
  );
}
