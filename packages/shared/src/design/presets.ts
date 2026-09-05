/**
 * Style presets - 135 font pairings, each a complete art direction.
 *
 * A preset does not describe one typeface. It describes a *cast*:
 *
 *   base    the voice that carries the sentence
 *   hero    the one word per phrase that gets swapped out, much larger
 *   accent  an optional third face for asides and annotations
 *   micro   the tiny all-caps line under everything
 *
 * That is the move the whole reference set is built on:
 *
 *     a holi-day in my  Life  as a  girl  in  New York  city
 *     ^^^^^^^^^^^^^^^^  ~~~~
 *     base, small        hero, script, huge, on the same line
 *
 * Contrast comes from category - script against condensed, Didone against
 * grotesk - never from two faces of the same kind fighting each other. The
 * pairing table in fonts.ts (`pairingScore`) encodes that rule, and every cast
 * here respects it.
 *
 * Presets are generated from 12 style archetypes crossed with hand-picked
 * casts, so sizes, leading, motion and composition sets stay internally
 * consistent instead of each of 135 entries being tuned by hand and drifting.
 */

import type { AnimationId } from './animations';
import type { CompositionId } from './compositions';
import type { FontId } from './fonts';

export type CasePolicy = 'none' | 'uppercase' | 'lowercase' | 'title';

/** The four voices a word can be set in. */
export type Emphasis = 'base' | 'hero' | 'accent' | 'micro';

export interface VoiceStyle {
  fontId: FontId;
  weight: number;
  textTransform: CasePolicy;
  italic: boolean;
  /** Letter-spacing in em, on top of the font's own default. */
  tracking: number;
  /** Size multiplier relative to the line's size. This is where drama lives. */
  sizeScale: number;
  /**
   * Vertical nudge in em. Scripts hang below the baseline of the sans beside
   * them; a small shift makes the pair sit optically level.
   */
  baselineShift: number;
  /** 0 primary, 1 secondary, 2 accent colour. */
  colorIndex: number;
}

export interface PresetDef {
  id: string;
  label: string;
  description: string;
  /** Free-text tags, used to match a preset to the footage automatically. */
  tags: string[];
  palette: [string, string, string];
  /** Base line size as a fraction of frame height, before the hero multiplier. */
  baseSize: number;
  /**
   * Line height for stacked lines. Under 1 makes lines interlock, which is the
   * whole point of the Anton-style stacks in the reference.
   */
  leading: number;
  voices: Record<Emphasis, VoiceStyle>;
  /** How many words per phrase get promoted to hero. Usually exactly 1. */
  heroesPerScene: number;
  rotationBudget: number;
  motionLevel: number;
  compositions: CompositionId[];
  enterAnimations: AnimationId[];
  exitAnimations: AnimationId[];
  sceneWordTarget: number;
  /** Drop shadow strength, 0..1, before per-line contrast adjustment. */
  shadow: number;
}

