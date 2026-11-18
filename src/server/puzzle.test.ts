import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CaseFile } from '../shared/puzzle/types.ts';
import { createWorldSpace, evaluate } from '../shared/puzzle/logic.ts';
import { explainSolution } from '../shared/puzzle/explain.ts';
import {
  LAUNCH_DATE,
  caseNumberFor,
  difficultyFor,
  generateCase,
  teaserFor,
  toPublicCase,
} from '../shared/puzzle/generator.ts';
import { TEASERS } from '../shared/puzzle/wording.ts';
import {
  analyzeCase,
  isProvenInnocent,
  layoutOf,
  possibleCulprits,
} from '../shared/puzzle/solver.ts';

const DAYS = 90;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

const cases: CaseFile[] = [];
for (let d = 0; d < DAYS; d++) {
  cases.push(generateCase(addDays(LAUNCH_DATE, d)));
}

void test('case numbers and weekly difficulty', () => {
  assert.equal(caseNumberFor(LAUNCH_DATE), 1);
  assert.equal(caseNumberFor(addDays(LAUNCH_DATE, 9)), 10);
  assert.equal(difficultyFor('2026-11-23'), 'easy'); // Monday
  assert.equal(difficultyFor('2026-11-25'), 'medium'); // Wednesday
  assert.equal(difficultyFor('2026-11-29'), 'hard'); // Sunday
});

void test('the same date always gives the same case', () => {
  assert.deepEqual(generateCase('2026-12-01'), generateCase('2026-12-01'));
  assert.notDeepEqual(
    generateCase('2026-12-01').testimonies,
    generateCase('2026-12-02').testimonies
  );
});

void test('every case has exactly one culprit once all clues are read', () => {
  for (const c of cases) {
    const analysis = analyzeCase(toPublicCase(c));
    const all = c.testimonies.map((_, i) => i);
    assert.deepEqual(
      possibleCulprits(analysis, all),
      [c.solution.culprit],
      `case ${c.id}`
    );
  }
});

void test('no case is solved by a single clue, and difficulty fits the day', () => {
  for (const c of cases) {
    const analysis = analyzeCase(toPublicCase(c));
    c.testimonies.forEach((_, i) => {
      assert.ok(
        possibleCulprits(analysis, [i]).length > 1,
        `case ${c.id} clue ${i} solves alone`
      );
    });
    if (c.difficulty === 'easy') {
      assert.equal(c.suspects.length, 4);
      assert.ok(c.stats.minClues >= 2 && c.stats.minClues <= 3, `easy ${c.id}`);
    } else {
      assert.equal(c.suspects.length, 6);
      assert.ok(c.stats.minClues >= 3, `${c.difficulty} ${c.id}`);
    }
    if (c.difficulty === 'medium') {
      assert.ok(c.stats.minClues <= 4, `medium ${c.id} too long`);
      assert.ok(c.stats.needsFacts, `medium ${c.id} should need lunch facts`);
    }
    assert.equal(c.liarMode, c.difficulty === 'hard');
  }
});

void test('testimonies are true in the hidden world, except the culprit on hard days', () => {
  for (const c of cases) {
    const layout = layoutOf(toPublicCase(c));
    const space = createWorldSpace(layout);
    const culprit = layout.suspects.indexOf(c.solution.culprit);
    let combo = 0;
    c.solution.lunches.forEach((l, i) => {
      combo += layout.menu.indexOf(l.food) * space.foodCount ** i;
    });
    const world = culprit * space.lunchCombos + combo;
    c.testimonies.forEach((t, i) => {
      const lying = c.liarMode && i === culprit;
      assert.equal(
        evaluate(space, world, t.statement),
        !lying,
        `case ${c.id} testimony ${i}`
      );
      assert.equal(t.speaker, layout.suspects[i]);
    });
  }
});

void test('nobody can be crossed out before any clue is read', () => {
  for (const c of cases.slice(0, 14)) {
    const analysis = analyzeCase(toPublicCase(c));
    for (const s of c.suspects) {
      assert.equal(isProvenInnocent(analysis, [], s.id), false);
    }
    const all = c.testimonies.map((_, i) => i);
    for (const s of c.suspects) {
      assert.equal(
        isProvenInnocent(analysis, all, s.id),
        s.id !== c.solution.culprit
      );
    }
  }
});

void test('every character is the culprit equally often', () => {
  const counts = new Map<string, number>();
  for (const c of cases.slice(0, 60)) {
    counts.set(c.solution.culprit, (counts.get(c.solution.culprit) ?? 0) + 1);
  }
  assert.equal(counts.size, 6);
  for (const [who, n] of counts) {
    assert.ok(n >= 9 && n <= 11, `${who} was the culprit ${n} times`);
  }
});

void test('clue text is complete and never leaks the answer field', () => {
  for (const c of cases) {
    for (const t of c.testimonies) {
      assert.ok(t.quote.length > 10 && t.plain.length > 10);
      assert.notEqual(
        t.statement.kind,
        'culpritSameColumnAs',
        'hard-to-picture clue type is retired'
      );
      assert.ok(
        !/undefined|NaN|\[object/.test(t.quote + t.plain),
        `bad text in ${c.id}: ${t.quote}`
      );
    }
    const pub = toPublicCase(c);
    assert.ok(!('solution' in pub) && !('stats' in pub));
  }
});

void test('the "how to solve it" steps always end with only the culprit left', () => {
  for (const c of cases) {
    const pub = toPublicCase(c);
    const steps = explainSolution(pub, c.solution.culprit);
    assert.ok(steps.length >= 2, `case ${c.id} has too few steps`);
    const ruledOut = new Set(steps.flatMap((s) => s.ruledOut));
    for (const s of c.suspects) {
      assert.equal(
        ruledOut.has(s.id),
        s.id !== c.solution.culprit,
        `case ${c.id} ${s.id}`
      );
    }
  }
});

void test('title teasers use every line before any repeats, and never two days running', () => {
  const size = TEASERS.length;
  for (let start = 1; start <= 200; start += size) {
    const cycle = new Set<string>();
    for (let n = start; n < start + size; n++) {
      cycle.add(teaserFor(n));
    }
    assert.equal(cycle.size, size, `cycle from case ${start} repeats a teaser`);
  }
  for (let n = 1; n < 400; n++) {
    assert.notEqual(teaserFor(n), teaserFor(n + 1), `cases ${n} and ${n + 1}`);
  }
  for (const c of cases) {
    assert.equal(c.teaser, teaserFor(c.number));
  }
});

void test('clue lines stay short and tidy', () => {
  for (const c of cases) {
    for (const t of c.testimonies) {
      assert.ok(t.quote.length <= 120, `too long in ${c.id}: ${t.quote}`);
      assert.ok(
        !/ {2}|\.\.(?!\.)|\bthe the\b/i.test(t.quote),
        `untidy: ${t.quote}`
      );
    }
  }
});
