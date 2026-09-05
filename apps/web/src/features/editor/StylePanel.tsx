import {
  COMPOSITION_IDS,
  PRESET_IDS,
  PRESET_TAGS,
  fontFamilyStack,
  getComposition,
  getFont,
  getPreset,
  relatedPresets,
  type PresetId,
} from '@kc/shared';
import { useMemo, useState } from 'react';
import { Section, Slider, Spinner } from '../../components/ui';
import { cn } from '../../lib/cn';
import { hasApi } from '../../lib/env';
import { preloadFontsForPicker } from '../../fonts/fonts';
import { useActiveScene, useEditorStore } from '../../stores/editorStore';

/**
 * The style panel.
 *
 * The important idea: changing the look is a *local, instant* operation.
 * Swapping between 135 presets, hero contrast, motion and rotation all re-run
 * the composer in the browser. Nothing here costs an API call, so trying twenty
 * looks is free and takes twenty seconds.
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

  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);

  const current = state?.design.direction.preset ?? 'SCRIPT_EDITORIAL';

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    // With no filter, lead with looks related to the current one. A flat
    // alphabetical wall of 135 is a list, not a design tool.
    if (!q && !tag) {
      const related = relatedPresets(current, 24).map((p) => p.id as PresetId);
      return [
        current as PresetId,
        ...related,
        ...PRESET_IDS.filter((id) => id !== current && !related.includes(id)),
      ];
    }

    return PRESET_IDS.filter((id) => {
      const preset = getPreset(id);
      if (tag && !preset.tags.includes(tag)) return false;
      if (!q) return true;
      return (
        preset.label.toLowerCase().includes(q) ||
        preset.description.toLowerCase().includes(q) ||
        preset.tags.some((t) => t.includes(q)) ||
        getFont(preset.voices.hero.fontId).family.toLowerCase().includes(q) ||
        getFont(preset.voices.base.fontId).family.toLowerCase().includes(q)
      );
    });
  }, [query, tag, current]);

  if (!state) return null;
  const direction = state.design.direction;
  const preset = getPreset(direction.preset);

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain pb-24 lg:pb-0">
      <Section title={`Look · ${PRESET_IDS.length} pairings`}>
        <input
          className="field mb-2 py-1.5"
          placeholder="Search style, font or mood…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          <TagChip active={!tag} onClick={() => setTag(null)}>
            All
          </TagChip>
          {PRESET_TAGS.map((t) => (
            <TagChip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </TagChip>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {results.slice(0, 40).map((id) => (
            <PresetCard
              key={id}
              id={id}
              active={direction.preset === id}
              onSelect={() => regenerateWithPreset(id)}
            />
          ))}
        </div>

        {results.length === 0 && (
          <p className="py-6 text-center text-xs text-ink-500">Nothing matches that.</p>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-ink-500">{preset.description}</p>
      </Section>

      <Section title="Direction">
        <div className="space-y-4">
          <Slider
            label="Hero contrast"
            value={direction.heroContrast}
            onChange={(heroContrast) => setDirection({ heroContrast })}
            min={0.6}
            max={1.8}
            step={0.05}
            format={(v) => `${v.toFixed(2)}×`}
          />
          <Slider
            label="Scale"
            value={direction.scale}
            onChange={(scale) => setDirection({ scale })}
            min={0.6}
            max={1.6}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Motion"
            value={direction.motionLevel}
            onChange={(motionLevel) => setDirection({ motionLevel })}
            format={motionLabel}
          />
          <Slider
            label="Rotation"
            value={direction.rotationLevel}
            onChange={(rotationLevel) => setDirection({ rotationLevel })}
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
          {/* Composition is geometry, so picking one re-runs the composer for
              this scene rather than patching the existing layers. */}
          <div className="grid grid-cols-2 gap-1.5">
            {COMPOSITION_IDS.map((id) => (
              <button
                key={id}
                onClick={() => applyComposition(id)}
                className={cn(
                  'min-h-[38px] rounded border px-2 py-1.5 text-left text-[10px] leading-tight transition',
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
              className="btn-outline min-h-[44px] w-full justify-between text-left"
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

function TagChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] transition',
        active
          ? 'border-accent bg-accent/15 text-accent-soft'
          : 'border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200',
      )}
    >
      {children}
    </button>
  );
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
  const preset = getPreset(id);
  const base = getFont(preset.voices.base.fontId);
  const hero = getFont(preset.voices.hero.fontId);

  return (
    <button
      onClick={onSelect}
      // The preview is live type, so the faces have to arrive before the card
      // means anything - but only for cards the user actually looks at.
      onPointerEnter={() => preloadFontsForPicker([base.id, hero.id])}
      onFocus={() => preloadFontsForPicker([base.id, hero.id])}
      className={cn(
        'group overflow-hidden rounded-md border text-left transition',
        active ? 'border-accent ring-1 ring-accent/40' : 'border-ink-700 hover:border-ink-500',
      )}
      title={preset.description}
    >
      {/* A live specimen of the pairing itself - the whole point of a preset is
          how the two faces sit together, which a colour swatch cannot show. */}
      <div
        className="flex h-[52px] items-center justify-center gap-1 px-2"
        style={{ backgroundColor: '#15181d' }}
      >
        <span style={{ fontFamily: fontFamilyStack(base.id), color: preset.palette[0], fontSize: 13 }}>
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
