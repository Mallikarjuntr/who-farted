import { telemetry } from '@devvit/analytics/client/reddit';

/**
 * Devvit Journeys: one journey per real case. Events fire only on real,
 * finished actions (a tap that completed), never on page views, and carry no
 * personal data. Analytics must never break the game, so every call is
 * fire-and-forget.
 */
function quietly(run: () => Promise<unknown>): void {
  run().catch((err: unknown) => console.debug('analytics skipped', err));
}

let started = false;

/** The game finished loading and can be played. */
export function trackReady(): void {
  quietly(() => telemetry.appReady());
}

/** The player made their first real move (tapped a suspect). */
export function trackStart(): void {
  if (started) {
    return;
  }
  started = true;
  quietly(() => telemetry.startJourney());
}

/** A new clue was read: progress is the share of clues read so far. */
export function trackClue(read: number, total: number): void {
  quietly(() =>
    telemetry.progress({
      progress: Math.min(1, Math.max(0, total ? read / total : 0)),
      action: 'clue_read',
    })
  );
}

export type GameAction =
  | 'mark_innocent'
  | 'prove_it_blocked'
  | 'hint'
  | 'open_rules'
  | 'open_guess'
  | 'post_verdict';

export function trackAction(action: GameAction): void {
  quietly(() => telemetry.interaction({ action }));
}

/** The one guess was made. Score rewards solving fast with fewer clues. */
export function trackEnd(
  win: boolean,
  seconds: number,
  cluesRead: number
): void {
  const score = win ? Math.max(1, 1000 - seconds - cluesRead * 20) : 0;
  quietly(() => telemetry.endJourney({ complete: true, game: { win, score } }));
  started = false;
}
