import { navigateTo, showToast } from '@devvit/web/client';
import { useEffect, useMemo, useState } from 'react';
import type { AccuseResult, Streak } from '../../shared/api';
import type { PublicCase } from '../../shared/puzzle/types';
import { CAST, FOODS } from '../../shared/puzzle/cast';
import { FOOD_COLORS, confession } from '../lib/clues';
import { badgeFor, nextBadge } from '../../shared/badges';
import { verdictFor } from '../../shared/verdict';
import { trackAction } from '../lib/analytics';
import { fetchAvatar, postComment, postJoin } from '../lib/api';
import { formatTime, hasJoined, markJoined, untilNextCase } from '../lib/util';
import { Burst } from './Burst';
import { Leaderboard } from './Leaderboard';
import { SolveSteps } from './SolveSteps';
import { Suspect } from './Suspect';

type Props = {
  c: PublicCase;
  result: AccuseResult;
  commented: boolean;
  /** True while the server is still confirming: the reveal shows, the numbers follow. */
  pending?: boolean;
  /** Where the game is played; shows a join button when known. */
  subredditName?: string | null;
  /**
   * The player's streak today, for their badge. On an older case the result's
   * own streak is the one from that day, so the badge needs today's.
   */
  badgeStreak?: Streak | null;
};

function burstPath(): string {
  const cx = 130;
  const cy = 104;
  const points = 18;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 102 : 80;
    const a = (Math.PI * i) / points;
    d += `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)} `;
  }
  return `${d}Z`;
}

const BURST = burstPath();

