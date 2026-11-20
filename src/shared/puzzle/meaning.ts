import type {
  FoodId,
  PlacedSuspect,
  Slot,
  Statement,
  SuspectId,
} from './types.ts';
import { CAST, FOODS, atSlot } from './cast.ts';

/**
 * What a clue means, one step further than the clue itself, so nobody has
 * to read it twice: "So: the farter is one of these." plus their faces.
 */
export type SoLine = {
  text: string;
  /** People to show as little faces after the text. */
  people: SuspectId[];
  /**
   * "suspect" = only these could be the farter (so everyone else is
   * innocent), "innocent" = this clue clears them.
   */
  tone: 'suspect' | 'innocent' | null;
};

const name = (id: SuspectId): string => CAST[id].name;
const tag = (food: FoodId): string => FOODS[food].tag;

function slotOf(
  suspects: readonly PlacedSuspect[],
  id: SuspectId
): Slot | null {
  return suspects.find((s) => s.id === id)?.slot ?? null;
}

/** Who stands where a place clue points, or null for clues about lunches. */
function placeMatch(
  s: Statement,
  suspects: readonly PlacedSuspect[]
): { fits: SuspectId[]; tone: 'suspect' | 'innocent' } | null {
  const where = (test: (slot: Slot) => boolean): SuspectId[] =>
    suspects.filter((p) => test(p.slot)).map((p) => p.id);
  switch (s.kind) {
    case 'culpritRow':
      return { fits: where((p) => p.row === s.row), tone: 'suspect' };
    case 'culpritCol':
      return { fits: where((p) => p.col === s.col), tone: 'suspect' };
    case 'culpritNotCol':
      return { fits: where((p) => p.col === s.col), tone: 'innocent' };
    case 'culpritNextTo':
    case 'culpritNotNextTo': {
      const o = slotOf(suspects, s.other);
      if (!o) {
        return null;
      }
      return {
        fits: where((p) => p.row === o.row && Math.abs(p.col - o.col) === 1),
        tone: s.kind === 'culpritNextTo' ? 'suspect' : 'innocent',
      };
    }
    case 'culpritSameColumnAs': {
      const o = slotOf(suspects, s.other);
      return o
        ? {
            fits: where((p) => p.col === o.col && p.row !== o.row),
            tone: 'suspect',
          }
        : null;
    }
    default:
      return null;
  }
}

function core(s: Statement, suspects: readonly PlacedSuspect[]): SoLine {
  const place = placeMatch(s, suspects);
  if (place) {
    const n = place.fits.length;
    if (place.tone === 'suspect') {
      return n === 0
        ? {
            text: 'nobody stood there. This clue can’t be true!',
            people: [],
            tone: null,
          }
        : {
            text:
              n === 1
                ? 'only this person could be the farter:'
                : 'only these people could be the farter:',
            people: place.fits,
            tone: 'suspect',
          };
    }
    return n === 0
      ? {
          text: 'nobody stood there, so this clue clears nobody yet.',
          people: [],
          tone: null,
        }
      : {
          text:
            n === 1 ? 'this person is innocent:' : 'these people are innocent:',
          people: place.fits,
          tone: 'innocent',
        };
  }
  switch (s.kind) {
    case 'innocent':
      return {
        text: 'this person is innocent:',
        people: [s.who],
        tone: 'innocent',
      };
    case 'culpritAte':
      return {
        text: `anyone who did NOT eat ${tag(s.food)} is innocent.`,
        people: [],
        tone: null,
      };
    case 'culpritDidNotEat':
      return {
        text: `anyone who ate ${tag(s.food)} is innocent.`,
        people: [],
        tone: null,
      };
    case 'ate':
      return {
        text: `${name(s.who)} is innocent if the farter did NOT eat ${tag(s.food)}.`,
        people: [],
        tone: null,
      };
    case 'didNotEat':
      return {
        text: `${name(s.who)} is innocent if the farter ate ${tag(s.food)}.`,
        people: [],
        tone: null,
      };
    case 'sameMeal':
      return {
        text: `whatever ${name(s.a)} ate, ${name(s.b)} ate too.`,
        people: [],
        tone: null,
      };
    case 'foodCount':
      return {
        text:
          s.count === 0
            ? `the farter did NOT eat ${tag(s.food)} either.`
            : s.count === 1
              ? `when you know who ate ${tag(s.food)}, everyone else did NOT eat it.`
              : `when you know the ${s.count} people who ate ${tag(s.food)}, everyone else did NOT eat it.`,
        people: [],
        tone: null,
      };
    default:
      return { text: '', people: [], tone: null };
  }
}

/**
 * The "So:" line under a clue. On weekends any clue might be the farter's
 * lie, so the line says "if … tells the truth".
 */
export function soLine(
  speaker: SuspectId,
  s: Statement,
  suspects: readonly PlacedSuspect[],
  liarMode: boolean
): SoLine {
  const line = core(s, suspects);
  const text = liarMode
    ? `If ${name(speaker)} tells the truth, ${line.text}`
    : line.text.charAt(0).toUpperCase() + line.text.slice(1);
  return { ...line, text };
}

/** Is this a clue about where the farter stood? */
export function isPlaceClue(s: Statement): boolean {
  return (
    s.kind === 'culpritRow' ||
    s.kind === 'culpritCol' ||
    s.kind === 'culpritNotCol' ||
    s.kind === 'culpritNextTo' ||
    s.kind === 'culpritNotNextTo' ||
    s.kind === 'culpritSameColumnAs'
  );
}

/** "Brock stood at the BACK, by the MIRROR." */
export function stoodAt(
  suspects: readonly PlacedSuspect[],
  id: SuspectId
): string {
  const slot = slotOf(suspects, id);
  return slot ? `${name(id)} stood ${atSlot(slot)}.` : '';
}
