import type { TranscriptWord } from '../schemas/editor';

/**
 * Timing refinement against the audio itself.
 *
 * `align.ts` fixes *which* words are said. This fixes *when*. They are separate
 * problems with separate causes, and only the first was being handled.
 *
 * Word timestamps come from the language model, which is reading the audio but
 * reporting offsets from a rough internal sense of pace. Those offsets drift by
 * 50-250ms in ways a viewer reads instantly as "the caption is slightly off" -
 * and the drift changes with whichever model in the chain answered, so quality
 * moved around as free-tier quota pushed requests onto different models.
 *
 * The audio, though, is right there in the browser, already decoded to 16kHz
 * mono for upload. Speech and silence are trivially separable in it. So rather
 * than trusting the model's clock, we measure where sound actually starts and
 * stops and place the words the model gave us inside those measured spans.
 *
 * The model still decides the words and their order. This only moves them in
 * time, and only when the evidence is clear:
 *
 *   - segmentation that looks meaningless (near-constant loud music, or near
 *     silence) is rejected outright and timings are returned untouched
 *   - a word is never moved further than `maxShiftMs`, so a bad segment can
 *     nudge a caption but never fling it somewhere absurd
 *   - a segment holding an implausible number of words is left alone
 *   - order and monotonicity are preserved unconditionally
 *
 * Every guard fails towards the original timings, which is what makes this safe
 * to run on every transcript rather than only the ones we suspect.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface SpeechEnvelope {
  /** Per-frame loudness, any positive scale - it is normalised internally. */
  frames: ArrayLike<number>;
  /** Milliseconds between consecutive frames. 10 is a good default. */
  hopMs: number;
}

export interface VoicedSegment {
  startMs: number;
  endMs: number;
}

export interface SnapOptions {
  /** Never move a boundary further than this from where the model put it. */
  maxShiftMs?: number;
  /** Speech shorter than this is noise, not a word. */
  minSegmentMs?: number;
  /** A gap shorter than this is within a phrase, not between phrases. */
  minGapMs?: number;
  /** Refuse to touch a segment carrying more words than this. */
  maxWordsPerSegment?: number;
}

export interface SnapReport {
  /** False when the audio gave us nothing trustworthy and nothing was changed. */
  applied: boolean;
  reason?: string;
  segments: number;
  wordsMoved: number;
  meanShiftMs: number;
  maxShiftMs: number;
}

const DEFAULTS = {
  maxShiftMs: 300,
  minSegmentMs: 90,
  minGapMs: 130,
  maxWordsPerSegment: 24,
} as const;

/* ------------------------------------------------------------------ */
/* Voiced segments                                                     */
/* ------------------------------------------------------------------ */

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

/**
 * Split an energy envelope into spans that contain sound.
 *
 * The threshold is relative to the clip's own noise floor rather than absolute,
 * because a phone recording in a cafe and a studio vocal differ by orders of
 * magnitude in level while looking identical in shape. Hysteresis - a low bar
 * to stay voiced, a higher one to become voiced - stops a word being chopped in
 * half by the dip in the middle of it.
 */
export function findVoicedSegments(
  envelope: SpeechEnvelope,
  options: SnapOptions = {},
): VoicedSegment[] {
  const { minSegmentMs, minGapMs } = { ...DEFAULTS, ...options };
  const { frames, hopMs } = envelope;
  const count = frames.length;
  if (count === 0 || hopMs <= 0) return [];

  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const value = frames[i];
    values.push(Number.isFinite(value) ? Math.max(0, value) : 0);
  }

  const sorted = [...values].sort((a, b) => a - b);
  const floor = percentile(sorted, 0.1);
  const ceiling = percentile(sorted, 0.95);
  const span = ceiling - floor;

  // A clip with no dynamic range carries no boundary information: either it is
  // silent throughout or compressed flat. Either way, guessing would be worse
  // than declining.
  if (span <= 1e-6) return [];

  const enter = floor + span * 0.28;
  const exit = floor + span * 0.16;

  const segments: VoicedSegment[] = [];
  let start = -1;
  let silenceRun = 0;

  for (let i = 0; i < count; i++) {
    const value = values[i];
    if (start < 0) {
      if (value >= enter) {
        start = i;
        silenceRun = 0;
      }
      continue;
    }

    if (value >= exit) {
      silenceRun = 0;
      continue;
    }

    silenceRun++;
    if (silenceRun * hopMs >= minGapMs) {
      const endFrame = i - silenceRun + 1;
      segments.push({ startMs: start * hopMs, endMs: endFrame * hopMs });
      start = -1;
      silenceRun = 0;
    }
  }

  if (start >= 0) segments.push({ startMs: start * hopMs, endMs: count * hopMs });

  return segments.filter((s) => s.endMs - s.startMs >= minSegmentMs);
}

/* ------------------------------------------------------------------ */
/* Word weighting                                                      */
/* ------------------------------------------------------------------ */

/**
 * Roughly how long a word should take to say, relative to its neighbours.
 *
 * Vowel groups approximate syllables, which track duration far better than
 * character count does - "strength" is one beat and "area" is three, despite
 * the letter counts pointing the other way. The floor keeps a word from
 * collapsing to nothing, and the constant reflects that even a one-syllable
 * word carries onset and release either side of the vowel.
 */
