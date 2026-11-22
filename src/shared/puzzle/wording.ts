import type { FoodId, Statement, SuspectId } from './types.ts';
import type { Rng } from './rng.ts';
import { CAST, FOODS, atCol, atRow } from './cast.ts';

/*
 * Clue wording rules (from player feedback and plain-language research):
 * - One fact per clue, in short, common words. No idioms or sarcasm inside a
 *   clue: players reading English as a second language miss them.
 * - Places use things you can see in the lift (BUTTONS, MIRROR, DOORS),
 *   never left or right, which flip depending on who is looking.
 * - Keep it short: talkers say just their catchphrase and the clue; the
 *   others act it out in one line. Jokes live in teasers and reactions.
 */

const name = (id: SuspectId): string => CAST[id].name;

/** The lunch as one simple, plural-safe word: "beans", "eggs", "chili". */
const dish = (food: FoodId): string => FOODS[food].tag.toLowerCase();
const tag = (s: { food: FoodId }): string => FOODS[s.food].tag;

function people(n: number): string {
  return n === 1 ? 'person' : 'people';
}

/**
 * The exact meaning of a clue in short, simple English. Key words are in
 * capitals and match the labels printed on the lift (MIRROR, BACK, …).
 */
export function plainText(s: Statement): string {
  switch (s.kind) {
    case 'culpritRow':
      return `The farter stood ${atRow(s.row)}.`;
    case 'culpritCol':
      return `The farter stood ${atCol(s.col)}.`;
    case 'culpritNotCol':
      return `The farter did NOT stand ${atCol(s.col)}.`;
    case 'culpritNextTo':
      return `The farter stood right NEXT TO ${name(s.other)}, side by side.`;
    case 'culpritNotNextTo':
      return `The farter did NOT stand next to ${name(s.other)}.`;
    case 'culpritSameColumnAs':
      return `The farter stood right in front of or behind ${name(s.other)}.`;
    case 'culpritAte':
      return `The farter ate ${tag(s)}.`;
    case 'culpritDidNotEat':
      return `The farter did NOT eat ${tag(s)}.`;
    case 'innocent':
      return `${name(s.who)} is NOT the farter.`;
    case 'ate':
      return `${name(s.who)} ate ${tag(s)}.`;
    case 'didNotEat':
      return `${name(s.who)} did NOT eat ${tag(s)}.`;
    case 'sameMeal':
      return `${name(s.a)} and ${name(s.b)} ate the SAME lunch.`;
    case 'foodCount':
      return s.count === 0
        ? `NOBODY ate ${tag(s)}.`
        : `EXACTLY ${s.count} ${people(s.count)} ate ${tag(s)}.`;
  }
}

/** "the BACK" or "the DOORS" */
const rowThing = (r: number): string => (r === 0 ? 'the BACK' : 'the DOORS');
/** "the BUTTONS", "the MIDDLE" or "the MIRROR" */
const colThing = (c: number): string =>
  c === 0 ? 'the BUTTONS' : c === 1 ? 'the MIDDLE' : 'the MIRROR';
/** "near the BUTTONS", "in the MIDDLE" or "near the MIRROR" */
const nearCol = (c: number): string =>
  c === 1 ? 'in the MIDDLE' : `near ${colThing(c)}`;

/** Talkers say the clue itself, after their catchphrase: "Bro! The farter ate BEANS." */
const CATCHPHRASES: Record<'agnes' | 'brock' | 'linda', string> = {
  agnes: 'Oh dear!',
  brock: 'Bro!',
  linda: 'For the record:',
};

export function catchphrase(id: SuspectId): string | null {
  return id === 'agnes' || id === 'brock' || id === 'linda'
    ? CATCHPHRASES[id]
    : null;
}

/* Pip, Biscuit and Marcel can't talk, so they act the clue out in one short line. */

function toddlerAction(s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'culpritRow':
      return rng.pick([
        `Pip points at ${rowThing(s.row)}. “STINKY!”`,
        `Pip hides her face from ${rowThing(s.row)}. “EWWW!”`,
      ]);
    case 'culpritCol':
      return rng.pick([
        `Pip points at ${colThing(s.col)}. “POO-EE!”`,
        `Pip holds her nose ${nearCol(s.col)}. “STINKY!”`,
      ]);
    case 'culpritNotCol':
      return rng.pick([
        `Pip toddles to ${colThing(s.col)}, sniffs and smiles.`,
        `Pip plays happily ${nearCol(s.col)}. No smell.`,
      ]);
    case 'innocent':
      return rng.pick([
        `Pip hugs ${name(s.who)}. Pip never hugs a farter.`,
        `Pip gives ${name(s.who)} a gold star for being good.`,
      ]);
    default:
      return 'Pip giggles.';
  }
}

