import { useMemo } from 'react';
import type { PublicCase, SuspectId } from '../../shared/puzzle/types';
import { CAST } from '../../shared/puzzle/cast';
import { explainSolution } from '../../shared/puzzle/explain';
import { FOOD_COLORS, meaningParts } from '../lib/clues';
import { Suspect } from './Suspect';

type Props = { c: PublicCase; culprit: SuspectId };

function names(ids: readonly SuspectId[]): string {
  const list = ids.map((id) => CAST[id].name);
  if (list.length <= 1) {
    return list.join('');
  }
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1) ?? ''}`;
}

/** Step-by-step "how to solve it", so losing still teaches something. */
export const SolveSteps = ({ c, culprit }: Props) => {
  const steps = useMemo(() => explainSolution(c, culprit), [c, culprit]);
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {c.liarMode && (
        <li className="rounded-lg bg-sun px-2 py-1 text-[13.5px] font-bold">
          Weekend rule: the farter’s clue is a lie.
        </li>
      )}
      {steps.map((step, i) => (
        <li key={i} className="flex gap-2">
          <span className="display flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun text-[13px]">
            {i + 1}
          </span>
          <div className="text-[14px] leading-snug">
            <p className="m-0">
              <strong>{CAST[step.speaker].name}:</strong>{' '}
              {meaningParts(step.plain).map((part, j) =>
                part.food ? (
                  <strong
                    key={j}
                    className="rounded border border-ink px-0.5"
                    style={{ background: FOOD_COLORS[part.food] }}
                  >
                    {part.text}
                  </strong>
                ) : part.strong ? (
                  <strong key={j}>{part.text}</strong>
                ) : (
                  <span key={j}>{part.text}</span>
                )
              )}
            </p>
            <p className="m-0 text-ink-soft">
              {step.ruledOut.length > 0
                ? `→ So ${names(step.ruledOut)} ${step.ruledOut.length === 1 ? 'is' : 'are'} NOT the farter.`
                : '→ Remember this for the next step.'}
            </p>
          </div>
        </li>
      ))}
      <li className="flex items-center gap-2 rounded-lg border-2 border-ink bg-tomato/20 px-2 py-1">
        <Suspect id={culprit} mood="guilty" className="h-9 w-auto" />
        <span className="text-[14.5px] font-bold">
          Only {CAST[culprit].name} is left. {CAST[culprit].name} did it!
        </span>
      </li>
    </ol>
  );
};
