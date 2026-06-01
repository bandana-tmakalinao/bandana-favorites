/**
 * Tried-gated adaptive placement — the pure state machine behind the duel board.
 *
 * The honest premise of a head-to-head is that you've eaten BOTH dishes. So ranking is modelled as
 * inserting a dish you've tried into your existing personal order (a ladder of dishes you've already
 * tried) via binary search — ~log₂(n) comparisons, each against something you've definitely had.
 * Every comparison is a real duel that also feeds the global Bradley-Terry model.
 *
 * No I/O, no React — unit-tested in placement.test.ts. The component (DuelBoard) owns the rendering
 * and POSTs each comparison; this module only decides the next pair and where a target lands.
 */

export interface Placeable {
  id: string;
}

export interface PlaceState<T extends Placeable> {
  /** Your personal ranking so far, best first (index 0 = #1). All are dishes you've tried. */
  sortedPlaced: T[];
  /** Dishes still to be placed — the target being placed is always toPlace[0]. */
  toPlace: T[];
  /** Binary-search bounds into sortedPlaced for the current target. */
  lo: number;
  hi: number;
  done: boolean;
  /** Original count of items to place — for progress display. */
  totalToPlace: number;
}

/** The index in sortedPlaced the current target is being compared against. */
export function pivotIndex<T extends Placeable>(s: PlaceState<T>): number {
  return Math.floor((s.lo + s.hi) / 2);
}

/**
 * Seed a placement run. `placed` is the existing tried ladder (your personal order); `toPlace` is the
 * set of tried dishes to insert. When the ladder is empty (a brand-new taster), the first item to
 * place becomes the anchor so there's always something to compare against.
 */
export function initPlacement<T extends Placeable>(placed: T[], toPlace: T[]): PlaceState<T> {
  let sortedPlaced = placed.slice();
  const placedIds = new Set(sortedPlaced.map((p) => p.id));
  // Never try to place something already in the ladder (or a duplicate within the queue).
  const seen = new Set(placedIds);
  let queue: T[] = [];
  for (const t of toPlace) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    queue.push(t);
  }
  if (sortedPlaced.length === 0) {
    if (queue.length === 0) {
      return { sortedPlaced: [], toPlace: [], lo: 0, hi: 0, done: true, totalToPlace: 0 };
    }
    sortedPlaced = [queue[0]];
    queue = queue.slice(1);
  }
  return {
    sortedPlaced,
    toPlace: queue,
    lo: 0,
    hi: sortedPlaced.length,
    done: queue.length === 0,
    totalToPlace: queue.length,
  };
}

/** Insert the current target into sortedPlaced at `pos`, then advance to the next item. */
export function placeTarget<T extends Placeable>(s: PlaceState<T>, pos: number): PlaceState<T> {
  const target = s.toPlace[0];
  const clamped = Math.max(0, Math.min(pos, s.sortedPlaced.length));
  const sp = [...s.sortedPlaced.slice(0, clamped), target, ...s.sortedPlaced.slice(clamped)];
  const tp = s.toPlace.slice(1);
  return {
    sortedPlaced: sp,
    toPlace: tp,
    lo: 0,
    hi: sp.length,
    done: tp.length === 0,
    totalToPlace: s.totalToPlace,
  };
}

/**
 * Advance the binary search after a comparison.
 * Target won → it belongs in the better (upper) half → shrink hi.
 * Target lost → it belongs in the worse (lower) half → grow lo.
 * When lo >= hi, the position is pinned: insert and move to the next item.
 */
export function advancePlace<T extends Placeable>(targetWon: boolean, s: PlaceState<T>): PlaceState<T> {
  if (s.done || s.toPlace.length === 0) return s;
  const mid = pivotIndex(s);
  const lo = targetWon ? s.lo : mid + 1;
  const hi = targetWon ? mid : s.hi;
  if (lo >= hi) return placeTarget(s, lo);
  return { ...s, lo, hi };
}

/** "Too close to call" — settle the current item just below the pivot, recording nothing. */
export function resolveTie<T extends Placeable>(s: PlaceState<T>): PlaceState<T> {
  if (s.done || s.toPlace.length === 0) return s;
  const mid = pivotIndex(s);
  return placeTarget(s, Math.min(mid + 1, s.sortedPlaced.length));
}

/**
 * "Haven't tried this" escape hatch: the opponent shown isn't something the user has eaten, so it's an
 * invalid comparison point. Drop it from THIS session's ladder and re-pick a pivot for the same target.
 * Records nothing; the dropped item's real global ranking is untouched. If the ladder runs out, the
 * target is pinned at lo.
 */
export function removePivot<T extends Placeable>(s: PlaceState<T>): PlaceState<T> {
  if (s.done || s.toPlace.length === 0) return s;
  const mid = pivotIndex(s);
  const sp = [...s.sortedPlaced.slice(0, mid), ...s.sortedPlaced.slice(mid + 1)];
  const hi = s.hi - 1;
  if (s.lo >= hi) return placeTarget({ ...s, sortedPlaced: sp, hi }, s.lo);
  return { ...s, sortedPlaced: sp, hi };
}
