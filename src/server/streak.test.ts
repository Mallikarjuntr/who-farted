import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftDate, streakOn } from './core/days.ts';

/** A player's guesses by day: true = right, false = wrong, missing = skipped. */
function history(plays: Record<string, boolean>) {
  return async (date: string) =>
    date in plays ? { correct: plays[date] === true } : null;
}

void test('old cases show the streak from that day, not today', async () => {
  // Lost on the 21st, then right every day from the 22nd to the 25th.
  const plays = history({
    '2026-11-20': true,
    '2026-11-21': false,
    '2026-11-22': true,
    '2026-11-23': true,
    '2026-11-24': true,
    '2026-11-25': true,
  });
  assert.equal(await streakOn('2026-11-20', true, plays), 1);
  assert.equal(await streakOn('2026-11-21', false, plays), 0);
  assert.equal(await streakOn('2026-11-22', true, plays), 1);
  assert.equal(await streakOn('2026-11-24', true, plays), 3);
  assert.equal(await streakOn('2026-11-25', true, plays), 4);
});

void test('a skipped day starts the streak again', async () => {
  const plays = history({ '2026-11-20': true, '2026-11-22': true });
  assert.equal(await streakOn('2026-11-22', true, plays), 1);
});

void test('shiftDate crosses month ends', () => {
  assert.equal(shiftDate('2026-12-01', -1), '2026-11-30');
  assert.equal(shiftDate('2026-11-30', 1), '2026-12-01');
});
