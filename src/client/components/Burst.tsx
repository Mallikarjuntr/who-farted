type Props = { win: boolean };

const COLORS = ['#FF5A36', '#FFC93C', '#18A999', '#FF8FB1', '#8FE3D6'];

type Piece = {
  dx: number;
  dy: number;
  rot: number;
  delay: number;
  shape: 'rect' | 'star' | 'cloud';
  color: string;
};

/** Spread pieces evenly around a circle so the burst looks full without randomness. */
function pieces(win: boolean): Piece[] {
  const count = win ? 28 : 7;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.2;
    const distance = win ? 120 + (i % 4) * 28 : 30;
    return {
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance * (win ? 0.85 : 0.4)),
      rot: (i % 2 ? 1 : -1) * (180 + i * 37),
      delay: win ? (i % 5) * 40 : i * 120,
      shape: win ? (i % 3 === 0 ? 'star' : 'rect') : 'cloud',
      color: win ? (COLORS[i % COLORS.length] ?? '#FFC93C') : '#B8D94A',
    };
  });
}

const setVars = (piece: Piece) => (el: HTMLElement | null) => {
  if (!el) {
    return;
  }
  el.style.setProperty('--dx', `${piece.dx}px`);
  el.style.setProperty('--dy', `${piece.dy}px`);
  el.style.setProperty('--rot', `${piece.rot}deg`);
  el.style.setProperty('--delay', `${piece.delay}ms`);
};

/** Confetti and stars for a right guess; a sad little stink puff for a wrong one. */
export const Burst = ({ win }: Props) => (
  <div
    className="pointer-events-none absolute inset-0 z-20 overflow-visible"
    aria-hidden="true"
  >
    {pieces(win).map((piece, i) => (
      <span key={i} ref={setVars(piece)} className={win ? 'particle' : 'puff'}>
        {piece.shape === 'rect' && (
          <span
            className="block h-[10px] w-[6px] rounded-[2px] border border-ink"
            style={{ background: piece.color }}
          />
        )}
        {piece.shape === 'star' && (
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"
              fill={piece.color}
              stroke="#141414"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {piece.shape === 'cloud' && (
          <svg width="34" height="22" viewBox="0 0 96 64">
            <path
              d="M18 48 C6 48 4 34 14 30 C12 18 26 12 34 20 C38 8 58 8 62 20 C72 14 86 22 80 34 C92 36 90 52 76 50 C70 58 56 58 50 52 C42 58 26 58 18 48 Z"
              fill={piece.color}
              stroke="#141414"
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    ))}
  </div>
);
