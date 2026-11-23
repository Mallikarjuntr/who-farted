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
  /** True only in the private playtest subreddit. */
  testMode: boolean;
  /** True once this player has posted their verdict comment on this case. */
  commented: boolean;
  /** The subreddit the game is played in, for the join button. */
  subredditName: string | null;
  /** True once this player has made a guess on any day, so the intro can be skipped. */
  returning: boolean;
};

export type AccuseRequest = {
  suspect: SuspectId;
  /** Test mode only: which day's case is being accused. */
  date?: string;
  seconds: number;
  cluesRead: number;
  hints: number;
};

export type AccuseResponse = { type: 'accuse'; result: AccuseResult };

export type CommentResponse = { type: 'comment'; alreadyPosted: boolean };

export type ResetResponse = { type: 'reset' };

export type JoinResponse = { type: 'join' };

/** The player's Reddit avatar (snoovatar), when they have one. */
export type AvatarResponse = {
  type: 'avatar';
  username: string | null;
  url: string | null;
};

export type ErrorResponse = { type: 'error'; message: string };
