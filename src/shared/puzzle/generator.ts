import type {
  CaseFile,
  Col,
  Difficulty,
  FoodId,
  PublicCase,
  Row,
  Slot,
  Statement,
  StatementKind,
  SuspectId,
  Voice,
} from './types.ts';
import type { Layout, WorldSpace } from './logic.ts';
import type { Rng } from './rng.ts';
import { CAST, FOOD_IDS, SUSPECT_IDS } from './cast.ts';
import {
  createWorldSpace,
  isFactStatement,
  isNextTo,
  truthVector,
} from './logic.ts';
import { createRng, must } from './rng.ts';
import { analyzeStatements, solveStats } from './solver.ts';
import { TEASERS, plainText, quoteText } from './wording.ts';

/** Case #1 is the first day the game runs. */
export const LAUNCH_DATE = '2026-11-18';

const DAY_MS = 24 * 60 * 60 * 1000;

export function caseNumberFor(date: string): number {
  return (
    Math.round(
      (Date.parse(`${date}T00:00:00Z`) -
        Date.parse(`${LAUNCH_DATE}T00:00:00Z`)) /
        DAY_MS
    ) + 1
  );
}

/** Easy early in the week, a lying culprit at the weekend. */
export function difficultyFor(date: string): Difficulty {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (weekday === 1 || weekday === 2) {
    return 'easy';
  }
  if (weekday === 6 || weekday === 0) {
    return 'hard';
  }
  return 'medium';
}

type Recipe = {
  suspects: number;
  foods: number;
  liarMode: boolean;
  minClues: number;
  maxClues: number;
  needsFacts: boolean;
  allowFoodCount: boolean;
};

const RECIPES: Record<Difficulty, Recipe> = {
  easy: {
    suspects: 4,
    foods: 3,
    liarMode: false,
    minClues: 2,
    maxClues: 3,
    needsFacts: false,
    allowFoodCount: false,
  },
  medium: {
    suspects: 6,
    foods: 3,
    liarMode: false,
    minClues: 3,
    maxClues: 4,
    needsFacts: true,
    allowFoodCount: true,
  },
  hard: {
    suspects: 6,
    foods: 3,
    liarMode: true,
    minClues: 3,
    maxClues: 6,
    needsFacts: false,
    allowFoodCount: true,
  },
};

const VOICE_KINDS: Record<Voice, readonly StatementKind[]> = {
  verbal: [
    'culpritRow',
    'culpritCol',
    'culpritNotCol',
    'culpritNextTo',
    'culpritNotNextTo',
    'culpritAte',
    'culpritDidNotEat',
    'innocent',
    'ate',
    'didNotEat',
    'sameMeal',
    'foodCount',
  ],
  toddler: ['culpritRow', 'culpritCol', 'culpritNotCol', 'innocent'],
  dog: ['ate', 'didNotEat', 'sameMeal', 'culpritAte', 'culpritDidNotEat'],
  mime: [
    'culpritRow',
    'culpritCol',
    'culpritNotCol',
    'culpritNextTo',
    'culpritNotNextTo',
    'innocent',
  ],
};

const ALL_SLOTS: readonly Slot[] = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: 2 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
];

const ROWS: readonly Row[] = [0, 1];
const COLS: readonly Col[] = [0, 1, 2];

/** Every statement anyone could make about this layout (before truth filtering). */
function catalogue(layout: Layout, recipe: Recipe): Statement[] {
  const out: Statement[] = [];
  const { suspects, slots, menu } = layout;
  for (const row of ROWS) {
    out.push({ kind: 'culpritRow', row });
  }
  for (const col of COLS) {
    out.push({ kind: 'culpritCol', col }, { kind: 'culpritNotCol', col });
  }
  suspects.forEach((other, i) => {
    const slot = must(slots[i], 'slot');
    if (slots.some((s) => isNextTo(s, slot))) {
      out.push(
        { kind: 'culpritNextTo', other },
        { kind: 'culpritNotNextTo', other }
      );
    }
    out.push({ kind: 'innocent', who: other });
    for (const food of menu) {
      out.push(
        { kind: 'ate', who: other, food },
        { kind: 'didNotEat', who: other, food }
      );
    }
    suspects.forEach((b, j) => {
      if (j > i) {
        out.push({ kind: 'sameMeal', a: other, b });
      }
    });
  });
  for (const food of menu) {
    out.push({ kind: 'culpritAte', food }, { kind: 'culpritDidNotEat', food });
    if (recipe.allowFoodCount) {
      for (let count = 0; count <= suspects.length; count++) {
        out.push({ kind: 'foodCount', food, count });
      }
    }
  }
  return out;
}

