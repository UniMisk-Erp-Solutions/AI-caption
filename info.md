AI KINETIC CAPTION VIDEO EDITOR
Complete Product + Technical Architecture
Important instruction to Claude Code
Build this application according to this specification. Do not unnecessarily over-engineer it, replace the selected architecture, introduce paid infrastructure, introduce locally hosted AI models, or add services that are not required.
The goal is a working, polished MVP first.
The application must be designed so that it can later scale without rewriting the entire architecture.
1. Product Goal
Build a web application where a user can:
1. Sign up/login.
2. Upload a video.
3. Automatically detect speech, lyrics, or mixed vocal audio.
4. Generate a highly accurate transcript.
5. Generate word-level timestamps.
6. Analyze frames from the video.
7. Use AI to create aesthetic kinetic typography across the video.
8. Place text in different areas of the screen.
9. Use different fonts.
10. Use different sizes.
11. Rotate text.
12. Use vertical/horizontal text.
13. Emphasize selected words.
14. Animate individual text blocks.
15. Avoid important subjects/faces when positioning text.
16. Edit every generated element manually.
17. Save the project automatically.
18. Close the browser and continue editing later.
19. Export the finished video as MP4.
20. Reopen previously exported/project videos.
The result should feel closer to an editorial Instagram / Pinterest / magazine-style video editor than traditional bottom-centered subtitles.
2. Main User Experience
Example uploaded audio:
I actually learned so much this year and these are the things that helped me grow.

The application should NOT generate:
I ACTUALLY LEARNED SO MUCH THIS YEAR
centered at the bottom.
It should be capable of creating compositions such as:
     what I actually

          LEARNED

              this year
then:
things that

        HELPED ME

grow.
Each part may have a different:
- font
- size
- weight
- position
- angle
- timing
- entrance
- exit
- letter spacing
- capitalization
But everything must still feel like one intentionally designed system.
3. Non-Negotiable Requirements
The implementation must obey these rules:
- No local LLM.
- No local Whisper model.
- No GPU server.
- No Python AI backend.
- No dedicated video-rendering server for MVP.
- No paid storage requirement for initial testing.
- No Gemini API keys exposed to React.
- No R2 secret exposed to React.
- Supabase Service Role must never be exposed in the frontend.
- Original transcript must remain editable.
- AI-generated design must remain editable.
- Project must autosave.
- Original uploaded video must survive browser refresh after upload completes.
- Videos must not be stored inside Postgres.
- Do not store video blobs/base64 in Supabase database.
- Do not ask the LLM to generate arbitrary CSS.
- Do not let the LLM invent arbitrary fonts or animations.
- AI must choose only from approved design tokens.
4. Final Technology Stack
Frontend
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
Zustand
TanStack Query
React Router
React Konva
Dexie / IndexedDB
Zod
Media processing
Use:
Mediabunny
WebCodecs
Canvas / OffscreenCanvas
Mediabunny is browser-native, supports reading/writing MP4 and many other formats, uses WebCodecs for hardware-accelerated media operations, and is free for closed-source commercial use under MPL-2.0. npm
Do not introduce FFmpeg.wasm unless a specific unsupported-media fallback genuinely requires it.
5. Backend
Use two backend components.
Supabase
Use Supabase for:
Authentication
Users
Projects
Project state
Transcript
Caption layouts
Autosave
Project metadata
Export metadata
Usage counters
Do NOT use Supabase Storage for main video storage.
Current Supabase Free includes 50,000 MAU, 500 MB database, and 1 GB file storage; the database is more than enough for project JSON because caption/project state is tiny compared with video files. Supabase
Cloudflare Worker
Use a Cloudflare Worker as the secure API gateway.
Responsibilities:
JWT verification
Gemini API communication
Gemma API communication
R2 signed uploads
R2 signed downloads
R2 deletes
usage enforcement
input validation
rate limiting
6. File Storage
Use:
Cloudflare R2
Bucket:
caption-ai-media
The R2 bucket must remain private.
Never expose the entire bucket publicly.
Current R2 Standard free allowance:
10 GB-month storage
1,000,000 Class A operations/month
10,000,000 Class B operations/month
Free Internet egress
``` citeturn785782search0


Cloudflare does require enabling the R2 subscription/checkout flow even though the included usage can remain at $0. citeturn694690search3

---

# 7. What Gets Stored Where

## Supabase

Store:

```text
user
project title
duration
dimensions
aspect ratio
fps
upload state
R2 object keys
transcript
word timestamps
caption scenes
caption layers
fonts
animations
positions
AI style
manual edits
autosave state
export information
timestamps
R2
Store only larger binary assets:
original uploaded video
project thumbnail
finished exported videos
optional user-uploaded fonts later
optional image assets later
Do NOT permanently store
Do not permanently store:
temporary extracted audio
temporary AI keyframes
temporary waveform data
temporary preview files
Generate these when required and discard them afterward.
This keeps the 10 GB free R2 allowance usable for actual projects.
8. R2 File Structure
Use the following exact structure:
users/
  {userId}/
    projects/
      {projectId}/
        source/
          original-{uuid}.mp4

        thumbnail/
          thumbnail.webp

        exports/
          export-{timestamp}.mp4
