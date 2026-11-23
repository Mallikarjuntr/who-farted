import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { BoardRow, LeaderboardResponse } from '../../shared/api';
import { badgeFor } from '../../shared/badges';
import { fetchLeaderboard } from '../lib/api';
import { formatTime } from '../lib/util';

type Props = {
  /** The case date, so old case posts show their own day's board. */
  date: string;
  /** The player's current streak, shown under the streak board when they are not on it. */
  myStreak: number | null;
  /** Wait until the guess is saved before reading the boards. */
  ready: boolean;
};

type Tab = 'today' | 'streaks';

const MEDALS = ['🥇', '🥈', '🥉'];

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'today', label: 'TODAY’S FASTEST' },
  { id: 'streaks', label: 'LONGEST STREAKS' },
];

const Row = ({
  row,
  mine,
  value,
  extra,
}: {
  row: BoardRow | null;
  mine: boolean;
  value: string;
  extra?: ReactNode;
}) => (
  <li
    className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${mine ? 'border-2 border-ink bg-sun' : ''}`}
  >
    <span className="w-6 shrink-0 text-center text-[15px] font-bold tabular-nums">
      {row ? (MEDALS[row.rank - 1] ?? row.rank) : '·'}
    </span>
    <span className="flex min-w-0 flex-1 flex-col items-start">
      <span className="max-w-full truncate text-[13.5px] font-bold">
        {row ? `u/${row.username}` : 'You'}
        {mine && row ? ' (you)' : ''}
      </span>
      {extra}
    </span>
    <span className="display shrink-0 text-[16px] tabular-nums">{value}</span>
  </li>
);

/** "TOP SNIFFERS": today's fastest right guesses and the longest streaks. */
export const Leaderboard = ({ date, myStreak, ready }: Props) => {
  const [tab, setTab] = useState<Tab>('today');
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }
    let live = true;
    void fetchLeaderboard(date).then((b) => {
      if (live) {
        setBoard(b);
      }
    });
    return () => {
      live = false;
    };
  }, [date, ready]);

  if (!board) {
    return null;
  }

  const me = board.username?.toLowerCase() ?? null;
  const isMe = (r: BoardRow) => r.username.toLowerCase() === me;
  const meOnToday = board.today.some(isMe);
  const meOnStreaks = board.streaks.some(isMe);
  const days = (n: number) => `${n} DAY${n === 1 ? '' : 'S'}`;

  return (
    <section className="sticker rise w-full rounded-2xl bg-white px-3 py-2.5">
      <p className="display m-0 text-[15px]">TOP SNIFFERS</p>
      <div className="mt-1.5 flex gap-1.5" role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`tap flex-1 rounded-lg border-2 border-ink py-1 text-[12.5px] font-extrabold ${tab === id ? 'bg-tomato' : 'bg-paper'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'today' ? (
        <>
          <ol className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0">
            {board.today.map((r) => (
              <Row
                key={r.username}
                row={r}
                mine={isMe(r)}
                value={formatTime(r.value)}
              />
            ))}
            {board.me && !meOnToday && (
              <>
                <li className="text-center text-[12px] leading-none text-ink-soft">
                  ⋮
                </li>
                <Row row={board.me} mine value={formatTime(board.me.value)} />
              </>
            )}
          </ol>
          <p className="m-0 mt-1.5 text-[12.5px] text-ink-soft">
            {board.today.length === 0
              ? 'Nobody has sniffed it out yet today.'
              : board.me
                ? `You’re #${board.me.rank} of ${board.todayCount} who got it right.`
                : `${board.todayCount} got it right today. Guess right tomorrow to get on the board!`}
          </p>
        </>
      ) : (
        <>
          <ol className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0">
            {board.streaks.map((r) => {
              const badge = badgeFor(r.value);
              return (
                <Row
                  key={r.username}
                  row={r}
                  mine={isMe(r)}
                  value={days(r.value)}
                  extra={
                    <span
                      className="rounded-sm border border-ink px-1 text-[10px] leading-[14px] font-bold whitespace-nowrap"
                      style={{
                        background: badge.background,
                        color:
                          badge.textColor === 'light' ? '#ffffff' : '#141414',
                      }}
                    >
                      {badge.title}
                    </span>
                  }
                />
              );
            })}
            {!meOnStreaks && myStreak !== null && myStreak > 0 && (
              <>
                {board.streaks.length > 0 && (
                  <li className="text-center text-[12px] leading-none text-ink-soft">
                    ⋮
                  </li>
                )}
                <Row row={null} mine value={days(myStreak)} />
              </>
            )}
          </ol>
          <p className="m-0 mt-1.5 text-[12.5px] text-ink-soft">
            {board.streaks.length === 0
              ? 'No streaks yet. Guess right to start one!'
              : 'Guess right every day to climb. One wrong guess resets it.'}
          </p>
        </>
      )}
    </section>
  );
};
