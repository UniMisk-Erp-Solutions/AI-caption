/**
 * Does audio-grounded snapping actually improve timing, and can it make things
 * worse?
 *
 * Ground truth is unavailable for a real clip without hand-labelling it, so the
 * signal is synthesised instead: words are placed at known instants, an energy
 * envelope is built from those instants, and the timings handed to the aligner
 * are the true ones corrupted the way a language model corrupts them - a
 * systematic lag plus per-word jitter. Error against the known truth is then
 * measurable exactly, before and after.
 *
 * Run: pnpm --filter @kc/shared verify:snap
 */

import {
  snapWordTimings,
  findVoicedSegments,
  spokenWeight,
  type SpeechEnvelope,
} from '../src/transcript/snap';
import type { TranscriptWord } from '../src/schemas/editor';

const HOP_MS = 10;

/* ------------------------------------------------------------------ */
/* Synthetic clips                                                     */
/* ------------------------------------------------------------------ */

interface Clip {
  words: TranscriptWord[];
  envelope: SpeechEnvelope;
  durationMs: number;
}

// Deterministic PRNG so a regression is reproducible rather than a coin flip.
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const VOCAB = ['we', 'were', 'too', 'close', 'to', 'the', 'stars', 'burning', 'alive', 'tonight'];

/** A clip of phrases separated by real silence, with known word instants. */
function buildClip(phraseCount: number, seed: number): Clip {
  const random = makeRandom(seed);
  const words: TranscriptWord[] = [];
  let cursor = 400;
  let id = 1;

  for (let p = 0; p < phraseCount; p++) {
    const wordCount = 3 + Math.floor(random() * 4);
    for (let w = 0; w < wordCount; w++) {
      const text = VOCAB[Math.floor(random() * VOCAB.length)];
      // Real speech spends longer on longer words, but not exactly
      // proportionally. Deriving duration from syllable weight and then
      // scattering it by +/-30% models that honestly - using a flat random
      // duration instead would have made word length independent of the word,
      // which no speaker does, and would test the aligner against a signal
      // that cannot exist.
      const duration = Math.round(spokenWeight(text) * 115 * (0.7 + random() * 0.6));
      words.push({ id: `w${id++}`, text, startMs: cursor, endMs: cursor + duration });
      cursor += duration;
    }
    cursor += 420 + Math.floor(random() * 380); // silence between phrases
  }

  const durationMs = cursor + 500;
  const frameCount = Math.ceil(durationMs / HOP_MS);
  const frames = new Float32Array(frameCount);

  // Noise floor everywhere, energy only where a word actually is.
  for (let i = 0; i < frameCount; i++) frames[i] = 0.01 + random() * 0.01;
  for (const word of words) {
    const from = Math.floor(word.startMs / HOP_MS);
    const to = Math.ceil(word.endMs / HOP_MS);
    for (let i = from; i < to && i < frameCount; i++) {
      frames[i] = 0.55 + random() * 0.4;
    }
  }

  return { words, envelope: { frames, hopMs: HOP_MS }, durationMs };
}

/** Corrupt timings the way a model does: a systematic lag plus jitter. */
function corrupt(words: TranscriptWord[], lagMs: number, jitterMs: number, seed: number): TranscriptWord[] {
  const random = makeRandom(seed);
  return words.map((word) => {
    const jitter = (random() * 2 - 1) * jitterMs;
    const startMs = Math.max(0, Math.round(word.startMs + lagMs + jitter));
    const endMs = Math.max(startMs + 1, Math.round(word.endMs + lagMs + jitter));
    return { ...word, startMs, endMs };
  });
}

