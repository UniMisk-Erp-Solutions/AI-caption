import { renderFrame, type EditorState } from '@kc/shared';
import {
  AudioBufferSink,
  AudioBufferSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncodeAudio,
  canEncodeVideo,
  getFirstEncodableVideoCodec,
} from 'mediabunny';
import { ensureDesignFonts } from '../fonts/fonts';
import { openInput } from './probe';

/**
 * Client-side export.
 *
 * This is the piece that keeps the whole product at zero infrastructure cost:
 * no render farm, no ffmpeg server, no queue. The browser decodes the source,
 * composites captions with the *same* `renderFrame` the preview uses, encodes
 * with WebCodecs and muxes an MP4 - all locally.
 *
 * The "same renderFrame" part is not a convenience, it is the correctness
 * argument. A separate export renderer would drift from the preview within a
 * week and users would stop trusting what they see.
 */

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  /** Video bitrate in bits per second. */
  bitrate: number;
  includeAudio: boolean;
}

export interface ExportProgress {
  phase: 'preparing' | 'rendering' | 'audio' | 'finalizing' | 'done';
  /** 0..1 */
  progress: number;
  frame?: number;
  totalFrames?: number;
}

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
}

export class ExportUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportUnsupportedError';
  }
}

/**
 * Check the browser can actually do this before we start, so we can say so
 * plainly rather than producing a broken file twenty seconds in.
 */
export async function checkExportSupport(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    return {
      ok: false,
      reason:
        'Your browser does not support WebCodecs, which is required to export. You can keep editing here - open the project in the latest Chrome or Edge to export it.',
    };
  }

  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], {
    width: 1080,
    height: 1920,
  }).catch(() => null);

  if (!codec) {
    return {
      ok: false,
      reason: 'Your browser has WebCodecs but no usable video encoder for this resolution.',
    };
  }
  return { ok: true };
}

export async function exportVideo(
  sourceFile: Blob,
  state: EditorState,
  options: ExportOptions,
  onProgress: (progress: ExportProgress) => void,
  signal?: AbortSignal,
): Promise<ExportResult> {
  const support = await checkExportSupport();
  if (!support.ok) throw new ExportUnsupportedError(support.reason ?? 'Export is not supported here.');

  onProgress({ phase: 'preparing', progress: 0 });

  // Canvas text silently falls back to a default face if the font is not ready,
  // which would mean the export does not match the preview. Block on it.
  await ensureDesignFonts(state);

  const { width, height, fps } = options;
  const durationMs = state.project.durationMs;
  const totalFrames = Math.max(1, Math.ceil((durationMs / 1000) * fps));

  const input = await openInput(sourceFile);
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error('The source file has no video track.');
  const audioTrack = options.includeAudio ? await input.getPrimaryAudioTrack() : null;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not create an export canvas.');

  const videoCodec =
    (await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height }).catch(() => null)) ?? 'avc';

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const videoSource = new CanvasSource(canvas, {
    codec: videoCodec,
    bitrate: options.bitrate,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  if (audioTrack) {
    const audioCodec = (await canEncodeAudio('aac').catch(() => false)) ? 'aac' : 'opus';
    audioSource = new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_HIGH });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  // Cover-fit the source into the export frame, matching how the preview shows
  // it, so captions land in the same place relative to the picture.
  const frameSink = new CanvasSink(videoTrack, { width, height, fit: 'cover', poolSize: 3 });

  const frameTimestamps: number[] = [];
  for (let i = 0; i < totalFrames; i++) frameTimestamps.push(i / fps);

  onProgress({ phase: 'rendering', progress: 0, frame: 0, totalFrames });

  let frameIndex = 0;
  const frameDuration = 1 / fps;

  try {
    for await (const wrapped of frameSink.canvasesAtTimestamps(frameTimestamps)) {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');

      const timestampSec = frameIndex / fps;

      if (wrapped) {
        ctx.drawImage(wrapped.canvas as unknown as CanvasImageSource, 0, 0, width, height);
      } else {
        // A gap in the source (or a timestamp past the end) still needs a frame,
        // otherwise the muxer sees a hole and the audio drifts out of sync.
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
      }

      renderFrame(ctx, state, Math.round(timestampSec * 1000), width, height);

      await videoSource.add(timestampSec, frameDuration);

      frameIndex++;
      if (frameIndex % 5 === 0 || frameIndex === totalFrames) {
        onProgress({
          phase: 'rendering',
          progress: (frameIndex / totalFrames) * (audioTrack ? 0.8 : 0.95),
          frame: frameIndex,
          totalFrames,
        });
      }
    }

    if (audioTrack && audioSource) {
      onProgress({ phase: 'audio', progress: 0.82 });
      const audioSink = new AudioBufferSink(audioTrack);
      const endSec = durationMs / 1000;

      for await (const wrapped of audioSink.buffers(0, endSec)) {
        if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
        await audioSource.add(wrapped.buffer);
      }
      audioSource.close();
      onProgress({ phase: 'audio', progress: 0.95 });
    }

    onProgress({ phase: 'finalizing', progress: 0.97 });
    await output.finalize();
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw error;
  }

  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error('Export produced no data.');

  onProgress({ phase: 'done', progress: 1 });

  return {
    blob: new Blob([buffer], { type: 'video/mp4' }),
    width,
    height,
    fps,
    durationMs,
  };
}

/** Render a single frame to a PNG - used for the "export still" action. */
export async function exportStill(
  sourceFile: Blob,
  state: EditorState,
  timeMs: number,
  width: number,
  height: number,
): Promise<Blob> {
  await ensureDesignFonts(state);

  const input = await openInput(sourceFile);
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('The source file has no video track.');

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not create a canvas.');

  const sink = new CanvasSink(track, { width, height, fit: 'cover' });
  const wrapped = await sink.getCanvas(timeMs / 1000);

  if (wrapped) {
    ctx.drawImage(wrapped.canvas as unknown as CanvasImageSource, 0, 0, width, height);
  } else {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }

  renderFrame(ctx, state, timeMs, width, height);
  return canvas.convertToBlob({ type: 'image/png' });
}

export { canEncodeVideo };
