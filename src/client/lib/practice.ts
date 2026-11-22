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
 * Agnes says the farter stood by the MIRROR, Pip says Agnes is not the farter,
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
      quote: 'Pip hugs Agnes. Pip never hugs a farter.',
      plain: plainText(PIP_CLUE),
    },
    {
      speaker: 'agnes',
      statement: AGNES_CLUE,
      quote: 'Oh dear! The farter stood by the MIRROR.',
      plain: plainText(AGNES_CLUE),
    },
    {
      speaker: 'brock',
      statement: BROCK_CLUE,
      quote: 'Bro! Pip ate CHILI.',
      plain: plainText(BROCK_CLUE),
    },
    {
      speaker: 'biscuit',
      statement: BISCUIT_CLUE,
      quote: 'Biscuit sniffs Brock. No eggs smell.',
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
    return { text: 'Tap AGNES to hear her clue.', target: 'agnes' };
  }
  if (!crossed.has('pip')) {
    return {
      text: 'Agnes says the farter stood by the MIRROR. Pip stands by the BUTTONS, so Pip is innocent. Tap PIP, then tap MARK INNOCENT.',
      target: 'pip',
    };
  }
  if (!crossed.has('brock')) {
    return {
      text: 'Brock stands by the BUTTONS too, so he is innocent. Tap BROCK, then tap MARK INNOCENT.',
      target: 'brock',
    };
  }
  if (!read.has('pip')) {
    return { text: 'Now tap PIP to read Pip’s clue.', target: 'pip' };
  }
  if (!crossed.has('agnes')) {
    return {
      text: 'Pip hugged AGNES, so Agnes is innocent. Tap AGNES, then tap MARK INNOCENT.',
      target: 'agnes',
    };
  }
  return {
    text: 'Only BISCUIT is left, so Biscuit did it! Tap GUESS THE FARTER and pick Biscuit.',
    target: null,
  };
}
