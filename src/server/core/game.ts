import { context, reddit, redis } from '@devvit/web/server';
import type {
  AccuseRequest,
  AccuseResult,
  BlameRow,
  LeaderboardResponse,
  Streak,
  YesterdaySummary,
} from '../../shared/api.ts';
import type { CaseFile, SuspectId } from '../../shared/puzzle/types.ts';
import { SUSPECT_IDS } from '../../shared/puzzle/cast.ts';
import { generateCase } from '../../shared/puzzle/generator.ts';
import { badgeFor } from '../../shared/badges.ts';
import { verdictFor } from '../../shared/verdict.ts';
import { shiftDate, streakOn } from './days.ts';

export { shiftDate };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
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
  /** Sorted set: username → seconds, right guesses only. */
  fast: (date: string) => `fast:${date}`,
  /** Sorted set: username → current streak. */
  streakBoard: 'board:streak',
  /** Hash: username → date of their last guess, to hide broken streaks. */
  streakLast: 'board:streak-last',
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
  // Ties are broken by name so the same suspect always comes first.
  rows.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
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

/** True once the player has guessed on any day (their streak record exists). */
export async function hasPlayedBefore(
  userId: string | undefined
): Promise<boolean> {
  if (!userId) {
    return false;
  }
  return Boolean(await redis.hGet(keys.streak(userId), 'last'));
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
  const [blame, streak, last] = await Promise.all([
    readBlame(date),
    readStreak(userId),
    redis.hGet(keys.streak(userId), 'last'),
  ]);
  // The stored streak is the one after the player's latest guess. For an
  // older case, work out the streak the player had on that day instead.
  const onThatDay =
    streak && last !== date
      ? {
          ...streak,
          current: await streakOn(date, play.correct, async (d) =>
            parsePlay(await redis.hGet(keys.played(d), userId))
          ),
        }
      : streak;
  return {
    ...play,
    blame: blame.rows,
    totalPlayers: blame.total,
    streak: onThatDay,
  };
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
  await Promise.all([
    updateStreakFlair(streak.current),
    updateBoards(date, play, streak),
  ]);
  const blame = await readBlame(date);
  return { ...play, blame: blame.rows, totalPlayers: blame.total, streak };
}

/** Puts the player on today's fastest board and the streak board. */
async function updateBoards(
  date: string,
  play: StoredPlay,
  streak: Streak
): Promise<void> {
  const { username } = context;
  if (!username) {
    return;
  }
  try {
    await Promise.all([
      play.correct
        ? redis.zAdd(keys.fast(date), { member: username, score: play.seconds })
        : Promise.resolve(0),
      streak.current > 0
        ? redis.zAdd(keys.streakBoard, {
            member: username,
            score: streak.current,
          })
        : redis.zRem(keys.streakBoard, [username]),
      redis.hSet(keys.streakLast, { [username]: date }),
    ]);
  } catch (error) {
    // The boards are a bonus; never let them break the game.
    console.error('Could not update leaderboards', error);
  }
}

const BOARD_SIZE = 5;

