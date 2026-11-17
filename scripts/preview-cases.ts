// Prints upcoming cases so a human can read every clue before it goes live.
// Usage: npm run preview:cases -- 2026-11-18 14
import { CAST, FOODS } from '../src/shared/puzzle/cast.ts';
import { generateCase } from '../src/shared/puzzle/generator.ts';

const start = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const days = Number(process.argv[3] ?? '7');

const grid = (c: ReturnType<typeof generateCase>): string => {
  const rows = [0, 1].map((row) =>
    [0, 1, 2]
      .map((col) => {
        const s = c.suspects.find(
          (p) => p.slot.row === row && p.slot.col === col
        );
        return (s ? CAST[s.id].name : '·').padEnd(9);
      })
      .join('')
  );
  return `      BACK\n      ${rows[0]}\n      ${rows[1]}\n      DOORS`;
};

for (let d = 0; d < days; d++) {
  const date = new Date(Date.parse(`${start}T00:00:00Z`) + d * 86400000)
    .toISOString()
    .slice(0, 10);
  const t0 = performance.now();
  const c = generateCase(date);
  const ms = Math.round(performance.now() - t0);
  console.log(
    `\n══ Case #${c.number} · ${date} · ${c.difficulty}${c.liarMode ? ' (culprit lies)' : ''} · floor ${c.floor} · ${ms}ms`
  );
  console.log(`   "${c.teaser}"`);
  console.log(`   Menu: ${c.menu.map((f) => FOODS[f].label).join(', ')}`);
  console.log(grid(c));
  c.testimonies.forEach((t, i) => {
    console.log(`   ${i + 1}. ${CAST[t.speaker].name}: ${t.quote}`);
    console.log(`      → ${t.plain}`);
  });
  console.log(
    `   ANSWER: ${CAST[c.solution.culprit].name} · lunches: ${c.solution.lunches
      .map((l) => `${CAST[l.id].name}=${FOODS[l.food].short}`)
      .join(
        ', '
      )} · min clues ${c.stats.minClues}${c.stats.needsFacts ? ' · needs lunch facts' : ''}`
  );
}