function dogAction(s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'ate':
      return rng.pick([
        `Biscuit sniffs ${name(s.who)}. Smells of ${dish(s.food)}!`,
        `Biscuit licks ${name(s.who)}’s hand. Tastes of ${dish(s.food)}.`,
      ]);
    case 'didNotEat':
      return `Biscuit sniffs ${name(s.who)}. No ${dish(s.food)} smell.`;
    case 'sameMeal':
      return `Biscuit sniffs ${name(s.a)}, then ${name(s.b)}. Same smell!`;
    case 'culpritAte':
      return rng.pick([
        `Biscuit sniffs the fart. It smells of ${dish(s.food)}.`,
        `Biscuit howls. That fart was ${dish(s.food)}!`,
      ]);
    case 'culpritDidNotEat':
      return `Biscuit sniffs the fart and yawns. Not ${dish(s.food)}.`;
    default:
      return 'Biscuit wags.';
  }
}

function mimeAction(s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'culpritRow':
      return `Marcel points at ${rowThing(s.row)} and holds his nose.`;
    case 'culpritCol':
      return rng.pick([
        `Marcel points at ${colThing(s.col)}, then faints.`,
        `Marcel fans the air ${nearCol(s.col)}, eyes watering.`,
      ]);
    case 'culpritNotCol':
      return rng.pick([
        `Marcel breathes deeply ${nearCol(s.col)} and smiles.`,
        `Marcel smells a pretend flower ${nearCol(s.col)}.`,
      ]);
    case 'culpritNextTo':
      return `Marcel points beside ${name(s.other)} and holds his nose.`;
    case 'culpritNotNextTo':
      return `Marcel sniffs beside ${name(s.other)}. Thumbs up.`;
    case 'culpritSameColumnAs':
      return `Marcel points in front of and behind ${name(s.other)}.`;
    case 'innocent':
      return rng.pick([
        `Marcel draws a halo over ${name(s.who)}.`,
        `Marcel points at ${name(s.who)} and shakes his head: not guilty.`,
      ]);
    default:
      return 'Marcel bows.';
  }
}

/** What the speaker says (or does), in their own voice. */
export function quoteText(speaker: SuspectId, s: Statement, rng: Rng): string {
  switch (CAST[speaker].voice) {
    case 'toddler':
      return toddlerAction(s, rng);
    case 'dog':
      return dogAction(s, rng);
    case 'mime':
      return mimeAction(s, rng);
    case 'verbal':
      return `${catchphrase(speaker) ?? ''} ${plainText(s)}`.trim();
  }
}

/**
 * The line under each case title. They never mention a number of people,
 * because easy days only have four in the lift.
 */
export const TEASERS: readonly string[] = [
  'The doors are stuck. The air is not.',
  'Someone’s lunch is fighting back.',
  'A full lift. One very bad decision.',
  'The music is smooth jazz. The air is not.',
  'Nobody is making eye contact.',
  'Somebody pressed every button. Somebody else did worse.',
  'The lift is slow. The smell is fast.',
  'Everyone is suddenly very interested in the ceiling.',
  'The lift went DING. Something else went first.',
  'The doors opened. The people waiting took the stairs.',
  'Somebody sighed with relief. Everyone else did not.',
  'The mirror has fogged up. Nobody wants to know why.',
  'It was quiet. Too quiet. Then it wasn’t.',
  'The lift stopped between floors. Of course it did.',
  'Someone whistled. Badly. To cover something up.',
  'The air freshener has given up.',
  'Everyone is pretending to read the safety sign.',
  'Somebody is smiling. That is suspicious.',
  'One small step for a person. One giant smell for the lift.',
  'Someone coughed at exactly the wrong moment.',
  'The emergency button is looking very tempting.',
  'Everyone is holding their breath. Some longer than others.',
  'Silent. Deadly. Before 9 a.m.',
  'Someone is suddenly humming very loudly.',
];
