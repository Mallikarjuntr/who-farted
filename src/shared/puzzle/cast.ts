import type { FoodId, SuspectId, Voice } from './types.ts';

export type Character = {
  id: SuspectId;
  name: string;
  role: string;
  voice: Voice;
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
  agnes: { id: 'agnes', name: 'Agnes', role: 'Grandma', voice: 'verbal' },
  brock: { id: 'brock', name: 'Brock', role: 'Gym bro', voice: 'verbal' },
  pip: { id: 'pip', name: 'Pip', role: 'Toddler', voice: 'toddler' },
  biscuit: { id: 'biscuit', name: 'Biscuit', role: 'Good boy', voice: 'dog' },
  linda: {
    id: 'linda',
    name: 'Linda',
    role: 'Office manager',
    voice: 'verbal',
  },
  marcel: { id: 'marcel', name: 'Marcel', role: 'Mime', voice: 'mime' },
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

/** These words are printed on the lift itself, so clues can use exactly the same words. */
export const ROW_WORDS = ['back', 'front'];
export const COL_WORDS = ['left', 'middle', 'right'];
export const ROW_LABELS = ['BACK', 'FRONT'];
export const COL_LABELS = ['LEFT', 'MIDDLE', 'RIGHT'];
