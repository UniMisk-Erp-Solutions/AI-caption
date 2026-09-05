/**
 * Deterministic animation registry.
 *
 * Every animation is a pure function of normalised progress `p` in [0,1].
 * There are no CSS transitions, no requestAnimationFrame-accumulated state and
 * no randomness at render time. That is what makes the exported MP4 an exact
 * frame-for-frame match of the preview: both call `evaluateAnimation()` with
 * the same `p` and get the same numbers back.
 *
 * The AI can only ever emit an animation *id* from this table.
 */

export interface AnimState {
  /** Offset in fractions of the layer's own font size (em-like). */
  dx: number;
  dy: number;
  scale: number;
  opacity: number;
  /** Additional rotation in degrees, added to the layer's static rotation. */
  rotate: number;
  /** Gaussian blur radius in fractions of font size. */
  blur: number;
  /** Extra letter-spacing in em, added to the layer's static tracking. */
  tracking: number;
  /**
   * Horizontal reveal fraction 0..1 (1 = fully revealed). Implemented as a
   * clip rect by the renderer, not as opacity.
   */
  clipX: number;
  /** Vertical reveal fraction 0..1. */
  clipY: number;
}

export const IDENTITY: AnimState = {
  dx: 0,
  dy: 0,
  scale: 1,
  opacity: 1,
  rotate: 0,
  blur: 0,
  tracking: 0,
  clipX: 1,
  clipY: 1,
};

/* ------------------------------------------------------------------ */
/* Easing                                                              */
/* ------------------------------------------------------------------ */

export const easing = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  inCubic: (t: number) => t * t * t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  /** Overshoots past 1 then settles - the "pop". */
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export type AnimDirection = 'enter' | 'exit';

export interface AnimationDef {
  id: string;
  label: string;
  /** Sensible default duration in ms when the AI does not specify one. */
  defaultMs: number;
  /**
   * True when the animation reads better applied per-word with a stagger
   * rather than to the whole text block at once.
   */
  perWord: boolean;
  /** Suggested stagger between words, as a fraction of the enter duration. */
  stagger: number;
  /**
   * @param p 0..1 progress. For `enter`, 0 = not yet arrived, 1 = settled.
   *          For `exit`, 0 = settled, 1 = fully gone.
   */
  at(p: number, dir: AnimDirection): AnimState;
  vibe: string;
}

/** Build an AnimState by overriding only the fields that differ from identity. */
function s(partial: Partial<AnimState>): AnimState {
  return { ...IDENTITY, ...partial };
}

/**
 * Exits are authored as reversed enters. `q` is "how settled am I" - 1 at rest,
 * 0 at the extreme - for both directions, so one `at()` body serves both.
 */
function settle(p: number, dir: AnimDirection): number {
  return dir === 'enter' ? p : 1 - p;
}

