import { emptyFrameMap, type FrameMap, type Rect, type ShotType } from '@kc/shared';

/**
 * Frame analysis on the canvas.
 *
 * Everything here is deliberately cheap and deterministic: one downscaled draw,
 * one `getImageData`, and a few passes over a ~800-cell grid. It runs in well
 * under a millisecond per frame, costs nothing, and - unlike asking a language
 * model where the face is - it is actually looking at the pixels.
 *
 * Three signals come out:
 *
 *   busy  Sobel edge energy. Text over detail is unreadable regardless of
 *         brightness, so this drives placement more than luminance does.
 *   luma  Local brightness, used per text block rather than per frame. A frame
 *         that is bright sky over a black coat has no single useful average.
 *   skin  YCbCr skin-tone fraction, which is a cheap and surprisingly durable
 *         stand-in for "a person is here" - it survives illustration and
 *         animation, where a trained face detector often does not.
 */

const COLS = 32;
const ROWS = 24;

let scratch: OffscreenCanvas | HTMLCanvasElement | null = null;

function scratchCanvas(width: number, height: number) {
  if (typeof OffscreenCanvas !== 'undefined') {
    if (!scratch || scratch.width !== width || scratch.height !== height) {
      scratch = new OffscreenCanvas(width, height);
    }
    return scratch;
  }
  const canvas = (scratch as HTMLCanvasElement | null) ?? document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  scratch = canvas;
  return canvas;
}

/**
 * Measure one frame. `source` is anything drawable - a decoded video frame
 * canvas, an image, a bitmap.
 */
export function analyzeFrame(
  source: CanvasImageSource,
  timestampMs: number,
  cols = COLS,
  rows = ROWS,
): FrameMap {
  // Analyse at grid resolution times a small factor: enough pixels per cell for
  // a meaningful edge measurement, few enough to stay effectively free.
  const w = cols * 4;
  const h = rows * 4;

  const canvas = scratchCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) return emptyFrameMap(cols, rows, timestampMs);

  ctx.drawImage(source, 0, 0, w, h);

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, w, h).data;
  } catch {
    // Tainted canvas - degrade to a neutral map rather than failing the render.
    return emptyFrameMap(cols, rows, timestampMs);
  }

  const map = emptyFrameMap(cols, rows, timestampMs);

  // Per-pixel luma and skin, at analysis resolution.
  const luma = new Float32Array(w * h);
  const skin = new Float32Array(w * h);

  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    luma[p] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // YCbCr skin range. Wide enough to survive stylised and animated skin,
    // narrow enough not to fire on the whole frame.
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    skin[p] = y > 45 && cb >= 76 && cb <= 130 && cr >= 132 && cr <= 180 ? 1 : 0;
  }

  // Sobel magnitude per pixel, then average into cells.
  const cellW = w / cols;
  const cellH = h / rows;
  const busyAcc = new Float32Array(cols * rows);
  const lumaAcc = new Float32Array(cols * rows);
  const skinAcc = new Float32Array(cols * rows);
  const counts = new Float32Array(cols * rows);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;

      const gx =
        -luma[p - w - 1] - 2 * luma[p - 1] - luma[p + w - 1] +
        luma[p - w + 1] + 2 * luma[p + 1] + luma[p + w + 1];
      const gy =
        -luma[p - w - 1] - 2 * luma[p - w] - luma[p - w + 1] +
        luma[p + w - 1] + 2 * luma[p + w] + luma[p + w + 1];

      const cell = Math.min(rows - 1, Math.floor(y / cellH)) * cols + Math.min(cols - 1, Math.floor(x / cellW));
      busyAcc[cell] += Math.min(1, Math.hypot(gx, gy) / 2);
      lumaAcc[cell] += luma[p];
      skinAcc[cell] += skin[p];
      counts[cell]++;
    }
  }

  for (let i = 0; i < busyAcc.length; i++) {
    const n = counts[i] || 1;
    map.busy[i] = Math.min(1, busyAcc[i] / n);
    map.luma[i] = lumaAcc[i] / n;
    map.skin[i] = skinAcc[i] / n;
  }

  const { faces, skinBlobs } = detectFaces(map);
  map.faces = faces;
  // The subject is where the detail is, widened to include any substantial
  // skin region - a body below a face still should not be written over.
  map.subject = unionRects([detectSubject(map), ...faces, ...skinBlobs].filter(Boolean) as Rect[]);
  map.shot = classifyShot(map);

  return map;
}

/* ------------------------------------------------------------------ */
/* Face and subject regions                                            */
/* ------------------------------------------------------------------ */

/**
 * Connected regions of skin, filtered down to plausible faces.
 *
 * Not a trained detector, and it does not need to be - the layout only has to
 * know "keep off this area", and unlike a real detector this costs nothing and
 * works on drawn and animated faces.
 *
 * The filtering matters more than the detection. A first version accepted any
 * skin blob and reported a "face" spanning 78% of the frame, because an arm, a
 * neck and a background wall linked into one sprawling region. That made the
 * face metric meaningless - almost any placement overlapped it. So a blob now
 * has to look like a face: compact within its own bounding box, roughly
 * face-shaped, not enormous, and carrying internal detail.
 *
 * Large skin regions that fail these tests are not discarded - they feed the
 * subject region instead, where they act as a soft cost rather than a hard
 * prohibition.
 */
