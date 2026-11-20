import { CAST, SUSPECT_IDS } from '../../shared/puzzle/cast';
import { Suspect } from './Suspect';

/** The six suspects, who they are and how each one gives clues. */
export const SuspectList = ({ compact = false }: { compact?: boolean }) => (
  <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-left">
    {SUSPECT_IDS.map((id) => (
      <li
        key={id}
        className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-1.5 py-1"
      >
        <Suspect
          id={id}
          className={`${compact ? 'h-10' : 'h-12'} w-auto shrink-0`}
        />
        <span
          className={`leading-snug ${compact ? 'text-[13px]' : 'text-[14px]'}`}
        >
          <strong>{CAST[id].name}</strong>
          <span className="font-medium text-ink-soft"> · {CAST[id].role}</span>
          <span className="block">{CAST[id].how}</span>
        </span>
      </li>
    ))}
  </ul>
);

/** The two rules that make every clue fair. */
export const GoldenRule = () => (
  <div className="sticker-sm rounded-xl bg-sun px-2.5 py-1.5 text-left text-[14px] leading-snug">
    <p className="m-0">
      <strong>Golden rule:</strong> everyone tells the truth.
    </p>
    <p className="m-0">
      <strong>Weekends:</strong> the farter LIES. Everyone else still tells the
      truth.
    </p>
  </div>
);

/** Shown after PRACTICE is tapped, before the practice case starts. */
export const MeetSuspects = ({ onStart }: { onStart: () => void }) => (
  <div className="halftone flex min-h-full items-center justify-center p-4">
    <div className="sticker pop flex w-full max-w-[400px] flex-col gap-2.5 rounded-2xl bg-white p-4">
      <h1 className="logo m-0 text-center text-[32px] leading-none">
        MEET THE SUSPECTS
      </h1>
      <SuspectList />
      <GoldenRule />
      <button
        type="button"
        className="btn display w-full rounded-xl bg-tomato py-2.5 text-[22px]"
        onClick={onStart}
      >
        START PRACTICE
      </button>
    </div>
  </div>
);
