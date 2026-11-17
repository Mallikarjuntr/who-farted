import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { postDailyCase } from '../core/daily.ts';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const { postId } = await postDailyCase();
    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${postId}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      { showToast: 'Failed to post today’s case' },
      400
    );
  }
});
