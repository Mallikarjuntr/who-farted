import type { FoodId, SuspectId, Voice } from './types.ts';

export type Character = {
  id: SuspectId;
  name: string;
  role: string;
  voice: Voice;
  /** How this person gives clues, in short plain words for the intro cards. */
  how: string;
};

export const SUSPECT_IDS: readonly SuspectId[] = [
  'agnes',
  'brock',
  'pip',
  'biscuit',
  'linda',
  'marcel',
];

export const CAST: Record<SuspectId, Character> = {
  agnes: {
    id: 'agnes',
    name: 'Agnes',
    role: 'Grandma',
    voice: 'verbal',
    how: 'Talks. Says what she saw. Starts with “Oh dear!”',
  },
  brock: {
    id: 'brock',
    name: 'Brock',
    role: 'Gym bro',
    voice: 'verbal',
    how: 'Talks. Calls everyone “bro”.',
  },
  pip: {
    id: 'pip',
    name: 'Pip',
    role: 'Toddler',
    voice: 'toddler',
    how: 'Can’t talk yet. Points at the smell. Hugs people who are innocent.',
  },
  biscuit: {
    id: 'biscuit',
    name: 'Biscuit',
    role: 'Dog',
    voice: 'dog',
    how: 'Can’t talk. Sniffs people to find out what they ate.',
  },
  linda: {
    id: 'linda',
    name: 'Linda',
    role: 'Office manager',
    voice: 'verbal',
    how: 'Talks. Writes everything down. Very exact.',
  },
  marcel: {
    id: 'marcel',
    name: 'Marcel',
    role: 'Mime',
    voice: 'mime',
    how: 'Never says a word. Acts out what he saw.',
  },
};

export type Food = {
  id: FoodId;
  /** Used mid-sentence: "ate the chili". */
  label: string;
  /** Used as an adjective: "a chili smell". */
  short: string;
  /** One simple word for stickers and meaning lines: "BEANS". */
  tag: string;
};

export const FOOD_IDS: readonly FoodId[] = [
  'chili',
  'beans',
  'cabbage',
  'eggs',
  'broccoli',
  'onions',
];

export const FOODS: Record<FoodId, Food> = {
  chili: { id: 'chili', label: 'the chili', short: 'chili', tag: 'CHILI' },
  beans: {
    id: 'beans',
    label: 'baked beans',
    short: 'baked bean',
    tag: 'BEANS',
  },
  cabbage: {
    id: 'cabbage',
    label: 'cabbage soup',
    short: 'cabbage',
    tag: 'CABBAGE',
  },
  eggs: { id: 'eggs', label: 'boiled eggs', short: 'egg', tag: 'EGGS' },
  broccoli: {
    id: 'broccoli',
    label: 'broccoli',
    short: 'broccoli',
    tag: 'BROCCOLI',
  },
  onions: { id: 'onions', label: 'onion rings', short: 'onion', tag: 'ONIONS' },
};

/**
 * Places in the lift are named after things you can see in it, never
 * "left" or "right" (the suspects face you, so their right is your left).
 * Column 0 has the button panel, column 2 has the mirror, row 1 is by the
 * doors. These words are printed on the lift, so clues use exactly the same words.
 */
export const ROW_LABELS = ['BACK', 'DOORS'];
export const COL_LABELS = ['BUTTONS', 'MIDDLE', 'MIRROR'];

/** "at the BACK" or "by the DOORS" */
export function atRow(row: number): string {
  return row === 0 ? 'at the BACK' : 'by the DOORS';
}

/** "in the MIDDLE", "by the BUTTONS" or "by the MIRROR" */
export function atCol(col: number): string {
  return col === 1 ? 'in the MIDDLE' : `by the ${COL_LABELS[col] ?? ''}`;
}

/** "at the BACK, by the MIRROR": where someone stood, in the lift's own words. */
export function atSlot(slot: { row: number; col: number }): string {
  return `${atRow(slot.row)}, ${atCol(slot.col)}`;
}
