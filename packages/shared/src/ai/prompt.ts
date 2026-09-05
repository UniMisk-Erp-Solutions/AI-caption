import { ANIMATION_REGISTRY } from '../design/animations';
import { COMPOSITION_REGISTRY } from '../design/compositions';
import { FONT_REGISTRY } from '../design/fonts';
import { getPreset } from '../design/presets';
import type { DesignRequest, RedesignSceneRequest } from '../schemas/ai';

/**
 * Prompt construction for the creative-director pass.
 *
 * The model's whole job is four decisions per scene:
 *   1. how the words break across 1-3 lines
 *   2. which single word becomes the hero
 *   3. which composition template the block sits in
 *   4. where the face/subject is, so text stays off it
 *
 * Everything else - fonts, sizes, tracking, timing, animation, colour - is
 * derived from the preset. Keeping the model's surface this small is what makes
 * the output reliable enough to ship without a human checking every frame.
 */

/* ------------------------------------------------------------------ */
/* Reference tables                                                    */
/* ------------------------------------------------------------------ */

/**
 * Describe one preset, not the whole registry.
 *
 * There are 135 presets; listing them would dominate the prompt and invite the
 * model to shop for a look instead of doing its actual job. The look is already
 * chosen - deterministically, from the transcript and the measured shot mix -
 * so the model is simply told what it is working in.
 */
function presetBrief(id: string): string {
  const preset = getPreset(id);

  const face = (fontId: string) =>
    FONT_REGISTRY[fontId as keyof typeof FONT_REGISTRY]?.family ?? fontId;

  return [
    `${preset.id} - ${preset.description}`,
    `  the sentence is set in ${face(preset.voices.base.fontId)}`,
    `  the hero word is set in ${face(preset.voices.hero.fontId)} at ${preset.voices.hero.sizeScale}x size`,
    `  the accent face is ${face(preset.voices.accent.fontId)}`,
  ].join('\n');
}

function compositionTable(): string {
  return Object.values(COMPOSITION_REGISTRY)
    .map((c) => `- ${c.id} (${c.slots.length} lines max, ${c.orientation}): ${c.vibe}`)
    .join('\n');
}

function animationTable(): string {
  return Object.values(ANIMATION_REGISTRY)
    .map((a) => `- ${a.id}: ${a.vibe}`)
    .join('\n');
}

/* ------------------------------------------------------------------ */
/* System prompt                                                       */
/* ------------------------------------------------------------------ */

export const DESIGN_SYSTEM_PROMPT = `You are an editorial motion-typography designer laying out captions for short-form vertical video (Instagram Reels, TikTok).

You are NOT writing subtitles. Bottom-centred white sans-serif text is a failure.

THE LOOK YOU ARE MAKING
The house style is the font-pairing move: a quiet workhorse face carries the sentence, and exactly ONE word per screen is swapped out to a flowing script or a large display face, set much bigger, sitting inline with the words around it.

Real examples of the target:

    a holi-day in my  Life  as a  girl  in  New York  city
                      ^^^^ hero word, script, 2x size

    how to keep your
    9-5 fun.
    ^ no hero: one heavy condensed face, lines jammed tight

    what i  Spend  in a week in  Washington dc.
            ^^^^^ hero

    Love is just too  Weak  of a word!
                      ^^^^ hero

Notice: the sentence stays whole and readable. Only ONE word gets promoted. The promoted word is always the one carrying the meaning - never "the", "in", "my", "a".

YOUR FOUR DECISIONS PER SCENE
1. lines      - break the words into 1 to 3 lines. Lines stack tightly.
2. heroWordIds - pick exactly ONE word (rarely two adjacent ones) to promote.
3. compositionId - which arrangement the block sits in.
4. avoidRegions - where the face and main subject are in the frame image.

HOW TO PICK THE HERO WORD
- The noun or verb the sentence is actually about: learned, Life, Spend, grow, Weak, favourite.
- Never a function word: the, a, in, my, of, to, is, and, that, it.
- Never the same position every scene - vary where it lands.
- If the phrase has no obvious payoff word (pure filler, a list of numbers), return an empty heroWordIds and let the whole line stay in one face.

HOW TO BREAK LINES
- 1 to 4 words per line. Short lines. Never a paragraph.
- Break so the hero word sits at the start or end of its line, where it has air.
- Break at grammatical joints: after a preposition, before a verb.
- Do not orphan a single function word on its own line.

HOW TO PLACE THE BLOCK
- Read the frame image. Find the face and the main subject.
- Put the text in the emptiest region: sky, wall, floor, blurred background, negative space.
- Return avoidRegions covering the face and subject as normalised 0-1 boxes.
- Never cover a face. Never cover a product or the thing being pointed at.
- Vary the composition across neighbouring scenes so the video does not look like one template repeated.

CONTINUITY
- Choose ONE preset for the whole video and stay in it.
- Match the preset to the footage and the mood, not to the individual scene.
- Consecutive scenes must not use the same compositionId.

HARD RULES
- Never change, add, remove or reorder the words. You only reference word ids.
- Every word id you were given must appear in exactly one line.
- Only use ids from the lists provided. Never invent a font, animation, composition or preset name.
- Output raw JSON only. No markdown fences, no commentary, no explanation.`;

