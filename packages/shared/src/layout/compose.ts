import { getAnimation } from '../design/animations';
import {
  COMPOSITION_IDS,
  getComposition,
  takeSlots,
  type CompositionDef,
  type CompositionSlot,
  type LineRole,
} from '../design/compositions';
import { getFont, resolveWeight } from '../design/fonts';
import { getPreset, type Emphasis, type PresetDef, type VoiceStyle } from '../design/presets';
import type { AiDesignResponse, AiScene } from '../schemas/ai';
import {
  applyCase,
  captionLayerSchema,
  captionSceneSchema,
  textRunSchema,
  type ArtDirection,
  type AvoidRegion,
  type CaptionLayer,
  type CaptionScene,
  type TextRun,
  type TranscriptWord,
} from '../schemas/editor';
import { groupIntoScenes, pickHeroIndex, splitIntoLines, type SceneGroup } from '../transcript/scenes';

/**
 * Composition: turning decisions into placed, sized, timed typography.
 *
 * Both paths land here - the AI path (`expandAiDesign`) and the deterministic
 * fallback (`autoDesign`). That is deliberate: the fallback is not a degraded
 * "plain subtitles" mode, it is the same engine driven by heuristics instead of
 * a model. If the AI is down, the video still looks designed.
 */

export interface ProjectDims {
  width: number;
  height: number;
}

/* ------------------------------------------------------------------ */
/* Approximate metrics (layout decisions only)                         */
/* ------------------------------------------------------------------ */

/**
 * Estimated width of a run, in px. Rough - it only has to be good enough to
 * pick a starting size, because the renderer measures for real and shrinks to
 * fit before drawing anything.
 */
export function estimateRunWidth(run: TextRun, layerFontPx: number): number {
  const font = getFont(run.fontId);
  const size = layerFontPx * run.sizeScale;
  const upperBias = run.text === run.text.toUpperCase() && /[A-Z]/.test(run.text) ? 1.08 : 1;
  return run.text.length * size * (font.advance * upperBias + run.letterSpacing);
}

export function estimateLayerWidth(layer: CaptionLayer, frameH: number): number {
  const fontPx = layer.fontSize * frameH;
  const spaceW = fontPx * 0.26;
  return layer.runs.reduce(
    (sum, run, i) => sum + estimateRunWidth(run, fontPx) + (i > 0 ? spaceW : 0) + (run.tuckBefore + run.tuckAfter) * fontPx,
    0,
  );
}

/* ------------------------------------------------------------------ */
/* Run construction - the pairing move                                 */
/* ------------------------------------------------------------------ */

export interface WordSpec {
  wordId: string;
  text: string;
  emphasis: Emphasis;
}

/** Resolve a preset voice, applying the project's font overrides. */
export function resolveVoice(preset: PresetDef, emphasis: Emphasis, dir: ArtDirection): VoiceStyle {
  const voice = preset.voices[emphasis];
  const override =
    emphasis === 'hero' ? dir.heroFont : emphasis === 'accent' ? dir.accentFont : emphasis === 'base' ? dir.baseFont : null;
  if (!override) return voice;

  const font = getFont(override);
  return {
    ...voice,
    fontId: override as VoiceStyle['fontId'],
    weight: resolveWeight(override, voice.weight),
    // A swapped-in face keeps the voice's intent but needs its own metrics.
    italic: voice.italic && font.italic,
  };
}

/**
 * Turn a run of words into styled runs, merging adjacent words that share a
 * voice so "a holi-day in my" is one run and "Life" is another.
 */
