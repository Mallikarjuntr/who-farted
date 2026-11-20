import { useMemo } from 'react';
import type { PublicCase, SuspectId } from '../../shared/puzzle/types';
import { CAST } from '../../shared/puzzle/cast';
import type { ExplainStep } from '../../shared/puzzle/explain';
import { explainSolution } from '../../shared/puzzle/explain';
import { isPlaceClue, stoodAt } from '../../shared/puzzle/meaning';
import { Meaning } from './Meaning';
import { Suspect } from './Suspect';

type Props = {
  c: PublicCase;
  culprit: SuspectId;
  /** The player's wrong pick, so the steps can say why it was wrong. */
  guessed?: SuspectId | null;
};

function names(ids: readonly SuspectId[]): string {
  const list = ids.map((id) => CAST[id].name);
  if (list.length <= 1) {
    return list.join('');
  }
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1) ?? ''}`;
}

/** One or two plain sentences on why the player's pick could not be the farter. */
function whyNot(
  c: PublicCase,
  steps: readonly ExplainStep[],
  guessed: SuspectId
): string {
  const who = CAST[guessed].name;
  const index = steps.findIndex((s) => s.ruledOut.includes(guessed));
  const step = steps[index];
  if (!step) {
    return `${who} does not fit all the clues.`;
  }
  const n = index + 1;
  const by = CAST[step.speaker].name;
  if (isPlaceClue(step.statement)) {
    return `${stoodAt(c.suspects, guessed)} That does not fit what ${by} said in step ${n}.`;
  }
  if (step.statement.kind === 'innocent' && step.statement.who === guessed) {
    return `In step ${n}, ${by} said ${who} is NOT the farter.`;
  }
  return n === 1
    ? `Step 1 proves ${who} is innocent.`
    : `Steps 1 to ${n} together prove ${who} is innocent.`;
}

/** Step-by-step "how to solve it" in plain words, so losing still teaches something. */
export const SolveSteps = ({ c, culprit, guessed = null }: Props) => {
  const steps = useMemo(() => explainSolution(c, culprit), [c, culprit]);
  const lie = c.liarMode
    ? c.testimonies.find((t) => t.speaker === culprit)
    : undefined;
  return (
    <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
      {c.liarMode && (
        <li className="rounded-lg bg-sun px-2 py-1 text-[14px] font-bold">
          Weekend rule: everyone tells the truth, except the farter.
        </li>
      )}
      {steps.map((step, i) => (
        <li key={i} className="flex gap-2">
          <span className="display flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun text-[13px]">
            {i + 1}
          </span>
          <div className="text-[14.5px] leading-snug">
            <p className="m-0">
              <strong>{CAST[step.speaker].name} said:</strong>{' '}
              <Meaning text={step.plain} />
            </p>
            <p className="m-0 mt-0.5 font-medium text-ink-soft">
              {step.ruledOut.length > 0
                ? `So ${names(step.ruledOut)} ${step.ruledOut.length === 1 ? 'is' : 'are'} innocent.`
                : 'Keep this in mind for the next step.'}
            </p>
          </div>
        </li>
      ))}
      {lie && (
        <li className="rounded-lg border-2 border-ink bg-white px-2 py-1 text-[14px] leading-snug">
          <strong>The lie:</strong> {CAST[culprit].name} said “{lie.plain}” That
          was not true. The farter lies!
        </li>
      )}
      {guessed && guessed !== culprit && (
        <li className="flex items-center gap-2 rounded-lg border-2 border-ink bg-pink px-2 py-1.5">
          <Suspect
            id={guessed}
            mood="relieved"
            className="h-9 w-auto shrink-0"
          />
          <span className="text-[14px] leading-snug">
            <strong>Why not {CAST[guessed].name}?</strong>{' '}
            {whyNot(c, steps, guessed)}
          </span>
        </li>
      )}
      <li className="flex items-center gap-2 rounded-lg border-2 border-ink bg-tomato/20 px-2 py-1">
        <Suspect id={culprit} mood="guilty" className="h-9 w-auto shrink-0" />
        <span className="text-[14.5px] font-bold">
          Only {CAST[culprit].name} is left. {CAST[culprit].name} did it!
        </span>
      </li>
    </ol>
  );
};