export const ANIMATION_REGISTRY = {
  none: {
    id: 'none',
    label: 'None',
    defaultMs: 0,
    perWord: false,
    stagger: 0,
    vibe: 'Hard cut on. Use when the frame is already busy.',
    at: () => IDENTITY,
  },

  fade: {
    id: 'fade',
    label: 'Fade',
    defaultMs: 420,
    perWord: false,
    stagger: 0,
    vibe: 'The quiet default. Never wrong.',
    at: (p, dir) => s({ opacity: easing.outQuad(settle(p, dir)) }),
  },

  'fade-up': {
    id: 'fade-up',
    label: 'Fade up',
    defaultMs: 560,
    perWord: false,
    stagger: 0,
    vibe: 'Rises into place. The workhorse for editorial layouts.',
    at: (p, dir) => {
      const q = easing.outCubic(settle(p, dir));
      return s({ opacity: q, dy: lerp(0.55, 0, q) });
    },
  },

  'fade-down': {
    id: 'fade-down',
    label: 'Fade down',
    defaultMs: 560,
    perWord: false,
    stagger: 0,
    vibe: 'Drops in from above. Pairs with fade-up on the line below it.',
    at: (p, dir) => {
      const q = easing.outCubic(settle(p, dir));
      return s({ opacity: q, dy: lerp(-0.55, 0, q) });
    },
  },

  'slide-left': {
    id: 'slide-left',
    label: 'Slide from right',
    defaultMs: 620,
    perWord: false,
    stagger: 0,
    vibe: 'Travels in from the right edge. Good for right-aligned lines.',
    at: (p, dir) => {
      const q = easing.outQuart(settle(p, dir));
      return s({ opacity: Math.min(1, q * 1.6), dx: lerp(1.4, 0, q) });
    },
  },

  'slide-right': {
    id: 'slide-right',
    label: 'Slide from left',
    defaultMs: 620,
    perWord: false,
    stagger: 0,
    vibe: 'Travels in from the left edge. Good for left-aligned lines.',
    at: (p, dir) => {
      const q = easing.outQuart(settle(p, dir));
      return s({ opacity: Math.min(1, q * 1.6), dx: lerp(-1.4, 0, q) });
    },
  },

  pop: {
    id: 'pop',
    label: 'Pop',
    defaultMs: 480,
    perWord: false,
    stagger: 0,
    vibe: 'Overshoots then settles. Energetic - use on the hero, not on everything.',
    at: (p, dir) => {
      const q = settle(p, dir);
      const e = easing.outBack(q);
      return s({ opacity: easing.outQuad(Math.min(1, q * 1.8)), scale: lerp(0.72, 1, e) });
    },
  },

  'scale-in': {
    id: 'scale-in',
    label: 'Scale in',
    defaultMs: 640,
    perWord: false,
    stagger: 0,
    vibe: 'Slow confident swell. Cinematic.',
    at: (p, dir) => {
      const q = easing.outQuint(settle(p, dir));
      return s({ opacity: q, scale: lerp(1.14, 1, q) });
    },
  },

  'blur-in': {
    id: 'blur-in',
    label: 'Blur in',
    defaultMs: 620,
    perWord: false,
    stagger: 0,
    vibe: 'Focus pull. Expensive-looking. Slightly costly to render.',
    at: (p, dir) => {
      const q = easing.outCubic(settle(p, dir));
      return s({ opacity: q, blur: lerp(0.22, 0, q), scale: lerp(1.06, 1, q) });
    },
  },

  'tracking-in': {
    id: 'tracking-in',
    label: 'Tracking in',
    defaultMs: 760,
    perWord: false,
    stagger: 0,
    vibe: 'Letters draw together from wide. Beautiful on uppercase serif titles.',
    at: (p, dir) => {
      const q = easing.outQuint(settle(p, dir));
      return s({ opacity: easing.outQuad(q), tracking: lerp(0.34, 0, q) });
    },
  },

  'wipe-left': {
    id: 'wipe-left',
    label: 'Wipe across',
    defaultMs: 560,
    perWord: false,
    stagger: 0,
    vibe: 'Reveals left-to-right behind a hard edge. Graphic, poster-like.',
    at: (p, dir) => s({ clipX: easing.inOutCubic(settle(p, dir)) }),
  },

  'wipe-up': {
    id: 'wipe-up',
    label: 'Wipe up',
    defaultMs: 560,
    perWord: false,
    stagger: 0,
    vibe: 'Reveals bottom-to-top. Reads as type rising out of the frame.',
    at: (p, dir) => s({ clipY: easing.inOutCubic(settle(p, dir)) }),
  },

  'mask-reveal': {
    id: 'mask-reveal',
    label: 'Mask reveal',
    defaultMs: 700,
    perWord: false,
    stagger: 0,
    vibe: 'Wipe up plus a slight rise. The premium title-card move.',
    at: (p, dir) => {
      const q = settle(p, dir);
      return s({
        clipY: easing.inOutCubic(q),
        dy: lerp(0.28, 0, easing.outCubic(q)),
      });
    },
  },

  'word-pop': {
    id: 'word-pop',
    label: 'Word pop',
    defaultMs: 620,
    perWord: true,
    stagger: 0.42,
    vibe: 'Each word pops in sequence. The classic captions rhythm.',
    at: (p, dir) => {
      const q = settle(p, dir);
      return s({
        opacity: easing.outQuad(Math.min(1, q * 2)),
        scale: lerp(0.6, 1, easing.outBack(q)),
      });
    },
  },

  typewriter: {
    id: 'typewriter',
    label: 'Typewriter',
    defaultMs: 900,
    perWord: true,
    stagger: 0.9,
    vibe: 'Words appear one at a time, no motion. Documentary / diary feel.',
    at: (p, dir) => s({ opacity: settle(p, dir) >= 0.5 ? 1 : 0 }),
  },

  'rotate-in': {
    id: 'rotate-in',
    label: 'Rotate in',
    defaultMs: 640,
    perWord: false,
    stagger: 0,
    vibe: 'Swings in off-axis. Use once per video at most.',
    at: (p, dir) => {
      const q = settle(p, dir);
      const e = easing.outBack(q);
      return s({ opacity: easing.outQuad(q), rotate: lerp(-7, 0, e), scale: lerp(0.9, 1, e) });
    },
  },

  flash: {
    id: 'flash',
    label: 'Flash',
    defaultMs: 260,
    perWord: false,
    stagger: 0,
    vibe: 'Snappy strobe-on. For beat-synced lyric hits.',
    at: (p, dir) => {
      const q = settle(p, dir);
      return s({ opacity: q > 0.18 ? 1 : q / 0.18, scale: lerp(1.05, 1, easing.outExpo(q)) });
    },
  },
} as const satisfies Record<string, AnimationDef>;

