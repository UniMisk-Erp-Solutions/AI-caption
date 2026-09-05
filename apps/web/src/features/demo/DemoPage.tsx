import {
  PRESET_IDS,
  PRESET_TAGS,
  artDirectionSchema,
  autoDesign,
  editorStateSchema,
  estimateTimings,
  getFont,
  getPreset,
  groupIntoScenes,
  renderFrame,
  type EditorState,
  type PresetId,
} from '@kc/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ensureDesignFonts } from '../../fonts/fonts';
import { cn } from '../../lib/cn';

/**
 * The style gallery.
 *
 * Every preset laid out over the same sentence by the real renderer - the
 * fastest way to see what the tool makes without uploading anything, and a
 * visual regression check: if the composer or renderer breaks, it shows here
 * first.
 *
 * Paginated deliberately. Composing all 135 presets in one pass blocks the main
 * thread long enough that the page renders blank, which is exactly what
 * happened the first time the registry grew past nine.
 */

const SAMPLES = [
  'a holiday in my life as a girl in new york city',
  'what I actually learned this year was that consistency matters more than motivation',
  'how to keep your nine to five fun',
  'these are all of my favourite jewellery brands right now',
];

const BACKDROPS = [
  'linear-gradient(160deg, #2a2018 0%, #6b4c35 45%, #1a1410 100%)',
  'linear-gradient(200deg, #101a24 0%, #2d4356 50%, #0b0f14 100%)',
  'linear-gradient(140deg, #241a24 0%, #5c3a4d 45%, #140f14 100%)',
  'linear-gradient(180deg, #1d2118 0%, #4a5a3a 50%, #0f120c 100%)',
];

const PAGE_SIZE = 12;

export function DemoPage() {
  const params = new URLSearchParams(window.location.search);

  const [sampleIndex, setSampleIndex] = useState(() => {
    const requested = Number(params.get('s'));
    return Number.isInteger(requested) && requested >= 0 && requested < SAMPLES.length ? requested : 0;
  });
  const [tag, setTag] = useState<string | null>(params.get('tag'));
  const [page, setPage] = useState(0);

  const sample = SAMPLES[sampleIndex];

  const filtered = useMemo(
    () => (tag ? PRESET_IDS.filter((id) => getPreset(id).tags.includes(tag)) : PRESET_IDS),
    [tag],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  // Only the presets on screen are composed - twelve layouts per render rather
  // than a hundred and thirty-five.
  const states = useMemo(() => {
    const words = estimateTimings(sample, { durationMs: 8000 });

    return visible.map((presetId) => {
      const preset = getPreset(presetId);
      const direction = artDirectionSchema.parse({
        preset: presetId,
        palette: preset.palette,
        motionLevel: preset.motionLevel,
        rotationLevel: preset.rotationBudget,
      });
      const groups = groupIntoScenes(words, { targetWords: preset.sceneWordTarget });
      const scenes = autoDesign(words, direction, { width: 1080, height: 1920 }, groups);

      return {
        presetId,
        state: editorStateSchema.parse({
          version: 1,
          project: { width: 1080, height: 1920, fps: 30, durationMs: 8000 },
          transcript: { language: 'en', contentType: 'speech', words },
          design: { direction, scenes },
          revision: 1,
          updatedAt: Date.now(),
        }),
      };
    });
  }, [sample, visible]);

  useEffect(() => setPage(0), [tag]);

  return (
    <div className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl leading-none text-ink-100 sm:text-4xl">
            Style gallery
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">
            {PRESET_IDS.length} font pairings, drawn by the real renderer. One word
            per screen is promoted to the pairing&rsquo;s display face &mdash; that
            promotion is the whole look, and every part of it is editable.
          </p>
        </div>
        <Link className="btn-primary shrink-0" to="/new">
          Try it on a video
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {SAMPLES.map((text, index) => (
          <button
            key={text}
            onClick={() => setSampleIndex(index)}
            className={cn(
              'min-w-0 max-w-full shrink truncate rounded border px-2.5 py-1.5 text-[11px] transition sm:max-w-[260px]',
              index === sampleIndex
                ? 'border-accent bg-accent/15 text-accent-soft'
                : 'border-ink-700 bg-ink-850 text-ink-400 hover:border-ink-500',
            )}
          >
            &ldquo;{text}&rdquo;
          </button>
        ))}
      </div>

      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        <TagChip active={!tag} onClick={() => setTag(null)}>
          All {PRESET_IDS.length}
        </TagChip>
        {PRESET_TAGS.map((t) => (
          <TagChip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
            {t}
          </TagChip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {states.map(({ presetId, state }, index) => (
          <PresetPreview
            key={presetId}
            presetId={presetId}
            state={state}
            backdrop={BACKDROPS[(page * PAGE_SIZE + index) % BACKDROPS.length]}
          />
        ))}
      </div>

      {pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3">
          <button
            className="btn-outline"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="text-xs tabular-nums text-ink-500">
            {page + 1} / {pageCount}
          </span>
          <button
            className="btn-outline"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
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
        'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] transition',
        active
          ? 'border-accent bg-accent/15 text-accent-soft'
          : 'border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200',
      )}
    >
      {children}
    </button>
  );
}

function PresetPreview({
  presetId,
  state,
  backdrop,
}: {
  presetId: PresetId;
  state: EditorState;
  backdrop: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const preset = getPreset(presetId);
  const scenes = state.design.scenes;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // The faces must be resident before the first measureText, or the layout
      // is computed against a fallback and everything shifts once they load.
      await ensureDesignFonts(state);
      if (cancelled) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const scene = scenes[sceneIndex];
      if (!scene) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(canvas.width / state.project.width, canvas.width / state.project.width);

      // Render late in the scene: lines enter as their first word is spoken, so
      // sampling early would show a half-assembled composition.
      const settled = scene.startMs + (scene.endMs - scene.startMs) * 0.88;
      renderFrame(ctx, state, settled, state.project.width, state.project.height);
    })();

    return () => {
      cancelled = true;
    };
  }, [state, sceneIndex, scenes]);

  const hero = getFont(preset.voices.hero.fontId);
  const base = getFont(preset.voices.base.fontId);

  return (
    <figure className="overflow-hidden rounded-lg border border-ink-800 bg-ink-900">
      <div className="relative aspect-[9/16]" style={{ background: backdrop }}>
        <canvas ref={canvasRef} width={432} height={768} className="absolute inset-0 h-full w-full" />
      </div>

      <figcaption className="border-t border-ink-800 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-ink-200">{preset.label}</span>
          <div className="flex shrink-0 gap-0.5">
            {scenes.map((scene, i) => (
              <button
                key={scene.id}
                onClick={() => setSceneIndex(i)}
                className={cn(
                  'h-2 w-2 rounded-full transition',
                  i === sceneIndex ? 'bg-accent' : 'bg-ink-700 hover:bg-ink-500',
                )}
                aria-label={`Scene ${i + 1}`}
              />
            ))}
          </div>
        </div>
        <p className="mt-1 truncate text-[10px] text-ink-600">
          {base.family} + {hero.family}
        </p>
      </figcaption>
    </figure>
  );
}
