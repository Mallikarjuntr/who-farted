import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { CaseResponse } from '../shared/api';
import type { SuspectId } from '../shared/puzzle/types';
import { CAST } from '../shared/puzzle/cast';
import { Suspect } from './components/Suspect';
import { fetchCase } from './lib/api';
import { formatTime, rememberOpenSuspect } from './lib/util';

const SLOTS = [0, 1, 2, 3, 4, 5];

export const Splash = () => {
  const [data, setData] = useState<CaseResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchCase()
      .then(setData)
      .catch((err: unknown) => {
        console.error('Failed to load case', err);
        setFailed(true);
      });
  }, []);

  const open = (event: MouseEvent, suspect?: SuspectId) => {
    if (suspect) {
      rememberOpenSuspect(suspect);
    }
    requestExpandedMode(event.nativeEvent, 'game');
  };

  const c = data?.case;
  const result = data?.result;
  const yesterday = data?.yesterday;

  return (
    <div className="halftone h-full w-full overflow-hidden select-none">
      <div className="mx-auto flex h-full max-w-[520px] flex-col items-center gap-[1.5vh] px-3 pt-3 pb-3">
        <div className="flex w-full items-center justify-between">
          <span className="display sticker-sm -rotate-6 bg-sun px-2 text-[15px]">
            {c ? `CASE #${c.number}` : 'CASE #…'}
          </span>
          <span className="sticker-sm rotate-3 rounded-md bg-white px-2 py-0.5 text-[12px] font-bold">
            {c ? `FLOOR ${c.floor}` : 'FLOOR …'}
          </span>
        </div>

        <h1 className="logo m-0 -rotate-2 text-center text-[clamp(30px,9vh,48px)] leading-none">
          WHO FARTED?
        </h1>

        <div className="sticker w-full max-w-[340px] flex-1 rounded-2xl bg-lift px-2 pt-1 pb-1">
          <div className="grid h-full grid-cols-3 grid-rows-2 place-items-center gap-x-1">
            {SLOTS.map((i) => {
              const row = i < 3 ? 0 : 1;
              const col = i % 3;
              const s = c?.suspects.find(
                (p) => p.slot.row === row && p.slot.col === col
              );
              if (!s) {
                return <span key={i} aria-hidden="true" />;
              }
              return (
                <button
                  key={i}
                  type="button"
                  className="tap flex h-full max-h-[100px] items-end justify-center border-0 bg-transparent p-0"
                  aria-label={`Question ${CAST[s.id].name}`}
                  onClick={(e) => open(e, s.id)}
                >
                  <Suspect
                    id={s.id}
                    mood={i % 2 === 0 ? 'shifty' : 'neutral'}
                    className="h-full max-h-[100px] w-auto"
                  />
                </button>
              );
            })}
          </div>
        </div>

        <p className="m-0 text-center text-[clamp(13px,2.6vh,15px)] font-bold">
          {c ? c.teaser : 'Loading today’s lift…'}
          {c?.liarMode && (
            <span className="block text-tomato">
              Weekend rules: the farter lies.
            </span>
          )}
        </p>

        <div className="flex w-full items-center justify-between gap-2">
          {failed ? (
            <p className="m-0 text-[13px] font-medium">
              The lift is stuck. Pull to refresh.
            </p>
          ) : result ? (
            <p className="sticker-sm m-0 -rotate-2 bg-white px-2 py-1 text-[12.5px] leading-tight font-medium">
              {result.correct ? 'You cracked it' : 'It got away'} in{' '}
              {formatTime(result.seconds)}
              {data?.streak ? (
                <>
                  <br />
                  <strong>Streak: {data.streak.current} days</strong>
                </>
              ) : null}
            </p>
          ) : yesterday ? (
            <p className="sticker-sm m-0 -rotate-2 bg-white px-2 py-1 text-[12.5px] leading-tight font-medium">
              Yesterday {yesterday.topBlamedPct}% blamed{' '}
              {CAST[yesterday.topBlamed].name}.
              <br />
              <strong>
                {yesterday.topBlamed === yesterday.culprit
                  ? 'They were right.'
                  : `It was ${CAST[yesterday.culprit].name}.`}
              </strong>
            </p>
          ) : (
            <p className="m-0 text-[13px] leading-tight font-bold">
              6 suspects.
              <br />1 accusation.
            </p>
          )}
          <button
            type="button"
            className="btn display shrink-0 rounded-xl bg-tomato px-4 py-2 text-[19px] text-ink"
            disabled={!c}
            onClick={(e) => open(e)}
          >
            {result ? 'SEE RESULTS' : 'START SNIFFING'}
          </button>
        </div>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
