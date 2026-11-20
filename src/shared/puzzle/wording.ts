import type { FoodId, Statement, SuspectId } from './types.ts';
import type { Rng } from './rng.ts';
import { CAST, FOODS, atCol, atRow } from './cast.ts';

/*
 * Clue wording rules (from player feedback and plain-language research):
 * - One fact per clue, in short, common words. No idioms or sarcasm inside a
 *   clue: players reading English as a second language miss them.
 * - Places use things you can see in the lift (BUTTONS, MIRROR, DOORS),
 *   never left or right, which flip depending on who is looking.
 * - Jokes live around the clue (teasers, reactions, confessions), not in it.
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

/** "me" when the speaker talks about themself, otherwise the other's name. */
function who(speaker: SuspectId, id: SuspectId): string {
  return speaker === id ? 'me' : name(id);
}

const NUMBER_WORDS = ['no one', 'one', 'two', 'three', 'four', 'five', 'six'];

function count(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "the BACK" or "the DOORS" */
const rowThing = (r: number): string => (r === 0 ? 'the BACK' : 'the DOORS');
/** "the BUTTONS", "the MIDDLE" or "the MIRROR" */
const colThing = (c: number): string =>
  c === 0 ? 'the BUTTONS' : c === 1 ? 'the MIDDLE' : 'the MIRROR';
/** "at the BACK" or "near the DOORS" */
const nearRow = (r: number): string =>
  r === 0 ? 'at the BACK' : 'near the DOORS';
/** "near the BUTTONS", "in the MIDDLE" or "near the MIRROR" */
const nearCol = (c: number): string =>
  c === 1 ? 'in the MIDDLE' : `near ${colThing(c)}`;

function verbalCore(speaker: SuspectId, s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'culpritRow':
      return rng.pick([
        `The smell came from ${rowThing(s.row)}.`,
        `I smelled it ${nearRow(s.row)}. I am sure.`,
      ]);
    case 'culpritCol':
      return rng.pick([
        `The smell came from ${colThing(s.col)}.`,
        `I smelled it ${nearCol(s.col)}. I am sure.`,
      ]);
    case 'culpritNotCol':
      return rng.pick([
        `The air ${nearCol(s.col)} was clean.`,
        `No smell ${nearCol(s.col)}. Nothing at all.`,
      ]);
    case 'culpritNextTo':
      return speaker === s.other
        ? 'It came from right next to me!'
        : rng.pick([
            `It came from right next to ${name(s.other)}.`,
            `The farter stood right beside ${name(s.other)}.`,
          ]);
    case 'culpritNotNextTo':
      return rng.pick([
        `It did not come from next to ${who(speaker, s.other)}.`,
        `The air next to ${who(speaker, s.other)} was clean.`,
      ]);
    case 'culpritSameColumnAs':
      return `It came from right in front of or behind ${who(speaker, s.other)}.`;
    case 'culpritAte':
      return rng.pick([
        `It smelled like ${dish(s.food)}. I am sure.`,
        `That fart smelled of ${dish(s.food)}.`,
      ]);
    case 'culpritDidNotEat':
      return rng.pick([
        `It did not smell like ${dish(s.food)} at all.`,
        `That fart did not smell of ${dish(s.food)}.`,
      ]);
    case 'innocent':
      return rng.pick([
        `It was not ${name(s.who)}. I watched ${name(s.who)} the whole time.`,
        `${name(s.who)} did not do it. ${name(s.who)} is innocent.`,
      ]);
    case 'ate':
      return speaker === s.who
        ? rng.pick([
            `I ate ${dish(s.food)} for lunch. So what?`,
            `Yes, I had ${dish(s.food)} for lunch.`,
          ])
        : rng.pick([
            `I saw ${name(s.who)} eat ${dish(s.food)} for lunch.`,
            `${name(s.who)} had ${dish(s.food)} for lunch. I saw it.`,
          ]);
    case 'didNotEat':
      return speaker === s.who
        ? rng.pick([
            `I did not eat ${dish(s.food)} today.`,
            `No ${dish(s.food)} for me today.`,
          ])
        : rng.pick([
            `${name(s.who)} did not eat ${dish(s.food)}. I saw the plate.`,
            `${name(s.who)} did not touch the ${dish(s.food)}.`,
          ]);
    case 'sameMeal':
      if (speaker === s.a || speaker === s.b) {
        const other = speaker === s.a ? s.b : s.a;
        return rng.pick([
          `${name(other)} and I ate the same lunch.`,
          `${name(other)} and I had the same lunch. Twins!`,
        ]);
      }
      return rng.pick([
        `${name(s.a)} and ${name(s.b)} ate the same lunch.`,
        `${name(s.a)} and ${name(s.b)} had the same lunch. I saw it.`,
      ]);
    case 'foodCount':
      return s.count === 0
        ? `Nobody here ate ${dish(s.food)}. I asked everyone.`
        : rng.pick([
            `Exactly ${count(s.count)} of us ate ${dish(s.food)}. I counted.`,
            `I counted. ${count(s.count).replace(/^./, (ch) => ch.toUpperCase())} of us ate ${dish(s.food)}.`,
          ]);
  }
}

