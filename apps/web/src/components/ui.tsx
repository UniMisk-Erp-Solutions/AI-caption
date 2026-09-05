import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * The small UI kit.
 *
 * Deliberately hand-rolled rather than pulled from a component library: the
 * editor needs maybe eight primitives, all of them narrow, dense and dark, and
 * the inspector's numeric controls (scrub-to-change, snap-to-default) do not
 * exist in a generic kit anyway.
 */

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <div className="label">{label}</div>}
      {children}
      {hint && <p className="text-[11px] leading-snug text-ink-500">{hint}</p>}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border-b border-ink-800 px-4 py-4 last:border-b-0', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="label">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <select
      className={cn('field appearance-none pr-7', className)}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='%236b7280'><path d='M2.5 4.5 6 8l3.5-3.5z'/></svg>\")",
        backgroundPosition: 'right 8px center',
        backgroundRepeat: 'no-repeat',
      } as React.CSSProperties}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-ink-850">
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Numeric input with a draggable label.
 *
 * Dragging the label to change a value is the interaction every motion tool
 * has, and its absence is immediately felt when nudging rotation or size.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  precision = 0,
  suffix,
  sensitivity = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  precision?: number;
  suffix?: string;
  sensitivity?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startValue: number } | null>(null);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  useEffect(() => {
    if (!dragRef.current) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = (event.clientX - drag.startX) * step * sensitivity;
      onChange(clamp(Number((drag.startValue + delta).toFixed(precision + 2))));
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

  return (
    <label className="flex items-center gap-2">
      <span
        className="w-16 shrink-0 cursor-ew-resize select-none text-[11px] uppercase tracking-wider text-ink-400 hover:text-accent"
        onPointerDown={(e) => {
          dragRef.current = { startX: e.clientX, startValue: value };
          document.body.style.cursor = 'ew-resize';
        }}
      >
        {label}
      </span>
      <input
        className="field py-1 text-right tabular-nums"
        inputMode="decimal"
        value={draft ?? formatNumber(value, precision)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) {
            const parsed = Number.parseFloat(draft);
            if (Number.isFinite(parsed)) onChange(clamp(parsed));
            setDraft(null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const dir = e.key === 'ArrowUp' ? 1 : -1;
            onChange(clamp(value + dir * step * (e.shiftKey ? 10 : 1)));
          }
        }}
      />
      {suffix && <span className="w-5 shrink-0 text-[11px] text-ink-500">{suffix}</span>}
    </label>
  );
}

function formatNumber(value: number, precision: number): string {
  return precision > 0 ? value.toFixed(precision) : String(Math.round(value));
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className="text-[11px] tabular-nums text-ink-400">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode; title?: string }>;
}) {
  return (
    <div className="flex rounded-md border border-ink-700 bg-ink-850 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded px-2 py-1 text-xs font-medium transition',
            value === option.value ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-ink-100',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between py-1 text-left"
    >
      <span className="text-sm text-ink-200">{label}</span>
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition',
          checked ? 'bg-accent' : 'bg-ink-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}

export function ColorSwatches({
  value,
  palette,
  onChange,
}: {
  value: string;
  palette: readonly string[];
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {palette.map((color) => (
        <button
          key={color}
          type="button"
          title={color}
          onClick={() => onChange(color)}
          className={cn(
            'h-6 w-6 rounded-full border transition',
            value.toLowerCase() === color.toLowerCase()
              ? 'border-accent ring-2 ring-accent/40'
              : 'border-ink-600 hover:border-ink-400',
          )}
          style={{ backgroundColor: color }}
        />
      ))}
      <label className="ml-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-dashed border-ink-600 text-[10px] text-ink-400 hover:border-ink-400">
        +
        <input
          type="color"
          className="sr-only"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-600 border-t-accent',
        className,
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h3 className="font-display text-2xl text-ink-100">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-ink-400">{description}</p>
      {action}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative w-full rounded-xl border border-ink-800 bg-ink-900 shadow-2xl',
          width,
        )}
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink-100">{title}</h2>
          <button className="btn-ghost -mr-2 px-2 py-1 text-ink-400" onClick={onClose}>
            Esc
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