/* ------------------------------------------------------------------ */
/* Response schema description                                         */
/* ------------------------------------------------------------------ */

export function responseShape(): string {
  return `{
  "direction": {
    "preset": "<keep the preset id you were given>",
    "motionLevel": 0.0-1.0,
    "rotationLevel": 0.0-1.0,
    "heroContrast": 0.5-2.0,
    "note": "<one sentence describing the art direction>"
  },
  "scenes": [
    {
      "id": "<scene id exactly as given>",
      "compositionId": "<composition id>",
      "lines": [ { "wordIds": ["w1","w2"] }, { "wordIds": ["w3"] } ],
      "heroWordIds": ["w3"],
      "accentWordIds": [],
      "avoidRegions": [ { "x":0.3, "y":0.1, "width":0.4, "height":0.45, "kind":"face" } ],
      "backdropLuma": 0.0-1.0
    }
  ]
}`;
}

/* ------------------------------------------------------------------ */
/* User payload                                                        */
/* ------------------------------------------------------------------ */

export interface PromptPart {
  type: 'text' | 'image';
  /** Text content, or bare base64 for images. */
  value: string;
  mimeType?: string;
}

/**
 * Build the multimodal turn: a text brief interleaved with one keyframe per
 * scene, each image immediately preceded by the scene it belongs to so the
 * model never has to guess which frame goes with which words.
 */
export function buildDesignPrompt(req: DesignRequest): PromptPart[] {
  const parts: PromptPart[] = [];
  const orientation = req.dimensions.height >= req.dimensions.width ? 'portrait' : 'landscape';

  // The look is already decided, deterministically, from the transcript and
  // the measured shot mix. The model works inside it rather than shopping for
  // one - which also keeps 135 preset descriptions out of the prompt.
  const styleLine = `The art direction for this video is fixed. Work inside it:
${presetBrief(req.style)}`;

  parts.push({
    type: 'text',
    value: `VIDEO
${req.dimensions.width}x${req.dimensions.height} (${orientation})
audio type: ${req.contentType}${req.mood ? `\nmood: ${req.mood}` : ''}
${req.scenes.length} scenes

STYLE
${styleLine}

AVAILABLE COMPOSITIONS
${compositionTable()}
${req.instruction ? `\nUSER INSTRUCTION (obey this above your own preference)\n${req.instruction}\n` : ''}
SCENES
Each scene below is followed by its keyframe image. Study the image before placing text.`,
  });

  for (const scene of req.scenes) {
    parts.push({
      type: 'text',
      value: `\nscene ${scene.id} (${(scene.startMs / 1000).toFixed(2)}s - ${(scene.endMs / 1000).toFixed(2)}s)
words: ${scene.words.map((w) => `${w.id}="${w.text}"`).join(' ')}
full phrase: "${scene.words.map((w) => w.text).join(' ')}"`,
    });
    if (scene.frame) {
      parts.push({ type: 'image', value: scene.frame, mimeType: 'image/webp' });
    }
  }

  parts.push({
    type: 'text',
    value: `\nReturn JSON in exactly this shape, one entry per scene, in the same order:

${responseShape()}

Raw JSON only.`,
  });

  return parts;
}

