import type { FoodId, PublicCase, SuspectId } from './puzzle/types.ts';

export type BlameRow = { id: SuspectId; count: number };

export type Streak = { current: number; best: number };

export type AccuseResult = {
  correct: boolean;
  guessed: SuspectId;
  culprit: SuspectId;
  lunches: { id: SuspectId; food: FoodId }[];
  seconds: number;
  cluesRead: number;
  hints: number;
  /** Live tally of who everyone accused, biggest first. */
  blame: BlameRow[];
  totalPlayers: number;
  streak: Streak | null;
};

/** One line about yesterday's case, for the feed card. */
export type YesterdaySummary = {
  number: number;
  culprit: SuspectId;
  topBlamed: SuspectId;
  topBlamedPct: number;
  correctPct: number;
  totalPlayers: number;
};

export type CaseResponse = {
  type: 'case';
  case: PublicCase;
  username: string | null;
  /** Present once this player has accused someone in this case. */
  result: AccuseResult | null;
  streak: Streak | null;
  yesterday: YesterdaySummary | null;
  playersSoFar: number;
};

export type AccuseRequest = {
  suspect: SuspectId;
  seconds: number;
  cluesRead: number;
  hints: number;
};

export type AccuseResponse = { type: 'accuse'; result: AccuseResult };

export type ErrorResponse = { type: 'error'; message: string };
