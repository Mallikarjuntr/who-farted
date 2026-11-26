import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  AccuseResponse,
  AvatarResponse,
  CaseResponse,
  CommentResponse,
  ErrorResponse,
  JoinResponse,
  TodayCase,
  LeaderboardResponse,
  ResetResponse,
} from '../../shared/api.ts';
import { toPublicCase } from '../../shared/puzzle/generator.ts';
import {
  accuse,
  getCase,
  hasCommented,
  hasPlayedBefore,
  isSuspectId,
  isTestMode,
  readBlame,
  readLeaderboard,
  readResult,
  postVerdictComment,
  readStreak,
  resetPlay,
  resolveCaseDate,
  todayUtc,
  yesterdaySummary,
} from '../core/game.ts';
import { dailyPostId } from '../core/daily.ts';

export const api = new Hono();

/**
 * Old case posts stay playable forever. When someone opens one (a judge
 * following an old link, say), point them at today's case as well.
 */
async function todaysCase(date: string): Promise<TodayCase | null> {
  const today = todayUtc();
  if (date >= today) {
    return null;
  }
  try {
    const postId = await dailyPostId(today);
    if (!postId || postId === context.postId) {
      return null;
    }
    const sub = context.subredditName ?? 'WhoFartedDaily';
    return {
      number: getCase(today).number,
      url: `https://www.reddit.com/r/${sub}/comments/${postId.slice(3)}/`,
    };
  } catch (error) {
    console.error('Could not find today’s case post', error);
    return null;
  }
}

api.get('/case', async (c) => {
  try {
    const date = await resolveCaseDate(c.req.query('date'));
    const [result, streak, yesterday, blame, commented, returning, today] =
      await Promise.all([
        readResult(date, context.userId),
        readStreak(context.userId),
        yesterdaySummary(date),
        readBlame(date),
        hasCommented(date, context.userId),
        hasPlayedBefore(context.userId),
        todaysCase(date),
      ]);
    return c.json<CaseResponse>({
      type: 'case',
      case: toPublicCase(getCase(date)),
      username: context.username ?? null,
      result,
      streak,
      yesterday,
      playersSoFar: blame.total,
      testMode: await isTestMode(),
      commented,
      subredditName: context.subredditName ?? null,
      returning,
      today,
    });
  } catch (error) {
    console.error('GET /api/case failed', error);
    return c.json<ErrorResponse>(
      { type: 'error', message: 'Could not load today’s case.' },
      500
    );
  }
});

api.post('/accuse', async (c) => {
  try {
    const body: unknown = await c.req.json();
    const suspect: unknown =
      body && typeof body === 'object'
        ? Reflect.get(body, 'suspect')
        : undefined;
    if (!body || typeof body !== 'object' || !isSuspectId(suspect)) {
      return c.json<ErrorResponse>(
        { type: 'error', message: 'Pick a suspect.' },
        400
      );
    }
    const date = await resolveCaseDate(Reflect.get(body, 'date'));
    if (!getCase(date).suspects.some((s) => s.id === suspect)) {
      return c.json<ErrorResponse>(
        { type: 'error', message: 'That suspect was not in the lift.' },
        400
      );
    }
    const result = await accuse(date, context.userId, {
      suspect,
      seconds: Number(Reflect.get(body, 'seconds') ?? 0),
      cluesRead: Number(Reflect.get(body, 'cluesRead') ?? 0),
      hints: Number(Reflect.get(body, 'hints') ?? 0),
    });
    return c.json<AccuseResponse>({ type: 'accuse', result });
  } catch (error) {
    console.error('POST /api/accuse failed', error);
    return c.json<ErrorResponse>(
      { type: 'error', message: 'Could not record your accusation.' },
      500
    );
  }
});

api.post('/test/reset', async (c) => {
  if (!(await isTestMode())) {
    return c.json<ErrorResponse>(
      { type: 'error', message: 'Not available here.' },
      403
    );
  }
  try {
    const body: unknown = await c.req.json();
    const date = await resolveCaseDate(
      body && typeof body === 'object' ? Reflect.get(body, 'date') : undefined
    );
    await resetPlay(date, context.userId);
    return c.json<ResetResponse>({ type: 'reset' });
  } catch (error) {
    console.error('POST /api/test/reset failed', error);
    return c.json<ErrorResponse>(
      { type: 'error', message: 'Could not reset.' },
      500
    );
  }
});

api.post('/comment', async (c) => {
  try {
    const body: unknown = await c.req.json().catch(() => ({}));
    const date = await resolveCaseDate(
      body && typeof body === 'object' ? Reflect.get(body, 'date') : undefined
    );
    const outcome = await postVerdictComment(date);
    if (outcome === 'no-user') {
      return c.json<ErrorResponse>(
        { type: 'error', message: 'Log in to Reddit to comment.' },
        401
      );
    }
    if (outcome === 'not-played') {
      return c.json<ErrorResponse>(
        { type: 'error', message: 'Make your guess first.' },
        400
      );
    }
    return c.json<CommentResponse>({
      type: 'comment',
      alreadyPosted: outcome === 'already',
    });
  } catch (error) {
    console.error('POST /api/comment failed', error);
    return c.json<ErrorResponse>(
      { type: 'error', message: 'Could not post the comment.' },
      500
    );
  }
});

/** Joins the subreddit for the player. Only called from the explicit button. */
api.post('/join', async (c) => {
  if (!context.userId) {
    return c.json<ErrorResponse>(
      { type: 'error', message: 'Log in to Reddit to join.' },
      401
    );
  }
  try {
    await reddit.subscribeToCurrentSubreddit();
    return c.json<JoinResponse>({ type: 'join' });
  } catch (error) {
    console.error('POST /api/join failed', error);
    return c.json<ErrorResponse>(
      { type: 'error', message: 'Could not join right now.' },
      500
    );
  }
});

/**
 * The player's snoovatar for the result card. Asked for only after a guess,
 * so it never slows down opening the case.
 */
api.get('/avatar', async (c) => {
  const username = context.username ?? null;
  if (!username) {
    return c.json<AvatarResponse>({ type: 'avatar', username, url: null });
  }
  try {
    const url = (await reddit.getSnoovatarUrl(username)) ?? null;
    return c.json<AvatarResponse>({ type: 'avatar', username, url });
  } catch (error) {
    // An avatar is a nice extra; never let it break the result card.
    console.error('GET /api/avatar failed', error);
    return c.json<AvatarResponse>({ type: 'avatar', username, url: null });
  }
});

/** Today's fastest sniffers and the longest streaks. Asked for after a guess. */
api.get('/leaderboard', async (c) => {
  try {
    const date = await resolveCaseDate(c.req.query('date'));
    return c.json<LeaderboardResponse>(await readLeaderboard(date));
  } catch (error) {
    console.error('GET /api/leaderboard failed', error);
    return c.json<ErrorResponse>(
      { type: 'error', message: 'Could not load the leaderboard.' },
      500
    );
  }
});