function meanAbsError(candidate: TranscriptWord[], truth: TranscriptWord[]): number {
  const byId = new Map(truth.map((w) => [w.id, w]));
  let total = 0;
  let count = 0;
  for (const word of candidate) {
    const actual = byId.get(word.id);
    if (!actual) continue;
    total += Math.abs(word.startMs - actual.startMs);
    count++;
  }
  return count === 0 ? 0 : total / count;
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

let failures = 0;
const check = (name: string, condition: boolean, detail: string) => {
  console.log(`${condition ? '  PASS' : '  FAIL'}  ${name} - ${detail}`);
  if (!condition) failures++;
};

console.log('\nAudio-grounded timing refinement\n');

/* 1. Accuracy: does it reduce error against known truth? */
console.log('Accuracy against known ground truth');
let improved = 0;
let totalBefore = 0;
let totalAfter = 0;

for (let seed = 1; seed <= 12; seed++) {
  const clip = buildClip(5, seed);
  const drifted = corrupt(clip.words, 110, 90, seed * 31);
  const { words: snapped, report } = snapWordTimings(drifted, clip.envelope, clip.durationMs);

  const before = meanAbsError(drifted, clip.words);
  const after = meanAbsError(snapped, clip.words);
  totalBefore += before;
  totalAfter += after;
  if (after < before) improved++;

  if (seed <= 3) {
    console.log(
      `    seed ${seed}: ${before.toFixed(0)}ms -> ${after.toFixed(0)}ms ` +
        `(${report.segments} segments, ${report.wordsMoved} words moved)`,
    );
  }
}

const meanBefore = totalBefore / 12;
const meanAfter = totalAfter / 12;
check(
  'error falls on every clip',
  improved === 12,
  `${improved}/12 improved`,
);
check(
  'mean error at least halves',
  meanAfter < meanBefore / 2,
  `${meanBefore.toFixed(0)}ms -> ${meanAfter.toFixed(0)}ms`,
);

/* 2. Safety: refuse where the audio says nothing useful. */
console.log('\nRefusal on unusable audio');

const flat: SpeechEnvelope = { frames: new Float32Array(3000).fill(0.8), hopMs: HOP_MS };
const flatClip = buildClip(4, 99);
const flatResult = snapWordTimings(flatClip.words, flat, 30000);
check(
  'continuous loud audio is left alone',
  !flatResult.report.applied && flatResult.words === flatClip.words,
  flatResult.report.reason ?? 'applied',
);

const silent: SpeechEnvelope = { frames: new Float32Array(3000).fill(0.001), hopMs: HOP_MS };
const silentResult = snapWordTimings(flatClip.words, silent, 30000);
check(
  'silence is left alone',
  !silentResult.report.applied,
  silentResult.report.reason ?? 'applied',
);

const emptyResult = snapWordTimings([], { frames: new Float32Array(100), hopMs: HOP_MS }, 1000);
check('no words is handled', !emptyResult.report.applied, emptyResult.report.reason ?? '');

/* 3. Invariants that must hold whenever it does act. */
console.log('\nInvariants');

const clip = buildClip(6, 7);
const drifted = corrupt(clip.words, 130, 110, 555);
const { words: out, report } = snapWordTimings(drifted, clip.envelope, clip.durationMs);

check('it did act', report.applied, `${report.wordsMoved} words moved`);
check('word count preserved', out.length === drifted.length, `${drifted.length} -> ${out.length}`);
check(
  'order preserved',
  out.every((w, i) => w.id === drifted[i].id),
  'ids in original sequence',
);
check(
  'monotonic and non-overlapping',
  out.every((w, i) => w.endMs > w.startMs && (i === 0 || w.startMs >= out[i - 1].endMs)),
  'no crossings',
);
check(
  'nothing exceeds the shift limit',
  out.every((w, i) => Math.abs(w.startMs - drifted[i].startMs) <= 300),
  `max observed ${report.maxShiftMs}ms`,
);
check(
  'stays inside the clip',
  out.every((w) => w.endMs <= clip.durationMs),
  `duration ${clip.durationMs}ms`,
);

/* 4. Segmentation sanity. */
console.log('\nSegmentation');
const segments = findVoicedSegments(clip.envelope);
check('finds one segment per phrase', segments.length === 6, `${segments.length} segments for 6 phrases`);

console.log(
  `\n${failures === 0 ? 'All checks passed' : `${failures} check(s) FAILED`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
