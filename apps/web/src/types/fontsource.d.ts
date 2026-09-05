/**
 * Ambient types for @fontsource stylesheet subpaths.
 *
 * Every @fontsource package exports `"./*": "./*.css"`, so the correct import
 * is `@fontsource/x/latin` rather than `@fontsource/x/latin.css` - appending
 * the extension resolves to `latin.css.css` and breaks the production build.
 *
 * TypeScript has no types for those subpaths, and they are pure side-effect
 * imports, so declaring them as untyped modules is exactly right.
 */
declare module '@fontsource/*';
