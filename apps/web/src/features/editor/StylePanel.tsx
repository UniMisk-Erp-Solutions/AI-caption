import {
  ANIMATION_REGISTRY,
  COMPOSITION_IDS,
  FONT_REGISTRY,
  PRESET_REGISTRY,
  fontFamilyStack,
  getComposition,
  getPreset,
  type FontId,
  type PresetId,
} from '@kc/shared';
import { useState } from 'react';
import { Section, Slider, Spinner } from '../../components/ui';
import { cn } from '../../lib/cn';
import { hasApi } from '../../lib/env';
import { preloadFontForPicker } from '../../fonts/fonts';
import { useActiveScene, useEditorStore } from '../../stores/editorStore';

/**
 * The style panel.
 *
 * The important idea: changing the look is a *local, instant* operation. Preset
 * swaps, hero contrast, motion level and font substitutions all re-run the
 * deterministic composer in the browser. Nothing here costs an API call, so
 * trying eight looks is free and takes eight seconds.
 *
 * The AI actions at the bottom are the only things that touch the network.
 */

interface Props {
  onAiAction: (instruction: string, scope: 'project' | 'scene') => Promise<void>;
  aiBusy: string | null;
}

export function StylePanel({ onAiAction, aiBusy }: Props) {
  const state = useEditorStore((s) => s.state);
  const setDirection = useEditorStore((s) => s.setDirection);
  const regenerateWithPreset = useEditorStore((s) => s.regenerateWithPreset);
  const scene = useActiveScene();

  if (!state) return null;
  const direction = state.design.direction;
  const preset = getPreset(direction.preset);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <Section title="Look">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PRESET_REGISTRY) as PresetId[]).map((id) => (
            <PresetCard
              key={id}
              id={id}
              active={direction.preset === id}
              onSelect={() => regenerateWithPreset(id)}
            />
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-500">{preset.description}</p>
      </Section>

      <Section title="Pairing">
        <div className="space-y-3">
          <FontRow
            label="Sentence"
            value={(direction.baseFont ?? preset.voices.base.fontId) as FontId}
            onChange={(fontId) => setDirection({ baseFont: fontId })}
            onReset={() => setDirection({ baseFont: null })}
            isDefault={direction.baseFont === null}
          />
          <FontRow
            label="Hero word"
            value={(direction.heroFont ?? preset.voices.hero.fontId) as FontId}
            onChange={(fontId) => setDirection({ heroFont: fontId })}
            onReset={() => setDirection({ heroFont: null })}
            isDefault={direction.heroFont === null}
          />
          <FontRow
            label="Accent"
            value={(direction.accentFont ?? preset.voices.accent.fontId) as FontId}
            onChange={(fontId) => setDirection({ accentFont: fontId })}
            onReset={() => setDirection({ accentFont: null })}
            isDefault={direction.accentFont === null}
          />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
          A font change here restyles every scene that you have not hand-edited.
        </p>
      </Section>

      <Section title="Direction">
        <div className="space-y-4">
          <Slider
            label="Hero contrast"
            value={direction.heroContrast}
            onChange={(v) => setDirection({ heroContrast: v })}
            min={0.6}
            max={1.8}
            step={0.05}
            format={(v) => `${v.toFixed(2)}x`}
          />
          <Slider
            label="Scale"
            value={direction.scale}
            onChange={(v) => setDirection({ scale: v })}
            min={0.6}
            max={1.6}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Motion"
            value={direction.motionLevel}
            onChange={(v) => setDirection({ motionLevel: v })}
            format={(v) => motionLabel(v)}
          />
          <Slider
            label="Rotation"
            value={direction.rotationLevel}
            onChange={(v) => setDirection({ rotationLevel: v })}
            format={(v) => (v < 0.05 ? 'none' : v < 0.4 ? 'subtle' : 'loose')}
          />
        </div>

        <button
          className="btn-outline mt-4 w-full"
          onClick={() => regenerateWithPreset(direction.preset)}
        >
          Re-lay out every scene
        </button>
      </Section>

      {scene && (
        <Section title="This scene">
          <div className="space-y-2">
            {/* Composition is geometry, so picking one re-runs the composer for
                this scene rather than patching the existing layers. */}
            <div className="grid grid-cols-2 gap-1.5">
              {COMPOSITION_IDS.map((id) => (
                <button
                  key={id}
                  onClick={() => applyComposition(id)}
                  className={cn(
                    'rounded border px-2 py-1.5 text-left text-[10px] leading-tight transition',
                    scene.compositionId === id
                      ? 'border-accent bg-accent/15 text-accent-soft'
                      : 'border-ink-700 bg-ink-850 text-ink-400 hover:border-ink-600 hover:text-ink-200',
                  )}
                  title={getComposition(id).vibe}
                >
                  {getComposition(id).label}
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section title="AI">
        {!hasApi && (
          <p className="mb-3 rounded border border-ink-700 bg-ink-850 px-2.5 py-2 text-[11px] leading-relaxed text-ink-400">
            Running in local mode. Everything above works offline — connect the
            API to let Gemma read your frames and direct the layout.
          </p>
        )}
        <div className="space-y-1.5">
          {AI_ACTIONS.map((action) => (
            <button
              key={action.label}
              disabled={!hasApi || aiBusy !== null}
              onClick={() => void onAiAction(action.instruction, action.scope)}
              className="btn-outline w-full justify-between text-left"
            >
              <span>{action.label}</span>
              {aiBusy === action.label ? (
                <Spinner />
              ) : (
                <span className="text-[10px] uppercase tracking-wider text-ink-600">
                  {action.scope}
                </span>
              )}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const AI_ACTIONS: Array<{ label: string; instruction: string; scope: 'project' | 'scene' }> = [
  { label: 'Regenerate whole design', instruction: '', scope: 'project' },
  { label: 'Redesign this scene', instruction: '', scope: 'scene' },
  { label: 'Try another composition', instruction: 'Use a different composition and a different hero word.', scope: 'scene' },
  { label: 'Make it more editorial', instruction: 'More editorial: quieter, more whitespace, one clear hero word.', scope: 'project' },
  { label: 'Make it more minimal', instruction: 'Strip it back. Fewer lines, smaller type, much more negative space.', scope: 'project' },
  { label: 'Make it more playful', instruction: 'More playful and energetic. Looser line breaks, bolder hero words.', scope: 'project' },
  { label: 'Bolder typography', instruction: 'Push the size contrast much further. Make the hero words dominate the frame.', scope: 'project' },
  { label: 'Move text off the subject', instruction: 'Reposition text into empty areas of each frame. Nothing may cover a face.', scope: 'project' },
];

function applyComposition(compositionId: string): void {
  const store = useEditorStore.getState();
  const state = store.state;
  if (!state) return;

  const scene = state.design.scenes.find(
    (s) => store.timeMs >= s.startMs && store.timeMs <= s.endMs,
  );
  if (!scene) return;

  // Rebuild this one scene through the composer with the new arrangement,
  // preserving which words are heroes and every hand-edited layer.
  void import('../../lib/recompose').then(({ recomposeScene }) => {
    const rebuilt = recomposeScene(state, scene.id, { compositionId });
    if (rebuilt) store.replaceScene(rebuilt);
  });
}

function motionLabel(value: number): string {
  if (value < 0.2) return 'still';
  if (value < 0.45) return 'gentle';
  if (value < 0.7) return 'lively';
  return 'loud';
}

function PresetCard({
  id,
  active,
  onSelect,
}: {
  id: PresetId;
  active: boolean;
  onSelect: () => void;
}) {
  const preset = PRESET_REGISTRY[id];
  const base = FONT_REGISTRY[preset.voices.base.fontId];
  const hero = FONT_REGISTRY[preset.voices.hero.fontId];

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group overflow-hidden rounded-md border text-left transition',
        active
          ? 'border-accent ring-1 ring-accent/40'
          : 'border-ink-700 hover:border-ink-500',
      )}
      title={preset.description}
    >
      {/* A live specimen of the actual pairing, not a colour swatch - the whole
          point of a preset here is how the two faces sit together. */}
      <div
        className="flex h-[52px] items-center justify-center gap-1 px-2"
        style={{ backgroundColor: '#15181d' }}
      >
        <span
          style={{ fontFamily: fontFamilyStack(base.id), color: preset.palette[0], fontSize: 13 }}
        >
          the
        </span>
        <span
          style={{
            fontFamily: fontFamilyStack(hero.id),
            color: preset.palette[0],
            fontSize: 24 * (hero.opticalScale > 1.2 ? 1.15 : 1),
            lineHeight: 1,
          }}
        >
          look
        </span>
      </div>
      <div
        className={cn(
          'truncate border-t px-2 py-1 text-[10px]',
          active ? 'border-accent/40 text-accent-soft' : 'border-ink-800 text-ink-400',
        )}
      >
        {preset.label}
      </div>
    </button>
  );
}

function FontRow({
  label,
  value,
  onChange,
  onReset,
  isDefault,
}: {
  label: string;
  value: FontId;
  onChange: (fontId: FontId) => void;
  onReset: () => void;
  isDefault: boolean;
}) {
  const [open, setOpen] = useState(false);
  const font = FONT_REGISTRY[value];

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="label">{label}</span>
        {!isDefault && (
          <button className="text-[10px] text-ink-500 hover:text-accent" onClick={onReset}>
            reset
          </button>
        )}
      </div>

      <button
        className="flex w-full items-center justify-between rounded-md border border-ink-700 bg-ink-850 px-2.5 py-2 text-left transition hover:border-ink-600"
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="truncate text-lg leading-none"
          style={{ fontFamily: fontFamilyStack(value) }}
        >
          {font.family}
        </span>
        <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wider text-ink-500">
          {font.role}
        </span>
      </button>

      {open && (
        <div className="mt-1 max-h-64 overflow-y-auto rounded-md border border-ink-700 bg-ink-900 p-1">
          {(Object.keys(FONT_REGISTRY) as FontId[]).map((id) => (
            <button
              key={id}
              onMouseEnter={() => void preloadFontForPicker(id)}
              onClick={() => {
                onChange(id);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-baseline justify-between gap-2 rounded px-2 py-1.5 text-left transition',
                id === value ? 'bg-accent/15 text-accent-soft' : 'hover:bg-ink-800',
              )}
              title={FONT_REGISTRY[id].vibe}
            >
              <span className="truncate text-base" style={{ fontFamily: fontFamilyStack(id) }}>
                {FONT_REGISTRY[id].family}
              </span>
              <span className="shrink-0 text-[9px] uppercase tracking-wider text-ink-600">
                {FONT_REGISTRY[id].role}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { ANIMATION_REGISTRY };
