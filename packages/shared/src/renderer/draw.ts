import { evaluateAnimation, getAnimation, type AnimState } from '../design/animations';
import { fontFamilyStack, getFont } from '../design/fonts';
import type { CaptionLayer, CaptionScene, EditorState, TextRun } from '../schemas/editor';

/**
 * The single rendering engine.
 *
 * The preview canvas and the export encoder both call `renderFrame()` with the
 * same state and the same timestamp, so what you scrub past is literally what
 * gets encoded. There is no second layout implementation to drift out of sync.
 *
 * The layout is an inline flow of styled runs, which is what allows one line to
 * read "a holi-day in my Life" with `Life` set twice as large in a script face,
 * sitting on the same baseline as the sans around it.
 *
 * Works against anything CanvasRenderingContext2D-shaped, so the same code runs
 * on a DOM canvas in the editor and an OffscreenCanvas in the export worker.
 */

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/* ------------------------------------------------------------------ */
/* Text layout                                                         */
/* ------------------------------------------------------------------ */

export interface Token {
  text: string;
  run: TextRun;
  /** Font size in px for this token. */
  size: number;
  /** Measured advance width in px, excluding surrounding space. */
  width: number;
  /** Space to insert before this token, px. Negative where runs tuck. */
  lead: number;
  /** Offset from the line's left edge, px. */
  x: number;
  /** Index among all words in the layer, for staggered animations. */
  wordIndex: number;
}

export interface LineBox {
  tokens: Token[];
  width: number;
  /** Largest token size on this line - drives leading and the ascent. */
  maxSize: number;
  /** Baseline offset from the block's first baseline, px. */
  baselineY: number;
}

export interface TextLayout {
  /** The layer's base size in px. Runs scale off this. */
  fontPx: number;
  lines: LineBox[];
  width: number;
  height: number;
  /** Distance from the first baseline up to the top of the block, px. */
  ascent: number;
  wordCount: number;
}

function cssFont(run: TextRun, sizePx: number): string {
  const style = run.italic && getFont(run.fontId).italic ? 'italic ' : '';
  return `${style}${run.fontWeight} ${sizePx}px ${fontFamilyStack(run.fontId)}`;
}

/** Canvas `letterSpacing` is Chromium-only; fall back to manual advance. */
function trySetLetterSpacing(ctx: Ctx2D, px: number): boolean {
  try {
    const value = `${px}px`;
    (ctx as CanvasRenderingContext2D).letterSpacing = value;
    return (ctx as CanvasRenderingContext2D).letterSpacing === value;
  } catch {
    return false;
  }
}

function measureWith(ctx: Ctx2D, text: string, spacingPx: number, native: boolean): number {
  if (!text) return 0;
  const w = ctx.measureText(text).width;
  // Canvas applies native spacing after every glyph including the last, so
  // mirror that when emulating, or the two paths disagree by one space.
  return native ? w : w + spacingPx * text.length;
}

/**
 * Lay out a layer's runs into wrapped lines with per-token metrics.
 *
 * Shrinks the whole block if a single unbreakable token overflows, so a long
 * word in a huge script face can never push text off frame.
 */