export type AnimationId = keyof typeof ANIMATION_REGISTRY;

export const ANIMATION_IDS = Object.keys(ANIMATION_REGISTRY) as AnimationId[];

export function getAnimation(id: string): AnimationDef {
  return (ANIMATION_REGISTRY as Record<string, AnimationDef>)[id] ?? ANIMATION_REGISTRY.fade;
}

export function isAnimationId(id: string): id is AnimationId {
  return Object.prototype.hasOwnProperty.call(ANIMATION_REGISTRY, id);
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

export interface AnimQuery {
  nowMs: number;
  startMs: number;
  endMs: number;
  enterId: string;
  exitId: string;
  enterMs: number;
  exitMs: number;
  /** Index of this word within the layer, for per-word stagger. */
  wordIndex?: number;
  wordCount?: number;
}

/**
 * Resolve the animation state for one layer (or one word of it) at an absolute
 * timestamp. Pure - same inputs always give the same output, which is what
 * keeps the export byte-identical to the preview.
 */
export function evaluateAnimation(q: AnimQuery): AnimState {
  const { nowMs, startMs, endMs } = q;
  if (nowMs < startMs || nowMs > endMs) return { ...IDENTITY, opacity: 0 };

  const enter = getAnimation(q.enterId);
  const exit = getAnimation(q.exitId);
  const wordCount = Math.max(1, q.wordCount ?? 1);
  const wordIndex = Math.min(Math.max(0, q.wordIndex ?? 0), wordCount - 1);

  const life = Math.max(1, endMs - startMs);
  // Never let the enter and exit envelopes overlap: clamp both to the life of
  // the layer so very short layers still fully appear before they leave.
  const enterMs = Math.max(0, Math.min(q.enterMs, life * 0.6));
  const exitMs = Math.max(0, Math.min(q.exitMs, life * 0.4));

  let enterP = 1;
  if (enterMs > 0) {
    const delay = enter.perWord ? enterMs * enter.stagger * wordIndex : 0;
    const t = nowMs - startMs - delay;
    enterP = t <= 0 ? 0 : t >= enterMs ? 1 : t / enterMs;
  }

  let exitP = 0;
  if (exitMs > 0) {
    const delay = exit.perWord ? exitMs * exit.stagger * wordIndex : 0;
    const t = nowMs - (endMs - exitMs) - delay;
    exitP = t <= 0 ? 0 : t >= exitMs ? 1 : t / exitMs;
  }

  const a = enter.at(enterP, 'enter');
  if (exitP <= 0) return a;
  const b = exit.at(exitP, 'exit');

  return {
    dx: a.dx + b.dx,
    dy: a.dy + b.dy,
    scale: a.scale * b.scale,
    opacity: a.opacity * b.opacity,
    rotate: a.rotate + b.rotate,
    blur: Math.max(a.blur, b.blur),
    tracking: a.tracking + b.tracking,
    clipX: Math.min(a.clipX, b.clipX),
    clipY: Math.min(a.clipY, b.clipY),
  };
}
