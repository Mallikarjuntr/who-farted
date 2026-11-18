import type { Statement, SuspectId } from './types.ts';
import type { Rng } from './rng.ts';
import {
  CAST,
  COL_LABELS,
  COL_WORDS,
  FOODS,
  ROW_LABELS,
  ROW_WORDS,
} from './cast.ts';
import { must } from './rng.ts';

const name = (id: SuspectId): string => CAST[id].name;
const row = (r: number): string => must(ROW_WORDS[r], 'row word');
const col = (c: number): string => must(COL_WORDS[c], 'column word');

function people(n: number): string {
  return n === 1 ? 'person' : 'people';
}

const rowLabel = (r: number): string => must(ROW_LABELS[r], 'row label');
const colLabel = (c: number): string => must(COL_LABELS[c], 'column label');
const tag = (s: { food: keyof typeof FOODS }): string => FOODS[s.food].tag;

function onCol(c: number): string {
  return c === 1 ? `in the ${colLabel(c)}` : `on the ${colLabel(c)}`;
}

/**
 * The exact meaning of a clue in short, simple English. Key words are in
 * capitals and match the labels printed on the lift (LEFT, BACK, …).
 */
export function plainText(s: Statement): string {
  switch (s.kind) {
    case 'culpritRow':
      return `The farter was in the ${rowLabel(s.row)} row.`;
    case 'culpritCol':
      return `The farter was ${onCol(s.col)}.`;
    case 'culpritNotCol':
      return `The farter was NOT ${onCol(s.col)}.`;
    case 'culpritNextTo':
      return `The farter stood NEXT TO ${name(s.other)} (same row).`;
    case 'culpritNotNextTo':
      return `The farter did NOT stand next to ${name(s.other)} (same row).`;
    case 'culpritSameColumnAs':
      return `The farter stood in the same column as ${name(s.other)}.`;
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

/** "the middle" or "the left side" */
function sideName(c: number): string {
  return c === 1 ? 'the middle' : `the ${col(c)} side`;
}

/** "in the middle" or "on the left side" */
function onSide(c: number): string {
  return c === 1 ? 'in the middle' : `on the ${col(c)} side`;
}

function verbalCore(speaker: SuspectId, s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'culpritRow':
      return s.row === 0
        ? rng.pick([
            'It came from the back of the lift.',
            'That smell rolled in from the back wall.',
            'The back row. No doubt about it.',
          ])
        : rng.pick([
            'It came from the front, right by the doors.',
            'Front row. I felt the breeze.',
            'It came from the front row. No doubt about it.',
          ]);
    case 'culpritCol':
      return s.col === 1
        ? rng.pick([
            'It came from the middle of the lift.',
            'Dead centre. It came from the middle.',
          ])
        : rng.pick([
            `It started on the ${col(s.col)} side.`,
            `The ${col(s.col)} side. That's where it hit me first.`,
          ]);
    case 'culpritNotCol':
      return rng.pick([
        `Nothing came from ${sideName(s.col)}. I'd have noticed.`,
        `The air ${onSide(s.col)} was fine. Fresh as a daisy.`,
      ]);
    case 'culpritNextTo':
      return speaker === s.other
        ? 'It came from right next to me. Right. Next. To. Me.'
        : rng.pick([
            `Whoever did it was standing right beside ${name(s.other)}.`,
            `It came from right beside ${name(s.other)}.`,
          ]);
    case 'culpritNotNextTo':
      return rng.pick([
        `Whoever did it was not standing next to ${who(speaker, s.other)}.`,
        `Nobody beside ${who(speaker, s.other)} did this. The air there was fine.`,
      ]);
    case 'culpritSameColumnAs':
      return `It came from directly in front of or behind ${who(speaker, s.other)}.`;
    case 'culpritAte':
      return rng.pick([
        `That smell? Pure ${FOODS[s.food].short}. Whoever did it had ${FOODS[s.food].label}.`,
        `Whoever did it had ${FOODS[s.food].label}. I'd know that smell anywhere.`,
      ]);
    case 'culpritDidNotEat':
      return rng.pick([
        `That was no ${FOODS[s.food].short} smell. Whoever did it didn't eat ${FOODS[s.food].label}.`,
        `It didn't smell like ${FOODS[s.food].label} at all. Not even a bit.`,
      ]);
    case 'innocent':
      return rng.pick([
        `It wasn't ${name(s.who)}. I watched ${name(s.who)} the whole ride.`,
        `Leave ${name(s.who)} out of this. Innocent.`,
        `${name(s.who)} is innocent. I'd bet my lunch on it.`,
      ]);
    case 'ate':
      return speaker === s.who
        ? rng.pick([
            `I had ${FOODS[s.food].label} for lunch. Is that a crime now?`,
            `Yes, I had ${FOODS[s.food].label}. So what?`,
          ])
        : rng.pick([
            `I saw ${name(s.who)} eating ${FOODS[s.food].label} at lunch.`,
            `${name(s.who)} had ${FOODS[s.food].label} for lunch. I saw the whole plate.`,
          ]);
    case 'didNotEat':
      return speaker === s.who
        ? rng.pick([
            `I did not have ${FOODS[s.food].label}. Not today.`,
            `I stayed away from ${FOODS[s.food].label} today.`,
          ])
        : rng.pick([
            `${name(s.who)} definitely didn't have ${FOODS[s.food].label}.`,
            `${name(s.who)} never touched ${FOODS[s.food].label}.`,
          ]);
    case 'sameMeal':
      if (speaker === s.a || speaker === s.b) {
        const other = speaker === s.a ? s.b : s.a;
        return rng.pick([
          `${name(other)} and I had the exact same lunch.`,
          `${name(other)} and I ate the same thing. Twins!`,
        ]);
      }
      return rng.pick([
        `${name(s.a)} and ${name(s.b)} ordered the exact same lunch.`,
        `${name(s.a)} and ${name(s.b)} had matching lunches. I noticed.`,
      ]);
    case 'foodCount':
      return s.count === 0
        ? `Nobody in here had ${FOODS[s.food].label}. I asked.`
        : rng.pick([
            `Exactly ${count(s.count)} of us had ${FOODS[s.food].label}. I counted.`,
            `I counted. ${count(s.count).replace(/^./, (ch) => ch.toUpperCase())} of us had ${FOODS[s.food].label}. Exactly.`,
          ]);
  }
}

/** Each talker gets at most one catchphrase per clue, so lines stay short. */
const VOICE_WRAPS: Record<
  'agnes' | 'brock' | 'linda',
  { before: string[]; after: string[] }
> = {
  agnes: {
    before: ['Oh, dear. ', 'Well, I never. '],
    after: [' Mark my words.', ' In my day, we said excuse me.'],
  },
  brock: {
    before: ['Bro. ', 'Okay, so. ', 'No cap. '],
    after: [' Trust me, bro.', ' Leg day never lies.'],
  },
  linda: {
    before: ['Per my last email: ', 'For the record: '],
    after: [' I am filing a report.', ' Noted.'],
  },
};

function toddlerAction(s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'culpritRow':
      return rng.pick([
        `Pip points at the ${row(s.row)} row and shouts "STINKY!"`,
        `Pip hides her face from the ${row(s.row)} row. "EWWW!"`,
      ]);
    case 'culpritCol':
      return rng.pick([
        `Pip waddles ${s.col === 1 ? 'to the middle' : `to the ${col(s.col)} wall`}, pinches her nose and giggles.`,
        `Pip points at ${sideName(s.col)} and holds her nose. "POO-EE!"`,
      ]);
    case 'culpritNotCol':
      return rng.pick([
        `Pip naps happily ${s.col === 1 ? 'in the middle' : `against the ${col(s.col)} wall`}. No smell there.`,
        `Pip plays peekaboo ${onSide(s.col)}, sniffing happily. No smell there.`,
        `Pip sits ${onSide(s.col)} eating a cookie, happy as can be. No smell there.`,
      ]);
    case 'innocent':
      return rng.pick([
        `Pip hugs ${name(s.who)}'s leg. Pip never hugs a farter.`,
        `Pip gives ${name(s.who)} a gold sticker. Pip only gives stickers to good people.`,
      ]);
    default:
      return 'Pip giggles.';
  }
}

