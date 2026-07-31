/**
 * Progress representation and derived totals.
 *
 * Cell progress is a bitmask per cell over that cell's placements, so each
 * stitch in a multi-stitch cell is independently markable. An untouched chart
 * is all zeros, which encodes to one run per row.
 *
 * Counts are derived rather than stored. ADR-004 removed `completedCount` and
 * `totalCount` from `Project` because unchecked denormalised caches drift.
 */

import { placementCountAt } from './cells';
import { filledGrid, getCell, reduceRuns, setCell } from './grid';
import { MAX_PLACEMENTS_PER_CELL, SCHEMA_VERSION } from './types';
import type { Pattern, Project, Run } from './types';

function assertPlacementIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_PLACEMENTS_PER_CELL) {
    throw new RangeError(
      `placement index must be an integer in [0, ${MAX_PLACEMENTS_PER_CELL}), received ${index}`,
    );
  }
}

/** Bit for a placement index, as an unsigned value. */
function bit(index: number): number {
  return (1 << index) >>> 0;
}

export function isPlacementComplete(mask: number, index: number): boolean {
  assertPlacementIndex(index);
  return (mask & bit(index)) !== 0;
}

export function setPlacementComplete(mask: number, index: number, complete: boolean): number {
  assertPlacementIndex(index);
  const b = bit(index);
  return (complete ? mask | b : mask & ~b) >>> 0;
}

export function togglePlacement(mask: number, index: number): number {
  assertPlacementIndex(index);
  return (mask ^ bit(index)) >>> 0;
}

/**
 * Mask with every placement of a cell of the given size marked complete.
 * `1 << 32` is 1 in JavaScript, so the full-width case is special-cased.
 */
export function completeMask(placementCount: number): number {
  if (
    !Number.isInteger(placementCount) ||
    placementCount < 0 ||
    placementCount > MAX_PLACEMENTS_PER_CELL
  ) {
    throw new RangeError(
      `placement count must be an integer in [0, ${MAX_PLACEMENTS_PER_CELL}], received ${placementCount}`,
    );
  }
  if (placementCount === MAX_PLACEMENTS_PER_CELL) {
    return 0xffffffff;
  }
  return ((1 << placementCount) - 1) >>> 0;
}

/** Number of set bits. Standard 32-bit population count. */
export function popcount(value: number): number {
  let v = value >>> 0;
  v -= (v >>> 1) & 0x55555555;
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  v = (v + (v >>> 4)) & 0x0f0f0f0f;
  return (v * 0x01010101) >>> 24;
}

/* ------------------------------------------------------------------ *
 * Boolean run lists (line and point progress)
 * ------------------------------------------------------------------ */

/** A run list covering `length` incomplete stitches. Empty when length is 0. */
export function emptyRunList(length: number): Run<boolean>[] {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError(`length must be a non-negative integer, received ${length}`);
  }
  return length === 0 ? [] : [{ value: false, count: length }];
}

/** Total number of stitches a run list covers. */
export function runListLength(runs: readonly Run<boolean>[]): number {
  let total = 0;
  for (const run of runs) {
    total += run.count;
  }
  return total;
}

/** Number of completed stitches in a run list. */
export function countCompletedRuns(runs: readonly Run<boolean>[]): number {
  let total = 0;
  for (const run of runs) {
    if (run.value) {
      total += run.count;
    }
  }
  return total;
}

export function getRunListValue(runs: readonly Run<boolean>[], index: number): boolean {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`index must be a non-negative integer, received ${index}`);
  }
  let offset = 0;
  for (const run of runs) {
    offset += run.count;
    if (index < offset) {
      return run.value;
    }
  }
  throw new RangeError(`index ${index} is outside a run list covering ${offset} stitches`);
}

