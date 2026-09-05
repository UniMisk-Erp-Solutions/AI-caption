/**
 * Font bundling and loading.
 *
 * Note the import subpath: `@fontsource/x/latin`, not `latin.css`. Every
 * package exports `"./*": "./*.css"`, so appending the extension resolves to
 * `latin.css.css` and Rollup fails the production build - while the dev server,
 * which resolves off the filesystem, happily serves it. Worth knowing before
 * "it works locally" turns into a broken deploy.
 *
 * 144 faces are available; loading all of them eagerly would be absurd on
 * mobile, so this splits them:
 *
 *   eager  the 21 core faces every preset is built from. Bundled, so the app
 *          works offline and the first paint never waits on a network.
 *   lazy   the other 123, code-split by Vite and fetched the first time a
 *          design actually uses one.
 *
 * Only the `latin` subset is imported, which cuts the downloaded weight
 * substantially versus the full family.
 */

import { getFont, type CaptionScene, type EditorState } from '@kc/shared';

// --- eager: every preset is built from these, so they must be instant ---
import '@fontsource/dm-sans/latin';
import '@fontsource/inter/latin';
import '@fontsource/manrope/latin';
import '@fontsource/space-grotesk/latin';
import '@fontsource/archivo/latin';
import '@fontsource/anton/latin';
import '@fontsource/bebas-neue/latin';
import '@fontsource/oswald/latin';
import '@fontsource/bodoni-moda/latin';
import '@fontsource/dm-serif-display/latin';
import '@fontsource/playfair-display/latin';
import '@fontsource/italiana/latin';
import '@fontsource/instrument-serif/latin';
import '@fontsource/cormorant-garamond/latin';
import '@fontsource/fraunces/latin';
import '@fontsource/libre-baskerville/latin';
import '@fontsource/great-vibes/latin';
import '@fontsource/style-script/latin';
import '@fontsource/parisienne/latin';
import '@fontsource/sacramento/latin';
import '@fontsource/caveat/latin';

