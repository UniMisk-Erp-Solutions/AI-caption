import { ALL_FORMATS, BlobSource, Input, type InputVideoTrack } from 'mediabunny';

/**
 * Media probing.
 *
 * Everything the app knows about a source file comes from here, and it all runs
 * in the browser - there is no server-side ffprobe. Mediabunny reads the
 * container directly off the Blob, so a 200MB file is not loaded into memory to
 * answer "how long is it".
 */

export interface MediaInfo {
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
  /** False when the browser cannot decode this file - we must say so early. */
  decodable: boolean;
}

export async function openInput(file: Blob): Promise<Input> {
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

export async function probeMedia(file: Blob): Promise<MediaInfo> {
  const input = await openInput(file);

  const [videoTrack, audioTrack] = await Promise.all([
    input.getPrimaryVideoTrack(),
    input.getPrimaryAudioTrack(),
  ]);

  if (!videoTrack) {
    throw new Error('This file has no video track.');
  }

  const durationSec = await input.computeDuration();

  // Frame rate is not always in the container, so derive it from packet timing.
  // A short sample is enough and avoids walking the whole file.
  let fps = 30;
  try {
    const stats = await videoTrack.computePacketStats(120);
    if (stats.averagePacketRate > 0) fps = Math.round(stats.averagePacketRate * 100) / 100;
  } catch {
    /* keep the 30fps default - it only affects the export cadence */
  }

  const decodable = await videoTrack.canDecode().catch(() => false);

  return {
    width: videoTrack.displayWidth,
    height: videoTrack.displayHeight,
    fps: clampFps(fps),
    durationMs: Math.round(durationSec * 1000),
    hasAudio: Boolean(audioTrack),
    videoCodec: videoTrack.codec,
    audioCodec: audioTrack?.codec ?? null,
    decodable,
  };
}

function clampFps(fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return 30;
  return Math.min(120, Math.max(1, fps));
}

/**
 * Grab a single frame as a WebP blob, for the dashboard card.
 * Taken a little way in, because frame zero is very often black.
 */
export async function generateThumbnail(file: Blob, durationMs: number, longEdge = 480): Promise<Blob | null> {
  const input = await openInput(file);
  const track = await input.getPrimaryVideoTrack();
  if (!track) return null;

  const { CanvasSink } = await import('mediabunny');
  const scale = fitScale(track.displayWidth, track.displayHeight, longEdge);
  const sink = new CanvasSink(track, {
    width: Math.round(track.displayWidth * scale),
    height: Math.round(track.displayHeight * scale),
    fit: 'fill',
  });

  const at = Math.min(durationMs * 0.25, 2000) / 1000;
  const wrapped = await sink.getCanvas(at).catch(() => null);
  if (!wrapped) return null;

  return canvasToBlob(wrapped.canvas, 'image/webp', 0.8);
}

export function fitScale(width: number, height: number, longEdge: number): number {
  const current = Math.max(width, height);
  return current <= longEdge ? 1 : longEdge / current;
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed'))),
      type,
      quality,
    );
  });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  // btoa on a 200KB string built char-by-char is slow; chunked apply is not.
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export type { InputVideoTrack };
