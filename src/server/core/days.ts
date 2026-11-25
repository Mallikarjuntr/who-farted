/** Date and streak helpers with no Reddit or Redis imports, so they are easy to test. */

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

/**
 * The streak a player had right after guessing on `date`: 0 after a wrong
 * guess, otherwise 1 plus every right guess on the days just before it.
 */
export async function streakOn(
  date: string,
  correct: boolean,
  playOn: (date: string) => Promise<{ correct: boolean } | null>
): Promise<number> {
  if (!correct) {
    return 0;
  }
  let days = 1;
  let day = shiftDate(date, -1);
  // A year is far more than the game has existed; it just stops a runaway loop.
  while (days < 366) {
    const play = await playOn(day);
    if (!play?.correct) {
      break;
    }
    days += 1;
    day = shiftDate(day, -1);
  }
  return days;
}
