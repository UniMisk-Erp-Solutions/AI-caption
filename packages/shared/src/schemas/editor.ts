import { z } from 'zod';
import { ANIMATION_IDS } from '../design/animations';
import { COMPOSITION_IDS } from '../design/compositions';
import { FONT_IDS } from '../design/fonts';
import { PRESET_IDS } from '../design/presets';

/**
 * Project state schema.
 *
 * Everything is normalised: positions and sizes are fractions of the frame, not
 * pixels, so the same JSON drives a 320px preview and a 1080x1920 export.
 *
 * The important structural choice is `runs`. A caption line is not one string
 * in one font - it is a sequence of styled runs that flow inline, so a single
 * line can read
 *
 *     a holi-day in my  Life  as a  girl
 *
 * with `Life` set in 2x Great Vibes while everything around it stays in DM
 * Sans. That is the whole aesthetic, and it has to live in the data model
 * rather than being faked at render time.
 */

const enumFrom = <T extends string>(values: readonly T[]) =>
  z.string().refine((v): v is T => (values as readonly string[]).includes(v), {
    message: `must be one of: ${values.join(', ')}`,
  });

export const fontIdSchema = enumFrom(FONT_IDS as readonly string[]);
export const animationIdSchema = enumFrom(ANIMATION_IDS as readonly string[]);
export const compositionIdSchema = enumFrom(COMPOSITION_IDS as readonly string[]);
export const presetIdSchema = enumFrom(PRESET_IDS as readonly string[]);

export const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex colour like #FFFFFF');

// `Emphasis` itself is declared in design/presets, which owns the voice cast.
export const emphasisSchema = z.enum(['base', 'hero', 'accent', 'micro']);

export const textTransformSchema = z.enum(['none', 'uppercase', 'lowercase', 'title']);
export type TextTransform = z.infer<typeof textTransformSchema>;

/* ------------------------------------------------------------------ */
/* Transcript                                                          */
/* ------------------------------------------------------------------ */

export const transcriptWordSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  confidence: z.number().min(0).max(1).optional(),
});

export type TranscriptWord = z.infer<typeof transcriptWordSchema>;

export const contentTypeSchema = z.enum(['speech', 'song', 'mixed', 'instrumental', 'unknown']);
export type ContentType = z.infer<typeof contentTypeSchema>;

export const transcriptSchema = z.object({
  language: z.string().default('en'),
  contentType: contentTypeSchema.default('unknown'),
  words: z.array(transcriptWordSchema),
});

export type Transcript = z.infer<typeof transcriptSchema>;

/* ------------------------------------------------------------------ */
/* Text runs                                                           */
/* ------------------------------------------------------------------ */

export const textRunSchema = z.object({
  id: z.string().min(1),
  /** Rendered text for this run, after any case transform is applied. */
  text: z.string(),
  /** Transcript words this run came from. Empty for manually added text. */
  wordIds: z.array(z.string()).default([]),
  /** Which voice of the preset this run is set in. */
  emphasis: emphasisSchema.default('base'),

  fontId: fontIdSchema,
  fontWeight: z.number().int().min(100).max(900).default(400),
  italic: z.boolean().default(false),
  /** Size multiplier relative to the layer's fontSize. */
  sizeScale: z.number().min(0.1).max(6).default(1),
  /** Letter-spacing in em. */
  letterSpacing: z.number().min(-0.2).max(1).default(0),
  /** Vertical nudge in em - lets a script sit optically level with a sans. */
  baselineShift: z.number().min(-1.5).max(1.5).default(0),
  color: colorSchema.default('#FFFFFF'),
  /** Per-run opacity, multiplied with the layer's. */
  opacity: z.number().min(0).max(1).default(1),
  /**
   * The words before any case transform, so case can be changed back and forth
   * without losing information. Rebuilt from the transcript when absent.
   */
  rawText: z.string().default(''),
  /** Case currently applied to `rawText` to produce `text`. */
  textTransform: textTransformSchema.default('none'),
  /**
   * Negative tracking applied only where this run meets its neighbours, in em.
   * Lets a script swash tuck under the word beside it the way it would if a
   * designer had kerned the pair by hand.
   */
  tuckBefore: z.number().min(-1).max(0.5).default(0),
  tuckAfter: z.number().min(-1).max(0.5).default(0),
  /** Force a line break before this run, regardless of measured width. */
  breakBefore: z.boolean().default(false),
});

export type TextRun = z.infer<typeof textRunSchema>;

/* ------------------------------------------------------------------ */
/* Caption layers                                                      */
/* ------------------------------------------------------------------ */

