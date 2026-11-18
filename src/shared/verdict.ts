import type { AccuseResult } from './api.ts';

export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export type Verdict = { title: string; line: string; footer: string };

/**
 * The spoiler-free verdict a player can share. The game shows it as a
 * preview and the server posts the same words as a comment.
 */
export function verdictFor(
  caseNumber: number,
  suspectCount: number,
  result: Pick<
    AccuseResult,
    'correct' | 'seconds' | 'cluesRead' | 'hints' | 'streak'
  >
): Verdict {
  let line: string;
  if (result.correct) {
    const parts = [
      `Cracked it in ${clock(result.seconds)}`,
      `${result.cluesRead}/${suspectCount} clues`,
    ];
    if (result.hints > 0) {
      parts.push(plural(result.hints, 'hint'));
    }
    if (result.streak && result.streak.current > 0) {
      parts.push(`streak ${plural(result.streak.current, 'day')}`);
    }
    line = parts.join(' · ');
  } else {
    line = `The farter got away from me this time (${clock(result.seconds)}). Back tomorrow!`;
  }
  return {
    title: `Who Farted? Case #${caseNumber}`,
    line,
    footer: 'No spoilers. Can you find the farter?',
  };
}