Never accept a complete R2 object path directly from a client.
The server generates it.
9. Upload Architecture
Do NOT upload the video:
Browser
→ Worker
→ R2
That unnecessarily routes large files through the Worker.
Use:
Browser
        │
        │ request upload permission
        ▼
Cloudflare Worker
        │
        │ validates Supabase JWT
        │ generates signed PUT
        ▼
Browser
        │
        │ direct upload
        ▼
Cloudflare R2
Flow:
POST /storage/upload-url
Request:
{
  "projectId": "...",
  "mimeType": "video/mp4",
  "size": 43523912
}
Worker verifies:
authenticated user
project ownership
MIME type
file size
project limits
Worker generates:
object key
presigned PUT URL
expiration
Suggested expiration:
10 minutes
Browser uploads the File directly to R2.
After completion:
POST /storage/complete
and Supabase asset metadata is updated.
10. MVP Upload Limits
Initially restrict videos to:
maximum duration: 5 minutes
recommended duration: under 90 seconds
maximum source size: 250 MB
formats:
MP4
MOV
WebM
The UI should tell the user if their browser cannot decode the codec before starting AI generation.
Instagram/Reel content is the initial target.
11. AI Architecture
Three AI responsibilities exist.
Do NOT combine them.
AI #1
Audio → timestamped transcript

AI #2
Audio → semantic verification / lyrics detection

AI #3
Transcript + images → visual design
12. AI #1 — Primary Transcription
Use:
gemini-3.5-transcribe
This is the primary transcription engine.
Enable:
verbatim
word-level timestamps
automatic language detection
Gemini 3.5 Transcribe currently supports exact start/end offsets for individual words. Google AI for Developers
Request configuration conceptually:
{
  "transcription_config": {
    "mode": {
      "type": "verbatim",
      "timestamp_granularities": ["word"]
    }
  }
}
Output must be converted into our own provider-independent format.
Example:
{
  "language": "en",
  "text": "I wanna show you off",
  "words": [
    {
      "id": "w1",
      "text": "I",
      "startMs": 1240,
      "endMs": 1380
    },
    {
      "id": "w2",
      "text": "wanna",
      "startMs": 1380,
      "endMs": 1710
    },
    {
      "id": "w3",
      "text": "show",
      "startMs": 1710,
      "endMs": 1950
    },
    {
      "id": "w4",
      "text": "you",
      "startMs": 1950,
      "endMs": 2100
    },
    {
      "id": "w5",
      "text": "off",
      "startMs": 2100,
      "endMs": 2420
    }
  ]
}
Never make the rest of the application dependent on Google's raw response format.
13. AI #2 — Speech / Song Verification
Use:
gemini-3.5-flash
This model accepts audio and currently has free-tier usage. Google AI for Developers
This pass determines:
speech
song
mixed
instrumental
unknown
It should simultaneously return a corrected transcript.
Example response:
{
  "contentType": "song",
  "language": "en",
  "correctedText": "I wanna show you off",
  "confidence": 0.91
}
This is useful because lyrics combined with:
instrumentation
reverb
backing vocals
autotune
layered voices
may be harder than normal speech.
14. Transcript Reconciliation
We now have:
A = word-timestamp transcript
B = semantic corrected transcript
Do NOT throw away timestamps from A.
Build a text-alignment algorithm.
Normalize before comparison:
lowercase
strip unnecessary punctuation
normalize apostrophes
normalize spaces
Then perform token alignment using:
LCS
or
dynamic programming edit-distance alignment
Example:
Timed:
I want to show you all
Verifier:
I wanna show you off
Produce:
I wanna show you off
while preserving/interpolating timing information.
Matched words keep timestamps.
Changed words inherit timing from the aligned token.
Inserted words interpolate between neighboring words.
15. User Controls for Transcription
Upload screen:
Audio type

