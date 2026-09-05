/**
 * Score a design.json produced by the harness.
 *
 * Geometry-free metrics only - the pixel checks need frame maps, which the
 * browser produces. Run `pnpm --filter @kc/shared exec tsx scripts/score.ts <file>`.
 */
import { readFileSync } from 'node:fs';
import { editorStateSchema, formatScorecard, scoreDesign } from '../src/index';

const file = process.argv[2] ?? '../../design.json';
const state = editorStateSchema.parse(JSON.parse(readFileSync(file, 'utf-8')));

console.log(`\n=== ${file} ===`);
console.log(formatScorecard(scoreDesign({ state })));