/* ------------------------------------------------------------------ */
/* Single-scene redesign                                               */
/* ------------------------------------------------------------------ */

export const REDESIGN_SYSTEM_PROMPT = `${DESIGN_SYSTEM_PROMPT}

You are redesigning ONE scene inside a video that already has an established art direction. Keep the same preset. Change the line breaks, the hero word or the composition to satisfy the user's instruction, but the scene must still belong to the same video.`;

export function buildRedesignPrompt(req: RedesignSceneRequest): PromptPart[] {
  const parts: PromptPart[] = [];

  parts.push({
    type: 'text',
    value: `VIDEO
${req.dimensions.width}x${req.dimensions.height}

ESTABLISHED ART DIRECTION (do not change the preset)
preset: ${req.direction.preset}
${req.direction.note ? `note: ${req.direction.note}` : ''}

AVAILABLE COMPOSITIONS
${compositionTable()}
${
  req.neighbourCompositions.length > 0
    ? `\nNeighbouring scenes already use: ${req.neighbourCompositions.join(', ')}. Pick a different one.`
    : ''
}
${req.instruction ? `\nUSER INSTRUCTION\n${req.instruction}` : ''}

SCENE ${req.scene.id} (${(req.scene.startMs / 1000).toFixed(2)}s - ${(req.scene.endMs / 1000).toFixed(2)}s)
words: ${req.scene.words.map((w) => `${w.id}="${w.text}"`).join(' ')}
full phrase: "${req.scene.words.map((w) => w.text).join(' ')}"`,
  });

  if (req.scene.frame) {
    parts.push({ type: 'image', value: req.scene.frame, mimeType: 'image/webp' });
  }

  parts.push({
    type: 'text',
    value: `\nReturn JSON only:

{
  "scene": {
    "id": "${req.scene.id}",
    "compositionId": "<composition id>",
    "lines": [ { "wordIds": ["..."] } ],
    "heroWordIds": ["..."],
    "accentWordIds": [],
    "avoidRegions": [],
    "backdropLuma": 0.5
  }
}`,
  });

  return parts;
}

/* ------------------------------------------------------------------ */
/* Transcription / audio prompts                                       */
/* ------------------------------------------------------------------ */

export const TRANSCRIBE_SYSTEM_PROMPT = `You are a verbatim transcription engine.

Transcribe the audio exactly as spoken or sung. Include filler words (um, like, you know) and repeated words. Do not paraphrase, summarise, correct grammar or clean anything up.

Return every word with its start and end offset in MILLISECONDS from the beginning of the audio.

Return raw JSON only, no markdown:
{
  "language": "<BCP-47 code>",
  "text": "<the full transcript>",
  "words": [ { "id": "w1", "text": "hello", "startMs": 240, "endMs": 610 } ]
}

Word ids must be w1, w2, w3... in spoken order. Timestamps must be strictly increasing and must not overlap.`;

export function buildAnalysisPrompt(opts: {
  mode: 'auto' | 'speech' | 'song';
  timedText: string;
  userLyrics?: string;
}): string {
  const modeHint =
    opts.mode === 'song'
      ? 'The user says this is a song. Focus on hearing the sung lyrics accurately through the instrumentation, reverb and any layered or autotuned vocals.'
      : opts.mode === 'speech'
        ? 'The user says this is speech. The existing transcript is likely close - only correct clear mishearings.'
        : 'Determine for yourself whether this is speech, singing, both, or instrumental only.';

  return `Listen to the audio and verify the transcript below.

${modeHint}

An automatic transcriber produced:
"${opts.timedText}"
${
  opts.userLyrics
    ? `\nThe user supplied the correct words. Treat this as authoritative and return it verbatim as correctedText:\n"${opts.userLyrics}"`
    : ''
}

Return the corrected wording with the same number of words wherever possible, so it can be aligned back onto the existing timings.

Raw JSON only:
{
  "contentType": "speech" | "song" | "mixed" | "instrumental" | "unknown",
  "language": "<BCP-47 code>",
  "correctedText": "<the corrected transcript>",
  "confidence": 0.0-1.0,
  "mood": "<a few words on the mood and energy, for the design pass>"
}`;
}

export { animationTable };
