/**
 * Style presets, built around FONT PAIRINGS.
 *
 * The look these presets chase is not "pick a nice font". It is the pairing
 * move you see on every editorial caption and every font-pairing poster:
 *
 *     a holi-day in my  Life  as a  girl  in  New York  city
 *     ^^^^^^^^^^^^^^^^  ~~~~
 *     workhorse, small   script, huge, sitting on the same line
 *
 * So a preset does not describe one typeface - it describes a *cast*:
 *
 *   base    the voice that carries the sentence
 *   hero    the one word per phrase that gets swapped out, much larger
 *   accent  an optional third face for asides and annotations
 *   micro   the tiny all-caps line under everything
 *
 * Contrast comes from category (script against condensed, Didone against
 * grotesk), never from two faces of the same kind fighting each other.
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
   * Vertical nudge in em. Scripts hang below the baseline of the sans they sit
   * beside; a small negative shift makes the pair sit optically level.
   */
  baselineShift: number;
  /** 0 primary, 1 secondary, 2 accent colour. */
  colorIndex: number;
}

export interface PresetDef {
  id: string;
  label: string;
  description: string;
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
  shadow: number;
  /** Optional tiny label rendered under the block, e.g. "*episode 01". */
  microLabel?: string;
}

const WHITE: [string, string, string] = ['#FFFFFF', '#EDE8E0', '#C9BFAE'];

