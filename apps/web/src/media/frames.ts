import { AI_LIMITS } from '@kc/shared';
import { CanvasSink } from 'mediabunny';
import { blobToBase64, canvasToBlob, fitScale, openInput } from './probe';

/**
 * Keyframe extraction for the design pass.
 *
 * Gemma needs to see the footage to know where the face is and where the empty
 * space is - but it does not need 1080x1920. We send WebP at ~448px on the long
 * edge, which is enough to locate a subject and costs a fraction of the tokens.
 */

export interface SceneFrame {
  sceneId: string;
  timestampMs: number;
  /** Bare base64 WebP, no data: prefix - that is what the Gemini API wants. */
  base64: string;
  /** Mean luminance 0..1, used to auto-tune caption contrast. */
  luma: number;
  /** Object URL for the editor's scene strip. Caller revokes it. */
  previewUrl: string;
}

export interface FrameRequest {
  sceneId: string;
  timestampMs: number;
}

/**
 * Pull one representative frame per scene in a single pass over the file.
 *
 * `canvasesAtTimestamps` is doing the heavy lifting: it decodes forwards
 * through the file once and yields at each requested point, rather than seeking
 * from scratch per frame, which on a long clip is the difference between two
 * seconds and two minutes.
 */
export async function extractSceneFrames(
  file: Blob,
  requests: FrameRequest[],
  onProgress?: (done: number, total: number) => void,
): Promise<SceneFrame[]> {
  if (requests.length === 0) return [];

  const input = await openInput(file);
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('This video has no video track.');

  const scale = fitScale(track.displayWidth, track.displayHeight, AI_LIMITS.keyframeLongEdge);
  const sink = new CanvasSink(track, {
    width: Math.max(2, Math.round(track.displayWidth * scale)),
    height: Math.max(2, Math.round(track.displayHeight * scale)),
    fit: 'fill',
    poolSize: 2,
  });

  const sorted = [...requests].sort((a, b) => a.timestampMs - b.timestampMs);
  const timestamps = sorted.map((r) => r.timestampMs / 1000);

  const frames: SceneFrame[] = [];
  let index = 0;

  for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
    const request = sorted[index++];
    onProgress?.(index, sorted.length);
    if (!wrapped || !request) continue;

    const canvas = wrapped.canvas;
    const blob = await canvasToBlob(canvas, 'image/webp', AI_LIMITS.keyframeQuality);

    frames.push({
      sceneId: request.sceneId,
      timestampMs: request.timestampMs,
      base64: await blobToBase64(blob),
      luma: meanLuma(canvas),
      previewUrl: URL.createObjectURL(blob),
    });
  }

  return frames;
}

/**
 * Mean perceptual luminance of a frame.
 *
 * Drives the automatic shadow strength: white type on a blown-out sky is the
 * most common legibility failure in this whole category of app, and knowing the
 * backdrop is bright lets the composer bump the shadow before anyone sees it.
 */
function meanLuma(canvas: HTMLCanvasElement | OffscreenCanvas): number {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) return 0.5;

  const w = canvas.width;
  const h = canvas.height;
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return 0.5;
  }

  let sum = 0;
  let count = 0;
  // Every 16th pixel is plenty for an average and keeps this well under a
  // millisecond even on a large frame.
  for (let i = 0; i < data.length; i += 4 * 16) {
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    count++;
  }
  return count > 0 ? sum / count : 0.5;
}

/** Release the object URLs held by a frame set. */
export function releaseFrames(frames: SceneFrame[]): void {
  for (const frame of frames) URL.revokeObjectURL(frame.previewUrl);
}