function detectFaces(map: FrameMap): { faces: Rect[]; skinBlobs: Rect[] } {
  const { cols, rows, skin, busy } = map;
  const seen = new Uint8Array(cols * rows);
  const faces: Rect[] = [];
  const skinBlobs: Rect[] = [];

  const isSkin = (i: number) => skin[i] > 0.35;

  for (let start = 0; start < skin.length; start++) {
    if (seen[start] || !isSkin(start)) continue;

    // Flood fill this blob.
    const queue = [start];
    seen[start] = 1;
    let minC = cols;
    let maxC = -1;
    let minR = rows;
    let maxR = -1;
    let size = 0;
    let detail = 0;

    while (queue.length > 0) {
      const i = queue.pop()!;
      const c = i % cols;
      const r = (i - c) / cols;
      size++;
      detail += busy[i];
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;

      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = nr * cols + nc;
        if (seen[ni] || !isSkin(ni)) continue;
        seen[ni] = 1;
        queue.push(ni);
      }
    }

    const rect: Rect = {
      x: minC / cols,
      y: minR / rows,
      width: (maxC - minC + 1) / cols,
      height: (maxR - minR + 1) / rows,
    };

    const fraction = size / (cols * rows);
    if (fraction < 0.006) continue; // noise

    // Anything sizeable is worth treating as "a person is here", even if it is
    // not a face.
    if (fraction > 0.02) skinBlobs.push(rect);

    // --- from here down, the tests a *face* has to pass ---

    // Compactness: a face fills most of its own bounding box. A scattered blob
    // linking a hand to a shoulder does not, and it was the cause of the
    // frame-sized "faces" the first version produced.
    const boxCells = (maxC - minC + 1) * (maxR - minR + 1);
    if (size / boxCells < 0.45) continue;

    // Shape: faces are roughly square. Long thin regions are limbs or edges.
    const aspect = rect.width / Math.max(0.0001, rect.height);
    if (aspect < 0.45 || aspect > 2.2) continue;

    // A face occupying more than half the frame is a detection failure, not a
    // very big face.
    if (rect.width * rect.height > 0.45) continue;

    // A face has internal detail (eyes, mouth). A flat expanse of similar
    // colour is usually a wall, sand or a garment.
    if (detail / size < 0.06) continue;

    faces.push(rect);
  }

  return {
    // A frame with a dozen "faces" has detected noise; keep the largest few.
    faces: faces.sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 3),
    skinBlobs: skinBlobs.sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 4),
  };
}

/**
 * The dominant subject: the smallest box holding most of the frame's detail.
 *
 * Grows outward from the busiest cell until it contains a majority of the total
 * edge energy, which finds the thing the eye goes to without needing to know
 * what it is.
 */
function detectSubject(map: FrameMap): Rect | null {
  const { cols, rows, busy } = map;
  const total = busy.reduce((a, b) => a + b, 0);
  if (total < 1) return null;

  let peak = 0;
  for (let i = 1; i < busy.length; i++) if (busy[i] > busy[peak]) peak = i;

  let c0 = peak % cols;
  let c1 = c0;
  let r0 = (peak - c0) / cols;
  let r1 = r0;

  const contained = () => {
    let sum = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) sum += busy[r * cols + c];
    }
    return sum;
  };

  // Expand toward whichever edge adds the most energy, until we hold 60% of it.
  let guard = 0;
  while (contained() < total * 0.6 && guard++ < cols + rows) {
    const options = [
      { key: 'left', gain: edgeEnergy(map, c0 - 1, c0 - 1, r0, r1), can: c0 > 0 },
      { key: 'right', gain: edgeEnergy(map, c1 + 1, c1 + 1, r0, r1), can: c1 < cols - 1 },
      { key: 'up', gain: edgeEnergy(map, c0, c1, r0 - 1, r0 - 1), can: r0 > 0 },
      { key: 'down', gain: edgeEnergy(map, c0, c1, r1 + 1, r1 + 1), can: r1 < rows - 1 },
    ].filter((o) => o.can);

    if (options.length === 0) break;
    const best = options.reduce((a, b) => (b.gain > a.gain ? b : a));
    if (best.key === 'left') c0--;
    else if (best.key === 'right') c1++;
    else if (best.key === 'up') r0--;
    else r1++;
  }

  const rect: Rect = {
    x: c0 / cols,
    y: r0 / rows,
    width: (c1 - c0 + 1) / cols,
    height: (r1 - r0 + 1) / rows,
  };

  // A "subject" covering the whole frame tells the layout nothing useful.
  return rect.width * rect.height > 0.9 ? null : rect;
}

/** Smallest rect containing all of the inputs. */
function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.width);
    y1 = Math.max(y1, r.y + r.height);
  }
  const rect = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  // A subject covering the whole frame tells the layout nothing useful.
  return rect.width * rect.height > 0.92 ? null : rect;
}

function edgeEnergy(map: FrameMap, c0: number, c1: number, r0: number, r1: number): number {
  let sum = 0;
  for (let r = Math.max(0, r0); r <= Math.min(map.rows - 1, r1); r++) {
    for (let c = Math.max(0, c0); c <= Math.min(map.cols - 1, c1); c++) {
      sum += map.busy[r * map.cols + c];
    }
  }
  return sum;
}

/**
 * Shot type, from how much of the frame the subject and faces occupy.
 *
 * This is what lets placement behave like a designer rather than a template:
 * a close-up needs text pushed to the opposite edge and kept small, while an
 * empty landscape can carry large type straight through the middle.
 */
function classifyShot(map: FrameMap): ShotType {
  const faceArea = map.faces.reduce((sum, f) => sum + f.width * f.height, 0);
  const subjectArea = map.subject ? map.subject.width * map.subject.height : 0;
  const meanBusy = map.busy.reduce((a, b) => a + b, 0) / map.busy.length;

  if (faceArea > 0.18) return 'closeup';
  if (faceArea > 0.05 || subjectArea > 0.4) return 'medium';
  if (subjectArea > 0.12 || meanBusy > 0.12) return 'wide';
  return 'empty';
}
