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
import type { PublicCase, SuspectId } from '../shared/puzzle/types';
import { CAST } from '../shared/puzzle/cast';
import {
  analyzeCase,
  isProvenInnocent,
  possibleCulprits,
} from '../shared/puzzle/solver';
import { Lift } from './components/Lift';
import { Result } from './components/Result';
import { Suspect } from './components/Suspect';
import { fetchCase, postAccuse } from './lib/api';
import { groupFacts, lunchTags, profileChips, zoneFor } from './lib/clues';
import {
  formatTime,
  hasSeenRules,
  markRulesSeen,
  takeOpenSuspect,
} from './lib/util';

type Note = { tone: 'info' | 'warn' | 'good'; text: string } | null;

const Rules = ({ c, onClose }: { c: PublicCase; onClose: () => void }) => (
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
      <ol className="mt-4 mb-0 flex list-none flex-col gap-3 p-0 text-[15px] leading-snug">
        <li>
          <strong>1. Tap a suspect</strong> to hear their side. The clue lights
          up the lift.
        </li>
        <li>
          <strong>2. Cross out</strong> anyone the clues clear. No guessing:
          they’ll protest if you can’t prove it.
        </li>
        <li>
          <strong>3. One accusation.</strong> Make it count.
        </li>
        {c.liarMode && (
          <li className="sticker-sm rounded-lg bg-sun px-2 py-1.5">
            <strong>Weekend rules:</strong> the farter is lying. Everyone else
            tells the truth.
          </li>
        )}
      </ol>
      <button
        type="button"
        className="btn display mt-5 w-full rounded-xl bg-tomato py-2 text-[22px]"
        onClick={onClose}
      >
        LET’S SNIFF
      </button>
    </div>
  </div>
);