export function buildRuns(
  words: WordSpec[],
  preset: PresetDef,
  dir: ArtDirection,
  layerId: string,
): TextRun[] {
  const runs: TextRun[] = [];
  let bucket: WordSpec[] = [];
  let bucketEmphasis: Emphasis | null = null;

  const flush = (isFirst: boolean) => {
    if (bucket.length === 0 || bucketEmphasis === null) return;
    const voice = resolveVoice(preset, bucketEmphasis, dir);
    const font = getFont(voice.fontId);
    const raw = bucket.map((w) => w.text).join(' ');
    const text = applyCase(raw, voice.textTransform, isFirst);

    // A script tucks in tighter against its neighbours than a sans would - the
    // swashes are meant to overlap the words on either side.
    const tuck = font.role === 'script' ? -0.14 : font.role === 'didone' ? -0.03 : 0;

    runs.push(
      textRunSchema.parse({
        id: `${layerId}-r${runs.length + 1}`,
        text,
        wordIds: bucket.map((w) => w.wordId),
        emphasis: bucketEmphasis,
        fontId: voice.fontId,
        fontWeight: resolveWeight(voice.fontId, voice.weight),
        italic: voice.italic && font.italic,
        sizeScale: voice.sizeScale * (bucketEmphasis === 'hero' ? dir.heroContrast : 1),
        letterSpacing: voice.tracking + font.defaultTracking,
        baselineShift: voice.baselineShift,
        color: dir.palette[Math.min(2, Math.max(0, voice.colorIndex))] ?? '#FFFFFF',
        tuckBefore: runs.length === 0 ? 0 : tuck,
        tuckAfter: tuck,
        breakBefore: false,
      }),
    );
    bucket = [];
    bucketEmphasis = null;
  };

  words.forEach((word) => {
    if (bucketEmphasis !== null && word.emphasis !== bucketEmphasis) flush(runs.length === 0);
    bucketEmphasis = word.emphasis;
    bucket.push(word);
  });
  flush(runs.length === 0);

  return runs;
}

/* ------------------------------------------------------------------ */
/* Layer / scene construction                                          */
/* ------------------------------------------------------------------ */

export interface LineSpec {
  words: WordSpec[];
  role: LineRole;
  enterAnimation?: string;
  exitAnimation?: string;
}

export interface BuildSceneOptions {
  sceneId: string;
  startMs: number;
  endMs: number;
  keyframeTimestampMs: number;
  compositionId: string;
  lines: LineSpec[];
  direction: ArtDirection;
  dims: ProjectDims;
  avoidRegions?: AvoidRegion[];
  backdropLuma?: number;
  wordsById: Map<string, TranscriptWord>;
  /** Deterministic variation seed - the scene index works well. */
  seed: number;
}

