/** A small seeded random generator, so the same date always gives the same case. */
export type Rng = {
  next: () => number;
  int: (max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  shuffle: <T>(items: readonly T[]) => T[];
};

export function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`Missing ${what}`);
  }
  return value;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: string): Rng {
  let state = hashSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (max: number): number => Math.floor(next() * max);

  const pick = <T>(items: readonly T[]): T =>
    must(items[int(items.length)], 'random pick from an empty list');

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const a = must(copy[i], 'shuffle item');
      const b = must(copy[j], 'shuffle item');
      copy[i] = b;
      copy[j] = a;
    }
    return copy;
  };

  return { next, int, pick, shuffle };
}
