// Pure helpers for the row-major, run-length-encoded grid representation.
//
// A {@link Grid} stores cells compactly as runs of identical values. These
// helpers convert between a flat row-major cell array and that encoding, and
// expose a few read/count utilities. Everything here is pure: inputs are never
// mutated.

import type { Grid, Run } from './types';

/** Strict equality used to coalesce adjacent cells when there is no custom one. */
function defaultEquals<T>(a: T, b: T): boolean {
  return a === b;
}

/**
 * Run-length-encodes a flat array of cells, coalescing adjacent equal values.
 *
 * @param cells Row-major cells.
 * @param equals Optional equality used to decide whether two cells coalesce.
 */
export function runLengthEncode<T>(
  cells: readonly T[],
  equals: (a: T, b: T) => boolean = defaultEquals,
): Run<T>[] {
  const runs: Run<T>[] = [];
  for (const cell of cells) {
    const last = runs[runs.length - 1];
    if (last !== undefined && equals(last.value, cell)) {
      last.count += 1;
    } else {
      runs.push({ value: cell, count: 1 });
    }
  }
  return runs;
}

/** Expands run-length-encoded runs back into a flat row-major cell array. */
export function runLengthDecode<T>(runs: readonly Run<T>[]): T[] {
  const cells: T[] = [];
  for (const run of runs) {
    for (let i = 0; i < run.count; i += 1) {
      cells.push(run.value);
    }
  }
  return cells;
}

/**
 * Builds a {@link Grid} from a flat row-major array of `width * height` cells.
 *
 * @throws RangeError when `cells.length !== width * height`, or when `width` or
 *   `height` is not a non-negative integer.
 */
export function makeGrid<T>(
  width: number,
  height: number,
  cells: readonly T[],
  equals?: (a: T, b: T) => boolean,
): Grid<T> {
  if (!Number.isInteger(width) || width < 0 || !Number.isInteger(height) || height < 0) {
    throw new RangeError('Grid dimensions must be non-negative integers');
  }
  if (cells.length !== width * height) {
    throw new RangeError(
      `Expected ${width * height} cells for a ${width}×${height} grid, got ${cells.length}`,
    );
  }
  return { width, height, runs: runLengthEncode(cells, equals) };
}

/** Total number of cells a grid holds (`width * height`). */
export function gridCellCount<T>(grid: Grid<T>): number {
  return grid.width * grid.height;
}

/** Expands a {@link Grid} into a flat row-major array of its cells. */
export function gridToCells<T>(grid: Grid<T>): T[] {
  return runLengthDecode(grid.runs);
}

/**
 * Returns the cell at `(x, y)` (column, row), both zero-based.
 *
 * @throws RangeError when the coordinates fall outside the grid.
 */
export function getCell<T>(grid: Grid<T>, x: number, y: number): T {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= grid.width ||
    y >= grid.height
  ) {
    throw new RangeError(
      `Coordinates (${x}, ${y}) are outside a ${grid.width}×${grid.height} grid`,
    );
  }
  const target = y * grid.width + x;
  let index = 0;
  for (const run of grid.runs) {
    if (target < index + run.count) {
      return run.value;
    }
    index += run.count;
  }
  // Unreachable for a well-formed grid (sum of counts === width * height).
  throw new RangeError('Grid runs do not cover the requested cell');
}

/** Counts the cells whose value satisfies `predicate`, without expanding the grid. */
export function countCells<T>(grid: Grid<T>, predicate: (value: T) => boolean): number {
  let total = 0;
  for (const run of grid.runs) {
    if (predicate(run.value)) {
      total += run.count;
    }
  }
  return total;
}