export function layoutText(ctx: Ctx2D, layer: CaptionLayer, frameW: number, frameH: number): TextLayout {
  const maxWidthPx = layer.maxWidth * frameW;

  const build = (fontPx: number): TextLayout & { naturalWidth: number } => {
    const tokens: Token[] = [];
    let wordIndex = 0;

    layer.runs.forEach((run, runIndex) => {
      const size = fontPx * run.sizeScale;
      const spacingPx = run.letterSpacing * size;
      ctx.font = cssFont(run, size);
      const native = trySetLetterSpacing(ctx, spacingPx);
      const spaceW = measureWith(ctx, ' ', spacingPx, native);

      const words = run.text.split(/\s+/).filter(Boolean);
      words.forEach((word, i) => {
        const isRunStart = i === 0;
        // Runs tuck into each other so a script swash overlaps its neighbour
        // the way a designer would kern the pair by hand.
        const tuck = isRunStart && runIndex > 0 ? (run.tuckBefore + (layer.runs[runIndex - 1]?.tuckAfter ?? 0)) * size : 0;
        tokens.push({
          text: word,
          run,
          size,
          width: measureWith(ctx, word, spacingPx, native),
          lead: runIndex === 0 && isRunStart ? 0 : spaceW + tuck,
          x: 0,
          wordIndex: wordIndex++,
        });
      });

      if (native) trySetLetterSpacing(ctx, 0);
    });

    // Width this layer would occupy if it were never wrapped. A script face can
    // measure far wider than the composer's estimate, and wrapping a two-word
    // hero line is much worse than setting it slightly smaller - so we record
    // this and prefer to shrink.
    const naturalWidth = tokens.reduce((sum, t, i) => sum + (i === 0 ? 0 : t.lead) + t.width, 0);

    // Wrap.
    const lines: LineBox[] = [];
    let current: Token[] = [];
    let cursor = 0;

    const flush = () => {
      if (current.length === 0) return;
      current[0] = { ...current[0], lead: 0, x: 0 };
      let x = 0;
      const laid = current.map((t, i) => {
        const lead = i === 0 ? 0 : t.lead;
        x += lead;
        const placed = { ...t, x };
        x += t.width;
        return placed;
      });
      lines.push({
        tokens: laid,
        width: x,
        maxSize: laid.reduce((m, t) => Math.max(m, t.size), 0),
        baselineY: 0,
      });
      current = [];
      cursor = 0;
    };

    for (const token of tokens) {
      const breakHere = token.run.breakBefore && token.run.text.split(/\s+/)[0] === token.text;
      const next = cursor + (current.length === 0 ? 0 : token.lead) + token.width;
      if (current.length > 0 && (breakHere || next > maxWidthPx)) flush();
      cursor = cursor + (current.length === 0 ? 0 : token.lead) + token.width;
      current.push(token);
    }
    flush();

    // Vertical rhythm. Each line's advance is driven by its own largest token,
    // so a line with a huge script word gets room without inflating the rest.
    let baseline = 0;
    lines.forEach((line, i) => {
      if (i > 0) {
        const prev = lines[i - 1];
        const nominal = ((prev.maxSize + line.maxSize) / 2) * layer.lineHeight;

        // A tight `lineHeight` is what makes an Anton stack interlock, but with
        // mixed sizes it will happily drive a 2x script line straight through
        // the line above it. So the advance can never fall below the lower
        // line's ascent plus the upper line's descent.
        const clearance = line.maxSize * 0.74 + prev.maxSize * 0.2;

        // Faces with long ascenders may still overlap a little, deliberately.
        const tolerance = Math.min(minOverlapTolerance(prev), minOverlapTolerance(line));

        baseline += Math.max(nominal, clearance) - tolerance * line.maxSize;
      }
      line.baselineY = baseline;
    });

    const firstAscent = lines.length > 0 ? lines[0].maxSize * 0.8 : 0;
    const lastDescent = lines.length > 0 ? lines[lines.length - 1].maxSize * 0.24 : 0;

    return {
      fontPx,
      lines,
      width: lines.reduce((m, l) => Math.max(m, l.width), 0),
      height: baseline + firstAscent + lastDescent,
      ascent: firstAscent,
      wordCount: wordIndex,
      naturalWidth,
    };
  };

  const requested = layer.fontSize * frameH;
  let layout = build(requested);

  // If the text overflows, shrink it to fit on one line rather than wrapping -
  // but only down to 62% of the requested size. Past that the type would be too
  // small to read, and wrapping is the better trade.
  if (layout.naturalWidth > maxWidthPx) {
    const scale = maxWidthPx / layout.naturalWidth;
    if (scale >= 0.62) layout = build(requested * scale * 0.995);
  }

  // A genuinely unbreakable token (one very long word) still needs clamping.
  let guard = 0;
  let fontPx = layout.fontPx;
  while (layout.width > maxWidthPx && guard++ < 5) {
    fontPx *= Math.max(0.6, (maxWidthPx / layout.width) * 0.98);
    layout = build(fontPx);
  }

  return layout;
}

function minOverlapTolerance(line: LineBox): number {
  return line.tokens.reduce((m, t) => Math.min(m, getFont(t.run.fontId).overlapTolerance), 1);
}

/* ------------------------------------------------------------------ */
/* Scene lookup                                                        */
/* ------------------------------------------------------------------ */

/** Which scene owns a timestamp. Scenes are ordered and non-overlapping. */
export function sceneAt(state: EditorState, timeMs: number): CaptionScene | null {
  const scenes = state.design.scenes;
  let lo = 0;
  let hi = scenes.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = scenes[mid];
    if (timeMs < s.startMs) hi = mid - 1;
    else if (timeMs > s.endMs) lo = mid + 1;
    else return s;
  }
  return null;
}

/** Every layer that should be on screen at `timeMs`. */
export function activeLayers(state: EditorState, timeMs: number): CaptionLayer[] {
  const scene = sceneAt(state, timeMs);
  if (!scene) return [];
  return scene.layers
    .filter((l) => timeMs >= l.startMs && timeMs <= l.endMs)
    .sort((a, b) => a.zIndex - b.zIndex);
}

/* ------------------------------------------------------------------ */
/* Frame rendering                                                     */
/* ------------------------------------------------------------------ */