function dogAction(s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'ate':
      return rng.pick([
        `Biscuit sniffs ${name(s.who)} and starts drooling. Smells like ${FOODS[s.food].label}.`,
        `Biscuit licks ${name(s.who)}'s hand. Tastes like ${FOODS[s.food].label}.`,
      ]);
    case 'didNotEat':
      return rng.pick([
        `Biscuit sniffs ${name(s.who)} and loses interest. No ${FOODS[s.food].short} smell there.`,
        `Biscuit sniffs ${name(s.who)} and yawns. Not a whiff of ${FOODS[s.food].label}.`,
      ]);
    case 'sameMeal':
      return rng.pick([
        `Biscuit sniffs ${name(s.a)}, then ${name(s.b)}, and wags exactly the same way.`,
        `Biscuit sniffs ${name(s.a)} and ${name(s.b)}, then tilts his head. Same smell!`,
      ]);
    case 'culpritAte':
      return rng.pick([
        `Biscuit sniffs the air and drools. Whoever did it had ${FOODS[s.food].label}.`,
        `Biscuit lifts his nose and howls. That smell was ${FOODS[s.food].label}.`,
      ]);
    case 'culpritDidNotEat':
      return rng.pick([
        `Biscuit sniffs the air, unimpressed. Whatever it was, it wasn't ${FOODS[s.food].label}.`,
        `Biscuit sniffs the air and yawns. That was NOT ${FOODS[s.food].label}.`,
      ]);
    default:
      return 'Biscuit wags.';
  }
}

function mimeAction(s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'culpritRow':
      return rng.pick([
        `Marcel mimes a wall of stink rolling in from the ${row(s.row)}.`,
        `Marcel waves an invisible fan at the ${row(s.row)} row, eyes watering.`,
      ]);
    case 'culpritCol':
      return rng.pick([
        `Marcel fans the air ${s.col === 1 ? 'in the middle' : `on the ${col(s.col)} side`}, gagging silently.`,
        `Marcel points at ${sideName(s.col)}, then pretends to faint.`,
      ]);
    case 'culpritNotCol':
      return rng.pick([
        `Marcel breathes deeply ${s.col === 1 ? 'in the middle' : `by the ${col(s.col)} wall`}. Clean air there.`,
        `Marcel smells a pretend flower ${onSide(s.col)}. Lovely. Clean air there.`,
      ]);
    case 'culpritNextTo':
      return rng.pick([
        `Marcel points at the space right beside ${name(s.other)}, then pinches his nose.`,
        `Marcel tiptoes up beside ${name(s.other)}, sniffs, and fans the air hard.`,
      ]);
    case 'culpritNotNextTo':
      return rng.pick([
        `Marcel sniffs the air on both sides of ${name(s.other)} and gives a thumbs up.`,
        `Marcel stands beside ${name(s.other)}, takes a deep breath and smiles.`,
      ]);
    case 'culpritSameColumnAs':
      return `Marcel walks an invisible line straight through ${name(s.other)}, front to back, holding his nose.`;
    case 'innocent':
      return rng.pick([
        `Marcel places an invisible halo on ${name(s.who)}.`,
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
