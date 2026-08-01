/**
 * Packing grids and lists into Firestore documents.
 *
 * Firestore does not allow an array to contain another array, so `Grid.rows`
 * (`Run[][]`) and `Pattern.cellContents` (`Placement[][]`) cannot be native
 * fields. Both are stored as JSON strings. See ADR-005.
 *
 * Chunks are sized by byte budget rather than a fixed row count, because run
 * density varies enormously between a blank border row and a confetti row.
 */

import { gridFromRows } from '../domain/grid';
import type { Grid, Run } from '../domain/types';

/** Target encoded size per chunk. Roughly a fifth of the 1 MiB document limit. */
export const CHUNK_BUDGET_BYTES = 200 * 1024;

/**
 * A single row larger than this is rejected rather than written. Unreachable
 * for real charts: a 10,000-wide row with every cell distinct encodes to about
 * 120 KB. This catches corrupt input, not legitimate patterns.
 */
export const MAX_ROW_BYTES = 900 * 1024;

/** Chunk document ids are zero-padded to this width. */
export const CHUNK_ID_DIGITS = 4;

/** Implied by the id width: 0000 through 9999. */
export const MAX_CHUNKS = 10 ** CHUNK_ID_DIGITS;

/**
 * Encoded payloads contain only digits, minus signs, commas, and brackets, all
 * of which are single-byte in UTF-8, so string length is the exact byte count.
 */
function encodedBytes(json: string): number {
  return json.length;
}

/**
 * Firestore orders documents by id lexicographically, so ids are zero-padded.
 * Without padding, chunk 10 would sort before chunk 2.
 */
export function chunkDocumentId(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`chunk index must be a non-negative integer, received ${index}`);
  }
  if (index >= MAX_CHUNKS) {
    throw new RangeError(
      `chunk index ${index} exceeds the ${MAX_CHUNKS} chunk limit implied by ${CHUNK_ID_DIGITS}-digit ids`,
    );
  }
  return String(index).padStart(CHUNK_ID_DIGITS, '0');
}

/* ------------------------------------------------------------------ *
 * Grid chunks
 * ------------------------------------------------------------------ */

export interface GridChunk {
  /** 0-based, matches the document id. */
  readonly index: number;
  /** First grid row this chunk covers. */
  readonly startRow: number;
  /** Rows in this chunk. Variable, driven by the byte budget. */
  readonly rowCount: number;
  /** JSON `number[][]`: one inner array per row, flattened run pairs. */
  readonly data: string;
}

/**
 * Flatten a row's runs to number pairs. Dropping the repeated "value" and
 * "count" key text is roughly a 4x size reduction over serializing the objects.
 */
export function encodeRunsToPairs(runs: readonly Run<number>[]): number[] {
  const pairs: number[] = [];
  for (const run of runs) {
    pairs.push(run.value, run.count);
  }
  return pairs;
}

export function decodePairsToRuns(pairs: readonly number[]): Run<number>[] {
  if (pairs.length % 2 !== 0) {
    throw new RangeError(
      `encoded row has ${pairs.length} numbers, which is not a whole number of run pairs`,
    );
  }
  const runs: Run<number>[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const value = pairs[i];
    const count = pairs[i + 1];
    if (!Number.isInteger(value) || !Number.isInteger(count) || count < 1) {
      throw new RangeError(
        `encoded run at position ${i / 2} is invalid: value ${value}, count ${count}`,
      );
    }
    runs.push({ value, count });
  }
  return runs;
}

/**
 * Split a grid into chunks under the byte budget.
 *
 * A chunk always holds at least one row, even if that row alone exceeds the
 * budget, otherwise the packer could not make progress.
 *
 * @throws RangeError if a single row exceeds MAX_ROW_BYTES, or if the grid
 *   would need more than MAX_CHUNKS chunks.
 */
export function packGrid(
  grid: Grid<number>,
  budgetBytes: number = CHUNK_BUDGET_BYTES,
): GridChunk[] {
  if (!Number.isInteger(budgetBytes) || budgetBytes < 1) {
    throw new RangeError(`budgetBytes must be a positive integer, received ${budgetBytes}`);
  }

  const chunks: GridChunk[] = [];
  let pending: number[][] = [];
  let pendingStart = 0;
  // Two bytes for the enclosing brackets of the JSON array.
  let pendingBytes = 2;

  const flush = (): void => {
    if (pending.length === 0) {
      return;
    }
    chunks.push({
      index: chunks.length,
      startRow: pendingStart,
      rowCount: pending.length,
      data: JSON.stringify(pending),
    });
    pending = [];
    pendingBytes = 2;
  };

  for (let y = 0; y < grid.height; y += 1) {
    const pairs = encodeRunsToPairs(grid.rows[y]);
    const rowBytes = encodedBytes(JSON.stringify(pairs)) + 1; // plus separating comma

    if (rowBytes > MAX_ROW_BYTES) {
      throw new RangeError(
        `row ${y} encodes to ${rowBytes} bytes, above the ${MAX_ROW_BYTES} byte limit`,
      );
    }

    if (pending.length > 0 && pendingBytes + rowBytes > budgetBytes) {
      flush();
      pendingStart = y;
    }

    pending.push(pairs);
    pendingBytes += rowBytes;
  }

  flush();

  if (chunks.length > MAX_CHUNKS) {
    throw new RangeError(`grid needs ${chunks.length} chunks, above the ${MAX_CHUNKS} limit`);
  }

  return chunks;
}

/**
 * Rejoin chunks into a grid, validating that the sequence is complete and
 * contiguous. `gridFromRows` then validates that every row sums to `width`.
 *
 * `height` comes from the parent document and is required: without it, a
 * sequence missing its trailing chunks is still in order and contiguous, and
 * would silently rebuild a shorter grid.
 *
 * @throws RangeError on a missing, duplicated, out-of-order, or truncated chunk
 *   sequence.
 */