export function spokenWeight(text: string): number {
  const letters = text.toLowerCase().replace(/[^a-zÀ-ɏ']/g, '');
  if (letters.length === 0) return 1;
  const vowelGroups = letters.match(/[aeiouyà-ü]+/g);
  const syllables = Math.max(1, vowelGroups ? vowelGroups.length : 1);
  return syllables + letters.length * 0.08;
}

/* ------------------------------------------------------------------ */
/* Snapping                                                            */
/* ------------------------------------------------------------------ */

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Place words inside measured speech, keeping the model's word order.
 *
 * Words are grouped by which voiced segment the model's own timing puts them
 * in, then redistributed across that segment by spoken weight. So the model
 * decides what is said and roughly where; the audio decides exactly when.
 */
export function snapWordTimings(
  words: TranscriptWord[],
  envelope: SpeechEnvelope,
  durationMs: number,
  options: SnapOptions = {},
): { words: TranscriptWord[]; report: SnapReport } {
  const config = { ...DEFAULTS, ...options };
  const untouched = (reason: string): { words: TranscriptWord[]; report: SnapReport } => ({
    words,
    report: { applied: false, reason, segments: 0, wordsMoved: 0, meanShiftMs: 0, maxShiftMs: 0 },
  });

  if (words.length === 0) return untouched('no words');

  const segments = findVoicedSegments(envelope, config);
  if (segments.length === 0) return untouched('no voiced segments detected');

  // Sanity-check the segmentation against the clip as a whole. Speech that
  // covers essentially all of it, or almost none, means the threshold found
  // texture rather than structure - common with loud continuous music - and the
  // segment boundaries carry no information worth acting on.
  if (durationMs > 0) {
    const voiced = segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);
    const ratio = voiced / durationMs;
    if (ratio < 0.12) return untouched(`only ${(ratio * 100).toFixed(0)}% voiced`);
    if (ratio > 0.97) return untouched('audio is continuously loud');
  }

  // Assign each word to a segment by where its midpoint falls, choosing the
  // nearest segment when it lands in a gap.
  const buckets = new Map<number, TranscriptWord[]>();
  for (const word of words) {
    const mid = (word.startMs + word.endMs) / 2;
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < segments.length; i++) {
      const { startMs, endMs } = segments[i];
      const distance = mid < startMs ? startMs - mid : mid > endMs ? mid - endMs : 0;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
        if (distance === 0) break;
      }
    }
    const bucket = buckets.get(bestIndex);
    if (bucket) bucket.push(word);
    else buckets.set(bestIndex, [word]);
  }

  const byId = new Map<string, TranscriptWord>();
  const shifts: number[] = [];

  for (const [index, bucket] of buckets) {
    const segment = segments[index];
    // Too many words for one span means the grouping is wrong, not that someone
    // spoke very fast. Redistributing here would spread them evenly across a
    // segment they do not all belong to.
    if (bucket.length > config.maxWordsPerSegment) continue;

    const total = bucket.reduce((sum, w) => sum + spokenWeight(w.text), 0);
    if (total <= 0) continue;

    const available = segment.endMs - segment.startMs;
    let cursor = segment.startMs;

    const proposed: TranscriptWord[] = [];
    let rejected = false;

    for (const word of bucket) {
      const share = (spokenWeight(word.text) / total) * available;
      const startMs = Math.round(cursor);
      const endMs = Math.round(cursor + share);
      cursor += share;

      // Any single word moving too far means this segment does not really
      // correspond to these words. Abandon the whole group rather than half
      // of it, so the phrase keeps its internal shape.
      if (
        Math.abs(startMs - word.startMs) > config.maxShiftMs ||
        Math.abs(endMs - word.endMs) > config.maxShiftMs
      ) {
        rejected = true;
        break;
      }

      proposed.push({ ...word, startMs, endMs });
    }

    if (rejected) continue;

    for (let i = 0; i < proposed.length; i++) {
      shifts.push(Math.abs(proposed[i].startMs - bucket[i].startMs));
      byId.set(proposed[i].id, proposed[i]);
    }
  }

  if (byId.size === 0) return untouched('every candidate exceeded the shift limit');

  // Rebuild in the original order, then repair any boundary the redistribution
  // left crossing its neighbour. Order is the model's call and is never changed
  // here; only the instants move.
  const limit = durationMs > 0 ? durationMs : Number.MAX_SAFE_INTEGER;
  const result: TranscriptWord[] = [];
  let previousEnd = 0;

  for (const word of words) {
    const snapped = byId.get(word.id) ?? word;
    const startMs = clamp(Math.round(snapped.startMs), previousEnd, limit);
    const endMs = clamp(Math.round(snapped.endMs), startMs + 1, limit);
    result.push({ ...snapped, startMs, endMs });
    previousEnd = endMs;
  }

  const meanShiftMs = shifts.reduce((sum, s) => sum + s, 0) / Math.max(1, shifts.length);

  return {
    words: result,
    report: {
      applied: true,
      segments: segments.length,
      wordsMoved: byId.size,
      meanShiftMs: Math.round(meanShiftMs),
      maxShiftMs: shifts.length > 0 ? Math.round(Math.max(...shifts)) : 0,
    },
  };
}
