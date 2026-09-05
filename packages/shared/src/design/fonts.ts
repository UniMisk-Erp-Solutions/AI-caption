/**
 * Approved font registry.
 *
 * The AI never sees or emits a raw font-family string - only a `fontId` from
 * this table. That single guard is what stops the model inventing
 * "Neue Haas Grotesk Display Pro" and silently falling back to Times New Roman
 * in the export canvas.
 *
 * The roster is chosen for one specific look: editorial social captions where a
 * workhorse face carries the sentence and ONE word is swapped to a flowing
 * script or a high-contrast Didone at a much larger size. So the registry is
 * deliberately lopsided - a handful of very good workhorses, and a deep bench
 * of scripts and display faces to be the hero word.
 *
 * `family` must match the family name @fontsource registers with the browser,
 * because both the preview canvas and the export canvas resolve fonts by that
 * string.
 */

export type FontRole =
  /** Carries whole sentences. Neutral, readable at small sizes. */
  | 'workhorse'
  /** Big, loud, condensed. Sets stacked poster headlines. */
  | 'heavy'
  /** High-contrast serif. The magazine-cover voice. */
  | 'didone'
  /** Flowing connected script. The hero word, never a whole sentence. */
  | 'script'
  /** Elegant serif with a strong italic. Between didone and script. */
  | 'serif';

export interface FontDef {
  id: string;
  family: string;
  fallback: string;
  role: FontRole;
  weights: number[];
  italic: boolean;
  /**
   * Optical size correction. A script at 100px reads far smaller than a
   * grotesk at 100px. The layout engine multiplies requested size by this so
   * one "size" number means the same visual weight across every face.
   */
  opticalScale: number;
  /** Mean glyph advance as a fraction of size - used for fast fit estimates. */
  advance: number;
  /** Default tracking (em) that suits this face at display sizes. */
  defaultTracking: number;
  /** Default line height when this face sets a stacked block. */
  defaultLeading: number;
  /**
   * Scripts and Didones have long ascenders/descenders that let neighbouring
   * lines interlock. This is how far lines may overlap, in em.
   */
  overlapTolerance: number;
  /** True when the face is only legible large - blocks tiny-text mistakes. */
  displayOnly: boolean;
  vibe: string;
}