const Game = ({ data }: { data: CaseResponse }) => {
  const c = data.case;
  const analysis = useMemo(() => analyzeCase(c), [c]);
  const indexOf = useCallback(
    (id: SuspectId) => c.suspects.findIndex((s) => s.id === id),
    [c]
  );

  // The feed card can open the game straight onto the suspect that was tapped.
  const [opened] = useState<SuspectId | null>(() => {
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
  const [showRules, setShowRules] = useState(!hasSeenRules());
  const [accusing, setAccusing] = useState(false);
  const [confirm, setConfirm] = useState<SuspectId | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<AccuseResult | null>(data.result);
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef<number | null>(null);

  const playing = !showRules && !result;

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

  const select = useCallback((id: SuspectId) => {
    setSelected(id);
    setNote(null);
    setRead((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

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

  const testimony = selected ? c.testimonies[indexOf(selected)] : undefined;
  const zone = testimony ? zoneFor(testimony.statement, c.suspects) : null;

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
      setShaking(id);
      window.setTimeout(() => setShaking(null), 400);
      setNote({
        tone: 'warn',
        text: `“Prove it!” The clues you’ve read don’t clear ${CAST[id].name} yet.`,
      });
      return;
    }
    setCrossed((prev) => new Set(prev).add(id));
    const left = c.suspects.filter((s) => s.id !== id && !crossed.has(s.id));
    setNote(
      left.length === 1 && left[0]
        ? {
            tone: 'good',
            text: `Only ${CAST[left[0].id].name} is left. Time to accuse!`,
          }
        : { tone: 'good', text: `${CAST[id].name} is cleared.` }
    );
  };

  const hint = () => {
    setHints((h) => h + 1);
    const clearable = c.suspects.find(
      (s) => !crossed.has(s.id) && isProvenInnocent(analysis, readIndexes, s.id)
    );
    if (clearable) {
      setNote({
        tone: 'info',
        text: `The clues you’ve read already clear ${CAST[clearable.id].name}.`,
      });
      return;
    }
    const unread = c.suspects.find((s) => !read.has(s.id));
    if (unread) {
      setNote({
        tone: 'info',
        text: `Hear ${CAST[unread.id].name}’s side next.`,
      });
      return;
    }
    const left = possibleCulprits(analysis, readIndexes);
    setNote({
      tone: 'info',
      text:
        left.length === 1
          ? 'Only one suspect fits every clue. Accuse them!'
          : c.liarMode
            ? 'Find two clues that can’t both be true. One of them is the farter’s lie.'
            : 'Combine a lunch clue with a lunch fact about someone.',
    });
  };

  const sendAccusation = async (id: SuspectId) => {
    setSending(true);
    try {
      const res = await postAccuse({
        suspect: id,
        seconds,
        cluesRead: read.size,
        hints,
      });
      setResult(res.result);
      setAccusing(false);
      setConfirm(null);
    } catch (err) {
      console.error(err);
      setNote({ tone: 'warn', text: 'The lift jammed. Try accusing again.' });
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return <Result c={c} result={result} />;
  }

  const noteStyle =
    note?.tone === 'warn'
      ? 'bg-pink'
      : note?.tone === 'good'
        ? 'bg-mint'
        : 'bg-sun';

  return (
    <div className="halftone min-h-full">
      <div className="mx-auto flex min-h-full max-w-[440px] flex-col gap-3 px-3 pt-2 pb-28">
        <header className="flex items-center justify-between">
          <span className="sticker-sm shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[12px] font-bold whitespace-nowrap">
            #{c.number} · FL {c.floor}
          </span>
          <h1 className="logo m-0 text-[21px] leading-none whitespace-nowrap">
            WHO FARTED?
          </h1>
          <div className="flex items-center gap-1.5">
            <span className="sticker-sm bg-sun px-1.5 text-[13px] font-bold tabular-nums">
              {formatTime(seconds)}
            </span>
            <button
              type="button"
              aria-label="How to play"
              className="btn display h-9 w-9 rounded-full bg-white text-[18px]"
              onClick={() => setShowRules(true)}
            >
              ?
            </button>
          </div>
        </header>

        {c.liarMode && (
          <p className="sticker-sm m-0 rounded-lg bg-sun px-2 py-1 text-center text-[13px] font-bold">
            Weekend rules: the farter is lying. Everyone else tells the truth.
          </p>
        )}

        <Lift
          suspects={c.suspects}
          selected={selected}
          read={read}
          crossed={crossed}
          shaking={shaking}
          zone={zone}
          tags={tags}
          onSelect={select}
        />

        {testimony && selected ? (
          <section
            className="rise relative rounded-2xl border-[3px] border-ink bg-white px-3.5 pt-2.5 pb-3"
            aria-live="polite"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="display text-[17px]">
                {CAST[selected].name.toUpperCase()}{' '}
                <span className="font-body text-[13px] font-medium tracking-normal text-ink-soft">
                  {CAST[selected].role.toLowerCase()}
                </span>
              </span>
              <span className="text-[11.5px] font-bold text-ink-soft">
                {read.size} OF {c.suspects.length} HEARD
              </span>
            </div>
            <p className="m-0 mt-1 text-[15.5px] leading-snug">
              {testimony.quote}
            </p>
            <p className="m-0 mt-2 rounded-md bg-paper px-2 py-1 text-[13.5px] leading-snug">
              <strong>Means:</strong> {testimony.plain}
              {c.liarMode && (
                <span className="text-ink-soft">
                  {' '}
                  (unless they’re the farter)
                </span>
              )}
            </p>
            <button
              type="button"
              className="btn mt-2.5 w-full rounded-xl bg-white py-1.5 text-[14px] font-bold"
              onClick={() => toggleCross(selected)}
            >
              {crossed.has(selected)
                ? `Bring ${CAST[selected].name} back`
                : `Cross out ${CAST[selected].name}`}
            </button>
          </section>
        ) : (
          <section className="rounded-2xl border-[3px] border-dashed border-ink bg-white/70 px-3.5 py-3 text-center">
            <p className="m-0 text-[15px] font-bold">
              Tap a suspect to hear their side.
            </p>
            <p className="m-0 mt-1 text-[13px] text-ink-soft">
              Every clue lights up the lift.
            </p>
          </section>
        )}

        {note && (
          <p
            className={`sticker-sm rise m-0 rounded-lg px-2.5 py-1.5 text-[14px] font-medium ${noteStyle}`}
            role="status"
          >
            {note.text}
          </p>
        )}

        {(chips.length > 0 || facts.length > 0) && (
          <section className="rounded-2xl border-2 border-ink bg-white px-3 py-2">
            <p className="display m-0 text-[14px]">
              {c.liarMode ? 'CLAIMS ABOUT THE FARTER' : 'THE FARTER WAS…'}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-md border-2 border-ink bg-tomato/20 px-1.5 text-[12.5px] font-bold"
                >
                  {chip}
                </span>
              ))}
              {facts.map((fact) => (
                <span
                  key={fact}
                  className="rounded-md border-2 border-ink bg-white px-1.5 text-[12.5px] font-bold"
                >
                  {fact}
                </span>
              ))}
            </div>
          </section>
        )}
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
            className="btn display h-[54px] flex-1 rounded-xl bg-tomato text-[24px]"
            onClick={() => setAccusing(true)}
          >
            J’ACCUSE!
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
                  ACCUSE {CAST[confirm].name.toUpperCase()}?
                </h2>
                <p className="m-0 text-[14px]">One shot. No take-backs.</p>
                <div className="mt-2 flex w-full gap-2">
                  <button
                    type="button"
                    className="btn flex-1 rounded-xl bg-white py-2 font-bold"
                    onClick={() => setConfirm(null)}
                    disabled={sending}
                  >
                    Wait
                  </button>
                  <button
                    type="button"
                    className="btn display flex-1 rounded-xl bg-tomato py-2 text-[20px]"
                    onClick={() => void sendAccusation(confirm)}
                    disabled={sending}
                  >
                    {sending ? '…' : 'J’ACCUSE!'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2
                  id="accuse-title"
                  className="display m-0 text-center text-[22px]"
                >
                  WHO DID IT?
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
                  Keep investigating
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showRules && (
        <Rules
          c={c}
          onClose={() => {
            markRulesSeen();
            setShowRules(false);
          }}
        />
      )}
    </div>
  );
};

export const App = () => {
  const [data, setData] = useState<CaseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCase()
      .then(setData)
      .catch((err: unknown) =>
        setError(
          err instanceof Error ? err.message : 'Could not load the case.'
        )
      );
  }, []);

  if (error) {
    return (
      <div className="halftone flex min-h-full items-center justify-center p-6 text-center">
        <p className="sticker rounded-xl bg-white p-4 font-bold">
          The lift is stuck. {error}
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="halftone flex min-h-full items-center justify-center">
        <p className="logo pop text-[34px]">SNIFFING…</p>
      </div>
    );
  }
  return <Game data={data} />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