● Auto
○ Speech
○ Song / Lyrics
Auto is default.
Auto
Run:
Transcribe
+
Flash verification
Speech
Transcribe is authoritative.
Lyrics
Verifier receives stronger instruction to identify sung words precisely.
The user must always be able to manually change transcript text afterward.
16. User-Provided Lyrics
Provide optional:
Paste lyrics / transcript
If the user already knows the exact words, their provided text becomes the text authority.
AI is then only responsible for aligning the provided text with audio timings.
This dramatically improves difficult songs.
17. Scene Creation
Do NOT send every individual word to Gemma as a separate caption.
First create semantic caption scenes.
Start with deterministic grouping.
Consider:
sentence boundaries
punctuation
pauses > 450–600ms
phrase boundaries
maximum reading length
Typical target:
2–8 words per scene
0.8–3 seconds per scene
Example:
Transcript:
what I actually learned this year was that consistency matters more than motivation
Scenes:
what I actually learned
this year
was that consistency
matters more
than motivation
Gemma may adjust the grouping afterward.
18. Keyframe Extraction
For every scene, extract one representative video frame.
Use:
middle timestamp of scene
Example:
scene:
2.4s → 4.8s

keyframe:
3.6s
Resize keyframes before AI:
approximately 360–512px long edge
WebP
quality 65–75
Never send full-resolution frames to the model.
Maximum initially:
15–20 keyframes/request
For longer videos, design in batches.
19. AI #3 — Creative Director
Use:
gemma-4-31b-it
Gemma 4 31B is available through Google's Gemini API and accepts text + images. Google AI for Developers
Give Gemma:
transcript
word IDs
word timings
caption scenes
representative keyframes
video dimensions
safe areas
available fonts
available font weights
available animations
available design styles
Gemma should NEVER write JSX.
Gemma should NEVER write CSS.
Gemma should NEVER create arbitrary font names.
Gemma returns design JSON only.
20. Critical AI Design Philosophy
The goal is not:
automatic subtitles
The goal is:
AI-directed kinetic typography
Gemma must behave like:
editorial graphic designer
+
motion typography designer
+
creative director
rather than a subtitle generator.
21. Approved Fonts
Bundle fonts locally through @fontsource.
Start with approximately:
Instrument Serif
Cormorant Garamond
Bodoni Moda
Fraunces
DM Sans
Manrope
Space Grotesk
Inter
Caveat
Libre Baskerville
Archivo
Playfair Display
All font IDs must come from a predefined registry.
Example:
const FONT_REGISTRY = {
  instrumentSerif: {...},
  cormorant: {...},
  bodoni: {...},
  fraunces: {...},
  dmSans: {...}
};
AI receives IDs, not arbitrary font names.
22. Design Presets
Initially create:
EDITORIAL
SOFT_MAGAZINE
FASHION
BOLD_MINIMAL
SCRAPBOOK
VINTAGE
Y2K
CINEMATIC
Each preset specifies:
approved fonts
font hierarchy
animation intensity
maximum rotation
case preference
spacing
caption density
movement level
23. Animation Registry
Start with controlled animation IDs:
none
fade
fade-up
fade-down
slide-left
slide-right
pop
scale-in
blur-in
tracking-in
wipe-left
wipe-up
word-pop
typewriter
rotate-in
flash
mask-reveal
Each animation is implemented once in code.
Example:
animationRegistry["pop"]
Gemma simply says:
{
  "animation": "pop"
}
It cannot generate its own animation implementation.
24. Gemma Design Rules
Gemma must follow these rules:
1. Avoid important faces.
2. Avoid covering important visual subjects.
3. Respect safe margins.
4. Use maximum 1 hero element per scene.
5. Use maximum 3–4 text layers per scene.
6. Prefer 1–2 font families per scene.
7. Prefer maximum 3 primary font families across one project.
8. Do not make every word a different font.
9. Do not animate every word aggressively.
10. Maintain whitespace.
11. Use vertical text sparingly.
12. Use rotation sparingly.
13. Maintain continuity between neighboring scenes.
14. Emphasize meaningful words.
15. Never change transcript wording merely for design.
16. Never add words not spoken unless explicitly asked.
17. Never hide text outside the canvas.
18. Never create illegibly small text.
19. Keep aesthetic consistency.
20. Prioritize intentional composition over randomness.
25. Design Coordinate System
Use normalized positioning.
Example:
{
  "x": 0.52,
  "y": 0.31
}
where:
0 = left/top
1 = right/bottom
This makes project state independent from preview size.
Font size should use normalized design units.
Example:
{
  "fontSize": 0.075
}
Renderer converts this using canvas height or a standard reference dimension.
26. Caption Layer Schema
Use Zod.
Conceptual schema:
CaptionLayer = {
  id: string,

  text: string,

  wordIds: string[],

  startMs: number,
  endMs: number,

  x: number,
  y: number,

  maxWidth: number,

  rotation: number,

  fontId: string,
  fontSize: number,
  fontWeight: number,

  lineHeight: number,
  letterSpacing: number,

  textAlign:
    "left" |
    "center" |
    "right",

  textTransform:
    "none" |
    "uppercase" |
    "lowercase",

  color: string,

  opacity: number,

  enterAnimation: string,
  exitAnimation: string,

  enterDurationMs: number,
  exitDurationMs: number,

  zIndex: number
}
27. Caption Scene Schema
CaptionScene = {
  id: string,

  startMs: number,
  endMs: number,

  wordIds: string[],

  keyframeTimestampMs: number,

  stylePreset: string,

  layers: CaptionLayer[]
}
28. Full Editor State
EditorState = {
  version: 1,

  project: {
    width: number,
    height: number,
    fps: number,
    durationMs: number
  },

  transcript: {
    language: string,
    words: TranscriptWord[]
  },

  design: {
    preset: string,
    scenes: CaptionScene[]
  }
}
This JSON becomes the primary saved project state.
29. Gemma Output Validation
Never trust AI JSON.
Pipeline:
Gemma
 ↓