export const FONT_REGISTRY = {
  /* ---------------- workhorses ---------------- */

  dmSans: {
    id: 'dmSans',
    family: 'DM Sans',
    fallback: 'Helvetica, Arial, sans-serif',
    role: 'workhorse',
    weights: [400, 500, 700],
    italic: true,
    opticalScale: 1,
    advance: 0.52,
    defaultTracking: -0.01,
    defaultLeading: 1.05,
    overlapTolerance: 0,
    displayOnly: false,
    vibe: 'Neutral geometric sans. The default voice for the words around the hero.',
  },
  inter: {
    id: 'inter',
    family: 'Inter',
    fallback: 'system-ui, Helvetica, Arial, sans-serif',
    role: 'workhorse',
    weights: [300, 400, 500, 600, 700, 800, 900],
    italic: false,
    opticalScale: 1,
    advance: 0.52,
    defaultTracking: -0.01,
    defaultLeading: 1.1,
    overlapTolerance: 0,
    displayOnly: false,
    vibe: 'Invisible UI sans. For tiny meta lines, episode labels, timestamps.',
  },
  manrope: {
    id: 'manrope',
    family: 'Manrope',
    fallback: 'Helvetica, Arial, sans-serif',
    role: 'workhorse',
    weights: [300, 400, 500, 600, 700, 800],
    italic: false,
    opticalScale: 1,
    advance: 0.51,
    defaultTracking: -0.015,
    defaultLeading: 1.05,
    overlapTolerance: 0,
    displayOnly: false,
    vibe: 'Modern semi-rounded sans. ExtraBold is a clean confident headline.',
  },
  spaceGrotesk: {
    id: 'spaceGrotesk',
    family: 'Space Grotesk',
    fallback: 'Helvetica, Arial, sans-serif',
    role: 'workhorse',
    weights: [300, 400, 500, 600, 700],
    italic: false,
    opticalScale: 1,
    advance: 0.5,
    defaultTracking: -0.02,
    defaultLeading: 1,
    overlapTolerance: 0,
    displayOnly: false,
    vibe: 'Technical grotesk with odd details. Reads contemporary / design-studio.',
  },
  archivo: {
    id: 'archivo',
    family: 'Archivo',
    fallback: 'Helvetica, Arial, sans-serif',
    role: 'workhorse',
    weights: [400, 500, 600, 700, 800, 900],
    italic: true,
    opticalScale: 0.98,
    advance: 0.5,
    defaultTracking: -0.025,
    defaultLeading: 0.98,
    overlapTolerance: 0,
    displayOnly: false,
    vibe: 'Sturdy grotesk. Black weight uppercase is the loud poster voice.',
  },

  /* ---------------- heavy / condensed ---------------- */

  anton: {
    id: 'anton',
    family: 'Anton',
    fallback: 'Impact, Haettenschweiler, sans-serif',
    role: 'heavy',
    weights: [400],
    italic: false,
    opticalScale: 0.94,
    advance: 0.42,
    defaultTracking: -0.02,
    defaultLeading: 0.82,
    overlapTolerance: 0.06,
    displayOnly: true,
    vibe: 'Ultra-condensed poster black. THE face for tightly stacked lowercase headlines that fill the frame edge to edge.',
  },
  bebasNeue: {
    id: 'bebasNeue',
    family: 'Bebas Neue',
    fallback: 'Impact, sans-serif',
    role: 'heavy',
    weights: [400],
    italic: false,
    opticalScale: 0.98,
    advance: 0.36,
    defaultTracking: 0.01,
    defaultLeading: 0.86,
    overlapTolerance: 0.04,
    displayOnly: true,
    vibe: 'All-caps condensed. Narrow, punchy, stacks beautifully. Uppercase only by design.',
  },
  oswald: {
    id: 'oswald',
    family: 'Oswald',
    fallback: 'Impact, sans-serif',
    role: 'heavy',
    weights: [300, 400, 500, 600, 700],
    italic: false,
    opticalScale: 0.97,
    advance: 0.42,
    defaultTracking: -0.005,
    defaultLeading: 0.92,
    overlapTolerance: 0.03,
    displayOnly: false,
    vibe: 'Condensed gothic with real weights. The versatile middle ground between Anton and a plain sans.',
  },

  /* ---------------- didone / display serif ---------------- */

  bodoni: {
    id: 'bodoni',
    family: 'Bodoni Moda',
    fallback: 'Didot, Georgia, serif',
    role: 'didone',
    weights: [400, 500, 600, 700, 800, 900],
    italic: true,
    opticalScale: 1.04,
    advance: 0.46,
    defaultTracking: -0.005,
    defaultLeading: 0.92,
    overlapTolerance: 0.05,
    displayOnly: false,
    vibe: 'Fashion-magazine Didone. Extreme thick/thin. Reads as Vogue. Best large, often uppercase.',
  },
  dmSerifDisplay: {
    id: 'dmSerifDisplay',
    family: 'DM Serif Display',
    fallback: 'Georgia, serif',
    role: 'didone',
    weights: [400],
    italic: true,
    opticalScale: 1,
    advance: 0.47,
    defaultTracking: -0.015,
    defaultLeading: 0.94,
    overlapTolerance: 0.05,
    displayOnly: false,
    vibe: 'Rich high-contrast serif with a gorgeous italic. The "Old Money" workhorse hero.',
  },
  playfair: {
    id: 'playfair',
    family: 'Playfair Display',
    fallback: 'Georgia, serif',
    role: 'didone',
    weights: [400, 500, 600, 700, 800, 900],
    italic: true,
    opticalScale: 1,
    advance: 0.48,
    defaultTracking: -0.01,
    defaultLeading: 0.98,
    overlapTolerance: 0.04,
    displayOnly: false,
    vibe: 'Classic transitional display serif. Safe, handsome, editorial.',
  },
  italiana: {
    id: 'italiana',
    family: 'Italiana',
    fallback: 'Didot, Georgia, serif',
    role: 'didone',
    weights: [400],
    italic: false,
    opticalScale: 1.08,
    advance: 0.44,
    defaultTracking: 0.08,
    defaultLeading: 1.05,
    overlapTolerance: 0.02,
    displayOnly: true,
    vibe: 'Very thin elegant capitals. Wide-tracked it is pure luxury-brand wordmark.',
  },

  /* ---------------- elegant serif ---------------- */

  instrumentSerif: {
    id: 'instrumentSerif',
    family: 'Instrument Serif',
    fallback: 'Georgia, serif',
    role: 'serif',
    weights: [400],
    italic: true,
    opticalScale: 1.06,
    advance: 0.44,
    defaultTracking: -0.01,
    defaultLeading: 0.95,
    overlapTolerance: 0.06,
    displayOnly: false,
    vibe: 'High-contrast editorial serif, quiet and expensive. Its italic is one of the best free hero-word faces.',
  },
  cormorant: {
    id: 'cormorant',
    family: 'Cormorant Garamond',
    fallback: 'Garamond, Georgia, serif',
    role: 'serif',
    weights: [300, 400, 500, 600, 700],
    italic: true,
    opticalScale: 1.12,
    advance: 0.44,
    defaultTracking: 0,
    defaultLeading: 1,
    overlapTolerance: 0.05,
    displayOnly: false,
    vibe: 'Delicate old-style serif. Light weights large feel romantic and airy.',
  },
  fraunces: {
    id: 'fraunces',
    family: 'Fraunces',
    fallback: 'Georgia, serif',
    role: 'serif',
    weights: [300, 400, 500, 600, 700, 900],
    italic: true,
    opticalScale: 1,
    advance: 0.47,
    defaultTracking: -0.015,
    defaultLeading: 0.98,
    overlapTolerance: 0.04,
    displayOnly: false,
    vibe: 'Wonky warm soft-serif with personality. Playful without losing craft.',
  },
  libreBaskerville: {
    id: 'libreBaskerville',
    family: 'Libre Baskerville',
    fallback: 'Baskerville, Georgia, serif',
    role: 'serif',
    weights: [400, 700],
    italic: true,
    opticalScale: 0.92,
    advance: 0.55,
    defaultTracking: 0,
    defaultLeading: 1.2,
    overlapTolerance: 0,
    displayOnly: false,
    vibe: 'Bookish, wide, very readable. Good for the small supporting line.',
  },

  /* ---------------- scripts (hero words only) ---------------- */

  greatVibes: {
    id: 'greatVibes',
    family: 'Great Vibes',
    fallback: 'Segoe Script, cursive',
    role: 'script',
    weights: [400],
    italic: false,
    opticalScale: 1.42,
    advance: 0.54,
    defaultTracking: 0,
    defaultLeading: 1.15,
    overlapTolerance: 0.16,
    displayOnly: true,
    vibe: 'Formal connected calligraphy with huge swashes. The single most "expensive-looking" hero word face. ONE word, never a phrase.',
  },
  styleScript: {
    id: 'styleScript',
    family: 'Style Script',
    fallback: 'Segoe Script, cursive',
    role: 'script',
    weights: [400],
    italic: false,
    opticalScale: 1.3,
    advance: 0.47,
    defaultTracking: 0,
    defaultLeading: 1.05,
    overlapTolerance: 0.14,
    displayOnly: true,
    vibe: 'Casual brush-ish signature script. Slightly looser than Great Vibes. Reads modern-luxury.',
  },
  parisienne: {
    id: 'parisienne',
    family: 'Parisienne',
    fallback: 'Segoe Script, cursive',
    role: 'script',
    weights: [400],
    italic: false,
    opticalScale: 1.32,
    advance: 0.44,
    defaultTracking: 0,
    defaultLeading: 1.08,
    overlapTolerance: 0.14,
    displayOnly: true,
    vibe: 'Light airy hand-script. Feminine, delicate, Pinterest morning-routine energy.',
  },
  sacramento: {
    id: 'sacramento',
    family: 'Sacramento',
    fallback: 'Segoe Script, cursive',
    role: 'script',
    weights: [400],
    italic: false,
    opticalScale: 1.28,
    advance: 0.42,
    defaultTracking: 0,
    defaultLeading: 1.05,
    overlapTolerance: 0.12,
    displayOnly: true,
    vibe: 'Thin monoline script. Quieter than the others - good when the frame is busy.',
  },
  caveat: {
    id: 'caveat',
    family: 'Caveat',
    fallback: 'Segoe Script, cursive',
    role: 'script',
    weights: [400, 500, 600, 700],
    italic: false,
    opticalScale: 1.22,
    advance: 0.38,
    defaultTracking: 0,
    defaultLeading: 1,
    overlapTolerance: 0.08,
    displayOnly: false,
    vibe: 'Handwritten marker, not calligraphy. For scribbled annotations and asides, usually rotated a few degrees.',
  },
} as const satisfies Record<string, FontDef>;

