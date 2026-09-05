import { estimateLayerWidth } from '../layout/compose';
import type { CaptionLayer, CaptionScene, EditorState } from '../schemas/editor';
import {
  contrastFor,
  faceOverlap,
  hexLuma,
  regionBusyness,
  subjectOverlap,
  type FrameMap,
  type Rect,
} from '../vision/frameMap';

/**
 * Design scorecard.
 *
 * Caption quality is easy to argue about and hard to agree on, so this turns it
 * into numbers that can be compared between runs. Every check below exists
 * because it caught a real defect:
 *
 *   coverage     a transcript that stopped at 70% of the audio and reported
 *                success, leaving four seconds silently uncaptioned
 *   faceOverlap  text placed straight across a face because the region the
 *                model reported was invented
 *   contrast     white type on a blown-out area, invisible in the export
 *   continuity   the block teleporting between corners on consecutive scenes
 *
 * Run before and after a change: a regression in any metric is visible rather
 * than a matter of opinion.
 */

export interface ScoreInput {
  state: EditorState;
  /** One merged map per scene, keyed by scene id. Optional but recommended. */
  frameMaps?: Map<string, FrameMap>;
  /** Duration of actual speech, if known. Defaults to the project duration. */
  speechEndMs?: number;
}

export interface MetricResult {
  id: string;
  label: string;
  /** 0..1, higher is better. */
  value: number;
  /** Below this counts as a failure. */
  target: number;
  pass: boolean;
  detail: string;
}

