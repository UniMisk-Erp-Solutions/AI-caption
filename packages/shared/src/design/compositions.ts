/**
 * Composition templates.
 *
 * This is the single most important file for output quality.
 *
 * Asking an LLM for free-floating x/y coordinates produces text that is
 * *technically* scattered but reads as random. Real editorial layouts are not
 * random: they are a small number of well-worn arrangements - a left cascade, a
 * centred stack with one oversized word, a corner anchor with a rotated
 * annotation.
 *
 * Note that slot `scale` values sit close to 1. Size drama comes from the hero
 * *run* inside a line, not from the line itself - a supporting line set at 40%
 * of the hero reads as a caption underneath a title, which is exactly the
 * subtitle look this is trying to avoid.
 *
 * So we hand the model a menu of arrangements instead of a blank canvas. It
 * picks a `compositionId` and assigns each text line a *role*; the geometry
 * comes from here. The result looks designed even when the model is having an
 * off day, and the deterministic fallback designer can use the exact same
 * templates when the AI is unavailable.
 */

export type LineRole = 'lead' | 'hero' | 'tail' | 'accent';

export interface CompositionSlot {
  role: LineRole;
  /** Normalised anchor within the block, 0..1 across the frame. */
  x: number;
  /** Vertical offset from the block origin, in multiples of the hero size. */
  dy: number;
  align: 'left' | 'center' | 'right';
  /** Size multiplier relative to the preset's base size. */
  scale: number;
  /** Static rotation in degrees, scaled down by the preset's rotation budget. */
  rotate: number;
}

export interface CompositionDef {
  id: string;
  label: string;
  /** Vertical centre of the whole block, 0..1. */
  anchorY: number;
  /** How many text lines this arrangement is designed for. */
  slots: CompositionSlot[];
  /** Portrait (9:16) only, or fine in landscape too. */
  orientation: 'any' | 'portrait';
  vibe: string;
}

/**
 * Slots are authored for a 3-line block. `takeSlots()` picks a sensible subset
 * when a scene has fewer lines, always keeping the hero.
 */