/** Statements that make sense coming from this particular speaker. */
function fitsSpeaker(speaker: SuspectId, s: Statement): boolean {
  if (!VOICE_KINDS[CAST[speaker].voice].includes(s.kind)) {
    return false;
  }
  if (s.kind === 'innocent' && s.who === speaker) {
    return false;
  }
  if (speaker === 'biscuit') {
    if ((s.kind === 'ate' || s.kind === 'didNotEat') && s.who === 'biscuit') {
      return false;
    }
    if (s.kind === 'sameMeal' && (s.a === 'biscuit' || s.b === 'biscuit')) {
      return false;
    }
  }
  if (speaker === 'marcel' && 'other' in s && s.other === 'marcel') {
    return false;
  }
  return true;
}

type Candidate = { statement: Statement; vector: Uint8Array };

function isConstant(vector: Uint8Array): boolean {
  const first = vector[0];
  return vector.every((v) => v === first);
}

type Draft = {
  layout: Layout;
  space: WorldSpace;
  culprit: number;
  lunches: number[];
  options: Candidate[][];
};

function draftWorld(
  rng: Rng,
  recipe: Recipe,
  wanted: SuspectId | null
): Draft | null {
  const others = rng
    .shuffle(SUSPECT_IDS.filter((id) => id !== wanted))
    .slice(0, wanted ? recipe.suspects - 1 : recipe.suspects);
  const suspects = wanted ? rng.shuffle([wanted, ...others]) : others;
  const slots = rng.shuffle(ALL_SLOTS).slice(0, recipe.suspects);
  const menu: FoodId[] = rng.shuffle(FOOD_IDS).slice(0, recipe.foods);
  const layout: Layout = { suspects, slots, menu };
  const space = createWorldSpace(layout);

  const culprit = wanted ? suspects.indexOf(wanted) : rng.int(suspects.length);
  const lunches = suspects.map(() => rng.int(menu.length));
  const culpritLunch = must(lunches[culprit], 'culprit lunch');
  if (
    recipe.suspects > 4 &&
    lunches.filter((l) => l === culpritLunch).length < 2
  ) {
    return null;
  }
  if (new Set(lunches).size < 2) {
    return null;
  }

  let combo = 0;
  lunches.forEach((l, i) => {
    combo += l * space.foodCount ** i;
  });
  const realWorld = culprit * space.lunchCombos + combo;

  const vectors = new Map<string, Candidate>();
  const all = catalogue(layout, recipe);
  for (const statement of all) {
    const vector = truthVector(space, statement);
    if (!isConstant(vector)) {
      vectors.set(JSON.stringify(statement), { statement, vector });
    }
  }

  const options = suspects.map((speaker, i) => {
    const mustBeTrue = !(recipe.liarMode && i === culprit);
    return [...vectors.values()].filter(
      (c) =>
        fitsSpeaker(speaker, c.statement) &&
        (c.vector[realWorld] === 1) === mustBeTrue
    );
  });
  if (options.some((o) => o.length === 0)) {
    return null;
  }
  return { layout, space, culprit, lunches, options };
}

function isVaried(picks: readonly Candidate[]): boolean {
  const keys = new Set(picks.map((p) => JSON.stringify(p.statement)));
  if (keys.size !== picks.length) {
    return false;
  }
  const kinds = picks.map((p) => p.statement.kind);
  const innocents = kinds.filter((k) => k === 'innocent').length;
  const positional = kinds.some((k) =>
    [
      'culpritRow',
      'culpritCol',
      'culpritNotCol',
      'culpritNextTo',
      'culpritNotNextTo',
      'culpritSameColumnAs',
    ].includes(k)
  );
  const foody = picks.some(
    (p) =>
      isFactStatement(p.statement) ||
      p.statement.kind === 'culpritAte' ||
      p.statement.kind === 'culpritDidNotEat'
  );
  return innocents <= 1 && positional && foody;
}

const DRAFT_ATTEMPTS = 400;
const PICKS_PER_DRAFT = 120;

/**
 * Every character is the culprit exactly once in each block of six cases, in a
 * shuffled order, so nobody can be ruled out just for being "never guilty".
 */
