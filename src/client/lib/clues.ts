import type {
  FoodId,
  PlacedSuspect,
  Slot,
  Statement,
  SuspectId,
} from '../../shared/puzzle/types';
import { CAST, FOODS, atCol, atRow } from '../../shared/puzzle/cast';

export const cellKey = (slot: Slot): string => `${slot.row}-${slot.col}`;

const name = (id: SuspectId): string => CAST[id].name;

/**
 * The lift cells a clue talks about, so the screen can shade them.
 * "maybe" = the farter could be here, "not" = the clue rules this area out.
 */
export type Zone = { cells: Set<string>; tone: 'maybe' | 'not' };

function slotOf(
  suspects: readonly PlacedSuspect[],
  id: SuspectId
): Slot | null {
  return suspects.find((s) => s.id === id)?.slot ?? null;
}

function allCells(): Slot[] {
  const out: Slot[] = [];
  for (const row of [0, 1] satisfies Slot['row'][]) {
    for (const col of [0, 1, 2] satisfies Slot['col'][]) {
      out.push({ row, col });
    }
  }
  return out;
}

function cellsWhere(test: (slot: Slot) => boolean): Set<string> {
  return new Set(allCells().filter(test).map(cellKey));
}

export function zoneFor(
  s: Statement,
  suspects: readonly PlacedSuspect[]
): Zone | null {
  switch (s.kind) {
    case 'culpritRow':
      return { cells: cellsWhere((c) => c.row === s.row), tone: 'maybe' };
    case 'culpritCol':
      return { cells: cellsWhere((c) => c.col === s.col), tone: 'maybe' };
    case 'culpritNotCol':
      return { cells: cellsWhere((c) => c.col === s.col), tone: 'not' };
    case 'culpritNextTo':
    case 'culpritNotNextTo': {
      const o = slotOf(suspects, s.other);
      if (!o) {
        return null;
      }
      return {
        cells: cellsWhere(
          (c) => c.row === o.row && Math.abs(c.col - o.col) === 1
        ),
        tone: s.kind === 'culpritNextTo' ? 'maybe' : 'not',
      };
    }
    case 'culpritSameColumnAs': {
      const o = slotOf(suspects, s.other);
      return o
        ? {
            cells: cellsWhere((c) => c.col === o.col && c.row !== o.row),
            tone: 'maybe',
          }
        : null;
    }
    case 'innocent': {
      const o = slotOf(suspects, s.who);
      return o ? { cells: new Set([cellKey(o)]), tone: 'not' } : null;
    }
    default:
      return null;
  }
}

export type LunchTag = { food: FoodId | null; text: string; negative: boolean };

/** Stickers to show on each suspect for the lunch facts read so far. */
export function lunchTags(
  statements: readonly Statement[]
): Map<SuspectId, LunchTag[]> {
  const tags = new Map<SuspectId, LunchTag[]>();
  const add = (id: SuspectId, tag: LunchTag) => {
    const list = tags.get(id) ?? [];
    if (!list.some((t) => t.text === tag.text)) {
      list.push(tag);
    }
    tags.set(id, list);
  };
  for (const s of statements) {
    if (s.kind === 'ate') {
      add(s.who, { food: s.food, text: FOODS[s.food].tag, negative: false });
    } else if (s.kind === 'didNotEat') {
      add(s.who, {
        food: s.food,
        text: `NO ${FOODS[s.food].tag}`,
        negative: true,
      });
    } else if (s.kind === 'sameMeal') {
      add(s.a, {
        food: null,
        text: `SAME AS ${name(s.b).toUpperCase()}`,
        negative: false,
      });
      add(s.b, {
        food: null,
        text: `SAME AS ${name(s.a).toUpperCase()}`,
        negative: false,
      });
    }
  }
  return tags;
}