export const captionLayerSchema = z.object({
  id: z.string().min(1),
  /** Which transcript words this layer covers, in order. */
  wordIds: z.array(z.string()).default([]),
  role: z.enum(['lead', 'hero', 'tail', 'accent']).default('hero'),

  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),

  /** Anchor position, 0..1 of frame width/height. */
  x: z.number().min(-0.5).max(1.5),
  y: z.number().min(-0.5).max(1.5),
  /** Wrap width as a fraction of frame width. */
  maxWidth: z.number().min(0.05).max(1.2).default(0.8),
  rotation: z.number().min(-180).max(180).default(0),

  /** Base size for the layer, as a fraction of frame height. Runs scale off it. */
  fontSize: z.number().min(0.008).max(0.6),
  /** Under 1 makes stacked lines interlock. */
  lineHeight: z.number().min(0.5).max(3).default(0.95),

  textAlign: z.enum(['left', 'center', 'right']).default('left'),
  opacity: z.number().min(0).max(1).default(1),
  /** 0..1 drop-shadow strength for legibility over busy footage. */
  shadow: z.number().min(0).max(1).default(0.35),
  background: z
    .object({
      color: colorSchema,
      opacity: z.number().min(0).max(1),
      paddingX: z.number().min(0).max(0.5),
      paddingY: z.number().min(0).max(0.5),
      radius: z.number().min(0).max(0.5),
    })
    .nullable()
    .default(null),

  enterAnimation: animationIdSchema.default('fade-up'),
  exitAnimation: animationIdSchema.default('fade'),
  enterDurationMs: z.number().int().min(0).max(4000).default(500),
  exitDurationMs: z.number().int().min(0).max(4000).default(300),

  zIndex: z.number().int().min(0).max(999).default(1),
  /** True once the user has touched this layer - AI regeneration preserves it. */
  locked: z.boolean().default(false),

  runs: z.array(textRunSchema).min(1),
});

export type CaptionLayer = z.infer<typeof captionLayerSchema>;

/** Plain text of a layer, for transcripts, search and accessibility. */
export function layerText(layer: CaptionLayer): string {
  return layer.runs.map((r) => r.text).join(' ').replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

export const avoidRegionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
  kind: z.enum(['face', 'subject', 'text', 'other']).default('subject'),
});

export type AvoidRegion = z.infer<typeof avoidRegionSchema>;

export const captionSceneSchema = z.object({
  id: z.string().min(1),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  wordIds: z.array(z.string()).default([]),
  keyframeTimestampMs: z.number().int().min(0),
  compositionId: compositionIdSchema.default('cascade-left'),
  avoidRegions: z.array(avoidRegionSchema).default([]),
  /** Brightness behind the text, 0..1. Drives automatic contrast handling. */
  backdropLuma: z.number().min(0).max(1).default(0.5),
  layers: z.array(captionLayerSchema),
});

export type CaptionScene = z.infer<typeof captionSceneSchema>;

/* ------------------------------------------------------------------ */
/* Project direction                                                   */
/* ------------------------------------------------------------------ */

export const artDirectionSchema = z.object({
  preset: presetIdSchema.default('SCRIPT_EDITORIAL'),
  /** Overrides for the preset's cast. Null keeps the preset's own choice. */
  baseFont: fontIdSchema.nullable().default(null),
  heroFont: fontIdSchema.nullable().default(null),
  accentFont: fontIdSchema.nullable().default(null),
  palette: z.tuple([colorSchema, colorSchema, colorSchema]).default(['#FFFFFF', '#EDE8E0', '#C9BFAE']),
  motionLevel: z.number().min(0).max(1).default(0.4),
  rotationLevel: z.number().min(0).max(1).default(0.15),
  /** Multiplier on the preset base size. */
  scale: z.number().min(0.5).max(2).default(1),
  /** Multiplier on how much bigger hero words get. 1 = the preset's own ratio. */
  heroContrast: z.number().min(0.5).max(2).default(1),
  /** One sentence of intent, shown in the UI and fed back on regeneration. */
  note: z.string().max(400).default(''),
});

export type ArtDirection = z.infer<typeof artDirectionSchema>;

/* ------------------------------------------------------------------ */
/* Editor state                                                        */
/* ------------------------------------------------------------------ */

export const editorStateSchema = z.object({
  version: z.literal(1).default(1),
  project: z.object({
    width: z.number().int().min(64).max(7680),
    height: z.number().int().min(64).max(7680),
    fps: z.number().min(1).max(120).default(30),
    durationMs: z.number().int().min(0),
  }),
  transcript: transcriptSchema,
  design: z.object({
    direction: artDirectionSchema,
    scenes: z.array(captionSceneSchema),
  }),
  /** Bumped on every mutation; used to resolve local-vs-remote on recovery. */
  revision: z.number().int().min(0).default(0),
  updatedAt: z.number().int().min(0).default(0),
});

export type EditorState = z.infer<typeof editorStateSchema>;

export function emptyEditorState(opts: {
  width: number;
  height: number;
  fps: number;
  durationMs: number;
}): EditorState {
  return editorStateSchema.parse({
    version: 1,
    project: opts,
    transcript: { language: 'en', contentType: 'unknown', words: [] },
    design: { direction: {}, scenes: [] },
    revision: 0,
    updatedAt: Date.now(),
  });
}

/* ------------------------------------------------------------------ */
/* Case handling                                                       */
/* ------------------------------------------------------------------ */

const LOWER_IN_TITLE = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet',
  'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'is', 'it',
]);

/**
 * Apply a case policy. `title` deliberately keeps small words lowercase - the
 * reference captions read "in my Life", never "In My Life".
 */
export function applyCase(text: string, mode: TextTransform, isFirst = true): string {
  switch (mode) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'title':
      return text
        .split(/(\s+)/)
        .map((token, i) => {
          if (/^\s+$/.test(token)) return token;
          const lower = token.toLowerCase();
          const bare = lower.replace(/[^\p{L}\p{N}']/gu, '');
          if (i > 0 && LOWER_IN_TITLE.has(bare)) return lower;
          if (!isFirst && i === 0 && LOWER_IN_TITLE.has(bare)) return lower;
          return lower.replace(/\p{L}/u, (c) => c.toUpperCase());
        })
        .join('');
    case 'none':
    default:
      return text;
  }
}