export function scheduledCulprit(caseNumber: number): SuspectId {
  const block = Math.floor((caseNumber - 1) / SUSPECT_IDS.length);
  const order = createRng(`who-farted:culprits:${block}`).shuffle(SUSPECT_IDS);
  const index =
    (((caseNumber - 1) % SUSPECT_IDS.length) + SUSPECT_IDS.length) %
    SUSPECT_IDS.length;
  return must(order[index], 'scheduled culprit');
}

/**
 * Teasers go round in a shuffled order, so a title line never repeats until
 * every other one has been used, and never on two days in a row.
 */
export function teaserFor(caseNumber: number): string {
  const size = TEASERS.length;
  const cycleOrder = (cycle: number): string[] => {
    const order = createRng(`who-farted:teasers:${cycle}`).shuffle(TEASERS);
    if (cycle > 0) {
      const previous = cycleOrder(cycle - 1);
      if (order[0] === previous[size - 1]) {
        order.push(must(order.shift(), 'teaser'));
      }
    }
    return order;
  };
  const n = Math.max(caseNumber - 1, 0);
  return must(cycleOrder(Math.floor(n / size))[n % size], 'teaser');
}

export function generateCase(date: string): CaseFile {
  const difficulty = difficultyFor(date);
  const recipe = RECIPES[difficulty];
  const rng = createRng(`who-farted:${date}`);
  const wanted = scheduledCulprit(caseNumberFor(date));

  for (let attempt = 0; attempt < DRAFT_ATTEMPTS; attempt++) {
    // Try hard for the scheduled culprit; fall back to anyone if it can't be done fairly.
    const draft = draftWorld(
      rng,
      recipe,
      attempt < DRAFT_ATTEMPTS - 50 ? wanted : null
    );
    if (!draft) {
      continue;
    }
    for (let p = 0; p < PICKS_PER_DRAFT; p++) {
      const picks = draft.options.map((o) => rng.pick(o));
      if (!isVaried(picks)) {
        continue;
      }
      const statements = picks.map((c) => c.statement);
      const analysis = analyzeStatements(
        draft.space,
        statements,
        recipe.liarMode,
        picks.map((c) => c.vector)
      );
      const stats = solveStats(analysis);
      if (
        stats.culpritIndex !== draft.culprit ||
        stats.minClues < recipe.minClues ||
        stats.minClues > recipe.maxClues ||
        (recipe.needsFacts && !stats.needsFacts)
      ) {
        continue;
      }
      return buildCase(
        date,
        difficulty,
        recipe,
        draft,
        statements,
        stats.minClues,
        stats.needsFacts,
        rng
      );
    }
  }
  throw new Error(`Could not generate a fair case for ${date}`);
}

function buildCase(
  date: string,
  difficulty: Difficulty,
  recipe: Recipe,
  draft: Draft,
  statements: readonly Statement[],
  minClues: number,
  needsFacts: boolean,
  rng: Rng
): CaseFile {
  const { layout } = draft;
  return {
    id: date,
    number: caseNumberFor(date),
    difficulty,
    liarMode: recipe.liarMode,
    floor: 2 + rng.int(38),
    teaser: teaserFor(caseNumberFor(date)),
    menu: [...layout.menu],
    suspects: layout.suspects.map((id, i) => ({
      id,
      slot: must(layout.slots[i], 'slot'),
    })),
    testimonies: statements.map((statement, i) => {
      const speaker = must(layout.suspects[i], 'speaker');
      return {
        speaker,
        statement,
        quote: quoteText(speaker, statement, rng),
        plain: plainText(statement),
      };
    }),
    solution: {
      culprit: must(layout.suspects[draft.culprit], 'culprit'),
      lunches: layout.suspects.map((id, i) => ({
        id,
        food: must(layout.menu[must(draft.lunches[i], 'lunch')], 'food'),
      })),
    },
    stats: { minClues, needsFacts },
  };
}

/** Strip the answer before sending a case to players. */
export function toPublicCase(c: CaseFile): PublicCase {
  return {
    id: c.id,
    number: c.number,
    difficulty: c.difficulty,
    liarMode: c.liarMode,
    floor: c.floor,
    teaser: c.teaser,
    menu: c.menu,
    suspects: c.suspects,
    testimonies: c.testimonies,
  };
}
