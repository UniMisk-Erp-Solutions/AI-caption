import { AI_LIMITS } from '@kc/shared';
import { AudioBufferSink } from 'mediabunny';
import { openInput } from './probe';

/**
 * Audio extraction for transcription.
 *
 * The point of this file is bandwidth. Uploading a 180MB MP4 to transcribe
 * forty seconds of speech is the single easiest way to burn a free tier, so we
 * decode the audio in the browser, downmix to mono, resample to 16kHz and send
 * a WAV that is typically a couple of megabytes.
 *
 * 16kHz mono is what speech models want anyway - sending 48kHz stereo buys
 * nothing but upload time.
 */

export interface ExtractedAudio {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  sampleRate: number;
}

/** Decode the whole audio track into one interleaved-free mono Float32Array. */
async function decodeToMono(file: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const input = await openInput(file);
  const track = await input.getPrimaryAudioTrack();
  if (!track) throw new Error('This video has no audio track to transcribe.');

  const sink = new AudioBufferSink(track);
  const chunks: Float32Array[] = [];
  let sampleRate = 0;
  let total = 0;

  for await (const wrapped of sink.buffers()) {
    const buffer = wrapped.buffer;
    sampleRate ||= buffer.sampleRate;

    const frames = buffer.length;
    const mono = new Float32Array(frames);

    // Average the channels rather than taking channel 0 - a track with the
    // vocal panned to one side would otherwise come out near-silent.
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < frames; i++) mono[i] += data[i];
    }
    if (buffer.numberOfChannels > 1) {
      for (let i = 0; i < frames; i++) mono[i] /= buffer.numberOfChannels;
    }

    chunks.push(mono);
    total += frames;
  }

  if (total === 0) throw new Error('Could not decode any audio from this video.');

  const samples = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }

  return { samples, sampleRate: sampleRate || 48000 };
}

/** Resample with an OfflineAudioContext, which gives us a proper filter. */
async function resample(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Promise<Float32Array> {
  if (fromRate === toRate) return samples;

  const targetLength = Math.max(1, Math.round((samples.length * toRate) / fromRate));
  const ctx = new OfflineAudioContext(1, targetLength, toRate);

  const source = ctx.createBufferSource();
  const buffer = ctx.createBuffer(1, samples.length, fromRate);
  // Write through getChannelData rather than copyToChannel: the latter is typed
  // against a plain ArrayBuffer, which a Float32Array assembled from decoded
  // chunks is not guaranteed to be.
  buffer.getChannelData(0).set(samples);
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();

  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0).slice();
}

/** Minimal 16-bit PCM WAV writer. Universally accepted and trivially correct. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  const dataSize = samples.length * bytesPerSample;
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp before scaling, or a hot mix wraps around into loud noise.
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Extract a compact mono WAV suitable for the transcription API.
 * `onProgress` reports 0..1 across decode and resample.
 */
export async function extractAudioForTranscription(
  file: Blob,
  onProgress?: (progress: number) => void,
): Promise<ExtractedAudio> {
  onProgress?.(0.05);
  const { samples, sampleRate } = await decodeToMono(file);

  onProgress?.(0.65);
  const target = AI_LIMITS.audioSampleRate;
  const resampled = await resample(samples, sampleRate, target);

  onProgress?.(0.9);
  const blob = encodeWav(resampled, target);
  onProgress?.(1);

  return {
    blob,
    mimeType: 'audio/wav',
    durationMs: Math.round((resampled.length / target) * 1000),
    sampleRate: target,
  };
}

/**
 * Peak envelope for the timeline waveform.
 * Downsampled to `buckets` min/max pairs so drawing it is cheap at any zoom.
 */
export async function computeWaveform(file: Blob, buckets = 900): Promise<Float32Array> {
  const { samples } = await decodeToMono(file);
  const out = new Float32Array(buckets);
  const perBucket = Math.max(1, Math.floor(samples.length / buckets));

  for (let b = 0; b < buckets; b++) {
    const start = b * perBucket;
    const end = Math.min(samples.length, start + perBucket);
    let peak = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(samples[i]);
      if (v > peak) peak = v;
    }
    out[b] = peak;
  }
  return out;
}