export type FontId = keyof typeof FONT_REGISTRY;

export const FONT_IDS = Object.keys(FONT_REGISTRY) as FontId[];

export function getFont(id: string): FontDef {
  return (FONT_REGISTRY as Record<string, FontDef>)[id] ?? FONT_REGISTRY.dmSans;
}

export function isFontId(id: string): id is FontId {
  return Object.prototype.hasOwnProperty.call(FONT_REGISTRY, id);
}

export function fontsByRole(role: FontRole): FontDef[] {
  return FONT_IDS.map(getFont).filter((f) => f.role === role);
}

/** Full CSS font-family value including fallbacks. */
export function fontFamilyStack(id: string): string {
  const f = getFont(id);
  return `"${f.family}", ${f.fallback}`;
}

/** Clamp a requested weight to one the bundled face actually ships. */
export function resolveWeight(id: string, weight: number): number {
  const f = getFont(id);
  let best = f.weights[0];
  let bestDelta = Infinity;
  for (const w of f.weights) {
    const d = Math.abs(w - weight);
    if (d < bestDelta) {
      bestDelta = d;
      best = w;
    }
  }
  return best;
}

/**
 * Whether two faces make a good pair.
 *
 * The rule real designers use is *contrast without conflict*: pair across
 * categories (script + heavy, didone + workhorse), never within one (two
 * grotesks fight; two scripts are illegible).
 */
export function isGoodPairing(a: string, b: string): boolean {
  const ra = getFont(a).role;
  const rb = getFont(b).role;
  if (ra === rb) return false;
  const conflicting: Array<[FontRole, FontRole]> = [
    ['script', 'serif'],
    ['didone', 'serif'],
  ];
  return !conflicting.some(([x, y]) => (ra === x && rb === y) || (ra === y && rb === x));
}
