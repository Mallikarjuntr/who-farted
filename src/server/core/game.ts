import { context, reddit, redis } from '@devvit/web/server';
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
import { badgeFor } from '../../shared/badges.ts';

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

/**
 * Test mode only ever switches on in the private playtest subreddit, never in
 * the public one. It lets the developer replay cases and jump between days.
 */
const TEST_SUBREDDITS = ['who_farted_daily_dev'];

const modCache = new Map<string, { isMod: boolean; at: number }>();

/**
 * Test tools (replay, change day) appear only for moderators of the private
 * test subreddit, so friends who playtest there play it for real.
 */
export async function isTestMode(): Promise<boolean> {
  const subredditName = context.subredditName ?? '';
  const username = context.username;
  if (!TEST_SUBREDDITS.includes(subredditName.toLowerCase()) || !username) {
    return false;
  }
  const key = `${subredditName}:${username}`.toLowerCase();
  const hit = modCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) {
    return hit.isMod;
  }
  try {
    const mods = await reddit.getModerators({ subredditName, username }).all();
    const isMod = mods.some(
      (m) => m.username.toLowerCase() === username.toLowerCase()
    );
    modCache.set(key, { isMod, at: Date.now() });
    return isMod;
  } catch (error) {
    console.error('Could not check moderators', error);
    return false;
  }
}

/** In test mode a request may ask for any day's case; otherwise the post decides. */
export async function resolveCaseDate(requested: unknown): Promise<string> {
  if (
    typeof requested === 'string' &&
    DATE_RE.test(requested) &&
    (await isTestMode())
  ) {
    return requested;
  }
  return caseDateForPost();
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
  commented: (date: string) => `commented:${date}`,
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
  await updateStreakFlair(streak.current);
  const blame = await readBlame(date);
  return { ...play, blame: blame.rows, totalPlayers: blame.total, streak };
}

/** Shows the player's streak title next to their name in this subreddit. */
async function updateStreakFlair(current: number): Promise<void> {
  const { username, subredditName } = context;
  if (!username || !subredditName) {
    return;
  }
  const badge = badgeFor(current);
  try {
    await reddit.setUserFlair({
      subredditName,
      username,
      text: badge.text,
      backgroundColor: badge.background,
      textColor: badge.textColor,
    });
  } catch (error) {
    // Flair is a bonus; never let it break the game.
    console.error('Could not set streak flair', error);
  }
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

/** Test mode: forget this player's accusation for a day so they can play it again. */
export async function resetPlay(
  date: string,
  userId: string | undefined
): Promise<void> {
  if (!userId || !(await isTestMode())) {
    return;
  }
  const play = parsePlay(await redis.hGet(keys.played(date), userId));
  if (!play) {
    return;
  }
  await redis.hDel(keys.played(date), [userId]);
  await redis.hDel(keys.commented(date), [userId]);
  const count = await redis.hIncrBy(keys.blame(date), play.guessed, -1);
  if (count < 0) {
    await redis.hSet(keys.blame(date), { [play.guessed]: '0' });
  }
}

export async function hasCommented(
  date: string,
  userId: string | undefined
): Promise<boolean> {
  if (!userId) {
    return false;
  }
  return Boolean(await redis.hGet(keys.commented(date), userId));
}

function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The spoiler-free verdict a player can post under the case. */
export function verdictText(c: CaseFile, result: AccuseResult): string {
  const lines = [`**Who Farted? Case #${c.number}**`];
  if (result.correct) {
    const parts = [
      `Cracked it in ${clock(result.seconds)}`,
      `${result.cluesRead}/${c.suspects.length} clues`,
    ];
    if (result.hints > 0) {
      parts.push(`${result.hints} hint${result.hints === 1 ? '' : 's'}`);
    }
    if (result.streak) {
      parts.push(
        `streak ${result.streak.current} day${result.streak.current === 1 ? '' : 's'}`
      );
    }
    lines.push(parts.join(' · '));
  } else {
    lines.push(
      `The farter got away from me this time (${clock(result.seconds)}). Back tomorrow!`
    );
  }
  lines.push('*No spoilers. Can you find the farter?*');
  return lines.join('\n\n');
}

export type CommentOutcome = 'posted' | 'already' | 'not-played' | 'no-user';

/**
 * Posts the player's verdict as a comment on the case post. Only ever called
 * from an explicit button press; one comment per player per case.
 */
export async function postVerdictComment(
  date: string
): Promise<CommentOutcome> {
  const { userId, postId } = context;
  if (!userId || !postId) {
    return 'no-user';
  }
  const result = await readResult(date, userId);
  if (!result) {
    return 'not-played';
  }
  const claimed = await redis.hSetNX(keys.commented(date), userId, 'pending');
  if (!claimed) {
    return 'already';
  }
  try {
    const comment = await reddit.submitComment({
      id: postId,
      text: verdictText(getCase(date), result),
      runAs: 'USER',
    });
    await redis.hSet(keys.commented(date), { [userId]: comment.id });
    return 'posted';
  } catch (error) {
    await redis.hDel(keys.commented(date), [userId]);
    throw error;
  }
}