export function unpackGrid(
  width: number,
  height: number,
  chunks: readonly GridChunk[],
): Grid<number> {
  if (chunks.length === 0) {
    throw new RangeError('cannot rebuild a grid from zero chunks');
  }

  const rows: Run<number>[][] = [];
  let expectedStart = 0;

  chunks.forEach((chunk, position) => {
    if (chunk.index !== position) {
      throw new RangeError(
        `chunk at position ${position} reports index ${chunk.index}; chunks must be in order`,
      );
    }
    if (chunk.startRow !== expectedStart) {
      throw new RangeError(
        `chunk ${chunk.index} starts at row ${chunk.startRow}, expected ${expectedStart}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(chunk.data);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new RangeError(`chunk ${chunk.index} data is not valid JSON: ${reason}`);
    }

    if (!Array.isArray(parsed)) {
      throw new RangeError(`chunk ${chunk.index} data is not an array of rows`);
    }
    if (parsed.length !== chunk.rowCount) {
      throw new RangeError(
        `chunk ${chunk.index} holds ${parsed.length} rows but reports rowCount ${chunk.rowCount}`,
      );
    }

    for (const row of parsed) {
      if (!Array.isArray(row)) {
        throw new RangeError(`chunk ${chunk.index} contains a row that is not an array`);
      }
      rows.push(decodePairsToRuns(row as number[]));
    }

    expectedStart += chunk.rowCount;
  });

  if (rows.length !== height) {
    throw new RangeError(
      `chunks rebuild ${rows.length} rows but the pattern reports a height of ${height}; the sequence is truncated`,
    );
  }

  return gridFromRows(width, rows);
}

/* ------------------------------------------------------------------ *
 * Item chunks (lines and points)
 * ------------------------------------------------------------------ */

export interface ItemChunk {
  readonly index: number;
  /** Index of the first item in the original list. */
  readonly start: number;
  readonly count: number;
  /** JSON array of the items themselves. */
  readonly data: string;
}

/** Encoded size of a value, for deciding whether a list must spill. */
export function encodedSize(value: unknown): number {
  return encodedBytes(JSON.stringify(value));
}

/**
 * Lines and points stay inline in the parent document while small. This decides
 * when they must move to their own chunk subcollection.
 */
export function shouldSpill(
  items: readonly unknown[],
  budgetBytes: number = CHUNK_BUDGET_BYTES,
): boolean {
  return encodedSize(items) > budgetBytes;
}

/**
 * Split a list into chunks under the byte budget. As with grids, a chunk always
 * holds at least one item.
 */
export function packItems<T>(
  items: readonly T[],
  budgetBytes: number = CHUNK_BUDGET_BYTES,
): ItemChunk[] {
  if (!Number.isInteger(budgetBytes) || budgetBytes < 1) {
    throw new RangeError(`budgetBytes must be a positive integer, received ${budgetBytes}`);
  }

  const chunks: ItemChunk[] = [];
  let pending: T[] = [];
  let pendingStart = 0;
  let pendingBytes = 2;

  const flush = (): void => {
    if (pending.length === 0) {
      return;
    }
    chunks.push({
      index: chunks.length,
      start: pendingStart,
      count: pending.length,
      data: JSON.stringify(pending),
    });
    pending = [];
    pendingBytes = 2;
  };

  items.forEach((item, i) => {
    const itemBytes = encodedSize(item) + 1;
    if (pending.length > 0 && pendingBytes + itemBytes > budgetBytes) {
      flush();
      pendingStart = i;
    }
    pending.push(item);
    pendingBytes += itemBytes;
  });

  flush();

  if (chunks.length > MAX_CHUNKS) {
    throw new RangeError(`list needs ${chunks.length} chunks, above the ${MAX_CHUNKS} limit`);
  }

  return chunks;
}

/**
 * Rejoin item chunks, validating the sequence.
 *
 * `expectedCount` comes from the parent document, for the same reason
 * `unpackGrid` requires `height`: a truncated sequence is otherwise
 * indistinguishable from a complete one.
 *
 * @throws RangeError on a missing, duplicated, out-of-order, or truncated
 *   chunk sequence.
 */
export function unpackItems<T>(chunks: readonly ItemChunk[], expectedCount: number): T[] {
  if (!Number.isInteger(expectedCount) || expectedCount < 0) {
    throw new RangeError(`expectedCount must be a non-negative integer, received ${expectedCount}`);
  }

  const items: T[] = [];
  let expectedStart = 0;

  chunks.forEach((chunk, position) => {
    if (chunk.index !== position) {
      throw new RangeError(
        `chunk at position ${position} reports index ${chunk.index}; chunks must be in order`,
      );
    }
    if (chunk.start !== expectedStart) {
      throw new RangeError(
        `chunk ${chunk.index} starts at item ${chunk.start}, expected ${expectedStart}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(chunk.data);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new RangeError(`chunk ${chunk.index} data is not valid JSON: ${reason}`);
    }

    if (!Array.isArray(parsed)) {
      throw new RangeError(`chunk ${chunk.index} data is not an array`);
    }
    if (parsed.length !== chunk.count) {
      throw new RangeError(
        `chunk ${chunk.index} holds ${parsed.length} items but reports count ${chunk.count}`,
      );
    }

    for (const item of parsed) {
      items.push(item as T);
    }
    expectedStart += chunk.count;
  });

  if (items.length !== expectedCount) {
    throw new RangeError(
      `chunks rebuild ${items.length} items but ${expectedCount} were expected; the sequence is truncated`,
    );
  }

  return items;
}