/** Today's fastest right guesses and the longest streaks still going. */
export async function readLeaderboard(
  date: string
): Promise<LeaderboardResponse> {
  const username = context.username ?? null;
  const [fast, todayCount, myRank, myTime, streakTop] = await Promise.all([
    redis.zRange(keys.fast(date), 0, BOARD_SIZE - 1, { by: 'rank' }),
    redis.zCard(keys.fast(date)),
    username ? redis.zRank(keys.fast(date), username) : undefined,
    username ? redis.zScore(keys.fast(date), username) : undefined,
    // Read extra rows: some streaks may have ended by skipping a day.
    redis.zRange(keys.streakBoard, 0, 39, { by: 'rank', reverse: true }),
  ]);
  const lasts =
    streakTop.length > 0
      ? await redis.hMGet(
          keys.streakLast,
          streakTop.map((m) => m.member)
        )
      : [];
  // A streak is alive if the player guessed today or yesterday.
  const yesterday = shiftDate(date, -1);
  const streaks = streakTop
    .filter((_, i) => (lasts[i] ?? '') >= yesterday)
    .slice(0, BOARD_SIZE)
    .map((m, i) => ({ rank: i + 1, username: m.member, value: m.score }));
  return {
    type: 'leaderboard',
    username,
    today: fast.map((m, i) => ({
      rank: i + 1,
      username: m.member,
      value: m.score,
    })),
    todayCount,
    me:
      username && myRank !== undefined && myTime !== undefined
        ? { rank: myRank + 1, username, value: myTime }
        : null,
    streaks,
  };
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
  const blame = await readBlame(previous);
  const top = blame.rows[0];
  if (!top || blame.total === 0) {
    return null;
  }
  // Only build yesterday's case when someone played it (it costs a little time).
  const c = getCase(previous);
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
  if (context.username) {
    await redis.zRem(keys.fast(date), [context.username]);
  }
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

/**
 * The spoiler-free verdict a player can post under the case. `player` names
 * them when the comment ends up under the app's name instead of theirs.
 */
export function verdictText(
  c: CaseFile,
  result: AccuseResult,
  player?: string
): string {
  const v = verdictFor(c.number, c.suspects.length, result);
  const title = player
    ? `**${v.title}** · verdict from u/${player}`
    : `**${v.title}**`;
  return [title, v.line, `*${v.footer}*`].join('\n\n');
}

export type CommentOutcome = 'posted' | 'already' | 'not-played' | 'no-user';

/** post id -> id of that post's pinned "verdicts" comment. */
const VERDICT_THREADS = 'verdict-threads';
const THREAD_PENDING = 'pending';

export const VERDICT_THREAD_TEXT = [
  '🕵️ **VERDICTS GO HERE**',
  'Results posted from the game land as replies to this comment, so the thread below stays free for theories and banter.',
  'Know who did it? Keep it secret: `>!it was Brock!<`',
].join('\n\n');

function isCommentId(id: string | undefined): id is `t1_${string}` {
  return typeof id === 'string' && id.startsWith('t1_');
}

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The one comment, pinned by the app, that every verdict replies to. Devvit's
 * rules ask for score comments to collect under a single stickied comment so
 * they never crowd out real discussion. Made with the daily post, or the first
 * time someone posts a verdict on an older case.
 */
export async function verdictThread(
  postId: `t3_${string}`
): Promise<`t1_${string}`> {
  const claimed = await redis.hSetNX(VERDICT_THREADS, postId, THREAD_PENDING);
  if (!claimed) {
    // Someone else is making it right now: wait a moment for their id.
    for (let i = 0; i < 10; i++) {
      const existing = await redis.hGet(VERDICT_THREADS, postId);
      if (isCommentId(existing)) {
        return existing;
      }
      if (existing !== THREAD_PENDING) {
        break;
      }
      await pause(300);
    }
  }
  try {
    const comment = await reddit.submitComment({
      id: postId,
      text: VERDICT_THREAD_TEXT,
      runAs: 'APP',
    });
    await redis.hSet(VERDICT_THREADS, { [postId]: comment.id });
    try {
      await comment.distinguish(true);
    } catch (error) {
      // Still works as a thread; it just isn't pinned to the top.
      console.error('Could not pin the verdicts comment', error);
    }
    return comment.id;
  } catch (error) {
    await redis.hDel(VERDICT_THREADS, [postId]);
    throw error;
  }
}

/**
 * Posts the player's verdict as a reply to the case's pinned verdicts comment.
 * Only ever called from an explicit button press; one per player per case.
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
    const c = getCase(date);
    const thread = await verdictThread(postId);
    const comment = await reddit.submitComment({
      id: thread,
      text: verdictText(c, result),
      runAs: 'USER',
    });
    await redis.hSet(keys.commented(date), { [userId]: comment.id });
    // Until the app is approved, Reddit posts other players' comments under
    // the app's name. Then the comment says whose verdict it is.
    const { username } = context;
    if (
      username &&
      comment.authorName.toLowerCase() !== username.toLowerCase()
    ) {
      try {
        await comment.edit({ text: verdictText(c, result, username) });
      } catch (error) {
        console.error('Could not add the player name to the verdict', error);
      }
    }
    return 'posted';
  } catch (error) {
    await redis.hDel(keys.commented(date), [userId]);
    throw error;
  }
}