export const PRESET_REGISTRY = {
  SCRIPT_EDITORIAL: {
    id: 'SCRIPT_EDITORIAL',
    label: "Script editorial",
    description: "Script over workhorse. Vlog, lifestyle, travel, elegant.",
    tags: ["vlog", "lifestyle", "travel", "elegant"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'dmSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'greatVibes', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.15, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'instrumentSerif', weight: 400, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  STACKED_HEAVY: {
    id: 'STACKED_HEAVY',
    label: "Stacked heavy",
    description: "Heavy over heavy. Bold, howto, punchy, urban.",
    tags: ["bold", "howto", "punchy", "urban"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.115,
    leading: 0.8,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.6,
    sceneWordTarget: 6,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'anton', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.025, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'anton', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.025, sizeScale: 1.18, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'styleScript', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'dmSans', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "offset-hero"],
    enterAnimations: ["wipe-up", "fade-up", "pop", "mask-reveal", "word-pop"],
    exitAnimations: ["none", "fade"],
  },
  OLD_MONEY: {
    id: 'OLD_MONEY',
    label: "Old money",
    description: "Script over didone. Luxury, quiet, fashion, timeless.",
    tags: ["luxury", "quiet", "fashion", "timeless"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.07,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.1,
    motionLevel: 0.3,
    sceneWordTarget: 5,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'dmSerifDisplay', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'styleScript', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'italiana', weight: 400, textTransform: 'title', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "offset-hero"],
    enterAnimations: ["fade", "tracking-in", "mask-reveal", "blur-in"],
    exitAnimations: ["fade"],
  },
  VOGUE: {
    id: 'VOGUE',
    label: "Vogue",
    description: "Didone over didone. Fashion, editorial, glamour.",
    tags: ["fashion", "editorial", "glamour"],
    palette: ["#FFFFFF", "#E8E8E8", "#D9382B"],
    baseSize: 0.082,
    leading: 0.86,
    heroesPerScene: 1,
    rotationBudget: 0.08,
    motionLevel: 0.5,
    sceneWordTarget: 5,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'bodoni', weight: 600, textTransform: 'uppercase', italic: false, tracking: -0.005, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'bodoni', weight: 700, textTransform: 'title', italic: true, tracking: -0.005, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'archivo', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'archivo', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "offset-hero", "anchor-top", "edge-vertical", "split-drift"],
    enterAnimations: ["wipe-up", "mask-reveal", "tracking-in", "scale-in", "flash"],
    exitAnimations: ["none", "fade", "wipe-up"],
  },
  SOFT_SCRIPT: {
    id: 'SOFT_SCRIPT',
    label: "Soft script",
    description: "Script over serif. Romantic, soft, morning, feminine.",
    tags: ["romantic", "soft", "morning", "feminine"],
    palette: ["#FFFFFF", "#F6EFE7", "#E3B7A8"],
    baseSize: 0.064,
    leading: 1.0,
    heroesPerScene: 1,
    rotationBudget: 0.2,
    motionLevel: 0.28,
    sceneWordTarget: 6,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'cormorant', weight: 300, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'parisienne', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'cormorant', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "anchor-bottom", "corner-note"],
    enterAnimations: ["fade", "tracking-in", "blur-in", "fade-up"],
    exitAnimations: ["fade", "blur-in"],
  },
  POSTER_BOLD: {
    id: 'POSTER_BOLD',
    label: "Poster bold",
    description: "Workhorse over heavy. Bold, loud, sport, modern.",
    tags: ["bold", "loud", "sport", "modern"],
    palette: ["#FFFFFF", "#C4C4C4", "#39FF6A"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'bebasNeue', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'archivo', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.32, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'archivo', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'archivo', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  SCRAPBOOK: {
    id: 'SCRAPBOOK',
    label: "Scrapbook",
    description: "Serif over serif. Playful, diary, vlog, warm.",
    tags: ["playful", "diary", "vlog", "warm"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'fraunces', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'fraunces', weight: 600, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'caveat', weight: 500, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'caveat', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  Y2K_ACID: {
    id: 'Y2K_ACID',
    label: "Y2K acid",
    description: "Heavy over workhorse. Y2k, club, edgy, music.",
    tags: ["y2k", "club", "edgy", "music"],
    palette: ["#FFFFFF", "#C4C4C4", "#39FF6A"],
    baseSize: 0.075,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.45,
    motionLevel: 0.92,
    sceneWordTarget: 5,
    shadow: 0.26,
    voices: {
      base:
      { fontId: 'spaceGrotesk', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'anton', weight: 400, textTransform: 'uppercase', italic: false, tracking: -0.02, sizeScale: 1.45, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'spaceGrotesk', weight: 500, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'spaceGrotesk', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["diagonal-descend", "edge-vertical", "offset-hero", "split-drift", "anchor-top"],
    enterAnimations: ["flash", "pop", "word-pop", "slide-left", "wipe-left"],
    exitAnimations: ["none", "flash", "fade"],
  },
  CINEMATIC: {
    id: 'CINEMATIC',
    label: "Cinematic",
    description: "Didone over workhorse. Cinematic, film, calm, quiet.",
    tags: ["cinematic", "film", "calm", "quiet"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.05,
    leading: 1.2,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.18,
    sceneWordTarget: 8,
    shadow: 0.5,
    voices: {
      base:
      { fontId: 'manrope', weight: 400, textTransform: 'none', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'italiana', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.01, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'manrope', weight: 500, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "quote-block", "stack-center"],
    enterAnimations: ["fade", "fade-up", "blur-in"],
    exitAnimations: ["fade"],
  },
  SIGNATURE_SANS: {
    id: 'SIGNATURE_SANS',
    label: "Signature sans",
    description: "Script over workhorse. Elegant, wedding, lifestyle.",
    tags: ["elegant", "wedding", "lifestyle"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'dmSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'allura', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.15, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'instrumentSerif', weight: 400, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  COPPERPLATE_NOTE: {
    id: 'COPPERPLATE_NOTE',
    label: "Copperplate note",
    description: "Script over workhorse. Formal, invitation, classic.",
    tags: ["formal", "invitation", "classic"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.07,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.1,
    motionLevel: 0.3,
    sceneWordTarget: 5,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'inter', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'pinyonScript', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'cormorant', weight: 500, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "offset-hero"],
    enterAnimations: ["fade", "tracking-in", "mask-reveal", "blur-in"],
    exitAnimations: ["fade"],
  },
  FINE_LINE: {
    id: 'FINE_LINE',
    label: "Fine line",
    description: "Script over workhorse. Delicate, minimal, poetic.",
    tags: ["delicate", "minimal", "poetic"],
    palette: ["#FFFFFF", "#F6EFE7", "#E3B7A8"],
    baseSize: 0.064,
    leading: 1.0,
    heroesPerScene: 1,
    rotationBudget: 0.2,
    motionLevel: 0.28,
    sceneWordTarget: 6,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'manrope', weight: 300, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'tangerine', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'cormorant', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "anchor-bottom", "corner-note"],
    enterAnimations: ["fade", "tracking-in", "blur-in", "fade-up"],
    exitAnimations: ["fade", "blur-in"],
  },
  LOVE_LETTER: {
    id: 'LOVE_LETTER',
    label: "Love letter",
    description: "Script over serif. Romantic, letter, intimate.",
    tags: ["romantic", "letter", "intimate"],
    palette: ["#FFFFFF", "#F5DCE4", "#D6547B"],
    baseSize: 0.064,
    leading: 1.0,
    heroesPerScene: 1,
    rotationBudget: 0.2,
    motionLevel: 0.28,
    sceneWordTarget: 6,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'cormorant', weight: 300, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'mrsSaintDelafield', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'cormorant', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "anchor-bottom", "corner-note"],
    enterAnimations: ["fade", "tracking-in", "blur-in", "fade-up"],
    exitAnimations: ["fade", "blur-in"],
  },
  SPENCERIAN: {
    id: 'SPENCERIAN',
    label: "Spencerian",
    description: "Script over serif. Formal, antique, fine.",
    tags: ["formal", "antique", "fine"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.07,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.1,
    motionLevel: 0.3,
    sceneWordTarget: 5,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'libreBaskerville', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'herrVonMuellerhoff', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'libreBaskerville', weight: 400, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "offset-hero"],
    enterAnimations: ["fade", "tracking-in", "mask-reveal", "blur-in"],
    exitAnimations: ["fade"],
  },
  GRAND_ITALIC: {
    id: 'GRAND_ITALIC',
    label: "Grand italic",
    description: "Script over geometric. Sweeping, dramatic, elegant.",
    tags: ["sweeping", "dramatic", "elegant"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'jost', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'italianno', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.15, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'playfair', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  QUIET_FORMAL: {
    id: 'QUIET_FORMAL',
    label: "Quiet formal",
    description: "Script over geometric. Restrained, formal, clean.",
    tags: ["restrained", "formal", "clean"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.07,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.1,
    motionLevel: 0.3,
    sceneWordTarget: 5,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'workSans', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'petitFormalScript', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'lora', weight: 500, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "offset-hero"],
    enterAnimations: ["fade", "tracking-in", "mask-reveal", "blur-in"],
    exitAnimations: ["fade"],
  },
  BRUSH_PEN: {
    id: 'BRUSH_PEN',
    label: "Brush pen",
    description: "Script over workhorse. Handmade, brush, personal.",
    tags: ["handmade", "brush", "personal"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'archivo', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'alexBrush', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.15, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'fraunces', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'dmSans', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  SIGN_PAINTER: {
    id: 'SIGN_PAINTER',
    label: "Sign painter",
    description: "Script over workhorse. Retro, diner, nostalgic.",
    tags: ["retro", "diner", "nostalgic"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'archivo', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'yellowtail', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'fraunces', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'dmSans', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  MODERN_BRUSH: {
    id: 'MODERN_BRUSH',
    label: "Modern brush",
    description: "Script over workhorse. Modern, handmade, fresh.",
    tags: ["modern", "handmade", "fresh"],
    palette: ["#FFFFFF", "#DCEFE6", "#3FBF8F"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'spaceGrotesk', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'kaushanScript', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.15, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'spaceGrotesk', weight: 500, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  BOUNCE_SCRIPT: {
    id: 'BOUNCE_SCRIPT',
    label: "Bounce script",
    description: "Script over geometric. Cheerful, casual, friendly.",
    tags: ["cheerful", "casual", "friendly"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'poppins', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'dancingScript', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'poppins', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  BAKERY: {
    id: 'BAKERY',
    label: "Bakery",
    description: "Script over geometric. Sweet, cafe, charming.",
    tags: ["sweet", "cafe", "charming"],
    palette: ["#FFFFFF", "#F5DCE4", "#D6547B"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'quicksand', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'cookie', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'quicksand', weight: 500, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  SOFT_BRUSH: {
    id: 'SOFT_BRUSH',
    label: "Soft brush",
    description: "Script over geometric. Soft, modern, brand.",
    tags: ["soft", "modern", "brand"],
    palette: ["#FFFFFF", "#F6EFE7", "#E3B7A8"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'urbanist', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'norican', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.15, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'lora', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  LEAGUE_HAND: {
    id: 'LEAGUE_HAND',
    label: "League hand",
    description: "Script over geometric. Understated, fine, editorial.",
    tags: ["understated", "fine", "editorial"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.07,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.1,
    motionLevel: 0.3,
    sceneWordTarget: 5,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'leagueSpartan', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'leagueScript', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'lora', weight: 500, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "offset-hero"],
    enterAnimations: ["fade", "tracking-in", "mask-reveal", "blur-in"],
    exitAnimations: ["fade"],
  },
  ROUGE: {
    id: 'ROUGE',
    label: "Rouge",
    description: "Script over geometric. Slender, romantic, light.",
    tags: ["slender", "romantic", "light"],
    palette: ["#FFFFFF", "#F5DCE4", "#D6547B"],
    baseSize: 0.064,
    leading: 1.0,
    heroesPerScene: 1,
    rotationBudget: 0.2,
    motionLevel: 0.28,
    sceneWordTarget: 6,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'montserrat', weight: 300, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'rougeScript', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'playfair', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "anchor-bottom", "corner-note"],
    enterAnimations: ["fade", "tracking-in", "blur-in", "fade-up"],
    exitAnimations: ["fade", "blur-in"],
  },
  QUILL: {
    id: 'QUILL',
    label: "Quill",
    description: "Script over serif. Antique, literary, handwritten.",
    tags: ["antique", "literary", "handwritten"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.066,
    leading: 0.96,
    heroesPerScene: 1,
    rotationBudget: 0.18,
    motionLevel: 0.3,
    sceneWordTarget: 6,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'ebGaramond', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'qwigley', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'ebGaramond', weight: 500, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["quote-block", "stack-center", "anchor-bottom", "cascade-left"],
    enterAnimations: ["fade", "fade-up", "tracking-in", "blur-in"],
    exitAnimations: ["fade"],
  },
  HAVILAND: {
    id: 'HAVILAND',
    label: "Haviland",
    description: "Script over geometric. Formal, spencerian, refined.",
    tags: ["formal", "spencerian", "refined"],
    palette: ["#FBF7EF", "#E6D9BE", "#C9A227"],
    baseSize: 0.07,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.1,
    motionLevel: 0.3,
    sceneWordTarget: 5,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'raleway', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'mrDeHaviland', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'cormorant', weight: 500, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "offset-hero"],
    enterAnimations: ["fade", "tracking-in", "mask-reveal", "blur-in"],
    exitAnimations: ["fade"],
  },
  FLOURISH: {
    id: 'FLOURISH',
    label: "Flourish",
    description: "Script over geometric. Ornate, maximal, decorative.",
    tags: ["ornate", "maximal", "decorative"],
    palette: ["#FBF7EF", "#E6D9BE", "#C9A227"],
    baseSize: 0.07,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.1,
    motionLevel: 0.3,
    sceneWordTarget: 5,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'jost', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'monsieurLaDoulaise', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'cormorant', weight: 500, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "offset-hero"],
    enterAnimations: ["fade", "tracking-in", "mask-reveal", "blur-in"],
    exitAnimations: ["fade"],
  },
  EPHESIS_CALM: {
    id: 'EPHESIS_CALM',
    label: "Ephesis calm",
    description: "Script over geometric. Soft, rounded, calm.",
    tags: ["soft", "rounded", "calm"],
    palette: ["#FBFDF9", "#DDE7D6", "#7C9A6"],
    baseSize: 0.064,
    leading: 1.0,
    heroesPerScene: 1,
    rotationBudget: 0.2,
    motionLevel: 0.28,
    sceneWordTarget: 6,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'figtree', weight: 300, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'ephesis', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'lora', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "anchor-bottom", "corner-note"],
    enterAnimations: ["fade", "tracking-in", "blur-in", "fade-up"],
    exitAnimations: ["fade", "blur-in"],
  },
  INK_HAND: {
    id: 'INK_HAND',
    label: "Ink hand",
    description: "Script over serif. Antique, journal, ink.",
    tags: ["antique", "journal", "ink"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.066,
    leading: 0.96,
    heroesPerScene: 1,
    rotationBudget: 0.18,
    motionLevel: 0.3,
    sceneWordTarget: 6,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'ebGaramond', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'meddon', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'ebGaramond', weight: 500, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["quote-block", "stack-center", "anchor-bottom", "cascade-left"],
    enterAnimations: ["fade", "fade-up", "tracking-in", "blur-in"],
    exitAnimations: ["fade"],
  },
  SACRAMENTO_AIR: {
    id: 'SACRAMENTO_AIR',
    label: "Sacramento air",
    description: "Script over geometric. Airy, thin, minimal.",
    tags: ["airy", "thin", "minimal"],
    palette: ["#FFFFFF", "#F6EFE7", "#E3B7A8"],
    baseSize: 0.064,
    leading: 1.0,
    heroesPerScene: 1,
    rotationBudget: 0.2,
    motionLevel: 0.28,
    sceneWordTarget: 6,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'outfit', weight: 300, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'sacramento', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.0, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'cormorant', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "anchor-bottom", "corner-note"],
    enterAnimations: ["fade", "tracking-in", "blur-in", "fade-up"],
    exitAnimations: ["fade", "blur-in"],
  },
  ANTON_SCRIPT: {
    id: 'ANTON_SCRIPT',
    label: "Anton script",
    description: "Script over heavy. Bold, contrast, music.",
    tags: ["bold", "contrast", "music"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.115,
    leading: 0.8,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.6,
    sceneWordTarget: 6,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'anton', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.025, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'greatVibes', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'styleScript', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'dmSans', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "offset-hero"],
    enterAnimations: ["wipe-up", "fade-up", "pop", "mask-reveal", "word-pop"],
    exitAnimations: ["none", "fade"],
  },
  BEBAS_SIGNATURE: {
    id: 'BEBAS_SIGNATURE',
    label: "Bebas signature",
    description: "Script over heavy. Punchy, contrast, brand.",
    tags: ["punchy", "contrast", "brand"],
    palette: ["#FFFFFF", "#C8C8C8", "#111111"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'bebasNeue', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'styleScript', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'archivo', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  OSWALD_CURSIVE: {
    id: 'OSWALD_CURSIVE',
    label: "Oswald cursive",
    description: "Script over heavy. News, elegant, contrast.",
    tags: ["news", "elegant", "contrast"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'oswald', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'allura', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'oswald', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  FJALLA_SCRIPT: {
    id: 'FJALLA_SCRIPT',
    label: "Fjalla script",
    description: "Script over heavy. Condensed, soft, contrast.",
    tags: ["condensed", "soft", "contrast"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'fjallaOne', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'parisienne', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'fjallaOne', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  STAAT_SCRIPT: {
    id: 'STAAT_SCRIPT',
    label: "Staatliches script",
    description: "Script over heavy. Poster, ticket, contrast.",
    tags: ["poster", "ticket", "contrast"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'staatliches', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'sacramento', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'staatliches', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  TEKO_SCRIPT: {
    id: 'TEKO_SCRIPT',
    label: "Teko script",
    description: "Script over heavy. Sport, retro, contrast.",
    tags: ["sport", "retro", "contrast"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'teko', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'yellowtail', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'teko', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  BIG_SHOULDERS: {
    id: 'BIG_SHOULDERS',
    label: "Big shoulders",
    description: "Script over heavy. Narrow, tall, editorial.",
    tags: ["narrow", "tall", "editorial"],
    palette: ["#FFFFFF", "#C8C8C8", "#111111"],
    baseSize: 0.115,
    leading: 0.8,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.6,
    sceneWordTarget: 6,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'bigShouldersDisplay', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.025, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'styleScript', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'bigShouldersDisplay', weight: 500, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "offset-hero"],
    enterAnimations: ["wipe-up", "fade-up", "pop", "mask-reveal", "word-pop"],
    exitAnimations: ["none", "fade"],
  },
  KHAND_SCRIPT: {
    id: 'KHAND_SCRIPT',
    label: "Khand script",
    description: "Script over heavy. Industrial, brush, contrast.",
    tags: ["industrial", "brush", "contrast"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'khand', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'alexBrush', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 1.9, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'khand', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  PRATA_NOTE: {
    id: 'PRATA_NOTE',
    label: "Prata note",
    description: "Didone over workhorse. Warm, editorial, soft.",
    tags: ["warm", "editorial", "soft"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'dmSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'prata', weight: 400, textTransform: 'title', italic: false, tracking: -0.01, sizeScale: 2.15, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'prata', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  GILDA: {
    id: 'GILDA',
    label: "Gilda",
    description: "Didone over geometric. Refined, bookish, quiet.",
    tags: ["refined", "bookish", "quiet"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.07,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.1,
    motionLevel: 0.3,
    sceneWordTarget: 5,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'workSans', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'gildaDisplay', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 2.0, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'gildaDisplay', weight: 400, textTransform: 'title', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "offset-hero"],
    enterAnimations: ["fade", "tracking-in", "mask-reveal", "blur-in"],
    exitAnimations: ["fade"],
  },
  MARCELLUS_STONE: {
    id: 'MARCELLUS_STONE',
    label: "Marcellus stone",
    description: "Didone over workhorse. Classical, calm, museum.",
    tags: ["classical", "calm", "museum"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'inter', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'marcellus', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.4, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'marcellus', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  CINZEL_TITLE: {
    id: 'CINZEL_TITLE',
    label: "Cinzel title",
    description: "Didone over workhorse. Epic, classical, title.",
    tags: ["epic", "classical", "title"],
    palette: ["#FBF7EF", "#E6D9BE", "#C9A227"],
    baseSize: 0.05,
    leading: 1.2,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.18,
    sceneWordTarget: 8,
    shadow: 0.5,
    voices: {
      base:
      { fontId: 'manrope', weight: 400, textTransform: 'none', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'cinzel', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.01, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'cinzel', weight: 500, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "quote-block", "stack-center"],
    enterAnimations: ["fade", "fade-up", "blur-in"],
    exitAnimations: ["fade"],
  },
  YESEVA: {
    id: 'YESEVA',
    label: "Yeseva",
    description: "Didone over workhorse. Decorative, feminine, curvy.",
    tags: ["decorative", "feminine", "curvy"],
    palette: ["#FFFFFF", "#F5DCE4", "#D6547B"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'dmSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'yesevaOne', weight: 400, textTransform: 'title', italic: false, tracking: -0.01, sizeScale: 2.15, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'yesevaOne', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  ABRIL_COVER: {
    id: 'ABRIL_COVER',
    label: "Abril cover",
    description: "Didone over geometric. Magazine, heavy, contrast.",
    tags: ["magazine", "heavy", "contrast"],
    palette: ["#FFFFFF", "#E8E8E8", "#D9382B"],
    baseSize: 0.082,
    leading: 0.86,
    heroesPerScene: 1,
    rotationBudget: 0.08,
    motionLevel: 0.5,
    sceneWordTarget: 5,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'workSans', weight: 600, textTransform: 'uppercase', italic: false, tracking: -0.005, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'abrilFatface', weight: 400, textTransform: 'title', italic: false, tracking: -0.005, sizeScale: 1.55, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'abrilFatface', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "offset-hero", "anchor-top", "edge-vertical", "split-drift"],
    enterAnimations: ["wipe-up", "mask-reveal", "tracking-in", "scale-in", "flash"],
    exitAnimations: ["none", "fade", "wipe-up"],
  },
  BELLEFAIR_LIGHT: {
    id: 'BELLEFAIR_LIGHT',
    label: "Bellefair light",
    description: "Didone over geometric. Delicate, capitals, light.",
    tags: ["delicate", "capitals", "light"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.07,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.1,
    motionLevel: 0.3,
    sceneWordTarget: 5,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'jost', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'bellefair', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 2.0, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'bellefair', weight: 400, textTransform: 'title', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "offset-hero"],
    enterAnimations: ["fade", "tracking-in", "mask-reveal", "blur-in"],
    exitAnimations: ["fade"],
  },
  ANTIC_QUIET: {
    id: 'ANTIC_QUIET',
    label: "Antic quiet",
    description: "Didone over geometric. Restrained, quiet, editorial.",
    tags: ["restrained", "quiet", "editorial"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.05,
    leading: 1.2,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.18,
    sceneWordTarget: 8,
    shadow: 0.5,
    voices: {
      base:
      { fontId: 'publicSans', weight: 400, textTransform: 'none', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'anticDidone', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.01, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'anticDidone', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "quote-block", "stack-center"],
    enterAnimations: ["fade", "fade-up", "blur-in"],
    exitAnimations: ["fade"],
  },
  ROZHA: {
    id: 'ROZHA',
    label: "Rozha",
    description: "Didone over geometric. Ornate, loud, festival.",
    tags: ["ornate", "loud", "festival"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.082,
    leading: 0.86,
    heroesPerScene: 1,
    rotationBudget: 0.08,
    motionLevel: 0.5,
    sceneWordTarget: 5,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'montserrat', weight: 600, textTransform: 'uppercase', italic: false, tracking: -0.005, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'rozhaOne', weight: 400, textTransform: 'title', italic: false, tracking: -0.005, sizeScale: 1.55, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'rozhaOne', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "offset-hero", "anchor-top", "edge-vertical", "split-drift"],
    enterAnimations: ["wipe-up", "mask-reveal", "tracking-in", "scale-in", "flash"],
    exitAnimations: ["none", "fade", "wipe-up"],
  },
  RUFINA_SLAB: {
    id: 'RUFINA_SLAB',
    label: "Rufina slab",
    description: "Didone over geometric. Confident, modern, slab.",
    tags: ["confident", "modern", "slab"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'karla', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'rufina', weight: 700, textTransform: 'title', italic: false, tracking: -0.01, sizeScale: 2.15, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'rufina', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  TRIRONG_MODE: {
    id: 'TRIRONG_MODE',
    label: "Trirong mode",
    description: "Didone over geometric. Sharp, italic, fashion.",
    tags: ["sharp", "italic", "fashion"],
    palette: ["#FFFFFF", "#E8E8E8", "#D9382B"],
    baseSize: 0.082,
    leading: 0.86,
    heroesPerScene: 1,
    rotationBudget: 0.08,
    motionLevel: 0.5,
    sceneWordTarget: 5,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'workSans', weight: 600, textTransform: 'uppercase', italic: false, tracking: -0.005, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'trirong', weight: 700, textTransform: 'title', italic: true, tracking: -0.005, sizeScale: 1.55, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'trirong', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "offset-hero", "anchor-top", "edge-vertical", "split-drift"],
    enterAnimations: ["wipe-up", "mask-reveal", "tracking-in", "scale-in", "flash"],
    exitAnimations: ["none", "fade", "wipe-up"],
  },
  BODONI_QUIET: {
    id: 'BODONI_QUIET',
    label: "Bodoni quiet",
    description: "Didone over workhorse. Didone, quiet, luxury.",
    tags: ["didone", "quiet", "luxury"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.07,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.1,
    motionLevel: 0.3,
    sceneWordTarget: 5,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'inter', weight: 400, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'bodoni', weight: 500, textTransform: 'title', italic: false, tracking: -0.015, sizeScale: 2.0, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'bodoni', weight: 500, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "offset-hero"],
    enterAnimations: ["fade", "tracking-in", "mask-reveal", "blur-in"],
    exitAnimations: ["fade"],
  },
  PLAYFAIR_CLASSIC: {
    id: 'PLAYFAIR_CLASSIC',
    label: "Playfair classic",
    description: "Didone over workhorse. Classic, safe, handsome.",
    tags: ["classic", "safe", "handsome"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'dmSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'playfair', weight: 600, textTransform: 'title', italic: false, tracking: -0.01, sizeScale: 2.15, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'playfair', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  DM_DISPLAY: {
    id: 'DM_DISPLAY',
    label: "DM display",
    description: "Didone over workhorse. Rich, italic, editorial.",
    tags: ["rich", "italic", "editorial"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'dmSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'dmSerifDisplay', weight: 400, textTransform: 'title', italic: false, tracking: -0.01, sizeScale: 2.15, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'dmSerifDisplay', weight: 400, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  ITALIANA_WIDE: {
    id: 'ITALIANA_WIDE',
    label: "Italiana wide",
    description: "Didone over workhorse. Thin, wide, wordmark.",
    tags: ["thin", "wide", "wordmark"],
    palette: ["#FBF7EF", "#E6D9BE", "#C9A227"],
    baseSize: 0.05,
    leading: 1.2,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.18,
    sceneWordTarget: 8,
    shadow: 0.5,
    voices: {
      base:
      { fontId: 'manrope', weight: 400, textTransform: 'none', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'italiana', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.01, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'italiana', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "quote-block", "stack-center"],
    enterAnimations: ["fade", "fade-up", "blur-in"],
    exitAnimations: ["fade"],
  },
  ARCHIVO_BLACK: {
    id: 'ARCHIVO_BLACK',
    label: "Archivo black",
    description: "Heavy over heavy. Maximum, poster, loud.",
    tags: ["maximum", "poster", "loud"],
    palette: ["#FFFFFF", "#C4C4C4", "#39FF6A"],
    baseSize: 0.09,
    leading: 0.84,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.7,
    sceneWordTarget: 4,
    shadow: 0.28,
    voices: {
      base:
      { fontId: 'bebasNeue', weight: 400, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'archivoBlack', weight: 400, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1.25, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'archivoBlack', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'archivo', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "offset-hero", "stack-center", "anchor-bottom"],
    enterAnimations: ["wipe-left", "pop", "flash", "wipe-up"],
    exitAnimations: ["none", "flash"],
  },
  ALFA_SLAB: {
    id: 'ALFA_SLAB',
    label: "Alfa slab",
    description: "Heavy over geometric. Circus, slab, vintage.",
    tags: ["circus", "slab", "vintage"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'workSans', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'alfaSlabOne', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.32, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'alfaSlabOne', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  ULTRA_AD: {
    id: 'ULTRA_AD',
    label: "Ultra ad",
    description: "Heavy over geometric. Advertising, slab, retro.",
    tags: ["advertising", "slab", "retro"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.066,
    leading: 0.96,
    heroesPerScene: 1,
    rotationBudget: 0.18,
    motionLevel: 0.3,
    sceneWordTarget: 6,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'publicSans', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'ultra', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1.6, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'ultra', weight: 400, textTransform: 'title', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["quote-block", "stack-center", "anchor-bottom", "cascade-left"],
    enterAnimations: ["fade", "fade-up", "tracking-in", "blur-in"],
    exitAnimations: ["fade"],
  },
  TITAN_FUN: {
    id: 'TITAN_FUN',
    label: "Titan fun",
    description: "Heavy over geometric. Cartoon, chunky, fun.",
    tags: ["cartoon", "chunky", "fun"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'quicksand', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'titanOne', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'titanOne', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  RIGHTEOUS_DECO: {
    id: 'RIGHTEOUS_DECO',
    label: "Righteous deco",
    description: "Heavy over geometric. Deco, retro, future.",
    tags: ["deco", "retro", "future"],
    palette: ["#FFFFFF", "#E4DCF2", "#7B5CD6"],
    baseSize: 0.075,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.45,
    motionLevel: 0.92,
    sceneWordTarget: 5,
    shadow: 0.26,
    voices: {
      base:
      { fontId: 'jost', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'righteous', weight: 400, textTransform: 'uppercase', italic: false, tracking: -0.02, sizeScale: 1.45, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'righteous', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["diagonal-descend", "edge-vertical", "offset-hero", "split-drift", "anchor-top"],
    enterAnimations: ["flash", "pop", "word-pop", "slide-left", "wipe-left"],
    exitAnimations: ["none", "flash", "fade"],
  },
  BOWLBY_POP: {
    id: 'BOWLBY_POP',
    label: "Bowlby pop",
    description: "Heavy over geometric. Bubbly, loud, pop.",
    tags: ["bubbly", "loud", "pop"],
    palette: ["#FFFFFF", "#DCEFE6", "#3FBF8F"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'nunito', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'bowlbyOne', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'bowlbyOne', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  LILITA_SOFT: {
    id: 'LILITA_SOFT',
    label: "Lilita soft",
    description: "Heavy over geometric. Soft, heavy, friendly.",
    tags: ["soft", "heavy", "friendly"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'nunito', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'lilitaOne', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'lilitaOne', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  PASSION_ROUND: {
    id: 'PASSION_ROUND',
    label: "Passion round",
    description: "Heavy over geometric. Rounded, loud, friendly.",
    tags: ["rounded", "loud", "friendly"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'rubik', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'passionOne', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.32, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'passionOne', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  MODAK_BUBBLE: {
    id: 'MODAK_BUBBLE',
    label: "Modak bubble",
    description: "Heavy over quirky. Bubble, extreme, kids.",
    tags: ["bubble", "extreme", "kids"],
    palette: ["#FFFFFF", "#DCEFE6", "#3FBF8F"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'fredoka', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'modak', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'modak', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  BUNGEE_SIGN: {
    id: 'BUNGEE_SIGN',
    label: "Bungee sign",
    description: "Heavy over geometric. Signage, urban, blocky.",
    tags: ["signage", "urban", "blocky"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.09,
    leading: 0.84,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.7,
    sceneWordTarget: 4,
    shadow: 0.28,
    voices: {
      base:
      { fontId: 'workSans', weight: 700, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'bungee', weight: 400, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1.25, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'bungee', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "offset-hero", "stack-center", "anchor-bottom"],
    enterAnimations: ["wipe-left", "pop", "flash", "wipe-up"],
    exitAnimations: ["none", "flash"],
  },
  CHIVO_HEAVY: {
    id: 'CHIVO_HEAVY',
    label: "Chivo heavy",
    description: "Heavy over heavy. Grotesque, heavy, plain.",
    tags: ["grotesque", "heavy", "plain"],
    palette: ["#FFFFFF", "#C8C8C8", "#111111"],
    baseSize: 0.09,
    leading: 0.84,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.7,
    sceneWordTarget: 4,
    shadow: 0.28,
    voices: {
      base:
      { fontId: 'chivo', weight: 700, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'chivo', weight: 800, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1.25, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'chivo', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "offset-hero", "stack-center", "anchor-bottom"],
    enterAnimations: ["wipe-left", "pop", "flash", "wipe-up"],
    exitAnimations: ["none", "flash"],
  },
  SAIRA_NARROW: {
    id: 'SAIRA_NARROW',
    label: "Saira narrow",
    description: "Heavy over heavy. Condensed, clean, many.",
    tags: ["condensed", "clean", "many"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.115,
    leading: 0.8,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.6,
    sceneWordTarget: 6,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'sairaCondensed', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.025, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'sairaCondensed', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.025, sizeScale: 1.18, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'sairaCondensed', weight: 500, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "offset-hero"],
    enterAnimations: ["wipe-up", "fade-up", "pop", "mask-reveal", "word-pop"],
    exitAnimations: ["none", "fade"],
  },
  RAJDHANI_TECH: {
    id: 'RAJDHANI_TECH',
    label: "Rajdhani tech",
    description: "Heavy over heavy. Sci-fi, squared, ui.",
    tags: ["sci-fi", "squared", "ui"],
    palette: ["#FFFFFF", "#D6E0F0", "#2F6BFF"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'rajdhani', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'rajdhani', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'rajdhani', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'spaceMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  GARAMOND_QUIET: {
    id: 'GARAMOND_QUIET',
    label: "Garamond quiet",
    description: "Serif over workhorse. Literary, timeless, calm.",
    tags: ["literary", "timeless", "calm"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.066,
    leading: 0.96,
    heroesPerScene: 1,
    rotationBudget: 0.18,
    motionLevel: 0.3,
    sceneWordTarget: 6,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'inter', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'ebGaramond', weight: 500, textTransform: 'title', italic: true, tracking: 0.01, sizeScale: 1.6, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'ebGaramond', weight: 500, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["quote-block", "stack-center", "anchor-bottom", "cascade-left"],
    enterAnimations: ["fade", "fade-up", "tracking-in", "blur-in"],
    exitAnimations: ["fade"],
  },
  LORA_WARM: {
    id: 'LORA_WARM',
    label: "Lora warm",
    description: "Serif over geometric. Warm, trustworthy, brand.",
    tags: ["warm", "trustworthy", "brand"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'workSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'lora', weight: 600, textTransform: 'title', italic: false, tracking: -0.01, sizeScale: 2.15, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'lora', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  SPECTRAL_CALM: {
    id: 'SPECTRAL_CALM',
    label: "Spectral calm",
    description: "Serif over workhorse. Calm, wide, longform.",
    tags: ["calm", "wide", "longform"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.05,
    leading: 1.2,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.18,
    sceneWordTarget: 8,
    shadow: 0.5,
    voices: {
      base:
      { fontId: 'inter', weight: 400, textTransform: 'none', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'spectral', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.01, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'spectral', weight: 500, textTransform: 'none', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "quote-block", "stack-center"],
    enterAnimations: ["fade", "fade-up", "blur-in"],
    exitAnimations: ["fade"],
  },
  CRIMSON_BOOK: {
    id: 'CRIMSON_BOOK',
    label: "Crimson book",
    description: "Serif over geometric. Scholarly, quiet, book.",
    tags: ["scholarly", "quiet", "book"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.066,
    leading: 0.96,
    heroesPerScene: 1,
    rotationBudget: 0.18,
    motionLevel: 0.3,
    sceneWordTarget: 6,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'publicSans', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'crimsonPro', weight: 500, textTransform: 'title', italic: true, tracking: 0.01, sizeScale: 1.6, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'crimsonPro', weight: 500, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["quote-block", "stack-center", "anchor-bottom", "cascade-left"],
    enterAnimations: ["fade", "fade-up", "tracking-in", "blur-in"],
    exitAnimations: ["fade"],
  },
  VOLLKORN_BOLD: {
    id: 'VOLLKORN_BOLD',
    label: "Vollkorn bold",
    description: "Serif over geometric. Sturdy, friendly, quote.",
    tags: ["sturdy", "friendly", "quote"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'karla', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'vollkorn', weight: 600, textTransform: 'title', italic: false, tracking: -0.01, sizeScale: 2.15, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'vollkorn', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  NEWSREADER: {
    id: 'NEWSREADER',
    label: "Newsreader",
    description: "Serif over geometric. News, italic, editorial.",
    tags: ["news", "italic", "editorial"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'publicSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'newsreader', weight: 600, textTransform: 'title', italic: false, tracking: -0.01, sizeScale: 2.15, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'newsreader', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  LITERATA_READ: {
    id: 'LITERATA_READ',
    label: "Literata read",
    description: "Serif over workhorse. Reading, screen, comfy.",
    tags: ["reading", "screen", "comfy"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.05,
    leading: 1.2,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.18,
    sceneWordTarget: 8,
    shadow: 0.5,
    voices: {
      base:
      { fontId: 'inter', weight: 400, textTransform: 'none', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'literata', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.01, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'literata', weight: 500, textTransform: 'none', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "quote-block", "stack-center"],
    enterAnimations: ["fade", "fade-up", "blur-in"],
    exitAnimations: ["fade"],
  },
  PETRONA_SOFT: {
    id: 'PETRONA_SOFT',
    label: "Petrona soft",
    description: "Serif over geometric. Flared, soft, humanist.",
    tags: ["flared", "soft", "humanist"],
    palette: ["#FBFDF9", "#DDE7D6", "#7C9A6"],
    baseSize: 0.064,
    leading: 1.0,
    heroesPerScene: 1,
    rotationBudget: 0.2,
    motionLevel: 0.28,
    sceneWordTarget: 6,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'figtree', weight: 300, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'petrona', weight: 400, textTransform: 'title', italic: false, tracking: 0.02, sizeScale: 2.0, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'petrona', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "anchor-bottom", "corner-note"],
    enterAnimations: ["fade", "tracking-in", "blur-in", "fade-up"],
    exitAnimations: ["fade", "blur-in"],
  },
  FAUSTINA_CRISP: {
    id: 'FAUSTINA_CRISP',
    label: "Faustina crisp",
    description: "Serif over geometric. Crisp, modern, text.",
    tags: ["crisp", "modern", "text"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'workSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'faustina', weight: 600, textTransform: 'title', italic: false, tracking: -0.01, sizeScale: 2.15, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'faustina', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  FRANK_RUHL: {
    id: 'FRANK_RUHL',
    label: "Frank Ruhl",
    description: "Serif over geometric. Contrast, modern, sharp.",
    tags: ["contrast", "modern", "sharp"],
    palette: ["#FFFFFF", "#C8C8C8", "#111111"],
    baseSize: 0.082,
    leading: 0.86,
    heroesPerScene: 1,
    rotationBudget: 0.08,
    motionLevel: 0.5,
    sceneWordTarget: 5,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'publicSans', weight: 600, textTransform: 'uppercase', italic: false, tracking: -0.005, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'frankRuhlLibre', weight: 700, textTransform: 'title', italic: false, tracking: -0.005, sizeScale: 1.55, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'frankRuhlLibre', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "offset-hero", "anchor-top", "edge-vertical", "split-drift"],
    enterAnimations: ["wipe-up", "mask-reveal", "tracking-in", "scale-in", "flash"],
    exitAnimations: ["none", "fade", "wipe-up"],
  },
  GOUDY_ANTIQUE: {
    id: 'GOUDY_ANTIQUE',
    label: "Goudy antique",
    description: "Serif over workhorse. Antique, gentle, warm.",
    tags: ["antique", "gentle", "warm"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.066,
    leading: 0.96,
    heroesPerScene: 1,
    rotationBudget: 0.18,
    motionLevel: 0.3,
    sceneWordTarget: 6,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'inter', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'sortsMillGoudy', weight: 400, textTransform: 'title', italic: true, tracking: 0.01, sizeScale: 1.6, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'sortsMillGoudy', weight: 400, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["quote-block", "stack-center", "anchor-bottom", "cascade-left"],
    enterAnimations: ["fade", "fade-up", "tracking-in", "blur-in"],
    exitAnimations: ["fade"],
  },
  ECZAR_ENERGY: {
    id: 'ECZAR_ENERGY',
    label: "Eczar energy",
    description: "Serif over geometric. Energetic, display, heavy.",
    tags: ["energetic", "display", "heavy"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'workSans', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'eczar', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.32, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'eczar', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  BITTER_SLAB: {
    id: 'BITTER_SLAB',
    label: "Bitter slab",
    description: "Serif over workhorse. Slab, solid, dependable.",
    tags: ["slab", "solid", "dependable"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'inter', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'bitter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.4, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'bitter', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'spaceMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  ZILLA_TECH: {
    id: 'ZILLA_TECH',
    label: "Zilla tech",
    description: "Serif over workhorse. Slab, technical, warm.",
    tags: ["slab", "technical", "warm"],
    palette: ["#FFFFFF", "#D6E0F0", "#2F6BFF"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'inter', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'zillaSlab', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.4, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'zillaSlab', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'jetbrainsMono', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  BASKERVILLE_BOOK: {
    id: 'BASKERVILLE_BOOK',
    label: "Baskerville book",
    description: "Serif over workhorse. Bookish, wide, readable.",
    tags: ["bookish", "wide", "readable"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.066,
    leading: 0.96,
    heroesPerScene: 1,
    rotationBudget: 0.18,
    motionLevel: 0.3,
    sceneWordTarget: 6,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'inter', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'libreBaskerville', weight: 400, textTransform: 'title', italic: true, tracking: 0.01, sizeScale: 1.6, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'libreBaskerville', weight: 400, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["quote-block", "stack-center", "anchor-bottom", "cascade-left"],
    enterAnimations: ["fade", "fade-up", "tracking-in", "blur-in"],
    exitAnimations: ["fade"],
  },
  FRAUNCES_WONK: {
    id: 'FRAUNCES_WONK',
    label: "Fraunces wonk",
    description: "Serif over workhorse. Wonky, warm, character.",
    tags: ["wonky", "warm", "character"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'dmSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'fraunces', weight: 600, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'caveat', weight: 500, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'dmSans', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  CORMORANT_AIR: {
    id: 'CORMORANT_AIR',
    label: "Cormorant air",
    description: "Serif over geometric. Airy, delicate, light.",
    tags: ["airy", "delicate", "light"],
    palette: ["#FFFFFF", "#F6EFE7", "#E3B7A8"],
    baseSize: 0.064,
    leading: 1.0,
    heroesPerScene: 1,
    rotationBudget: 0.2,
    motionLevel: 0.28,
    sceneWordTarget: 6,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'jost', weight: 300, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'cormorant', weight: 400, textTransform: 'title', italic: false, tracking: 0.02, sizeScale: 2.0, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'cormorant', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "cascade-left", "quote-block", "anchor-bottom", "corner-note"],
    enterAnimations: ["fade", "tracking-in", "blur-in", "fade-up"],
    exitAnimations: ["fade", "blur-in"],
  },
  INSTRUMENT_QUIET: {
    id: 'INSTRUMENT_QUIET',
    label: "Instrument quiet",
    description: "Serif over workhorse. Quiet, expensive, editorial.",
    tags: ["quiet", "expensive", "editorial"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'dmSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'instrumentSerif', weight: 400, textTransform: 'title', italic: false, tracking: -0.01, sizeScale: 2.15, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'instrumentSerif', weight: 400, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  JOSEFIN_DECO: {
    id: 'JOSEFIN_DECO',
    label: "Josefin deco",
    description: "Geometric over geometric. Deco, retro, elegant.",
    tags: ["deco", "retro", "elegant"],
    palette: ["#FFFFFF", "#E4DCF2", "#7B5CD6"],
    baseSize: 0.075,
    leading: 0.88,
    heroesPerScene: 0,
    rotationBudget: 0.45,
    motionLevel: 0.92,
    sceneWordTarget: 5,
    shadow: 0.26,
    voices: {
      base:
      { fontId: 'josefinSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'josefinSans', weight: 600, textTransform: 'uppercase', italic: false, tracking: -0.02, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'josefinSans', weight: 500, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["diagonal-descend", "edge-vertical", "offset-hero", "split-drift", "anchor-top"],
    enterAnimations: ["flash", "pop", "word-pop", "slide-left", "wipe-left"],
    exitAnimations: ["none", "flash", "fade"],
  },
  JOST_BAUHAUS: {
    id: 'JOST_BAUHAUS',
    label: "Jost bauhaus",
    description: "Geometric over geometric. Bauhaus, geometric, clean.",
    tags: ["bauhaus", "geometric", "clean"],
    palette: ["#FFFFFF", "#C8C8C8", "#111111"],
    baseSize: 0.09,
    leading: 0.84,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.7,
    sceneWordTarget: 4,
    shadow: 0.28,
    voices: {
      base:
      { fontId: 'jost', weight: 700, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'jost', weight: 800, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1.25, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'jost', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "offset-hero", "stack-center", "anchor-bottom"],
    enterAnimations: ["wipe-left", "pop", "flash", "wipe-up"],
    exitAnimations: ["none", "flash"],
  },
  QUICKSAND_SOFT: {
    id: 'QUICKSAND_SOFT',
    label: "Quicksand soft",
    description: "Geometric over geometric. Rounded, soft, friendly.",
    tags: ["rounded", "soft", "friendly"],
    palette: ["#FFFFFF", "#DCEFE6", "#3FBF8F"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 0,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'quicksand', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'quicksand', weight: 600, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'quicksand', weight: 500, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  COMFORTAA_ROUND: {
    id: 'COMFORTAA_ROUND',
    label: "Comfortaa round",
    description: "Geometric over geometric. Very-round, gentle, kids.",
    tags: ["very-round", "gentle", "kids"],
    palette: ["#FFFFFF", "#DCEFE6", "#3FBF8F"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 0,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'comfortaa', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'comfortaa', weight: 600, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'comfortaa', weight: 500, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  POPPINS_CLEAN: {
    id: 'POPPINS_CLEAN',
    label: "Poppins clean",
    description: "Geometric over geometric. Clean, ubiquitous, modern.",
    tags: ["clean", "ubiquitous", "modern"],
    palette: ["#FFFFFF", "#D6E0F0", "#2F6BFF"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'poppins', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'poppins', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.32, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'poppins', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  MONTSERRAT_URBAN: {
    id: 'MONTSERRAT_URBAN',
    label: "Montserrat urban",
    description: "Geometric over geometric. Urban, confident, neutral.",
    tags: ["urban", "confident", "neutral"],
    palette: ["#FFFFFF", "#C8C8C8", "#111111"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'montserrat', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'montserrat', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.32, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'montserrat', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  RALEWAY_LIGHT: {
    id: 'RALEWAY_LIGHT',
    label: "Raleway light",
    description: "Geometric over geometric. Elegant, light, refined.",
    tags: ["elegant", "light", "refined"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.05,
    leading: 1.2,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.18,
    sceneWordTarget: 8,
    shadow: 0.5,
    voices: {
      base:
      { fontId: 'raleway', weight: 400, textTransform: 'none', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'raleway', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.01, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'raleway', weight: 500, textTransform: 'none', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "quote-block", "stack-center"],
    enterAnimations: ["fade", "fade-up", "blur-in"],
    exitAnimations: ["fade"],
  },
  OUTFIT_CRISP: {
    id: 'OUTFIT_CRISP',
    label: "Outfit crisp",
    description: "Geometric over geometric. Crisp, current, startup.",
    tags: ["crisp", "current", "startup"],
    palette: ["#FFFFFF", "#D6E0F0", "#2F6BFF"],
    baseSize: 0.09,
    leading: 0.84,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.7,
    sceneWordTarget: 4,
    shadow: 0.28,
    voices: {
      base:
      { fontId: 'outfit', weight: 700, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'outfit', weight: 800, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1.25, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'outfit', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "offset-hero", "stack-center", "anchor-bottom"],
    enterAnimations: ["wipe-left", "pop", "flash", "wipe-up"],
    exitAnimations: ["none", "flash"],
  },
  URBANIST_CALM: {
    id: 'URBANIST_CALM',
    label: "Urbanist calm",
    description: "Geometric over geometric. Calm, low-contrast, modern.",
    tags: ["calm", "low-contrast", "modern"],
    palette: ["#FBFDF9", "#DDE7D6", "#7C9A6"],
    baseSize: 0.05,
    leading: 1.2,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.18,
    sceneWordTarget: 8,
    shadow: 0.5,
    voices: {
      base:
      { fontId: 'urbanist', weight: 400, textTransform: 'none', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'urbanist', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.01, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'urbanist', weight: 500, textTransform: 'none', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "quote-block", "stack-center"],
    enterAnimations: ["fade", "fade-up", "blur-in"],
    exitAnimations: ["fade"],
  },
  SORA_TECH: {
    id: 'SORA_TECH',
    label: "Sora tech",
    description: "Geometric over geometric. Technical, brand, geometric.",
    tags: ["technical", "brand", "geometric"],
    palette: ["#FFFFFF", "#D6E0F0", "#2F6BFF"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'sora', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'sora', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'sora', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'jetbrainsMono', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  LEXEND_OPEN: {
    id: 'LEXEND_OPEN',
    label: "Lexend open",
    description: "Geometric over geometric. Readable, open, clear.",
    tags: ["readable", "open", "clear"],
    palette: ["#FFFFFF", "#DCEFE6", "#3FBF8F"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'lexend', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'lexend', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'lexend', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  SPARTAN_BOLD: {
    id: 'SPARTAN_BOLD',
    label: "Spartan bold",
    description: "Geometric over geometric. Even, bold, geometric.",
    tags: ["even", "bold", "geometric"],
    palette: ["#FFFFFF", "#C4C4C4", "#39FF6A"],
    baseSize: 0.09,
    leading: 0.84,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.7,
    sceneWordTarget: 4,
    shadow: 0.28,
    voices: {
      base:
      { fontId: 'leagueSpartan', weight: 700, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'leagueSpartan', weight: 800, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1.25, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'leagueSpartan', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "offset-hero", "stack-center", "anchor-bottom"],
    enterAnimations: ["wipe-left", "pop", "flash", "wipe-up"],
    exitAnimations: ["none", "flash"],
  },
  WORK_PLAIN: {
    id: 'WORK_PLAIN',
    label: "Work plain",
    description: "Geometric over geometric. Neutral, plain, screen.",
    tags: ["neutral", "plain", "screen"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'workSans', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'workSans', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'workSans', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  KARLA_ODD: {
    id: 'KARLA_ODD',
    label: "Karla odd",
    description: "Geometric over geometric. Quirky, friendly, odd.",
    tags: ["quirky", "friendly", "odd"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'karla', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'karla', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'karla', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'spaceMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  RUBIK_SOFT: {
    id: 'RUBIK_SOFT',
    label: "Rubik soft",
    description: "Geometric over geometric. Rounded, sturdy, soft.",
    tags: ["rounded", "sturdy", "soft"],
    palette: ["#FFFFFF", "#E4DCF2", "#7B5CD6"],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    voices: {
      base:
      { fontId: 'rubik', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'rubik', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.32, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'rubik', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "anchor-bottom", "cascade-left", "stack-center", "offset-hero"],
    enterAnimations: ["wipe-left", "pop", "slide-right", "word-pop", "wipe-up"],
    exitAnimations: ["none", "wipe-left", "fade"],
  },
  BARLOW_LOWKEY: {
    id: 'BARLOW_LOWKEY',
    label: "Barlow lowkey",
    description: "Geometric over geometric. Low-key, versatile, plain.",
    tags: ["low-key", "versatile", "plain"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'barlow', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'barlow', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'barlow', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  EPILOGUE_RANGE: {
    id: 'EPILOGUE_RANGE',
    label: "Epilogue range",
    description: "Geometric over geometric. Variable, wide, grotesk.",
    tags: ["variable", "wide", "grotesk"],
    palette: ["#FFFFFF", "#C8C8C8", "#111111"],
    baseSize: 0.09,
    leading: 0.84,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.7,
    sceneWordTarget: 4,
    shadow: 0.28,
    voices: {
      base:
      { fontId: 'epilogue', weight: 700, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'epilogue', weight: 800, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1.25, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'epilogue', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "offset-hero", "stack-center", "anchor-bottom"],
    enterAnimations: ["wipe-left", "pop", "flash", "wipe-up"],
    exitAnimations: ["none", "flash"],
  },
  SCREENPLAY: {
    id: 'SCREENPLAY',
    label: "Screenplay",
    description: "Mono over mono. Screenplay, documentary, typewriter.",
    tags: ["screenplay", "documentary", "typewriter"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'courierPrime', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'courierPrime', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'courierPrime', weight: 400, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'courierPrime', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  TERMINAL: {
    id: 'TERMINAL',
    label: "Terminal",
    description: "Mono over mono. Code, terminal, dev.",
    tags: ["code", "terminal", "dev"],
    palette: ["#FFFFFF", "#DCEFE6", "#3FBF8F"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'jetbrainsMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'jetbrainsMono', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'jetbrainsMono', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'jetbrainsMono', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  SPACE_MONO_EDIT: {
    id: 'SPACE_MONO_EDIT',
    label: "Space mono edit",
    description: "Mono over mono. Retro-future, offbeat, editorial.",
    tags: ["retro-future", "offbeat", "editorial"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'spaceMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'spaceMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'spaceMono', weight: 400, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'spaceMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  PLEX_ENG: {
    id: 'PLEX_ENG',
    label: "Plex engineering",
    description: "Mono over mono. Corporate, engineered, warm.",
    tags: ["corporate", "engineered", "warm"],
    palette: ["#FFFFFF", "#D6E0F0", "#2F6BFF"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'ibmPlexMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'ibmPlexMono', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'ibmPlexMono', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'ibmPlexMono', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  TYPEWRITER_OLD: {
    id: 'TYPEWRITER_OLD',
    label: "Old typewriter",
    description: "Mono over mono. Vintage, typed, archive.",
    tags: ["vintage", "typed", "archive"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.066,
    leading: 0.96,
    heroesPerScene: 0,
    rotationBudget: 0.18,
    motionLevel: 0.3,
    sceneWordTarget: 6,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'cutiveMono', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'cutiveMono', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'cutiveMono', weight: 400, textTransform: 'title', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'cutiveMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["quote-block", "stack-center", "anchor-bottom", "cascade-left"],
    enterAnimations: ["fade", "fade-up", "tracking-in", "blur-in"],
    exitAnimations: ["fade"],
  },
  XANH_LITERARY: {
    id: 'XANH_LITERARY',
    label: "Xanh literary",
    description: "Mono over mono. Literary, serif-mono, unusual.",
    tags: ["literary", "serif-mono", "unusual"],
    palette: ["#F7F3EC", "#DED5C6", "#B08D57"],
    baseSize: 0.066,
    leading: 0.96,
    heroesPerScene: 0,
    rotationBudget: 0.18,
    motionLevel: 0.3,
    sceneWordTarget: 6,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'xanhMono', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'xanhMono', weight: 400, textTransform: 'title', italic: true, tracking: 0.01, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'xanhMono', weight: 400, textTransform: 'title', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'xanhMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["quote-block", "stack-center", "anchor-bottom", "cascade-left"],
    enterAnimations: ["fade", "fade-up", "tracking-in", "blur-in"],
    exitAnimations: ["fade"],
  },
  FIRA_DEV: {
    id: 'FIRA_DEV',
    label: "Fira dev",
    description: "Mono over mono. Dev, ligatures, precise.",
    tags: ["dev", "ligatures", "precise"],
    palette: ["#FFFFFF", "#D6E0F0", "#2F6BFF"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'firaCode', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'firaCode', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'firaCode', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'firaCode', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  MONO_SCRIPT: {
    id: 'MONO_SCRIPT',
    label: "Mono script",
    description: "Script over mono. Contrast, technical, elegant.",
    tags: ["contrast", "technical", "elegant"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    voices: {
      base:
      { fontId: 'spaceMono', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'styleScript', weight: 400, textTransform: 'title', italic: false, tracking: 0, sizeScale: 2.15, baselineShift: 0.1, colorIndex: 0 },
      accent:
      { fontId: 'spaceMono', weight: 400, textTransform: 'lowercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'spaceMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["cascade-left", "stack-center", "anchor-top", "offset-hero", "split-drift", "cascade-right"],
    enterAnimations: ["fade-up", "fade", "mask-reveal", "tracking-in", "scale-in"],
    exitAnimations: ["fade", "fade-up"],
  },
  MONO_DIDONE: {
    id: 'MONO_DIDONE',
    label: "Mono didone",
    description: "Didone over mono. Contrast, editorial, modern.",
    tags: ["contrast", "editorial", "modern"],
    palette: ["#FFFFFF", "#C8C8C8", "#111111"],
    baseSize: 0.082,
    leading: 0.86,
    heroesPerScene: 1,
    rotationBudget: 0.08,
    motionLevel: 0.5,
    sceneWordTarget: 5,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'dmMono', weight: 500, textTransform: 'uppercase', italic: false, tracking: -0.005, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'bodoni', weight: 700, textTransform: 'title', italic: true, tracking: -0.005, sizeScale: 1.55, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'dmMono', weight: 500, textTransform: 'uppercase', italic: true, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'dmMono', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "offset-hero", "anchor-top", "edge-vertical", "split-drift"],
    enterAnimations: ["wipe-up", "mask-reveal", "tracking-in", "scale-in", "flash"],
    exitAnimations: ["none", "fade", "wipe-up"],
  },
  MARKER_NOTE: {
    id: 'MARKER_NOTE',
    label: "Marker note",
    description: "Quirky over workhorse. Marker, bold, annotation.",
    tags: ["marker", "bold", "annotation"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'archivo', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'permanentMarker', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'permanentMarker', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'dmSans', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  ROCK_RAW: {
    id: 'ROCK_RAW',
    label: "Rock raw",
    description: "Quirky over geometric. Raw, personal, rough.",
    tags: ["raw", "personal", "rough"],
    palette: ["#FFFFFF", "#C8C8C8", "#111111"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'workSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'rockSalt', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'rockSalt', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'dmSans', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  DIARY_LIGHT: {
    id: 'DIARY_LIGHT',
    label: "Diary light",
    description: "Quirky over geometric. Diary, light, casual.",
    tags: ["diary", "light", "casual"],
    palette: ["#FFFFFF", "#F6EFE7", "#E3B7A8"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'nunito', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'shadowsIntoLight', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'shadowsIntoLight', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  SCHOOLBOOK: {
    id: 'SCHOOLBOOK',
    label: "Schoolbook",
    description: "Quirky over geometric. School, bouncy, playful.",
    tags: ["school", "bouncy", "playful"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'quicksand', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'gloriaHallelujah', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'gloriaHallelujah', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  PATRICK_NEAT: {
    id: 'PATRICK_NEAT',
    label: "Patrick neat",
    description: "Quirky over geometric. Neat, friendly, legible.",
    tags: ["neat", "friendly", "legible"],
    palette: ["#FFFFFF", "#DCEFE6", "#3FBF8F"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'nunito', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'patrickHand', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'patrickHand', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  DRAFTING: {
    id: 'DRAFTING',
    label: "Drafting",
    description: "Quirky over geometric. Sketch, drafting, casual.",
    tags: ["sketch", "drafting", "casual"],
    palette: ["#F2F2F2", "#B5B5B5", "#8A8A8A"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'workSans', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'architectsDaughter', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.4, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'architectsDaughter', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  BALLPOINT: {
    id: 'BALLPOINT',
    label: "Ballpoint",
    description: "Quirky over workhorse. Thin, quick, scrawl.",
    tags: ["thin", "quick", "scrawl"],
    palette: ["#FFFFFF", "#EDE8E0", "#C9BFAE"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'inter', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'nanumPenScript', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'nanumPenScript', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  SRIRACHA_HOT: {
    id: 'SRIRACHA_HOT',
    label: "Sriracha hot",
    description: "Quirky over geometric. Loose, attitude, brush.",
    tags: ["loose", "attitude", "brush"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'poppins', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'sriracha', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'sriracha', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  AMATIC_TALL: {
    id: 'AMATIC_TALL',
    label: "Amatic tall",
    description: "Quirky over geometric. Tall, narrow, charming.",
    tags: ["tall", "narrow", "charming"],
    palette: ["#FBFDF9", "#DDE7D6", "#7C9A6"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'workSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'amaticSC', weight: 700, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'amaticSC', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  LOBSTER_SIGN: {
    id: 'LOBSTER_SIGN',
    label: "Lobster sign",
    description: "Quirky over geometric. Sign-painter, retro, classic.",
    tags: ["sign-painter", "retro", "classic"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.066,
    leading: 0.96,
    heroesPerScene: 1,
    rotationBudget: 0.18,
    motionLevel: 0.3,
    sceneWordTarget: 6,
    shadow: 0.45,
    voices: {
      base:
      { fontId: 'montserrat', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'lobster', weight: 400, textTransform: 'title', italic: false, tracking: 0.01, sizeScale: 1.6, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'lobster', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["quote-block", "stack-center", "anchor-bottom", "cascade-left"],
    enterAnimations: ["fade", "fade-up", "tracking-in", "blur-in"],
    exitAnimations: ["fade"],
  },
  PACIFICO_SURF: {
    id: 'PACIFICO_SURF',
    label: "Pacifico surf",
    description: "Quirky over geometric. Surf, sunny, casual.",
    tags: ["surf", "sunny", "casual"],
    palette: ["#FFFFFF", "#DCEFE6", "#3FBF8F"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'quicksand', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'pacifico', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'pacifico', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  BANGERS_COMIC: {
    id: 'BANGERS_COMIC',
    label: "Bangers comic",
    description: "Quirky over geometric. Comic, shout, energy.",
    tags: ["comic", "shout", "energy"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'poppins', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'bangers', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'bangers', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  LUCKIEST: {
    id: 'LUCKIEST',
    label: "Luckiest",
    description: "Quirky over geometric. Cartoon, loud, fun.",
    tags: ["cartoon", "loud", "fun"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'nunito', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'luckiestGuy', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'luckiestGuy', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  CHEWY_SOFT: {
    id: 'CHEWY_SOFT',
    label: "Chewy soft",
    description: "Quirky over geometric. Bubbly, childlike, warm.",
    tags: ["bubbly", "childlike", "warm"],
    palette: ["#FFFFFF", "#F5DCE4", "#D6547B"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'comfortaa', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'chewy', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'chewy', weight: 400, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  FREDOKA_MODERN: {
    id: 'FREDOKA_MODERN',
    label: "Fredoka modern",
    description: "Quirky over quirky. Rounded, cheerful, modern.",
    tags: ["rounded", "cheerful", "modern"],
    palette: ["#FFFFFF", "#DCEFE6", "#3FBF8F"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'fredoka', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'fredoka', weight: 600, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'fredoka', weight: 500, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  BALOO_BOUNCE: {
    id: 'BALOO_BOUNCE',
    label: "Baloo bounce",
    description: "Quirky over geometric. Bouncy, heavy, rounded.",
    tags: ["bouncy", "heavy", "rounded"],
    palette: ["#FFF9EC", "#FFE9B8", "#FFB020"],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    voices: {
      base:
      { fontId: 'nunito', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'baloo2', weight: 600, textTransform: 'lowercase', italic: false, tracking: -0.015, sizeScale: 1.5, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'baloo2', weight: 500, textTransform: 'none', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["corner-note", "diagonal-descend", "cascade-left", "split-drift", "anchor-bottom"],
    enterAnimations: ["pop", "rotate-in", "word-pop", "fade-up", "slide-right"],
    exitAnimations: ["fade", "pop"],
  },
  NEON_MARQUEE: {
    id: 'NEON_MARQUEE',
    label: "Neon marquee",
    description: "Experimental over geometric. Neon, marquee, retro.",
    tags: ["neon", "marquee", "retro"],
    palette: ["#FFFFFF", "#E4DCF2", "#7B5CD6"],
    baseSize: 0.075,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.45,
    motionLevel: 0.92,
    sceneWordTarget: 5,
    shadow: 0.26,
    voices: {
      base:
      { fontId: 'jost', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'monoton', weight: 400, textTransform: 'uppercase', italic: false, tracking: -0.02, sizeScale: 1.45, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'monoton', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["diagonal-descend", "edge-vertical", "offset-hero", "split-drift", "anchor-top"],
    enterAnimations: ["flash", "pop", "word-pop", "slide-left", "wipe-left"],
    exitAnimations: ["none", "flash", "fade"],
  },
  MEGRIM_LINE: {
    id: 'MEGRIM_LINE',
    label: "Megrim line",
    description: "Experimental over workhorse. Line, architectural, odd.",
    tags: ["line", "architectural", "odd"],
    palette: ["#FFFFFF", "#D6E0F0", "#2F6BFF"],
    baseSize: 0.075,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.45,
    motionLevel: 0.92,
    sceneWordTarget: 5,
    shadow: 0.26,
    voices: {
      base:
      { fontId: 'inter', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'megrim', weight: 400, textTransform: 'uppercase', italic: false, tracking: -0.02, sizeScale: 1.45, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'megrim', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["diagonal-descend", "edge-vertical", "offset-hero", "split-drift", "anchor-top"],
    enterAnimations: ["flash", "pop", "word-pop", "slide-left", "wipe-left"],
    exitAnimations: ["none", "flash", "fade"],
  },
  PIXEL_8BIT: {
    id: 'PIXEL_8BIT',
    label: "Pixel 8-bit",
    description: "Experimental over experimental. Pixel, 8bit, game.",
    tags: ["pixel", "8bit", "game"],
    palette: ["#FFFFFF", "#C4C4C4", "#39FF6A"],
    baseSize: 0.075,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.45,
    motionLevel: 0.92,
    sceneWordTarget: 5,
    shadow: 0.26,
    voices: {
      base:
      { fontId: 'silkscreen', weight: 400, textTransform: 'lowercase', italic: false, tracking: -0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'silkscreen', weight: 700, textTransform: 'uppercase', italic: false, tracking: -0.02, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'silkscreen', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'silkscreen', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["diagonal-descend", "edge-vertical", "offset-hero", "split-drift", "anchor-top"],
    enterAnimations: ["flash", "pop", "word-pop", "slide-left", "wipe-left"],
    exitAnimations: ["none", "flash", "fade"],
  },
  STENCIL_SPRAY: {
    id: 'STENCIL_SPRAY',
    label: "Stencil spray",
    description: "Experimental over workhorse. Stencil, industrial, spray.",
    tags: ["stencil", "industrial", "spray"],
    palette: ["#FFFFFF", "#E3E3E3", "#FF5A36"],
    baseSize: 0.09,
    leading: 0.84,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.7,
    sceneWordTarget: 4,
    shadow: 0.28,
    voices: {
      base:
      { fontId: 'archivo', weight: 700, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'wallpoet', weight: 400, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1.25, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'wallpoet', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'dmSans', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "offset-hero", "stack-center", "anchor-bottom"],
    enterAnimations: ["wipe-left", "pop", "flash", "wipe-up"],
    exitAnimations: ["none", "flash"],
  },
  MICHROMA_SCIFI: {
    id: 'MICHROMA_SCIFI',
    label: "Michroma sci-fi",
    description: "Experimental over experimental. Sci-fi, wide, title.",
    tags: ["sci-fi", "wide", "title"],
    palette: ["#FFFFFF", "#D6E0F0", "#2F6BFF"],
    baseSize: 0.058,
    leading: 1.05,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.35,
    sceneWordTarget: 7,
    shadow: 0.35,
    voices: {
      base:
      { fontId: 'michroma', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'michroma', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.06, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'michroma', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'spaceMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-bottom", "anchor-top", "cascade-left", "quote-block"],
    enterAnimations: ["typewriter", "fade", "wipe-left", "tracking-in"],
    exitAnimations: ["none", "fade"],
  },
  ORBITRON_SPACE: {
    id: 'ORBITRON_SPACE',
    label: "Orbitron space",
    description: "Experimental over experimental. Space-age, squared, techno.",
    tags: ["space-age", "squared", "techno"],
    palette: ["#FFFFFF", "#D6E0F0", "#2F6BFF"],
    baseSize: 0.075,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.45,
    motionLevel: 0.92,
    sceneWordTarget: 5,
    shadow: 0.26,
    voices: {
      base:
      { fontId: 'orbitron', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'orbitron', weight: 600, textTransform: 'uppercase', italic: false, tracking: -0.02, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'orbitron', weight: 500, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'spaceMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["diagonal-descend", "edge-vertical", "offset-hero", "split-drift", "anchor-top"],
    enterAnimations: ["flash", "pop", "word-pop", "slide-left", "wipe-left"],
    exitAnimations: ["none", "flash", "fade"],
  },
  SYNCOPATE_WIDE: {
    id: 'SYNCOPATE_WIDE',
    label: "Syncopate wide",
    description: "Experimental over experimental. Wide, tracked, fashion-tech.",
    tags: ["wide", "tracked", "fashion-tech"],
    palette: ["#FFFFFF", "#C8C8C8", "#111111"],
    baseSize: 0.082,
    leading: 0.86,
    heroesPerScene: 1,
    rotationBudget: 0.08,
    motionLevel: 0.5,
    sceneWordTarget: 5,
    shadow: 0.3,
    voices: {
      base:
      { fontId: 'syncopate', weight: 700, textTransform: 'uppercase', italic: false, tracking: -0.005, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'syncopate', weight: 700, textTransform: 'title', italic: false, tracking: -0.005, sizeScale: 1.35, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'syncopate', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["stack-center", "offset-hero", "anchor-top", "edge-vertical", "split-drift"],
    enterAnimations: ["wipe-up", "mask-reveal", "tracking-in", "scale-in", "flash"],
    exitAnimations: ["none", "fade", "wipe-up"],
  },
  RUBIK_MONO: {
    id: 'RUBIK_MONO',
    label: "Rubik mono",
    description: "Experimental over experimental. Blocky, heavy, immovable.",
    tags: ["blocky", "heavy", "immovable"],
    palette: ["#FFFFFF", "#C4C4C4", "#39FF6A"],
    baseSize: 0.09,
    leading: 0.84,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.7,
    sceneWordTarget: 4,
    shadow: 0.28,
    voices: {
      base:
      { fontId: 'rubikMonoOne', weight: 400, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'rubikMonoOne', weight: 400, textTransform: 'uppercase', italic: false, tracking: -0.03, sizeScale: 1.25, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'rubikMonoOne', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'spaceMono', weight: 400, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["anchor-top", "offset-hero", "stack-center", "anchor-bottom"],
    enterAnimations: ["wipe-left", "pop", "flash", "wipe-up"],
    exitAnimations: ["none", "flash"],
  },
  BUNGEE_SHADE: {
    id: 'BUNGEE_SHADE',
    label: "Bungee shade",
    description: "Experimental over geometric. Layered, dimensional, signage.",
    tags: ["layered", "dimensional", "signage"],
    palette: ["#FFFFFF", "#E4DCF2", "#7B5CD6"],
    baseSize: 0.075,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.45,
    motionLevel: 0.92,
    sceneWordTarget: 5,
    shadow: 0.26,
    voices: {
      base:
      { fontId: 'workSans', weight: 500, textTransform: 'lowercase', italic: false, tracking: -0.02, sizeScale: 1, baselineShift: 0, colorIndex: 0 },
      hero:
      { fontId: 'bungeeShade', weight: 400, textTransform: 'uppercase', italic: false, tracking: -0.02, sizeScale: 1.45, baselineShift: 0.02, colorIndex: 0 },
      accent:
      { fontId: 'bungeeShade', weight: 400, textTransform: 'lowercase', italic: false, tracking: 0.02, sizeScale: 1.2, baselineShift: 0.02, colorIndex: 2 },
      micro:
      { fontId: 'inter', weight: 500, textTransform: 'uppercase', italic: false, tracking: 0.24, sizeScale: 0.24, baselineShift: 0, colorIndex: 1 },
    },
    compositions: ["diagonal-descend", "edge-vertical", "offset-hero", "split-drift", "anchor-top"],
    enterAnimations: ["flash", "pop", "word-pop", "slide-left", "wipe-left"],
    exitAnimations: ["none", "flash", "fade"],
  },} as const satisfies Record<string, PresetDef>;

export type PresetId = keyof typeof PRESET_REGISTRY;

export const PRESET_IDS = Object.keys(PRESET_REGISTRY) as PresetId[];

export function getPreset(id: string): PresetDef {
  return (PRESET_REGISTRY as Record<string, PresetDef>)[id] ?? PRESET_REGISTRY.SCRIPT_EDITORIAL;
}

export function isPresetId(id: string): id is PresetId {
  return Object.prototype.hasOwnProperty.call(PRESET_REGISTRY, id);
}

/** Every distinct tag across the registry, for filtering in the UI. */
export const PRESET_TAGS: string[] = [
  ...new Set(PRESET_IDS.flatMap((id) => getPreset(id).tags)),
].sort();

export function presetsByTag(tag: string): PresetDef[] {
  return PRESET_IDS.map(getPreset).filter((p) => p.tags.includes(tag));
}

/* ------------------------------------------------------------------ */
/* Automatic selection                                                 */
/* ------------------------------------------------------------------ */

export interface StyleContext {
  /** What the audio turned out to be. */
  contentType?: 'speech' | 'song' | 'mixed' | 'instrumental' | 'unknown';
  /** Free-text mood from the audio verification pass. */
  mood?: string;
  /** The transcript, for topic cues. */
  text?: string;
  /** Shot mix measured from the footage. */
  shots?: Array<'closeup' | 'medium' | 'wide' | 'empty'>;
  /** Frame aspect ratio, width / height. */
  aspect?: number;
  /** Mean frame brightness, 0..1. */
  luma?: number;
  /** Stable per-project value, so the same video gets the same look twice. */
  seed?: number;
}

/**
 * Words in the transcript or mood that point at a tag.
 *
 * Deliberately small and legible rather than a model call: choosing a look is
 * instant, free and reproducible this way, and the AI still gets to override it
 * in the design pass if it disagrees.
 */
const TAG_CUES: Record<string, string[]> = {
  luxury: ['luxury', 'expensive', 'elegant', 'gold', 'designer', 'timeless', 'quiet'],
  fashion: ['fashion', 'style', 'outfit', 'wear', 'runway', 'model', 'dress', 'beauty'],
  travel: ['travel', 'trip', 'city', 'flight', 'hotel', 'abroad', 'holiday', 'vacation'],
  vlog: ['day', 'morning', 'routine', 'vlog', 'week', 'life', 'diary'],
  romantic: ['love', 'heart', 'romance', 'kiss', 'forever', 'sweet', 'miss you'],
  playful: ['fun', 'lol', 'crazy', 'silly', 'joke', 'party', 'haha'],
  bold: ['best', 'top', 'must', 'stop', 'never', 'always', 'secret', 'hack'],
  howto: ['how to', 'tips', 'guide', 'steps', 'learn', 'tutorial'],
  technical: ['code', 'data', 'build', 'system', 'engineer', 'software', 'ai'],
  cinematic: ['film', 'story', 'scene', 'moment', 'memory', 'silence'],
  music: ['song', 'beat', 'music', 'sing', 'lyrics', 'dance'],
  sport: ['run', 'train', 'gym', 'game', 'win', 'fast', 'strong'],
  calm: ['calm', 'slow', 'quiet', 'peace', 'breathe', 'still'],
  y2k: ['y2k', 'retro', 'neon', 'club', 'rave', 'edit'],
  vintage: ['vintage', 'old', 'classic', 'retro', 'analog', 'film'],
};

/** Small deterministic hash, so a given project always resolves the same way. */
function hash(seed: number, salt: number): number {
  let h = (seed * 2654435761 + salt * 40503 + 12345) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h / 0xffffffff;
}

/**
 * Pick a look for this video.
 *
 * Replaces asking the user to choose a style before they have seen anything.
 * They cannot know which of 135 pairings suits footage they have not watched
 * yet, and every option is a chance to pick badly - so the app decides, and the
 * user changes it afterwards in one click, with the result visible.
 *
 * Scoring is transparent on purpose: tags matched from the transcript and mood,
 * plus shot-mix and orientation fit, plus a small stable jitter so two similar
 * videos do not always land on the same preset.
 */
export function choosePreset(context: StyleContext): PresetId {
  const haystack = `${context.mood ?? ''} ${context.text ?? ''}`.toLowerCase();
  const seed = context.seed ?? 1;

  const wanted = new Set<string>();
  for (const [tag, cues] of Object.entries(TAG_CUES)) {
    if (cues.some((cue) => haystack.includes(cue))) wanted.add(tag);
  }

  if (context.contentType === 'song') {
    wanted.add('music');
    wanted.add('romantic');
  }
  if (context.contentType === 'instrumental') wanted.add('cinematic');

  const shots = context.shots ?? [];
  const closeups = shots.filter((s) => s === 'closeup').length / Math.max(1, shots.length);
  const empties = shots.filter((s) => s === 'empty' || s === 'wide').length / Math.max(1, shots.length);

  let bestId: PresetId = 'SCRIPT_EDITORIAL';
  let bestScore = -Infinity;

  PRESET_IDS.forEach((id, index) => {
    const preset = getPreset(id);
    let score = 0;

    for (const tag of preset.tags) if (wanted.has(tag)) score += 3;

    // A close-up-heavy edit needs restraint: big stacked type has nowhere to go
    // once the face is excluded.
    if (closeups > 0.5) {
      score += preset.baseSize < 0.07 ? 1.6 : -1.4;
      score += preset.motionLevel < 0.5 ? 0.5 : -0.3;
    }
    // Open frames can carry the loud presets.
    if (empties > 0.6) score += preset.baseSize > 0.075 ? 1.2 : 0;

    // Landscape has no room for a tall interlocking stack.
    if ((context.aspect ?? 0.5625) > 1 && preset.leading < 0.86) score -= 1.2;

    // Bright footage: prefer a preset whose type is heavy enough to hold up.
    if ((context.luma ?? 0.5) > 0.65 && preset.shadow < 0.3) score -= 0.6;

    // Enough jitter to vary between similar videos, never enough to beat a
    // real tag match.
    score += hash(seed, index) * 1.2;

    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  });

  return bestId;
}

/**
 * A few alternatives close to the chosen look, for the "try another" control.
 * Ordered by tag overlap so the suggestions are related, not random.
 */
export function relatedPresets(id: string, limit = 8): PresetDef[] {
  const source = getPreset(id);
  return PRESET_IDS.map(getPreset)
    .filter((p) => p.id !== source.id)
    .map((p) => ({ p, overlap: p.tags.filter((t) => source.tags.includes(t)).length }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map((entry) => entry.p);
}

/* ------------------------------------------------------------------ */
/* Reference mapping                                                   */
/* ------------------------------------------------------------------ */

/**
 * Free stand-ins for the commercial faces people usually ask for.
 *
 * The typography references circulating for this style are almost entirely
 * licensed fonts that cannot ship in an open repository. These are the closest
 * openly-licensed equivalents, so the same look is reachable legally.
 */
export const PAIRING_NOTES: Array<{ commercial: string; use: FontId; note: string }> = [
  { commercial: 'TAN Aegean', use: 'cinzel', note: 'Classical carved capitals with the same stone-cut feel.' },
  { commercial: 'TAN Harmony', use: 'marcellus', note: 'Elegant Roman capitals, slightly softer.' },
  { commercial: 'RoxboroughCF', use: 'cinzel', note: 'Flared classical serif capitals.' },
  { commercial: 'Sloop Script Pro', use: 'monsieurLaDoulaise', note: 'Ornate flourished calligraphy.' },
  { commercial: 'ITC Edwardian Script', use: 'herrVonMuellerhoff', note: 'Fine spencerian hand.' },
  { commercial: 'Amsterdam Fair', use: 'alexBrush', note: 'Brush calligraphy with a real pen feel.' },
  { commercial: 'Breathing', use: 'mrsSaintDelafield', note: 'Loose expressive hand-calligraphy.' },
  { commercial: 'Candice', use: 'yellowtail', note: 'Retro sign-painter brush.' },
  { commercial: 'Giaza', use: 'abrilFatface', note: 'Heavy Didone with dramatic contrast.' },
  { commercial: 'Coterie', use: 'italiana', note: 'Thin elegant capitals, wide tracked.' },
  { commercial: 'Perandory', use: 'cinzel', note: 'Condensed classical capitals.' },
  { commercial: 'Safira March', use: 'pinyonScript', note: 'Copperplate calligraphy.' },
  { commercial: 'Metanoia', use: 'gildaDisplay', note: 'Refined bookish display serif.' },
  { commercial: 'Loubag', use: 'righteous', note: 'Rounded geometric display.' },
  { commercial: 'Gliker', use: 'fredoka', note: 'Rounded friendly display.' },
  { commercial: 'Bernoru Ultra', use: 'archivoBlack', note: 'Maximum-weight grotesk.' },
  { commercial: 'Black Mango', use: 'prata', note: 'Warm high-contrast Didone.' },
  { commercial: 'Devasia', use: 'rozhaOne', note: 'Ornate decorative Didone.' },
  { commercial: 'Barbra', use: 'yesevaOne', note: 'Curvy high-contrast display.' },
  { commercial: 'Ahsing', use: 'alfaSlabOne', note: 'Massive slab display.' },
  { commercial: 'Hertical Texture', use: 'wallpoet', note: 'Rough stencil display.' },
  { commercial: 'Blanka', use: 'megrim', note: 'Skeletal geometric line display.' },
  { commercial: 'Brown Sugar', use: 'lobster', note: 'Bold retro script-display.' },
  { commercial: 'The Seasons', use: 'bellefair', note: 'Light elegant serif capitals.' },
  { commercial: 'Lovely May', use: 'sacramento', note: 'Thin monoline script.' },
  { commercial: 'Gentup', use: 'ultra', note: 'Ultra-bold slab.' },
  { commercial: 'Extenda', use: 'archivoBlack', note: 'Wide heavy grotesk.' },
  { commercial: 'Agrandir', use: 'outfit', note: 'Contemporary geometric sans.' },
  { commercial: 'Futura', use: 'jost', note: 'Direct geometric equivalent.' },
  { commercial: 'Bauhaus', use: 'josefinSans', note: 'Geometric deco sans.' },
  { commercial: 'Calgary', use: 'cormorant', note: 'Delicate old-style serif.' },
  { commercial: 'True Typewriter', use: 'cutiveMono', note: 'Genuine vintage typewriter.' },
  { commercial: 'AC Pathetic', use: 'amaticSC', note: 'Tall narrow hand-drawn caps.' },
  { commercial: 'Sprite Graffiti', use: 'permanentMarker', note: 'Thick marker scrawl.' },
  { commercial: 'More Sugar', use: 'chewy', note: 'Soft bubbly display.' },
  { commercial: 'Bristol', use: 'lilitaOne', note: 'Soft heavy display.' },
  { commercial: 'Aileron', use: 'workSans', note: 'Neutral screen grotesk.' },
  { commercial: 'Roller Coaster Serif', use: 'vollkorn', note: 'Sturdy friendly serif.' },
  { commercial: 'Britannic', use: 'oswald', note: 'Condensed gothic.' },
];
