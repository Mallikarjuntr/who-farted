import { useMemo } from 'react';
import type { SuspectId } from '../../shared/puzzle/types';
import type { Mood } from '../../shared/art';
import { suspectInner } from '../../shared/art';

export type { Mood };

type Props = {
  id: SuspectId;
  mood?: Mood;
  className?: string;
};

/**
 * A hand-drawn suspect bust. The drawing lives in shared/art.ts so the game
 * and the subreddit artwork always use the very same characters. The markup
 * is our own constant artwork, never user input.
 */
export const Suspect = ({ id, mood = 'neutral', className }: Props) => {
  const inner = useMemo(() => ({ __html: suspectInner(id, mood) }), [id, mood]);
  return (
    <svg
      viewBox="-4 -4 108 118"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={inner}
    />
  );
};