extract JSON
 ↓
Zod validation
 ↓
valid?
 ├─ yes → use
 └─ no
      ↓
   repair request once
If repair fails:
fallback deterministic layout
Never break the project editor because the LLM generated invalid JSON.
30. Gemma System Prompt
Use a system prompt approximately like this:
You are a professional editorial motion typography designer.

Your task is to create intentional kinetic typography layouts for short-form social video.

You are NOT creating ordinary subtitles.

Study the provided transcript, timing and video frames.

Use typography to complement the composition of each frame.

Important rules:

- Never alter the transcript wording.
- Never invent text.
- Never cover important faces or primary subjects.
- Use negative space.
- Create visual hierarchy.
- Use one hero idea per scene.
- Do not make every word large.
- Do not randomly rotate text.
- Do not randomly mix fonts.
- Keep a recognizable visual language across the entire video.
- Use vertical text only where composition benefits.
- Use only provided font IDs.
- Use only provided animation IDs.
- Use only valid JSON.
- Do not include markdown.
- Do not include explanations.
Then supply the JSON schema.
31. Face / Subject Avoidance
We will not run another local machine-learning model.
Instead, Gemma should analyze every supplied keyframe.
Ask Gemma to identify:
primary subject region
face region
useful negative-space regions
areas unsuitable for text
Example scene analysis:
{
  "avoidRegions": [
    {
      "x": 0.35,
      "y": 0.13,
      "width": 0.32,
      "height": 0.42
    }
  ]
}
Text placement must avoid these regions.
32. Main Editor UI
Desktop layout:
┌────────────────────────────────────────────────────────┐
│ logo   Project Name       Saved ✓        Export         │
├──────────────┬─────────────────────────┬─────────────────┤
│              │                         │                 │
│ STYLE        │                         │ PROPERTIES      │
│              │      VIDEO PREVIEW      │                 │
│ Fonts        │                         │ Text            │
│ Presets      │                         │ Font            │
│ Animations   │                         │ Size            │
│ AI tools     │                         │ Weight          │
│              │                         │ Align           │
│              │                         │ Rotation        │
│              │                         │ Animation       │
├──────────────┴─────────────────────────┴─────────────────┤
│                                                        │
│                    TIMELINE                            │
│                                                        │
└────────────────────────────────────────────────────────┘
33. Video Preview
Preview consists of:
HTML video element
+
transparent Konva canvas
Keep video time and canvas state synchronized.
For every current timestamp:
determine active scene
determine active layers
calculate animation progress
render text
34. Text Editing
Every caption object should support:
click
drag
resize
rotate
change text
change font
change size
change weight
change alignment
change color
change animation
change timing
duplicate
delete
Double-click should enter direct text-edit mode.
35. Transcript Editor
Include separate transcript view.
Each word should know:
text
start
end
If text is changed manually:
- preserve timestamp wherever reasonable;
- do not automatically regenerate all design;
- update linked caption layers.
36. AI Actions Inside Editor
Provide:
Regenerate whole design

