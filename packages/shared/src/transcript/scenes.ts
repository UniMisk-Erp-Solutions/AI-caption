import type { TranscriptWord } from '../schemas/editor';

/**
 * Scene grouping.
 *
 * A "scene" is one screenful of typography. Getting these boundaries right is
 * most of what makes captions feel designed rather than auto-generated: cut in
 * the wrong place and no amount of pretty fonts saves it.
 *
 * We cut on, in order of strength:
 *   1. sentence-ending punctuation
 *   2. a silence longer than `pauseMs`
 *   3. a natural phrase boundary (before a conjunction / preposition)
 *   4. the reading-length ceiling
 */

export interface SceneGroup {
  id: string;
  startMs: number;
  endMs: number;
  wordIds: string[];
  keyframeTimestampMs: number;
}

export interface GroupOptions {
  /** Silence longer than this forces a cut. */
  pauseMs: number;
  /** Preferred words per scene. */
  targetWords: number;
  maxWords: number;
  minMs: number;
  maxMs: number;
}

export const DEFAULT_GROUP_OPTIONS: GroupOptions = {
  pauseMs: 460,
  targetWords: 5,
  maxWords: 7,
  minMs: 650,
  maxMs: 2600,
};

/**
 * Words that read badly as the *first* word of a screen - they need what came
 * before them to make sense, so we prefer to break before their predecessor.
 */
const WEAK_LEADERS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by',
  'is', 'was', 'are', 'were', 'be', 'been', 'am',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'and', 'or', 'but', 'so', 'as', 'that', 'than', 'then',
]);

/** Words that make a good *first* word - a natural phrase start. */
const STRONG_LEADERS = new Set([
  'and', 'but', 'so', 'because', 'when', 'while', 'if', 'then', 'that',
  'what', 'why', 'how', 'where', 'who', 'i', 'we', 'you', 'they', 'it',
]);

const SENTENCE_END = /[.!?…]["')\]]?$/;
const CLAUSE_END = /[,;:—-]$/;

function clean(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
}

/**
 * Split a word list into scenes. Deterministic - the AI may later re-group, but
 * this is what the editor shows first and what it falls back to.
 */
export function groupIntoScenes(
  words: TranscriptWord[],
  options: Partial<GroupOptions> = {},
): SceneGroup[] {
  const opts = { ...DEFAULT_GROUP_OPTIONS, ...options };
  if (words.length === 0) return [];

  const scenes: SceneGroup[] = [];
  let current: TranscriptWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const startMs = current[0].startMs;
    const endMs = current[current.length - 1].endMs;
    scenes.push({
      id: `sc${scenes.length + 1}`,
      startMs,
      endMs,
      wordIds: current.map((w) => w.id),
      keyframeTimestampMs: Math.round(startMs + (endMs - startMs) / 2),
    });
    current = [];
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    current.push(word);

    const next = words[i + 1];
    if (!next) break;

    const spanMs = next.startMs - current[0].startMs;
    const gapMs = next.startMs - word.endMs;
    const count = current.length;

    // 1. Hard cut after sentence-ending punctuation, provided the scene has
    //    enough on it to be worth a screen of its own.
    if (SENTENCE_END.test(word.text) && count >= 2) {
      flush();
      continue;
    }

    // 2. A real pause in the audio is the most reliable cue we have.
    if (gapMs >= opts.pauseMs && count >= 2) {
      flush();
      continue;
    }

    // 3. Ceiling reached - we must cut, so cut at the best nearby boundary.
    if (count >= opts.maxWords || spanMs >= opts.maxMs) {
      flush();
      continue;
    }

    // 4. At target length, take a cut only if it lands somewhere natural.
    if (count >= opts.targetWords && spanMs >= opts.minMs) {
      const nextClean = clean(next.text);
      const cutIsClean =
        CLAUSE_END.test(word.text) ||
        STRONG_LEADERS.has(nextClean) ||
        (!WEAK_LEADERS.has(nextClean) && gapMs >= opts.pauseMs * 0.45);
      if (cutIsClean) flush();
    }
  }

  flush();
  return mergeRunts(scenes, words, opts);
}

/**
 * A one-word scene left over from an aggressive cut looks like a mistake.
 * Fold those back into whichever neighbour has room.
 */
function mergeRunts(scenes: SceneGroup[], words: TranscriptWord[], opts: GroupOptions): SceneGroup[] {
  if (scenes.length < 2) return scenes;
  const byId = new Map(words.map((w) => [w.id, w]));

  const out: SceneGroup[] = [];
  for (const scene of scenes) {
    const prev = out[out.length - 1];
    const isRunt = scene.wordIds.length <= 1 || scene.endMs - scene.startMs < opts.minMs * 0.6;

    if (prev && isRunt && prev.wordIds.length + scene.wordIds.length <= opts.maxWords) {
      prev.wordIds.push(...scene.wordIds);
      prev.endMs = scene.endMs;
      prev.keyframeTimestampMs = Math.round(prev.startMs + (prev.endMs - prev.startMs) / 2);
      continue;
    }
    out.push({ ...scene, wordIds: [...scene.wordIds] });
  }

  void byId;
  return out.map((s, i) => ({ ...s, id: `sc${i + 1}` }));
}

/* ------------------------------------------------------------------ */
/* Line splitting                                                      */
/* ------------------------------------------------------------------ */

export interface LineGroup {
  wordIds: string[];
  text: string;
}

/**
 * Words that read badly at the END of a line - the eye is left hanging.
 */
