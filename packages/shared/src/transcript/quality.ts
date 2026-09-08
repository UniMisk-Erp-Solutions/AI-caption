import type { TranscriptWord } from '../schemas/editor';

/**
 * Detecting a transcript that has come apart.
 *
 * These models are language models with ears. When the audio is ambiguous they
 * commit to a plausible-sounding phrase and then keep predicting from their own
 * output, which can collapse into repeating one fragment for the rest of the
 * clip. That failure ships as captions unless something catches it.
 *
 * Catching it is delicate, because songs legitimately repeat. Thresholds here
 * are set from measured output rather than intuition: across 19 real
 * transcripts of 6 clips (see BENCHMARK.md), the highest repetition on a
 * CORRECT transcript was 72% - a chorus repeating "on your body like rain" -
 * and that transcript still used 16 distinct words.
 *
 * So repetition alone proves nothing. What distinguishes a stuck model is
 * repetition together with a collapsed vocabulary: saying the same few tokens
 * and nothing else. Both conditions must hold, and both are set far outside
 * anything observed working, because a false positive here throws away a good
 * transcript and falls back to a worse model - the exact harm this exists to
 * prevent.
 */

/** Repetition above this alone is normal in music and is not acted on. */
const LOOP_LIMIT = 0.92;

/** Distinct words as a fraction of total. Real speech sits far above this. */
const VOCABULARY_FLOOR = 0.15;

/** Too short to judge - repetition is meaningless over a handful of words. */
const MIN_WORDS = 20;

const norm = (text: string): string => text.toLowerCase().replace(/[^a-z0-9']/g, '');

/**
 * Fraction of words sitting inside a repeated 4-gram.
 *
 * 4 rather than 2 or 3 because short repeats are ordinary English ("on the",
 * "I don't know") while a repeated run of four is either a chorus or a loop.
 */
export function loopRate(words: TranscriptWord[]): number {
  const tokens = words.map((w) => norm(w.text)).filter(Boolean);
  if (tokens.length < 8) return 0;

  const firstSeen = new Map<string, number>();
  const flagged = new Set<number>();

  for (let i = 0; i + 4 <= tokens.length; i++) {
    const gram = tokens.slice(i, i + 4).join(' ');
    const previous = firstSeen.get(gram);
    if (previous === undefined) {
      firstSeen.set(gram, i);
      continue;
    }
    for (let k = i; k < i + 4; k++) flagged.add(k);
    for (let k = previous; k < previous + 4; k++) flagged.add(k);
  }

  return flagged.size / tokens.length;
}

/** Distinct words over total words. */
export function vocabularyRatio(words: TranscriptWord[]): number {
  const tokens = words.map((w) => norm(w.text)).filter(Boolean);
  if (tokens.length === 0) return 0;
  return new Set(tokens).size / tokens.length;
}

export interface DegeneracyVerdict {
  degenerate: boolean;
  loopRate: number;
  vocabularyRatio: number;
  reason?: string;
}

/**
 * True only when a transcript is repeating heavily AND has run out of words to
 * repeat. A chorus satisfies the first and fails the second.
 */
export function assessDegeneracy(words: TranscriptWord[]): DegeneracyVerdict {
  const loop = loopRate(words);
  const vocabulary = vocabularyRatio(words);

  if (words.length < MIN_WORDS) {
    return { degenerate: false, loopRate: loop, vocabularyRatio: vocabulary };
  }

  const degenerate = loop >= LOOP_LIMIT && vocabulary <= VOCABULARY_FLOOR;

  return {
    degenerate,
    loopRate: loop,
    vocabularyRatio: vocabulary,
    reason: degenerate
      ? `${Math.round(loop * 100)}% repeated with only ${Math.round(vocabulary * 100)}% distinct words`
      : undefined,
  };
}
