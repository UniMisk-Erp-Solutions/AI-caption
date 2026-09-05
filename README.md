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
| Storage | Source videos and exports | **Cloudflare R2** (10 GB free) or **self-hosted Immich** |

### 1. Supabase

Create a project, then run `supabase/migrations/0001_init.sql` in the SQL editor.
It creates the tables, the RLS policies and the free-tier guards.

```bash
# apps/web/.env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Run `0002_immich_storage.sql` too — it adds the unique index the asset upsert
needs, which is also what proves ownership of an Immich asset.

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
wrangler secret put SUPABASE_ANON_KEY   # PostgREST rejects a user token here
wrangler secret put STORAGE_TOKEN_SECRET
# then either the R2 secrets or the Immich ones (see below)
wrangler deploy
```

`GET /health` reports which services are configured **and which models actually
resolved** — the fastest way to diagnose a failing AI step.

### 3. Storage — pick one

Both implement the same `StorageProvider` interface, chosen by
`STORAGE_PROVIDER` (or inferred from whichever keys are set).

**Cloudflare R2.** Create a private bucket named `caption-ai-media` and an API
token with object read/write. Never make the bucket public — every read is a
short-lived presigned URL.

```bash
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID= / R2_ACCESS_KEY_ID= / R2_SECRET_ACCESS_KEY= / R2_BUCKET_NAME=
```

**Self-hosted Immich.** Immich has no presigned URLs — just a long-lived
`x-api-key`. Handing that to a browser is fine for uploads and catastrophic for
reads, because one key with `asset.read` exposes the whole photo library. So the
credential is split:

```bash
STORAGE_PROVIDER=immich
IMMICH_URL=https://immich.example.com
IMMICH_API_KEY=       # full scope. Server-side only, never sent to a browser.
IMMICH_UPLOAD_KEY=    # optional, scope `asset.upload` ONLY. Safe to expose.
IMMICH_ALBUM_PREFIX=Kinetic
```

| | With `IMMICH_UPLOAD_KEY` | Without it |
| --- | --- | --- |
| Upload | Browser → Immich directly, no size cap | Streamed through the Worker, **capped at 100 MB** |
| Read | Worker streaming proxy, short-lived signed token | Same |

Create the upload-only key in Immich under *Account Settings → API Keys* and
tick **only** `asset.upload`. `GET /health` reports which mode is active.

Reads are always proxied, which is affordable only because the editor is
local-first: the video is already in IndexedDB on the device that made it, so a
cloud read happens only when opening a project on a second device. Range
requests are forwarded, so proxied video still seeks.

Uploads are filed into a per-user album. That is organisation, not a security
boundary — Immich asset ids carry no owner, so ownership is proven by looking
the key up in the RLS-protected `assets` table.

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

### Model names are resolved at runtime, not hardcoded

Model ids churn, and a listed model is not necessarily a working one. So each
capability has an ordered chain, and the Worker walks it: it asks the API which
models the key can see, then tries them in order until one returns something
usable (`apps/worker/src/gemini/client.ts`).

This is not theoretical. `gemini-3.5-transcribe` is published, accepts audio,
bills the audio tokens and returns `finishReason: STOP` with **zero content
parts** — a success at the HTTP layer that yields nothing. Without the chain the
pipeline silently produced a caption-free video. `gemini-3.5-flash` transcribes
the same clip perfectly, so it leads the chain. During testing a live 503 on the
verification pass was also absorbed the same way.

