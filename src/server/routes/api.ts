import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type {
  AccuseResponse,
  CaseResponse,
  CommentResponse,
  ErrorResponse,
  ResetResponse,
} from '../../shared/api.ts';
import { toPublicCase } from '../../shared/puzzle/generator.ts';
import {
  accuse,
  getCase,
  hasCommented,
  isSuspectId,
  isTestMode,
  readBlame,
  readResult,
  postVerdictComment,
  readStreak,
  resetPlay,
  resolveCaseDate,
  yesterdaySummary,
} from '../core/game.ts';

export const api = new Hono();

api.get('/case', async (c) => {
  try {
    const date = await resolveCaseDate(c.req.query('date'));
    const [result, streak, yesterday, blame, commented] = await Promise.all([
      readResult(date, context.userId),
      readStreak(context.userId),
      yesterdaySummary(date),
      readBlame(date),
      hasCommented(date, context.userId),
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
