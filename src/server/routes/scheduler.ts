import { Hono } from 'hono';
import type { TaskResponse } from '@devvit/web/server';
import { postDailyCase } from '../core/daily.ts';
import { todayUtc } from '../core/game.ts';

export const scheduler = new Hono();

/** Runs every day at 00:00 UTC (see devvit.json) and posts that day's case. */
scheduler.post('/daily-case', async (c) => {
  try {
    const outcome = await postDailyCase(todayUtc());
    console.log(
      `Daily case ${todayUtc()}: ${outcome.status} ${outcome.postId}`
    );
    return c.json<TaskResponse>({ status: 'ok' }, 200);
  } catch (error) {
    console.error('Daily case job failed', error);
    return c.json<TaskResponse>({ status: 'ok' }, 500);
  }
});
