import type { PlacedSuspect, Statement, SuspectId } from './types.ts';
import { CAST, atSlot } from './cast.ts';

/** Is this a clue about where the farter stood? */
export function isPlaceClue(s: Statement): boolean {
  return (
    s.kind === 'culpritRow' ||
    s.kind === 'culpritCol' ||
    s.kind === 'culpritNotCol' ||
    s.kind === 'culpritNextTo' ||
    s.kind === 'culpritNotNextTo' ||
    s.kind === 'culpritSameColumnAs'
  );
}

/** "Brock stood at the BACK, by the MIRROR." */
export function stoodAt(
  suspects: readonly PlacedSuspect[],
  id: SuspectId
): string {
  const slot = suspects.find((s) => s.id === id)?.slot;
  return slot ? `${CAST[id].name} stood ${atSlot(slot)}.` : '';
}