/** What the clues read so far say about the farter, as short chips in the lift's own words. */
export function profileChips(statements: readonly Statement[]): string[] {
  const chips: string[] = [];
  for (const s of statements) {
    switch (s.kind) {
      case 'culpritRow':
        chips.push(atRow(s.row));
        break;
      case 'culpritCol':
        chips.push(atCol(s.col));
        break;
      case 'culpritNotCol':
        chips.push(`NOT ${atCol(s.col)}`);
        break;
      case 'culpritNextTo':
        chips.push(`NEXT TO ${name(s.other)}`);
        break;
      case 'culpritNotNextTo':
        chips.push(`NOT next to ${name(s.other)}`);
        break;
      case 'culpritAte':
        chips.push(`ate ${FOODS[s.food].tag}`);
        break;
      case 'culpritDidNotEat':
        chips.push(`did NOT eat ${FOODS[s.food].tag}`);
        break;
      default:
        break;
    }
  }
  return chips;
}

/** Facts about the whole lift ("EXACTLY 2 ate EGGS"). */
export function groupFacts(statements: readonly Statement[]): string[] {
  return statements.flatMap((s) =>
    s.kind === 'foodCount'
      ? [
          s.count === 0
            ? `NOBODY ate ${FOODS[s.food].tag}`
            : `EXACTLY ${s.count} ate ${FOODS[s.food].tag}`,
        ]
      : []
  );
}

export type MeaningPart = {
  text: string;
  food: FoodId | null;
  strong: boolean;
};

const FOOD_BY_TAG = new Map<string, FoodId>(
  Object.values(FOODS).map((f) => [f.tag, f.id])
);
const NAMES = new Set(Object.values(CAST).map((c) => c.name));

/**
 * Splits a meaning line into words so the screen can make the key ones pop:
 * capital words (NOT, MIRROR, BACK), names, and food tags (shown in food colours).
 */
export function meaningParts(plain: string): MeaningPart[] {
  return plain.split(' ').flatMap((word, i, all): MeaningPart[] => {
    const bare = word.replace(/[.,]/g, '');
    const tail = `${word.slice(bare.length)}${i < all.length - 1 ? ' ' : ''}`;
    const food = FOOD_BY_TAG.get(bare) ?? null;
    if (food) {
      // The food chip holds just the word; the full stop stays outside it.
      return [
        { text: bare, food, strong: true },
        { text: tail, food: null, strong: false },
      ];
    }
    const strong =
      NAMES.has(bare) ||
      (bare.length > 1 && bare === bare.toUpperCase() && /[A-Z]/.test(bare));
    return [
      { text: `${word}${i < all.length - 1 ? ' ' : ''}`, food: null, strong },
    ];
  });
}

export const FOOD_COLORS: Record<FoodId, string> = {
  chili: '#FF5A36',
  beans: '#E0954A',
  cabbage: '#9BD36A',
  eggs: '#FFF1B8',
  broccoli: '#4FB061',
  onions: '#F1D49A',
};

const CONFESSIONS: Record<SuspectId, (food: string) => string> = {
  agnes: (f) => `It was ${f}, dear. It’s always ${f}.`,
  brock: (f) => `Bro. Pre-workout plus ${f}. Rookie mistake.`,
  pip: (f) => `Pip giggles. Pip is not sorry. Pip had ${f}.`,
  biscuit: (f) => `Biscuit wags. Somebody fed him ${f} under the table.`,
  linda: (f) => `I will be sending a memo about ${f}. To myself.`,
  marcel: (f) => `Marcel mimes a tiny, silent apology. ${f} was not silent.`,
};

export function confession(id: SuspectId, food: FoodId | null): string {
  const label = food ? FOODS[food].label : 'lunch';
  const text = CONFESSIONS[id](label);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The people a clue names, so they can look nervous while it is on screen. */
export function mentionedIn(s: Statement): SuspectId[] {
  switch (s.kind) {
    case 'culpritNextTo':
    case 'culpritNotNextTo':
    case 'culpritSameColumnAs':
      return [s.other];
    case 'innocent':
    case 'ate':
    case 'didNotEat':
      return [s.who];
    case 'sameMeal':
      return [s.a, s.b];
    default:
      return [];
  }
}
