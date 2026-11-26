import { reddit, redis } from '@devvit/web/server';
import { createCasePost } from './post.ts';
import { shiftDate, todayUtc, verdictThread } from './game.ts';

/** date -> post id of that day's case post, one per subreddit installation. */
const DAILY_POSTS = 'daily-posts';
const PENDING = 'pending';

export type DailyPostOutcome =
  { status: 'created'; postId: string } | { status: 'exists'; postId: string };

/**
 * Posts the case for `date` once. Safe to call again (from the midnight job,
 * the install trigger or the mod menu): a second call returns the first post.
 * The newest case is pinned in the second highlight slot and yesterday's is unpinned.
 */
export async function postDailyCase(
  date: string = todayUtc()
): Promise<DailyPostOutcome> {
  const claimed = await redis.hSetNX(DAILY_POSTS, date, PENDING);
  if (!claimed) {
    const existing = await redis.hGet(DAILY_POSTS, date);
    if (existing && existing !== PENDING) {
      return { status: 'exists', postId: existing };
    }
  }

  try {
    const post = await createCasePost(date);
    await redis.hSet(DAILY_POSTS, { [date]: post.id });
    await pinNewest(post.id, date);
    await openVerdictThread(post.id);
    return { status: 'created', postId: post.id };
  } catch (error) {
    // Let a later run try again instead of leaving the day stuck as "pending".
    await redis.hDel(DAILY_POSTS, [date]);
    throw error;
  }
}

function isPostId(id: string | undefined): id is `t3_${string}` {
  return typeof id === 'string' && id.startsWith('t3_');
}

/** The post id of the case for `date`, once it has been posted. */
export async function dailyPostId(
  date: string
): Promise<`t3_${string}` | null> {
  const id = await redis.hGet(DAILY_POSTS, date);
  return isPostId(id) ? id : null;
}

/** Pins the verdicts comment from the start, so the first verdict has a home. */
async function openVerdictThread(postId: string): Promise<void> {
  if (!isPostId(postId)) {
    return;
  }
  try {
    await verdictThread(postId);
  } catch (error) {
    // The first verdict will try again.
    console.error('Could not open the verdicts thread', error);
  }
}

async function pinNewest(postId: string, date: string): Promise<void> {
  try {
    const previous = await redis.hGet(DAILY_POSTS, shiftDate(date, -1));
    if (isPostId(previous)) {
      await (await reddit.getPostById(previous)).unsticky();
    }
    // The bottom highlight slot, so the moderators' own pin (the how-to-play
    // post) keeps the top slot and is never pushed out.
    if (isPostId(postId)) {
      await (await reddit.getPostById(postId)).sticky(2);
    }
  } catch (error) {
    // Pinning is nice to have; the case post itself is what matters.
    console.error('Could not pin the daily case', error);
  }
}
