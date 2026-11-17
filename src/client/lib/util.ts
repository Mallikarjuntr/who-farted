import type { SuspectId } from '../../shared/puzzle/types';
import { SUSPECT_IDS } from '../../shared/puzzle/cast';

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Hours and minutes until the next case (midnight UTC). */
export function untilNextCase(now: Date = new Date()): string {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  const mins = Math.max(0, Math.round((next - now.getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

const OPEN_KEY = 'wf_open_suspect';
const RULES_KEY = 'wf_seen_rules';

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The feed card can open the game straight onto the suspect that was tapped. */
export function rememberOpenSuspect(id: SuspectId): void {
  try {
    safeStorage()?.setItem(OPEN_KEY, id);
  } catch {
    // Storage can be blocked; opening the game normally is fine.
  }
}

export function takeOpenSuspect(): SuspectId | null {
  try {
    const store = safeStorage();
    const value = store?.getItem(OPEN_KEY) ?? null;
    store?.removeItem(OPEN_KEY);
    return SUSPECT_IDS.find((id) => id === value) ?? null;
  } catch {
    return null;
  }
}

export function hasSeenRules(): boolean {
  try {
    return safeStorage()?.getItem(RULES_KEY) === '1';
  } catch {
    return false;
  }
}

export function markRulesSeen(): void {
  try {
    safeStorage()?.setItem(RULES_KEY, '1');
  } catch {
    // Not critical.
  }
}

export function clearRulesSeen(): void {
  try {
    safeStorage()?.removeItem(RULES_KEY);
  } catch {
    // Not critical.
  }
}

export function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
