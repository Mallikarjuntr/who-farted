import type { CaseResponse } from '../../shared/api';
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
const JOINED_KEY = 'wf_joined';

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

/** Remembers on this device that the player joined, so the button stays away. */
export function hasJoined(): boolean {
  try {
    return safeStorage()?.getItem(JOINED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markJoined(): void {
  try {
    safeStorage()?.setItem(JOINED_KEY, '1');
  } catch {
    // Not critical.
  }
}

export function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

const HANDOFF_KEY = 'wf_case_handoff';
const HANDOFF_MAX_AGE = 15 * 60 * 1000;

function isCaseResponse(value: unknown): value is CaseResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'type') === 'case' &&
    typeof Reflect.get(value, 'case') === 'object'
  );
}

/**
 * The feed card has already loaded the case, so it hands it to the game when
 * tapped. The game can then draw at once instead of waiting for the server.
 */
export function handOffCase(data: CaseResponse): void {
  try {
    safeStorage()?.setItem(
      HANDOFF_KEY,
      JSON.stringify({ at: Date.now(), data })
    );
  } catch {
    // Storage can be blocked; the game will just load the case itself.
  }
}

/** Read once: a later open always asks the server, so it never shows old data. */
export function takeHandedOffCase(): CaseResponse | null {
  try {
    const store = safeStorage();
    const raw = store?.getItem(HANDOFF_KEY) ?? null;
    store?.removeItem(HANDOFF_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const at = Number(Reflect.get(parsed, 'at'));
    const data: unknown = Reflect.get(parsed, 'data');
    return Date.now() - at < HANDOFF_MAX_AGE && isCaseResponse(data)
      ? data
      : null;
  } catch {
    return null;
  }
}
