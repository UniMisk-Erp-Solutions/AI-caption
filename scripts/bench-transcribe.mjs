/**
 * Transcription benchmark across several clips and models.
 *
 * There is no ground truth for these clips, so quality is estimated from
 * cross-model AGREEMENT: every model transcribes every clip, and each model is
 * scored by how closely its token sequence matches the others on the same clip.
 * A model that hears "your body like rain" while three others hear the same
 * thing is corroborated; one that alone hears "everybody like weight hunnis"
 * is not. This is the same logic as ROVER voting, minus the recombination.
 *
 * Agreement alone would reward a model that copies a shared mistake, so it is
 * reported next to coverage (how much of the clip got words at all) and loop
 * rate (how much of the output is a repeated 4-gram). A model wins by being
 * corroborated, complete, and not stuck.
 *
 * Costs one request per clip per model. Free-tier quota is per model, so the
 * budget that matters is clips-per-model, not the total.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error('GEMINI_API_KEY required');
  process.exit(2);
}

const CLIPS = (process.env.CLIPS || 'test-2,test-3,test-4,test-5,test-6,test-7').split(',');
const MODELS = (
  process.env.MODELS || 'gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-3.8-flash'
).split(',');
const OUT = process.env.OUT || 'bench-results.json';

const SYSTEM = `You are a verbatim transcription engine.

Transcribe the audio exactly as spoken or sung. Include filler words (um, like, you know) and repeated words. Do not paraphrase, summarise, correct grammar or clean anything up.

Return every word with its start and end offset in MILLISECONDS from the beginning of the audio.

Return raw JSON only, no markdown:
{
  "language": "<BCP-47 code>",
  "text": "<the full transcript>",
  "words": [ { "id": "w1", "text": "hello", "startMs": 240, "endMs": 610 } ]
}

Word ids must be w1, w2, w3... in spoken order. Timestamps must be strictly increasing and must not overlap.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function transcribe(model, data, attempt = 0) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
  const started = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'video/mp4', data } },
              { text: 'Transcribe this audio verbatim with word-level millisecond timestamps.' },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          maxOutputTokens: 16384,
        },
      }),
    });
  } catch (error) {
    return { error: `network: ${error.message}` };
  }

  // 503 is capacity, not a verdict on the model - retry before writing it off.
  if ((res.status === 503 || res.status === 500) && attempt < 3) {
    await sleep(4000 * (attempt + 1));
    return transcribe(model, data, attempt + 1);
  }
  if (!res.ok) {
    return { error: `HTTP ${res.status}`, detail: (await res.text()).slice(0, 120) };
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  if (!text.trim()) return { error: 'empty response' };
  try {
    const parsed = JSON.parse(text);
    return { result: parsed, ms: Date.now() - started, attempts: attempt + 1 };
  } catch {
    return { error: 'unparseable JSON' };
  }
}

/* ---------------------------------------------------------------- */
/* Metrics                                                           */
/* ---------------------------------------------------------------- */

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9']/g, '');
const tokensOf = (r) => (r?.words ?? []).map((w) => norm(w.text)).filter(Boolean);

/** Token-level edit distance, i.e. word error rate without the reference. */
function similarity(a, b) {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return Math.max(0, 1 - prev[b.length] / Math.max(a.length, b.length));
}

function loopRate(tokens) {
  if (tokens.length < 8) return 0;
  const seen = new Map();
  const flagged = new Set();
  for (let i = 0; i + 4 <= tokens.length; i++) {
    const gram = tokens.slice(i, i + 4).join(' ');
    if (seen.has(gram)) {
      const first = seen.get(gram);
      for (let k = i; k < i + 4; k++) flagged.add(k);
      for (let k = first; k < first + 4; k++) flagged.add(k);
    } else seen.set(gram, i);
  }
  return flagged.size / tokens.length;
}

/* ---------------------------------------------------------------- */

const runs = {}; // clip -> model -> outcome

for (const clip of CLIPS) {
  const file = `${clip}.mp4`;
  let data;
  try {
    data = readFileSync(file).toString('base64');
  } catch {
    console.log(`skip ${file} (not found)`);
    continue;
  }

  runs[clip] = {};
  console.log(`\n=== ${file} ===`);

  for (const model of MODELS) {
    const out = await transcribe(model, data);
    if (out.error) {
      console.log(`  ${model.padEnd(20)} FAILED ${out.error}`);
      runs[clip][model] = { failed: out.error };
      continue;
    }
    const tokens = tokensOf(out.result);
    const end = Math.max(0, ...(out.result.words ?? []).map((w) => Number(w.endMs) || 0));
    runs[clip][model] = {
      tokens,
      words: tokens.length,
      endMs: end,
      loop: loopRate(tokens),
      ms: out.ms,
      text: String(out.result.text || tokens.join(' ')).slice(0, 400),
    };
    console.log(
      `  ${model.padEnd(20)} ${String(tokens.length).padStart(3)}w ${(end / 1000).toFixed(1).padStart(5)}s ` +
        `loop ${(loopRate(tokens) * 100).toFixed(0).padStart(3)}%  ${(out.ms / 1000).toFixed(0)}s`,
    );
  }
}

/* ---- agreement, per clip, then aggregated per model -------------- */

const agree = {};   // model -> [scores]
const coverage = {}; // model -> [fraction of best coverage on that clip]
const loops = {};

for (const clip of Object.keys(runs)) {
  const present = MODELS.filter((m) => runs[clip][m] && !runs[clip][m].failed);
  if (present.length < 2) continue;

  const bestEnd = Math.max(...present.map((m) => runs[clip][m].endMs)) || 1;

  for (const m of present) {
    const others = present.filter((o) => o !== m);
    const score =
      others.reduce((sum, o) => sum + similarity(runs[clip][m].tokens, runs[clip][o].tokens), 0) /
      others.length;
    (agree[m] ??= []).push(score);
    (coverage[m] ??= []).push(runs[clip][m].endMs / bestEnd);
    (loops[m] ??= []).push(runs[clip][m].loop);
  }
}

const mean = (xs) => (xs && xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

console.log('\n\n================ VERDICT ================\n');
console.log('model                 agree  cover   loop   clips');
const ranked = MODELS.map((m) => ({
  model: m,
  agree: mean(agree[m]),
  cover: mean(coverage[m]),
  loop: mean(loops[m]),
  clips: (agree[m] ?? []).length,
}))
  // Corroborated and complete, minus time spent looping.
  .map((r) => ({ ...r, score: r.agree * 0.6 + r.cover * 0.4 - r.loop * 0.15 }))
  .sort((a, b) => b.score - a.score);

for (const r of ranked) {
  console.log(
    `${r.model.padEnd(20)}  ${r.agree.toFixed(2)}   ${r.cover.toFixed(2)}   ${r.loop.toFixed(2)}   ${r.clips}` +
      `   score ${r.score.toFixed(3)}`,
  );
}

writeFileSync(OUT, JSON.stringify({ runs, ranked }, null, 2));
console.log(`\nfull output -> ${OUT}`);
