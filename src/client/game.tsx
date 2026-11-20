import './index.css';

import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { AccuseResult, CaseResponse } from '../shared/api';
import type { PublicCase, Statement, SuspectId } from '../shared/puzzle/types';
import { CAST } from '../shared/puzzle/cast';
import {
  analyzeCase,
  isProvenInnocent,
  possibleCulprits,
} from '../shared/puzzle/solver';
import { Lift } from './components/Lift';
import { Result } from './components/Result';
import { SolveSteps } from './components/SolveSteps';
import type { Mood } from './components/Suspect';
import { Suspect } from './components/Suspect';
import { fetchCase, postAccuse, resetPlay } from './lib/api';
import { TestBar } from './components/TestBar';
import { setSoundOn, sfx, soundOn } from './lib/sound';
import {
  trackAction,
  trackClue,
  trackEnd,
  trackReady,
  trackStart,
} from './lib/analytics';
import {
  FOOD_COLORS,
  cellKey,
  mentionedIn,
  groupFacts,
  lunchTags,
  meaningParts,
  profileChips,
  zoneFor,
} from './lib/clues';
import { PRACTICE_CASE, PRACTICE_CULPRIT, coachStep } from './lib/practice';
import {
  clearRulesSeen,
  formatTime,
  hasSeenRules,
  markRulesSeen,
  shiftDay,
  takeOpenSuspect,
} from './lib/util';

type Note = { tone: 'info' | 'warn' | 'good'; text: string } | null;

/** Clues about lunches, where the one-lunch rule matters. */
const FOOD_KINDS: readonly Statement['kind'][] = [
  'culpritAte',
  'culpritDidNotEat',
  'ate',
  'didNotEat',
  'sameMeal',
  'foodCount',
];

