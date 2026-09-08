/**
 * The degeneracy gate must never reject a good transcript.
 *
 * Falling back to another model is only worth doing when the current output is
 * genuinely broken; discarding a correct transcript because a chorus repeats
 * would be a downgrade dressed as a safeguard. So the samples below are real
 * output from the benchmark - the three most repetitive CORRECT transcripts
 * measured across six clips (see BENCHMARK.md) - and all three must pass.
 *
 * Run: pnpm --filter @kc/shared verify:quality
 */

import { assessDegeneracy, loopRate, vocabularyRatio } from '../src/transcript/quality';
import type { TranscriptWord } from '../src/schemas/editor';

const words = (text: string): TranscriptWord[] =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((t, i) => ({ id: `w${i + 1}`, text: t, startMs: i * 200, endMs: i * 200 + 180 }));

/* Real output. Repetitive, but correct - these are choruses. */
const REAL: Array<[string, string]> = [
  [
    'test-2 gemini-3.5-flash (72% repeated)',
    "I can make it rain on your body like rain on your body like rain I don't know what to do tied up on your body like rain make it rain on your body like rain",
  ],
  [
    'test-2 gemini-3.7-flash (57% repeated)',
    "I can make it happen suit me hangin' on it You'd be like wait Turn his face hangin' on it I don't know what you do Tie you down to the chair hangin' on it You'd be like wait make it happen suit me hangin' on it",
  ],
  [
    'test-2 gemini-3.6-flash (31% repeated)',
    "I can make it rain on ya somebody like on this fast taking rain on ya I don't know what you do tied up to the rain on ya somebody like making",
  ],
  [
    'test-3 gemini-3.7-flash (0% repeated)',
    "Life is this I like this Right now I'm on the come up Lately been talking my shit because I know I come from the gutters and shout out to your brother then I go pop out in all of this linen like I was a baller",
  ],
];

/* What an actually stuck model produces: one fragment, forever. */
const STUCK = Array.from({ length: 64 }, (_, i) => ['make', 'it', 'rain', 'now'][i % 4]).join(' ');
const NEAR_STUCK = Array.from({ length: 48 }, (_, i) => ['on', 'your', 'body', 'like'][i % 4]).join(' ');

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name} - ${detail}`);
  if (!ok) failures++;
};

console.log('\nDegeneracy gate\n');
console.log('Real transcripts must all survive');

for (const [label, text] of REAL) {
  const w = words(text);
  const verdict = assessDegeneracy(w);
  check(
    label,
    !verdict.degenerate,
    `loop ${(verdict.loopRate * 100).toFixed(0)}%, vocab ${(verdict.vocabularyRatio * 100).toFixed(0)}%`,
  );
}

console.log('\nGenuinely stuck output must be caught');
for (const [label, text] of [
  ['a single 4-word fragment repeated 16x', STUCK],
  ['a 4-word fragment repeated 12x', NEAR_STUCK],
] as Array<[string, string]>) {
  const verdict = assessDegeneracy(words(text));
  check(label, verdict.degenerate, verdict.reason ?? 'not caught');
}

console.log('\nEdge cases');
check('empty transcript is not degenerate', !assessDegeneracy([]).degenerate, 'no words');
check(
  'a short transcript is never judged',
  !assessDegeneracy(words('rain rain rain rain rain rain')).degenerate,
  'below the minimum length',
);
check(
  'loopRate is 0 for unique text',
  loopRate(words('every single word here is completely different from the others in this line')) === 0,
  'no repeated 4-gram',
);
check(
  'vocabularyRatio is 1 for unique text',
  vocabularyRatio(words('alpha bravo charlie delta echo')) === 1,
  'all distinct',
);

console.log(`\n${failures === 0 ? 'All checks passed' : `${failures} check(s) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