Redesign this scene

Make more editorial

Make more minimal

Make more playful

Make typography bolder

Use more whitespace

Reposition text

Try another composition
A scene regeneration must modify only the selected scene.
Do not destroy manual changes in other scenes.
37. Undo / Redo
Use command/history state.
Support:
Ctrl+Z
Ctrl+Shift+Z
Keep at least:
50 history states
History can remain client-side.
Do not send every undo state to Supabase.
38. Autosave Architecture
This is important.
Use three layers.
Layer 1 — React memory
Zustand.
Immediate.
Layer 2 — IndexedDB
Dexie.
Save locally every meaningful state change.
This protects against:
browser crash
network drop
tab accidentally closed
Layer 3 — Supabase
Debounced autosave.
Suggested:
800–1500 ms after last edit
UI:
Saving...
Saved
Offline
Sync failed
39. Project Recovery
When opening:
/project/{projectId}
Flow:
Supabase state
        +
IndexedDB state
        ↓
compare timestamps
        ↓
load newest valid version
If local version is newer:
Unsynced changes recovered
Then sync it.
40. Database Design
Use UUIDs.
profiles
id uuid PK → auth.users.id
display_name text
created_at timestamptz
updated_at timestamptz
projects
id uuid PK
user_id uuid FK
title text

status text

width integer
height integer
fps numeric
duration_ms integer

source_asset_id uuid nullable

editor_state jsonb

thumbnail_key text nullable

created_at timestamptz
updated_at timestamptz
Status values:
draft
uploading
processing
ready
exporting
error
41. Assets Table
assets

id uuid PK
user_id uuid
project_id uuid

type text

provider text

object_key text

mime_type text
size_bytes bigint

duration_ms integer nullable

metadata jsonb

created_at timestamptz
Types:
source_video
thumbnail
export
Provider initially:
r2
42. Transcript Table
transcripts

id uuid
user_id uuid
project_id uuid

language text

full_text text

words jsonb

provider text

content_type text

created_at
updated_at
Provider:
gemini-3.5-transcribe
43. Export Table
exports

id uuid
user_id uuid
project_id uuid

object_key text

width integer
height integer
fps numeric

size_bytes bigint nullable

status text

created_at timestamptz
44. Usage Table
Protect free AI quotas.
usage_events

id uuid
user_id uuid

type text

project_id uuid nullable

quantity numeric

created_at timestamptz
Types:
transcription
audio_analysis
design_generation
scene_regeneration
export
45. RLS
Enable RLS on every user-owned table.
Fundamental policy:
user_id = auth.uid()
Users can:
select their rows
insert their rows
update their rows
delete their rows
and nothing else.
Never rely on hiding IDs in the UI as authorization.
46. Authentication
Start with:
email/password
Google OAuth
Use Supabase Auth.
Do not implement a custom authentication system.
47. Worker Authentication
Every request to protected Worker endpoints should include:
Authorization: Bearer {supabaseAccessToken}
Worker validates Supabase JWT.
Do not trust a user ID supplied in request JSON.
Derive user ID from JWT.
48. API Endpoints
Implement:
GET  /health

POST /storage/upload-url
POST /storage/download-url
POST /storage/delete

POST /ai/transcribe
POST /ai/analyze-audio
POST /ai/design
POST /ai/redesign-scene
49. /ai/transcribe
Input:
multipart audio
projectId
Backend:
verify auth
verify ownership
validate duration/size
send to Gemini 3.5 Transcribe
normalize response
return word timestamps
record usage
50. /ai/analyze-audio
Input:
audio
timed transcript
mode
Gemini 3.5 Flash returns:
{
  "contentType": "speech|song|mixed|unknown",
  "language": "...",
  "correctedText": "...",
  "confidence": 0
}
Server reconciles both transcripts or returns enough data for shared alignment code.
51. /ai/design
Input:
{
  "projectId": "...",

  "dimensions": {
    "width": 1080,
    "height": 1920
  },

  "style": "EDITORIAL",

  "transcript": {},

  "scenes": [],

  "frames": []
}
Frames should be compressed.
Worker sends request to:
gemma-4-31b-it
Validate result with Zod.
Return editor-compatible JSON.
52. /ai/redesign-scene
Only send:
selected scene
selected keyframe
existing project style
surrounding scene context
user instruction
Do not send entire video unnecessarily.
53. API Keys
Frontend .env:
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=
Worker secrets:
GEMINI_API_KEY=

