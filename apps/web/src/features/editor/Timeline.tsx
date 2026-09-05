import { layerText } from '@kc/shared';
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

        <div className="ml-auto flex items-center gap-2 text-[11px] text-ink-500">
          <span>{scenes.length} scenes</span>
          <span className="text-ink-700">·</span>
          <span>{state.transcript.words.length} words</span>
        </div>
      </div>

      {/* tracks */}
      <div
        ref={trackRef}
        className="relative flex-1 cursor-text select-none overflow-hidden px-4 py-2"
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
        <div className="relative mb-1.5 h-9">
          {scenes.map((scene) => {
            const active = timeMs >= scene.startMs && timeMs <= scene.endMs;
            const selected = selection.sceneId === scene.id;
            return (
              <button
                key={scene.id}
                className={cn(
                  'absolute top-0 h-full overflow-hidden rounded border px-2 text-left text-[11px] transition',
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
        <div className="relative h-16 space-y-1">
          {scenes
            .filter((s) => timeMs >= s.startMs && timeMs <= s.endMs)
            .flatMap((s) => s.layers)
            .slice(0, 4)
            .map((layer) => (
              <button
                key={layer.id}
                className={cn(
                  'absolute h-[13px] overflow-hidden rounded-sm border px-1.5 text-left text-[9px] leading-[11px] transition',
                  selection.layerId === layer.id
                    ? 'border-accent bg-accent/25 text-accent-soft'
                    : 'border-ink-700 bg-ink-800 text-ink-400 hover:border-ink-500',
                )}
                style={{
                  left: pct(layer.startMs),
                  width: pct(Math.max(120, layer.endMs - layer.startMs)),
                  top: layerRow(layer.role) * 15,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  select(selection.sceneId, layer.id);
                }}
                title={layerText(layer)}
              >
                <span className="truncate">{layerText(layer)}</span>
              </button>
            ))}
        </div>

        {/* playhead */}
        <Playhead trackRef={trackRef} timeMs={timeMs} duration={duration} />
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

function layerRow(role: string): number {
  return role === 'lead' ? 0 : role === 'hero' ? 1 : role === 'tail' ? 2 : 3;
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
