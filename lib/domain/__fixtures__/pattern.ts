/**
 * Shared fixture for domain tests.
 *
 * Lives in `__fixtures__` rather than `__tests__` so jest's test glob does not
 * pick it up as an empty suite.
 */

import { buildCellGrid } from '../cells';
import { SCHEMA_VERSION } from '../types';
import type { PaletteEntry, Pattern, Placement } from '../types';

export const RED: Placement = { kind: 'full', thread: 'red' };
export const BLUE_QUARTER: Placement = {
  kind: 'quarter',
  corner: 'topLeft',
  thread: 'blue',
};

export const PALETTE: PaletteEntry[] = [
  { key: 'red', symbol: 'R', color: '#ff0000', brand: 'DMC', code: '666', label: 'Red' },
  { key: 'blue', symbol: 'B', color: '#0000ff', brand: 'DMC', code: '820', label: 'Blue' },
];

export const NOW = '2026-07-31T00:00:00.000Z';
export const LATER = '2026-07-31T01:00:00.000Z';

/**
 * A 2x2 chart:
 *   (0,0) one full stitch      (1,0) a full plus a quarter
 *   (0,1) blank                (1,1) one quarter
 * plus one backstitch and one french knot.
 */
export function makePattern(): Pattern {
  const built = buildCellGrid(2, 2, [[RED], [RED, BLUE_QUARTER], [], [BLUE_QUARTER]]);
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'pattern-1',
    name: 'Fixture',
    width: 2,
    height: 2,
    palette: PALETTE,
    cellContents: built.cellContents,
    cells: built.cells,
    lines: [
      {
        id: 'line-1',
        kind: 'backstitch',
        from: { x: 0, y: 0 },
        to: { x: 2, y: 0 },
        thread: 'red',
      },
    ],
    points: [{ id: 'point-1', kind: 'frenchKnot', at: { x: 1, y: 1 }, thread: 'blue' }],
    createdAt: NOW,
    updatedAt: NOW,
  };
}
