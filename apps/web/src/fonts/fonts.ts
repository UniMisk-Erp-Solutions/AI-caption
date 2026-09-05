/**
 * Font bundling and loading.
 *
 * Two separate jobs here, and they are easy to confuse:
 *
 *  1. The `import` statements register @font-face rules with the document.
 *     That is enough for DOM text.
 *
 *  2. Canvas is different. `ctx.measureText()` and `fillText()` silently fall
 *     back to a default face if the requested font has not finished loading -
 *     and they do it *without an error*, so the first render of a scene can
 *     quietly lay out in Times New Roman and no one notices until the export
 *     comes out wrong. So before we draw anything we explicitly await
 *     `document.fonts.load()` for every face the design actually uses.
 */

import '@fontsource/anton/index.css';
import '@fontsource/archivo/index.css';
import '@fontsource/bebas-neue/index.css';
import '@fontsource/bodoni-moda/index.css';
import '@fontsource/caveat/index.css';
import '@fontsource/cormorant-garamond/index.css';
import '@fontsource/dm-sans/index.css';
import '@fontsource/dm-serif-display/index.css';
import '@fontsource/fraunces/index.css';
import '@fontsource/great-vibes/index.css';
import '@fontsource/instrument-serif/index.css';
import '@fontsource/inter/index.css';
import '@fontsource/italiana/index.css';
import '@fontsource/libre-baskerville/index.css';
import '@fontsource/manrope/index.css';
import '@fontsource/oswald/index.css';
import '@fontsource/parisienne/index.css';
import '@fontsource/playfair-display/index.css';
import '@fontsource/sacramento/index.css';
import '@fontsource/space-grotesk/index.css';
import '@fontsource/style-script/index.css';

import { FONT_REGISTRY, getFont, type CaptionScene, type EditorState } from '@kc/shared';

const loaded = new Set<string>();

function faceKey(family: string, weight: number, italic: boolean): string {
  return `${italic ? 'italic ' : ''}${weight} 16px "${family}"`;
}

/**
 * Load a specific face. Resolves even on failure - a missing face should
 * degrade to a fallback, never block the editor from opening.
 */
async function loadFace(family: string, weight: number, italic: boolean): Promise<void> {
  const key = faceKey(family, weight, italic);
  if (loaded.has(key)) return;
  loaded.add(key);
  try {
    await document.fonts.load(key);
  } catch {
    /* face unavailable - the canvas fallback stack takes over */
  }
}

/** Load every face used by a design, before the first canvas paint. */
export async function ensureDesignFonts(state: EditorState): Promise<void> {
  const wanted = new Map<string, { family: string; weight: number; italic: boolean }>();

  for (const scene of state.design.scenes) {
    for (const layer of scene.layers) {
      for (const run of layer.runs) {
        const font = getFont(run.fontId);
        const key = faceKey(font.family, run.fontWeight, run.italic);
        if (!wanted.has(key)) {
          wanted.set(key, { family: font.family, weight: run.fontWeight, italic: run.italic });
        }
      }
    }
  }

  await Promise.all([...wanted.values()].map((f) => loadFace(f.family, f.weight, f.italic)));
}

/** Load the faces one scene needs - used when scrubbing into new territory. */
export async function ensureSceneFonts(scene: CaptionScene): Promise<void> {
  const faces = scene.layers.flatMap((l) =>
    l.runs.map((r) => ({ family: getFont(r.fontId).family, weight: r.fontWeight, italic: r.italic })),
  );
  await Promise.all(faces.map((f) => loadFace(f.family, f.weight, f.italic)));
}

/**
 * Load one font id at every weight it ships, for the font picker previews.
 * Deliberately not awaited on the critical path.
 */
export async function preloadFontForPicker(fontId: string): Promise<void> {
  const font = getFont(fontId);
  await Promise.all(font.weights.map((w) => loadFace(font.family, w, false)));
}

/** Warm the faces the default preset uses, so the first design paints correctly. */
export async function preloadCoreFonts(): Promise<void> {
  const core = [
    FONT_REGISTRY.dmSans,
    FONT_REGISTRY.greatVibes,
    FONT_REGISTRY.instrumentSerif,
    FONT_REGISTRY.anton,
    FONT_REGISTRY.inter,
  ];
  await Promise.all(core.flatMap((f) => f.weights.map((w) => loadFace(f.family, w, false))));
}
