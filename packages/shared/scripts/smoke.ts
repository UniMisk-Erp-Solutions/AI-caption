import { artDirectionSchema, autoDesign, groupIntoScenes, getPreset, type TranscriptWord } from '../src/index';

const phrase = "a holiday in my life as a girl in New York city and these are the things that helped me grow";
const words: TranscriptWord[] = phrase.split(' ').map((t, i) => ({
  id: `w${i + 1}`, text: t, startMs: i * 380, endMs: i * 380 + 340,
}));

for (const preset of ['SCRIPT_EDITORIAL', 'STACKED_HEAVY', 'OLD_MONEY'] as const) {
  const dir = artDirectionSchema.parse({ preset });
  const scenes = autoDesign(words, dir, { width: 1080, height: 1920 }, groupIntoScenes(words, { targetWords: getPreset(preset).sceneWordTarget }));
  console.log(`\n===== ${preset} — ${scenes.length} scenes =====`);
  for (const s of scenes.slice(0, 3)) {
    console.log(`  [${s.compositionId}]  ${s.startMs}-${s.endMs}ms`);
    for (const l of s.layers) {
      const runs = l.runs.map(r => `${r.text}<${r.fontId} ${r.sizeScale.toFixed(2)}x${r.emphasis === 'hero' ? ' HERO' : ''}>`).join('  ');
      console.log(`     x=${l.x.toFixed(2)} y=${l.y.toFixed(2)} sz=${(l.fontSize*1920).toFixed(0)}px al=${l.textAlign} ${l.enterAnimation}`);
      console.log(`       ${runs}`);
    }
  }
}