const Rules = ({
  liarMode,
  onClose,
}: {
  liarMode: boolean;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-30 flex items-center justify-center bg-ink/60 p-5"
    role="dialog"
    aria-modal="true"
    aria-labelledby="rules-title"
  >
    <div className="sticker pop w-full max-w-[360px] rounded-2xl bg-white p-5">
      <h2 id="rules-title" className="logo m-0 text-center text-[30px]">
        HOW TO PLAY
      </h2>
      <ol className="mt-4 mb-0 flex list-none flex-col gap-3 p-0 text-[16px] leading-snug">
        <li>
          <strong>1. Tap a person.</strong> Read their clue.
        </li>
        <li>
          <strong>2. Mark the innocent</strong> people. This is NOT your guess.
        </li>
        <li>
          <strong>3. Tap GUESS THE FARTER.</strong> You get ONE guess.
        </li>
        {liarMode && (
          <li className="sticker-sm rounded-lg bg-sun px-2 py-1.5">
            <strong>Weekend:</strong> the farter LIES. Everyone else tells the
            truth.
          </li>
        )}
      </ol>
      <button
        type="button"
        className="btn display mt-5 w-full rounded-xl bg-tomato py-2 text-[22px]"
        onClick={onClose}
      >
        GOT IT
      </button>
    </div>
  </div>
);

const Welcome = ({
  onPractice,
  onSkip,
}: {
  onPractice: () => void;
  onSkip: () => void;
}) => (
  <div className="halftone flex min-h-full items-center justify-center p-5">
    <div className="sticker pop flex w-full max-w-[360px] flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center">
      <h1 className="logo m-0 text-[38px] leading-none">WHO FARTED?</h1>
      <div className="flex h-24 items-end gap-1" aria-hidden="true">
        <Suspect id="agnes" mood="shifty" className="h-20 w-auto" />
        <Suspect id="biscuit" mood="guilty" className="h-24 w-auto" />
        <Suspect id="brock" mood="shifty" className="h-20 w-auto" />
      </div>
      <p className="m-0 text-[16px] leading-snug font-medium">
        Someone farted in the lift. Read the clues. Find the farter.
      </p>
      <button
        type="button"
        className="btn display w-full rounded-xl bg-tomato py-2.5 text-[22px]"
        onClick={onPractice}
      >
        PRACTICE (30 SEC)
      </button>
      <button
        type="button"
        className="btn w-full rounded-xl bg-white py-2 text-[15px] font-bold"
        onClick={onSkip}
      >
        I know how. Skip.
      </button>
    </div>
  </div>
);

type GameProps = {
  c: PublicCase;
  initialResult: AccuseResult | null;
  practice?: boolean;
  onPracticeDone?: () => void;
  onPracticeRetry?: () => void;
  /** Whether the player already posted their verdict comment on this case. */
  commented?: boolean;
  /** Where the game is played, for the join button on the result screen. */
  subredditName?: string | null;
};

const Game = ({
  c,
  initialResult,
  practice = false,
  onPracticeDone,
  onPracticeRetry,
  commented = false,
  subredditName = null,
}: GameProps) => {
  const analysis = useMemo(() => analyzeCase(c), [c]);
  const indexOf = useCallback(
    (id: SuspectId) => c.suspects.findIndex((s) => s.id === id),
    [c]
  );

  // The feed card can open the game straight onto the suspect that was tapped.
  const [opened] = useState<SuspectId | null>(() => {
    if (practice) {
      return null;
    }
    const first = takeOpenSuspect();
    return first && c.suspects.some((s) => s.id === first) ? first : null;
  });
  const [selected, setSelected] = useState<SuspectId | null>(opened);
  const [read, setRead] = useState<Set<SuspectId>>(
    () => new Set(opened ? [opened] : [])
  );
  const [crossed, setCrossed] = useState<Set<SuspectId>>(new Set());
  const [shaking, setShaking] = useState<SuspectId | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [hints, setHints] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [accusing, setAccusing] = useState(false);
  const [confirm, setConfirm] = useState<SuspectId | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<AccuseResult | null>(initialResult);
  const [practiceWon, setPracticeWon] = useState(false);
  const [practiceLost, setPracticeLost] = useState<SuspectId | null>(null);
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef<number | null>(null);
  const [sound, setSound] = useState(soundOn);
  const [pending, setPending] = useState(false);
  // With every clue, exactly one person fits: that is the answer.
  const localCulprit = useMemo(() => {
    const left = possibleCulprits(
      analysis,
      c.testimonies.map((_, i) => i)
    );
    return left.length === 1 ? (left[0] ?? null) : null;
  }, [analysis, c.testimonies]);
  const [bubble, setBubble] = useState<{
    id: SuspectId;
    text: string;
    key: number;
  } | null>(null);

  /** A suspect pipes up for a moment ("Phew!", "Prove it!"). */
  const say = (id: SuspectId, text: string) => {
    const key = Date.now();
    setBubble({ id, text, key });
    window.setTimeout(
      () => setBubble((current) => (current?.key === key ? null : current)),
      2200
    );
  };

  const playing = !showRules && !result && !practiceWon && !practiceLost;

  // Analytics: the real case is loaded and playable.
  useEffect(() => {
    if (!practice && !initialResult) {
      trackReady();
    }
  }, [practice, initialResult]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    startRef.current ??= Date.now() - seconds * 1000;
    const timer = window.setInterval(() => {
      setSeconds(
        Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000)
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, seconds]);

  const select = (id: SuspectId) => {
    sfx.tap();
    setSelected(id);
    setNote(null);
    if (!practice && !read.has(id)) {
      trackStart();
      trackClue(read.size + 1, c.suspects.length);
    }
    setRead((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  const readIndexes = useMemo(
    () => [...read].map(indexOf).filter((i) => i >= 0),
    [read, indexOf]
  );
  const readStatements = useMemo(
    () =>
      readIndexes
        .map((i) => c.testimonies[i]?.statement)
        .filter((s) => s !== undefined),
    [readIndexes, c]
  );
  const tags = useMemo(() => lunchTags(readStatements), [readStatements]);
  const chips = useMemo(() => profileChips(readStatements), [readStatements]);
  const facts = useMemo(() => groupFacts(readStatements), [readStatements]);
  const aboutFood = readStatements.some((st) => FOOD_KINDS.includes(st.kind));
  const coach = practice ? coachStep(read, crossed) : null;

  const testimony = selected ? c.testimonies[indexOf(selected)] : undefined;
  const zone = testimony ? zoneFor(testimony.statement, c.suspects) : null;

  // Anyone the open clue names, or who stands where it says the farter was, looks nervous.
  const moods = useMemo(() => {
    const map = new Map<SuspectId, Mood>();
    if (!testimony) {
      return map;
    }
    for (const id of mentionedIn(testimony.statement)) {
      map.set(id, 'nervous');
    }
    if (zone?.tone === 'maybe') {
      for (const s of c.suspects) {
        if (zone.cells.has(cellKey(s.slot))) {
          map.set(s.id, 'nervous');
        }
      }
    }
    return map;
  }, [testimony, zone, c.suspects]);

  const toggleCross = (id: SuspectId) => {
    if (crossed.has(id)) {
      setCrossed((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setNote(null);
      return;
    }
    if (!isProvenInnocent(analysis, readIndexes, id)) {
      if (!practice) {
        trackAction('prove_it_blocked');
      }
      setShaking(id);
      say(id, 'Prove it!');
      sfx.boing();
      window.setTimeout(() => setShaking(null), 400);
      setNote({
        tone: 'warn',
        text: `“Prove it!” No clue proves ${CAST[id].name} is innocent yet. Read more clues.`,
      });
      return;
    }
    if (!practice) {
      trackAction('mark_innocent');
    }
    sfx.stamp();
    say(
      id,
      ['Phew!', 'Told you!', 'Free at last!', 'Thank you!'][crossed.size % 4] ??
        'Phew!'
    );
    setCrossed((prev) => new Set(prev).add(id));
    const left = c.suspects.filter((s) => s.id !== id && !crossed.has(s.id));
    setNote(
      left.length === 1 && left[0]
        ? {
            tone: 'good',
            text: `Only ${CAST[left[0].id].name} is left. Tap GUESS THE FARTER!`,
          }
        : {
            tone: 'good',
            text: `Correct! The clues prove ${CAST[id].name} is innocent.`,
          }
    );
  };

  /** Names the fewest clues already read that clear someone, so a hint teaches why. */
  const clearHint = (id: SuspectId): string => {
    const who = CAST[id].name;
    const speaker = (i: number): string => {
      const t = c.testimonies[i];
      return t ? `${CAST[t.speaker].name}’s clue` : 'a clue';
    };
    const single = readIndexes.find((i) => isProvenInnocent(analysis, [i], id));
    if (single !== undefined) {
      const plain = c.testimonies[single]?.plain ?? '';
      return `You can mark ${who} innocent. Why? ${speaker(single)}: “${plain}”`;
    }
    for (const i of readIndexes) {
      for (const j of readIndexes) {
        if (i < j && isProvenInnocent(analysis, [i, j], id)) {
          return `You can mark ${who} innocent. Why? Put ${speaker(i)} and ${speaker(j)} together.`;
        }
      }
    }
    return `You can mark ${who} innocent. Why? Put the clues you’ve read together.`;
  };

  const hint = () => {
    setHints((h) => h + 1);
    if (!practice) {
      trackAction('hint');
    }
    const clearable = c.suspects.find(
      (s) => !crossed.has(s.id) && isProvenInnocent(analysis, readIndexes, s.id)
    );
    if (clearable) {
      setNote({ tone: 'info', text: clearHint(clearable.id) });
      return;
    }
    const unread = c.suspects.find((s) => !read.has(s.id));
    if (unread) {
      setNote({
        tone: 'info',
        text: `Read ${CAST[unread.id].name}’s clue next.`,
      });
      return;
    }
    const left = possibleCulprits(analysis, readIndexes);
    setNote({
      tone: 'info',
      text:
        left.length === 1
          ? 'Only one person fits every clue. Guess them!'
          : c.liarMode
            ? 'Two clues can’t both be true. One of them is the farter’s lie.'
            : 'Use a food clue about the farter with a food clue about a person.',
    });
  };

  const sendAccusation = async (id: SuspectId) => {
    if (practice) {
      setConfirm(null);
      setAccusing(false);
      if (id === PRACTICE_CULPRIT) {
        sfx.win();
        setPracticeWon(true);
      } else {
        sfx.lose();
        setPracticeLost(id);
      }
      return;
    }
    // The game already knows the answer, so reveal it instantly and let the
    // server's numbers (blame split, streak) arrive a moment later.
    if (localCulprit) {
      const correct = id === localCulprit;
      if (correct) {
        sfx.win();
      } else {
        sfx.lose();
      }
      setResult({
        correct,
        guessed: id,
        culprit: localCulprit,
        lunches: [],
        seconds,
        cluesRead: read.size,
        hints,
        blame: [],
        totalPlayers: 0,
        streak: null,
      });
      setPending(true);
      setAccusing(false);
      setConfirm(null);
    }
    setSending(true);
    try {
      const res = await postAccuse({
        suspect: id,
        date: c.id,
        seconds,
        cluesRead: read.size,
        hints,
      });
      trackEnd(res.result.correct, seconds, read.size);
      if (!localCulprit) {
        if (res.result.correct) {
          sfx.win();
        } else {
          sfx.lose();
        }
      }
      setResult(res.result);
      setPending(false);
      setAccusing(false);
      setConfirm(null);
    } catch (err) {
      console.error(err);
      // The guess didn't reach the server: go back to the lift so it can be sent again.
      setResult(null);
      setPending(false);
      setNote({ tone: 'warn', text: 'Something went wrong. Try again.' });
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <Result
        c={c}
        result={result}
        commented={commented}
        pending={pending}
        subredditName={subredditName}
      />
    );
  }

  if (practiceLost) {
    return (
      <div className="halftone min-h-full p-4">
        <div className="sticker pop mx-auto flex w-full max-w-[400px] flex-col items-center gap-3 rounded-2xl bg-white p-4 text-center">
          <h1 className="logo m-0 text-[38px] leading-none">WRONG GUESS!</h1>
          <p className="m-0 text-[15px] font-bold">
            It was Biscuit, not {CAST[practiceLost].name}. In the real game,
            that means game over.
          </p>
          <div className="w-full text-left">
            <p className="display m-0 mb-1.5 text-[15px]">HOW TO SOLVE IT</p>
            <SolveSteps c={c} culprit={PRACTICE_CULPRIT} />
          </div>
          <button
            type="button"
            className="btn display w-full rounded-xl bg-sun py-2 text-[20px]"
            onClick={onPracticeRetry}
          >
            TRY PRACTICE AGAIN
          </button>
          <button
            type="button"
            className="btn w-full rounded-xl bg-white py-2 text-[15px] font-bold"
            onClick={onPracticeDone}
          >
            Start today’s case
          </button>
        </div>
      </div>
    );
  }

  if (practiceWon) {
    return (
      <div className="halftone flex min-h-full items-center justify-center p-5">
        <div className="sticker pop flex w-full max-w-[360px] flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center">
          <h1 className="logo m-0 text-[40px] leading-none">NAILED IT!</h1>
          <Suspect id="biscuit" mood="guilty" className="h-28 w-auto" />
          <p className="m-0 text-[16px] leading-snug font-medium">
            Biscuit did it. You’re ready for the real case: more people, same
            rules.
          </p>
          <button
            type="button"
            className="btn display w-full rounded-xl bg-tomato py-2.5 text-[22px]"
            onClick={onPracticeDone}
          >
            START TODAY’S CASE
          </button>
        </div>
      </div>
    );
  }

  const noteStyle =
    note?.tone === 'warn'
      ? 'bg-pink'
      : note?.tone === 'good'
        ? 'bg-mint'
        : 'bg-sun';

  return (
    <div className="halftone min-h-full">
      <div className="mx-auto flex min-h-full max-w-[440px] flex-col gap-3 px-3 pt-2 pb-28 md:grid md:max-w-[940px] md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-x-6 md:pt-4">
        <header className="flex items-center justify-between md:col-span-2">
          <span className="sticker-sm shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[12px] font-bold whitespace-nowrap">
            {practice ? 'PRACTICE' : `#${c.number} · FL ${c.floor}`}
          </span>
          <h1 className="logo m-0 text-[19px] leading-none whitespace-nowrap md:text-[30px]">
            WHO FARTED?
          </h1>
          <div className="flex items-center gap-1.5">
            <span className="sticker-sm bg-sun px-1.5 text-[13px] font-bold tabular-nums">
              {formatTime(seconds)}
            </span>
            <button
              type="button"
              aria-label={sound ? 'Turn sound off' : 'Turn sound on'}
              aria-pressed={sound}
              className="btn flex h-9 w-9 items-center justify-center rounded-full bg-white"
              onClick={() => {
                const next = !sound;
                setSoundOn(next);
                setSound(next);
                if (next) {
                  sfx.tap();
                }
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d={
                    sound
                      ? 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11'
                      : 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6'
                  }
                  fill="none"
                  stroke="#141414"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              aria-label="How to play"
              className="btn display h-9 w-9 rounded-full bg-white text-[18px]"
              onClick={() => {
                if (!practice) {
                  trackAction('open_rules');
                }
                setShowRules(true);
              }}
            >
              ?
            </button>
          </div>
        </header>

        {coach && (
          <p
            className="sticker rise m-0 rounded-xl bg-sun px-3 py-2 text-[15px] leading-snug font-bold md:col-span-2"
            role="status"
          >
            {coach.text}
          </p>
        )}

        {c.liarMode && (
          <p className="sticker-sm m-0 rounded-lg bg-sun px-2 py-1 text-center text-[14px] font-bold md:col-span-2">
            Weekend: the farter LIES. Everyone else tells the truth.
          </p>
        )}

        <div className="md:sticky md:top-4">
          <Lift
            suspects={c.suspects}
            selected={selected}
            read={read}
            crossed={crossed}
            shaking={shaking}
            zone={zone}
            moods={moods}
            bubble={bubble}
            tags={tags}
            pulse={coach?.target ?? null}
            onSelect={select}
          />
        </div>

        <div className="flex flex-col gap-3">
          {testimony && selected ? (
            <section
              className="rise relative rounded-2xl border-[3px] border-ink bg-white px-3.5 pt-2.5 pb-3"
              aria-live="polite"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-bold tracking-wide text-ink-soft">
                  {CAST[selected].name.toUpperCase()}’S CLUE
                </span>
                <span className="text-[11.5px] font-bold text-ink-soft">
                  {read.size} OF {c.suspects.length} READ
                </span>
              </div>
              <p className="m-0 mt-1 text-[19px] leading-snug font-medium">
                {meaningParts(testimony.plain).map((part, i) =>
                  part.food ? (
                    <strong
                      key={i}
                      className="rounded-md border-2 border-ink px-1"
                      style={{ background: FOOD_COLORS[part.food] }}
                    >
                      {part.text}
                    </strong>
                  ) : part.strong ? (
                    <strong key={i}>{part.text}</strong>
                  ) : (
                    <span key={i}>{part.text}</span>
                  )
                )}
              </p>
              {c.liarMode && (
                <p className="m-0 mt-1 text-[13px] font-bold text-tomato">
                  This could be the farter’s lie.
                </p>
              )}
              <p className="m-0 mt-2 rounded-md bg-paper px-2 py-1 text-[13px] leading-snug text-ink-soft italic">
                {testimony.quote}
              </p>
              <button
                type="button"
                className="btn mt-2.5 w-full rounded-xl bg-white py-1.5 text-[15px] font-bold"
                onClick={() => toggleCross(selected)}
              >
                {crossed.has(selected)
                  ? `Undo: unmark ${CAST[selected].name}`
                  : `✗ MARK ${CAST[selected].name.toUpperCase()} INNOCENT`}
              </button>
            </section>
          ) : (
            <section className="rounded-2xl border-[3px] border-dashed border-ink bg-white/70 px-3.5 py-3 text-center">
              <p className="m-0 text-[16px] font-bold">
                Tap a person to read their clue.
              </p>
            </section>
          )}

          {note && (
            <p
              className={`sticker-sm rise m-0 rounded-lg px-2.5 py-1.5 text-[15px] font-medium ${noteStyle}`}
              role="status"
            >
              {note.text}
            </p>
          )}

          {(chips.length > 0 || facts.length > 0) && (
            <section className="rounded-2xl border-2 border-ink bg-white px-3 py-2">
              <p className="display m-0 text-[14px]">
                {c.liarMode ? 'CLUES SAY THE FARTER WAS…' : 'THE FARTER WAS…'}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-md border-2 border-ink bg-tomato/20 px-1.5 text-[13px] font-bold"
                  >
                    {chip}
                  </span>
                ))}
                {facts.map((fact) => (
                  <span
                    key={fact}
                    className="rounded-md border-2 border-ink bg-white px-1.5 text-[13px] font-bold"
                  >
                    {fact}
                  </span>
                ))}
              </div>
              {aboutFood && (
                <p className="m-0 mt-1.5 text-[12.5px] font-medium text-ink-soft">
                  Everyone ate just ONE lunch.
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t-[3px] border-ink bg-paper/95 px-3 pt-2.5 pb-3">
        <div className="mx-auto flex max-w-[440px] gap-2">
          <button
            type="button"
            aria-label="Get a hint"
            className="btn flex h-[54px] w-[56px] shrink-0 items-center justify-center rounded-xl bg-white"
            onClick={hint}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"
                fill="none"
                stroke="#141414"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="btn display h-[54px] flex-1 rounded-xl bg-tomato text-[22px]"
            onClick={() => {
              if (!practice) {
                trackAction('open_guess');
              }
              setAccusing(true);
            }}
          >
            GUESS THE FARTER
          </button>
        </div>
      </div>

      {accusing && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink/60 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="accuse-title"
        >
          <div className="sticker rise w-full max-w-[440px] rounded-t-2xl bg-white p-4 sm:rounded-2xl">
            {confirm ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <Suspect id={confirm} mood="shifty" className="h-28 w-auto" />
                <h2 id="accuse-title" className="display m-0 text-[24px]">
                  IS IT {CAST[confirm].name.toUpperCase()}?
                </h2>
                <p className="m-0 text-[15px]">You only get ONE guess!</p>
                <div className="mt-2 flex w-full gap-2">
                  <button
                    type="button"
                    className="btn flex-1 rounded-xl bg-white py-2 font-bold"
                    onClick={() => setConfirm(null)}
                    disabled={sending}
                  >
                    No, wait
                  </button>
                  <button
                    type="button"
                    className="btn display flex-1 rounded-xl bg-tomato py-2 text-[20px]"
                    onClick={() => void sendAccusation(confirm)}
                    disabled={sending}
                  >
                    {sending
                      ? '…'
                      : `YES, IT’S ${CAST[confirm].name.toUpperCase()}!`}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2
                  id="accuse-title"
                  className="display m-0 text-center text-[22px]"
                >
                  WHO IS THE FARTER?
                </h2>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {c.suspects.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={crossed.has(s.id)}
                      className="tap flex flex-col items-center rounded-xl border-2 border-ink bg-paper p-1 disabled:opacity-35"
                      onClick={() => setConfirm(s.id)}
                    >
                      <Suspect id={s.id} className="h-20 w-auto" />
                      <span className="text-[12px] font-bold">
                        {CAST[s.id].name.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn mt-3 w-full rounded-xl bg-white py-2 font-bold"
                  onClick={() => setAccusing(false)}
                >
                  Not yet. Keep looking.
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showRules && (
        <Rules liarMode={c.liarMode} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
};

export const App = () => {
  const [data, setData] = useState<CaseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<'welcome' | 'practice' | 'real'>(() =>
    hasSeenRules() ? 'real' : 'welcome'
  );
  // Test mode only (private test subreddit): which day to load, and a counter to reload it.
  const [testDate, setTestDate] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [practiceRun, setPracticeRun] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCase(testDate)
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setBusy(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load the case.'
          );
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [testDate, reloadKey]);

  const finishIntro = () => {
    markRulesSeen();
    setStage('real');
  };

  const testBar =
    data?.testMode && stage !== 'welcome' ? (
      <TestBar
        c={data.case}
        busy={busy}
        onDay={(delta) => {
          setBusy(true);
          setStage('real');
          setTestDate(shiftDay(data.case.id, delta));
        }}
        onToday={() => {
          setBusy(true);
          setStage('real');
          setTestDate(null);
          setReloadKey((k) => k + 1);
        }}
        onReplay={() => {
          setBusy(true);
          setStage('real');
          resetPlay(data.case.id)
            .catch((err: unknown) => console.error('Reset failed', err))
            .finally(() => setReloadKey((k) => k + 1));
        }}
        onPractice={() => {
          clearRulesSeen();
          setStage('welcome');
        }}
      />
    ) : null;

  if (error) {
    return (
      <div className="halftone flex min-h-full items-center justify-center p-6 text-center">
        <p className="sticker rounded-xl bg-white p-4 font-bold">
          The lift is stuck. {error}
        </p>
      </div>
    );
  }
  // Wait for the server before choosing a screen, so a returning player never
  // sees the intro flash before their result.
  if (!data && stage === 'welcome') {
    return (
      <div className="halftone flex min-h-full items-center justify-center">
        <p className="logo pop text-[34px]">SNIFFING…</p>
      </div>
    );
  }
  // Only brand-new players get the intro. Anyone who has guessed before (on
  // any device) goes straight to the case or their result.
  const isNewPlayer = !data?.result && !data?.returning;
  if (stage === 'welcome' && (isNewPlayer || data?.testMode)) {
    return (
      <Welcome onPractice={() => setStage('practice')} onSkip={finishIntro} />
    );
  }
  if (stage === 'practice') {
    return (
      <>
        {testBar}
        <Game
          key={`practice-${practiceRun}`}
          c={PRACTICE_CASE}
          initialResult={null}
          practice
          onPracticeDone={finishIntro}
          onPracticeRetry={() => setPracticeRun((n) => n + 1)}
        />
      </>
    );
  }
  if (!data) {
    return (
      <div className="halftone flex min-h-full items-center justify-center">
        <p className="logo pop text-[34px]">SNIFFING…</p>
      </div>
    );
  }
  return (
    <>
      {testBar}
      <Game
        key={`real-${data.case.id}-${reloadKey}`}
        c={data.case}
        initialResult={data.result}
        commented={data.commented}
        subredditName={data.subredditName}
      />
    </>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
