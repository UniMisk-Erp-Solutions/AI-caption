import type { TranscriptWord } from '../schemas/editor';

/**
 * Transcript reconciliation.
 *
 * We end up with two versions of the same audio:
 *
 *   A - the timed transcript (word-level start/end, but the words can be wrong,
 *       especially on sung or reverby audio: "I want to show you all")
 *   B - the semantic transcript (right words, no timings:
 *       "I wanna show you off")
 *
 * We want B's words on A's clock. Throwing away A and re-timing from scratch is
 * not an option - the timings are the expensive part. So we align the two token
 * streams with Needleman-Wunsch and transplant timings across the alignment:
 *
 *   matched   -> keep A's timing exactly
 *   replaced  -> B's word inherits the timing of the A word it replaced
 *   inserted  -> interpolate inside the gap between its timed neighbours
 *   deleted   -> the timing is absorbed by the surrounding words
 */

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

const APOSTROPHES = /[‘’ʼ՚′]/g;
const QUOTES = /[“”«»]/g;
const DASHES = /[‐-―]/g;

/** Normalise for *display*: fix quotes and spacing, keep the words intact. */
export function normalizeText(input: string): string {
  return input
    .replace(APOSTROPHES, "'")
    .replace(QUOTES, '"')
    .replace(DASHES, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise for *comparison*: aggressively strip everything but letters. */
export function normalizeToken(input: string): string {
  return normalizeText(input)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']/gu, '')
    .replace(/^'+|'+$/g, '');
}

/** Split a free-text transcript into comparable tokens, keeping originals. */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((t) => normalizeToken(t).length > 0);
}

/* ------------------------------------------------------------------ */
/* Similarity                                                          */
/* ------------------------------------------------------------------ */

/** Levenshtein distance, capped for speed on long tokens. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** 1 = identical, 0 = nothing in common. */
export function tokenSimilarity(a: string, b: string): number {
  const na = normalizeToken(a);
  const nb = normalizeToken(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const d = editDistance(na, nb);
  return Math.max(0, 1 - d / Math.max(na.length, nb.length));
}

/* ------------------------------------------------------------------ */
/* Alignment                                                           */
/* ------------------------------------------------------------------ */

export type AlignOp = 'match' | 'sub' | 'ins' | 'del';

export interface AlignStep {
  op: AlignOp;
  /** Index into the timed stream, or -1 for an insertion. */
  aIndex: number;
  /** Index into the corrected stream, or -1 for a deletion. */
  bIndex: number;
}

const MATCH_SCORE = 2;
const GAP_PENALTY = -1.2;

/**
 * Needleman-Wunsch global alignment over normalised tokens, scored by
 * similarity rather than strict equality so "wanna"/"want" still aligns.
 */
export function alignTokens(a: string[], b: string[]): AlignStep[] {
  const n = a.length;
  const m = b.length;

  // score[i][j] = best score aligning a[0..i) with b[0..j)
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) score[i][0] = i * GAP_PENALTY;
  for (let j = 1; j <= m; j++) score[0][j] = j * GAP_PENALTY;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = tokenSimilarity(a[i - 1], b[j - 1]);
      // A near-miss still scores positively; an unrelated pair scores negative,
      // which lets the aligner prefer an insert+delete over a bad substitution.
      const diag = score[i - 1][j - 1] + (sim * 2 - 1) * MATCH_SCORE;
      score[i][j] = Math.max(diag, score[i - 1][j] + GAP_PENALTY, score[i][j - 1] + GAP_PENALTY);
    }
  }

  const steps: AlignStep[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const sim = tokenSimilarity(a[i - 1], b[j - 1]);
      const diag = score[i - 1][j - 1] + (sim * 2 - 1) * MATCH_SCORE;
      if (score[i][j] === diag) {
        steps.push({ op: sim >= 0.999 ? 'match' : 'sub', aIndex: i - 1, bIndex: j - 1 });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && score[i][j] === score[i - 1][j] + GAP_PENALTY) {
      steps.push({ op: 'del', aIndex: i - 1, bIndex: -1 });
      i--;
      continue;
    }
    steps.push({ op: 'ins', aIndex: -1, bIndex: j - 1 });
    j--;
  }

  steps.reverse();
  return steps;
}

