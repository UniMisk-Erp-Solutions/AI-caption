/**
 * Frame measurement.
 *
 * The original design asked Gemma where the face and the empty space were. It
 * answered with round numbers - `x: 0.20, y: 0.00, w: 0.60, h: 0.80` - because a
 * language model cannot measure pixels; it pattern-matches "the subject is
 * probably in the middle". On one test frame it put the subject on the left when
 * the face was on the right.
 *
 * So measurement moved to the browser, which has the actual pixels and can do
 * this exactly, for free, in about a millisecond. Gemma keeps the job it is
 * genuinely good at - which words matter - and is *given* the geometry instead
 * of being asked to invent it.
 *
 * This file is the provider-independent half: the data shape and the queries
 * the layout engine runs against it. The canvas code that fills it in lives in
 * the web app, because it needs a real 2D context.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ShotType =
  /** A face fills much of the frame. Text must stay well clear. */
  | 'closeup'
  /** A person or object is clearly the subject, with room around it. */
  | 'medium'
  /** Subject is small in frame; there is real space to work with. */
  | 'wide'
  /** No dominant subject - landscape, texture, abstract. Type can be bold. */
  | 'empty';

export interface FrameMap {
  timestampMs: number;
  cols: number;
  rows: number;
  /** Edge/detail energy per cell, 0..1. High means visually busy. */
  busy: Float32Array;
  /** Mean luminance per cell, 0..1. */
  luma: Float32Array;
  /** Fraction of skin-toned pixels per cell, 0..1. */
  skin: Float32Array;
  /** Detected face-like regions, normalised. */
  faces: Rect[];
  /** The dominant subject region, normalised. Null when the frame is flat. */
  subject: Rect | null;
  shot: ShotType;
}

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

export function emptyFrameMap(cols = 32, rows = 24, timestampMs = 0): FrameMap {
  return {
    timestampMs,
    cols,
    rows,
    busy: new Float32Array(cols * rows),
    luma: new Float32Array(cols * rows).fill(0.5),
    skin: new Float32Array(cols * rows),
    faces: [],
    subject: null,
    shot: 'empty',
  };
}

/**
 * Combine several frames from one scene into a single conservative map.
 *
 * Takes the maximum busyness and skin per cell and the union of faces, so a
 * subject that moves during the scene is avoided across its whole path rather
 * than only where it happened to be at the sampled instant. This is the fix for
 * text that looks well placed on the keyframe and is covered two seconds later.
 */
export function mergeFrameMaps(maps: FrameMap[]): FrameMap {
  const usable = maps.filter((m) => m.cols > 0 && m.rows > 0);
  if (usable.length === 0) return emptyFrameMap();
  if (usable.length === 1) return usable[0];

  const base = usable[0];
  const out = emptyFrameMap(base.cols, base.rows, base.timestampMs);

  for (let i = 0; i < out.busy.length; i++) {
    let busy = 0;
    let skin = 0;
    let luma = 0;
    for (const map of usable) {
      busy = Math.max(busy, map.busy[i] ?? 0);
      skin = Math.max(skin, map.skin[i] ?? 0);
      luma += map.luma[i] ?? 0.5;
    }
    out.busy[i] = busy;
    out.skin[i] = skin;
    out.luma[i] = luma / usable.length;
  }

  // Three samples of the same face are one face. Without merging, a metric
  // like "does any layer overlap a face" counts the same head three times.
  out.faces = mergeOverlapping(usable.flatMap((m) => m.faces));
  out.subject = usable.reduce<Rect | null>(
    (acc, m) => (m.subject && (!acc || area(m.subject) > area(acc)) ? m.subject : acc),
    null,
  );
  // The tightest classification wins: if any sampled moment is a close-up, the
  // scene has to be treated as one.
  const rank: ShotType[] = ['empty', 'wide', 'medium', 'closeup'];
  out.shot = usable.reduce<ShotType>(
    (acc, m) => (rank.indexOf(m.shot) > rank.indexOf(acc) ? m.shot : acc),
    'empty',
  );

  return out;
}

const area = (r: Rect) => r.width * r.height;

/**
 * Collapse rects that substantially overlap into their union.
 *
 * Used when combining several sampled moments of one scene: the same subject
 * appears in each, and the layout wants one region to avoid, not three.
 */
export function mergeOverlapping(rects: Rect[], threshold = 0.35): Rect[] {
  const out: Rect[] = [];

  for (const rect of rects) {
    const hit = out.findIndex((existing) => {
      const overlap = intersectionArea(existing, rect);
      return overlap / Math.max(1e-6, Math.min(area(existing), area(rect))) > threshold;
    });

    if (hit < 0) {
      out.push({ ...rect });
      continue;
    }

    const e = out[hit];
    const x0 = Math.min(e.x, rect.x);
    const y0 = Math.min(e.y, rect.y);
    const x1 = Math.max(e.x + e.width, rect.x + rect.width);
    const y1 = Math.max(e.y + e.height, rect.y + rect.height);
    out[hit] = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

function cellRange(map: FrameMap, rect: Rect) {
  const c0 = Math.max(0, Math.floor(rect.x * map.cols));
  const c1 = Math.min(map.cols - 1, Math.ceil((rect.x + rect.width) * map.cols) - 1);
  const r0 = Math.max(0, Math.floor(rect.y * map.rows));
  const r1 = Math.min(map.rows - 1, Math.ceil((rect.y + rect.height) * map.rows) - 1);
  return { c0, c1, r0, r1 };
}

function sample(map: FrameMap, rect: Rect, channel: 'busy' | 'luma' | 'skin'): number[] {
  const { c0, c1, r0, r1 } = cellRange(map, rect);
  const values: number[] = [];
  const data = map[channel];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) values.push(data[r * map.cols + c] ?? 0);
  }
  return values;
}