// --- lazy: code-split, fetched the first time a design uses the face ---
const LAZY_FONT_CSS: Record<string, () => Promise<unknown>> = {
  prata: () => import('@fontsource/prata/latin'),
  gildaDisplay: () => import('@fontsource/gilda-display/latin'),
  marcellus: () => import('@fontsource/marcellus/latin'),
  cinzel: () => import('@fontsource/cinzel/latin'),
  yesevaOne: () => import('@fontsource/yeseva-one/latin'),
  abrilFatface: () => import('@fontsource/abril-fatface/latin'),
  bellefair: () => import('@fontsource/bellefair/latin'),
  anticDidone: () => import('@fontsource/antic-didone/latin'),
  rozhaOne: () => import('@fontsource/rozha-one/latin'),
  rufina: () => import('@fontsource/rufina/latin'),
  trirong: () => import('@fontsource/trirong/latin'),
  ebGaramond: () => import('@fontsource/eb-garamond/latin'),
  lora: () => import('@fontsource/lora/latin'),
  spectral: () => import('@fontsource/spectral/latin'),
  crimsonPro: () => import('@fontsource/crimson-pro/latin'),
  vollkorn: () => import('@fontsource/vollkorn/latin'),
  newsreader: () => import('@fontsource/newsreader/latin'),
  literata: () => import('@fontsource/literata/latin'),
  petrona: () => import('@fontsource/petrona/latin'),
  faustina: () => import('@fontsource/faustina/latin'),
  frankRuhlLibre: () => import('@fontsource/frank-ruhl-libre/latin'),
  sortsMillGoudy: () => import('@fontsource/sorts-mill-goudy/latin'),
  eczar: () => import('@fontsource/eczar/latin'),
  bitter: () => import('@fontsource/bitter/latin'),
  zillaSlab: () => import('@fontsource/zilla-slab/latin'),
  allura: () => import('@fontsource/allura/latin'),
  pinyonScript: () => import('@fontsource/pinyon-script/latin'),
  tangerine: () => import('@fontsource/tangerine/latin'),
  mrsSaintDelafield: () => import('@fontsource/mrs-saint-delafield/latin'),
  herrVonMuellerhoff: () => import('@fontsource/herr-von-muellerhoff/latin'),
  italianno: () => import('@fontsource/italianno/latin'),
  petitFormalScript: () => import('@fontsource/petit-formal-script/latin'),
  alexBrush: () => import('@fontsource/alex-brush/latin'),
  yellowtail: () => import('@fontsource/yellowtail/latin'),
  kaushanScript: () => import('@fontsource/kaushan-script/latin'),
  dancingScript: () => import('@fontsource/dancing-script/latin'),
  cookie: () => import('@fontsource/cookie/latin'),
  norican: () => import('@fontsource/norican/latin'),
  leagueScript: () => import('@fontsource/league-script/latin'),
  rougeScript: () => import('@fontsource/rouge-script/latin'),
  qwigley: () => import('@fontsource/qwigley/latin'),
  mrDeHaviland: () => import('@fontsource/mr-de-haviland/latin'),
  monsieurLaDoulaise: () => import('@fontsource/monsieur-la-doulaise/latin'),
  ephesis: () => import('@fontsource/ephesis/latin'),
  meddon: () => import('@fontsource/meddon/latin'),
  permanentMarker: () => import('@fontsource/permanent-marker/latin'),
  rockSalt: () => import('@fontsource/rock-salt/latin'),
  shadowsIntoLight: () => import('@fontsource/shadows-into-light/latin'),
  gloriaHallelujah: () => import('@fontsource/gloria-hallelujah/latin'),
  patrickHand: () => import('@fontsource/patrick-hand/latin'),
  architectsDaughter: () => import('@fontsource/architects-daughter/latin'),
  nanumPenScript: () => import('@fontsource/nanum-pen-script/latin'),
  sriracha: () => import('@fontsource/sriracha/latin'),
  amaticSC: () => import('@fontsource/amatic-sc/latin'),
  archivoBlack: () => import('@fontsource/archivo-black/latin'),
  fjallaOne: () => import('@fontsource/fjalla-one/latin'),
  staatliches: () => import('@fontsource/staatliches/latin'),
  teko: () => import('@fontsource/teko/latin'),
  khand: () => import('@fontsource/khand/latin'),
  rajdhani: () => import('@fontsource/rajdhani/latin'),
  bigShouldersDisplay: () => import('@fontsource/big-shoulders-display/latin'),
  passionOne: () => import('@fontsource/passion-one/latin'),
  alfaSlabOne: () => import('@fontsource/alfa-slab-one/latin'),
  ultra: () => import('@fontsource/ultra/latin'),
  titanOne: () => import('@fontsource/titan-one/latin'),
  righteous: () => import('@fontsource/righteous/latin'),
  bowlbyOne: () => import('@fontsource/bowlby-one/latin'),
  lilitaOne: () => import('@fontsource/lilita-one/latin'),
  sairaCondensed: () => import('@fontsource/saira-condensed/latin'),
  chivo: () => import('@fontsource/chivo/latin'),
  bungee: () => import('@fontsource/bungee/latin'),
  modak: () => import('@fontsource/modak/latin'),
  josefinSans: () => import('@fontsource/josefin-sans/latin'),
  jost: () => import('@fontsource/jost/latin'),
  quicksand: () => import('@fontsource/quicksand/latin'),
  comfortaa: () => import('@fontsource/comfortaa/latin'),
  poppins: () => import('@fontsource/poppins/latin'),
  montserrat: () => import('@fontsource/montserrat/latin'),
  raleway: () => import('@fontsource/raleway/latin'),
  nunito: () => import('@fontsource/nunito/latin'),
  outfit: () => import('@fontsource/outfit/latin'),
  urbanist: () => import('@fontsource/urbanist/latin'),
  sora: () => import('@fontsource/sora/latin'),
  lexend: () => import('@fontsource/lexend/latin'),
  figtree: () => import('@fontsource/figtree/latin'),
  plusJakartaSans: () => import('@fontsource/plus-jakarta-sans/latin'),
  redHatDisplay: () => import('@fontsource/red-hat-display/latin'),
  epilogue: () => import('@fontsource/epilogue/latin'),
  leagueSpartan: () => import('@fontsource/league-spartan/latin'),
  workSans: () => import('@fontsource/work-sans/latin'),
  publicSans: () => import('@fontsource/public-sans/latin'),
  barlow: () => import('@fontsource/barlow/latin'),
  karla: () => import('@fontsource/karla/latin'),
  rubik: () => import('@fontsource/rubik/latin'),
  mulish: () => import('@fontsource/mulish/latin'),
  asap: () => import('@fontsource/asap/latin'),
  cabin: () => import('@fontsource/cabin/latin'),
  firaCode: () => import('@fontsource/fira-code/latin'),
  courierPrime: () => import('@fontsource/courier-prime/latin'),
  spaceMono: () => import('@fontsource/space-mono/latin'),
  ibmPlexMono: () => import('@fontsource/ibm-plex-mono/latin'),
  jetbrainsMono: () => import('@fontsource/jetbrains-mono/latin'),
  robotoMono: () => import('@fontsource/roboto-mono/latin'),
  cutiveMono: () => import('@fontsource/cutive-mono/latin'),
  xanhMono: () => import('@fontsource/xanh-mono/latin'),
  dmMono: () => import('@fontsource/dm-mono/latin'),
  lobster: () => import('@fontsource/lobster/latin'),
  pacifico: () => import('@fontsource/pacifico/latin'),
  bangers: () => import('@fontsource/bangers/latin'),
  luckiestGuy: () => import('@fontsource/luckiest-guy/latin'),
  chewy: () => import('@fontsource/chewy/latin'),
  fredoka: () => import('@fontsource/fredoka/latin'),
  grandstander: () => import('@fontsource/grandstander/latin'),
  baloo2: () => import('@fontsource/baloo-2/latin'),
  monoton: () => import('@fontsource/monoton/latin'),
  megrim: () => import('@fontsource/megrim/latin'),
  silkscreen: () => import('@fontsource/silkscreen/latin'),
  wallpoet: () => import('@fontsource/wallpoet/latin'),
  michroma: () => import('@fontsource/michroma/latin'),
  orbitron: () => import('@fontsource/orbitron/latin'),
  syncopate: () => import('@fontsource/syncopate/latin'),
  rubikMonoOne: () => import('@fontsource/rubik-mono-one/latin'),
  bungeeShade: () => import('@fontsource/bungee-shade/latin'),
};

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

