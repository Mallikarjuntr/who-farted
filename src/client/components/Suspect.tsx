import type { SVGAttributes } from 'react';
import type { SuspectId } from '../../shared/puzzle/types';

export type Mood = 'neutral' | 'shifty' | 'guilty' | 'smug';

type Art = {
  skin: string;
  hair: string;
  shirt: string;
  cy: number;
  rx: number;
  ry: number;
  body: string;
  back?: string;
  hairD: string;
  fill?: { d: string; color: string };
  line?: string;
  top?: { d: string; color: string };
  mouth?: string;
  brows?: string;
  /** Which way the eyes drift when the character looks shifty. */
  look: number;
};

const BODY = 'M12 110 C12 86 30 76 50 76 C70 76 88 86 88 110 Z';

const ART: Record<SuspectId, Art> = {
  agnes: {
    skin: '#FFD2B0',
    hair: '#E4E2EA',
    shirt: '#18A999',
    cy: 48,
    rx: 23,
    ry: 25,
    body: BODY,
    hairD:
      'M27 44 C25 26 37 20 50 20 C63 20 75 26 73 44 C69 33 60 30 50 30 C40 30 31 33 27 44 Z M43 15 A7 7 0 1 0 57 15 A7 7 0 1 0 43 15 Z',
    fill: { d: 'M38 77 L50 90 L62 77 Z', color: '#FFF6E0' },
    line: 'M35 50 A6 6 0 1 0 47 50 A6 6 0 1 0 35 50 M53 50 A6 6 0 1 0 65 50 A6 6 0 1 0 53 50 M47 50 L53 50',
    mouth: 'M44 62 Q50 66 56 62',
    brows: 'M36 40 L45 42 M55 42 L64 40',
    look: 2,
  },
  brock: {
    skin: '#C98757',
    hair: '#2A1C14',
    shirt: '#4F7CFF',
    cy: 48,
    rx: 23,
    ry: 25,
    body: 'M2 110 C2 82 26 73 50 73 C74 73 98 82 98 110 Z',
    hairD:
      'M28 40 C28 25 38 19 50 19 C62 19 72 25 72 40 L72 36 C65 30 35 30 28 36 Z',
    fill: { d: 'M36 74 L42 110 L58 110 L64 74 Z', color: '#C98757' },
    top: { d: 'M27 34 L73 34 L73 41 L27 41 Z', color: '#FF5A36' },
    mouth: 'M43 62 Q51 67 58 60',
    brows: 'M36 43 L45 41 M55 41 L64 43',
    look: -2,
  },
  pip: {
    skin: '#FFDCC4',
    hair: '#8A522C',
    shirt: '#FFC93C',
    cy: 50,
    rx: 27,
    ry: 26,
    body: 'M18 110 C18 90 32 80 50 80 C68 80 82 90 82 110 Z',
    hairD: 'M46 26 C43 17 53 14 56 19 C58 23 53 26 50 24 Z',
    fill: { d: 'M38 82 Q50 98 62 82 Z', color: '#FFFFFF' },
    top: { d: 'M44 64 A6 5 0 1 0 56 64 A6 5 0 1 0 44 64 Z', color: '#FF8FB1' },
    brows: 'M38 44 L45 44 M55 44 L62 44',
    look: 2,
  },
  biscuit: {
    skin: '#D49A5E',
    hair: '#7A4A27',
    shirt: '#D49A5E',
    cy: 48,
    rx: 24,
    ry: 23,
    body: BODY,
    hairD:
      'M27 34 C15 38 15 62 23 70 C29 62 31 48 31 38 Z M73 34 C85 38 85 62 77 70 C71 62 69 48 69 38 Z',
    fill: { d: 'M30 80 L70 80 L70 87 L30 87 Z', color: '#FF5A36' },
    line: 'M50 62 L50 65 M44 66 Q50 70 56 66',
    top: { d: 'M43 57 A7 5 0 1 0 57 57 A7 5 0 1 0 43 57 Z', color: '#141414' },
    look: -2,
  },
  linda: {
    skin: '#93603F',
    hair: '#1E1A1C',
    shirt: '#2D4BA0',
    cy: 48,
    rx: 23,
    ry: 25,
    body: BODY,
    back: 'M24 52 C22 28 36 19 50 19 C64 19 78 28 76 52 L76 68 L24 68 Z',
    hairD: 'M27 40 C30 26 42 21 52 22 C62 22 72 28 73 40 C64 32 46 31 27 40 Z',
    fill: { d: 'M45 94 L55 94 L55 104 L45 104 Z', color: '#FFFFFF' },
    line: 'M42 77 L50 94 L58 77',
    mouth: 'M44 63 L56 63',
    brows: 'M36 40 L45 43 M55 43 L64 40',
    look: -2,
  },
  marcel: {
    skin: '#FFFFFF',
    hair: '#141414',
    shirt: '#FFFFFF',
    cy: 48,
    rx: 23,
    ry: 25,
    body: BODY,
    hairD:
      'M27 33 C29 19 71 19 73 33 C62 28 38 28 27 33 Z M49 18 L51 18 L50 13 Z',
    fill: {
      d: 'M14 92 L86 92 L86 97 L14 97 Z M10 102 L90 102 L90 107 L10 107 Z',
      color: '#141414',
    },
    line: 'M38 44 L44 40 M56 40 L62 44',
    top: { d: 'M45 62 Q50 59 55 62 Q50 66 45 62 Z', color: '#FF5A36' },
    look: 2,
  },
};

