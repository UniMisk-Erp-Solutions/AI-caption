import {
  buildScene,
  getPreset,
  type CaptionScene,
  type EditorState,
  type Emphasis,
  type LineSpec,
} from '@kc/shared';

/**
 * Rebuild one scene through the composer.
 *
 * Used whenever a change is *geometric* rather than cosmetic - a new
 * composition, a different hero word, a re-broken line. Those cannot be patched
 * onto existing layers, because position, size, alignment and rotation all come
 * from the composition template as a set. Patching one of them individually is
 * how you get the lopsided output that made this rewrite necessary.
 *
 * Everything the user has hand-edited (`locked`) is preserved by the store when
 * it merges the result back in.
 */

export interface RecomposeOptions {
  compositionId?: string;
  /** Replace the scene's hero word. Empty array removes hero emphasis. */
  heroWordIds?: string[];
  /** Explicit line grouping. Omit to keep the current one. */
  lines?: string[][];
}

export function recomposeScene(
  state: EditorState,
  sceneId: string,
  options: RecomposeOptions = {},
): CaptionScene | null {
  const scene = state.design.scenes.find((s) => s.id === sceneId);
  if (!scene) return null;

  const direction = state.design.direction;
  const preset = getPreset(direction.preset);
  const wordsById = new Map(state.transcript.words.map((w) => [w.id, w]));

  // Recover the current structure from the layers themselves, so a rebuild
  // preserves whatever the AI (or the user) decided about grouping.
  const currentLines = options.lines ?? scene.layers.map((l) => l.wordIds).filter((ids) => ids.length > 0);
  if (currentLines.length === 0) return null;

  const currentHeroes =
    options.heroWordIds ??
    scene.layers.flatMap((l) => l.runs.filter((r) => r.emphasis === 'hero').flatMap((r) => r.wordIds));
  const heroSet = new Set(currentHeroes);

  const currentAccents = scene.layers.flatMap((l) =>
    l.runs.filter((r) => r.emphasis === 'accent').flatMap((r) => r.wordIds),
  );
  const accentSet = new Set(currentAccents.filter((id) => !heroSet.has(id)));

  const allowHero = preset.heroesPerScene > 0;
  const emphasisFor = (id: string): Emphasis =>
    allowHero && heroSet.has(id) ? 'hero' : accentSet.has(id) ? 'accent' : 'base';

  const lines: LineSpec[] = currentLines.map((wordIds) => ({
    words: wordIds
      .filter((id) => wordsById.has(id))
      .map((id) => ({ wordId: id, text: wordsById.get(id)!.text, emphasis: emphasisFor(id) })),
    role: 'tail' as const,
  }));

  const populated = lines.filter((l) => l.words.length > 0);
  if (populated.length === 0) return null;

  // The line carrying the hero drives the composition's hero slot.
  const heroLine = populated.find((l) => l.words.some((w) => w.emphasis === 'hero'));
  if (heroLine) heroLine.role = 'hero';
  else populated[Math.min(1, populated.length - 1)].role = 'hero';
  if (populated.length >= 2 && populated[0].role !== 'hero') populated[0].role = 'lead';

  return buildScene({
    sceneId: scene.id,
    startMs: scene.startMs,
    endMs: scene.endMs,
    keyframeTimestampMs: scene.keyframeTimestampMs,
    compositionId: options.compositionId ?? scene.compositionId,
    lines: populated,
    direction,
    dims: { width: state.project.width, height: state.project.height },
    avoidRegions: scene.avoidRegions,
    backdropLuma: scene.backdropLuma,
    wordsById,
    seed: hashId(scene.id),
  });
}

/** Promote one word to hero and demote whatever held it before. */
export function setSceneHero(state: EditorState, sceneId: string, wordId: string): CaptionScene | null {
  return recomposeScene(state, sceneId, { heroWordIds: [wordId] });
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 9973;
}