SUPABASE_URL=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

ALLOWED_ORIGIN=
Never prefix secrets with:
VITE_
54. Media Processing
Use Mediabunny/WebCodecs in the browser.
Responsibilities:
read metadata
decode source
extract audio
extract thumbnails
extract AI frames
render export
mux MP4
This avoids a permanent FFmpeg server.
Mediabunny currently supports browser-side MP4 reading/writing, encoding/decoding, conversion, and hardware acceleration via WebCodecs. npm
55. Audio Extraction
When source video is loaded:
video
 ↓
browser media processor
 ↓
mono audio
 ↓
Gemini transcription
Prefer:
16kHz/appropriate compact audio
Do not upload a 100 MB video to Gemini merely to transcribe 40 seconds of audio.
56. Export Engine
Export must run client-side initially.
Pipeline:
R2 source video
      ↓
Mediabunny decoder
      ↓
VideoFrame
      ↓
OffscreenCanvas
      ↓
draw video frame
      ↓
render active kinetic captions
      ↓
output VideoFrame
      ↓
WebCodecs encoder
      ↓
Mediabunny MP4 muxer
      +
original audio
      ↓
MP4
This keeps export infrastructure at $0.
57. Export Resolution
MVP:
1080 × 1920
30 FPS
H.264
AAC
MP4
Later:
720 × 1280
1080 × 1920
2160 × 3840
Do not start with 4K.
58. Browser Compatibility
The editor itself can support modern browsers.
For V1 export, optimize first for:
Chrome
Edge
because WebCodecs support is strongest there.
If export capabilities are missing:
Your browser can edit this project but cannot export it locally.
Please use the latest Chrome or Edge.
Do not silently produce broken files.
59. Upload Export to R2
After local export:
Export Blob
    ↓
request signed URL
    ↓
upload directly to R2
Save export metadata to Supabase.
Allow:
Download
Open
Delete
60. Project Dashboard
Cards should display:
thumbnail
project title
duration
last edited
status
Actions:
Open
Rename
Duplicate
Delete
61. Delete Project
Deletion must remove:
R2 source
R2 thumbnail
R2 exports
Supabase records
IndexedDB state
Never leave orphaned large videos.
62. Free-Tier Storage Controls
R2 only gives 10 GB-month free at the moment. Cloudflare Docs
For MVP enforce application limits such as:
250 MB max/video

10 projects/user initially

