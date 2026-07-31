/**
 * Row-bounded run-length encoded grids.
 *
 * Runs never cross a row boundary. That costs at most `height - 1` extra runs
 * versus a fully flattened encoding, and in exchange:
 *   - an N-row slice is a self-contained grid (Firestore chunking)
 *   - `getCell` is O(runs in that row) rather than O(all runs)
 *   - the invariant is structural rather than validated after the fact
 *
 * All functions are pure. Inputs are never mutated.
 */

import type { Grid, Run } from './types';

export type Equals<T> = (a: T, b: T) => boolean;

function defaultEquals<T>(a: T, b: T): boolean {
  return a === b;
}

function assertPositiveInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer, received ${value}`);
  }
}

/** Run-length encode a single row of values. */
export function encodeRow<T>(values: readonly T[], equals: Equals<T> = defaultEquals): Run<T>[] {
  const runs: Run<T>[] = [];
  for (const value of values) {
    const last = runs.length > 0 ? runs[runs.length - 1] : undefined;
    if (last !== undefined && equals(last.value, value)) {
      runs[runs.length - 1] = { value: last.value, count: last.count + 1 };
    } else {
      runs.push({ value, count: 1 });
    }
  }
  return runs;
}

/** Expand a single row back into values. */
export function decodeRow<T>(runs: readonly Run<T>[]): T[] {
  const values: T[] = [];
  for (const run of runs) {
    for (let i = 0; i < run.count; i += 1) {
      values.push(run.value);
    }
  }
  return values;
}

/** Total number of values a row's runs expand to. */
export function rowLength<T>(runs: readonly Run<T>[]): number {
  let total = 0;
  for (const run of runs) {
    total += run.count;
  }
  return total;
}

/**
 * Build a grid from row-major values.
 *
 * @throws RangeError if dimensions are not positive integers, or if
 *   `cells.length` does not equal `width * height`.
 */
export function makeGrid<T>(
  width: number,
  height: number,
  cells: readonly T[],
  equals: Equals<T> = defaultEquals,
): Grid<T> {
  assertPositiveInt(width, 'width');
  assertPositiveInt(height, 'height');
  if (cells.length !== width * height) {
    throw new RangeError(
      `expected ${width * height} cells for a ${width}x${height} grid, received ${cells.length}`,
    );
  }

  const rows: Run<T>[][] = [];
  for (let y = 0; y < height; y += 1) {
    const start = y * width;
    rows.push(encodeRow(cells.slice(start, start + width), equals));
  }
  return { width, height, rows };
}

/**
 * Build a grid from already-encoded rows, validating the row invariant.
 * This is the reassembly primitive for chunked reads.
 *
 * @throws RangeError if any row does not sum to `width`.
 */
export function gridFromRows<T>(width: number, rows: readonly (readonly Run<T>[])[]): Grid<T> {
  assertPositiveInt(width, 'width');
  assertPositiveInt(rows.length, 'height');

  rows.forEach((row, y) => {
    for (const run of row) {
      if (!Number.isInteger(run.count) || run.count < 1) {
        throw new RangeError(`row ${y} has a run with a non-positive count: ${run.count}`);
      }
    }
    const length = rowLength(row);
    if (length !== width) {
      throw new RangeError(`row ${y} expands to ${length} cells, expected ${width}`);
    }
  });

  return { width, height: rows.length, rows: rows.map((row) => row.slice()) };
}

/** Uniform grid, one run per row. */
export function filledGrid<T>(width: number, height: number, value: T): Grid<T> {
  assertPositiveInt(width, 'width');
  assertPositiveInt(height, 'height');
  const rows: Run<T>[][] = [];
  for (let y = 0; y < height; y += 1) {
    rows.push([{ value, count: width }]);
  }
  return { width, height, rows };
}

function assertInBounds<T>(grid: Grid<T>, x: number, y: number): void {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= grid.width ||
    y >= grid.height
  ) {
    throw new RangeError(`(${x}, ${y}) is outside a ${grid.width}x${grid.height} grid`);
  }
}

/**
 * Read one cell. O(runs in that row).
 *
 * @throws RangeError if out of bounds, or if the row is malformed.
 */
export function getCell<T>(grid: Grid<T>, x: number, y: number): T {
  assertInBounds(grid, x, y);
  const row = grid.rows[y];
  let offset = 0;
  for (const run of row) {
    offset += run.count;
    if (x < offset) {
      return run.value;
    }
  }
  throw new RangeError(`row ${y} is malformed: expands to ${offset} cells, expected ${grid.width}`);
}

/**
 * Return a grid with one cell replaced. Returns the original reference when
 * the value is unchanged. O(width) for the affected row only.
 */
export function setCell<T>(
  grid: Grid<T>,
  x: number,
  y: number,
  value: T,
  equals: Equals<T> = defaultEquals,
): Grid<T> {
  assertInBounds(grid, x, y);
  if (equals(getCell(grid, x, y), value)) {
    return grid;
  }
  const values = decodeRow(grid.rows[y]);
  values[x] = value;
  const rows = grid.rows.slice();
  rows[y] = encodeRow(values, equals);
  return { width: grid.width, height: grid.height, rows };
}

/** Expand one row. */
export function getRow<T>(grid: Grid<T>, y: number): T[] {
  if (!Number.isInteger(y) || y < 0 || y >= grid.height) {
    throw new RangeError(`row ${y} is outside a grid of height ${grid.height}`);
  }
  return decodeRow(grid.rows[y]);
}

/** Expand the whole grid, row-major. */
export function gridToCells<T>(grid: Grid<T>): T[] {
  const cells: T[] = [];
  for (const row of grid.rows) {
    for (const run of row) {
      for (let i = 0; i < run.count; i += 1) {
        cells.push(run.value);
      }
    }
  }
  return cells;
}

/**
 * Count cells whose value satisfies a predicate. O(runs), not O(cells), so it
 * stays cheap on large charts.
 */
export function countCells<T>(grid: Grid<T>, predicate: (value: T) => boolean): number {
  let total = 0;
  for (const row of grid.rows) {
    for (const run of row) {
      if (predicate(run.value)) {
        total += run.count;
      }
    }
  }
  return total;
}

/**
 * Reduce over runs rather than cells, weighting by run count. Used for
 * derived progress totals.
 */
export function reduceRuns<T, A>(
  grid: Grid<T>,
  reducer: (accumulator: A, value: T, count: number) => A,
  initial: A,
): A {
  let accumulator = initial;
  for (const row of grid.rows) {
    for (const run of row) {
      accumulator = reducer(accumulator, run.value, run.count);
    }
  }
  return accumulator;
}

/** Transform every value, re-coalescing runs under the target's equality. */
export function mapGrid<T, U>(
  grid: Grid<T>,
  transform: (value: T) => U,
  equals: Equals<U> = defaultEquals,
): Grid<U> {
  const rows = grid.rows.map((row) => {
    const mapped: Run<U>[] = [];
    for (const run of row) {
      const value = transform(run.value);
      const last = mapped.length > 0 ? mapped[mapped.length - 1] : undefined;
      if (last !== undefined && equals(last.value, value)) {
        mapped[mapped.length - 1] = {
          value: last.value,
          count: last.count + run.count,
        };
      } else {
        mapped.push({ value, count: run.count });
      }
    }
    return mapped;
  });
  return { width: grid.width, height: grid.height, rows };
}

/**
 * Extract rows [startRow, endRow) as a self-contained grid. This is the
 * chunking primitive: no run is split, so no chunk needs re-coalescing.
 *
 * @throws RangeError if the range is invalid or empty.
 */
export function sliceRows<T>(grid: Grid<T>, startRow: number, endRow: number): Grid<T> {
  if (
    !Number.isInteger(startRow) ||
    !Number.isInteger(endRow) ||
    startRow < 0 ||
    endRow > grid.height ||
    startRow >= endRow
  ) {
    throw new RangeError(
      `invalid row range [${startRow}, ${endRow}) for a grid of height ${grid.height}`,
    );
  }
  return {
    width: grid.width,
    height: endRow - startRow,
    rows: grid.rows.slice(startRow, endRow).map((row) => row.slice()),
  };
}

/**
 * Split a grid into chunks of at most `rowsPerChunk` rows, in order. The last
 * chunk may be shorter.
 */
export function chunkRows<T>(grid: Grid<T>, rowsPerChunk: number): Grid<T>[] {
  assertPositiveInt(rowsPerChunk, 'rowsPerChunk');
  const chunks: Grid<T>[] = [];
  for (let start = 0; start < grid.height; start += rowsPerChunk) {
    const end = Math.min(start + rowsPerChunk, grid.height);
    chunks.push(sliceRows(grid, start, end));
  }
  return chunks;
}

/**
 * Reassemble chunks produced by `chunkRows`, in order.
 *
 * @throws RangeError if chunks are empty or their widths disagree.
 */
export function joinChunks<T>(chunks: readonly Grid<T>[]): Grid<T> {
  if (chunks.length === 0) {
    throw new RangeError('cannot join an empty list of chunks');
  }
  const width = chunks[0].width;
  const rows: (readonly Run<T>[])[] = [];
  chunks.forEach((chunk, index) => {
    if (chunk.width !== width) {
      throw new RangeError(`chunk ${index} has width ${chunk.width}, expected ${width}`);
    }
    for (const row of chunk.rows) {
      rows.push(row);
    }
  });
  return gridFromRows(width, rows);
}
