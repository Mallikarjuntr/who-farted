import { FOOD_COLORS, meaningParts } from '../lib/clues';

/** A plain clue line with the key words in bold and lunches in their sticker colours. */
export const Meaning = ({ text }: { text: string }) => (
  <>
    {meaningParts(text).map((part, i) =>
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
  </>
);
