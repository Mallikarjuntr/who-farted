/**
 * Streak badges, shown as user flair in the subreddit and on the result card.
 * Higher streaks unlock a grander title.
 */
export type Badge = {
  title: string;
  /** Full flair text, e.g. "Detective · 5-day streak". */
  text: string;
  background: string;
  textColor: 'dark' | 'light';
};

type Tier = {
  min: number;
  title: string;
  background: string;
  textColor: 'dark' | 'light';
};

const TIERS: readonly Tier[] = [
  {
    min: 30,
    title: 'Legendary Nose',
    background: '#141414',
    textColor: 'light',
  },
  {
    min: 14,
    title: 'Chief Inspector',
    background: '#FF5A36',
    textColor: 'dark',
  },
  { min: 7, title: 'Senior Sniffer', background: '#FFC93C', textColor: 'dark' },
  { min: 3, title: 'Detective', background: '#18A999', textColor: 'dark' },
  { min: 1, title: 'Rookie Sniffer', background: '#8FE3D6', textColor: 'dark' },
  { min: 0, title: 'Sniffer', background: '#E9E4D8', textColor: 'dark' },
];

export function badgeFor(streak: number): Badge {
  const days = Math.max(0, Math.floor(streak));
  const tier = TIERS.find((t) => days >= t.min) ?? {
    min: 0,
    title: 'Sniffer',
    background: '#E9E4D8',
    textColor: 'dark',
  };
  return {
    title: tier.title,
    text: days > 0 ? `${tier.title} · ${days}-day streak` : tier.title,
    background: tier.background,
    textColor: tier.textColor,
  };
}

/** The next title to aim for, or null at the top tier. */
export function nextBadge(
  streak: number
): { title: string; daysToGo: number } | null {
  const days = Math.max(0, Math.floor(streak));
  const next = [...TIERS].reverse().find((t) => t.min > days);
  return next ? { title: next.title, daysToGo: next.min - days } : null;
}