/** Return a run list with one entry replaced, re-coalescing neighbours. */
export function setRunListValue(
  runs: readonly Run<boolean>[],
  index: number,
  value: boolean,
): Run<boolean>[] {
  const total = runListLength(runs);
  if (!Number.isInteger(index) || index < 0 || index >= total) {
    throw new RangeError(`index ${index} is outside a run list covering ${total} stitches`);
  }

  const result: Run<boolean>[] = [];
  let offset = 0;
  for (const run of runs) {
    for (let i = 0; i < run.count; i += 1) {
      const current = offset + i === index ? value : run.value;
      const last = result.length > 0 ? result[result.length - 1] : undefined;
      if (last !== undefined && last.value === current) {
        result[result.length - 1] = {
          value: last.value,
          count: last.count + 1,
        };
      } else {
        result.push({ value: current, count: 1 });
      }
    }
    offset += run.count;
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * Project construction and updates
 * ------------------------------------------------------------------ */

export interface CreateProjectInput {
  readonly id: string;
  readonly pattern: Pattern;
  /** ISO 8601. Injected rather than read from the clock, so this stays pure. */
  readonly now: string;
}

/** A project with nothing stitched yet. */
export function createEmptyProject({ id, pattern, now }: CreateProjectInput): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    patternId: pattern.id,
    width: pattern.width,
    height: pattern.height,
    cellProgress: filledGrid(pattern.width, pattern.height, 0),
    lineProgress: emptyRunList(pattern.lines.length),
    pointProgress: emptyRunList(pattern.points.length),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Mark one placement in one cell complete or incomplete. Returns the original
 * project reference when nothing changes.
 *
 * @throws RangeError if the cell holds no placement at that index, so progress
 *   can never reference a stitch that is not there.
 */
export function markPlacement(
  pattern: Pattern,
  project: Project,
  x: number,
  y: number,
  placementIndex: number,
  complete: boolean,
  now: string,
): Project {
  const contentIndex = getCell(pattern.cells, x, y);
  const placements = placementCountAt(pattern.cellContents, contentIndex);
  if (placementIndex >= placements) {
    throw new RangeError(
      `cell (${x}, ${y}) has ${placements} placements, cannot mark index ${placementIndex}`,
    );
  }

  const current = getCell(project.cellProgress, x, y);
  const next = setPlacementComplete(current, placementIndex, complete);
  if (next === current) {
    return project;
  }
  return {
    ...project,
    cellProgress: setCell(project.cellProgress, x, y, next),
    updatedAt: now,
  };
}

/** Mark every placement in one cell complete or incomplete. */
export function markCell(
  pattern: Pattern,
  project: Project,
  x: number,
  y: number,
  complete: boolean,
  now: string,
): Project {
  const contentIndex = getCell(pattern.cells, x, y);
  const placements = placementCountAt(pattern.cellContents, contentIndex);
  const next = complete ? completeMask(placements) : 0;
  const current = getCell(project.cellProgress, x, y);
  if (next === current) {
    return project;
  }
  return {
    ...project,
    cellProgress: setCell(project.cellProgress, x, y, next),
    updatedAt: now,
  };
}

/** Mark one line stitch complete or incomplete, by index into pattern.lines. */
export function markLine(project: Project, index: number, complete: boolean, now: string): Project {
  if (getRunListValue(project.lineProgress, index) === complete) {
    return project;
  }
  return {
    ...project,
    lineProgress: setRunListValue(project.lineProgress, index, complete),
    updatedAt: now,
  };
}

/** Mark one point stitch complete or incomplete, by index into pattern.points. */
export function markPoint(
  project: Project,
  index: number,
  complete: boolean,
  now: string,
): Project {
  if (getRunListValue(project.pointProgress, index) === complete) {
    return project;
  }
  return {
    ...project,
    pointProgress: setRunListValue(project.pointProgress, index, complete),
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ *
 * Derived totals
 * ------------------------------------------------------------------ */

/** Total cell-occupying stitches in a pattern. O(runs). */
export function countPlacements(pattern: Pattern): number {
  return reduceRuns(
    pattern.cells,
    (total, contentIndex, count) =>
      total + placementCountAt(pattern.cellContents, contentIndex) * count,
    0,
  );
}

/** Total completed cell-occupying stitches. O(runs). */
export function countCompletedPlacements(project: Project): number {
  return reduceRuns(
    project.cellProgress,
    (total, mask, count) => total + popcount(mask) * count,
    0,
  );
}

export interface ProgressCount {
  readonly completed: number;
  readonly total: number;
}

export interface ProgressSummary {
  readonly completed: number;
  readonly total: number;
  readonly cells: ProgressCount;
  readonly lines: ProgressCount;
  readonly points: ProgressCount;
}

/**
 * Derived replacement for the stored counts removed in ADR-004. Every figure
 * is computed from the runs, so it cannot drift from the data.
 */
export function summarizeProgress(pattern: Pattern, project: Project): ProgressSummary {
  const cells: ProgressCount = {
    completed: countCompletedPlacements(project),
    total: countPlacements(pattern),
  };
  const lines: ProgressCount = {
    completed: countCompletedRuns(project.lineProgress),
    total: pattern.lines.length,
  };
  const points: ProgressCount = {
    completed: countCompletedRuns(project.pointProgress),
    total: pattern.points.length,
  };
  return {
    completed: cells.completed + lines.completed + points.completed,
    total: cells.total + lines.total + points.total,
    cells,
    lines,
    points,
  };
}
