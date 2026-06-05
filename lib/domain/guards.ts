// Hand-rolled type guards for the domain model.
//
// We deliberately avoid a schema/validation library (zod, io-ts, etc.): the
// model is small and these guards keep the dependency surface flat. Each guard
// narrows `unknown` and validates structural invariants (e.g. a grid's runs
// must cover exactly `width * height` cells), so a value that passes a guard is
// safe to treat as the corresponding type.

import type {
  Grid,
  PaletteEntry,
  Pattern,
  Project,
  ProgressGrid,
  Run,
  StitchCell,
  StitchGrid,
  ThreadKey,
} from './types';

/** Narrows to a non-null object (a plain record-like value). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** A finite number (rejects `NaN` and `±Infinity`). */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

/** A `ThreadKey` is just a string; provided for symmetry and call-site clarity. */
export function isThreadKey(value: unknown): value is ThreadKey {
  return isString(value);
}

/** A `StitchCell` is a `ThreadKey` or `null` (a blank cell). */
export function isStitchCell(value: unknown): value is StitchCell {
  return value === null || isThreadKey(value);
}

export function isPaletteEntry(value: unknown): value is PaletteEntry {
  return (
    isRecord(value) &&
    isString(value.key) &&
    isString(value.symbol) &&
    isString(value.color) &&
    isString(value.brand) &&
    isString(value.code) &&
    isString(value.label)
  );
}

/** Validates a single run given a guard for its value type. */
function isRun<T>(value: unknown, isValue: (v: unknown) => v is T): value is Run<T> {
  return isRecord(value) && isValue(value.value) && isPositiveInteger(value.count);
}

/**
 * Validates a {@link Grid} given a guard for its cell type, including the
 * invariant that the runs cover exactly `width * height` cells.
 */
function isGrid<T>(value: unknown, isValue: (v: unknown) => v is T): value is Grid<T> {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.width) ||
    !isNonNegativeInteger(value.height) ||
    !Array.isArray(value.runs)
  ) {
    return false;
  }
  let total = 0;
  for (const run of value.runs) {
    if (!isRun(run, isValue)) {
      return false;
    }
    total += run.count;
  }
  return total === value.width * value.height;
}

export function isStitchGrid(value: unknown): value is StitchGrid {
  return isGrid(value, isStitchCell);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isProgressGrid(value: unknown): value is ProgressGrid {
  return isGrid(value, isBoolean);
}

export function isPattern(value: unknown): value is Pattern {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNonNegativeInteger(value.width) &&
    isNonNegativeInteger(value.height) &&
    Array.isArray(value.palette) &&
    value.palette.every(isPaletteEntry) &&
    isStitchGrid(value.grid) &&
    value.grid.width === value.width &&
    value.grid.height === value.height &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

export function isProject(value: unknown): value is Project {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.patternId) &&
    isProgressGrid(value.progress) &&
    isNonNegativeInteger(value.completedCount) &&
    isNonNegativeInteger(value.totalCount) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

// Re-export a couple of primitive guards that are handy at call sites.
export { isFiniteNumber };
