import { context, redis } from '@devvit/web/server';
import type {
  AccuseRequest,
  AccuseResult,
  BlameRow,
  Streak,
  YesterdaySummary,
} from '../../shared/api.ts';
import type { CaseFile, SuspectId } from '../../shared/puzzle/types.ts';
import { SUSPECT_IDS } from '../../shared/puzzle/cast.ts';
import { generateCase } from '../../shared/puzzle/generator.ts';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

/** Each post carries the date of its case; old posts keep showing their own case. */
export function caseDateForPost(): string {
  const data = context.postData;
  const value = data && typeof data === 'object' ? data['caseDate'] : undefined;
  return typeof value === 'string' && DATE_RE.test(value) ? value : todayUtc();
}

const cache = new Map<string, CaseFile>();

export function getCase(date: string): CaseFile {
  const hit = cache.get(date);
  if (hit) {
    return hit;
  }
  const made = generateCase(date);
  cache.set(date, made);
  return made;
}

export function isSuspectId(value: unknown): value is SuspectId {
  return typeof value === 'string' && SUSPECT_IDS.some((id) => id === value);
}

const keys = {
  played: (date: string) => `played:${date}`,
  blame: (date: string) => `blame:${date}`,
  streak: (userId: string) => `streak:${userId}`,
};

export async function readBlame(
  date: string
): Promise<{ rows: BlameRow[]; total: number }> {
  const raw = await redis.hGetAll(keys.blame(date));
  const rows: BlameRow[] = [];
  let total = 0;
  for (const [id, value] of Object.entries(raw)) {
    const count = Number(value);
    if (isSuspectId(id) && Number.isFinite(count) && count > 0) {
      rows.push({ id, count });
      total += count;
    }
  }
  rows.sort((a, b) => b.count - a.count);
  return { rows, total };
}

export async function readStreak(
  userId: string | undefined
): Promise<Streak | null> {
  if (!userId) {
    return null;
  }
  const raw = await redis.hGetAll(keys.streak(userId));
  return {
    current: Number(raw['current'] ?? 0),
    best: Number(raw['best'] ?? 0),
  };
}

type StoredPlay = Omit<AccuseResult, 'blame' | 'totalPlayers' | 'streak'>;

function parsePlay(raw: string | undefined): StoredPlay | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const guessed: unknown = Reflect.get(parsed, 'guessed');
    const culprit: unknown = Reflect.get(parsed, 'culprit');
    if (!isSuspectId(guessed) || !isSuspectId(culprit)) {
      return null;
    }
    const date = Reflect.get(parsed, 'date');
    const lunches =
      typeof date === 'string' ? getCase(date).solution.lunches : [];
    return {
      correct: Reflect.get(parsed, 'correct') === true,
      guessed,
      culprit,
      lunches,
      seconds: Number(Reflect.get(parsed, 'seconds') ?? 0),
      cluesRead: Number(Reflect.get(parsed, 'cluesRead') ?? 0),
      hints: Number(Reflect.get(parsed, 'hints') ?? 0),
    };
  } catch {
    return null;
  }
}

export async function readResult(
  date: string,
  userId: string | undefined
): Promise<AccuseResult | null> {
  if (!userId) {
    return null;
  }
  const play = parsePlay(await redis.hGet(keys.played(date), userId));
  if (!play) {
    return null;
  }
  const [blame, streak] = await Promise.all([
    readBlame(date),
    readStreak(userId),
  ]);
  return { ...play, blame: blame.rows, totalPlayers: blame.total, streak };
}

async function bumpStreak(
  userId: string,
  date: string,
  correct: boolean
): Promise<Streak> {
  const key = keys.streak(userId);
  const raw = await redis.hGetAll(key);
  const best = Number(raw['best'] ?? 0);
  const last = raw['last'];
  let current = Number(raw['current'] ?? 0);
  if (!correct) {
    current = 0;
  } else if (last === shiftDate(date, -1)) {
    current += 1;
  } else if (last !== date) {
    current = 1;
  }
  const next = { current, best: Math.max(best, current) };
  await redis.hSet(key, {
    current: String(next.current),
    best: String(next.best),
    last: date,
  });
  return next;
}

function clampInt(value: unknown, max: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
}

/** Record one accusation per player per case. Repeat calls return the first result. */
export async function accuse(
  date: string,
  userId: string | undefined,
  input: AccuseRequest
): Promise<AccuseResult> {
  const c = getCase(date);
  const play: StoredPlay = {
    correct: input.suspect === c.solution.culprit,
    guessed: input.suspect,
    culprit: c.solution.culprit,
    lunches: c.solution.lunches,
    seconds: clampInt(input.seconds, 24 * 3600),
    cluesRead: clampInt(input.cluesRead, c.testimonies.length),
    hints: clampInt(input.hints, 99),
  };

  if (!userId) {
    const blame = await readBlame(date);
    return {
      ...play,
      blame: blame.rows,
      totalPlayers: blame.total,
      streak: null,
    };
  }

  const isFirst = await redis.hSetNX(
    keys.played(date),
    userId,
    JSON.stringify({ ...play, lunches: undefined, date })
  );
  if (!isFirst) {
    const existing = await readResult(date, userId);
    if (existing) {
      return existing;
    }
  }
  await redis.hIncrBy(keys.blame(date), play.guessed, 1);
  const streak = await bumpStreak(userId, date, play.correct);
  const blame = await readBlame(date);
  return { ...play, blame: blame.rows, totalPlayers: blame.total, streak };
}

export async function yesterdaySummary(
  date: string
): Promise<YesterdaySummary | null> {
  const previous = shiftDate(date, -1);
  const c = getCase(previous);
  const blame = await readBlame(previous);
  const top = blame.rows[0];
  if (!top || blame.total === 0) {
    return null;
  }
  const correct =
    blame.rows.find((r) => r.id === c.solution.culprit)?.count ?? 0;
  return {
    number: c.number,
    culprit: c.solution.culprit,
    topBlamed: top.id,
    topBlamedPct: Math.round((top.count / blame.total) * 100),
    correctPct: Math.round((correct / blame.total) * 100),
    totalPlayers: blame.total,
  };
}
