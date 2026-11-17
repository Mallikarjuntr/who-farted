import type { PublicCase } from '../../shared/puzzle/types';

type Props = {
  c: PublicCase;
  busy: boolean;
  onDay: (delta: number) => void;
  onToday: () => void;
  onReplay: () => void;
  onPractice: () => void;
};

/** Only shown in the private test subreddit. Never visible to real players. */
export const TestBar = ({
  c,
  busy,
  onDay,
  onToday,
  onReplay,
  onPractice,
}: Props) => (
  <div className="border-b-2 border-dashed border-ink bg-white px-2 py-1.5">
    <div className="mx-auto flex max-w-[440px] flex-wrap items-center justify-center gap-1.5 text-[12px] font-bold">
      <span className="rounded bg-ink px-1.5 py-0.5 text-[11px] tracking-wide text-white">
        TEST MODE
      </span>
      <span>
        #{c.number} · {c.id} · {c.difficulty}
        {c.liarMode ? ' (lies)' : ''}
      </span>
      <div className="flex w-full justify-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          className="btn-test"
          onClick={() => onDay(-1)}
          aria-label="Previous day"
        >
          ◀ Day
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn-test"
          onClick={onToday}
        >
          Today
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn-test"
          onClick={() => onDay(1)}
          aria-label="Next day"
        >
          Day ▶
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn-test bg-sun"
          onClick={onReplay}
        >
          Replay
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn-test"
          onClick={onPractice}
        >
          Practice
        </button>
      </div>
    </div>
  </div>
);
