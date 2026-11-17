import type {
  PublicCase,
  Statement,
  SuspectId,
} from '../../shared/puzzle/types';
import { plainText } from '../../shared/puzzle/wording';

const AGNES_CLUE: Statement = { kind: 'culpritCol', col: 2 };
const PIP_CLUE: Statement = { kind: 'innocent', who: 'agnes' };
const BROCK_CLUE: Statement = { kind: 'ate', who: 'pip', food: 'chili' };
const BISCUIT_CLUE: Statement = {
  kind: 'didNotEat',
  who: 'brock',
  food: 'eggs',
};

/**
 * A tiny hand-made case for first-time players: four people, two useful clues.
 * Agnes says the farter was on the RIGHT, Pip says Agnes is not the farter,
 * so it must be Biscuit.
 */
export const PRACTICE_CASE: PublicCase = {
  id: 'practice',
  number: 0,
  difficulty: 'easy',
  liarMode: false,
  floor: 1,
  teaser: 'Practice lift. Nothing smells yet.',
  menu: ['chili', 'beans', 'eggs'],
  suspects: [
    { id: 'pip', slot: { row: 0, col: 0 } },
    { id: 'agnes', slot: { row: 0, col: 2 } },
    { id: 'brock', slot: { row: 1, col: 0 } },
    { id: 'biscuit', slot: { row: 1, col: 2 } },
  ],
  testimonies: [
    {
      speaker: 'pip',
      statement: PIP_CLUE,
      quote: 'Pip hugs Agnes’s leg. Pip never hugs a farter.',
      plain: plainText(PIP_CLUE),
    },
    {
      speaker: 'agnes',
      statement: AGNES_CLUE,
      quote: 'Oh, dear. The smell came from the right side.',
      plain: plainText(AGNES_CLUE),
    },
    {
      speaker: 'brock',
      statement: BROCK_CLUE,
      quote: 'Bro. Pip had chili for lunch. Little dude loves chili.',
      plain: plainText(BROCK_CLUE),
    },
    {
      speaker: 'biscuit',
      statement: BISCUIT_CLUE,
      quote: 'Biscuit sniffs Brock and loses interest. No eggs there.',
      plain: plainText(BISCUIT_CLUE),
    },
  ],
};

export const PRACTICE_CULPRIT: SuspectId = 'biscuit';

export type CoachStep = { text: string; target: SuspectId | null };

/** The coach's next instruction, based on what the player has done so far. */
export function coachStep(
  read: ReadonlySet<SuspectId>,
  crossed: ReadonlySet<SuspectId>
): CoachStep {
  if (!read.has('agnes')) {
    return { text: 'Tap AGNES. She has a clue.', target: 'agnes' };
  }
  if (!crossed.has('pip')) {
    return {
      text: 'Agnes says the farter was on the RIGHT. Pip is on the LEFT, so Pip is NOT the farter. Tap PIP, then tap MARK INNOCENT.',
      target: 'pip',
    };
  }
  if (!crossed.has('brock')) {
    return {
      text: 'Brock is on the LEFT too. Tap BROCK, then tap MARK INNOCENT.',
      target: 'brock',
    };
  }
  if (!read.has('pip')) {
    return { text: 'Now tap PIP to read Pip’s clue.', target: 'pip' };
  }
  if (!crossed.has('agnes')) {
    return {
      text: 'Pip’s clue says AGNES is NOT the farter. Tap AGNES, then tap MARK INNOCENT.',
      target: 'agnes',
    };
  }
  return {
    text: 'Only BISCUIT is left. Tap GUESS THE FARTER and pick Biscuit.',
    target: null,
  };
}
