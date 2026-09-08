// Vercel resolves its output directory against whichever directory the project
// is rooted at, and that setting lives in the dashboard rather than in this
// repo - so a build that only writes apps/web/dist fails the deploy whenever
// the project is rooted at the repo instead of apps/web (and vice versa).
//
// The same ambiguity applies to vercel.json, which Vercel reads from the root
// directory and nowhere else. That is why the routing config is duplicated at
// both the repo root and apps/web: with only the root copy, an apps/web-rooted
// project silently loses the SPA rewrite and every deep link 404s on refresh.
// Mirroring the bundle to <repo>/dist makes both answers correct. Only the
// directory Vercel actually resolves gets uploaded, so this costs build time,
// not deployment size.
import { cpSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(webRoot, 'dist');
const target = resolve(webRoot, '../../dist');

if (!existsSync(source)) {
  console.error(`mirror-dist: nothing at ${source} - did vite build run?`);
  process.exit(1);
}

// A failure here must not fail the build: apps/web/dist is already a valid
// output, and this copy only widens where Vercel is allowed to look for it.
try {
  cpSync(source, target, { recursive: true, force: true });
  console.log(`mirror-dist: ${source} -> ${target}`);
} catch (error) {
  console.warn(`mirror-dist: skipped (${error.message})`);
}
