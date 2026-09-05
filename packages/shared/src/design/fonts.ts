/**
 * Approved font registry - 144 faces.
 *
 * The AI never sees or emits a raw font-family string, only a `fontId` from
 * this table. That single guard is what stops the model inventing
 * "Neue Haas Grotesk Display Pro" and silently falling back to Times New Roman
 * in the export canvas.
 *
 * A NOTE ON THE REFERENCE FONTS
 *
 * Most of the faces in the typography references people bring to this - TAN
 * Aegean, RoxboroughCF, Sloop Script Pro, Gliker, Perandory, Giaza, Coterie,
 * Bernoru - are commercially licensed and cannot be redistributed in an open
 * repository. Everything here is Google Fonts / SIL Open Font License, chosen
 * to cover the same aesthetic ground. `PAIRING_NOTES` in presets.ts records
 * which free face stands in for which paid one.
 *
 * LOADING
 *
 * Twenty-one core faces are bundled eagerly - every preset is built from them,
 * so the app works offline and the first paint never waits on a network. The
 * other 123 are code-split and fetched only when a design actually uses them,
 * which keeps the initial bundle small on mobile. `bundled: false` marks those.
 */

export type FontRole =
  /** Carries whole sentences. Neutral, readable at small sizes. */
  | 'workhorse'
  /** Geometric and modern. Slightly more character than a workhorse. */
  | 'geometric'
  /** Big, loud, condensed. Sets stacked poster headlines. */
  | 'heavy'
  /** High-contrast serif. The magazine-cover voice. */
  | 'didone'
  /** Book serif with a strong italic. Between didone and script. */
  | 'serif'
  /** Flowing connected script. The hero word, never a whole sentence. */
  | 'script'
  /** Handwriting, marker, comic. Personality over polish. */
  | 'quirky'
  /** Fixed width. Technical, documentary, screenplay. */
  | 'mono'
  /** Pixel, stencil, techno, layered. Use once, deliberately. */
  | 'experimental';

export interface FontDef {
  id: string;
  family: string;
  fallback: string;
  /** @fontsource package name, for the on-demand loader. */
  pkg: string;
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
   * How far neighbouring lines may interlock, in em. Scripts and Didones have
   * long ascenders that are meant to overlap; a grotesk is not.
   */
  overlapTolerance: number;
  /** True when the face is only legible large - blocks tiny-text mistakes. */
  displayOnly: boolean;
  /** Eagerly bundled, versus code-split and fetched on first use. */
  bundled: boolean;
  /** Human description, handed to the AI so it picks with intent. */
  vibe: string;
}