/* ------------------------------------------------------------------ */
/* Reconciliation                                                      */
/* ------------------------------------------------------------------ */

export interface ReconcileResult {
  words: TranscriptWord[];
  /** Fraction of corrected tokens that matched the timed transcript exactly. */
  agreement: number;
  /** How many words had their text changed by the verifier. */
  changed: number;
}

/**
 * Produce a final word list with the corrected wording and the timed clock.
 *
 * `timed` must be sorted by startMs. `correctedText` is plain text - it can
 * come from the audio verifier or from lyrics the user pasted in.
 */
export function reconcileTranscript(timed: TranscriptWord[], correctedText: string): ReconcileResult {
  const bTokens = tokenize(correctedText);
  if (timed.length === 0 || bTokens.length === 0) {
    return { words: timed, agreement: timed.length === 0 ? 0 : 1, changed: 0 };
  }

  const aTokens = timed.map((w) => w.text);
  const steps = alignTokens(aTokens, bTokens);

  const out: TranscriptWord[] = [];
  let matched = 0;
  let changed = 0;

  /** Insertions are buffered until we know the timing gap they live inside. */
  let pendingInserts: string[] = [];

  const totalMs = timed[timed.length - 1].endMs - timed[0].startMs;
  const avgWordMs = Math.max(80, Math.round(totalMs / Math.max(1, timed.length)));

  const flushInserts = (gapStart: number, gapEnd: number) => {
    if (pendingInserts.length === 0) return;
    const count = pendingInserts.length;
    const span = Math.max(count * 40, gapEnd - gapStart);
    const each = span / count;
    pendingInserts.forEach((text, k) => {
      const start = Math.round(gapStart + each * k);
      out.push({
        id: `w${out.length + 1}`,
        text,
        startMs: start,
        endMs: Math.round(start + each),
        confidence: 0.4,
      });
    });
    pendingInserts = [];
    changed += count;
  };

  for (let s = 0; s < steps.length; s++) {
    const step = steps[s];

    if (step.op === 'ins') {
      pendingInserts.push(bTokens[step.bIndex]);
      continue;
    }

    if (step.op === 'del') {
      // A timed word the verifier dropped. Its slot still exists on the clock,
      // so let any pending inserts use it before discarding it.
      const w = timed[step.aIndex];
      flushInserts(w.startMs, w.endMs);
      continue;
    }

    const src = timed[step.aIndex];
    const text = bTokens[step.bIndex];

    // Inserts sitting before this word take the space between the previous
    // emitted word and this one.
    const prevEnd = out.length > 0 ? out[out.length - 1].endMs : Math.max(0, src.startMs - avgWordMs);
    flushInserts(prevEnd, src.startMs);

    if (step.op === 'match') matched++;
    else changed++;

    out.push({
      id: `w${out.length + 1}`,
      text,
      startMs: src.startMs,
      endMs: src.endMs,
      confidence: step.op === 'match' ? (src.confidence ?? 0.9) : 0.65,
    });
  }

  // Anything left over lands after the last timed word.
  const lastEnd = out.length > 0 ? out[out.length - 1].endMs : 0;
  flushInserts(lastEnd, lastEnd + avgWordMs * Math.max(1, pendingInserts.length));

  return {
    words: repairMonotonicity(out),
    agreement: bTokens.length > 0 ? matched / bTokens.length : 0,
    changed,
  };
}

/**
 * Guarantee the invariant the whole renderer relies on: strictly increasing,
 * non-overlapping, non-zero-length word spans.
 */
export function repairMonotonicity(words: TranscriptWord[]): TranscriptWord[] {
  const out: TranscriptWord[] = [];
  let cursor = 0;
  for (const w of words) {
    const startMs = Math.max(cursor, Math.round(w.startMs));
    const endMs = Math.max(startMs + 40, Math.round(w.endMs));
    out.push({ ...w, startMs, endMs });
    cursor = endMs;
  }
  return out;
}
