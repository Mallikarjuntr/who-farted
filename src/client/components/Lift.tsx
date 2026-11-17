import type { PlacedSuspect, SuspectId } from '../../shared/puzzle/types';
import { CAST, COL_LABELS, ROW_LABELS } from '../../shared/puzzle/cast';
import type { LunchTag, Zone } from '../lib/clues';
import { FOOD_COLORS, cellKey } from '../lib/clues';
import { Suspect } from './Suspect';

type Props = {
  suspects: readonly PlacedSuspect[];
  selected: SuspectId | null;
  read: ReadonlySet<SuspectId>;
  crossed: ReadonlySet<SuspectId>;
  shaking: SuspectId | null;
  zone: Zone | null;
  tags: Map<SuspectId, LunchTag[]>;
  /** In the practice case, the person the coach wants you to tap. */
  pulse?: SuspectId | null;
  onSelect: (id: SuspectId) => void;
};

const ROWS = [0, 1];
const COLS = [0, 1, 2];

const Cross = () => (
  <svg
    viewBox="0 0 70 70"
    className="stamp pointer-events-none absolute top-[14%] left-1/2 h-[62%] w-auto -translate-x-1/2"
    aria-hidden="true"
  >
    <path
      d="M14 14 L56 56 M56 14 L14 56"
      fill="none"
      stroke="#141414"
      strokeWidth="11"
      strokeLinecap="round"
    />
    <path
      d="M14 14 L56 56 M56 14 L14 56"
      fill="none"
      stroke="#FF5A36"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * The lift seen from the front. Every column and row carries the exact word the
 * clues use (LEFT, MIDDLE, RIGHT, BACK, FRONT), so nobody has to picture it.
 */
export const Lift = ({
  suspects,
  selected,
  read,
  crossed,
  shaking,
  zone,
  tags,
  pulse,
  onSelect,
}: Props) => (
  <div className="sticker rounded-2xl bg-lift px-1.5 pt-1.5 pb-1">
    <div className="grid grid-cols-[22px_1fr_1fr_1fr] gap-x-1 gap-y-1">
      <span aria-hidden="true" />
      {COLS.map((col) => (
        <span
          key={`h${col}`}
          className="display rounded-md bg-white/70 text-center text-[13px] leading-[20px] text-lift-ink"
        >
          {COL_LABELS[col]}
        </span>
      ))}

      {ROWS.map((row) => (
        <div key={`r${row}`} className="contents">
          <span className="display flex items-center justify-center rounded-md bg-white/70 text-[12px] text-lift-ink [writing-mode:vertical-rl] rotate-180">
            {ROW_LABELS[row]}
          </span>
          {COLS.map((col) => {
            const key = `${row}-${col}`;
            const s = suspects.find((p) => cellKey(p.slot) === key);
            const inZone = zone?.cells.has(key) ?? false;
            const zoneClass = inZone
              ? zone?.tone === 'maybe'
                ? 'bg-tomato/25 outline-2 outline-dashed outline-tomato'
                : 'bg-[repeating-linear-gradient(135deg,#ffffff99_0_6px,transparent_6px_12px)] outline-2 outline-dashed outline-lift-ink'
              : '';
            if (!s) {
              return (
                <div
                  key={key}
                  className={`min-h-[104px] rounded-xl ${zoneClass}`}
                  aria-hidden="true"
                />
              );
            }
            const isCrossed = crossed.has(s.id);
            const isSelected = selected === s.id;
            const isRead = read.has(s.id);
            const lunch = tags.get(s.id) ?? [];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(s.id)}
                aria-pressed={isSelected}
                aria-label={`${CAST[s.id].name}, ${ROW_LABELS[row]} ${COL_LABELS[col]}${isCrossed ? ', marked innocent' : ''}${isRead ? '' : ', clue not read yet'}`}
                className={`tap relative flex flex-col items-center rounded-xl border-0 p-0.5 pb-1 ${zoneClass} ${
                  isSelected ? 'bg-sun/70' : 'bg-transparent'
                } ${pulse === s.id ? 'coach-pulse' : ''}`}
              >
                {!isRead && (
                  <span className="sticker-sm pop absolute top-0 right-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[12px] font-bold">
                    ?
                  </span>
                )}
                <div
                  className={`relative w-[84%] ${shaking === s.id ? 'shake' : ''}`}
                >
                  <Suspect
                    id={s.id}
                    mood={isSelected ? 'shifty' : 'neutral'}
                    className={`block w-full ${isCrossed ? 'opacity-40 grayscale' : ''}`}
                  />
                  {isCrossed && <Cross />}
                </div>
                <span
                  className={`-mt-1 rounded-md border-2 border-ink px-1.5 text-[11.5px] font-bold tracking-wide ${
                    isCrossed
                      ? 'bg-cleared text-ink-soft line-through'
                      : isSelected
                        ? 'bg-sun'
                        : 'bg-white'
                  }`}
                >
                  {CAST[s.id].name.toUpperCase()}
                </span>
                <span className="mt-0.5 flex min-h-[16px] flex-wrap justify-center gap-0.5">
                  {lunch.slice(0, 2).map((t) => (
                    <span
                      key={t.text}
                      className="rounded-sm border border-ink px-1 text-[10px] leading-[14px] font-bold whitespace-nowrap"
                      style={{
                        background:
                          t.food && !t.negative
                            ? FOOD_COLORS[t.food]
                            : '#ffffff',
                      }}
                    >
                      {t.text}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>

    <div
      className="mt-1 flex items-center justify-center gap-2"
      aria-hidden="true"
    >
      <span className="h-[3px] flex-1 rounded bg-lift-ink/50" />
      <span className="display text-[12px] text-lift-ink">DOORS</span>
      <span className="h-[3px] flex-1 rounded bg-lift-ink/50" />
    </div>
  </div>
);