export interface Scorecard {
  overall: number;
  passed: number;
  total: number;
  metrics: MetricResult[];
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/**
 * Approximate on-screen rect of a layer.
 *
 * Deliberately the same estimate the composer uses, so the score reflects what
 * the layout engine believed it was doing. Exact metrics need a canvas, which
 * this module must not depend on.
 */
export function layerRect(layer: CaptionLayer, width: number, height: number): Rect {
  const w = Math.min(layer.maxWidth, estimateLayerWidth(layer, height) / width);
  const tallest = layer.runs.reduce((m, r) => Math.max(m, r.sizeScale), 1);
  const h = layer.fontSize * layer.lineHeight * tallest;

  const left =
    layer.textAlign === 'left' ? layer.x : layer.textAlign === 'right' ? layer.x - w : layer.x - w / 2;

  return { x: left, y: layer.y - h * 0.8, width: w, height: h * 1.1 };
}

/** Mean text luminance of a layer, weighted by how much text each run holds. */
function layerTextLuma(layer: CaptionLayer): number {
  let total = 0;
  let weight = 0;
  for (const run of layer.runs) {
    const w = Math.max(1, run.text.length);
    total += hexLuma(run.color) * w;
    weight += w;
  }
  return weight > 0 ? total / weight : 1;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export function scoreDesign(input: ScoreInput): Scorecard {
  const { state, frameMaps } = input;
  const { width, height, durationMs } = state.project;
  const scenes = state.design.scenes;
  const words = state.transcript.words;

  const metrics: MetricResult[] = [];

  /* ---- 1. transcript coverage ---- */
  const lastWordEnd = words.length > 0 ? words[words.length - 1].endMs : 0;
  const speechEnd = input.speechEndMs ?? durationMs;
  const coverage = speechEnd > 0 ? Math.min(1, lastWordEnd / speechEnd) : 0;
  metrics.push({
    id: 'coverage',
    label: 'Transcript coverage',
    value: coverage,
    target: 0.92,
    pass: coverage >= 0.92,
    detail: `words end at ${(lastWordEnd / 1000).toFixed(1)}s of ${(speechEnd / 1000).toFixed(1)}s · ${words.length} words`,
  });

  /* ---- 2. caption presence ---- */
  let captioned = 0;
  for (const scene of scenes) captioned += Math.max(0, scene.endMs - scene.startMs);
  const presence = speechEnd > 0 ? Math.min(1, captioned / speechEnd) : 0;
  metrics.push({
    id: 'presence',
    label: 'Time with captions',
    value: presence,
    target: 0.85,
    pass: presence >= 0.85,
    detail: `${(captioned / 1000).toFixed(1)}s covered by ${scenes.length} scenes`,
  });

  /* ---- 3. gaps between scenes ---- */
  let worstGap = 0;
  for (let i = 1; i < scenes.length; i++) {
    worstGap = Math.max(worstGap, scenes[i].startMs - scenes[i - 1].endMs);
  }
  const gapScore = worstGap <= 500 ? 1 : Math.max(0, 1 - (worstGap - 500) / 3000);
  metrics.push({
    id: 'gaps',
    label: 'No dead air',
    value: gapScore,
    target: 0.9,
    pass: gapScore >= 0.9,
    detail: `largest gap between scenes ${worstGap}ms`,
  });

  /* ---- 4-6. anything needing pixels ---- */
  if (frameMaps && frameMaps.size > 0) {
    let faceHits = 0;
    let layerCount = 0;
    let busySum = 0;
    let contrastFails = 0;
    let contrastSum = 0;

    for (const scene of scenes) {
      const map = frameMaps.get(scene.id);
      if (!map) continue;

      for (const layer of scene.layers) {
        const rect = layerRect(layer, width, height);
        layerCount++;

        // Any meaningful overlap with a face is a failure, not a deduction -
        // covering someone's face is the one thing that must never happen.
        if (faceOverlap(map, rect) > 0.06) faceHits++;

        busySum += regionBusyness(map, rect) + subjectOverlap(map, rect) * 0.5;

        const contrast = contrastFor(map, rect, layerTextLuma(layer));
        contrastSum += contrast;
        if (contrast < 0.28) contrastFails++;
      }
    }

    if (layerCount > 0) {
      const faceScore = 1 - faceHits / layerCount;
      metrics.push({
        id: 'faces',
        label: 'Text clear of faces',
        value: faceScore,
        target: 1,
        pass: faceHits === 0,
        detail: faceHits === 0 ? 'no layer overlaps a face' : `${faceHits}/${layerCount} layers cover a face`,
      });

      const clean = 1 - Math.min(1, busySum / layerCount);
      metrics.push({
        id: 'clean',
        label: 'Text on calm areas',
        value: clean,
        target: 0.6,
        pass: clean >= 0.6,
        detail: `mean busyness under text ${(1 - clean).toFixed(2)}`,
      });

      const contrastScore = 1 - contrastFails / layerCount;
      metrics.push({
        id: 'contrast',
        label: 'Legible contrast',
        value: contrastScore,
        target: 0.9,
        pass: contrastScore >= 0.9,
        detail: `${contrastFails}/${layerCount} layers below threshold · mean ${(contrastSum / layerCount).toFixed(2)}`,
      });
    }
  }

  /* ---- 7. continuity ---- */
  if (scenes.length > 1) {
    let jumps = 0;
    let moved = 0;
    for (let i = 1; i < scenes.length; i++) {
      const a = anchorOf(scenes[i - 1]);
      const b = anchorOf(scenes[i]);
      if (!a || !b) continue;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      moved++;
      // Corner to opposite corner between consecutive scenes reads as an error.
      if (distance > 0.6) jumps++;
    }
    const continuity = moved > 0 ? 1 - jumps / moved : 1;
    metrics.push({
      id: 'continuity',
      label: 'Stable placement',
      value: continuity,
      target: 0.75,
      pass: continuity >= 0.75,
      detail: `${jumps}/${moved} scene transitions jump across the frame`,
    });
  }

  /* ---- 8. composition variety ---- */
  if (scenes.length > 1) {
    let repeats = 0;
    for (let i = 1; i < scenes.length; i++) {
      if (scenes[i].compositionId === scenes[i - 1].compositionId) repeats++;
    }
    const variety = 1 - repeats / (scenes.length - 1);
    metrics.push({
      id: 'variety',
      label: 'Composition variety',
      value: variety,
      target: 0.7,
      pass: variety >= 0.7,
      detail: `${repeats} consecutive repeats across ${scenes.length} scenes`,
    });
  }

  const passed = metrics.filter((m) => m.pass).length;
  const overall = metrics.length > 0 ? metrics.reduce((a, m) => a + m.value, 0) / metrics.length : 0;

  return { overall, passed, total: metrics.length, metrics };
}

function anchorOf(scene: CaptionScene): { x: number; y: number } | null {
  const hero = scene.layers.find((l) => l.role === 'hero') ?? scene.layers[0];
  return hero ? { x: hero.x, y: hero.y } : null;
}

/** One-line-per-metric report, for logs and the harness. */
export function formatScorecard(card: Scorecard): string {
  const lines = card.metrics.map(
    (m) =>
      `  ${m.pass ? 'PASS' : 'FAIL'}  ${m.label.padEnd(24)} ${m.value.toFixed(2)} (target ${m.target.toFixed(2)})  ${m.detail}`,
  );
  return [
    `SCORE ${(card.overall * 100).toFixed(0)}% · ${card.passed}/${card.total} checks passed`,
    ...lines,
  ].join('\n');
}
