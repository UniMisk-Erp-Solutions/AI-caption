import {
  PRESET_IDS,
  PRESET_TAGS,
  fontFamilyStack,
  getFont,
  getPreset,
  relatedPresets,
  type PresetId,
} from '@kc/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Section } from '../../components/ui';
import { cn } from '../../lib/cn';
import { preloadFontsForPicker } from '../../fonts/fonts';
import { useEditorStore } from '../../stores/editorStore';

/**
 * The style panel.
 *
 * One job: pick the pairing. Changing the look is a local, instant operation -
 * all 135 presets re-run the composer in the browser, so trying twenty costs
 * nothing and takes seconds.
 *
 * Picking one restyles in place. It deliberately does not re-lay out, so a
 * position or animation set by hand survives being tried against a new look.
 */

export function StylePanel() {
  const state = useEditorStore((s) => s.state);
  const setDirection = useEditorStore((s) => s.setDirection);
  const regenerateWithPreset = useEditorStore((s) => s.regenerateWithPreset);
  const restyleWithPreset = useEditorStore((s) => s.restyleWithPreset);

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
              onSelect={() => restyleWithPreset(id)}
            />
          ))}
        </div>

        {results.length === 0 && (
          <p className="py-6 text-center text-xs text-ink-500">Nothing matches that.</p>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-ink-500">{preset.description}</p>
      </Section>

    </div>
  );
}

/* ------------------------------------------------------------------ */

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
  const ref = useRef<HTMLButtonElement | null>(null);

  /*
   * Load the faces as soon as the card is actually on screen.
   *
   * These were loaded on hover, which meant every card sat in a fallback face
   * until pointed at - so the previews appeared to render one by one as the
   * cursor moved over them, and the whole point of a pairing card is how the
   * two faces sit together. Hover is also unreachable on touch.
   *
   * Loading all of them up front is the other extreme: the gallery pages 12 at
   * a time out of 135 presets, and each card wants two families. Observing
   * visibility asks for exactly the ones being looked at, which is what hover
   * was approximating.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Without IntersectionObserver, fall back to loading immediately - a
    // missing preview is worse than an eager fetch.
    if (typeof IntersectionObserver === 'undefined') {
      void preloadFontsForPicker([base.id, hero.id]);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        void preloadFontsForPicker([base.id, hero.id]);
        observer.disconnect();
      },
      // Start slightly before the card scrolls in, so type is already there.
      { rootMargin: '120px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [base.id, hero.id]);

  return (
    <button
      ref={ref}
      onClick={onSelect}
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
