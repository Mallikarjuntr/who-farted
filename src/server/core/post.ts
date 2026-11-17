import { reddit } from '@devvit/web/server';
import { getCase, todayUtc } from './game.ts';

/** Creates the post for one day's case. The post remembers its date. */
export const createCasePost = async (date: string = todayUtc()) => {
  const c = getCase(date);
  return await reddit.submitCustomPost({
    title: `Who Farted? Case #${c.number}: Floor ${c.floor}. ${c.teaser}`,
    postData: { caseDate: date },
  });
};