/** Each talker gets at most one short, plain catchphrase per clue. */
const VOICE_WRAPS: Record<
  'agnes' | 'brock' | 'linda',
  { before: string[]; after: string[] }
> = {
  agnes: {
    before: ['Oh dear! ', 'Oh my! '],
    after: [' Oh dear.'],
  },
  brock: {
    before: ['Bro! ', 'Bro, listen. '],
    after: [' Trust me, bro.'],
  },
  linda: {
    before: ['For the record: ', 'Write this down: '],
    after: [' I wrote it down.', ' Noted.'],
  },
};

function toddlerAction(s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'culpritRow':
      return rng.pick([
        `Pip points at ${rowThing(s.row)} and shouts “STINKY!”`,
        `Pip hides her face from ${rowThing(s.row)}. “EWWW!”`,
      ]);
    case 'culpritCol':
      return rng.pick([
        `Pip points at ${colThing(s.col)} and holds her nose. “POO-EE!”`,
        `Pip walks to ${colThing(s.col)}, holds her nose and giggles.`,
      ]);
    case 'culpritNotCol':
      return rng.pick([
        `Pip walks over to ${colThing(s.col)}, sniffs and smiles. No smell there.`,
        `Pip crawls to ${colThing(s.col)} with a cookie, happy. No smell there.`,
      ]);
    case 'innocent':
      return rng.pick([
        `Pip hugs ${name(s.who)}. Pip only hugs people who did NOT fart.`,
        `Pip gives ${name(s.who)} a gold star. Pip only gives stars to good people.`,
      ]);
    default:
      return 'Pip giggles.';
  }
}

function dogAction(s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'ate':
      return rng.pick([
        `Biscuit sniffs ${name(s.who)} and drools. ${name(s.who)} smells of ${dish(s.food)}.`,
        `Biscuit licks ${name(s.who)}’s hand. It tastes of ${dish(s.food)}.`,
      ]);
    case 'didNotEat':
      return rng.pick([
        `Biscuit sniffs ${name(s.who)} and walks away. No ${dish(s.food)} smell.`,
        `Biscuit sniffs ${name(s.who)} and yawns. No ${dish(s.food)} there.`,
      ]);
    case 'sameMeal':
      return rng.pick([
        `Biscuit sniffs ${name(s.a)}, then ${name(s.b)}. Same smell!`,
        `Biscuit sniffs ${name(s.a)} and ${name(s.b)} and wags the same way. Same lunch!`,
      ]);
    case 'culpritAte':
      return rng.pick([
        `Biscuit sniffs the air and drools. The fart smells of ${dish(s.food)}.`,
        `Biscuit howls. That fart smelled of ${dish(s.food)}.`,
      ]);
    case 'culpritDidNotEat':
      return rng.pick([
        `Biscuit sniffs the air and yawns. That fart was not ${dish(s.food)}.`,
        `Biscuit sniffs the air. No ${dish(s.food)} in that smell.`,
      ]);
    default:
      return 'Biscuit wags.';
  }
}

function mimeAction(s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'culpritRow':
      return rng.pick([
        `Marcel points at ${rowThing(s.row)} and holds his nose.`,
        `Marcel walks to ${rowThing(s.row)}, fans the air and holds his nose.`,
      ]);
    case 'culpritCol':
      return rng.pick([
        `Marcel points at ${colThing(s.col)}, then pretends to faint.`,
        `Marcel walks to ${colThing(s.col)}, fans the air and holds his nose.`,
      ]);
    case 'culpritNotCol':
      return rng.pick([
        `Marcel walks to ${colThing(s.col)}, takes a deep breath and smiles. Clean air there.`,
        `Marcel walks to ${colThing(s.col)} and smells a pretend flower. Clean air there.`,
      ]);
    case 'culpritNextTo':
      return rng.pick([
        `Marcel points right beside ${name(s.other)} and holds his nose.`,
        `Marcel stands beside ${name(s.other)}, sniffs, and fans the air hard.`,
      ]);
    case 'culpritNotNextTo':
      return rng.pick([
        `Marcel sniffs both sides of ${name(s.other)} and gives a thumbs up.`,
        `Marcel stands beside ${name(s.other)}, breathes deeply and smiles.`,
      ]);
    case 'culpritSameColumnAs':
      return `Marcel points in front of ${name(s.other)}, then behind, and holds his nose.`;
    case 'innocent':
      return rng.pick([
        `Marcel draws a halo over ${name(s.who)}’s head. Innocent!`,
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
    case 'verbal': {
      const core = verbalCore(speaker, s, rng);
      if (speaker === 'agnes' || speaker === 'brock' || speaker === 'linda') {
        const wrap = VOICE_WRAPS[speaker];
        const style = rng.int(3);
        if (style === 0) {
          return `${rng.pick(wrap.before)}${core}`;
        }
        if (style === 1) {
          return `${core}${rng.pick(wrap.after)}`;
        }
      }
      return core;
    }
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
