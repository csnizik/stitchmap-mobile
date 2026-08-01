/**
 * Sample pattern used to exercise the persistence path while pattern import is
 * deferred (S2-4). This is shipped seed data, not a test fixture: it is built
 * through the same constructors as real patterns, so it cannot drift from the
 * model, and `npm test` asserts that it validates.
 *
 * An 8x8 chart designed to touch every representable stitch:
 *
 *   - full, half (both slants), quarter, and three-quarter placements
 *   - a cell holding two placements of different threads
 *   - blank cells
 *   - backstitch and straight line stitches
 *   - french knots at both an intersection and a cell centre
 */

import { buildCellGrid } from '../domain/cells';
import { SCHEMA_VERSION } from '../domain/types';
import type {
  LineStitch,
  PaletteEntry,
  Pattern,
  Placement,
  PointStitch,
} from '../domain/types';

const CREATED_AT = '2026-08-01T00:00:00.000Z';

export const SAMPLE_PATTERN_ID = 'sample-sampler';

const PALETTE: PaletteEntry[] = [
  {
    key: 'navy',
    symbol: 'N',
    color: '#1b2a4a',
    brand: 'DMC',
    code: '336',
    label: 'Navy Blue',
  },
  {
    key: 'rose',
    symbol: 'R',
    color: '#c96480',
    brand: 'DMC',
    code: '3733',
    label: 'Dusty Rose',
  },
  {
    key: 'sage',
    symbol: 'S',
    color: '#8a9a7b',
    brand: 'DMC',
    code: '3053',
    label: 'Green Grey',
  },
  {
    key: 'cream',
    symbol: 'C',
    color: '#f2e8d5',
    brand: 'DMC',
    code: '712',
    label: 'Cream',
  },
];

/* Placement shorthands, so the grid below stays readable. */
const navy: Placement = { kind: 'full', thread: 'navy' };
const rose: Placement = { kind: 'full', thread: 'rose' };
const sage: Placement = { kind: 'full', thread: 'sage' };
const cream: Placement = { kind: 'full', thread: 'cream' };

const halfF: Placement = { kind: 'half', slant: 'forward', thread: 'sage' };
const halfB: Placement = { kind: 'half', slant: 'backward', thread: 'sage' };
const qTL: Placement = { kind: 'quarter', corner: 'topLeft', thread: 'rose' };
const qBR: Placement = { kind: 'quarter', corner: 'bottomRight', thread: 'navy' };
const tqTR: Placement = { kind: 'threeQuarter', corner: 'topRight', thread: 'rose' };
const tqBL: Placement = { kind: 'threeQuarter', corner: 'bottomLeft', thread: 'navy' };

const _: Placement[] = [];

export const SAMPLE_WIDTH = 8;
export const SAMPLE_HEIGHT = 8;

/**
 * Row-major cells. Row 4 is the interesting one: a three-quarter and a quarter
 * of different threads sharing a cell, which is why a cell is a list.
 */
const CELLS: Placement[][] = [
  // 0: a solid cream band, so run-length encoding has something to collapse.
  [cream], [cream], [cream], [cream], [cream], [cream], [cream], [cream],
  // 1: blanks around a navy pair.
  _, _, [navy], [navy], [navy], [navy], _, _,
  // 2: half stitches, both slants.
  _, [halfF], [halfF], _, _, [halfB], [halfB], _,
  // 3: quarters.
  _, [qTL], _, [rose], [rose], _, [qBR], _,
  // 4: three-quarters, and a shared cell holding two threads.
  _, [tqTR], _, [tqBL, qTL], _, [tqBL], _, _,
  // 5: a sage row with a gap.
  [sage], [sage], [sage], _, _, [sage], [sage], [sage],
  // 6: scattered singles.
  _, [rose], _, [navy], _, [rose], _, [navy],
  // 7: another solid band.
  [cream], [cream], [cream], [cream], [cream], [cream], [cream], [cream],
];

/**
 * Line stitches. Coordinates are grid intersections, so these run along and
 * across cell edges rather than inside cells.
 */
const LINES: LineStitch[] = [
  // A backstitch box outlining the navy pair in row 1.
  { id: 'line-box-top', kind: 'backstitch', from: { x: 2, y: 1 }, to: { x: 6, y: 1 }, thread: 'navy' },
  { id: 'line-box-right', kind: 'backstitch', from: { x: 6, y: 1 }, to: { x: 6, y: 2 }, thread: 'navy' },
  { id: 'line-box-bottom', kind: 'backstitch', from: { x: 6, y: 2 }, to: { x: 2, y: 2 }, thread: 'navy' },
  { id: 'line-box-left', kind: 'backstitch', from: { x: 2, y: 2 }, to: { x: 2, y: 1 }, thread: 'navy' },
  // A diagonal backstitch, to prove lines are not axis-aligned.
  { id: 'line-diagonal', kind: 'backstitch', from: { x: 1, y: 6 }, to: { x: 3, y: 8 }, thread: 'sage' },
  // A long straight stitch starting at an edge midpoint.
  { id: 'line-straight', kind: 'straight', from: { x: 4.5, y: 5 }, to: { x: 7.5, y: 5 }, thread: 'rose' },
];

/** French knots: one at an intersection, one at a cell centre. */
const POINTS: PointStitch[] = [
  { id: 'point-intersection', kind: 'frenchKnot', at: { x: 4, y: 4 }, thread: 'cream' },
  { id: 'point-centre', kind: 'frenchKnot', at: { x: 6.5, y: 6.5 }, thread: 'cream' },
];

/**
 * Build the sample. A function rather than a frozen constant so callers cannot
 * accidentally share and mutate one instance.
 */
export function createSamplePattern(id: string = SAMPLE_PATTERN_ID): Pattern {
  const built = buildCellGrid(SAMPLE_WIDTH, SAMPLE_HEIGHT, CELLS);
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: 'Stitch Sampler',
    width: SAMPLE_WIDTH,
    height: SAMPLE_HEIGHT,
    palette: PALETTE,
    cellContents: built.cellContents,
    cells: built.cells,
    lines: LINES,
    points: POINTS,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}