export const Result = ({
  c,
  result,
  commented,
  pending = false,
  subredditName = null,
  badgeStreak = null,
}: Props) => {
  const nowStreak = badgeStreak ?? result.streak;
  const badge = badgeFor(nowStreak?.current ?? 0);
  const next = nextBadge(nowStreak?.current ?? 0);
  const [comment, setComment] = useState<'idle' | 'posting' | 'posted'>(
    commented ? 'posted' : 'idle'
  );

  // The player's snoovatar for their detective card. Loaded after the
  // reveal so it never slows the game down; the card works without it.
  const [avatar, setAvatar] = useState<{
    username: string | null;
    url: string | null;
  } | null>(null);
  useEffect(() => {
    let live = true;
    void fetchAvatar().then((a) => {
      if (live && a) {
        setAvatar({ username: a.username, url: a.url });
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const [join, setJoin] = useState<'idle' | 'joining' | 'joined'>(() =>
    hasJoined() ? 'joined' : 'idle'
  );
  const joinSub = async () => {
    setJoin('joining');
    try {
      await postJoin();
      markJoined();
      setJoin('joined');
      trackAction('join_subreddit');
      showToast(`Joined! Tomorrow's case will be in your feed.`);
    } catch {
      // Reddit only lets an app join a sub for the player after the app is
      // reviewed. Until then, open the sub so they can tap Reddit's own Join.
      setJoin('idle');
      trackAction('join_subreddit');
      showToast('Tap JOIN at the top of the page.');
      navigateTo(
        `https://www.reddit.com/r/${subredditName ?? 'WhoFartedDaily'}/`
      );
    }
  };

  const postVerdict = async () => {
    setComment('posting');
    try {
      await postComment(c.id);
      setComment('posted');
      trackAction('post_verdict');
      showToast('Verdict posted! Scroll down to see it in the comments.');
    } catch (err) {
      setComment('idle');
      showToast(
        err instanceof Error ? err.message : 'Could not post. Try again.'
      );
    }
  };

  const culpritFood =
    result.lunches.find((l) => l.id === result.culprit)?.food ?? null;
  const total = Math.max(result.totalPlayers, 1);

  const rows = useMemo(() => {
    const counts = new Map(result.blame.map((b) => [b.id, b.count]));
    const top = Math.max(1, ...result.blame.map((b) => b.count));
    return c.suspects
      .map((s) => ({ id: s.id, count: counts.get(s.id) ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .map((r) => ({
        ...r,
        pct: Math.round((r.count / total) * 100),
        width: `${Math.round((r.count / top) * 100)}%`,
      }));
  }, [c.suspects, result.blame, total]);

  const rightPct = rows.find((r) => r.id === result.culprit)?.pct ?? 0;

  const v = verdictFor(c.number, c.suspects.length, result);
  const verdict = [v.title, v.line, v.footer].join('\n');

  const copyVerdict = async () => {
    try {
      await navigator.clipboard.writeText(verdict);
      showToast('Verdict copied. Paste it in the comments!');
    } catch {
      showToast('Could not copy. Long-press the text to copy it.');
    }
  };

  return (
    <div className="halftone min-h-full overflow-x-hidden">
      <div className="mx-auto flex max-w-[440px] flex-col items-center gap-3 px-3 pt-4 pb-6">
        <span className="sticker-sm rounded-md bg-white px-2 py-0.5 text-[12px] font-bold">
          CASE #{c.number} · FLOOR {c.floor} · CLOSED
        </span>
        <h1 className="logo pop m-0 -rotate-3 text-center text-[52px] leading-none">
          {result.correct ? 'GOTCHA!' : 'WRONG GUESS!'}
        </h1>

        <div className="relative flex h-[214px] w-[260px] items-end justify-center">
          <Burst win={result.correct} />
          <svg
            viewBox="0 0 260 214"
            className="burst-spin absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <path
              d={BURST}
              fill={result.correct ? '#FFC93C' : '#8FE3D6'}
              stroke="#141414"
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
          </svg>
          <Suspect
            id={result.culprit}
            mood="guilty"
            className="pop relative mb-2 h-[170px] w-auto"
          />
          <span className="display sticker absolute -bottom-2 left-1/2 -translate-x-1/2 -rotate-3 bg-tomato px-3 text-[20px] whitespace-nowrap">
            {CAST[result.culprit].name.toUpperCase()} DID IT
          </span>
        </div>

        <p
          className={`m-0 mt-3 min-h-[22px] text-center text-[15px] font-medium italic ${pending ? 'opacity-0' : 'rise'}`}
        >
          {pending ? '' : `“${confession(result.culprit, culpritFood)}”`}
        </p>
        {!result.correct && (
          <>
            <p className="sticker-sm m-0 rounded-lg bg-pink px-2 py-1 text-center text-[15px] font-bold">
              It was {CAST[result.culprit].name}, not{' '}
              {CAST[result.guessed].name}.
            </p>
            <p className="m-0 text-center text-[14px] font-medium">
              {pending
                ? 'So close! See you tomorrow, detective.'
                : `So close! Only ${rightPct}% got it today. See you tomorrow, detective.`}
            </p>
            <section className="sticker w-full rounded-2xl bg-white px-3 py-2.5">
              <p className="display m-0 mb-1.5 text-[15px]">HOW TO SOLVE IT</p>
              <SolveSteps
                c={c}
                culprit={result.culprit}
                guessed={result.guessed}
              />
            </section>
          </>
        )}

        <div className="flex w-full justify-center gap-2.5">
          <div className="sticker-sm -rotate-3 bg-white px-3 py-1 text-center">
            <p className="display m-0 text-[22px]">
              {formatTime(result.seconds)}
            </p>
            <p className="m-0 text-[11.5px] font-medium">time</p>
          </div>
          <div className="sticker-sm rotate-2 bg-white px-3 py-1 text-center">
            <p className="display m-0 text-[22px]">
              {result.cluesRead} / {c.suspects.length}
            </p>
            <p className="m-0 text-[11.5px] font-medium">clues heard</p>
          </div>
          <div className="sticker -rotate-1 bg-sun px-3 py-1 text-center">
            <p className="display m-0 text-[22px]">
              {pending
                ? '…'
                : result.streak
                  ? `${result.streak.current} DAY${result.streak.current === 1 ? '' : 'S'}`
                  : '—'}
            </p>
            <p className="m-0 text-[11.5px] font-bold">
              {pending || result.streak ? 'streak' : 'log in for streaks'}
            </p>
          </div>
        </div>

        {nowStreak && (
          <section className="sticker-sm flex w-full items-center gap-2.5 rounded-2xl bg-white px-3 py-2">
            {avatar?.url && (
              <span className="pop flex h-[84px] w-[64px] shrink-0 items-end justify-center overflow-hidden rounded-xl border-2 border-ink bg-mint">
                <img
                  src={avatar.url}
                  alt=""
                  className="h-[80px] w-auto object-contain"
                  onError={() =>
                    setAvatar((a) => (a ? { ...a, url: null } : a))
                  }
                />
              </span>
            )}
            <span className="flex min-w-0 flex-col items-start gap-1">
              {avatar?.username && (
                <span className="max-w-full truncate text-[13px] font-bold">
                  u/{avatar.username}
                </span>
              )}
              <span
                className="rounded-md border-2 border-ink px-2 py-0.5 text-[13px] font-bold whitespace-nowrap"
                style={{
                  background: badge.background,
                  color: badge.textColor === 'light' ? '#ffffff' : '#141414',
                }}
              >
                {badge.text}
              </span>
              <span className="text-[12.5px] leading-tight text-ink-soft">
                Your badge, shown next to your name here.
                {next
                  ? ` ${next.daysToGo} more day${next.daysToGo === 1 ? '' : 's'} to ${next.title}.`
                  : ' Top rank!'}
              </span>
            </span>
          </section>
        )}

        {result.lunches.length > 0 && (
          <section className="sticker rise w-full rounded-2xl bg-white px-3 py-2.5">
            <p className="display m-0 text-[15px]">WHO ATE WHAT</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {result.lunches.map((l) => (
                <div key={l.id} className="flex items-center gap-1">
                  <Suspect id={l.id} className="h-9 w-auto shrink-0" />
                  <span className="flex flex-col leading-tight">
                    <span className="text-[11.5px] font-bold">
                      {CAST[l.id].name}
                    </span>
                    <span
                      className="w-fit rounded-sm border border-ink px-1 text-[10px] font-bold whitespace-nowrap uppercase"
                      style={{ background: FOOD_COLORS[l.food] }}
                    >
                      {FOODS[l.food].tag}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {pending ? (
          <p className="m-0 text-[13px] font-bold text-ink-soft">
            Counting everyone’s votes…
          </p>
        ) : (
          <section className="sticker rise w-full rounded-2xl bg-white px-3 py-2.5">
            <div className="flex items-baseline justify-between">
              <p className="display m-0 text-[15px]">WHO THE SUB BLAMED</p>
              <p className="m-0 text-[12px] text-ink-soft">
                {result.totalPlayers} sniffer
                {result.totalPlayers === 1 ? '' : 's'}
              </p>
            </div>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <span
                    className={`w-[58px] text-[13.5px] ${r.id === result.culprit ? 'font-bold' : ''}`}
                  >
                    {CAST[r.id].name}
                  </span>
                  <div className="h-4 flex-1 overflow-hidden rounded-lg border-2 border-ink bg-paper">
                    <div
                      className="h-full border-r-2 border-ink"
                      style={{
                        width: r.count ? r.width : '0%',
                        background:
                          r.id === result.culprit ? '#FF5A36' : '#8FE3D6',
                      }}
                    />
                  </div>
                  <span
                    className={`w-9 text-right text-[13.5px] tabular-nums ${r.id === result.culprit ? 'font-bold' : ''}`}
                  >
                    {r.pct}%
                  </span>
                </div>
              ))}
            </div>
            <p className="m-0 mt-2 text-[13px] font-medium">
              {result.correct
                ? `You’re in the ${rightPct}% who sniffed it out.`
                : `Only ${rightPct}% sniffed out ${CAST[result.culprit].name}.`}
            </p>
          </section>
        )}

        <Leaderboard
          date={c.id}
          myStreak={nowStreak?.current ?? null}
          ready={!pending}
        />

        <section className="w-full rounded-2xl border-2 border-dashed border-ink bg-white/80 px-3 py-2">
          <p className="m-0 text-[11px] font-bold text-ink-soft">
            YOUR VERDICT (NO SPOILERS)
          </p>
          <p className="m-0 mt-0.5 text-[13px] whitespace-pre-line">
            {verdict}
          </p>
        </section>

        {result.correct && (
          <details className="w-full rounded-2xl border-2 border-ink bg-white px-3 py-2">
            <summary className="tap text-[14px] font-bold">
              See how to solve it
            </summary>
            <div className="mt-2">
              <SolveSteps c={c} culprit={result.culprit} />
            </div>
          </details>
        )}

        <button
          type="button"
          className="btn display flex w-full items-center justify-center gap-2 rounded-xl bg-tomato py-2.5 text-[21px] disabled:bg-mint disabled:opacity-100"
          disabled={pending || comment !== 'idle'}
          onClick={() => void postVerdict()}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 6h14v9H10l-4 3v-3H5z"
              fill="none"
              stroke="#141414"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </svg>
          {comment === 'posted'
            ? 'VERDICT POSTED ✓'
            : comment === 'posting'
              ? 'POSTING…'
              : 'POST MY VERDICT'}
        </button>
        <p className="m-0 -mt-1 text-center text-[12.5px] text-ink-soft">
          {comment === 'posted'
            ? 'Your verdict is in the comments below. No spoilers.'
            : 'Posts this as a comment on today’s case. No spoilers.'}{' '}
          <button
            type="button"
            className="tap border-0 bg-transparent p-0 text-[12.5px] font-bold text-ink underline"
            onClick={() => void copyVerdict()}
          >
            Copy instead
          </button>
        </p>
        {subredditName && join !== 'joined' && (
          <div className="flex w-full flex-col items-center gap-1">
            <button
              type="button"
              className="btn w-full rounded-xl bg-mint py-2.5 text-[17px] font-extrabold"
              disabled={join === 'joining'}
              onClick={() => void joinSub()}
            >
              {join === 'joining' ? 'Joining…' : `+ Join r/${subredditName}`}
            </button>
            <p className="m-0 text-center text-[12.5px] text-ink-soft">
              Tomorrow’s case lands in your feed.
            </p>
          </div>
        )}
        <p className="m-0 text-[12.5px] font-medium">
          Next elevator in {untilNextCase()}
        </p>
      </div>
    </div>
  );
};