const cssLoaded = new Set<string>();
const faceLoaded = new Set<string>();

/**
 * Pull in a face's stylesheet, once.
 *
 * Failure is deliberately swallowed: a font that will not load should degrade
 * to the fallback stack, never block the editor from opening or the export from
 * running.
 */
async function loadCss(fontId: string): Promise<void> {
  if (cssLoaded.has(fontId)) return;
  cssLoaded.add(fontId);

  const loader = LAZY_FONT_CSS[fontId];
  if (!loader) return; // eagerly bundled, already present

  try {
    await loader();
  } catch {
    /* fall back to the family's fallback stack */
  }
}

function faceKey(family: string, weight: number, italic: boolean): string {
  return `${italic ? 'italic ' : ''}${weight} 16px "${family}"`;
}

/**
 * Wait for a specific face to be usable by canvas.
 *
 * This matters more than it looks. `measureText` and `fillText` silently
 * substitute a fallback for a font that has not finished loading - no error, no
 * warning - so a scene can lay out against the wrong metrics and the export
 * comes out different from the preview. Every draw path awaits this first.
 */
async function loadFace(fontId: string, weight: number, italic: boolean): Promise<void> {
  const font = getFont(fontId);
  const key = faceKey(font.family, weight, italic);
  if (faceLoaded.has(key)) return;

  await loadCss(fontId);
  faceLoaded.add(key);

  try {
    await document.fonts.load(key);
  } catch {
    /* face unavailable - the canvas fallback stack takes over */
  }
}

/** Every face a design uses. Await before the first canvas paint. */
export async function ensureDesignFonts(state: EditorState): Promise<void> {
  const wanted = new Map<string, { id: string; weight: number; italic: boolean }>();

  for (const scene of state.design.scenes) {
    for (const layer of scene.layers) {
      for (const run of layer.runs) {
        const font = getFont(run.fontId);
        const key = faceKey(font.family, run.fontWeight, run.italic);
        if (!wanted.has(key)) {
          wanted.set(key, { id: run.fontId, weight: run.fontWeight, italic: run.italic });
        }
      }
    }
  }

  await Promise.all([...wanted.values()].map((f) => loadFace(f.id, f.weight, f.italic)));
}

/** The faces one scene needs - used when scrubbing into new territory. */
export async function ensureSceneFonts(scene: CaptionScene): Promise<void> {
  const faces = scene.layers.flatMap((l) =>
    l.runs.map((r) => ({ id: r.fontId, weight: r.fontWeight, italic: r.italic })),
  );
  await Promise.all(faces.map((f) => loadFace(f.id, f.weight, f.italic)));
}

/** Load one family at a representative weight, for picker previews. */
export async function preloadFontForPicker(fontId: string): Promise<void> {
  const font = getFont(fontId);
  const weight = font.weights.includes(400) ? 400 : font.weights[0];
  await loadFace(fontId, weight, false);
}

/** Load several picker previews at once, without blocking the UI thread. */
export function preloadFontsForPicker(fontIds: string[]): void {
  for (const id of fontIds) void preloadFontForPicker(id);
}

/**
 * Warm the default preset's faces.
 *
 * The first canvas paint can happen before React finishes mounting the editor,
 * and an unloaded face renders in a fallback without any error - so this runs
 * at startup rather than on demand.
 */
export async function preloadCoreFonts(): Promise<void> {
  const core: Array<[string, number]> = [
    ['dmSans', 500],
    ['greatVibes', 400],
    ['instrumentSerif', 400],
    ['anton', 400],
    ['inter', 400],
    ['bodoni', 600],
    ['styleScript', 400],
  ];
  await Promise.all(core.map(([id, weight]) => loadFace(id, weight, false)));
}

/** True once a face is ready to draw. Used to defer a repaint rather than flash. */
export function isFaceReady(fontId: string, weight: number, italic: boolean): boolean {
  return faceLoaded.has(faceKey(getFont(fontId).family, weight, italic));
}