export const PRESET_REGISTRY = {
  /* ------------------------------------------------------------------ */
  SCRIPT_EDITORIAL: {
    id: 'SCRIPT_EDITORIAL',
    label: 'Script editorial',
    description:
      'Quiet sans carries the sentence; one word per phrase becomes huge flowing calligraphy. The "a holi-day in my Life" look - the default, and the closest match to the reference.',
    palette: WHITE,
    baseSize: 0.062,
    leading: 0.94,
    heroesPerScene: 1,
    rotationBudget: 0.12,
    motionLevel: 0.4,
    sceneWordTarget: 6,
    shadow: 0.4,
    microLabel: '',
    voices: {
      base: {
        fontId: 'dmSans',
        weight: 500,
        textTransform: 'lowercase',
        italic: false,
        tracking: -0.01,
        sizeScale: 1,
        baselineShift: 0,
        colorIndex: 0,
      },
      hero: {
        fontId: 'greatVibes',
        weight: 400,
        textTransform: 'title',
        italic: false,
        tracking: 0,
        sizeScale: 2.15,
        baselineShift: 0.12,
        colorIndex: 0,
      },
      accent: {
        fontId: 'instrumentSerif',
        weight: 400,
        textTransform: 'none',
        italic: true,
        tracking: -0.01,
        sizeScale: 1.45,
        baselineShift: 0.02,
        colorIndex: 0,
      },
      micro: {
        fontId: 'inter',
        weight: 400,
        textTransform: 'lowercase',
        italic: false,
        tracking: 0.02,
        sizeScale: 0.34,
        baselineShift: 0,
        colorIndex: 1,
      },
    },
    compositions: ['cascade-left', 'stack-center', 'anchor-top', 'offset-hero', 'split-drift', 'cascade-right'],
    enterAnimations: ['fade-up', 'fade', 'mask-reveal', 'tracking-in', 'scale-in'],
    exitAnimations: ['fade', 'fade-up'],
  },

  /* ------------------------------------------------------------------ */
  STACKED_HEAVY: {
    id: 'STACKED_HEAVY',
    label: 'Stacked heavy',
    description:
      'Ultra-condensed Anton, lowercase, lines jammed together so they almost touch, filling the frame edge to edge. The "how to keep your 9-5 fun." look.',
    palette: ['#FFFFFF', '#E3E3E3', '#FF5A36'],
    baseSize: 0.115,
    leading: 0.8,
    heroesPerScene: 0,
    rotationBudget: 0,
    motionLevel: 0.6,
    sceneWordTarget: 6,
    shadow: 0.35,
    microLabel: '',
    voices: {
      base: {
        fontId: 'anton',
        weight: 400,
        textTransform: 'lowercase',
        italic: false,
        tracking: -0.025,
        sizeScale: 1,
        baselineShift: 0,
        colorIndex: 0,
      },
      hero: {
        fontId: 'anton',
        weight: 400,
        textTransform: 'lowercase',
        italic: false,
        tracking: -0.025,
        sizeScale: 1.18,
        baselineShift: 0,
        colorIndex: 0,
      },
      accent: {
        fontId: 'styleScript',
        weight: 400,
        textTransform: 'title',
        italic: false,
        tracking: 0,
        sizeScale: 1.5,
        baselineShift: 0.1,
        colorIndex: 2,
      },
      micro: {
        fontId: 'dmSans',
        weight: 500,
        textTransform: 'lowercase',
        italic: false,
        tracking: 0.01,
        sizeScale: 0.22,
        baselineShift: 0,
        colorIndex: 1,
      },
    },
    compositions: ['anchor-top', 'anchor-bottom', 'cascade-left', 'offset-hero'],
    enterAnimations: ['wipe-up', 'fade-up', 'pop', 'mask-reveal', 'word-pop'],
    exitAnimations: ['none', 'fade'],
  },

  /* ------------------------------------------------------------------ */
  OLD_MONEY: {
    id: 'OLD_MONEY',
    label: 'Old money',
    description:
      'Rich high-contrast serif with a signature script hero. Cream and ink. The quiet-luxury pairing poster look.',
    palette: ['#F7F3EC', '#DED5C6', '#B08D57'],
    baseSize: 0.07,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.1,
    motionLevel: 0.3,
    sceneWordTarget: 5,
    shadow: 0.45,
    microLabel: '',
    voices: {
      base: {
        fontId: 'dmSerifDisplay',
        weight: 400,
        textTransform: 'title',
        italic: false,
        tracking: -0.015,
        sizeScale: 1,
        baselineShift: 0,
        colorIndex: 0,
      },
      hero: {
        fontId: 'styleScript',
        weight: 400,
        textTransform: 'title',
        italic: false,
        tracking: 0,
        sizeScale: 2,
        baselineShift: 0.1,
        colorIndex: 0,
      },
      accent: {
        fontId: 'italiana',
        weight: 400,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.22,
        sizeScale: 0.7,
        baselineShift: 0,
        colorIndex: 2,
      },
      micro: {
        fontId: 'inter',
        weight: 400,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.3,
        sizeScale: 0.24,
        baselineShift: 0,
        colorIndex: 2,
      },
    },
    compositions: ['stack-center', 'cascade-left', 'quote-block', 'offset-hero'],
    enterAnimations: ['fade', 'tracking-in', 'mask-reveal', 'blur-in'],
    exitAnimations: ['fade'],
  },

  /* ------------------------------------------------------------------ */
  VOGUE: {
    id: 'VOGUE',
    label: 'Vogue',
    description:
      'Bodoni Didone set large and uppercase, with its own italic as the hero. Extreme thick/thin, tight tracking, hard cuts.',
    palette: ['#FFFFFF', '#E8E8E8', '#D9382B'],
    baseSize: 0.082,
    leading: 0.86,
    heroesPerScene: 1,
    rotationBudget: 0.08,
    motionLevel: 0.5,
    sceneWordTarget: 5,
    shadow: 0.3,
    microLabel: '',
    voices: {
      base: {
        fontId: 'bodoni',
        weight: 600,
        textTransform: 'uppercase',
        italic: false,
        tracking: -0.005,
        sizeScale: 1,
        baselineShift: 0,
        colorIndex: 0,
      },
      hero: {
        fontId: 'bodoni',
        weight: 500,
        textTransform: 'title',
        italic: true,
        tracking: -0.005,
        sizeScale: 1.55,
        baselineShift: 0.03,
        colorIndex: 0,
      },
      accent: {
        fontId: 'archivo',
        weight: 700,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.2,
        sizeScale: 0.42,
        baselineShift: -0.1,
        colorIndex: 2,
      },
      micro: {
        fontId: 'archivo',
        weight: 600,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.26,
        sizeScale: 0.22,
        baselineShift: 0,
        colorIndex: 1,
      },
    },
    compositions: ['stack-center', 'offset-hero', 'anchor-top', 'edge-vertical', 'split-drift'],
    enterAnimations: ['wipe-up', 'mask-reveal', 'tracking-in', 'scale-in', 'flash'],
    exitAnimations: ['none', 'fade', 'wipe-up'],
  },

  /* ------------------------------------------------------------------ */
  SOFT_SCRIPT: {
    id: 'SOFT_SCRIPT',
    label: 'Soft script',
    description:
      'Airy light Cormorant with a delicate Parisienne hero. Romantic, slow, wide tracking. Pinterest morning-routine energy.',
    palette: ['#FFFFFF', '#F6EFE7', '#E3B7A8'],
    baseSize: 0.064,
    leading: 1,
    heroesPerScene: 1,
    rotationBudget: 0.2,
    motionLevel: 0.28,
    sceneWordTarget: 6,
    shadow: 0.3,
    microLabel: '',
    voices: {
      base: {
        fontId: 'cormorant',
        weight: 300,
        textTransform: 'lowercase',
        italic: false,
        tracking: 0.02,
        sizeScale: 1,
        baselineShift: 0,
        colorIndex: 0,
      },
      hero: {
        fontId: 'parisienne',
        weight: 400,
        textTransform: 'title',
        italic: false,
        tracking: 0,
        sizeScale: 2,
        baselineShift: 0.1,
        colorIndex: 0,
      },
      accent: {
        fontId: 'cormorant',
        weight: 400,
        textTransform: 'none',
        italic: true,
        tracking: 0.01,
        sizeScale: 1.3,
        baselineShift: 0,
        colorIndex: 2,
      },
      micro: {
        fontId: 'inter',
        weight: 300,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.34,
        sizeScale: 0.22,
        baselineShift: 0,
        colorIndex: 1,
      },
    },
    compositions: ['stack-center', 'cascade-left', 'quote-block', 'anchor-bottom', 'corner-note'],
    enterAnimations: ['fade', 'tracking-in', 'blur-in', 'fade-up'],
    exitAnimations: ['fade', 'blur-in'],
  },

  /* ------------------------------------------------------------------ */
  POSTER_BOLD: {
    id: 'POSTER_BOLD',
    label: 'Poster bold',
    description:
      'Archivo Black uppercase against condensed Bebas. One weight relationship, no decoration, Swiss discipline. The safest loud option.',
    palette: ['#FFFFFF', '#B5B5B5', '#E4FF3D'],
    baseSize: 0.078,
    leading: 0.9,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.65,
    sceneWordTarget: 5,
    shadow: 0.32,
    microLabel: '',
    voices: {
      base: {
        fontId: 'bebasNeue',
        weight: 400,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.02,
        sizeScale: 1,
        baselineShift: 0,
        colorIndex: 0,
      },
      hero: {
        fontId: 'archivo',
        weight: 900,
        textTransform: 'uppercase',
        italic: false,
        tracking: -0.035,
        sizeScale: 1.32,
        baselineShift: 0,
        colorIndex: 0,
      },
      accent: {
        fontId: 'archivo',
        weight: 900,
        textTransform: 'uppercase',
        italic: false,
        tracking: -0.035,
        sizeScale: 1.32,
        baselineShift: 0,
        colorIndex: 2,
      },
      micro: {
        fontId: 'archivo',
        weight: 600,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.16,
        sizeScale: 0.2,
        baselineShift: 0,
        colorIndex: 1,
      },
    },
    compositions: ['anchor-top', 'anchor-bottom', 'cascade-left', 'stack-center', 'offset-hero'],
    enterAnimations: ['wipe-left', 'pop', 'slide-right', 'word-pop', 'wipe-up'],
    exitAnimations: ['none', 'wipe-left', 'fade'],
  },

  /* ------------------------------------------------------------------ */
  SCRAPBOOK: {
    id: 'SCRAPBOOK',
    label: 'Scrapbook',
    description:
      'Wonky Fraunces with scribbled Caveat annotations, slight rotation, warm accent. Diary / vlog energy.',
    palette: ['#FFFFFF', '#FFF3DC', '#FF7A59'],
    baseSize: 0.068,
    leading: 0.98,
    heroesPerScene: 1,
    rotationBudget: 1,
    motionLevel: 0.72,
    sceneWordTarget: 6,
    shadow: 0.42,
    microLabel: '',
    voices: {
      base: {
        fontId: 'fraunces',
        weight: 500,
        textTransform: 'lowercase',
        italic: false,
        tracking: -0.015,
        sizeScale: 1,
        baselineShift: 0,
        colorIndex: 0,
      },
      hero: {
        fontId: 'fraunces',
        weight: 900,
        textTransform: 'lowercase',
        italic: false,
        tracking: -0.03,
        sizeScale: 1.5,
        baselineShift: 0,
        colorIndex: 0,
      },
      accent: {
        fontId: 'caveat',
        weight: 700,
        textTransform: 'none',
        italic: false,
        tracking: 0,
        sizeScale: 1.15,
        baselineShift: 0.02,
        colorIndex: 2,
      },
      micro: {
        fontId: 'caveat',
        weight: 600,
        textTransform: 'none',
        italic: false,
        tracking: 0,
        sizeScale: 0.36,
        baselineShift: 0,
        colorIndex: 2,
      },
    },
    compositions: ['corner-note', 'diagonal-descend', 'cascade-left', 'split-drift', 'anchor-bottom'],
    enterAnimations: ['pop', 'rotate-in', 'word-pop', 'fade-up', 'slide-right'],
    exitAnimations: ['fade', 'pop'],
  },

  /* ------------------------------------------------------------------ */
  Y2K_ACID: {
    id: 'Y2K_ACID',
    label: 'Y2K acid',
    description:
      'Tight Space Grotesk against Anton, acid accent colour, fast punchy motion, occasional vertical run. Club-flyer energy.',
    palette: ['#FFFFFF', '#C4C4C4', '#39FF6A'],
    baseSize: 0.075,
    leading: 0.88,
    heroesPerScene: 1,
    rotationBudget: 0.45,
    motionLevel: 0.92,
    sceneWordTarget: 5,
    shadow: 0.26,
    microLabel: '',
    voices: {
      base: {
        fontId: 'spaceGrotesk',
        weight: 500,
        textTransform: 'lowercase',
        italic: false,
        tracking: -0.02,
        sizeScale: 1,
        baselineShift: 0,
        colorIndex: 0,
      },
      hero: {
        fontId: 'anton',
        weight: 400,
        textTransform: 'uppercase',
        italic: false,
        tracking: -0.02,
        sizeScale: 1.45,
        baselineShift: 0,
        colorIndex: 2,
      },
      accent: {
        fontId: 'spaceGrotesk',
        weight: 700,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.14,
        sizeScale: 0.5,
        baselineShift: -0.08,
        colorIndex: 2,
      },
      micro: {
        fontId: 'spaceGrotesk',
        weight: 500,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.2,
        sizeScale: 0.2,
        baselineShift: 0,
        colorIndex: 1,
      },
    },
    compositions: ['diagonal-descend', 'edge-vertical', 'offset-hero', 'split-drift', 'anchor-top'],
    enterAnimations: ['flash', 'pop', 'word-pop', 'slide-left', 'wipe-left'],
    exitAnimations: ['none', 'flash', 'fade'],
  },

  /* ------------------------------------------------------------------ */
  CINEMATIC: {
    id: 'CINEMATIC',
    label: 'Cinematic',
    description:
      'Restrained wide Manrope with thin Italiana capitals as the hero. Sits low like a film title card and lets the footage lead.',
    palette: ['#FFFFFF', '#DAD5CC', '#9AA6B2'],
    baseSize: 0.05,
    leading: 1.2,
    heroesPerScene: 1,
    rotationBudget: 0,
    motionLevel: 0.18,
    sceneWordTarget: 8,
    shadow: 0.5,
    microLabel: '',
    voices: {
      base: {
        fontId: 'manrope',
        weight: 400,
        textTransform: 'none',
        italic: false,
        tracking: 0.01,
        sizeScale: 1,
        baselineShift: 0,
        colorIndex: 0,
      },
      hero: {
        fontId: 'italiana',
        weight: 400,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.16,
        sizeScale: 1.5,
        baselineShift: 0,
        colorIndex: 0,
      },
      accent: {
        fontId: 'manrope',
        weight: 700,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.24,
        sizeScale: 0.55,
        baselineShift: 0,
        colorIndex: 2,
      },
      micro: {
        fontId: 'inter',
        weight: 400,
        textTransform: 'uppercase',
        italic: false,
        tracking: 0.34,
        sizeScale: 0.24,
        baselineShift: 0,
        colorIndex: 2,
      },
    },
    compositions: ['anchor-bottom', 'quote-block', 'stack-center'],
    enterAnimations: ['fade', 'fade-up', 'blur-in'],
    exitAnimations: ['fade'],
  },
} as const satisfies Record<string, PresetDef>;

export type PresetId = keyof typeof PRESET_REGISTRY;

export const PRESET_IDS = Object.keys(PRESET_REGISTRY) as PresetId[];

export function getPreset(id: string): PresetDef {
  return (PRESET_REGISTRY as Record<string, PresetDef>)[id] ?? PRESET_REGISTRY.SCRIPT_EDITORIAL;
}

export function isPresetId(id: string): id is PresetId {
  return Object.prototype.hasOwnProperty.call(PRESET_REGISTRY, id);
}
