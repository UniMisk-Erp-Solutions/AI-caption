// Vercel resolves its output directory against whichever directory the project
// is rooted at, and that setting lives in the dashboard rather than in this
// repo. Both vercel.json files now name the real vite output explicitly - the
// repo-root one points at apps/web/dist, the apps/web one at dist - so a
// correct deploy no longer depends on this copy at all.
//
// It is kept as a last safety net for the one case config cannot cover: a
// dashboard Output Directory of "dist" on a repo-rooted project, which would
// otherwise look for a directory vite never writes. Mirroring the bundle to
// <repo>/dist makes that answer correct too. Only the directory Vercel
// actually resolves gets uploaded, so this costs build time, not deploy size.
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
