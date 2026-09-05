import { Spinner } from '../../components/ui';
import { cn } from '../../lib/cn';
import type { StepState } from './pipeline';

/**
 * The processing screen.
 *
 * A named, itemised checklist rather than a spinner. Forty seconds of "Loading…"
 * feels broken; forty seconds of watching "Creating transcript ✓ / Analysing
 * composition ●" feels like work being done, and when a step degrades the user
 * can see exactly which one and why.
 */

export function ProcessingView({
  steps,
  warnings,
  uploadFraction,
}: {
  steps: StepState[];
  warnings: string[];
  uploadFraction: number | null;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl text-ink-100">Designing your captions</h1>
      <p className="mt-1.5 text-sm text-ink-400">This usually takes under a minute.</p>

      <ol className="mt-8 space-y-1">
        {steps.map((step) => (
          <li
            key={step.id}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 transition',
              step.status === 'active' && 'bg-ink-900',
            )}
          >
            <StatusIcon status={step.status} />

            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  'text-sm',
                  step.status === 'done'
                    ? 'text-ink-200'
                    : step.status === 'active'
                      ? 'text-ink-100'
                      : step.status === 'failed'
                        ? 'text-red-300'
                        : 'text-ink-600',
                )}
              >
                {step.label}
              </div>
              {step.detail && (
                <div className="truncate text-[11px] text-ink-600">{step.detail}</div>
              )}
            </div>

            {step.status === 'active' && step.progress !== undefined && (
              <span className="shrink-0 text-[11px] tabular-nums text-ink-500">
                {Math.round(step.progress * 100)}%
              </span>
            )}
          </li>
        ))}
      </ol>

      {uploadFraction !== null && uploadFraction < 1 && (
        <div className="mt-6 space-y-1.5">
          <div className="flex justify-between text-[11px] text-ink-500">
            <span>Backing up to the cloud</span>
            <span className="tabular-nums">{Math.round(uploadFraction * 100)}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-ink-500 transition-[width]"
              style={{ width: `${uploadFraction * 100}%` }}
            />
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="mt-6 space-y-1.5">
          {warnings.map((warning) => (
            <li
              key={warning}
              className="rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-200"
            >
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: StepState['status'] }) {
  if (status === 'active') return <Spinner className="shrink-0" />;

  const base = 'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px]';

  switch (status) {
    case 'done':
      return <span className={cn(base, 'bg-accent text-ink-950')}>✓</span>;
    case 'failed':
      return <span className={cn(base, 'bg-red-900 text-red-200')}>!</span>;
    case 'skipped':
      return <span className={cn(base, 'border border-ink-700 text-ink-600')}>–</span>;
    default:
      return <span className={cn(base, 'border border-ink-800')} />;
  }
}