500 MB–1 GB storage cap/user
Also display:
Storage used
Do not allow one tester to consume the whole bucket.
63. AI Usage Protection
For alpha:
max transcription length: 5 min
max complete AI designs/day/user: 10
max regenerations/project: configurable
Store limits as configuration rather than hard-code them inside UI components.
64. Style Consistency
Generate project-level direction first.
Example:
{
  "style": {
    "primaryFont": "instrumentSerif",
    "secondaryFont": "dmSans",
    "accentFont": "caveat",

    "motionLevel": "medium",
    "rotationLevel": "low",

    "composition": "editorial",

    "heroScale": 1.7
  }
}
Then design individual scenes under that direction.
Do not let every scene look like a completely different template.
65. Rendering Animations
Animations must be deterministic.
For any:
timestamp t
the same layer must always have the same:
position
scale
opacity
rotation
clip
Do not use uncontrolled CSS animations.
Use:
animationValue = f(currentTime, layer)
This is essential so preview and export match.
66. Example Animation
For pop:
0%       scale 0.75 opacity 0
55%      scale 1.07 opacity 1
100%     scale 1 opacity 1
Use easing.
Preview and export use the exact same function.
67. Important Editing Architecture
There must be one rendering engine.
Do NOT separately implement:
preview renderer
and
export renderer
with different layout logic.
Shared functions should calculate:
active layers
layout
font style
animation state
The preview draws them to Konva.
Export draws equivalent properties to Canvas.
68. Responsive UI
Desktop is priority.
Minimum good editing viewport:
1280px wide
Mobile can initially support:
dashboard
project viewing
simple transcript edits
Full design editing on mobile can come later.
69. Loading UX
Processing screen should have steps:
Uploading video             ✓
Understanding audio         ✓
Creating transcript         ✓
Analyzing composition       ●
Designing captions          ○
Preparing editor            ○
Never leave a generic spinner for 40 seconds.
70. Error Recovery
If transcription fails:
Retry transcription
If audio analysis fails:
continue with primary transcript
If Gemma fails:
retry
or
use basic layout
If project autosave fails:
continue saving to IndexedDB
If R2 export upload fails:
finished MP4 should still remain downloadable locally
71. Privacy Note
For development using Google's free Gemini tier, Google currently marks free-tier requests as potentially being used to improve its products, whereas paid-tier requests are marked differently. Google AI for Developers
Therefore:
During MVP testing add a small note:
Do not upload confidential or highly sensitive videos during the free beta.
This can be revisited when moving to paid production infrastructure.
72. Frontend Repository Structure
Use:
/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ components/
│  │  │  ├─ features/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ dashboard/
│  │  │  │  ├─ upload/
│  │  │  │  ├─ transcript/
│  │  │  │  ├─ editor/
│  │  │  │  ├─ timeline/
│  │  │  │  ├─ captions/
│  │  │  │  └─ export/
│  │  │  │
│  │  │  ├─ media/
│  │  │  ├─ renderer/
│  │  │  ├─ animations/
│  │  │  ├─ fonts/
│  │  │  ├─ styles/
│  │  │  ├─ stores/
│  │  │  ├─ hooks/
│  │  │  ├─ lib/
│  │  │  └─ pages/
│  │  │
│  │  └─ ...
│  │
│  └─ worker/
│     ├─ src/
│     │  ├─ routes/
│     │  ├─ auth/
│     │  ├─ gemini/
│     │  ├─ r2/
│     │  ├─ validation/
│     │  └─ index.ts
│
├─ packages/
│  └─ shared/
│     ├─ schemas/
│     ├─ types/
│     ├─ transcript/
│     ├─ animations/
│     └─ constants/
│
├─ supabase/
│  └─ migrations/
│
└─ package.json
Use a pnpm workspace.
73. Provider Abstractions
Even though we use Google now, don't lock business logic to Google.
Use:
interface TranscriptionProvider {
  transcribe(): Promise<Transcript>;
}

interface AudioAnalysisProvider {
  analyze(): Promise<AudioAnalysis>;
}

interface CaptionDesignProvider {
  generateDesign(): Promise<CaptionDesign>;
}
Implement:
GeminiTranscriptionProvider
GeminiAudioAnalysisProvider
GemmaDesignProvider
Later Whisper or another provider can be added without rewriting the editor.
74. Hosting
Use:
React frontend:
Vercel Free

Database/Auth:
Supabase Free

Media:
Cloudflare R2

API:
Cloudflare Worker

AI:
Google Gemini API
No Node VPS is required.
75. Main Architecture
                        ┌──────────────────┐
                        │      USER        │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │    React App     │
                        │    on Vercel     │
                        └───────┬──────────┘
                                │
             ┌──────────────────┼───────────────────┐
             │                  │                   │
             ▼                  ▼                   ▼
       ┌───────────┐     ┌────────────┐      ┌────────────┐
       │ Supabase  │     │Cloudflare  │      │ Browser    │
       │ Auth + DB │     │    R2      │      │ Media      │
       │           │     │            │      │ Engine     │
       └───────────┘     └────────────┘      └────────────┘
                                ▲                   │
                                │                   │
                       signed upload               │
                                │                   │
                        ┌───────┴──────────┐        │
                        │ Cloudflare Worker│◄───────┘
                        └───────┬──────────┘
                                │
                    ┌───────────┼────────────┐
                    │           │            │
                    ▼           ▼            ▼
             Gemini 3.5    Gemini 3.5    Gemma 4
             Transcribe      Flash        31B IT
                    │           │            │
                    └───────────┼────────────┘
                                │
                                ▼
                        Caption Design JSON
                                │
                                ▼
                         React/Konva Editor
                                │
                                ▼
                       Browser video render
                                │
                                ▼
                              MP4
                                │
                                ▼
                               R2
76. Full Project Processing Flow
USER UPLOADS VIDEO
        │
        ├──────────────► Direct upload → R2
        │
        ▼
Browser reads media
        │
        ├── metadata
        ├── audio
        └── thumbnail
        │
        ▼
Gemini 3.5 Transcribe
        │
        ▼
