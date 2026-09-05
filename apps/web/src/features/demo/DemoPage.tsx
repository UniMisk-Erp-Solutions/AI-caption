import {
  PRESET_REGISTRY,
  artDirectionSchema,
  autoDesign,
  editorStateSchema,
  estimateTimings,
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
 * Every preset, laid out over the same sentence, rendered by the real engine —
 * this is the fastest way to see what the tool actually makes without
 * uploading anything, and it doubles as a visual regression check: if the
 * composer or renderer breaks, it is obvious here first.
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

export function DemoPage() {
  // ?s=2 selects a sample, so a particular layout can be linked to directly.
  const [sampleIndex, setSampleIndex] = useState(() => {
    const requested = Number(new URLSearchParams(window.location.search).get('s'));
    return Number.isInteger(requested) && requested >= 0 && requested < SAMPLES.length ? requested : 0;
  });
  const sample = SAMPLES[sampleIndex];

  const states = useMemo(() => {
    const words = estimateTimings(sample, { durationMs: 8000 });

    return (Object.keys(PRESET_REGISTRY) as PresetId[]).map((presetId) => {
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
  }, [sample]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none text-ink-100">Style gallery</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">
            The same sentence through every preset, drawn by the real renderer.
            One word per screen is promoted to the pairing's display face — that
            promotion is the whole look, and it is fully editable.
          </p>
        </div>
        <Link className="btn-primary" to="/new">
          Try it on a video
        </Link>
      </header>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {SAMPLES.map((text, index) => (
          <button
            key={text}
            onClick={() => setSampleIndex(index)}
            className={cn(
              'max-w-[280px] truncate rounded border px-2.5 py-1.5 text-[11px] transition',
              index === sampleIndex
                ? 'border-accent bg-accent/15 text-accent-soft'
                : 'border-ink-700 bg-ink-850 text-ink-400 hover:border-ink-500',
            )}
          >
            “{text}”
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {states.map(({ presetId, state }, index) => (
          <PresetPreview
            key={presetId}
            presetId={presetId}
            state={state}
            backdrop={BACKDROPS[index % BACKDROPS.length]}
          />
        ))}
      </div>
    </div>
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
                  'h-1.5 w-1.5 rounded-full transition',
                  i === sceneIndex ? 'bg-accent' : 'bg-ink-700 hover:bg-ink-500',
                )}
                aria-label={`Scene ${i + 1}`}
              />
            ))}
          </div>
        </div>
        <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-ink-600">
          {preset.description}
        </p>
      </figcaption>
    </figure>
  );
}
