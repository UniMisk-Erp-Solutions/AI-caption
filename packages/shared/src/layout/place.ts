import type { CompositionDef, CompositionSlot } from '../design/compositions';
import {
  contrastFor,
  faceOverlap,
  regionBusyness,
  regionLumaSpread,
  subjectOverlap,
  type FrameMap,
  type Rect,
  type ShotType,
} from '../vision/frameMap';

/**
 * Placement solver.
 *
 * The first version could only slide the caption block up and down a fixed
 * ladder of offsets. That fails the moment the subject is a tall figure in the
 * middle of frame: there is no vertical position that clears it, and the actual
 * answer - move to the side - was not in the search space. It produced text
 * sitting directly on a face while reporting success.
 *
 * This searches both axes, scoring candidate positions against what was
 * measured in the frame rather than what a model guessed. It is a small
 * exhaustive search (a few hundred candidates, each a handful of grid lookups),
 * so it stays deterministic and costs well under a millisecond - the same
 * layout comes out for the same frame every time, which the export depends on.
 */

export interface PlacedLine {
  /** Offset from the block anchor, normalised to frame width. */
  offsetX: number;
  /** Offset from the block anchor, normalised to frame height. */
  offsetY: number;
  align: CompositionSlot['align'];
  /** Width of this line, normalised to frame width. */
  width: number;
  /** Height of this line, normalised to frame height. */
  height: number;
}

export interface PlacementRequest {
  lines: PlacedLine[];
  composition: CompositionDef;
  /** Null when no frame analysis is available - the solver then only respects margins. */
  map: FrameMap | null;
  /** Mean luminance of the text, 0..1, for contrast scoring. */
  textLuma: number;
  /** Anchor of the previous scene, so the block does not teleport. */
  previousAnchor?: { x: number; y: number } | null;
}

export interface Placement {
  x: number;
  y: number;
  cost: number;
  /** What the solver believed about this spot, for debugging and the scorecard. */
  faceOverlap: number;
  busyness: number;
  contrast: number;
}

const SAFE = 0.045;

/* ------------------------------------------------------------------ */
/* Shot-aware preferences                                              */
/* ------------------------------------------------------------------ */

/**
 * How each kind of shot wants to be treated.
 *
 * This is the difference between "avoid the subject" and composing like a
 * designer: a close-up wants type pushed firmly to an edge and kept modest,
 * while an empty landscape can carry large type straight through the middle.
 */
interface ShotPolicy {
  /** Extra clearance around faces, as a fraction of the frame. */
  facePadding: number;
  /** Weight on staying away from the subject. */
  subjectWeight: number;
  /** Pull toward the frame centre (negative pushes to the edges). */
  centrePull: number;
  /** Multiplier on the block's size. */
  scale: number;
}

const SHOT_POLICY: Record<ShotType, ShotPolicy> = {
  closeup: { facePadding: 0.06, subjectWeight: 16, centrePull: -1.4, scale: 0.9 },
  medium: { facePadding: 0.04, subjectWeight: 11, centrePull: -0.5, scale: 1 },
  wide: { facePadding: 0.03, subjectWeight: 7, centrePull: 0.4, scale: 1.06 },
  empty: { facePadding: 0.02, subjectWeight: 3, centrePull: 1.1, scale: 1.14 },
};

