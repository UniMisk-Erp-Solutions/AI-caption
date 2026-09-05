import type { TranscriptWord } from '../schemas/editor';
import { normalizeText } from './align';

/**
 * Estimated timings from plain text.
 *
 * Used when there is no transcription available - the user pasted their script
 * or lyrics and there is no audio model configured (or it failed). It is a
 * genuine fallback, not a toy: the durations are weighted by syllable count and
 * punctuation, which is close enough that the captions land roughly on the
 * beat, and every word remains draggable in the transcript editor afterwards.
 *
 * Do not present this as if it were real word-level timing - the caller should
 * tell the user the timings are estimated.
 */

/** Rough syllable count. Good enough to weight relative word durations. */
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 1;
  if (w.length <= 3) return 1;

  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g);

  return Math.max(1, groups?.length ?? 1);
}

/** Extra silence after a word, based on the punctuation it carries. */
function trailingPauseMs(word: string): number {
  if (/[.!?…]["')\]]?$/.test(word)) return 340;
  if (/[,;:]$/.test(word)) return 180;
  if (/[-—]$/.test(word)) return 120;
  return 0;
}

export interface EstimateOptions {
  /** Total span to fill, in ms. */
  durationMs: number;
  /** Silence before the first word. */
  leadInMs?: number;
  /** Silence left at the end. */
  tailMs?: number;
}

export function estimateTimings(text: string, options: EstimateOptions): TranscriptWord[] {
  const tokens = normalizeText(text).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const leadIn = options.leadInMs ?? Math.min(400, options.durationMs * 0.02);
  const tail = options.tailMs ?? Math.min(600, options.durationMs * 0.04);
  const usable = Math.max(tokens.length * 120, options.durationMs - leadIn - tail);

  // Each word's share of the timeline is its syllable weight; pauses are taken
  // out of the same budget so punctuation genuinely slows the delivery down.
  const weights = tokens.map((t) => syllables(t) + 0.35);
  const pauses = tokens.map(trailingPauseMs);
  const totalPause = pauses.reduce((a, b) => a + b, 0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const speakingMs = Math.max(tokens.length * 90, usable - totalPause);
  const perWeight = speakingMs / totalWeight;

  const words: TranscriptWord[] = [];
  let cursor = leadIn;

  tokens.forEach((token, i) => {
    const duration = Math.max(90, Math.round(weights[i] * perWeight));
    words.push({
      id: `w${i + 1}`,
      text: token,
      startMs: Math.round(cursor),
      endMs: Math.round(cursor + duration),
      // Flagged low so the UI can mark these as estimated rather than measured.
      confidence: 0.3,
    });
    cursor += duration + pauses[i];
  });

  return words;
}

/**
 * Re-time an existing word list to fit a new span, preserving relative rhythm.
 * Used when the user trims the video after the transcript already exists.
 */
export function rescaleTimings(words: TranscriptWord[], newDurationMs: number): TranscriptWord[] {
  if (words.length === 0) return words;
  const first = words[0].startMs;
  const last = words[words.length - 1].endMs;
  const span = Math.max(1, last - first);
  const factor = Math.max(0.1, (newDurationMs - first) / span);

  return words.map((w) => ({
    ...w,
    startMs: Math.round(first + (w.startMs - first) * factor),
    endMs: Math.round(first + (w.endMs - first) * factor),
  }));
}