The Worker likewise probes rather than assumes for request *shape*: models that
reject `systemInstruction` ("Developer instruction is not enabled for this
model" — both Gemma and the transcribe models) get the system prompt folded into
the user turn automatically, on a retry triggered by the error itself.

### Everything degrades

| Failure | What happens |
| --- | --- |
| No API configured | Estimated timings from pasted text |
| A model returns an empty response | Falls through to the next model in the chain |
| Transcript stops short of the audio | Rejected and retried; the best attempt wins if none is complete |
| Transcription fails entirely | One retry, then pasted text, then a clear message |
| Verification fails | Keeps the timed transcript |
| Gemma fails or returns bad JSON | One repair attempt, then the built-in designer |
| Autosave can't reach Supabase | Stays in IndexedDB, retries on the next edit |
| Cloud upload of an export fails | The MP4 is still downloadable locally |

The built-in designer is **not** a degraded "plain subtitles" mode — it drives
the same composer with heuristics instead of a model, so the video still looks
designed.

---

## Architecture

```
React (Vercel) ──┬── Supabase ......... auth, project JSON
                 ├── Cloudflare Worker  JWT check, Gemini/Gemma proxy, storage
                 │        └── R2 or Immich ... source video, thumbnails, exports
                 └── Browser media engine (Mediabunny + WebCodecs)
                          decode · extract audio · keyframes · render · mux MP4
```

The browser never sees a Gemini key, an R2 credential, or an Immich read key.
With R2 (or Immich plus an upload-only key) large files go browser-to-storage
directly and never pass through the Worker.

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

## Placement intelligence

Captions are placed against measurements of the actual frame, not a model's
guess about it.

The first build asked Gemma where the face and the empty space were. It
answered with round numbers - `x: 0.20, y: 0.00, w: 0.60, h: 0.80` - because a
language model cannot measure pixels. On one clip it reported the subject on the
left when the face was on the right. Meanwhile the solver could only slide the
block *vertically*, so when a tall figure stood mid-frame there was no position
in the search space that cleared it, and text landed on the face.

Now the browser measures each scene (`apps/web/src/media/analyze.ts`), in about
a millisecond and for free:

| Signal | How | Used for |
| --- | --- | --- |
| busyness | Sobel edge energy per cell | text over detail is unreadable at any brightness |
| luminance | per cell, sampled *under each line* | shadow strength; a frame that is bright sky over a black coat has no useful average |
| skin | YCbCr, flood-filled into blobs | face and subject regions, and it survives animation |
| shot type | face and subject area | close-up vs medium vs wide vs empty |

Three moments are sampled per scene and merged, so text avoids where the
subject moves *to*, not only where it was on the keyframe.

`packages/shared/src/layout/place.ts` then searches both axes, scoring every
candidate on face overlap, subject overlap, busyness, local contrast, safe
margins, rule-of-thirds affinity, and continuity with the previous scene. Shot
type gates which compositions are even eligible - a centred stack over a
close-up portrait is wrong however good the typography is.

Gemma is still asked for the design, but it is now *given* the geometry and
spends its attention on what it is good at: line breaks and which word matters.

### Measured effect

Controlled A/B on the same transcript, same art direction, no model involved -
so the only variable is the layout engine (`/harness?relayout=1`):

| Metric | Blind | Measured |
| --- | --- | --- |
| Overall | 82% (6/8) | **93% (7/8)** |
| Text clear of faces | 0.33 - 4/6 layers on a face | **1.00 - zero** |
| Text on calm areas | 0.34 | **0.55** |
| Legible contrast | mean 0.60 | **mean 0.71** |
| Coverage, gaps, continuity, variety | unchanged | unchanged |

`ab-N-blind.png` / `ab-N-measured.png` are the same frames rendered both ways.

## Scorecard

`packages/shared/src/quality/score.ts` turns caption quality into numbers so a
change can be shown not to regress. Every check exists because it caught a real
defect: a transcript that stopped at 70% of the audio and reported success; text
placed across a face; a block teleporting between corners.

```bash
pnpm --filter @kc/shared exec tsx scripts/score.ts design.json   # text metrics
# pixel metrics need a browser: /harness?score=1
```

## End-to-end harness

Runs the real pipeline against a real clip — no mocks — because the parts most
likely to break (canvas metrics, font loading, WebCodecs) cannot run in Node.

```bash
node scripts/harness-server.mjs     # serves test.mp4, writes results to disk
pnpm dev
open http://localhost:5173/harness
```

| Mode | What it does |
| --- | --- |
| `?auto=1` | Full run: probe → audio → transcribe → verify → measure → Gemma → MP4 |
| `?relayout=1` | A/B the layout engine on a fixed transcript. No AI, repeatable |
| `?score=1` | Score an existing `design.json` against freshly measured frames |
| `?storage=1` | Upload → album → asset row → signed read → byte compare → Range |

Only the full run spends AI quota; the other three are free and deterministic,
which is what makes them usable as regression checks.

Verified against `test.mp4` (12.1s, 960×720, H.264/AAC):

- transcript: *"We were too close to the stars / I never knew somebody like you…"*
- Gemma chose `anchor-bottom`, `cascade-left`, `offset-hero`; heroes **Stars**,
  **Knew**, **Falling**, all set in Style Script
- export: 12.12s H.264 960×720 with AAC stereo audio intact
- Immich: 1,139,682 bytes round-tripped byte-identical, Range → HTTP 206

## Commands

```bash
pnpm dev            # web app
pnpm dev:worker     # worker
pnpm build          # production build
pnpm typecheck      # all packages
pnpm --filter @kc/shared exec tsx scripts/smoke.ts   # composer sanity check
```
