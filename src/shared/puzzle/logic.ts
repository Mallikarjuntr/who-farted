import type { FoodId, Slot, Statement, SuspectId } from './types.ts';
import { must } from './rng.ts';

/** Who stands where, and which lunches are in play. Arrays are aligned by suspect index. */
export type Layout = {
  suspects: readonly SuspectId[];
  slots: readonly Slot[];
  menu: readonly FoodId[];
};

/**
 * A "world" is one complete guess at the hidden facts: who farted, and what
 * everyone ate. Worlds are numbered 0..count-1 so they can be enumerated fast.
 */
export type WorldSpace = {
  layout: Layout;
  suspectCount: number;
  foodCount: number;
  /** Number of possible lunch combinations (foodCount ^ suspectCount). */
  lunchCombos: number;
  count: number;
  /** lunchTable[combo * suspectCount + i] = menu index eaten by suspect i. */
  lunchTable: Uint8Array;
};

export function createWorldSpace(layout: Layout): WorldSpace {
  const suspectCount = layout.suspects.length;
  const foodCount = layout.menu.length;
  const lunchCombos = foodCount ** suspectCount;
  const lunchTable = new Uint8Array(lunchCombos * suspectCount);
  for (let combo = 0; combo < lunchCombos; combo++) {
    let rest = combo;
    for (let i = 0; i < suspectCount; i++) {
      lunchTable[combo * suspectCount + i] = rest % foodCount;
      rest = Math.floor(rest / foodCount);
    }
  }
  return {
    layout,
    suspectCount,
    foodCount,
    lunchCombos,
    count: suspectCount * lunchCombos,
    lunchTable,
  };
}

export function worldCulprit(space: WorldSpace, world: number): number {
  return Math.floor(world / space.lunchCombos);
}

function lunchOf(space: WorldSpace, world: number, suspect: number): number {
  const combo = world % space.lunchCombos;
  return must(space.lunchTable[combo * space.suspectCount + suspect], 'lunch');
}

export function indexOfSuspect(layout: Layout, id: SuspectId): number {
  const index = layout.suspects.indexOf(id);
  if (index < 0) {
    throw new Error(`${id} is not in this case`);
  }
  return index;
}

function slotOf(layout: Layout, index: number): Slot {
  return must(layout.slots[index], 'slot');
}

/** Side by side: same row, neighbouring columns. */
export function isNextTo(a: Slot, b: Slot): boolean {
  return a.row === b.row && Math.abs(a.col - b.col) === 1;
}

/** Directly in front of or behind: same column, other row. */
export function isSameColumn(a: Slot, b: Slot): boolean {
  return a.col === b.col && a.row !== b.row;
}

function foodIndex(layout: Layout, food: FoodId): number {
  return layout.menu.indexOf(food);
}

/** Is this statement true in this world? */
export function evaluate(
  space: WorldSpace,
  world: number,
  statement: Statement
): boolean {
  const { layout } = space;
  const culprit = worldCulprit(space, world);
  const culpritSlot = slotOf(layout, culprit);

  switch (statement.kind) {
    case 'culpritRow':
      return culpritSlot.row === statement.row;
    case 'culpritCol':
      return culpritSlot.col === statement.col;
    case 'culpritNotCol':
      return culpritSlot.col !== statement.col;
    case 'culpritNextTo':
      return isNextTo(
        culpritSlot,
        slotOf(layout, indexOfSuspect(layout, statement.other))
      );
    case 'culpritNotNextTo':
      return !isNextTo(
        culpritSlot,
        slotOf(layout, indexOfSuspect(layout, statement.other))
      );
    case 'culpritSameColumnAs':
      return isSameColumn(
        culpritSlot,
        slotOf(layout, indexOfSuspect(layout, statement.other))
      );
    case 'culpritAte':
      return (
        lunchOf(space, world, culprit) === foodIndex(layout, statement.food)
      );
    case 'culpritDidNotEat':
      return (
        lunchOf(space, world, culprit) !== foodIndex(layout, statement.food)
      );
    case 'innocent':
      return culprit !== indexOfSuspect(layout, statement.who);
    case 'ate':
      return (
        lunchOf(space, world, indexOfSuspect(layout, statement.who)) ===
        foodIndex(layout, statement.food)
      );
    case 'didNotEat':
      return (
        lunchOf(space, world, indexOfSuspect(layout, statement.who)) !==
        foodIndex(layout, statement.food)
      );
    case 'sameMeal':
      return (
        lunchOf(space, world, indexOfSuspect(layout, statement.a)) ===
        lunchOf(space, world, indexOfSuspect(layout, statement.b))
      );
    case 'foodCount': {
      const target = foodIndex(layout, statement.food);
      let count = 0;
      for (let i = 0; i < space.suspectCount; i++) {
        if (lunchOf(space, world, i) === target) {
          count++;
        }
      }
      return count === statement.count;
    }
  }
}

/** One byte per world: 1 if the statement is true there. */
export function truthVector(
  space: WorldSpace,
  statement: Statement
): Uint8Array {
  const vector = new Uint8Array(space.count);
  for (let w = 0; w < space.count; w++) {
    vector[w] = evaluate(space, w, statement) ? 1 : 0;
  }
  return vector;
}

/** Facts about lunches, as opposed to direct statements about the culprit. */
export function isFactStatement(statement: Statement): boolean {
  return (
    statement.kind === 'ate' ||
    statement.kind === 'didNotEat' ||
    statement.kind === 'sameMeal' ||
    statement.kind === 'foodCount'
  );
}

export function sameStatement(a: Statement, b: Statement): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
