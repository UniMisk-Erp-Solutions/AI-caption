import { z } from 'zod';
import {
  animationIdSchema,
  avoidRegionSchema,
  compositionIdSchema,
  contentTypeSchema,
  fontIdSchema,
  presetIdSchema,
  transcriptWordSchema,
} from './editor';

/**
 * What the AI is actually allowed to say.
 *
 * Note how small this is next to `CaptionLayer`. The model emits no
 * coordinates, no pixel sizes, no line heights, no tracking - it emits
 * *decisions*: which words share a line, which single word is the hero, which
 * composition, which preset. Our code turns those into typography using the
 * preset's font pairing and the composition templates.
 *
 * Two things fall out of that:
 *  1. The model cannot produce an ugly layout, because it never touches
 *     geometry - only choices we already know how to render well.
 *  2. The model cannot alter the transcript, because lines reference word
 *     *ids* and the text is rebuilt from the transcript afterwards.
 */

/* ------------------------------------------------------------------ */
/* Transcription                                                       */
/* ------------------------------------------------------------------ */

export const transcriptionResultSchema = z.object({
  language: z.string().min(1).max(16).default('en'),
  text: z.string().default(''),
  words: z.array(transcriptWordSchema).default([]),
});

export type TranscriptionResult = z.infer<typeof transcriptionResultSchema>;

export const audioAnalysisSchema = z.object({
  contentType: contentTypeSchema.default('unknown'),
  language: z.string().min(1).max(16).default('en'),
  correctedText: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0.5),
  /** Short description of the mood, used to steer the design pass. */
  mood: z.string().max(200).default(''),
});

export type AudioAnalysis = z.infer<typeof audioAnalysisSchema>;

/* ------------------------------------------------------------------ */
/* Design                                                              */
/* ------------------------------------------------------------------ */

export const aiLineSchema = z.object({
  /**
   * Transcript word ids sharing this line, in spoken order. The renderer
   * rebuilds the text from these, so the model cannot rewrite what was said.
   */
  wordIds: z.array(z.string()).min(1),
  /** Optional per-line animation override. */
  enterAnimation: animationIdSchema.optional(),
});

export type AiLine = z.infer<typeof aiLineSchema>;

export const aiSceneSchema = z.object({
  /** Must match a scene id we sent. Unknown ids are ignored. */
  id: z.string().min(1),
  compositionId: compositionIdSchema,
  /** 1-4 lines. Each line is one row of the stacked block. */
  lines: z.array(aiLineSchema).min(1).max(4),
  /**
   * The word (or at most two adjacent words) promoted to the script/display
   * face at large size. This is the single most important decision in the
   * response - it is the word the frame is built around.
   */
  heroWordIds: z.array(z.string()).max(2).default([]),
  /** Optional secondary emphasis, set in the accent face. */
  accentWordIds: z.array(z.string()).max(2).default([]),
  /** Regions of the keyframe that text must not cover. */
  avoidRegions: z.array(avoidRegionSchema).max(6).default([]),
  /** How bright the frame is behind the text, 0 dark .. 1 blown out. */
  backdropLuma: z.number().min(0).max(1).default(0.5),
});

export type AiScene = z.infer<typeof aiSceneSchema>;

export const aiDirectionSchema = z.object({
  preset: presetIdSchema,
  baseFont: fontIdSchema.nullable().optional(),
  heroFont: fontIdSchema.nullable().optional(),
  accentFont: fontIdSchema.nullable().optional(),
  motionLevel: z.number().min(0).max(1).optional(),
  rotationLevel: z.number().min(0).max(1).optional(),
  scale: z.number().min(0.5).max(2).optional(),
  heroContrast: z.number().min(0.5).max(2).optional(),
  note: z.string().max(400).optional(),
});

export type AiDirection = z.infer<typeof aiDirectionSchema>;

export const aiDesignResponseSchema = z.object({
  direction: aiDirectionSchema,
  scenes: z.array(aiSceneSchema).min(1),
});

export type AiDesignResponse = z.infer<typeof aiDesignResponseSchema>;

/** A single-scene redesign returns only that scene. */
export const aiSceneResponseSchema = z.object({
  scene: aiSceneSchema,
});

export type AiSceneResponse = z.infer<typeof aiSceneResponseSchema>;

/* ------------------------------------------------------------------ */
/* Request payloads (shared between web and worker)                    */
/* ------------------------------------------------------------------ */

const scenePayloadSchema = z.object({
  id: z.string(),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  words: z.array(z.object({ id: z.string(), text: z.string() })),
  /** Bare base64 WebP of the scene keyframe, no data: prefix. */
  frame: z.string().optional(),
});

export const designRequestSchema = z.object({
  projectId: z.string().uuid(),
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  /** Preferred preset, or 'AUTO' to let the model choose. */
  style: z.union([presetIdSchema, z.literal('AUTO')]).default('AUTO'),
  contentType: contentTypeSchema.default('unknown'),
  mood: z.string().max(200).default(''),
  scenes: z.array(scenePayloadSchema).min(1).max(24),
  /** Optional free-text instruction from the in-editor AI actions. */
  instruction: z.string().max(400).optional(),
});

export type DesignRequest = z.infer<typeof designRequestSchema>;

export const redesignSceneRequestSchema = z.object({
  projectId: z.string().uuid(),
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  direction: aiDirectionSchema,
  scene: scenePayloadSchema,
  /** Compositions used by neighbouring scenes, so we do not repeat one. */
  neighbourCompositions: z.array(z.string()).max(4).default([]),
  instruction: z.string().max(400).optional(),
});

export type RedesignSceneRequest = z.infer<typeof redesignSceneRequestSchema>;
