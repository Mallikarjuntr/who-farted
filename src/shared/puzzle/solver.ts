import type { PublicCase, Statement, SuspectId } from './types.ts';
import type { Layout, WorldSpace } from './logic.ts';
import {
  createWorldSpace,
  isFactStatement,
  truthVector,
  worldCulprit,
} from './logic.ts';
import { must } from './rng.ts';

/**
 * For each possible culprit, every distinct pattern of which testimonies would
 * be true. That is all the solver needs to answer any "what do I know now?"
 * question instantly, on the server or in the player's browser.
 */
export type CaseAnalysis = {
  suspects: readonly SuspectId[];
  liarMode: boolean;
  testimonyCount: number;
  masksByCulprit: number[][];
  factTestimonies: number;
};

export function analyzeStatements(
  space: WorldSpace,
  statements: readonly Statement[],
  liarMode: boolean,
  vectors?: readonly Uint8Array[]
): CaseAnalysis {
  const truth = vectors ?? statements.map((s) => truthVector(space, s));
  const seen: Set<number>[] = space.layout.suspects.map(
    () => new Set<number>()
  );
  for (let w = 0; w < space.count; w++) {
    let mask = 0;
    for (let i = 0; i < truth.length; i++) {
      if (must(truth[i], 'truth vector')[w] === 1) {
        mask |= 1 << i;
      }
    }
    must(seen[worldCulprit(space, w)], 'culprit bucket').add(mask);
  }

  let factTestimonies = 0;
  statements.forEach((s, i) => {
    if (isFactStatement(s)) {
      factTestimonies |= 1 << i;
    }
  });

  return {
    suspects: space.layout.suspects,
    liarMode,
    testimonyCount: statements.length,
    masksByCulprit: seen.map((set) => [...set]),
    factTestimonies,
  };
}

export function layoutOf(c: PublicCase): Layout {
  return {
    suspects: c.suspects.map((s) => s.id),
    slots: c.suspects.map((s) => s.slot),
    menu: c.menu,
  };
}

export function analyzeCase(c: PublicCase): CaseAnalysis {
  return analyzeStatements(
    createWorldSpace(layoutOf(c)),
    c.testimonies.map((t) => t.statement),
    c.liarMode
  );
}

/** Testimony i is spoken by suspect i, so a liar's statement is bit i. */
export function possibleCulpritIndexes(
  analysis: CaseAnalysis,
  revealed: number
): number[] {
  const result: number[] = [];
  analysis.masksByCulprit.forEach((masks, culprit) => {
    const ownBit = 1 << culprit;
    const mustBeTrue = analysis.liarMode ? revealed & ~ownBit : revealed;
    const mustBeFalse = analysis.liarMode ? revealed & ownBit : 0;
    if (
      masks.some(
        (m) => (m & mustBeTrue) === mustBeTrue && (m & mustBeFalse) === 0
      )
    ) {
      result.push(culprit);
    }
  });
  return result;
}

export function revealedMask(indexes: readonly number[]): number {
  return indexes.reduce((mask, i) => mask | (1 << i), 0);
}

/** Who could still have done it, given the testimonies read so far. */
export function possibleCulprits(
  analysis: CaseAnalysis,
  revealed: readonly number[]
): SuspectId[] {
  return possibleCulpritIndexes(analysis, revealedMask(revealed)).map((i) =>
    must(analysis.suspects[i], 'suspect')
  );
}

/** A suspect can be crossed out only once the clues read so far prove them innocent. */
export function isProvenInnocent(
  analysis: CaseAnalysis,
  revealed: readonly number[],
  suspect: SuspectId
): boolean {
  return !possibleCulprits(analysis, revealed).includes(suspect);
}

function bitCount(n: number): number {
  let count = 0;
  let rest = n;
  while (rest) {
    rest &= rest - 1;
    count++;
  }
  return count;
}

export type SolveStats = {
  /** The single culprit when all testimonies are read, or null if not unique. */
  culpritIndex: number | null;
  /** Fewest testimonies that pin down one culprit (Infinity if impossible). */
  minClues: number;
  /** True when no set of non-fact testimonies alone is enough. */
  needsFacts: boolean;
  /** True when some single testimony alone names the culprit. */
  singleClueSolves: boolean;
};

export function solveStats(analysis: CaseAnalysis): SolveStats {
  const all = (1 << analysis.testimonyCount) - 1;
  const full = possibleCulpritIndexes(analysis, all);
  const culpritIndex = full.length === 1 ? must(full[0], 'culprit') : null;

  let minClues = Infinity;
  let factFreeSolves = false;
  for (let subset = 1; subset <= all; subset++) {
    const left = possibleCulpritIndexes(analysis, subset);
    if (left.length !== 1) {
      continue;
    }
    minClues = Math.min(minClues, bitCount(subset));
    if ((subset & analysis.factTestimonies) === 0) {
      factFreeSolves = true;
    }
  }

  return {
    culpritIndex,
    minClues,
    needsFacts: !factFreeSolves,
    singleClueSolves: minClues === 1,
  };
}
