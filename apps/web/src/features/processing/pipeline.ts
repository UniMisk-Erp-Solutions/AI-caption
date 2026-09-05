import {
  AI_LIMITS,
  artDirectionSchema,
  autoDesign,
  editorStateSchema,
  estimateTimings,
  expandAiDesign,
  getPreset,
  groupIntoScenes,
  reconcileTranscript,
  repairMonotonicity,
  type ArtDirection,
  type ContentType,
  type EditorState,
  type PresetId,
  type TranscriptWord,
} from '@kc/shared';
import { generateDesign, transcribeAudio, analyzeAudio } from '../../lib/api';
import { hasApi } from '../../lib/env';
import { extractAudioForTranscription } from '../../media/audio';
import { extractSceneFrames, releaseFrames } from '../../media/frames';
import type { MediaInfo } from '../../media/probe';

/**
 * The processing pipeline.
 *
 * Runs once per upload, and its defining property is that every stage degrades
 * instead of failing:
 *
 *   no API configured   -> estimated timings from pasted text
 *   transcription fails -> retry, then pasted text, then abort with a message
 *   verification fails  -> keep the timed transcript as-is
 *   design fails        -> the deterministic designer, which is already good
 *
 * The user should never end up staring at an error page holding a video they
 * cannot caption. Something always comes out the other end.
 */

export type StepId = 'probe' | 'audio' | 'transcribe' | 'verify' | 'frames' | 'design' | 'ready';
export type StepStatus = 'pending' | 'active' | 'done' | 'skipped' | 'failed';

export interface StepState {
  id: StepId;
  label: string;
  status: StepStatus;
  detail?: string;
  progress?: number;
}

export const INITIAL_STEPS: StepState[] = [
  { id: 'probe', label: 'Reading media', status: 'pending' },
  { id: 'audio', label: 'Extracting audio', status: 'pending' },
  { id: 'transcribe', label: 'Creating transcript', status: 'pending' },
  { id: 'verify', label: 'Understanding speech', status: 'pending' },
  { id: 'frames', label: 'Analysing composition', status: 'pending' },
  { id: 'design', label: 'Designing captions', status: 'pending' },
  { id: 'ready', label: 'Preparing editor', status: 'pending' },
];

export interface PipelineInput {
  projectId: string;
  file: Blob;
  media: MediaInfo;
  /** How the user described the audio on the upload screen. */
  mode: 'auto' | 'speech' | 'song';
  /** Optional exact words, which become the text authority when present. */
  userTranscript?: string;
  /** 'AUTO' lets the model pick. */
  style: PresetId | 'AUTO';
}

export interface PipelineResult {
  state: EditorState;
  warnings: string[];
}

type Reporter = (steps: StepState[]) => void;

class StepTracker {
  private steps = INITIAL_STEPS.map((s) => ({ ...s }));

  constructor(private readonly report: Reporter) {
    this.emit();
  }

  set(id: StepId, patch: Partial<StepState>): void {
    this.steps = this.steps.map((s) => (s.id === id ? { ...s, ...patch } : s));
    this.emit();
  }

  private emit(): void {
    this.report(this.steps.map((s) => ({ ...s })));
  }
}

