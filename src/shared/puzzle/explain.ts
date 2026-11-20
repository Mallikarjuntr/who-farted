import type { PublicCase, Statement, SuspectId } from './types.ts';
import { analyzeCase, possibleCulpritIndexes } from './solver.ts';
import { must } from './rng.ts';

export type ExplainStep = {
  speaker: SuspectId;
  statement: Statement;
  plain: string;
  /** People this clue rules out, on top of the clues before it. Empty = "remember this". */
  ruledOut: SuspectId[];
};

function bitCount(n: number): number {
  let count = 0;
  let rest = n;
  while (rest) {
    rest &= rest - 1;
    count++;
  }
  return count;
}

/**
 * The shortest set of clues that proves the culprit, put in the order a person
 * would use them: each step rules out as many people as possible.
 */
export function explainSolution(
  c: PublicCase,
  culprit: SuspectId
): ExplainStep[] {
  const analysis = analyzeCase(c);
  const culpritIndex = c.suspects.findIndex((s) => s.id === culprit);
  const all = (1 << c.testimonies.length) - 1;

  let best = 0;
  for (let subset = 1; subset <= all; subset++) {
    const left = possibleCulpritIndexes(analysis, subset);
    if (
      left.length === 1 &&
      left[0] === culpritIndex &&
      (best === 0 || bitCount(subset) < bitCount(best))
    ) {
      best = subset;
    }
  }
  if (best === 0) {
    return [];
  }

  const steps: ExplainStep[] = [];
  let used = 0;
  let possible = possibleCulpritIndexes(analysis, 0);
  while (used !== best) {
    let pick = -1;
    let pickLeft = possible;
    for (let i = 0; i < c.testimonies.length; i++) {
      const bit = 1 << i;
      if ((best & bit) === 0 || (used & bit) !== 0) {
        continue;
      }
      const left = possibleCulpritIndexes(analysis, used | bit);
      if (pick < 0 || left.length < pickLeft.length) {
        pick = i;
        pickLeft = left;
      }
    }
    const testimony = must(c.testimonies[pick], 'testimony');
    steps.push({
      speaker: testimony.speaker,
      statement: testimony.statement,
      plain: testimony.plain,
      ruledOut: possible
        .filter((i) => !pickLeft.includes(i))
        .map((i) => must(c.suspects[i], 'suspect').id),
    });
    used |= 1 << pick;
    possible = pickLeft;
  }
  return steps;
}