/** Small deterministic hash so "random" choices stay stable across renders. */
function hash(seed: number, salt: number): number {
  let h = (seed * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h / 0xffffffff;
}

export function buildScene(opts: BuildSceneOptions): CaptionScene {
  const preset = getPreset(opts.direction.preset);
  const comp = getComposition(opts.compositionId);
  const lines = opts.lines.filter((l) => l.words.length > 0).slice(0, 4);
  if (lines.length === 0) {
    return captionSceneSchema.parse({
      id: opts.sceneId,
      startMs: opts.startMs,
      endMs: opts.endMs,
      wordIds: [],
      keyframeTimestampMs: opts.keyframeTimestampMs,
      compositionId: comp.id,
      avoidRegions: opts.avoidRegions ?? [],
      backdropLuma: opts.backdropLuma ?? 0.5,
      layers: [],
    });
  }

  const paired = assignSlots(comp, lines);

  const aspect = opts.dims.width / Math.max(1, opts.dims.height);
  // Sizes are authored for 9:16. Wider frames get proportionally smaller type
  // so a line keeps a similar share of the frame's short edge.
  const aspectScale = aspect > 1 ? 0.7 : aspect > 0.72 ? 0.86 : 1;
  const baseSize = preset.baseSize * opts.direction.scale * aspectScale;

  /* ---- pass 1: size every line ---- */

  interface Sized {
    line: LineSpec;
    slot: CompositionSlot;
    layerId: string;
    runs: TextRun[];
    fontSize: number;
    maxWidth: number;
    /** Height of the tallest run on this line, as a fraction of frame height. */
    lineHeightFrac: number;
    /** Permitted interlock with the neighbouring line, in em. */
    overlap: number;
  }

  const sized: Sized[] = [];

  paired.forEach(({ line, slot }, index) => {
    const layerId = `${opts.sceneId}-l${index + 1}`;
    const runs = buildRuns(line.words, preset, opts.direction, layerId);
    if (runs.length === 0) return;

    let fontSize = baseSize * slot.scale;
    const maxWidth = usableWidth(slot);

    const probe = captionLayerSchema.parse({
      id: layerId,
      wordIds: line.words.map((w) => w.wordId),
      role: line.role,
      startMs: opts.startMs,
      endMs: opts.endMs,
      x: slot.x,
      y: 0.5,
      maxWidth,
      fontSize,
      lineHeight: preset.leading,
      textAlign: slot.align,
      runs,
    });

    const estWidth = estimateLayerWidth(probe, opts.dims.height) / opts.dims.width;
    if (estWidth > maxWidth) fontSize *= Math.max(0.4, maxWidth / estWidth);
    fontSize = Math.max(0.014, Math.min(0.3, fontSize));

    // A hero run at 2x makes its line twice as tall as its own fontSize, and the
    // stack has to account for that or the lines collide (or drift apart).
    const tallestRun = runs.reduce((m, r) => Math.max(m, r.sizeScale), 1);

    // How far this line may be allowed to interlock with its neighbour. Anton
    // and the scripts are drawn to overlap a little; a grotesk is not.
    const overlap = runs.reduce((m, r) => Math.min(m, getFont(r.fontId).overlapTolerance), 1);

    sized.push({
      line,
      slot,
      layerId,
      runs,
      fontSize,
      maxWidth,
      lineHeightFrac: fontSize * tallestRun,
      overlap,
    });
  });

  /* ---- pass 2: stack them by real height ---- */

  // Lines are stacked from their measured heights rather than from an abstract
  // unit, so a 2x script line pushes the line below it down by exactly as much
  // as it needs - no more, no less. This is what keeps the block tight the way
  // the reference layouts are, instead of leaving a hole under the hero.
  const ASCENT = 0.78;
  const DESCENT = 0.22;
  const leading = preset.leading;

  const offsets: number[] = [];
  let cursor = 0;
  sized.forEach((entry, i) => {
    if (i > 0) {
      const prev = sized[i - 1];

      // The gap that just avoids the descenders of the line above touching the
      // ascenders of this one.
      const clearance = prev.lineHeightFrac * DESCENT + entry.lineHeightFrac * ASCENT;

      // A tight preset leading (Anton sets 0.8) is what makes a stack interlock,
      // but applied naively it drives one line straight through the next. So the
      // leading may only close the gap as far as the faces' own tolerance for
      // overlapping allows.
      const tolerance = Math.min(prev.overlap, entry.overlap);
      const floor = clearance * (1 - tolerance);

      cursor += Math.max(clearance * leading, floor);
    }
    offsets.push(cursor);
  });

  // Centre the whole block on the composition's anchor.
  const blockTop = offsets.length > 0 ? -sized[0].lineHeightFrac * ASCENT : 0;
  const blockBottom =
    offsets.length > 0 ? cursor + sized[sized.length - 1].lineHeightFrac * DESCENT : 0;
  const blockCentre = (blockTop + blockBottom) / 2;

  const layers: CaptionLayer[] = [];

  sized.forEach((entry, index) => {
    const { line, slot, layerId, runs, fontSize, maxWidth } = entry;

    const rotation = slot.rotate * preset.rotationBudget * opts.direction.rotationLevel;
    const y = comp.anchorY + (offsets[index] - blockCentre);

    const timing = lineTiming(line.words.map((w) => w.wordId), opts);
    const anim = pickAnimations(line, preset, opts, index, timing);

    // Dark type on a dark frame is the failure users notice instantly.
    const luma = opts.backdropLuma ?? 0.5;
    const shadow = Math.max(0, Math.min(1, preset.shadow + (luma > 0.62 ? 0.35 : 0) + (luma < 0.18 ? -0.12 : 0)));

    layers.push(
      captionLayerSchema.parse({
        id: layerId,
        wordIds: line.words.map((w) => w.wordId),
        role: line.role,
        startMs: timing.startMs,
        endMs: timing.endMs,
        x: slot.x,
        y,
        maxWidth,
        rotation,
        fontSize,
        lineHeight: preset.leading,
        textAlign: slot.align,
        opacity: 1,
        shadow,
        background: null,
        enterAnimation: anim.enterId,
        exitAnimation: anim.exitId,
        enterDurationMs: anim.enterMs,
        exitDurationMs: anim.exitMs,
        zIndex: line.role === 'hero' ? 3 : line.role === 'accent' ? 4 : 2,
        locked: false,
        runs,
      }),
    );
  });

  const scene = captionSceneSchema.parse({
    id: opts.sceneId,
    startMs: opts.startMs,
    endMs: opts.endMs,
    wordIds: lines.flatMap((l) => l.words.map((w) => w.wordId)),
    keyframeTimestampMs: opts.keyframeTimestampMs,
    compositionId: comp.id,
    avoidRegions: opts.avoidRegions ?? [],
    backdropLuma: opts.backdropLuma ?? 0.5,
    layers,
  });

  return resolveCollisions(scene, opts.dims);
}

/**
 * Pair each line with a composition slot.
 *
 * Lines MUST stay in spoken order top to bottom - a stack that reads
 * "as a / a Holiday / in my life" is nonsense no matter how pretty it is. So
 * lines are assigned to slots positionally, and when the hero line does not
 * land in the slot carrying the hero scale, we swap the *scales* between the
 * two slots instead of moving the lines. Position and alignment stay with the
 * arrangement; size follows the meaning.
 */
function assignSlots(
  comp: CompositionDef,
  lines: LineSpec[],
): Array<{ line: LineSpec; slot: CompositionSlot }> {
  const slots = takeSlots(comp, lines.length)
    .slice(0, lines.length)
    .sort((a, b) => a.dy - b.dy);

  // takeSlots can return fewer slots than lines for sparse compositions.
  while (slots.length < lines.length) {
    const last = slots[slots.length - 1];
    slots.push({ ...last, dy: last.dy + 1, scale: last.scale * 0.9 });
  }

  const heroLineIndex = lines.findIndex((l) => l.role === 'hero');
  const heroSlotIndex = slots.findIndex((s) => s.role === 'hero');

  if (heroLineIndex >= 0 && heroSlotIndex >= 0 && heroLineIndex !== heroSlotIndex) {
    // Swap the slots outright, position included. Vertical order is no longer
    // carried by the slot (the stacker derives it from measured line heights),
    // so this is safe - and swapping only the scale would leave the hero line
    // sitting in, say, the rotated annotation position of `corner-note`.
    const a = slots[heroLineIndex];
    slots[heroLineIndex] = slots[heroSlotIndex];
    slots[heroSlotIndex] = a;
  }

  return lines.map((line, i) => ({ line, slot: slots[i] }));
}

/** How much horizontal room a slot has before it hits the safe margin. */
function usableWidth(slot: CompositionSlot): number {
  const MARGIN = 0.055;
  if (slot.align === 'left') return Math.max(0.2, 1 - MARGIN - slot.x);
  if (slot.align === 'right') return Math.max(0.2, slot.x - MARGIN);
  return Math.max(0.2, Math.min(slot.x, 1 - slot.x) * 2 - MARGIN);
}

/* ------------------------------------------------------------------ */
/* Timing                                                              */
/* ------------------------------------------------------------------ */

interface LineTiming {
  startMs: number;
  endMs: number;
}

/**
 * A line appears when its first word is spoken and holds until the scene ends.
 *
 * That staggered-in, held-together behaviour is what makes a stacked layout
 * read as one composition rather than three unrelated captions: the frame
 * assembles itself as the sentence is said, then sits still.
 */
function lineTiming(wordIds: string[], opts: BuildSceneOptions): LineTiming {
  const words = wordIds.map((id) => opts.wordsById.get(id)).filter((w): w is TranscriptWord => !!w);
  if (words.length === 0) return { startMs: opts.startMs, endMs: opts.endMs };
  const first = Math.min(...words.map((w) => w.startMs));
  // Land a beat early so the word is legible as it is said, not after.
  return { startMs: Math.max(opts.startMs, first - 120), endMs: opts.endMs };
}

function pickAnimations(
  line: LineSpec,
  preset: PresetDef,
  opts: BuildSceneOptions,
  index: number,
  timing: LineTiming,
): { enterId: string; exitId: string; enterMs: number; exitMs: number } {
  const motion = opts.direction.motionLevel;

  // A higher motionLevel unlocks the louder end of the preset's list.
  const enters = preset.enterAnimations;
  const cutoff = Math.max(1, Math.ceil(enters.length * (0.35 + motion * 0.65)));
  const pool = enters.slice(0, cutoff);
  const enterId = line.enterAnimation ?? pool[Math.floor(hash(opts.seed, index) * pool.length) % pool.length];

  const exits = preset.exitAnimations;
  const exitId = line.exitAnimation ?? exits[Math.floor(hash(opts.seed, index + 97) * exits.length) % exits.length];

  const life = Math.max(200, timing.endMs - timing.startMs);
  return {
    enterId,
    exitId,
    enterMs: Math.round(Math.min(life * 0.55, getAnimation(enterId).defaultMs * (0.75 + motion * 0.5))),
    exitMs: Math.round(Math.min(life * 0.3, getAnimation(exitId).defaultMs * 0.7)),
  };
}

/* ------------------------------------------------------------------ */
/* Collision / avoid-region resolution                                 */
/* ------------------------------------------------------------------ */

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function layerBox(layer: CaptionLayer, dims: ProjectDims): Box {
  const w = Math.min(layer.maxWidth, estimateLayerWidth(layer, dims.height) / dims.width);
  // Runs can be much taller than the layer's own size, so the tallest run wins.
  const tallest = layer.runs.reduce((m, r) => Math.max(m, r.sizeScale), 1);
  const h = layer.fontSize * layer.lineHeight * tallest;
  const left = layer.textAlign === 'left' ? layer.x : layer.textAlign === 'right' ? layer.x - w : layer.x - w / 2;
  return { left, top: layer.y - h * 0.8, right: left + w, bottom: layer.y + h * 0.3 };
}

function overlap(a: Box, b: Box): number {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > 0 && y > 0 ? x * y : 0;
}

const SAFE_MARGIN = 0.045;

/**
 * Push the whole text block off faces and back inside the safe margins.
 *
 * The block moves as a unit rather than per-layer, because moving one line of a
 * composition independently is exactly what destroys the composition. We try a
 * ladder of vertical offsets and take the first that clears, falling back to
 * the least-bad option.
 */
export function resolveCollisions(scene: CaptionScene, dims: ProjectDims): CaptionScene {
  if (scene.layers.length === 0) return scene;

  const candidates = [0, -0.1, 0.1, -0.19, 0.19, -0.28, 0.28, -0.36, 0.36];
  let best = { dy: 0, cost: Infinity };

  for (const dy of candidates) {
    let cost = 0;
    for (const layer of scene.layers) {
      const box = layerBox({ ...layer, y: layer.y + dy }, dims);

      for (const region of scene.avoidRegions) {
        const r: Box = {
          left: region.x,
          top: region.y,
          right: region.x + region.width,
          bottom: region.y + region.height,
        };
        // Faces are worth avoiding far more than generically busy areas.
        cost += overlap(box, r) * (region.kind === 'face' ? 60 : 24);
      }

      // Leaving the frame is worse than covering anything.
      cost += Math.max(0, SAFE_MARGIN - box.top) * 40;
      cost += Math.max(0, box.bottom - (1 - SAFE_MARGIN)) * 40;
      cost += Math.max(0, SAFE_MARGIN - box.left) * 25;
      cost += Math.max(0, box.right - (1 - SAFE_MARGIN)) * 25;
    }
    // Prefer staying put when the improvement is marginal.
    cost += Math.abs(dy) * 0.35;

    if (cost < best.cost) best = { dy, cost };
    if (cost === 0) break;
  }

  const layers = scene.layers.map((layer) => {
    const moved = { ...layer, y: clamp(layer.y + best.dy, 0.05, 0.96) };
    // Final horizontal clamp so nothing ever runs off the edge.
    const box = layerBox(moved, dims);
    let x = moved.x;
    if (box.left < SAFE_MARGIN) x += SAFE_MARGIN - box.left;
    if (box.right > 1 - SAFE_MARGIN) x -= box.right - (1 - SAFE_MARGIN);
    return { ...moved, x: clamp(x, 0.02, 0.98) };
  });

  return { ...scene, layers };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/* ------------------------------------------------------------------ */
/* AI expansion                                                        */
/* ------------------------------------------------------------------ */

export interface ExpandOptions {
  dims: ProjectDims;
  words: TranscriptWord[];
  groups: SceneGroup[];
}

/**
 * Turn a validated AI response into real scenes.
 *
 * Everything the model said is a *suggestion that must survive validation*:
 * unknown word ids are dropped, empty lines removed, forgotten scenes filled in
 * by the deterministic designer, and dropped words re-attached so the
 * transcript is always fully represented on screen.
 */
export function expandAiDesign(
  ai: AiDesignResponse,
  direction: ArtDirection,
  opts: ExpandOptions,
): CaptionScene[] {
  const wordsById = new Map(opts.words.map((w) => [w.id, w]));
  const aiById = new Map(ai.scenes.map((s) => [s.id, s]));

  return opts.groups.map((group, index) => {
    const aiScene = aiById.get(group.id);
    if (!aiScene) return autoScene(group, wordsById, direction, opts.dims, index);
    return (
      buildFromAiScene(aiScene, group, wordsById, direction, opts.dims, index) ??
      autoScene(group, wordsById, direction, opts.dims, index)
    );
  });
}

export function buildFromAiScene(
  aiScene: AiScene,
  group: SceneGroup,
  wordsById: Map<string, TranscriptWord>,
  direction: ArtDirection,
  dims: ProjectDims,
  seed: number,
): CaptionScene | null {
  const allowed = new Set(group.wordIds);
  const preset = getPreset(direction.preset);

  const heroIds = new Set(aiScene.heroWordIds.filter((id) => allowed.has(id)));
  const accentIds = new Set(aiScene.accentWordIds.filter((id) => allowed.has(id) && !heroIds.has(id)));

  // Presets with no hero voice (the Anton stack) ignore hero promotion.
  const allowHero = preset.heroesPerScene > 0;

  const emphasisFor = (id: string): Emphasis =>
    allowHero && heroIds.has(id) ? 'hero' : accentIds.has(id) ? 'accent' : 'base';

  const used = new Set<string>();
  const lines: LineSpec[] = [];

  for (const line of aiScene.lines) {
    const ids = line.wordIds.filter((id) => allowed.has(id) && !used.has(id));
    if (ids.length === 0) continue;
    ids.forEach((id) => used.add(id));
    ids.sort((a, b) => (wordsById.get(a)?.startMs ?? 0) - (wordsById.get(b)?.startMs ?? 0));

    lines.push({
      words: ids.map((id) => ({
        wordId: id,
        text: wordsById.get(id)?.text ?? '',
        emphasis: emphasisFor(id),
      })),
      role: 'tail',
      enterAnimation: line.enterAnimation,
    });
  }

  if (lines.length === 0) return null;

  // Words the model silently dropped are re-attached to their nearest line -
  // the transcript must always be fully represented on screen.
  for (const id of group.wordIds) {
    if (used.has(id)) continue;
    const word = wordsById.get(id);
    if (!word) continue;
    const target = nearestLine(lines, word, wordsById);
    target.words.push({ wordId: id, text: word.text, emphasis: emphasisFor(id) });
    target.words.sort(
      (a, b) => (wordsById.get(a.wordId)?.startMs ?? 0) - (wordsById.get(b.wordId)?.startMs ?? 0),
    );
  }

  // The line holding the hero word is the hero line; the first line leads.
  const heroLine = lines.find((l) => l.words.some((w) => w.emphasis === 'hero'));
  if (heroLine) heroLine.role = 'hero';
  else lines[Math.min(1, lines.length - 1)].role = 'hero';
  if (lines.length >= 2 && lines[0].role !== 'hero') lines[0].role = 'lead';

  return buildScene({
    sceneId: group.id,
    startMs: group.startMs,
    endMs: group.endMs,
    keyframeTimestampMs: group.keyframeTimestampMs,
    compositionId: aiScene.compositionId,
    lines,
    direction,
    dims,
    avoidRegions: aiScene.avoidRegions,
    backdropLuma: aiScene.backdropLuma,
    wordsById,
    seed,
  });
}

function nearestLine(lines: LineSpec[], word: TranscriptWord, wordsById: Map<string, TranscriptWord>): LineSpec {
  let best = lines[0];
  let bestDist = Infinity;
  for (const line of lines) {
    for (const w of line.words) {
      const tw = wordsById.get(w.wordId);
      if (!tw) continue;
      const d = Math.abs(tw.startMs - word.startMs);
      if (d < bestDist) {
        bestDist = d;
        best = line;
      }
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Deterministic designer (first paint + fallback)                     */
/* ------------------------------------------------------------------ */

/**
 * Design a whole project without any AI.
 *
 * Runs before the model is called, so the editor has something real on screen
 * immediately, and again if the model fails. Heuristic, not random: the hero
 * word detector drives both the line split and the font pairing, and
 * compositions rotate so neighbouring scenes never repeat.
 */
export function autoDesign(
  words: TranscriptWord[],
  direction: ArtDirection,
  dims: ProjectDims,
  groups?: SceneGroup[],
): CaptionScene[] {
  const preset = getPreset(direction.preset);
  const wordsById = new Map(words.map((w) => [w.id, w]));
  const sceneGroups = groups ?? groupIntoScenes(words, { targetWords: preset.sceneWordTarget });
  return sceneGroups.map((group, i) => autoScene(group, wordsById, direction, dims, i));
}

function autoScene(
  group: SceneGroup,
  wordsById: Map<string, TranscriptWord>,
  direction: ArtDirection,
  dims: ProjectDims,
  index: number,
): CaptionScene {
  const preset = getPreset(direction.preset);
  const words = group.wordIds.map((id) => wordsById.get(id)).filter((w): w is TranscriptWord => !!w);

  const portrait = dims.height >= dims.width;
  const pool = preset.compositions.filter((id) => portrait || getComposition(id).orientation !== 'portrait');
  const compositions = pool.length > 0 ? pool : COMPOSITION_IDS;
  const compositionId = compositions[index % compositions.length];

  const heroIdx = words.length > 0 ? pickHeroIndex(words) : -1;
  const heroWordId = preset.heroesPerScene > 0 && heroIdx >= 0 ? words[heroIdx]?.id : undefined;

  const lineGroups = splitIntoLines(words, 3);

  const lines: LineSpec[] = lineGroups.map((lg) => ({
    words: lg.wordIds.map((id) => ({
      wordId: id,
      text: wordsById.get(id)?.text ?? '',
      emphasis: (id === heroWordId ? 'hero' : 'base') as Emphasis,
    })),
    role: (heroWordId && lg.wordIds.includes(heroWordId) ? 'hero' : 'tail') as LineRole,
  }));

  if (!lines.some((l) => l.role === 'hero') && lines.length > 0) {
    lines[Math.min(1, lines.length - 1)].role = 'hero';
  }
  if (lines.length >= 2 && lines[0].role !== 'hero') lines[0].role = 'lead';

  return buildScene({
    sceneId: group.id,
    startMs: group.startMs,
    endMs: group.endMs,
    keyframeTimestampMs: group.keyframeTimestampMs,
    compositionId,
    lines,
    direction,
    dims,
    wordsById,
    seed: index + 1,
  });
}
