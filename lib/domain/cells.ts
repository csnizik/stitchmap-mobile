/**
 * Canonical ordering and interning for cell contents.
 *
 * The grid stores integer indices into a per-pattern table of distinct cell
 * contents rather than the contents themselves. This roughly thirds stored
 * size on a detailed chart, reduces run equality to integer comparison, and
 * leaves grid chunks valid without the palette. See ADR-004.
 *
 * Interning is only sound if equal cells produce equal keys, so contents are
 * canonicalised (sorted, exact duplicates dropped) before they are keyed.
 */

import { getCell, makeGrid } from './grid';
import { BLANK_CELL_INDEX, CORNERS, MAX_PLACEMENTS_PER_CELL, SLANTS } from './types';
import type { CellContent, CellGrid, Corner, Pattern, Placement, Slant } from './types';

/**
 * Sort order for placement kinds. Chosen so the visually dominant stitch in a
 * cell comes first, which keeps rendering order stable.
 */
const KIND_ORDER: Record<Placement['kind'], number> = {
  full: 0,
  half: 1,
  threeQuarter: 2,
  quarter: 3,
};

const CORNER_ORDER: Record<Corner, number> = {
  topLeft: 0,
  topRight: 1,
  bottomLeft: 2,
  bottomRight: 3,
};

const SLANT_ORDER: Record<Slant, number> = {
  forward: 0,
  backward: 1,
};

function orientationRank(placement: Placement): number {
  switch (placement.kind) {
    case 'full':
      return 0;
    case 'half':
      return SLANT_ORDER[placement.slant];
    case 'quarter':
    case 'threeQuarter':
      return CORNER_ORDER[placement.corner];
  }
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Total order over placements. Returns 0 only for exact duplicates, which is
 * what makes duplicate removal in `canonicalizeCell` correct.
 */
export function comparePlacements(a: Placement, b: Placement): number {
  const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (byKind !== 0) return byKind;

  const byOrientation = orientationRank(a) - orientationRank(b);
  if (byOrientation !== 0) return byOrientation;

  return compareStrings(a.thread, b.thread);
}

/**
 * Put a cell's placements into canonical order and drop exact duplicates.
 *
 * @throws RangeError if the cell holds more placements than a progress mask
 *   can address.
 */
export function canonicalizeCell(placements: readonly Placement[]): CellContent {
  const sorted = [...placements].sort(comparePlacements);
  const canonical: Placement[] = [];
  for (const placement of sorted) {
    const previous = canonical.length > 0 ? canonical[canonical.length - 1] : undefined;
    if (previous === undefined || comparePlacements(previous, placement) !== 0) {
      canonical.push(placement);
    }
  }
  if (canonical.length > MAX_PLACEMENTS_PER_CELL) {
    throw new RangeError(
      `a cell may hold at most ${MAX_PLACEMENTS_PER_CELL} placements, received ${canonical.length}`,
    );
  }
  return canonical;
}

/**
 * Stable key for a canonicalised cell. Built from JSON of a tuple form so
 * thread keys containing punctuation cannot collide with a delimiter.
 */
export function cellKey(content: CellContent): string {
  const tuples = content.map((placement): readonly string[] => {
    switch (placement.kind) {
      case 'full':
        return ['f', placement.thread];
      case 'half':
        return ['h', placement.slant, placement.thread];
      case 'quarter':
        return ['q', placement.corner, placement.thread];
      case 'threeQuarter':
        return ['t', placement.corner, placement.thread];
    }
  });
  return JSON.stringify(tuples);
}

/** Structural equality for cell contents, for callers not using interning. */
export function cellsEqual(a: CellContent, b: CellContent): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (comparePlacements(a[i], b[i]) !== 0) return false;
  }
  return true;
}

export interface InternedCells {
  /** Distinct contents. Index 0 is always the blank cell. */
  readonly cellContents: readonly CellContent[];
  /** One index per input cell, row-major. */
  readonly indices: readonly number[];
}

/**
 * Build the intern table for a row-major list of cells. Contents are
 * canonicalised on the way in, so callers may pass placements in any order.
 */
export function internCells(cells: readonly (readonly Placement[])[]): InternedCells {
  const blank: CellContent = [];
  const cellContents: CellContent[] = [blank];
  const byKey = new Map<string, number>([[cellKey(blank), BLANK_CELL_INDEX]]);
  const indices: number[] = [];

  for (const raw of cells) {
    const canonical = canonicalizeCell(raw);
    const key = cellKey(canonical);
    const existing = byKey.get(key);
    if (existing !== undefined) {
      indices.push(existing);
    } else {
      const index = cellContents.length;
      cellContents.push(canonical);
      byKey.set(key, index);
      indices.push(index);
    }
  }

  return { cellContents, indices };
}

export interface BuiltCellGrid {
  readonly cellContents: readonly CellContent[];
  readonly cells: CellGrid;
}

/**
 * Intern a row-major list of cells and encode the resulting indices as a grid.
 * This is the normal way to construct the cell layer of a pattern.
 */
export function buildCellGrid(
  width: number,
  height: number,
  cells: readonly (readonly Placement[])[],
): BuiltCellGrid {
  const { cellContents, indices } = internCells(cells);
  return { cellContents, cells: makeGrid(width, height, indices) };
}

/**
 * Resolve the contents of one cell.
 *
 * @throws RangeError if out of bounds or the index is not in the table.
 */
export function cellContentAt(pattern: Pattern, x: number, y: number): CellContent {
  const index = getCell(pattern.cells, x, y);
  const content = pattern.cellContents[index];
  if (content === undefined) {
    throw new RangeError(
      `cell (${x}, ${y}) references content index ${index}, which does not exist`,
    );
  }
  return content;
}

/** Number of placements in the cell content at an index, or 0 if absent. */
export function placementCountAt(cellContents: readonly CellContent[], index: number): number {
  const content = cellContents[index];
  return content === undefined ? 0 : content.length;
}

/** Every corner, for callers building fractional stitches. */
export const ALL_CORNERS = CORNERS;

/** Every slant, for callers building half stitches. */
export const ALL_SLANTS = SLANTS;
