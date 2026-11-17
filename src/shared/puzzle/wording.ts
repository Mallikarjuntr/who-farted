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
      return `The farter stood NEXT TO ${name(s.other)}.`;
    case 'culpritNotNextTo':
      return `The farter did NOT stand next to ${name(s.other)}.`;
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

function verbalCore(speaker: SuspectId, s: Statement, rng: Rng): string {
  switch (s.kind) {
    case 'culpritRow':
      return s.row === 0
        ? rng.pick([
            'It came from the back of the lift.',
            'That smell rolled in from the back wall.',
          ])
        : rng.pick([
            'It came from the front, right by the doors.',
            'Front row. I felt the breeze.',
          ]);
    case 'culpritCol':
      return s.col === 1
        ? 'It came from the middle of the lift.'
        : rng.pick([
            `It started on the ${col(s.col)} side.`,
            `The ${col(s.col)} side. That's where it hit me first.`,
          ]);
    case 'culpritNotCol':
      return `Nothing came from ${s.col === 1 ? 'the middle' : `the ${col(s.col)} side`}. I'd have noticed.`;
    case 'culpritNextTo':
      return speaker === s.other
        ? 'It came from right next to me. Right. Next. To. Me.'
        : `Whoever did it was standing right beside ${name(s.other)}.`;
    case 'culpritNotNextTo':
      return `Whoever did it was not standing next to ${who(speaker, s.other)}.`;
    case 'culpritSameColumnAs':
      return `It came from directly in front of or behind ${who(speaker, s.other)}.`;
    case 'culpritAte':
      return rng.pick([
        `That smell? Pure ${FOODS[s.food].short}. Whoever did it had ${FOODS[s.food].label}.`,
        `Whoever did it had ${FOODS[s.food].label}. I'd know that smell anywhere.`,
      ]);
    case 'culpritDidNotEat':
      return `That was no ${FOODS[s.food].short} smell. Whoever did it didn't eat ${FOODS[s.food].label}.`;
    case 'innocent':
      return rng.pick([
        `It wasn't ${name(s.who)}. I watched ${name(s.who)} the whole ride.`,
        `Leave ${name(s.who)} out of this. Innocent.`,
      ]);
    case 'ate':
      return speaker === s.who
        ? `I had ${FOODS[s.food].label} for lunch. Is that a crime now?`
        : `I saw ${name(s.who)} eating ${FOODS[s.food].label} at lunch.`;
    case 'didNotEat':
      return speaker === s.who
        ? `I did not have ${FOODS[s.food].label}. Not today.`
        : `${name(s.who)} definitely didn't have ${FOODS[s.food].label}.`;
    case 'sameMeal':
      if (speaker === s.a || speaker === s.b) {
        const other = speaker === s.a ? s.b : s.a;
        return `${name(other)} and I had the exact same lunch.`;
      }
      return `${name(s.a)} and ${name(s.b)} ordered the exact same lunch.`;
    case 'foodCount':
      return s.count === 0
        ? `Nobody in here had ${FOODS[s.food].label}. I asked.`
        : `Exactly ${s.count} of us had ${FOODS[s.food].label}. I counted.`;
  }
}

const VOICE_WRAPS: Record<
  'agnes' | 'brock' | 'linda',
  { before: string[]; after: string[] }
> = {
  agnes: {
    before: ['Oh, dear. ', 'Well, I never. ', ''],
    after: [' Mark my words.', ' Back in my day, people said excuse me.', ''],
  },
  brock: {
    before: ['Bro. ', 'Okay, so. ', 'No cap. '],
    after: [' Trust me, bro.', ' Leg day never lies.', ''],
  },
  linda: {
    before: ['Per my last email: ', 'For the record: ', ''],
    after: [' I am filing a report.', ' Noted.', ''],
  },
};

function toddlerAction(s: Statement): string {
  switch (s.kind) {
    case 'culpritRow':
      return `Pip points at the ${row(s.row)} row and shouts "STINKY!"`;
    case 'culpritCol':
      return `Pip waddles ${s.col === 1 ? 'to the middle' : `to the ${col(s.col)} wall`}, pinches her nose and giggles.`;
    case 'culpritNotCol':
      return `Pip naps happily ${s.col === 1 ? 'in the middle' : `against the ${col(s.col)} wall`}. No smell there.`;
    case 'innocent':
      return `Pip hugs ${name(s.who)}'s leg. Pip never hugs a farter.`;
    default:
      return 'Pip giggles.';
  }
}

function dogAction(s: Statement): string {
  switch (s.kind) {
    case 'ate':
      return `Biscuit sniffs ${name(s.who)} and starts drooling. Smells like ${FOODS[s.food].label}.`;
    case 'didNotEat':
      return `Biscuit sniffs ${name(s.who)} and loses interest. No ${FOODS[s.food].short} there.`;
    case 'sameMeal':
      return `Biscuit sniffs ${name(s.a)}, then ${name(s.b)}, and wags exactly the same way.`;
    case 'culpritAte':
      return `Biscuit sniffs the air and drools. Whoever did it had ${FOODS[s.food].label}.`;
    case 'culpritDidNotEat':
      return `Biscuit sniffs the air, unimpressed. Whatever it was, it wasn't ${FOODS[s.food].label}.`;
    default:
      return 'Biscuit wags.';
  }
}

function mimeAction(s: Statement): string {
  switch (s.kind) {
    case 'culpritRow':
      return `Marcel mimes a wall of stink rolling in from the ${row(s.row)}.`;
    case 'culpritCol':
      return `Marcel fans the air ${s.col === 1 ? 'in the middle' : `on the ${col(s.col)} side`}, gagging silently.`;
    case 'culpritNotCol':
      return `Marcel breathes deeply ${s.col === 1 ? 'in the middle' : `by the ${col(s.col)} wall`}. Clean air there.`;
    case 'culpritNextTo':
      return `Marcel points at the space right beside ${name(s.other)}, then pinches his nose.`;
    case 'culpritNotNextTo':
      return `Marcel draws an invisible box around ${name(s.other)}'s sides and gives a thumbs up.`;
    case 'culpritSameColumnAs':
      return `Marcel walks an invisible line straight through ${name(s.other)}, front to back, holding his nose.`;
    case 'innocent':
      return `Marcel places an invisible halo on ${name(s.who)}.`;
    default:
      return 'Marcel bows.';
  }
}

/** What the speaker says (or does), in their own voice. */
export function quoteText(speaker: SuspectId, s: Statement, rng: Rng): string {
  switch (CAST[speaker].voice) {
    case 'toddler':
      return toddlerAction(s);
    case 'dog':
      return dogAction(s);
    case 'mime':
      return mimeAction(s);
    case 'verbal': {
      const core = verbalCore(speaker, s, rng);
      if (speaker === 'agnes' || speaker === 'brock' || speaker === 'linda') {
        const wrap = VOICE_WRAPS[speaker];
        return `${rng.pick(wrap.before)}${core}${rng.pick(wrap.after)}`;
      }
      return core;
    }
  }
}

export const TEASERS: readonly string[] = [
  'The doors are stuck. The air is not.',
  'Someone’s lunch is fighting back.',
  'Six people. One lift. One very bad decision.',
  'The music is smooth jazz. The air is not.',
  'Nobody is making eye contact.',
  'Somebody pressed every button. Somebody else did worse.',
  'The lift is slow. The smell is fast.',
  'Everyone is suddenly very interested in the ceiling.',
];
