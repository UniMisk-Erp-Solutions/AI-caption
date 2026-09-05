import {
  ANIMATION_IDS,
  FONT_IDS,
  FONT_REGISTRY,
  fontFamilyStack,
  getAnimation,
  getFont,
  layerText,
  resolveWeight,
  type CaptionLayer,
  type Emphasis,
  type TextRun,
} from '@kc/shared';
import { useState } from 'react';
import {
  ColorSwatches,
  EmptyState,
  Field,
  NumberField,
  Section,
  SegmentedControl,
  Select,
  Slider,
  Toggle,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import { recomposeScene } from '../../lib/recompose';
import { useActiveScene, useEditorStore, useSelectedLayer } from '../../stores/editorStore';

/**
 * The inspector.
 *
 * Two levels of editing, and the split matters:
 *
 *   WORD level  - which face, size and emphasis each word carries. This is
 *                 where the pairing actually lives, so it comes first and gets
 *                 the most direct controls.
 *   BLOCK level - position, rotation, alignment, timing, animation for the
 *                 whole line.
 *
 * Most caption tools only expose the block level, which is exactly why their
 * output looks like subtitles rather than typography.
 */

export function InspectorPanel() {
  const layer = useSelectedLayer();
  const scene = useActiveScene();
  const state = useEditorStore((s) => s.state);
  const selection = useEditorStore((s) => s.selection);

  if (!state) return null;

  if (!layer) {
    return (
      <div className="flex h-full items-center">
        <EmptyState
          title="Nothing selected"
          description="Click any caption on the canvas to edit its words, fonts and motion. Double-click to retype it."
          action={
            scene ? (
              <button
                className="btn-outline"
                onClick={() => useEditorStore.getState().addLayer(scene.id)}
              >
                Add a text layer
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <WordsSection layer={layer} sceneId={selection.sceneId} />
      <BlockSection layer={layer} />
      <MotionSection layer={layer} />
      <LayerActions layer={layer} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Word-level                                                          */
/* ------------------------------------------------------------------ */

function WordsSection({ layer, sceneId }: { layer: CaptionLayer; sceneId: string | null }) {
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const setRunEmphasis = useEditorStore((s) => s.setRunEmphasis);
  const splitRunAtWord = useEditorStore((s) => s.splitRunAtWord);

  return (
    <Section title="Words">
      <p className="mb-3 text-[11px] leading-relaxed text-ink-500">
        Tap a word to change how it is set. One hero word per screen is what
        makes the pairing read.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {layer.runs.map((run) => {
          const words = run.text.split(/\s+/).filter(Boolean);
          return words.map((word, wordIndex) => (
            <button
              key={`${run.id}-${wordIndex}`}
              onClick={() => {
                // A word inside a multi-word run has to be split out before it
                // can carry its own style.
                if (words.length > 1) splitRunAtWord(layer.id, run.id, wordIndex);
                else setOpenRunId(openRunId === run.id ? null : run.id);
              }}
              className={cn(
                'rounded border px-2 py-1 text-sm leading-tight transition',
                run.emphasis === 'hero'
                  ? 'border-accent bg-accent/15 text-accent-soft'
                  : run.emphasis === 'accent'
                    ? 'border-ink-500 bg-ink-800 text-ink-100'
                    : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-500',
              )}
              style={{ fontFamily: fontFamilyStack(run.fontId) }}
              title={`${getFont(run.fontId).family} · ${run.emphasis}`}
            >
              {word}
            </button>
          ));
        })}
      </div>

      <div className="mt-3 space-y-2">
        {layer.runs.map((run) => (
          <RunEditor
            key={run.id}
            layer={layer}
            run={run}
            open={openRunId === run.id}
            onToggle={() => setOpenRunId(openRunId === run.id ? null : run.id)}
            onEmphasis={(emphasis) => setRunEmphasis(layer.id, run.id, emphasis)}
          />
        ))}
      </div>

      {sceneId && (
        <button
          className="btn-ghost mt-3 w-full text-[11px]"
          onClick={() => {
            const state = useEditorStore.getState().state;
            if (!state) return;
            const rebuilt = recomposeScene(state, sceneId, {});
            if (rebuilt) useEditorStore.getState().replaceScene(rebuilt);
          }}
        >
          Re-fit this scene
        </button>
      )}
    </Section>
  );
}

const EMPHASIS_OPTIONS: Array<{ value: Emphasis; label: string; title: string }> = [
  { value: 'base', label: 'Base', title: 'The sentence voice' },
  { value: 'hero', label: 'Hero', title: 'The big script/display word' },
  { value: 'accent', label: 'Accent', title: 'Secondary emphasis' },
  { value: 'micro', label: 'Micro', title: 'Tiny label text' },
];

function RunEditor({
  layer,
  run,
  open,
  onToggle,
  onEmphasis,
}: {
  layer: CaptionLayer;
  run: TextRun;
  open: boolean;
  onToggle: () => void;
  onEmphasis: (emphasis: Emphasis) => void;
}) {
  const updateRun = useEditorStore((s) => s.updateRun);
  const state = useEditorStore((s) => s.state);
  const font = getFont(run.fontId);

  return (
    <div className="rounded-md border border-ink-800 bg-ink-850/60">
      <button
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
        onClick={onToggle}
      >
        <span className="truncate text-sm" style={{ fontFamily: fontFamilyStack(run.fontId) }}>
          {run.text}
        </span>
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider',
            run.emphasis === 'hero' ? 'bg-accent/20 text-accent-soft' : 'bg-ink-800 text-ink-500',
          )}
        >
          {run.emphasis}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-ink-800 px-2.5 py-3">
          <SegmentedControl value={run.emphasis} onChange={onEmphasis} options={EMPHASIS_OPTIONS} />

          <Field label="Font">
            <Select
              value={run.fontId}
              onChange={(fontId) =>
                updateRun(layer.id, run.id, {
                  fontId,
                  fontWeight: resolveWeight(fontId, run.fontWeight),
                  // A face without an italic must not stay flagged italic, or
                  // the browser synthesises a slanted fake.
                  italic: run.italic && getFont(fontId).italic,
                })
              }
              options={FONT_IDS.map((id) => ({ value: id, label: FONT_REGISTRY[id].family }))}
            />
          </Field>

          <Field label="Weight">
            <Select
              value={String(run.fontWeight)}
              onChange={(w) => updateRun(layer.id, run.id, { fontWeight: Number(w) })}
              options={font.weights.map((w) => ({ value: String(w), label: String(w) }))}
            />
          </Field>

          <Slider
            label="Size"
            value={run.sizeScale}
            onChange={(v) => updateRun(layer.id, run.id, { sizeScale: v })}
            min={0.2}
            max={3.5}
            step={0.05}
            format={(v) => `${v.toFixed(2)}x`}
          />

          <Slider
            label="Tracking"
            value={run.letterSpacing}
            onChange={(v) => updateRun(layer.id, run.id, { letterSpacing: v })}
            min={-0.1}
            max={0.5}
            step={0.005}
            format={(v) => `${v.toFixed(3)}em`}
          />

          <Slider
            label="Baseline"
            value={run.baselineShift}
            onChange={(v) => updateRun(layer.id, run.id, { baselineShift: v })}
            min={-0.6}
            max={0.6}
            step={0.01}
            format={(v) => `${v.toFixed(2)}em`}
          />

          {font.italic && (
            <Toggle
              label="Italic"
              checked={run.italic}
              onChange={(italic) => updateRun(layer.id, run.id, { italic })}
            />
          )}

          <Field label="Colour">
            <ColorSwatches
              value={run.color}
              palette={state?.design.direction.palette ?? ['#FFFFFF']}
              onChange={(color) => updateRun(layer.id, run.id, { color })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Block-level                                                         */
/* ------------------------------------------------------------------ */

function BlockSection({ layer }: { layer: CaptionLayer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const state = useEditorStore((s) => s.state);
  const frameH = state?.project.height ?? 1920;

  return (
    <Section title="Block">
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="X"
            value={layer.x * 100}
            onChange={(v) => updateLayer(layer.id, { x: v / 100 })}
            min={-10}
            max={110}
            step={0.5}
            precision={1}
            suffix="%"
          />
          <NumberField
            label="Y"
            value={layer.y * 100}
            onChange={(v) => updateLayer(layer.id, { y: v / 100 })}
            min={-10}
            max={110}
            step={0.5}
            precision={1}
            suffix="%"
          />
        </div>

        <NumberField
          label="Size"
          value={layer.fontSize * frameH}
          onChange={(v) => updateLayer(layer.id, { fontSize: v / frameH })}
          min={12}
          max={frameH * 0.3}
          step={1}
          suffix="px"
        />

        <NumberField
          label="Rotate"
          value={layer.rotation}
          onChange={(rotation) => updateLayer(layer.id, { rotation })}
          min={-180}
          max={180}
          step={1}
          suffix="°"
        />

        <Field label="Align">
          <SegmentedControl
            value={layer.textAlign}
            onChange={(textAlign) => updateLayer(layer.id, { textAlign })}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Centre' },
              { value: 'right', label: 'Right' },
            ]}
          />
        </Field>

        <Slider
          label="Line height"
          value={layer.lineHeight}
          onChange={(lineHeight) => updateLayer(layer.id, { lineHeight })}
          min={0.6}
          max={2}
          step={0.02}
        />

        <Slider
          label="Wrap width"
          value={layer.maxWidth}
          onChange={(maxWidth) => updateLayer(layer.id, { maxWidth })}
          min={0.15}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
        />

        <Slider
          label="Shadow"
          value={layer.shadow}
          onChange={(shadow) => updateLayer(layer.id, { shadow })}
          format={(v) => (v < 0.05 ? 'off' : `${Math.round(v * 100)}%`)}
        />

        <Slider
          label="Opacity"
          value={layer.opacity}
          onChange={(opacity) => updateLayer(layer.id, { opacity })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Motion and timing                                                   */
/* ------------------------------------------------------------------ */

function MotionSection({ layer }: { layer: CaptionLayer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const setTime = useEditorStore((s) => s.setTime);
  const duration = useEditorStore((s) => s.state?.project.durationMs ?? 0);

  const animationOptions = ANIMATION_IDS.map((id) => ({ value: id, label: getAnimation(id).label }));

  return (
    <Section title="Motion">
      <div className="space-y-3">
        <Field label="In" hint={getAnimation(layer.enterAnimation).vibe}>
          <Select
            value={layer.enterAnimation}
            onChange={(enterAnimation) =>
              updateLayer(layer.id, {
                enterAnimation,
                enterDurationMs: getAnimation(enterAnimation).defaultMs,
              })
            }
            options={animationOptions}
          />
        </Field>

        <NumberField
          label="In time"
          value={layer.enterDurationMs}
          onChange={(enterDurationMs) => updateLayer(layer.id, { enterDurationMs })}
          min={0}
          max={4000}
          step={20}
          suffix="ms"
        />

        <Field label="Out">
          <Select
            value={layer.exitAnimation}
            onChange={(exitAnimation) =>
              updateLayer(layer.id, {
                exitAnimation,
                exitDurationMs: getAnimation(exitAnimation).defaultMs,
              })
            }
            options={animationOptions}
          />
        </Field>

        <NumberField
          label="Out time"
          value={layer.exitDurationMs}
          onChange={(exitDurationMs) => updateLayer(layer.id, { exitDurationMs })}
          min={0}
          max={4000}
          step={20}
          suffix="ms"
        />

        <div className="grid grid-cols-2 gap-2 border-t border-ink-800 pt-3">
          <NumberField
            label="Start"
            value={layer.startMs}
            onChange={(startMs) =>
              updateLayer(layer.id, { startMs: Math.min(startMs, layer.endMs - 100) })
            }
            min={0}
            max={duration}
            step={10}
            suffix="ms"
          />
          <NumberField
            label="End"
            value={layer.endMs}
            onChange={(endMs) =>
              updateLayer(layer.id, { endMs: Math.max(endMs, layer.startMs + 100) })
            }
            min={0}
            max={duration}
            step={10}
            suffix="ms"
          />
        </div>

        <button className="btn-ghost w-full text-[11px]" onClick={() => setTime(layer.startMs + 10)}>
          Jump to start
        </button>
      </div>
    </Section>
  );
}

function LayerActions({ layer }: { layer: CaptionLayer }) {
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);

  return (
    <Section title="Layer">
      <div className="mb-3 truncate text-[11px] text-ink-500">{layerText(layer)}</div>
      <div className="flex gap-2">
        <button className="btn-outline flex-1" onClick={() => duplicateLayer(layer.id)}>
          Duplicate
        </button>
        <button className="btn-danger flex-1" onClick={() => deleteLayer(layer.id)}>
          Delete
        </button>
      </div>
    </Section>
  );
}