const mean = (v: number[]) => (v.length === 0 ? 0 : v.reduce((a, b) => a + b, 0) / v.length);

/** Mean detail energy under a rect. High means text there will be hard to read. */
export function regionBusyness(map: FrameMap, rect: Rect): number {
  return mean(sample(map, rect, 'busy'));
}

/** Mean luminance under a rect, 0 dark .. 1 blown out. */
export function regionLuma(map: FrameMap, rect: Rect): number {
  const values = sample(map, rect, 'luma');
  return values.length === 0 ? 0.5 : mean(values);
}

/**
 * Luminance spread under a rect.
 *
 * A region can be mid-grey on average while alternating black and white, which
 * is the worst case for legibility and invisible to a mean. Text over a high
 * spread needs a shadow or a scrim no matter what its colour is.
 */
export function regionLumaSpread(map: FrameMap, rect: Rect): number {
  const values = sample(map, rect, 'luma');
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

export function regionSkin(map: FrameMap, rect: Rect): number {
  return mean(sample(map, rect, 'skin'));
}

/** Fraction of `rect` covered by any detected face, 0..1. */
export function faceOverlap(map: FrameMap, rect: Rect): number {
  if (map.faces.length === 0) return 0;
  const total = area(rect);
  if (total <= 0) return 0;
  let covered = 0;
  for (const face of map.faces) covered += intersectionArea(rect, face);
  return Math.min(1, covered / total);
}

export function subjectOverlap(map: FrameMap, rect: Rect): number {
  if (!map.subject) return 0;
  const total = area(rect);
  return total <= 0 ? 0 : Math.min(1, intersectionArea(rect, map.subject) / total);
}

export function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Contrast between a text colour and the backdrop under it, 0..1.
 *
 * Uses the luma difference penalised by the backdrop's own spread, because
 * white text on an evenly dark area is legible while white text on a
 * high-contrast jumble is not, even at the same average brightness.
 */
export function contrastFor(map: FrameMap, rect: Rect, textLuma: number): number {
  const backdrop = regionLuma(map, rect);
  const spread = regionLumaSpread(map, rect);
  return Math.max(0, Math.abs(textLuma - backdrop) - spread * 0.8);
}

/** Relative luminance of a hex colour, 0..1. */
export function hexLuma(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* ------------------------------------------------------------------ */
/* Describing a frame to the model                                     */
/* ------------------------------------------------------------------ */

/**
 * A short factual description of the frame, sent to Gemma alongside the image.
 *
 * This is the whole point of measuring locally: rather than asking the model to
 * guess where the face is, we tell it, and it spends its attention on meaning
 * instead.
 */
export function describeFrame(map: FrameMap): string {
  const parts: string[] = [`shot: ${map.shot}`];

  if (map.faces.length > 0) {
    parts.push(
      `faces: ${map.faces.map((f) => `[${pct(f.x)},${pct(f.y)},${pct(f.width)},${pct(f.height)}]`).join(' ')}`,
    );
  } else {
    parts.push('faces: none detected');
  }

  if (map.subject) {
    const s = map.subject;
    parts.push(`subject: [${pct(s.x)},${pct(s.y)},${pct(s.width)},${pct(s.height)}]`);
  }

  const free = freeRegions(map, 3);
  if (free.length > 0) {
    parts.push(
      `clearest areas: ${free
        .map((f) => `${f.label} (luma ${f.luma.toFixed(2)})`)
        .join(', ')}`,
    );
  }

  return parts.join(' · ');
}

const pct = (v: number) => v.toFixed(2);

const THIRDS: Array<{ label: string; rect: Rect }> = [
  { label: 'top-left', rect: { x: 0, y: 0, width: 0.34, height: 0.34 } },
  { label: 'top-centre', rect: { x: 0.33, y: 0, width: 0.34, height: 0.34 } },
  { label: 'top-right', rect: { x: 0.66, y: 0, width: 0.34, height: 0.34 } },
  { label: 'mid-left', rect: { x: 0, y: 0.33, width: 0.34, height: 0.34 } },
  { label: 'centre', rect: { x: 0.33, y: 0.33, width: 0.34, height: 0.34 } },
  { label: 'mid-right', rect: { x: 0.66, y: 0.33, width: 0.34, height: 0.34 } },
  { label: 'bottom-left', rect: { x: 0, y: 0.66, width: 0.34, height: 0.34 } },
  { label: 'bottom-centre', rect: { x: 0.33, y: 0.66, width: 0.34, height: 0.34 } },
  { label: 'bottom-right', rect: { x: 0.66, y: 0.66, width: 0.34, height: 0.34 } },
];

/** The calmest thirds of the frame, best first. */
export function freeRegions(
  map: FrameMap,
  count: number,
): Array<{ label: string; rect: Rect; luma: number; cost: number }> {
  return THIRDS.map((t) => ({
    label: t.label,
    rect: t.rect,
    luma: regionLuma(map, t.rect),
    cost:
      regionBusyness(map, t.rect) +
      regionSkin(map, t.rect) * 1.5 +
      faceOverlap(map, t.rect) * 3 +
      subjectOverlap(map, t.rect) * 1.2,
  }))
    .sort((a, b) => a.cost - b.cost)
    .slice(0, count);
}