export interface RenderOptions {
  /** Skip these layer ids (used while dragging, when the DOM shows a ghost). */
  hiddenLayerIds?: Set<string>;
  /** Render every layer of the active scene regardless of its own timing. */
  ignoreTiming?: boolean;
  /** Global opacity multiplier. */
  opacity?: number;
}

/**
 * Draw one complete frame of captions onto `ctx`.
 *
 * The caller owns the video frame underneath - this only paints typography over
 * a transparent or already-painted canvas.
 */
export function renderFrame(
  ctx: Ctx2D,
  state: EditorState,
  timeMs: number,
  frameW: number,
  frameH: number,
  options: RenderOptions = {},
): void {
  const scene = sceneAt(state, timeMs);
  if (!scene) return;

  const layers = scene.layers
    .filter((l) => options.ignoreTiming || (timeMs >= l.startMs && timeMs <= l.endMs))
    .filter((l) => !options.hiddenLayerIds?.has(l.id))
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of layers) {
    drawLayer(ctx, layer, timeMs, frameW, frameH, options.opacity ?? 1);
  }
}

export function drawLayer(
  ctx: Ctx2D,
  layer: CaptionLayer,
  timeMs: number,
  frameW: number,
  frameH: number,
  globalOpacity = 1,
): void {
  const layout = layoutText(ctx, layer, frameW, frameH);
  if (layout.lines.length === 0) return;

  const perWord = getAnimation(layer.enterAnimation).perWord || getAnimation(layer.exitAnimation).perWord;

  const block = evaluateAnimation({
    nowMs: timeMs,
    startMs: layer.startMs,
    endMs: layer.endMs,
    enterId: perWord ? 'none' : layer.enterAnimation,
    exitId: perWord ? 'none' : layer.exitAnimation,
    enterMs: layer.enterDurationMs,
    exitMs: layer.exitDurationMs,
  });

  if (!perWord && block.opacity <= 0.001) return;

  ctx.save();

  // Draw in a local space centred on the layer anchor so rotation and scale
  // pivot around the text rather than the frame origin.
  ctx.translate(layer.x * frameW + block.dx * layout.fontPx, layer.y * frameH + block.dy * layout.fontPx);
  const rotation = layer.rotation + block.rotate;
  if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
  if (block.scale !== 1) ctx.scale(block.scale, block.scale);

  if (block.clipX < 0.999 || block.clipY < 0.999) {
    applyRevealClip(ctx, layer, layout, block);
  }

  if (block.blur > 0.001) {
    try {
      (ctx as CanvasRenderingContext2D).filter = `blur(${block.blur * layout.fontPx}px)`;
    } catch {
      /* filter unsupported - degrade to no blur rather than dropping the frame */
    }
  }

  if (layer.background) drawBackgroundPlate(ctx, layer, layout, block.opacity * globalOpacity);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  for (const line of layout.lines) {
    const lineLeft = alignOffset(layer.textAlign, line.width);

    for (const token of line.tokens) {
      const state = perWord
        ? evaluateAnimation({
            nowMs: timeMs,
            startMs: layer.startMs,
            endMs: layer.endMs,
            enterId: layer.enterAnimation,
            exitId: layer.exitAnimation,
            enterMs: layer.enterDurationMs,
            exitMs: layer.exitDurationMs,
            wordIndex: token.wordIndex,
            wordCount: layout.wordCount,
          })
        : block;

      const alpha = state.opacity * layer.opacity * token.run.opacity * globalOpacity;
      if (alpha <= 0.001) continue;

      const spacingPx = token.run.letterSpacing * token.size + (perWord ? 0 : block.tracking * token.size);
      ctx.font = cssFont(token.run, token.size);
      const native = trySetLetterSpacing(ctx, spacingPx);
      applyShadow(ctx, layer, token.size);
      ctx.fillStyle = token.run.color;
      ctx.globalAlpha = clamp01(alpha);

      const baseY = line.baselineY - token.run.baselineShift * token.size;

      if (!perWord) {
        drawRun(ctx, token.text, lineLeft + token.x, baseY, spacingPx, native);
      } else {
        // Scale each word about its own centre so a popping word does not slide.
        const cx = lineLeft + token.x + token.width / 2;
        const cy = baseY - token.size * 0.34;
        ctx.save();
        ctx.translate(cx + state.dx * token.size, cy + state.dy * token.size);
        if (state.rotate !== 0) ctx.rotate((state.rotate * Math.PI) / 180);
        if (state.scale !== 1) ctx.scale(state.scale, state.scale);
        drawRun(ctx, token.text, -token.width / 2, token.size * 0.34, spacingPx, native);
        ctx.restore();
      }

      if (native) trySetLetterSpacing(ctx, 0);
    }
  }

  ctx.globalAlpha = 1;
  resetShadow(ctx);
  try {
    (ctx as CanvasRenderingContext2D).filter = 'none';
  } catch {
    /* ignore */
  }
  ctx.restore();
}

