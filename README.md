# Kinetic — AI caption studio

Turns the speech or lyrics in a short video into **designed kinetic typography**:
a quiet workhorse face carries the sentence, and one word per screen is promoted
to a flowing script or display face at 2× the size, sitting inline with the words
around it. Everything is editable, and it exports to MP4 from the browser.

```
a holi-day in my  Life  as a  girl  in  New York  city
                  ^^^^ hero word — script, 2x, same line
```

Run `pnpm dev` and open **`/gallery`** to see every preset rendered by the real
engine, before uploading anything.

---

## Quick start

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

That is the whole setup. With no `.env` the app runs in **local mode**: projects
live in IndexedDB, your video never leaves the browser, and captions are laid out
by the built-in designer. Editing, fonts, animation, undo and MP4 export all work.

To caption a video in local mode, paste what is said on the upload screen —
timings are estimated from the rhythm of the text and are draggable afterwards.

Use **Chrome or Edge** for export (WebCodecs).

---

## Turning on the cloud

Three optional services, each independently useful.

| Service | Gives you | Cost |
| --- | --- | --- |
| Supabase | Accounts, projects synced across devices | Free tier |
| Cloudflare Worker | Gemini transcription + Gemma design | Free tier |
| Cloudflare R2 | Source videos and exports in the cloud | Free tier (10 GB) |

### 1. Supabase

Create a project, then run `supabase/migrations/0001_init.sql` in the SQL editor.
It creates the tables, the RLS policies and the free-tier guards.

```bash
# apps/web/.env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 2. Worker (AI + storage)

```bash
cd apps/worker
cp .dev.vars.example .dev.vars     # fill in for local dev
pnpm dev                           # http://localhost:8787
```

Then point the web app at it:

```bash
# apps/web/.env
VITE_API_BASE_URL=http://localhost:8787
```

Deploying:

```bash
wrangler kv namespace create USAGE   # then paste the id into wrangler.toml
wrangler secret put GEMINI_API_KEY
wrangler secret put SUPABASE_URL
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler deploy
```

`GET /health` reports which services are configured **and which models actually
resolved** — the fastest way to diagnose a failing AI step.

### 3. R2

Create a private bucket named `caption-ai-media` and an API token with object
read/write. The bucket must never be made public; every read goes through a
short-lived signed URL.

---

## How the AI works

Three separate jobs, deliberately not combined:

| | Model | Input | Output |
| --- | --- | --- | --- |
| **Transcribe** | Gemini (audio) | 16 kHz mono WAV | words + millisecond timings |
| **Verify** | Gemini Flash (audio) | same audio + draft | speech/song, corrected wording |
| **Design** | Gemma 4 31B (vision) | keyframes + transcript **text** | layout decisions |

**Gemma cannot hear audio, and does not need to.** It only ever sees images and
text, and its whole output is four decisions per scene:

1. how the words break across 1–3 lines
2. which single word becomes the hero
3. which composition template the block sits in
4. where the face and subject are, so text stays off them

It never emits coordinates, sizes, tracking, colours or font names. Those come
from the preset and the composition templates, which means **the model cannot
produce an ugly layout** and **cannot alter the transcript** — lines reference
word *ids*, and the text is rebuilt from the transcript afterwards.

### Model names are resolved, not hardcoded

Model ids churn. Rather than pinning `gemma-4-31b-it` and returning 404 the day
it is renamed, the Worker asks the Gemini API which models the key can actually
see and takes the best available match from an ordered preference chain
(`apps/worker/src/gemini/client.ts`). The result is cached for an hour.

### Everything degrades

| Failure | What happens |
| --- | --- |
| No API configured | Estimated timings from pasted text |
| Transcription fails | One retry, then pasted text, then a clear message |
| Verification fails | Keeps the timed transcript |
| Gemma fails or returns bad JSON | One repair attempt, then the built-in designer |
| Autosave can't reach Supabase | Stays in IndexedDB, retries on the next edit |
| R2 upload of an export fails | The MP4 is still downloadable locally |

The built-in designer is **not** a degraded "plain subtitles" mode — it drives
the same composer with heuristics instead of a model, so the video still looks
designed.

---

## Architecture

```
React (Vercel) ──┬── Supabase ......... auth, project JSON
                 ├── Cloudflare Worker  JWT check, Gemini/Gemma proxy, R2 signing
                 │        └── R2 ...... source video, thumbnails, exports
                 └── Browser media engine (Mediabunny + WebCodecs)
                          decode · extract audio · keyframes · render · mux MP4