export function shotPolicy(shot: ShotType | undefined): ShotPolicy {
  return SHOT_POLICY[shot ?? 'medium'];
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

function lineRect(line: PlacedLine, anchorX: number, anchorY: number): Rect {
  const left =
    line.align === 'left'
      ? anchorX + line.offsetX
      : line.align === 'right'
        ? anchorX + line.offsetX - line.width
        : anchorX + line.offsetX - line.width / 2;

  return {
    x: left,
    y: anchorY + line.offsetY - line.height * 0.8,
    width: line.width,
    height: line.height * 1.1,
  };
}

function boundsOf(lines: PlacedLine[], anchorX: number, anchorY: number): Rect {
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  for (const line of lines) {
    const r = lineRect(line, anchorX, anchorY);
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.width);
    y1 = Math.max(y1, r.y + r.height);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function padded(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

/* ------------------------------------------------------------------ */
/* Solver                                                              */
/* ------------------------------------------------------------------ */

export function solvePlacement(request: PlacementRequest): Placement {
  const { lines, composition, map, textLuma } = request;
  if (lines.length === 0) {
    return { x: 0.5, y: 0.5, cost: 0, faceOverlap: 0, busyness: 0, contrast: 1 };
  }

  const policy = shotPolicy(map?.shot);

  // Where the composition would put the block if the frame were empty. Staying
  // near it is preferred but not required - the arrangement is a starting
  // opinion, the frame gets the final say.
  const preferredX = mean(composition.slots.map((s) => s.x));
  const preferredY = composition.anchorY;

  const span = boundsOf(lines, 0, 0);
  // Keep the search inside positions where the block can actually fit.
  const minX = SAFE - span.x;
  const maxX = 1 - SAFE - (span.x + span.width);
  const minY = SAFE - span.y;
  const maxY = 1 - SAFE - (span.y + span.height);

  const xs = candidates(minX, maxX, preferredX, 16);
  const ys = candidates(minY, maxY, preferredY, 16);

  let best: Placement | null = null;

  for (const y of ys) {
    for (const x of xs) {
      const scored = scoreAt(x, y, request, policy, preferredX, preferredY);
      if (!best || scored.cost < best.cost) best = scored;
    }
  }

  return best ?? { x: preferredX, y: preferredY, cost: 0, faceOverlap: 0, busyness: 0, contrast: 1 };
}

function scoreAt(
  x: number,
  y: number,
  request: PlacementRequest,
  policy: ShotPolicy,
  preferredX: number,
  preferredY: number,
): Placement {
  const { lines, map, textLuma, previousAnchor } = request;

  let cost = 0;
  let worstFace = 0;
  let busySum = 0;
  let worstContrast = 1;

  for (const line of lines) {
    const rect = lineRect(line, x, y);

    // Leaving the frame is worse than anything else it could do.
    cost += Math.max(0, SAFE - rect.x) * 120;
    cost += Math.max(0, rect.x + rect.width - (1 - SAFE)) * 120;
    cost += Math.max(0, SAFE - rect.y) * 120;
    cost += Math.max(0, rect.y + rect.height - (1 - SAFE)) * 120;

    if (!map) continue;

    // Faces are close to inviolable: the padding means text has to clear the
    // head, not merely miss it by a pixel.
    const face = faceOverlap(map, padded(rect, policy.facePadding));
    worstFace = Math.max(worstFace, face);
    cost += face * 200;

    const subject = subjectOverlap(map, rect);
    cost += subject * policy.subjectWeight;

    const busy = regionBusyness(map, rect);
    busySum += busy;
    cost += busy * 26;

    // Detail behind text hurts legibility even when average brightness is fine.
    cost += regionLumaSpread(map, rect) * 11;

    const contrast = contrastFor(map, rect, textLuma);
    worstContrast = Math.min(worstContrast, contrast);
    cost += Math.max(0, 0.34 - contrast) * 45;
  }

  // Respect the chosen arrangement unless the frame gives a reason not to.
  cost += Math.hypot(x - preferredX, y - preferredY) * 2.2;

  // Continuity: consecutive scenes should not throw the block across the frame.
  if (previousAnchor) {
    cost += Math.hypot(x - previousAnchor.x, y - previousAnchor.y) * 2.2;
  }

  // Shot-driven pull toward or away from the middle.
  const centreDistance = Math.hypot(x - 0.5, y - 0.5);
  cost += -policy.centrePull * (0.7 - centreDistance);

  // Small reward for sitting near a rule-of-thirds line.
  cost -= thirdsAffinity(x, y) * 1.2;

  return {
    x,
    y,
    cost,
    faceOverlap: worstFace,
    busyness: lines.length > 0 ? busySum / lines.length : 0,
    contrast: worstContrast,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Sample positions across the usable range, always including the composition's
 * own preference so a clear frame reproduces the arrangement exactly.
 */
function candidates(min: number, max: number, preferred: number, steps: number): number[] {
  if (!(max > min)) return [clamp(preferred, 0.05, 0.95)];

  const values = new Set<number>([clamp(preferred, min, max)]);
  for (let i = 0; i <= steps; i++) values.add(min + ((max - min) * i) / steps);
  return [...values];
}

function thirdsAffinity(x: number, y: number): number {
  const near = (v: number) => Math.max(0, 1 - Math.min(Math.abs(v - 1 / 3), Math.abs(v - 2 / 3)) * 8);
  return (near(x) + near(y)) / 2;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0.5 : values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/* ------------------------------------------------------------------ */
/* Composition eligibility                                             */
/* ------------------------------------------------------------------ */

/**
 * Which arrangements suit this shot.
 *
 * A centred stack over a close-up portrait is always wrong, however good the
 * typography is. Filtering the menu before the model or the fallback designer
 * chooses from it is cheaper and more reliable than trying to correct the
 * choice afterwards.
 */
export function compositionsForShot(
  available: readonly string[],
  shot: ShotType | undefined,
  map: FrameMap | null,
): string[] {
  if (!shot || shot === 'empty' || shot === 'wide') return [...available];

  // On a tighter shot, drop arrangements that insist on the middle of frame,
  // unless the subject happens to sit off to one side already.
  const subjectCentred =
    !map?.subject || (map.subject.x < 0.45 && map.subject.x + map.subject.width > 0.55);

  if (!subjectCentred) return [...available];

  const centreHeavy = new Set(['stack-center', 'quote-block']);
  const filtered = available.filter((id) => !centreHeavy.has(id));
  return filtered.length > 0 ? filtered : [...available];
}