/** Draw a run of text, emulating letter-spacing per glyph when unsupported. */
function drawRun(ctx: Ctx2D, text: string, x: number, y: number, spacingPx: number, native: boolean): void {
  if (native || spacingPx === 0) {
    ctx.fillText(text, x, y);
    return;
  }
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacingPx;
  }
}

function alignOffset(align: CaptionLayer['textAlign'], width: number): number {
  if (align === 'center') return -width / 2;
  if (align === 'right') return -width;
  return 0;
}

function blockRect(layer: CaptionLayer, layout: TextLayout, pad: number) {
  const left = alignOffset(layer.textAlign, layout.width) - pad;
  const top = -layout.ascent - pad;
  return { left, top, width: layout.width + pad * 2, height: layout.height + pad * 2 };
}

function applyRevealClip(ctx: Ctx2D, layer: CaptionLayer, layout: TextLayout, block: AnimState): void {
  const r = blockRect(layer, layout, layout.fontPx * 0.45);
  ctx.beginPath();
  ctx.rect(r.left, r.top + r.height * (1 - block.clipY), r.width * block.clipX, r.height * block.clipY);
  ctx.clip();
}

function applyShadow(ctx: Ctx2D, layer: CaptionLayer, sizePx: number): void {
  if (layer.shadow <= 0.001) return resetShadow(ctx);
  // A soft offset shadow rather than a stroke: strokes make display serifs and
  // scripts look muddy, while a shadow leaves the thin strokes intact.
  ctx.shadowColor = `rgba(0,0,0,${0.55 * layer.shadow})`;
  ctx.shadowBlur = sizePx * 0.2 * layer.shadow;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = sizePx * 0.02;
}

function resetShadow(ctx: Ctx2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawBackgroundPlate(ctx: Ctx2D, layer: CaptionLayer, layout: TextLayout, opacity: number): void {
  const bg = layer.background;
  if (!bg) return;
  const px = bg.paddingX * layout.fontPx;
  const py = bg.paddingY * layout.fontPx;
  const left = alignOffset(layer.textAlign, layout.width) - px;
  const top = -layout.ascent - py;
  const w = layout.width + px * 2;
  const h = layout.height + py * 2;
  const r = Math.min(bg.radius * layout.fontPx, Math.min(w, h) / 2);

  ctx.save();
  resetShadow(ctx);
  ctx.globalAlpha = clamp01(bg.opacity * opacity);
  ctx.fillStyle = bg.color;
  roundRect(ctx, left, top, w, h, r);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/* ------------------------------------------------------------------ */
/* Hit testing (editor only, but must agree with the draw code)        */
/* ------------------------------------------------------------------ */

export interface LayerRect {
  /** Normalised 0..1 rect in frame space, ignoring rotation. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding rect of a layer as currently laid out, for selection handles. */
export function measureLayerRect(ctx: Ctx2D, layer: CaptionLayer, frameW: number, frameH: number): LayerRect {
  const layout = layoutText(ctx, layer, frameW, frameH);
  const r = blockRect(layer, layout, 0);
  return {
    x: (layer.x * frameW + r.left) / frameW,
    y: (layer.y * frameH + r.top) / frameH,
    width: r.width / frameW,
    height: r.height / frameH,
  };
}

/** Topmost layer under a normalised point, or null. */
export function hitTest(
  ctx: Ctx2D,
  scene: CaptionScene,
  point: { x: number; y: number },
  frameW: number,
  frameH: number,
): CaptionLayer | null {
  const sorted = [...scene.layers].sort((a, b) => b.zIndex - a.zIndex);
  for (const layer of sorted) {
    const rect = measureLayerRect(ctx, layer, frameW, frameH);
    // Rotate the point into the layer's local space so rotated text still hits.
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const rad = (-layer.rotation * Math.PI) / 180;
    const dx = (point.x - cx) * frameW;
    const dy = (point.y - cy) * frameH;
    const lx = cx + (dx * Math.cos(rad) - dy * Math.sin(rad)) / frameW;
    const ly = cy + (dx * Math.sin(rad) + dy * Math.cos(rad)) / frameH;

    const pad = 0.012;
    if (
      lx >= rect.x - pad &&
      lx <= rect.x + rect.width + pad &&
      ly >= rect.y - pad &&
      ly <= rect.y + rect.height + pad
    ) {
      return layer;
    }
  }
  return null;
}

export type { AnimState };