```

Large files never pass through the Worker: the browser gets a signed PUT and
uploads straight to R2. The browser never sees a Gemini key or an R2 credential.

### One rendering engine

`packages/shared/src/renderer/draw.ts` draws the captions. The preview canvas and
the MP4 encoder both call `renderFrame()` with the same state and timestamp, so
the export is the preview — not an approximation of it. Every animation is a pure
function of normalised progress, with no timers or CSS transitions, which is what
makes that guarantee hold.

### Repository layout

```
packages/shared/       the design system and every shared decision
  design/fonts.ts        21 approved faces, with metrics and pairing rules
  design/presets.ts      8 art directions, each a *cast* of four voices
  design/compositions.ts 11 arrangements — the highest-leverage file for quality
  design/animations.ts   deterministic f(progress) → transform
  layout/compose.ts      decisions → placed, sized, timed typography
  renderer/draw.ts       the single rendering engine
  transcript/            scene grouping, line breaking, alignment
  ai/prompt.ts           the creative-director prompt

apps/web/              React editor
apps/worker/           Cloudflare Worker API gateway
supabase/migrations/   schema + RLS
```

---

## The design system

**Presets are casts, not fonts.** Each defines four voices — `base` (carries the
sentence), `hero` (the promoted word), `accent`, `micro` — chosen for contrast
across categories. Script against condensed, Didone against grotesk; never two
grotesks fighting.

| Preset | Pairing |
| --- | --- |
| Script editorial | DM Sans + Great Vibes |
| Stacked heavy | Anton, tight lowercase stack |
| Old money | DM Serif Display + Style Script |
| Vogue | Bodoni caps + Bodoni italic |
| Soft script | Cormorant Light + Parisienne |
| Poster bold | Bebas + Archivo Black |
| Scrapbook | Fraunces + Caveat |
| Y2K acid | Space Grotesk + Anton |
| Cinematic | Manrope + Italiana |

Swapping preset, fonts, hero contrast, scale, motion and rotation all re-run the
composer **locally and instantly** — trying eight looks costs nothing. Only the
buttons under "AI" touch the network.

---

## Editing

Two levels, and the split is the point:

- **Word level** — tap any word to change its face, size, tracking, baseline or
  promote it to hero. This is where the pairing lives.
- **Block level** — position, rotation, alignment, timing, animation, wrap width.

Drag to move (snaps to thirds), corner handle to resize, top handle to rotate,
double-click to retype. In the transcript panel, hover a word and press ★ to make
it the hero of its scene — the fastest fix when the design emphasised the wrong
word.

| | |
| --- | --- |
| Space | play / pause |
| ← → | nudge 100 ms (Shift: 1 s) |
| Ctrl+Z / Ctrl+Shift+Z | undo / redo |
| Ctrl+D | duplicate layer |
| Delete | delete layer |

A drag produces one undo entry, not sixty. Any layer you touch is marked
`locked`, and AI regeneration preserves it.

---

## Limits

Set in `packages/shared/src/constants/limits.ts`, and enforced in the database
too (a client-side limit is a suggestion).

- 5 min / 250 MB per video
- 10 projects per user
- 10 whole-project designs per day, 20 transcriptions per day
- 16 keyframes per design request, 448 px long edge

## Privacy

During the free beta, audio goes to Google's free Gemini tier, which may use
requests to improve their products. Don't upload confidential video.

## Commands

```bash
pnpm dev            # web app
pnpm dev:worker     # worker
pnpm build          # production build
pnpm typecheck      # all packages
pnpm --filter @kc/shared exec tsx scripts/smoke.ts   # composer sanity check
```
