import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type {
  AccuseResponse,
  CaseResponse,
  ErrorResponse,
} from '../../shared/api.ts';
import { toPublicCase } from '../../shared/puzzle/generator.ts';
import {
  accuse,
  caseDateForPost,
  getCase,
  isSuspectId,
  readBlame,
  readResult,
  readStreak,
  yesterdaySummary,
} from '../core/game.ts';

export const api = new Hono();

api.get('/case', async (c) => {
  try {
    const date = caseDateForPost();
    const [result, streak, yesterday, blame] = await Promise.all([
      readResult(date, context.userId),
      readStreak(context.userId),
      yesterdaySummary(date),
      readBlame(date),
    ]);
    return c.json<CaseResponse>({
      type: 'case',
      case: toPublicCase(getCase(date)),
      username: context.username ?? null,
      result,
      streak,
      yesterday,
      playersSoFar: blame.total,
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
    const date = caseDateForPost();
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