export async function runPipeline(
  input: PipelineInput,
  report: Reporter,
  signal?: AbortSignal,
): Promise<PipelineResult> {
  const tracker = new StepTracker(report);
  const warnings: string[] = [];
  const dims = { width: input.media.width, height: input.media.height };

  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  };

  /* -------------------------------------------------- probe -------- */
  tracker.set('probe', { status: 'active' });
  if (!input.media.decodable) {
    warnings.push('Your browser cannot decode this file, so preview and export may not work.');
  }
  tracker.set('probe', {
    status: 'done',
    detail: `${input.media.width}x${input.media.height} · ${(input.media.durationMs / 1000).toFixed(1)}s`,
  });

  /* -------------------------------------------------- transcript --- */
  let words: TranscriptWord[] = [];
  let language = 'en';
  let contentType: ContentType = 'unknown';
  let mood = '';

  const canUseAi = hasApi && input.media.hasAudio;

  if (canUseAi) {
    tracker.set('audio', { status: 'active' });
    let audio: Blob | null = null;
    try {
      const extracted = await extractAudioForTranscription(input.file, (p) =>
        tracker.set('audio', { status: 'active', progress: p }),
      );
      audio = extracted.blob;
      tracker.set('audio', {
        status: 'done',
        detail: `${(extracted.blob.size / 1024 / 1024).toFixed(1)} MB · ${extracted.sampleRate / 1000} kHz mono`,
      });
    } catch (error) {
      tracker.set('audio', { status: 'failed', detail: describe(error) });
      warnings.push('Could not extract audio from this video.');
    }

    throwIfAborted();

    if (audio) {
      tracker.set('transcribe', { status: 'active' });
      try {
        const result = await retry(
          () => transcribeAudio(input.projectId, audio!, { mode: input.mode }, signal),
          1,
        );
        words = repairMonotonicity(result.words);
        language = result.language || 'en';
        tracker.set('transcribe', { status: 'done', detail: `${words.length} words` });
      } catch (error) {
        tracker.set('transcribe', { status: 'failed', detail: describe(error) });
        warnings.push('Transcription failed. You can paste the words in the transcript panel.');
      }

      throwIfAborted();

      /* ------------------------------------------- verification ---- */
      if (words.length > 0) {
        tracker.set('verify', { status: 'active' });
        try {
          const analysis = await analyzeAudio(
            input.projectId,
            audio,
            {
              mode: input.mode,
              timedText: words.map((w) => w.text).join(' '),
              userLyrics: input.userTranscript,
            },
            signal,
          );

          contentType = analysis.contentType;
          mood = analysis.mood;
          if (analysis.language) language = analysis.language;

          if (analysis.correctedText.trim().length > 0) {
            const reconciled = reconcileTranscript(words, analysis.correctedText);
            words = reconciled.words;
            tracker.set('verify', {
              status: 'done',
              detail: `${analysis.contentType} · ${reconciled.changed} words corrected`,
            });
          } else {
            tracker.set('verify', { status: 'done', detail: analysis.contentType });
          }
        } catch (error) {
          // Verification is an enhancement. Losing it costs accuracy on sung
          // audio, but the timed transcript on its own is perfectly usable.
          tracker.set('verify', { status: 'skipped', detail: describe(error) });
        }
      }
    }
  } else {
    tracker.set('audio', { status: 'skipped', detail: hasApi ? 'no audio track' : 'local mode' });
    tracker.set('transcribe', { status: 'skipped', detail: 'local mode' });
    tracker.set('verify', { status: 'skipped' });
  }

  /* ---- fall back to the user's own words with estimated timings ---- */
  if (words.length === 0) {
    if (input.userTranscript && input.userTranscript.trim().length > 0) {
      words = estimateTimings(input.userTranscript, { durationMs: input.media.durationMs });
      tracker.set('transcribe', {
        status: 'done',
        detail: `${words.length} words · timings estimated`,
      });
      warnings.push(
        'Timings are estimated from your text. Drag words in the transcript panel to line them up.',
      );
    } else {
      tracker.set('transcribe', { status: 'skipped', detail: 'no transcript yet' });
      warnings.push('No transcript yet. Add your words in the transcript panel to generate captions.');
    }
  }

  throwIfAborted();

  /* -------------------------------------------------- direction ---- */
  const presetId: PresetId =
    input.style === 'AUTO' ? presetForContent(contentType, input.media) : input.style;
  const preset = getPreset(presetId);

  const direction: ArtDirection = artDirectionSchema.parse({
    preset: presetId,
    palette: preset.palette,
    motionLevel: preset.motionLevel,
    rotationLevel: preset.rotationBudget,
  });

  const groups = groupIntoScenes(words, { targetWords: preset.sceneWordTarget });

  /* -------------------------------------------------- frames ------- */
  let frames: Awaited<ReturnType<typeof extractSceneFrames>> = [];
  const wantFrames = canUseAi && groups.length > 0;

  if (wantFrames) {
    tracker.set('frames', { status: 'active' });
    try {
      // Long videos would blow past the model's useful image budget, so sample
      // evenly across the timeline rather than truncating to the first N.
      const sampled = sampleEvenly(groups, AI_LIMITS.maxFramesPerRequest);
      frames = await extractSceneFrames(
        input.file,
        sampled.map((g) => ({ sceneId: g.id, timestampMs: g.keyframeTimestampMs })),
        (done, total) => tracker.set('frames', { status: 'active', progress: done / total }),
      );
      tracker.set('frames', { status: 'done', detail: `${frames.length} keyframes` });
    } catch (error) {
      tracker.set('frames', { status: 'skipped', detail: describe(error) });
    }
  } else {
    tracker.set('frames', { status: 'skipped', detail: canUseAi ? 'no scenes' : 'local mode' });
  }

  throwIfAborted();

  /* -------------------------------------------------- design ------- */
  tracker.set('design', { status: 'active' });

  // Always compute the deterministic design first. It is what we show if the
  // model is slow, unavailable or returns something that fails validation - and
  // because it uses the same composer, it is a real design, not a placeholder.
  let scenes = autoDesign(words, direction, dims, groups);

  if (canUseAi && groups.length > 0) {
    try {
      const framesById = new Map(frames.map((f) => [f.sceneId, f]));
      const ai = await generateDesign(
        {
          projectId: input.projectId,
          dimensions: dims,
          style: input.style,
          contentType,
          mood,
          scenes: groups.map((group) => ({
            id: group.id,
            startMs: group.startMs,
            endMs: group.endMs,
            words: group.wordIds.map((id) => {
              const word = words.find((w) => w.id === id);
              return { id, text: word?.text ?? '' };
            }),
            frame: framesById.get(group.id)?.base64,
          })),
        },
        signal,
      );

      const aiDirection = artDirectionSchema.parse({
        ...direction,
        preset: ai.direction.preset,
        palette: getPreset(ai.direction.preset).palette,
        baseFont: ai.direction.baseFont ?? null,
        heroFont: ai.direction.heroFont ?? null,
        accentFont: ai.direction.accentFont ?? null,
        motionLevel: ai.direction.motionLevel ?? getPreset(ai.direction.preset).motionLevel,
        rotationLevel: ai.direction.rotationLevel ?? getPreset(ai.direction.preset).rotationBudget,
        heroContrast: ai.direction.heroContrast ?? 1,
        note: ai.direction.note ?? '',
      });

      scenes = expandAiDesign(ai, aiDirection, { dims, words, groups });
      Object.assign(direction, aiDirection);

      tracker.set('design', { status: 'done', detail: `${aiDirection.preset} · ${scenes.length} scenes` });
    } catch (error) {
      tracker.set('design', {
        status: 'skipped',
        detail: `${describe(error)} — used the built-in designer`,
      });
      warnings.push('AI design was unavailable, so captions were laid out by the built-in designer.');
    }
  } else {
    tracker.set('design', { status: 'done', detail: `${presetId} · built-in designer` });
  }

  // Fold the measured frame brightness in, so contrast is right even when the
  // model did not report a backdrop luma for a scene.
  const lumaById = new Map(frames.map((f) => [f.sceneId, f.luma]));
  scenes = scenes.map((scene) => {
    const luma = lumaById.get(scene.id);
    return luma === undefined ? scene : { ...scene, backdropLuma: luma };
  });

  releaseFrames(frames);

  /* -------------------------------------------------- assemble ----- */
  tracker.set('ready', { status: 'active' });

  const state = editorStateSchema.parse({
    version: 1,
    project: {
      width: input.media.width,
      height: input.media.height,
      fps: input.media.fps,
      durationMs: input.media.durationMs,
    },
    transcript: { language, contentType, words },
    design: { direction, scenes },
    revision: 1,
    updatedAt: Date.now(),
  });

  tracker.set('ready', { status: 'done' });
  return { state, warnings };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Match the default look to what we heard, when the user did not choose. */
function presetForContent(contentType: ContentType, media: MediaInfo): PresetId {
  const portrait = media.height >= media.width;
  if (contentType === 'song') return portrait ? 'SCRIPT_EDITORIAL' : 'CINEMATIC';
  if (contentType === 'instrumental') return 'CINEMATIC';
  return 'SCRIPT_EDITORIAL';
}

function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  return Array.from({ length: max }, (_, i) => items[Math.floor(i * step)]);
}

async function retry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      if (i < attempts) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastError;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 120);
  return 'Unknown error';
}
