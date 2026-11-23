import type { PlacedSuspect, SuspectId } from '../../shared/puzzle/types';
import { CAST, atSlot } from '../../shared/puzzle/cast';
import type { LunchTag, Zone } from '../lib/clues';
import { FOOD_COLORS, cellKey } from '../lib/clues';
import type { Mood } from './Suspect';
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
  /** Faces for people the current clue talks about (nervous) and so on. */
  moods?: Map<SuspectId, Mood>;
  /** A short speech bubble above one suspect, e.g. "Phew!". */
  bubble?: { id: SuspectId; text: string; key: number } | null;
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

/** The left wall: the lift's button panel, drawn on the wall itself. */
const ButtonsWall = () => (
  <div
    className="flex w-[18px] shrink-0 flex-col items-center justify-center gap-1 rounded-md border-2 border-lift-ink/60 bg-[#C9CED6] py-1"
    aria-hidden="true"
  >
    <span className="h-2 w-2 rounded-full border border-ink bg-sun" />
    <span className="display text-[11px] leading-none text-lift-ink [writing-mode:vertical-rl] rotate-180">
      BUTTONS
    </span>
    <span className="h-2 w-2 rounded-full border border-ink bg-sun" />
  </div>
);

/** The right wall: a big mirror. */
const MirrorWall = () => (
  <div
    className="flex w-[18px] shrink-0 items-center justify-center rounded-md border-2 border-lift-ink/60 bg-[linear-gradient(160deg,#F2FAFF_0%,#BFE6FF_45%,#F2FAFF_55%,#BFE6FF_100%)]"
    aria-hidden="true"
  >
    <span className="display text-[11px] leading-none text-lift-ink [writing-mode:vertical-rl]">
      MIRROR
    </span>
  </div>
);

/**
 * The lift as a floor plan, drawn like a room: the BACK WALL at the top, the
 * DOORS (the way in) at the bottom, the BUTTONS panel and the MIRROR on the
 * side walls. Places are named after these things instead of left and right,
 * which flip depending on who is looking. Clues use exactly these words.
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
  moods,
  bubble,
  onSelect,
}: Props) => (
  <div className="sticker rounded-2xl bg-lift px-1.5 pt-1.5 pb-1.5">
    <div
      className="display mb-1 rounded-md border-2 border-lift-ink/60 bg-[#A8D8CF] text-center text-[12px] leading-[18px] text-lift-ink"
      aria-hidden="true"
    >
      BACK WALL
    </div>
    <div className="flex gap-1">
      <ButtonsWall />
      <div className="grid flex-1 grid-cols-3 gap-1">
        {ROWS.map((row) => (
          <div key={`r${row}`} className="contents">
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
                    className={`flex min-h-[104px] items-center justify-center rounded-xl border-2 border-dashed border-lift-ink/25 ${zoneClass}`}
                    aria-hidden="true"
                  >
                    <span className="text-[11px] font-bold tracking-wide text-lift-ink/50">
                      EMPTY
                    </span>
                  </div>
                );
              }
              const isCrossed = crossed.has(s.id);
              const isSelected = selected === s.id;
              const isRead = read.has(s.id);
              const lunch = tags.get(s.id) ?? [];
              const nervous = !isCrossed && moods?.get(s.id) === 'nervous';
              // A freshly cleared suspect stays in colour while saying "Phew!".
              const fading = isCrossed && bubble?.id !== s.id;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-pressed={isSelected}
                  aria-label={`${CAST[s.id].name}, ${atSlot(s.slot)}${isCrossed ? ', marked innocent' : ''}${isRead ? '' : ', clue not read yet'}`}
                  className={`tap relative flex flex-col items-center rounded-xl border-0 p-0.5 pb-1 ${zoneClass} ${
                    isSelected ? 'bg-sun/70' : 'bg-transparent'
                  } ${pulse === s.id ? 'coach-pulse' : ''}`}
                >
                  {!isRead && (
                    <span className="sticker-sm pop absolute top-0 right-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[12px] font-bold">
                      ?
                    </span>
                  )}
                  {nervous && (
                    <span
                      className="pop absolute top-1 left-0 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-tomato text-[15px] font-black"
                      aria-hidden="true"
                    >
                      !
                    </span>
                  )}
                  <div
                    className={`relative w-[84%] ${shaking === s.id ? 'shake' : nervous ? 'shiver' : ''}`}
                  >
                    <Suspect
                      id={s.id}
                      mood={
                        isCrossed
                          ? 'relieved'
                          : (moods?.get(s.id) ??
                            (isSelected ? 'shifty' : 'neutral'))
                      }
                      className={`block w-full transition-[opacity,filter] duration-500 ${fading ? 'opacity-40 grayscale' : ''}`}
                    />
                    {isCrossed && <Cross />}
                    {bubble?.id === s.id && (
                      <span
                        key={bubble.key}
                        className="bubble-in display pointer-events-none absolute -top-1 left-1/2 z-20 rounded-xl border-[2.5px] border-ink bg-white px-2.5 py-0.5 text-[16px] whitespace-nowrap shadow-[3px_3px_0_#141414]"
                      >
                        {bubble.text}
                      </span>
                    )}
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
      <MirrorWall />
    </div>

    <div className="mt-1 flex items-center gap-1" aria-hidden="true">
      <span className="h-[18px] flex-1 rounded-md border-2 border-lift-ink/60 bg-[#C9CED6]" />
      <span className="display px-1 text-[12px] whitespace-nowrap text-lift-ink">
        ▲ DOORS · WAY IN ▲
      </span>
      <span className="h-[18px] flex-1 rounded-md border-2 border-lift-ink/60 bg-[#C9CED6]" />
    </div>
  </div>
);