const GUILTY_MOUTH = 'M42 63 Q46 59 50 63 Q54 67 58 63';
const GUILTY_BROWS = 'M36 40 L45 43 M55 43 L64 40';
const SMUG_MOUTH = 'M42 61 Q52 68 60 59';
const BLUSH =
  'M31 58 A6 3.5 0 1 0 43 58 A6 3.5 0 1 0 31 58 Z M57 58 A6 3.5 0 1 0 69 58 A6 3.5 0 1 0 57 58 Z';
const SWEAT = 'M76 28 C71 36 71 42 76 43 C81 42 81 36 76 28 Z';

const INK = '#141414';

type Props = {
  id: SuspectId;
  mood?: Mood;
  className?: string;
};

/** A hand-drawn suspect bust in the Sticker Bomb style: thick ink outlines, flat colour. */
export const Suspect = ({ id, mood = 'neutral', className }: Props) => {
  const a = ART[id];
  const look = mood === 'shifty' || mood === 'guilty' ? a.look : 0;
  const ey = a.cy + 2;
  const keepsOwnMouth = id === 'pip' || id === 'biscuit' || id === 'marcel';
  const mouth =
    mood === 'guilty' && !keepsOwnMouth
      ? GUILTY_MOUTH
      : mood === 'smug' && !keepsOwnMouth
        ? SMUG_MOUTH
        : a.mouth;
  const brows = mood === 'guilty' && a.brows ? GUILTY_BROWS : a.brows;
  const outline: SVGAttributes<SVGElement> = {
    stroke: INK,
    strokeWidth: 3.2,
    strokeLinejoin: 'round',
  };
  const line: SVGAttributes<SVGElement> = {
    fill: 'none',
    stroke: INK,
    strokeWidth: 3,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <svg viewBox="-4 -4 108 118" className={className} aria-hidden="true">
      <path d={a.body} fill={a.shirt} {...outline} />
      {a.fill && <path d={a.fill.d} fill={a.fill.color} />}
      <rect x="44" y="64" width="12" height="14" fill={a.skin} />
      {a.back && <path d={a.back} fill={a.hair} {...outline} />}
      <ellipse
        cx="50"
        cy={a.cy}
        rx={a.rx}
        ry={a.ry}
        fill={a.skin}
        {...outline}
      />
      <path d={a.hairD} fill={a.hair} {...outline} />
      {mood === 'guilty' && <path d={BLUSH} fill="#FF8FB1" />}
      <circle cx={42 + look} cy={ey} r="3.2" fill={INK} />
      <circle cx={58 + look} cy={ey} r="3.2" fill={INK} />
      {brows && <path d={brows} {...line} />}
      {mouth && <path d={mouth} {...line} />}
      {a.line && <path d={a.line} {...line} />}
      {a.top && <path d={a.top.d} fill={a.top.color} {...outline} />}
      {mood === 'guilty' && <path d={SWEAT} fill="#7FD3F0" {...outline} />}
    </svg>
  );
};
