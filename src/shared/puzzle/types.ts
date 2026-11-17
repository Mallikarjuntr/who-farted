export type SuspectId =
  'agnes' | 'brock' | 'pip' | 'biscuit' | 'linda' | 'marcel';

export type FoodId =
  'chili' | 'beans' | 'cabbage' | 'eggs' | 'broccoli' | 'onions';

/** 0 = back wall, 1 = front row by the doors. */
export type Row = 0 | 1;

/** Columns as the player sees the lift: 0 = left, 1 = middle, 2 = right. */
export type Col = 0 | 1 | 2;

export type Slot = { row: Row; col: Col };

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Voice = 'verbal' | 'toddler' | 'dog' | 'mime';

/**
 * Every clue is one of these logical statements. "Culprit" statements
 * constrain who did it; the rest are facts about lunches that players chain.
 */
export type Statement =
  | { kind: 'culpritRow'; row: Row }
  | { kind: 'culpritCol'; col: Col }
  | { kind: 'culpritNotCol'; col: Col }
  | { kind: 'culpritNextTo'; other: SuspectId }
  | { kind: 'culpritNotNextTo'; other: SuspectId }
  | { kind: 'culpritSameColumnAs'; other: SuspectId }
  | { kind: 'culpritAte'; food: FoodId }
  | { kind: 'culpritDidNotEat'; food: FoodId }
  | { kind: 'innocent'; who: SuspectId }
  | { kind: 'ate'; who: SuspectId; food: FoodId }
  | { kind: 'didNotEat'; who: SuspectId; food: FoodId }
  | { kind: 'sameMeal'; a: SuspectId; b: SuspectId }
  | { kind: 'foodCount'; food: FoodId; count: number };

export type StatementKind = Statement['kind'];

export type Testimony = {
  speaker: SuspectId;
  statement: Statement;
  /** What the character says or does, in their own voice. */
  quote: string;
  /** The exact logical meaning, in plain words, so every clue is fair. */
  plain: string;
};

export type PlacedSuspect = { id: SuspectId; slot: Slot };

export type CaseSolution = {
  culprit: SuspectId;
  lunches: { id: SuspectId; food: FoodId }[];
};

export type CaseStats = {
  /** Fewest testimonies that together prove the culprit. */
  minClues: number;
  /** True when lunch facts must be chained to solve it. */
  needsFacts: boolean;
};

export type CaseFile = {
  /** The case's date, YYYY-MM-DD (UTC). */
  id: string;
  number: number;
  difficulty: Difficulty;
  /** On hard days the culprit lies and everyone else tells the truth. */
  liarMode: boolean;
  floor: number;
  teaser: string;
  /** The lunches in play today; every suspect ate exactly one of these. */
  menu: FoodId[];
  /** Testimony i is spoken by suspect i. */
  suspects: PlacedSuspect[];
  testimonies: Testimony[];
  solution: CaseSolution;
  stats: CaseStats;
};

/** What the client is allowed to see before the player accuses. */
export type PublicCase = Omit<CaseFile, 'solution' | 'stats'>;