export const COMPOSITION_REGISTRY = {
  'cascade-left': {
    id: 'cascade-left',
    label: 'Left cascade',
    anchorY: 0.5,
    orientation: 'any',
    vibe: 'Lines step rightwards down the frame. Editorial, calm, very safe.',
    slots: [
      { role: 'lead', x: 0.12, dy: -1.15, align: 'left', scale: 0.8, rotate: 0 },
      { role: 'hero', x: 0.2, dy: 0, align: 'left', scale: 1.0, rotate: 0 },
      { role: 'tail', x: 0.31, dy: 1.05, align: 'left', scale: 0.86, rotate: 0 },
    ],
  },

  'cascade-right': {
    id: 'cascade-right',
    label: 'Right cascade',
    anchorY: 0.52,
    orientation: 'any',
    vibe: 'Mirror of the left cascade. Use when the subject sits on the left.',
    slots: [
      { role: 'lead', x: 0.88, dy: -1.15, align: 'right', scale: 0.8, rotate: 0 },
      { role: 'hero', x: 0.8, dy: 0, align: 'right', scale: 1.0, rotate: 0 },
      { role: 'tail', x: 0.69, dy: 1.05, align: 'right', scale: 0.86, rotate: 0 },
    ],
  },

  'stack-center': {
    id: 'stack-center',
    label: 'Centred stack',
    anchorY: 0.5,
    orientation: 'any',
    vibe: 'Symmetrical poster stack with one oversized hero line. Confident.',
    slots: [
      { role: 'lead', x: 0.5, dy: -1.2, align: 'center', scale: 0.78, rotate: 0 },
      { role: 'hero', x: 0.5, dy: 0, align: 'center', scale: 1.0, rotate: 0 },
      { role: 'tail', x: 0.5, dy: 1.0, align: 'center', scale: 0.84, rotate: 0 },
    ],
  },

  'split-drift': {
    id: 'split-drift',
    label: 'Split drift',
    anchorY: 0.47,
    orientation: 'any',
    vibe: 'Lead pinned left, hero centred, tail pushed right. Asymmetric, magaziney.',
    slots: [
      { role: 'lead', x: 0.14, dy: -1.25, align: 'left', scale: 0.76, rotate: 0 },
      { role: 'hero', x: 0.5, dy: 0, align: 'center', scale: 1.0, rotate: 0 },
      { role: 'tail', x: 0.86, dy: 1.15, align: 'right', scale: 0.84, rotate: 0 },
    ],
  },

  'anchor-top': {
    id: 'anchor-top',
    label: 'Top anchor',
    anchorY: 0.22,
    orientation: 'portrait',
    vibe: 'Block sits high, leaving the lower two thirds to the subject.',
    slots: [
      { role: 'lead', x: 0.11, dy: -0.95, align: 'left', scale: 0.8, rotate: 0 },
      { role: 'hero', x: 0.11, dy: 0, align: 'left', scale: 1.0, rotate: 0 },
      { role: 'tail', x: 0.11, dy: 0.98, align: 'left', scale: 0.86, rotate: 0 },
    ],
  },

  'anchor-bottom': {
    id: 'anchor-bottom',
    label: 'Bottom anchor',
    anchorY: 0.76,
    orientation: 'portrait',
    vibe: 'Block sits low. Use when the face occupies the upper frame.',
    slots: [
      { role: 'lead', x: 0.1, dy: -1.0, align: 'left', scale: 0.8, rotate: 0 },
      { role: 'hero', x: 0.1, dy: 0, align: 'left', scale: 1.0, rotate: 0 },
      { role: 'tail', x: 0.18, dy: 0.95, align: 'left', scale: 0.86, rotate: 0 },
    ],
  },

  'offset-hero': {
    id: 'offset-hero',
    label: 'Offset hero',
    anchorY: 0.55,
    orientation: 'any',
    vibe: 'Small lead tucked above-left of a large hero that breaks the margin.',
    slots: [
      { role: 'lead', x: 0.16, dy: -0.85, align: 'left', scale: 0.7, rotate: 0 },
      { role: 'hero', x: 0.09, dy: 0.15, align: 'left', scale: 1.1, rotate: 0 },
      { role: 'tail', x: 0.62, dy: 1.15, align: 'left', scale: 0.8, rotate: 0 },
    ],
  },

  'diagonal-descend': {
    id: 'diagonal-descend',
    label: 'Diagonal descend',
    anchorY: 0.48,
    orientation: 'any',
    vibe: 'Each line drops further right and rotates slightly. Kinetic, playful.',
    slots: [
      { role: 'lead', x: 0.1, dy: -1.3, align: 'left', scale: 0.82, rotate: -2 },
      { role: 'hero', x: 0.28, dy: 0, align: 'left', scale: 1.0, rotate: -1 },
      { role: 'tail', x: 0.52, dy: 1.2, align: 'left', scale: 0.88, rotate: 2 },
    ],
  },

  'edge-vertical': {
    id: 'edge-vertical',
    label: 'Vertical edge',
    anchorY: 0.5,
    orientation: 'portrait',
    vibe: 'Hero runs vertically up the left edge with a small horizontal tail. Use sparingly - at most once per video.',
    slots: [
      { role: 'hero', x: 0.13, dy: 0, align: 'center', scale: 0.9, rotate: -90 },
      { role: 'tail', x: 0.62, dy: 0.9, align: 'left', scale: 0.72, rotate: 0 },
    ],
  },

  'quote-block': {
    id: 'quote-block',
    label: 'Quote block',
    anchorY: 0.5,
    orientation: 'any',
    vibe: 'Tight centred paragraph, all lines near-equal weight. For long phrases.',
    slots: [
      { role: 'lead', x: 0.5, dy: -0.9, align: 'center', scale: 0.9, rotate: 0 },
      { role: 'hero', x: 0.5, dy: 0, align: 'center', scale: 1.0, rotate: 0 },
      { role: 'tail', x: 0.5, dy: 0.85, align: 'center', scale: 0.9, rotate: 0 },
    ],
  },

  'corner-note': {
    id: 'corner-note',
    label: 'Corner note',
    anchorY: 0.62,
    orientation: 'any',
    vibe: 'Hero low-left with a rotated handwritten accent floating beside it.',
    slots: [
      { role: 'hero', x: 0.1, dy: 0, align: 'left', scale: 1.0, rotate: 0 },
      { role: 'accent', x: 0.66, dy: -0.75, align: 'left', scale: 0.8, rotate: -8 },
      { role: 'tail', x: 0.1, dy: 1.0, align: 'left', scale: 0.78, rotate: 0 },
    ],
  },
} as const satisfies Record<string, CompositionDef>;

export type CompositionId = keyof typeof COMPOSITION_REGISTRY;

export const COMPOSITION_IDS = Object.keys(COMPOSITION_REGISTRY) as CompositionId[];

export function getComposition(id: string): CompositionDef {
  return (COMPOSITION_REGISTRY as Record<string, CompositionDef>)[id] ?? COMPOSITION_REGISTRY['cascade-left'];
}

export function isCompositionId(id: string): id is CompositionId {
  return Object.prototype.hasOwnProperty.call(COMPOSITION_REGISTRY, id);
}

/**
 * Pick `n` slots from a composition, always keeping the hero and preferring the
 * arrangement's own ordering. Vertical gaps are re-centred so a two-line scene
 * does not sit lopsided.
 */
export function takeSlots(comp: CompositionDef, n: number): CompositionSlot[] {
  const wanted = Math.max(1, Math.min(n, comp.slots.length));
  const hero = comp.slots.find((sl) => sl.role === 'hero') ?? comp.slots[0];
  const rest = comp.slots.filter((sl) => sl !== hero);

  // Prefer the ordinary supporting slots over the decorative accent one: an
  // accent slot is a floating annotation, and a scene with only two lines
  // should read as a stack, not as a headline plus a sticker.
  const ordered = [...rest].sort((a, b) => Number(a.role === 'accent') - Number(b.role === 'accent'));

  const chosen: CompositionSlot[] = [hero];
  for (const sl of ordered) {
    if (chosen.length >= wanted) break;
    chosen.push(sl);
  }
  // Restore original visual order (top to bottom).
  chosen.sort((a, b) => a.dy - b.dy);

  // Re-centre vertically so the block stays balanced around anchorY.
  const mid = (chosen[0].dy + chosen[chosen.length - 1].dy) / 2;
  return chosen.map((sl) => ({ ...sl, dy: sl.dy - mid }));
}
