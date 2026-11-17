import type {
  FoodId,
  PlacedSuspect,
  Slot,
  Statement,
  SuspectId,
} from '../../shared/puzzle/types';
import { CAST, COL_WORDS, FOODS, ROW_WORDS } from '../../shared/puzzle/cast';

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
      add(s.who, { food: s.food, text: FOODS[s.food].short, negative: false });
    } else if (s.kind === 'didNotEat') {
      add(s.who, {
        food: s.food,
        text: `no ${FOODS[s.food].short}`,
        negative: true,
      });
    } else if (s.kind === 'sameMeal') {
      add(s.a, { food: null, text: `= ${name(s.b)}`, negative: false });
      add(s.b, { food: null, text: `= ${name(s.a)}`, negative: false });
    }
  }
  return tags;
}

/** What the clues read so far say about the farter, as short chips. */
export function profileChips(statements: readonly Statement[]): string[] {
  const chips: string[] = [];
  for (const s of statements) {
    switch (s.kind) {
      case 'culpritRow':
        chips.push(`${ROW_WORDS[s.row]} row`);
        break;
      case 'culpritCol':
        chips.push(s.col === 1 ? 'in the middle' : `${COL_WORDS[s.col]} side`);
        break;
      case 'culpritNotCol':
        chips.push(
          s.col === 1 ? 'not in the middle' : `not ${COL_WORDS[s.col]} side`
        );
        break;
      case 'culpritNextTo':
        chips.push(`beside ${name(s.other)}`);
        break;
      case 'culpritNotNextTo':
        chips.push(`not beside ${name(s.other)}`);
        break;
      case 'culpritSameColumnAs':
        chips.push(`in line with ${name(s.other)}`);
        break;
      case 'culpritAte':
        chips.push(`ate ${FOODS[s.food].label}`);
        break;
      case 'culpritDidNotEat':
        chips.push(`no ${FOODS[s.food].short}`);
        break;
      default:
        break;
    }
  }
  return chips;
}

/** Facts about the whole lift ("exactly 2 people ate eggs"). */
export function groupFacts(statements: readonly Statement[]): string[] {
  return statements.flatMap((s) =>
    s.kind === 'foodCount'
      ? [
          s.count === 0
            ? `nobody ate ${FOODS[s.food].label}`
            : `${s.count} ate ${FOODS[s.food].label}`,
        ]
      : []
  );
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