word-level timestamp transcript
        │
        ▼
Gemini 3.5 Flash
        │
        ├── speech/song detection
        └── transcript verification
        │
        ▼
Transcript reconciliation
        │
        ▼
Scene grouping
        │
        ▼
Browser extracts scene frames
        │
        ▼
Gemma 4 31B
        │
        ▼
Aesthetic caption design JSON
        │
        ▼
Zod validation
        │
        ▼
React editor
        │
        ├── autosave → Supabase
        └── local backup → IndexedDB
        │
        ▼
User edits
        │
        ▼
Browser export
        │
        ▼
MP4
        │
        ├── Download
        └── R2
77. Implementation Phases
Claude Code should implement this sequentially.
Phase 1 — Foundation
Build:
monorepo
React
Worker
Supabase client
shared types
routing
authentication
dashboard skeleton
Verify login/logout before continuing.
Phase 2 — Database
Create migrations.
Implement:
projects
assets
transcripts
exports
usage
RLS
Test that User A cannot access User B.
Phase 3 — R2
Implement:
signed upload
signed read
delete
metadata
Test refresh recovery.
A user must be able to:
upload
close browser
return
play video again
before continuing.
Phase 4 — Media Engine
Implement:
metadata extraction
thumbnail generation
audio extraction
frame extraction
No AI yet.
Phase 5 — Transcription
Implement:
Gemini 3.5 Transcribe
word timestamps
normalization
storage
transcript editor
Verify transcript editing.
Phase 6 — Audio Verification
Implement:
speech/song classification
corrected text
alignment
Test:
spoken podcast clip
song clip
speech + music
Phase 7 — Caption Engine
Implement deterministic captions manually before AI.
Create sample scenes and verify:
fonts
positions
animations
timeline sync
dragging
rotation
resizing
Do NOT introduce Gemma until the renderer works.
Phase 8 — Gemma
Add:
frame analysis
caption design prompt
structured JSON
Zod validation
fallback
Phase 9 — Autosave
Add:
Zustand
IndexedDB
Supabase debounce
recovery
Phase 10 — Export
Add:
Mediabunny
WebCodecs
Canvas composition
H.264
AAC
MP4
download
R2 upload
Phase 11 — Polish
Add:
undo
redo
keyboard shortcuts
loading stages
error handling
AI scene regeneration
responsive layout
storage limits
usage limits
78. MVP Definition of Done
The project is not complete merely because AI returns text.
MVP is complete only when the following flow works:
1. User registers.
2. User uploads a 30-second MP4.
3. Upload persists in R2.
4. Project appears in dashboard.
5. Audio is extracted.
6. Words are accurately detected.
7. Individual word timings exist.
8. Scenes are created.
9. Keyframes are analyzed.
10. Gemma generates an aesthetic design.
11. Captions appear around the screen.
12. Different typography is used intentionally.
13. Captions animate.
14. User can drag any caption.
15. User can change its font.
16. User can change its text.
17. User can change its size.
18. User can rotate it.
19. User can change animation.
20. User can edit transcript.
21. Refresh keeps progress.
22. Logging out/in keeps project.
23. Source video still works.
24. MP4 export works.
25. Export includes original audio.
26. Export matches preview.
27. Export is stored in R2.
28. User can download it.
79. Things NOT to Build Yet
Do not waste MVP time on:
teams
collaboration
billing
subscriptions
mobile editor
4K rendering
AI voice generation
video generation
stock media
templates marketplace
cloud rendering cluster
custom font uploads
multi-video timeline
cuts/transitions editor
music library
social publishing
The first product should do one thing extremely well:
Take a video and automatically turn its speech or lyrics into beautiful, editable kinetic typography.

80. Final Technical Decision
Use this architecture exactly for V1:
React + TypeScript
       │
       ├── Supabase
       │      ├── Auth
       │      └── project/editor JSON
       │
       ├── Cloudflare R2
       │      ├── source videos
       │      ├── thumbnails
       │      └── exported MP4
       │
       ├── Cloudflare Worker
       │      ├── security
       │      ├── R2 signed URLs
       │      └── AI proxy
       │
       ├── Gemini 3.5 Transcribe
       │      └── word timings
       │
       ├── Gemini 3.5 Flash
       │      └── song/speech verification
       │
       ├── Gemma 4 31B IT
       │      └── creative typography design
       │
       └── Mediabunny + WebCodecs
              ├── browser media processing
              └── MP4 export