import type { PlacedSuspect, SuspectId } from '../../shared/puzzle/types';
import { CAST } from '../../shared/puzzle/cast';
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
  onSelect: (id: SuspectId) => void;
};

const CELLS = [0, 1, 2, 3, 4, 5].map((i) => ({
  row: i < 3 ? 0 : 1,
  col: i % 3,
}));

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

export const Lift = ({
  suspects,
  selected,
  read,
  crossed,
  shaking,
  zone,
  tags,
  onSelect,
}: Props) => (
  <div className="sticker relative rounded-2xl bg-lift px-5 pt-2 pb-1.5">
    <p className="m-0 text-center text-[10.5px] font-bold tracking-[0.14em] text-lift-ink">
      BACK WALL
    </p>
    <span
      className="display absolute top-1/2 left-1.5 -translate-y-1/2 text-[15px] text-lift-ink"
      aria-label="Left side"
    >
      L
    </span>
    <span
      className="display absolute top-1/2 right-1.5 -translate-y-1/2 text-[15px] text-lift-ink"
      aria-label="Right side"
    >
      R
    </span>

    <div className="grid grid-cols-3 gap-x-1.5 gap-y-1">
      {CELLS.map((cell) => {
        const key = `${cell.row}-${cell.col}`;
        const s = suspects.find((p) => cellKey(p.slot) === key);
        const inZone = zone?.cells.has(key) ?? false;
        const zoneClass = inZone
          ? zone?.tone === 'maybe'
            ? 'bg-tomato/25 outline-2 outline-dashed outline-tomato'
            : 'bg-[repeating-linear-gradient(135deg,#ffffff66_0_6px,transparent_6px_12px)] outline-2 outline-dashed outline-lift-ink'
          : '';
        if (!s) {
          return (
            <div
              key={key}
              className={`min-h-[96px] rounded-xl ${zoneClass}`}
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
            aria-label={`${CAST[s.id].name}, ${CAST[s.id].role}${isCrossed ? ', cleared' : ''}${isRead ? '' : ', not questioned yet'}`}
            className={`tap relative flex flex-col items-center rounded-xl border-0 p-0.5 pb-1 ${zoneClass} ${isSelected ? 'bg-sun/70' : 'bg-transparent'}`}
          >
            {!isRead && (
              <span className="sticker-sm pop absolute top-0 right-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[12px] font-bold">
                ?
              </span>
            )}
            <div
              className={`relative w-[86%] ${shaking === s.id ? 'shake' : ''}`}
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
                  className={`rounded-sm border border-ink px-1 text-[10px] leading-[14px] font-bold uppercase ${t.negative ? 'line-through' : ''}`}
                  style={{
                    background: t.food ? FOOD_COLORS[t.food] : '#ffffff',
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

    <p className="m-0 mt-0.5 text-center text-[10.5px] font-bold tracking-[0.14em] text-lift-ink">
      DOORS
    </p>
  </div>
);