export const FONT_REGISTRY = {
  dmSans: { id: 'dmSans', family: "DM Sans", fallback: 'Helvetica, Arial, sans-serif', pkg: 'dm-sans', role: 'workhorse',
    weights: [400, 500, 700], italic: true, opticalScale: 1, advance: 0.52, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: true,
    vibe: "Neutral geometric sans. The default voice for the words around the hero." },
  inter: { id: 'inter', family: "Inter", fallback: 'Helvetica, Arial, sans-serif', pkg: 'inter', role: 'workhorse',
    weights: [300, 400, 500, 600, 700, 800, 900], italic: false, opticalScale: 1, advance: 0.52, defaultTracking: -0.01,
    defaultLeading: 1.1, overlapTolerance: 0, displayOnly: false, bundled: true,
    vibe: "Invisible UI sans. For tiny meta lines, episode labels, timestamps." },
  manrope: { id: 'manrope', family: "Manrope", fallback: 'Helvetica, Arial, sans-serif', pkg: 'manrope', role: 'workhorse',
    weights: [300, 400, 500, 600, 700, 800], italic: false, opticalScale: 1, advance: 0.51, defaultTracking: -0.015,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: true,
    vibe: "Modern semi-rounded sans. ExtraBold is a clean confident headline." },
  spaceGrotesk: { id: 'spaceGrotesk', family: "Space Grotesk", fallback: 'Helvetica, Arial, sans-serif', pkg: 'space-grotesk', role: 'workhorse',
    weights: [300, 400, 500, 600, 700], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: -0.02,
    defaultLeading: 1, overlapTolerance: 0, displayOnly: false, bundled: true,
    vibe: "Technical grotesk with odd details. Reads contemporary, design-studio." },
  archivo: { id: 'archivo', family: "Archivo", fallback: 'Helvetica, Arial, sans-serif', pkg: 'archivo', role: 'workhorse',
    weights: [400, 500, 600, 700, 800, 900], italic: true, opticalScale: 0.98, advance: 0.5, defaultTracking: -0.025,
    defaultLeading: 0.98, overlapTolerance: 0, displayOnly: false, bundled: true,
    vibe: "Sturdy grotesk. Black weight uppercase is the loud poster voice." },
  anton: { id: 'anton', family: "Anton", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'anton', role: 'heavy',
    weights: [400], italic: false, opticalScale: 0.94, advance: 0.42, defaultTracking: -0.02,
    defaultLeading: 0.82, overlapTolerance: 0.06, displayOnly: true, bundled: true,
    vibe: "Ultra-condensed poster black. THE face for tightly stacked lowercase headlines that fill the frame edge to edge." },
  bebasNeue: { id: 'bebasNeue', family: "Bebas Neue", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'bebas-neue', role: 'heavy',
    weights: [400], italic: false, opticalScale: 0.98, advance: 0.36, defaultTracking: 0.01,
    defaultLeading: 0.86, overlapTolerance: 0.04, displayOnly: true, bundled: true,
    vibe: "All-caps condensed. Narrow, punchy, stacks beautifully. Uppercase by design." },
  oswald: { id: 'oswald', family: "Oswald", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'oswald', role: 'heavy',
    weights: [300, 400, 500, 600, 700], italic: false, opticalScale: 0.97, advance: 0.42, defaultTracking: -0.005,
    defaultLeading: 0.92, overlapTolerance: 0.03, displayOnly: false, bundled: true,
    vibe: "Condensed gothic with real weights. The middle ground between Anton and a plain sans." },
  bodoni: { id: 'bodoni', family: "Bodoni Moda", fallback: 'Didot, Georgia, serif', pkg: 'bodoni-moda', role: 'didone',
    weights: [400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1.04, advance: 0.46, defaultTracking: -0.005,
    defaultLeading: 0.92, overlapTolerance: 0.05, displayOnly: false, bundled: true,
    vibe: "Fashion-magazine Didone. Extreme thick/thin. Reads as Vogue. Best large and uppercase." },
  dmSerifDisplay: { id: 'dmSerifDisplay', family: "DM Serif Display", fallback: 'Didot, Georgia, serif', pkg: 'dm-serif-display', role: 'didone',
    weights: [400], italic: true, opticalScale: 1, advance: 0.47, defaultTracking: -0.015,
    defaultLeading: 0.94, overlapTolerance: 0.05, displayOnly: false, bundled: true,
    vibe: "Rich high-contrast serif with a gorgeous italic. The quiet-luxury hero." },
  playfair: { id: 'playfair', family: "Playfair Display", fallback: 'Didot, Georgia, serif', pkg: 'playfair-display', role: 'didone',
    weights: [400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.48, defaultTracking: -0.01,
    defaultLeading: 0.98, overlapTolerance: 0.04, displayOnly: false, bundled: true,
    vibe: "Classic transitional display serif. Safe, handsome, editorial." },
  italiana: { id: 'italiana', family: "Italiana", fallback: 'Didot, Georgia, serif', pkg: 'italiana', role: 'didone',
    weights: [400], italic: false, opticalScale: 1.08, advance: 0.44, defaultTracking: 0.08,
    defaultLeading: 1.05, overlapTolerance: 0.02, displayOnly: true, bundled: true,
    vibe: "Very thin elegant capitals. Wide-tracked it is pure luxury-brand wordmark." },
  instrumentSerif: { id: 'instrumentSerif', family: "Instrument Serif", fallback: 'Georgia, serif', pkg: 'instrument-serif', role: 'serif',
    weights: [400], italic: true, opticalScale: 1.06, advance: 0.44, defaultTracking: -0.01,
    defaultLeading: 0.95, overlapTolerance: 0.06, displayOnly: false, bundled: true,
    vibe: "High-contrast editorial serif, quiet and expensive. Its italic is one of the best free hero-word faces." },
  cormorant: { id: 'cormorant', family: "Cormorant Garamond", fallback: 'Georgia, serif', pkg: 'cormorant-garamond', role: 'serif',
    weights: [300, 400, 500, 600, 700], italic: true, opticalScale: 1.12, advance: 0.44, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.05, displayOnly: false, bundled: true,
    vibe: "Delicate old-style serif. Light weights large feel romantic and airy." },
  fraunces: { id: 'fraunces', family: "Fraunces", fallback: 'Georgia, serif', pkg: 'fraunces', role: 'serif',
    weights: [300, 400, 500, 600, 700, 900], italic: true, opticalScale: 1, advance: 0.47, defaultTracking: -0.015,
    defaultLeading: 0.98, overlapTolerance: 0.04, displayOnly: false, bundled: true,
    vibe: "Wonky warm soft-serif with personality. Playful without losing craft." },
  libreBaskerville: { id: 'libreBaskerville', family: "Libre Baskerville", fallback: 'Georgia, serif', pkg: 'libre-baskerville', role: 'serif',
    weights: [400, 700], italic: true, opticalScale: 0.92, advance: 0.55, defaultTracking: 0,
    defaultLeading: 1.2, overlapTolerance: 0, displayOnly: false, bundled: true,
    vibe: "Bookish, wide, very readable. Good for the small supporting line." },
  greatVibes: { id: 'greatVibes', family: "Great Vibes", fallback: 'Segoe Script, cursive', pkg: 'great-vibes', role: 'script',
    weights: [400], italic: false, opticalScale: 1.42, advance: 0.54, defaultTracking: 0,
    defaultLeading: 1.15, overlapTolerance: 0.16, displayOnly: true, bundled: true,
    vibe: "Formal connected calligraphy with huge swashes. The most expensive-looking hero word face. ONE word, never a phrase." },
  styleScript: { id: 'styleScript', family: "Style Script", fallback: 'Segoe Script, cursive', pkg: 'style-script', role: 'script',
    weights: [400], italic: false, opticalScale: 1.3, advance: 0.47, defaultTracking: 0,
    defaultLeading: 1.05, overlapTolerance: 0.14, displayOnly: true, bundled: true,
    vibe: "Casual signature script. Looser than Great Vibes. Reads modern-luxury." },
  parisienne: { id: 'parisienne', family: "Parisienne", fallback: 'Segoe Script, cursive', pkg: 'parisienne', role: 'script',
    weights: [400], italic: false, opticalScale: 1.32, advance: 0.44, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.14, displayOnly: true, bundled: true,
    vibe: "Light airy hand-script. Feminine, delicate, morning-routine energy." },
  sacramento: { id: 'sacramento', family: "Sacramento", fallback: 'Segoe Script, cursive', pkg: 'sacramento', role: 'script',
    weights: [400], italic: false, opticalScale: 1.28, advance: 0.42, defaultTracking: 0,
    defaultLeading: 1.05, overlapTolerance: 0.12, displayOnly: true, bundled: true,
    vibe: "Thin monoline script. Quieter than the others, good when the frame is busy." },
  caveat: { id: 'caveat', family: "Caveat", fallback: 'Segoe Script, cursive', pkg: 'caveat', role: 'script',
    weights: [400, 500, 600, 700], italic: false, opticalScale: 1.22, advance: 0.38, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.08, displayOnly: false, bundled: true,
    vibe: "Handwritten marker, not calligraphy. For scribbled asides, usually rotated slightly." },
  prata: { id: 'prata', family: "Prata", fallback: 'Didot, Georgia, serif', pkg: 'prata', role: 'didone',
    weights: [400], italic: false, opticalScale: 1.02, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.0, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Warm high-contrast Didone. Softer than Bodoni and very editorial." },
  gildaDisplay: { id: 'gildaDisplay', family: "Gilda Display", fallback: 'Didot, Georgia, serif', pkg: 'gilda-display', role: 'didone',
    weights: [400], italic: false, opticalScale: 1, advance: 0.48, defaultTracking: 0.01,
    defaultLeading: 1.0, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Refined bookish display serif. Understated luxury." },
  marcellus: { id: 'marcellus', family: "Marcellus", fallback: 'Didot, Georgia, serif', pkg: 'marcellus', role: 'didone',
    weights: [400], italic: false, opticalScale: 1, advance: 0.49, defaultTracking: 0.02,
    defaultLeading: 1.0, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Roman-inscription capitals. Museum-poster calm." },
  cinzel: { id: 'cinzel', family: "Cinzel", fallback: 'Didot, Georgia, serif', pkg: 'cinzel', role: 'didone',
    weights: [400, 500, 600, 700, 800, 900], italic: false, opticalScale: 1, advance: 0.52, defaultTracking: 0.04,
    defaultLeading: 1.0, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Classical carved capitals. Titles, credits, anything wanting gravitas." },
  yesevaOne: { id: 'yesevaOne', family: "Yeseva One", fallback: 'Didot, Georgia, serif', pkg: 'yeseva-one', role: 'didone',
    weights: [400], italic: false, opticalScale: 1.02, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.0, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Curvy high-contrast display with flair. Feminine and decorative." },
  abrilFatface: { id: 'abrilFatface', family: "Abril Fatface", fallback: 'Didot, Georgia, serif', pkg: 'abril-fatface', role: 'didone',
    weights: [400], italic: false, opticalScale: 0.98, advance: 0.5, defaultTracking: -0.015,
    defaultLeading: 1.0, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Heavy Didone with dramatic thick/thin. Magazine-cover energy." },
  bellefair: { id: 'bellefair', family: "Bellefair", fallback: 'Didot, Georgia, serif', pkg: 'bellefair', role: 'didone',
    weights: [400], italic: false, opticalScale: 1.04, advance: 0.45, defaultTracking: 0.01,
    defaultLeading: 1.0, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Light elegant serif capitals. Delicate wordmark feel." },
  anticDidone: { id: 'anticDidone', family: "Antic Didone", fallback: 'Didot, Georgia, serif', pkg: 'antic-didone', role: 'didone',
    weights: [400], italic: false, opticalScale: 1.02, advance: 0.47, defaultTracking: 0.01,
    defaultLeading: 1.0, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Quiet Didone with low contrast. Restrained editorial." },
  rozhaOne: { id: 'rozhaOne', family: "Rozha One", fallback: 'Didot, Georgia, serif', pkg: 'rozha-one', role: 'didone',
    weights: [400], italic: false, opticalScale: 1, advance: 0.52, defaultTracking: -0.01,
    defaultLeading: 1.0, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Bold ornate Didone. Loud, decorative, festival poster." },
  rufina: { id: 'rufina', family: "Rufina", fallback: 'Didot, Georgia, serif', pkg: 'rufina', role: 'didone',
    weights: [400, 700], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.0, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Contrast serif with slab-ish feet. Confident and modern." },
  trirong: { id: 'trirong', family: "Trirong", fallback: 'Didot, Georgia, serif', pkg: 'trirong', role: 'didone',
    weights: [300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.0, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Sharp contrast serif with a strong italic. Fashion editorial." },
  ebGaramond: { id: 'ebGaramond', family: "EB Garamond", fallback: 'Georgia, serif', pkg: 'eb-garamond', role: 'serif',
    weights: [400, 500, 600, 700, 800], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Classic Garamond. Timeless, literary, endlessly readable." },
  lora: { id: 'lora', family: "Lora", fallback: 'Georgia, serif', pkg: 'lora', role: 'serif',
    weights: [400, 500, 600, 700], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Contemporary brushed serif. Warm and trustworthy." },
  spectral: { id: 'spectral', family: "Spectral", fallback: 'Georgia, serif', pkg: 'spectral', role: 'serif',
    weights: [200, 300, 400, 500, 600, 700, 800], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Screen-first serif with generous width. A calm long-form voice." },
  crimsonPro: { id: 'crimsonPro', family: "Crimson Pro", fallback: 'Georgia, serif', pkg: 'crimson-pro', role: 'serif',
    weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Old-style book serif. Quiet and scholarly." },
  vollkorn: { id: 'vollkorn', family: "Vollkorn", fallback: 'Georgia, serif', pkg: 'vollkorn', role: 'serif',
    weights: [400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Sturdy friendly serif with weight. Good for bold quotes." },
  newsreader: { id: 'newsreader', family: "Newsreader", fallback: 'Georgia, serif', pkg: 'newsreader', role: 'serif',
    weights: [200, 300, 400, 500, 600, 700, 800], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Editorial news serif with a lovely italic." },
  literata: { id: 'literata', family: "Literata", fallback: 'Georgia, serif', pkg: 'literata', role: 'serif',
    weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Comfortable reading serif designed for screens." },
  petrona: { id: 'petrona', family: "Petrona", fallback: 'Georgia, serif', pkg: 'petrona', role: 'serif',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Flared humanist serif. Soft and approachable." },
  faustina: { id: 'faustina', family: "Faustina", fallback: 'Georgia, serif', pkg: 'faustina', role: 'serif',
    weights: [300, 400, 500, 600, 700, 800], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Contemporary text serif with crisp detail." },
  frankRuhlLibre: { id: 'frankRuhlLibre', family: "Frank Ruhl Libre", fallback: 'Georgia, serif', pkg: 'frank-ruhl-libre', role: 'serif',
    weights: [300, 400, 500, 700, 900], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "High-contrast serif with a modern edge." },
  sortsMillGoudy: { id: 'sortsMillGoudy', family: "Sorts Mill Goudy", fallback: 'Georgia, serif', pkg: 'sorts-mill-goudy', role: 'serif',
    weights: [400], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Warm old-style Goudy revival. Antique and gentle." },
  eczar: { id: 'eczar', family: "Eczar", fallback: 'Georgia, serif', pkg: 'eczar', role: 'serif',
    weights: [400, 500, 600, 700, 800], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Energetic display serif with heavy weights." },
  bitter: { id: 'bitter', family: "Bitter", fallback: 'Georgia, serif', pkg: 'bitter', role: 'serif',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Contemporary slab serif. Solid and dependable." },
  zillaSlab: { id: 'zillaSlab', family: "Zilla Slab", fallback: 'Georgia, serif', pkg: 'zilla-slab', role: 'serif',
    weights: [300, 400, 500, 600, 700], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.1, overlapTolerance: 0.02, displayOnly: false, bundled: false,
    vibe: "Geometric slab with character. Technical but warm." },
  allura: { id: 'allura', family: "Allura", fallback: 'Segoe Script, cursive', pkg: 'allura', role: 'script',
    weights: [400], italic: false, opticalScale: 1.34, advance: 0.42, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.15, displayOnly: true, bundled: false,
    vibe: "Flowing formal script with long tails. Wedding-invitation elegance." },
  pinyonScript: { id: 'pinyonScript', family: "Pinyon Script", fallback: 'Segoe Script, cursive', pkg: 'pinyon-script', role: 'script',
    weights: [400], italic: false, opticalScale: 1.3, advance: 0.44, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.14, displayOnly: true, bundled: false,
    vibe: "Copperplate calligraphy. Ornate and traditional." },
  tangerine: { id: 'tangerine', family: "Tangerine", fallback: 'Segoe Script, cursive', pkg: 'tangerine', role: 'script',
    weights: [400], italic: false, opticalScale: 1.5, advance: 0.36, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.18, displayOnly: true, bundled: false,
    vibe: "Extremely fine calligraphic script. Must be set very large." },
  mrsSaintDelafield: { id: 'mrsSaintDelafield', family: "Mrs Saint Delafield", fallback: 'Segoe Script, cursive', pkg: 'mrs-saint-delafield', role: 'script',
    weights: [400], italic: false, opticalScale: 1.4, advance: 0.4, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.16, displayOnly: true, bundled: false,
    vibe: "Loose expressive hand-calligraphy. Personal and romantic." },
  herrVonMuellerhoff: { id: 'herrVonMuellerhoff', family: "Herr Von Muellerhoff", fallback: 'Segoe Script, cursive', pkg: 'herr-von-muellerhoff', role: 'script',
    weights: [400], italic: false, opticalScale: 1.44, advance: 0.36, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.17, displayOnly: true, bundled: false,
    vibe: "Very fine spencerian script. Delicate to the point of fragile." },
  italianno: { id: 'italianno', family: "Italianno", fallback: 'Segoe Script, cursive', pkg: 'italianno', role: 'script',
    weights: [400], italic: false, opticalScale: 1.38, advance: 0.38, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.15, displayOnly: true, bundled: false,
    vibe: "Sweeping italic calligraphy with big flourishes." },
  petitFormalScript: { id: 'petitFormalScript', family: "Petit Formal Script", fallback: 'Segoe Script, cursive', pkg: 'petit-formal-script', role: 'script',
    weights: [400], italic: false, opticalScale: 1.26, advance: 0.44, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.12, displayOnly: true, bundled: false,
    vibe: "Neat formal script. Restrained, less swashy." },
  alexBrush: { id: 'alexBrush', family: "Alex Brush", fallback: 'Segoe Script, cursive', pkg: 'alex-brush', role: 'script',
    weights: [400], italic: false, opticalScale: 1.32, advance: 0.42, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.14, displayOnly: true, bundled: false,
    vibe: "Brush calligraphy with a real pen feel." },
  yellowtail: { id: 'yellowtail', family: "Yellowtail", fallback: 'Segoe Script, cursive', pkg: 'yellowtail', role: 'script',
    weights: [400], italic: false, opticalScale: 1.2, advance: 0.46, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.1, displayOnly: true, bundled: false,
    vibe: "Retro sign-painter brush script. Nostalgic and friendly." },
  kaushanScript: { id: 'kaushanScript', family: "Kaushan Script", fallback: 'Segoe Script, cursive', pkg: 'kaushan-script', role: 'script',
    weights: [400], italic: false, opticalScale: 1.18, advance: 0.48, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.09, displayOnly: true, bundled: false,
    vibe: "Casual brush script with a slight slant. Modern-handmade." },
  dancingScript: { id: 'dancingScript', family: "Dancing Script", fallback: 'Segoe Script, cursive', pkg: 'dancing-script', role: 'script',
    weights: [400], italic: false, opticalScale: 1.16, advance: 0.46, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.08, displayOnly: true, bundled: false,
    vibe: "Bouncy casual script. Cheerful and informal." },
  cookie: { id: 'cookie', family: "Cookie", fallback: 'Segoe Script, cursive', pkg: 'cookie', role: 'script',
    weights: [400], italic: false, opticalScale: 1.22, advance: 0.44, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.1, displayOnly: true, bundled: false,
    vibe: "Sweet retro script. Bakery-sign charm." },
  norican: { id: 'norican', family: "Norican", fallback: 'Segoe Script, cursive', pkg: 'norican', role: 'script',
    weights: [400], italic: false, opticalScale: 1.2, advance: 0.46, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.09, displayOnly: true, bundled: false,
    vibe: "Elegant brush with a modern edge." },
  leagueScript: { id: 'leagueScript', family: "League Script", fallback: 'Segoe Script, cursive', pkg: 'league-script', role: 'script',
    weights: [400], italic: false, opticalScale: 1.28, advance: 0.4, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.13, displayOnly: true, bundled: false,
    vibe: "Fine connected script. Understated formality." },
  rougeScript: { id: 'rougeScript', family: "Rouge Script", fallback: 'Segoe Script, cursive', pkg: 'rouge-script', role: 'script',
    weights: [400], italic: false, opticalScale: 1.3, advance: 0.4, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.13, displayOnly: true, bundled: false,
    vibe: "Slender formal script with a light touch." },
  qwigley: { id: 'qwigley', family: "Qwigley", fallback: 'Segoe Script, cursive', pkg: 'qwigley', role: 'script',
    weights: [400], italic: false, opticalScale: 1.34, advance: 0.38, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.15, displayOnly: true, bundled: false,
    vibe: "Fine slanted script with long ascenders." },
  mrDeHaviland: { id: 'mrDeHaviland', family: "Mr De Haviland", fallback: 'Segoe Script, cursive', pkg: 'mr-de-haviland', role: 'script',
    weights: [400], italic: false, opticalScale: 1.36, advance: 0.38, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.15, displayOnly: true, bundled: false,
    vibe: "Refined spencerian hand. Very formal." },
  monsieurLaDoulaise: { id: 'monsieurLaDoulaise', family: "Monsieur La Doulaise", fallback: 'Segoe Script, cursive', pkg: 'monsieur-la-doulaise', role: 'script',
    weights: [400], italic: false, opticalScale: 1.42, advance: 0.36, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.17, displayOnly: true, bundled: false,
    vibe: "Ornate flourished calligraphy. Maximum decoration." },
  ephesis: { id: 'ephesis', family: "Ephesis", fallback: 'Segoe Script, cursive', pkg: 'ephesis', role: 'script',
    weights: [400], italic: false, opticalScale: 1.26, advance: 0.44, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.11, displayOnly: true, bundled: false,
    vibe: "Contemporary calligraphic script. Soft and rounded." },
  meddon: { id: 'meddon', family: "Meddon", fallback: 'Segoe Script, cursive', pkg: 'meddon', role: 'script',
    weights: [400], italic: false, opticalScale: 1.3, advance: 0.44, defaultTracking: 0,
    defaultLeading: 1.08, overlapTolerance: 0.12, displayOnly: true, bundled: false,
    vibe: "Antique ink handwriting. Looks genuinely written." },
  permanentMarker: { id: 'permanentMarker', family: "Permanent Marker", fallback: 'Comic Sans MS, cursive', pkg: 'permanent-marker', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.02, overlapTolerance: 0.06, displayOnly: false, bundled: false,
    vibe: "Thick marker scrawl. Bold annotation energy." },
  rockSalt: { id: 'rockSalt', family: "Rock Salt", fallback: 'Comic Sans MS, cursive', pkg: 'rock-salt', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.14, advance: 0.56, defaultTracking: 0,
    defaultLeading: 1.02, overlapTolerance: 0.06, displayOnly: false, bundled: false,
    vibe: "Rough handwritten pen. Raw and personal." },
  shadowsIntoLight: { id: 'shadowsIntoLight', family: "Shadows Into Light", fallback: 'Comic Sans MS, cursive', pkg: 'shadows-into-light', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.2, advance: 0.4, defaultTracking: 0,
    defaultLeading: 1.02, overlapTolerance: 0.06, displayOnly: false, bundled: false,
    vibe: "Light casual handwriting. Diary-like." },
  gloriaHallelujah: { id: 'gloriaHallelujah', family: "Gloria Hallelujah", fallback: 'Comic Sans MS, cursive', pkg: 'gloria-hallelujah', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.14, advance: 0.48, defaultTracking: 0,
    defaultLeading: 1.02, overlapTolerance: 0.06, displayOnly: false, bundled: false,
    vibe: "Bouncy schoolbook handwriting. Playful." },
  patrickHand: { id: 'patrickHand', family: "Patrick Hand", fallback: 'Comic Sans MS, cursive', pkg: 'patrick-hand', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.1, advance: 0.44, defaultTracking: 0,
    defaultLeading: 1.02, overlapTolerance: 0.06, displayOnly: false, bundled: false,
    vibe: "Neat friendly handwriting. Very legible." },
  architectsDaughter: { id: 'architectsDaughter', family: "Architects Daughter", fallback: 'Comic Sans MS, cursive', pkg: 'architects-daughter', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.12, advance: 0.46, defaultTracking: 0,
    defaultLeading: 1.02, overlapTolerance: 0.06, displayOnly: false, bundled: false,
    vibe: "Casual drafting hand. Sketchbook feel." },
  nanumPenScript: { id: 'nanumPenScript', family: "Nanum Pen Script", fallback: 'Comic Sans MS, cursive', pkg: 'nanum-pen-script', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.22, advance: 0.38, defaultTracking: 0,
    defaultLeading: 1.02, overlapTolerance: 0.06, displayOnly: false, bundled: false,
    vibe: "Thin ballpoint scrawl. Quick and light." },
  sriracha: { id: 'sriracha', family: "Sriracha", fallback: 'Comic Sans MS, cursive', pkg: 'sriracha', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.12, advance: 0.46, defaultTracking: 0,
    defaultLeading: 1.02, overlapTolerance: 0.06, displayOnly: false, bundled: false,
    vibe: "Loose brush handwriting with attitude." },
  amaticSC: { id: 'amaticSC', family: "Amatic SC", fallback: 'Comic Sans MS, cursive', pkg: 'amatic-sc', role: 'quirky',
    weights: [400, 700], italic: false, opticalScale: 1.26, advance: 0.3, defaultTracking: 0,
    defaultLeading: 1.02, overlapTolerance: 0.06, displayOnly: false, bundled: false,
    vibe: "Tall narrow hand-drawn caps. Charming and space-efficient." },
  archivoBlack: { id: 'archivoBlack', family: "Archivo Black", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'archivo-black', role: 'heavy',
    weights: [400], italic: false, opticalScale: 0.98, advance: 0.52, defaultTracking: -0.02,
    defaultLeading: 0.95, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Maximum-weight grotesk. An immovable poster headline." },
  fjallaOne: { id: 'fjallaOne', family: "Fjalla One", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'fjalla-one', role: 'heavy',
    weights: [400], italic: false, opticalScale: 0.98, advance: 0.42, defaultTracking: -0.005,
    defaultLeading: 0.92, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Condensed display sans. Newsy and direct." },
  staatliches: { id: 'staatliches', family: "Staatliches", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'staatliches', role: 'heavy',
    weights: [400], italic: false, opticalScale: 1, advance: 0.38, defaultTracking: 0.02,
    defaultLeading: 0.9, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Condensed all-caps display. Poster and ticket energy." },
  teko: { id: 'teko', family: "Teko", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'teko', role: 'heavy',
    weights: [300, 400, 500, 600, 700], italic: false, opticalScale: 1, advance: 0.36, defaultTracking: 0,
    defaultLeading: 0.86, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Very condensed squared sans. Sporty and technical." },
  khand: { id: 'khand', family: "Khand", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'khand', role: 'heavy',
    weights: [300, 400, 500, 600, 700], italic: false, opticalScale: 1, advance: 0.4, defaultTracking: 0,
    defaultLeading: 0.9, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Condensed squarish sans. Industrial." },
  rajdhani: { id: 'rajdhani', family: "Rajdhani", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'rajdhani', role: 'heavy',
    weights: [300, 400, 500, 600, 700], italic: false, opticalScale: 1, advance: 0.42, defaultTracking: 0.01,
    defaultLeading: 0.95, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Squared technical sans. Sci-fi interface feel." },
  bigShouldersDisplay: { id: 'bigShouldersDisplay', family: "Big Shoulders Display", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'big-shoulders-display', role: 'heavy',
    weights: [100, 300, 400, 500, 600, 700, 800, 900], italic: false, opticalScale: 1, advance: 0.34, defaultTracking: 0,
    defaultLeading: 0.88, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Extremely condensed display. Fits a lot into a narrow column." },
  passionOne: { id: 'passionOne', family: "Passion One", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'passion-one', role: 'heavy',
    weights: [400, 700, 900], italic: false, opticalScale: 0.96, advance: 0.44, defaultTracking: -0.02,
    defaultLeading: 0.9, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Rounded heavy display. Loud and friendly." },
  alfaSlabOne: { id: 'alfaSlabOne', family: "Alfa Slab One", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'alfa-slab-one', role: 'heavy',
    weights: [400], italic: false, opticalScale: 0.96, advance: 0.54, defaultTracking: -0.01,
    defaultLeading: 0.95, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Massive slab serif. Circus-poster weight." },
  ultra: { id: 'ultra', family: "Ultra", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'ultra', role: 'heavy',
    weights: [400], italic: false, opticalScale: 0.94, advance: 0.56, defaultTracking: -0.01,
    defaultLeading: 0.95, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Ultra-bold slab. Vintage advertising." },
  titanOne: { id: 'titanOne', family: "Titan One", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'titan-one', role: 'heavy',
    weights: [400], italic: false, opticalScale: 0.96, advance: 0.52, defaultTracking: -0.01,
    defaultLeading: 0.95, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Chunky rounded display. Cartoonish and bold." },
  righteous: { id: 'righteous', family: "Righteous", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'righteous', role: 'heavy',
    weights: [400], italic: false, opticalScale: 1, advance: 0.46, defaultTracking: 0,
    defaultLeading: 0.98, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Art-deco flavoured display sans. Retro-futurist." },
  bowlbyOne: { id: 'bowlbyOne', family: "Bowlby One", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'bowlby-one', role: 'heavy',
    weights: [400], italic: false, opticalScale: 0.96, advance: 0.54, defaultTracking: -0.01,
    defaultLeading: 0.95, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Fat rounded display caps. Bubbly and loud." },
  lilitaOne: { id: 'lilitaOne', family: "Lilita One", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'lilita-one', role: 'heavy',
    weights: [400], italic: false, opticalScale: 0.98, advance: 0.46, defaultTracking: -0.01,
    defaultLeading: 0.94, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Soft heavy display. Approachable poster weight." },
  sairaCondensed: { id: 'sairaCondensed', family: "Saira Condensed", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'saira-condensed', role: 'heavy',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false, opticalScale: 1, advance: 0.38, defaultTracking: 0,
    defaultLeading: 0.9, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Clean condensed sans across many weights." },
  chivo: { id: 'chivo', family: "Chivo", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'chivo', role: 'heavy',
    weights: [300, 400, 500, 600, 700, 800, 900], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Grotesque with strong personality at heavy weights." },
  bungee: { id: 'bungee', family: "Bungee", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'bungee', role: 'heavy',
    weights: [400], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 0.95, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Vertical-friendly signage display. Urban and blocky." },
  modak: { id: 'modak', family: "Modak", fallback: 'Impact, Haettenschweiler, sans-serif', pkg: 'modak', role: 'heavy',
    weights: [400], italic: false, opticalScale: 0.96, advance: 0.56, defaultTracking: -0.01,
    defaultLeading: 0.95, overlapTolerance: 0.04, displayOnly: true, bundled: false,
    vibe: "Inflated bubble display. Extremely playful." },
  josefinSans: { id: 'josefinSans', family: "Josefin Sans", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'josefin-sans', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700], italic: true, opticalScale: 1, advance: 0.46, defaultTracking: 0.02,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Geometric deco sans. Elegant and slightly retro." },
  jost: { id: 'jost', family: "Jost", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'jost', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.48, defaultTracking: 0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Futura-like geometric sans. Clean Bauhaus lineage." },
  quicksand: { id: 'quicksand', family: "Quicksand", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'quicksand', role: 'geometric',
    weights: [300, 400, 500, 600, 700], italic: false, opticalScale: 1, advance: 0.52, defaultTracking: 0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Rounded geometric sans. Soft and friendly." },
  comfortaa: { id: 'comfortaa', family: "Comfortaa", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'comfortaa', role: 'geometric',
    weights: [300, 400, 500, 600, 700], italic: false, opticalScale: 1, advance: 0.54, defaultTracking: 0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Very rounded geometric sans. Gentle and modern." },
  poppins: { id: 'poppins', family: "Poppins", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'poppins', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.55, defaultTracking: 0,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Geometric sans with a tall x-height. Ubiquitous and clean." },
  montserrat: { id: 'montserrat', family: "Montserrat", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'montserrat', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.55, defaultTracking: 0,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Urban geometric sans. Confident and neutral." },
  raleway: { id: 'raleway', family: "Raleway", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'raleway', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Elegant sans with a distinctive W. The light weights are lovely." },
  nunito: { id: 'nunito', family: "Nunito", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'nunito', role: 'geometric',
    weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.52, defaultTracking: 0,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Rounded humanist sans. Warm and readable." },
  outfit: { id: 'outfit', family: "Outfit", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'outfit', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Contemporary geometric sans. Crisp and current." },
  urbanist: { id: 'urbanist', family: "Urbanist", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'urbanist', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Low-contrast geometric sans. Modern and calm." },
  sora: { id: 'sora', family: "Sora", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'sora', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Technical geometric sans. Startup-brand feel." },
  lexend: { id: 'lexend', family: "Lexend", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'lexend', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false, opticalScale: 1, advance: 0.52, defaultTracking: 0,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Readability-tuned sans. Open and clear." },
  figtree: { id: 'figtree', family: "Figtree", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'figtree', role: 'geometric',
    weights: [300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Friendly geometric sans. Neutral and warm." },
  plusJakartaSans: { id: 'plusJakartaSans', family: "Plus Jakarta Sans", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'plus-jakarta-sans', role: 'geometric',
    weights: [200, 300, 400, 500, 600, 700, 800], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Contemporary sans with subtle character." },
  redHatDisplay: { id: 'redHatDisplay', family: "Red Hat Display", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'red-hat-display', role: 'geometric',
    weights: [300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Open geometric display sans." },
  epilogue: { id: 'epilogue', family: "Epilogue", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'epilogue', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Variable grotesk with a wide range." },
  leagueSpartan: { id: 'leagueSpartan', family: "League Spartan", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'league-spartan', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Geometric sans with heavy weights. Bold and even." },
  workSans: { id: 'workSans', family: "Work Sans", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'work-sans', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Optimised screen grotesk. A neutral workhorse." },
  publicSans: { id: 'publicSans', family: "Public Sans", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'public-sans', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Plain civic sans. Deliberately unremarkable." },
  barlow: { id: 'barlow', family: "Barlow", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'barlow', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.48, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Slightly rounded grotesk. Low-key and versatile." },
  karla: { id: 'karla', family: "Karla", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'karla', role: 'geometric',
    weights: [200, 300, 400, 500, 600, 700, 800], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Grotesque with quirky details. Friendly and odd." },
  rubik: { id: 'rubik', family: "Rubik", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'rubik', role: 'geometric',
    weights: [300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Rounded-corner sans. Soft but sturdy." },
  mulish: { id: 'mulish', family: "Mulish", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'mulish', role: 'geometric',
    weights: [200, 300, 400, 500, 600, 700, 800, 900, 1000], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Minimalist sans. Clean and unobtrusive." },
  asap: { id: 'asap', family: "Asap", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'asap', role: 'geometric',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Rounded grotesque. Approachable and neutral." },
  cabin: { id: 'cabin', family: "Cabin", fallback: 'Avenir, Helvetica, Arial, sans-serif', pkg: 'cabin', role: 'geometric',
    weights: [400, 500, 600, 700], italic: true, opticalScale: 1, advance: 0.5, defaultTracking: -0.01,
    defaultLeading: 1.05, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Humanist sans with rounded stems." },
  firaCode: { id: 'firaCode', family: "Fira Code", fallback: 'Consolas, Menlo, monospace', pkg: 'fira-code', role: 'mono',
    weights: [300, 400, 500, 600, 700], italic: false, opticalScale: 1, advance: 0.6, defaultTracking: 0,
    defaultLeading: 1.15, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Developer mono with ligatures. Technical and precise." },
  courierPrime: { id: 'courierPrime', family: "Courier Prime", fallback: 'Consolas, Menlo, monospace', pkg: 'courier-prime', role: 'mono',
    weights: [400, 700], italic: true, opticalScale: 1, advance: 0.6, defaultTracking: 0,
    defaultLeading: 1.15, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Screenplay typewriter. Documentary and script-page feel." },
  spaceMono: { id: 'spaceMono', family: "Space Mono", fallback: 'Consolas, Menlo, monospace', pkg: 'space-mono', role: 'mono',
    weights: [400, 700], italic: true, opticalScale: 1, advance: 0.6, defaultTracking: 0,
    defaultLeading: 1.15, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Quirky retro-future mono. Editorial and offbeat." },
  ibmPlexMono: { id: 'ibmPlexMono', family: "IBM Plex Mono", fallback: 'Consolas, Menlo, monospace', pkg: 'ibm-plex-mono', role: 'mono',
    weights: [100, 200, 300, 400, 500, 600, 700], italic: true, opticalScale: 1, advance: 0.6, defaultTracking: 0,
    defaultLeading: 1.15, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Corporate mono with warmth. Engineered and human." },
  jetbrainsMono: { id: 'jetbrainsMono', family: "JetBrains Mono", fallback: 'Consolas, Menlo, monospace', pkg: 'jetbrains-mono', role: 'mono',
    weights: [100, 200, 300, 400, 500, 600, 700, 800], italic: true, opticalScale: 1, advance: 0.6, defaultTracking: 0,
    defaultLeading: 1.15, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Tall-x-height coding mono. Very legible small." },
  robotoMono: { id: 'robotoMono', family: "Roboto Mono", fallback: 'Consolas, Menlo, monospace', pkg: 'roboto-mono', role: 'mono',
    weights: [100, 200, 300, 400, 500, 600, 700], italic: true, opticalScale: 1, advance: 0.6, defaultTracking: 0,
    defaultLeading: 1.15, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Neutral coding mono. Plain and dependable." },
  cutiveMono: { id: 'cutiveMono', family: "Cutive Mono", fallback: 'Consolas, Menlo, monospace', pkg: 'cutive-mono', role: 'mono',
    weights: [400], italic: false, opticalScale: 1, advance: 0.6, defaultTracking: 0,
    defaultLeading: 1.15, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Old typewriter mono. Genuinely vintage." },
  xanhMono: { id: 'xanhMono', family: "Xanh Mono", fallback: 'Consolas, Menlo, monospace', pkg: 'xanh-mono', role: 'mono',
    weights: [400], italic: true, opticalScale: 1, advance: 0.6, defaultTracking: 0,
    defaultLeading: 1.15, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Elegant serif mono. Unusual and literary." },
  dmMono: { id: 'dmMono', family: "DM Mono", fallback: 'Consolas, Menlo, monospace', pkg: 'dm-mono', role: 'mono',
    weights: [300, 400, 500], italic: true, opticalScale: 1, advance: 0.6, defaultTracking: 0,
    defaultLeading: 1.15, overlapTolerance: 0, displayOnly: false, bundled: false,
    vibe: "Clean geometric mono. Modern and quiet." },
  lobster: { id: 'lobster', family: "Lobster", fallback: 'Comic Sans MS, cursive', pkg: 'lobster', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.06, advance: 0.46, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Bold retro script-display. A sign-painter classic." },
  pacifico: { id: 'pacifico', family: "Pacifico", fallback: 'Comic Sans MS, cursive', pkg: 'pacifico', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.14, advance: 0.48, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Surf-shop brush script. Sunny and casual." },
  bangers: { id: 'bangers', family: "Bangers", fallback: 'Comic Sans MS, cursive', pkg: 'bangers', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.02, advance: 0.42, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Comic-book shout. High energy." },
  luckiestGuy: { id: 'luckiestGuy', family: "Luckiest Guy", fallback: 'Comic Sans MS, cursive', pkg: 'luckiest-guy', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Cartoon poster caps. Loud and fun." },
  chewy: { id: 'chewy', family: "Chewy", fallback: 'Comic Sans MS, cursive', pkg: 'chewy', role: 'quirky',
    weights: [400], italic: false, opticalScale: 1.04, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Soft bubbly display. Childlike and warm." },
  fredoka: { id: 'fredoka', family: "Fredoka", fallback: 'Comic Sans MS, cursive', pkg: 'fredoka', role: 'quirky',
    weights: [300, 400, 500, 600, 700], italic: false, opticalScale: 1, advance: 0.52, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Rounded friendly display. Modern and cheerful." },
  grandstander: { id: 'grandstander', family: "Grandstander", fallback: 'Comic Sans MS, cursive', pkg: 'grandstander', role: 'quirky',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Playful rounded display with many weights." },
  baloo2: { id: 'baloo2', family: "Baloo 2", fallback: 'Comic Sans MS, cursive', pkg: 'baloo-2', role: 'quirky',
    weights: [400, 500, 600, 700, 800], italic: false, opticalScale: 1, advance: 0.52, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.04, displayOnly: false, bundled: false,
    vibe: "Heavy rounded display. Bouncy and bold." },
  monoton: { id: 'monoton', family: "Monoton", fallback: 'Impact, sans-serif', pkg: 'monoton', role: 'experimental',
    weights: [400], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: 0.02,
    defaultLeading: 1, overlapTolerance: 0.02, displayOnly: true, bundled: false,
    vibe: "Striped neon-sign display. Retro marquee." },
  megrim: { id: 'megrim', family: "Megrim", fallback: 'Impact, sans-serif', pkg: 'megrim', role: 'experimental',
    weights: [400], italic: false, opticalScale: 1, advance: 0.48, defaultTracking: 0.04,
    defaultLeading: 1, overlapTolerance: 0.02, displayOnly: true, bundled: false,
    vibe: "Thin geometric line display. Architectural and odd." },
  silkscreen: { id: 'silkscreen', family: "Silkscreen", fallback: 'Impact, sans-serif', pkg: 'silkscreen', role: 'experimental',
    weights: [400, 700], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: 0.02,
    defaultLeading: 1, overlapTolerance: 0.02, displayOnly: true, bundled: false,
    vibe: "Pixel bitmap face. Eight-bit and blocky." },
  wallpoet: { id: 'wallpoet', family: "Wallpoet", fallback: 'Impact, sans-serif', pkg: 'wallpoet', role: 'experimental',
    weights: [400], italic: false, opticalScale: 1, advance: 0.5, defaultTracking: 0.02,
    defaultLeading: 1, overlapTolerance: 0.02, displayOnly: true, bundled: false,
    vibe: "Stencil display. Industrial and sprayed." },
  michroma: { id: 'michroma', family: "Michroma", fallback: 'Impact, sans-serif', pkg: 'michroma', role: 'experimental',
    weights: [400], italic: false, opticalScale: 1, advance: 0.62, defaultTracking: 0.04,
    defaultLeading: 1, overlapTolerance: 0.02, displayOnly: true, bundled: false,
    vibe: "Wide squared techno sans. Sci-fi title card." },
  orbitron: { id: 'orbitron', family: "Orbitron", fallback: 'Impact, sans-serif', pkg: 'orbitron', role: 'experimental',
    weights: [400, 500, 600, 700, 800, 900], italic: false, opticalScale: 1, advance: 0.56, defaultTracking: 0.02,
    defaultLeading: 1, overlapTolerance: 0.02, displayOnly: true, bundled: false,
    vibe: "Geometric techno sans. Space-age and squared." },
  syncopate: { id: 'syncopate', family: "Syncopate", fallback: 'Impact, sans-serif', pkg: 'syncopate', role: 'experimental',
    weights: [400, 700], italic: false, opticalScale: 1, advance: 0.6, defaultTracking: 0.08,
    defaultLeading: 1, overlapTolerance: 0.02, displayOnly: true, bundled: false,
    vibe: "Wide-tracked geometric caps. Fashion-tech." },
  rubikMonoOne: { id: 'rubikMonoOne', family: "Rubik Mono One", fallback: 'Impact, sans-serif', pkg: 'rubik-mono-one', role: 'experimental',
    weights: [400], italic: false, opticalScale: 1, advance: 0.6, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.02, displayOnly: true, bundled: false,
    vibe: "Heavy monospaced display. Blocky and immovable." },
  bungeeShade: { id: 'bungeeShade', family: "Bungee Shade", fallback: 'Impact, sans-serif', pkg: 'bungee-shade', role: 'experimental',
    weights: [400], italic: false, opticalScale: 1, advance: 0.52, defaultTracking: 0,
    defaultLeading: 1, overlapTolerance: 0.02, displayOnly: true, bundled: false,
    vibe: "Layered shadow display. Dimensional signage." },} as const satisfies Record<string, FontDef>;

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

/** The faces bundled eagerly. Every preset is built only from these. */
export const CORE_FONT_IDS = FONT_IDS.filter((id) => getFont(id).bundled);

/** Full CSS font-family value including fallbacks. */
export function fontFamilyStack(id: string): string {
  const f = getFont(id);
  return `"${f.family}", ${f.fallback}`;
}

/** Clamp a requested weight to one the face actually ships. */
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

/* ------------------------------------------------------------------ */
/* Pairing                                                             */
/* ------------------------------------------------------------------ */

/**
 * How well two faces work together, 0..1.
 *
 * The rule real designers use is *contrast without conflict*: pair across
 * categories, never within one. Two grotesks fight because they are almost the
 * same and the difference reads as a mistake; two scripts are illegible; a
 * script against a condensed heavy is the move the whole reference set is built
 * on.
 *
 * Used to generate pairings, to validate a user's manual choice, and to keep
 * the AI from returning something that is technically allowed but ugly.
 */
const PAIR_SCORE: Partial<Record<FontRole, Partial<Record<FontRole, number>>>> = {
  script: { heavy: 1, workhorse: 0.95, geometric: 0.9, didone: 0.75, mono: 0.7, serif: 0.35, quirky: 0.2, script: 0 },
  didone: { workhorse: 0.95, geometric: 0.9, mono: 0.8, heavy: 0.7, script: 0.75, quirky: 0.35, serif: 0.3, didone: 0.25 },
  heavy: { script: 1, serif: 0.9, didone: 0.7, workhorse: 0.5, geometric: 0.5, mono: 0.6, quirky: 0.45, heavy: 0.3 },
  serif: { heavy: 0.9, geometric: 0.75, mono: 0.7, workhorse: 0.5, quirky: 0.5, script: 0.35, didone: 0.3, serif: 0.2 },
  workhorse: { script: 0.95, didone: 0.95, heavy: 0.5, serif: 0.5, quirky: 0.6, experimental: 0.7, mono: 0.4, workhorse: 0.15, geometric: 0.2 },
  geometric: { script: 0.9, didone: 0.9, serif: 0.75, experimental: 0.75, quirky: 0.6, heavy: 0.5, mono: 0.45, geometric: 0.15, workhorse: 0.2 },
  mono: { didone: 0.8, script: 0.7, serif: 0.7, heavy: 0.6, geometric: 0.45, workhorse: 0.4, quirky: 0.4, mono: 0.1 },
  quirky: { workhorse: 0.6, geometric: 0.6, serif: 0.5, heavy: 0.45, didone: 0.35, mono: 0.4, script: 0.2, quirky: 0.15 },
  experimental: { workhorse: 0.7, geometric: 0.75, mono: 0.5, serif: 0.4, didone: 0.35, heavy: 0.3, experimental: 0.1 },
};

export function pairingScore(a: string, b: string): number {
  const ra = getFont(a).role;
  const rb = getFont(b).role;
  const forward = PAIR_SCORE[ra]?.[rb];
  const backward = PAIR_SCORE[rb]?.[ra];
  // The relationship is symmetric even where the table is not exhaustive.
  const values = [forward, backward].filter((v): v is number => typeof v === 'number');
  return values.length > 0 ? Math.max(...values) : 0.4;
}

export function isGoodPairing(a: string, b: string): boolean {
  return pairingScore(a, b) >= 0.6;
}

/** Faces that pair well with `id`, best first. */
export function suggestPairings(id: string, limit = 12): FontDef[] {
  return FONT_IDS.map(getFont)
    .filter((f) => f.id !== id)
    .map((f) => ({ font: f, score: pairingScore(id, f.id) }))
    .filter((entry) => entry.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.font);
}

/* ------------------------------------------------------------------ */
/* Grouping for the picker                                             */
/* ------------------------------------------------------------------ */

export const ROLE_LABELS: Record<FontRole, string> = {
  workhorse: 'Workhorse sans',
  geometric: 'Geometric sans',
  heavy: 'Heavy display',
  didone: 'Display serif',
  serif: 'Book serif',
  script: 'Script',
  quirky: 'Handwritten',
  mono: 'Monospace',
  experimental: 'Experimental',
};

export const ROLE_ORDER: FontRole[] = [
  'script',
  'didone',
  'heavy',
  'serif',
  'workhorse',
  'geometric',
  'quirky',
  'mono',
  'experimental',
];