const DANGLING = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by',
  'and', 'or', 'but', 'so', 'as', 'that', 'than', 'is', 'was', 'are', 'were',
  'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'these', 'those',
]);

/** Words too slight to hold a line on their own. */
const TOO_SLIGHT = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by',
  'is', 'was', 'are', 'were', 'be', 'am', 'it', 'as', 'so', 'and', 'or', 'but',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
]);

const IDEAL_WORDS_PER_LINE = 3;

/**
 * Break one scene's words into typographic lines.
 *
 * This is what turns
 *     "what I actually learned this year"
 * into
 *     what I actually
 *          LEARNED
 *        this year
 *
 * A greedy split gets this wrong constantly - it produces a lonely "a" above a
 * seven-word run. So instead we score every possible split and take the best
 * one. The cost function encodes what a designer would object to:
 *
 *   - lines far from three words                (unbalanced block)
 *   - a line ending on "in", "the", "my"        (dangling connective)
 *   - a lone function word on its own line      (orphan)
 *   - the hero word buried mid-line             (no air around the payoff)
 *
 * It is O(n^2 * lines), and n is under ten words, so exhaustive is free.
 */
export function splitIntoLines(words: TranscriptWord[], maxLines = 3): LineGroup[] {
  if (words.length === 0) return [];
  if (words.length === 1) {
    return [{ wordIds: [words[0].id], text: words[0].text }];
  }

  const heroIndex = pickHeroIndex(words);
  const n = words.length;
  const maxCount = Math.max(1, Math.min(maxLines, Math.ceil(n / 2)));

  let bestCut: number[] | null = null;
  let bestCost = Infinity;

  // `cuts` are the indices where a new line starts, excluding 0.
  const consider = (cuts: number[]) => {
    const bounds = [0, ...cuts, n];
    let cost = 0;
    for (let i = 0; i < bounds.length - 1; i++) {
      cost += lineCost(words, bounds[i], bounds[i + 1], heroIndex, i, bounds.length - 1);
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestCut = cuts;
    }
  };

  const recurse = (start: number, remaining: number, acc: number[]) => {
    if (remaining === 0) {
      if (start < n) consider(acc);
      return;
    }
    // Every line needs at least one word, and so does the remainder.
    for (let cut = start + 1; cut <= n - remaining; cut++) {
      recurse(cut, remaining - 1, [...acc, cut]);
    }
  };

  for (let lines = 1; lines <= maxCount; lines++) {
    recurse(0, lines - 1, []);
  }

  const bounds = [0, ...(bestCut ?? []), n];
  const groups: LineGroup[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const slice = words.slice(bounds[i], bounds[i + 1]);
    if (slice.length === 0) continue;
    groups.push({
      wordIds: slice.map((w) => w.id),
      text: slice.map((w) => w.text).join(' '),
    });
  }
  return groups;
}

function lineCost(
  words: TranscriptWord[],
  from: number,
  to: number,
  heroIndex: number,
  lineIndex: number,
  lineCount: number,
): number {
  const len = to - from;
  let cost = 0;

  // Balance: three words is the sweet spot, and long lines shrink the type.
  cost += Math.pow(len - IDEAL_WORDS_PER_LINE, 2) * 1.1;
  if (len > 4) cost += (len - 4) * 5;

  const first = clean(words[from].text);
  const last = clean(words[to - 1].text);

  // A line that ends on a connective leaves the reader hanging mid-thought.
  const isLastLine = lineIndex === lineCount - 1;
  if (!isLastLine && DANGLING.has(last)) cost += 4.5;

  // A lone "a" or "the" on its own line reads as a layout bug.
  if (len === 1 && TOO_SLIGHT.has(first)) cost += 7;

  // The hero word wants air: alone on its line is ideal, at an edge is fine,
  // buried in the middle of a long line wastes it.
  if (heroIndex >= from && heroIndex < to) {
    // Big enough to outweigh the balance penalty a one-word line attracts -
    // the hero standing alone is the single strongest move in this layout, and
    // "a / Holiday / in my life" beats "a Holiday / in my life" every time.
    if (len === 1) cost -= 6;
    else if (heroIndex === from || heroIndex === to - 1) cost -= 1.5;
    else cost += 1.5;
  }

  // Starting a line on a connective is weaker than starting on a subject.
  if (lineIndex > 0 && TOO_SLIGHT.has(first)) cost += 1.2;

  return cost;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by',
  'is', 'was', 'are', 'were', 'be', 'been', 'am', 'do', 'did', 'does',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'and', 'or', 'but', 'so', 'as', 'if', 'than', 'then', 'just', 'very', 'really',
]);

/**
 * Which word of the scene deserves to be the hero - the one promoted to the
 * script face at twice the size.
 *
 * Longer, non-stopword, later-in-the-phrase words carry the meaning:
 * "learned" beats "what", "consistency" beats "was that". Words the speaker
 * held longer usually got the emphasis in the delivery too, so borrow that.
 * Deterministic on purpose, so the fallback design is reproducible.
 */
export function pickHeroIndex(words: TranscriptWord[]): number {
  let bestIndex = 0;
  let bestScore = -Infinity;

  words.forEach((w, i) => {
    const t = clean(w.text);
    if (!t) return;
    let score = 0;
    if (!STOPWORDS.has(t)) score += 3;
    score += Math.min(4, t.length / 2.5);
    // Slight bias to the back half: the payoff word usually lands late.
    score += (i / Math.max(1, words.length - 1)) * 1.2;
    // Held words were probably stressed by the speaker.
    score += Math.min(1.5, (w.endMs - w.startMs) / 400);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });

  return bestIndex;
}
