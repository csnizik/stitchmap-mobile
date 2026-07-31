import {
  collectPatternIssues,
  collectProjectAgainstPatternIssues,
  collectProjectIssues,
  isCellContent,
  isPaletteEntry,
  isPattern,
  isPlacement,
  isPoint,
  isProject,
  projectMatchesPattern,
} from '../guards';
import { buildCellGrid } from '../cells';
import { createEmptyProject, markPlacement } from '../progress';
import { SCHEMA_VERSION } from '../types';
import type { Pattern, Project } from '../types';
import { BLUE_QUARTER, LATER, NOW, RED, makePattern } from '../__fixtures__/pattern';

/** Replace the cell layer so a single invariant can be broken in isolation. */
function withCells(pattern: Pattern, cellContents: unknown): unknown {
  return {
    ...pattern,
    cellContents,
    cells: buildCellGrid(2, 2, [[RED], [RED], [RED], [RED]]).cells,
  };
}

function expectIssue(value: unknown, fragment: string): void {
  const issues = collectPatternIssues(value);
  expect(issues.join(' | ')).toContain(fragment);
}

describe('primitive guards', () => {
  it('validates palette entries', () => {
    expect(
      isPaletteEntry({ key: 'a', symbol: 'A', color: '#ffffff', brand: '', code: '', label: '' }),
    ).toBe(true);
    expect(
      isPaletteEntry({ key: 'a', symbol: 'A', color: 'white', brand: '', code: '', label: '' }),
    ).toBe(false);
  });

  it('validates placements', () => {
    expect(isPlacement(RED)).toBe(true);
    expect(isPlacement({ kind: 'half', slant: 'sideways', thread: 'a' })).toBe(false);
    expect(isPlacement({ kind: 'bead', thread: 'a' })).toBe(false);
  });

  it('validates cell contents', () => {
    expect(isCellContent([])).toBe(true);
    expect(isCellContent([RED, BLUE_QUARTER])).toBe(true);
    expect(isCellContent([BLUE_QUARTER, RED])).toBe(false);
  });

  it('validates points against chart bounds', () => {
    expect(isPoint({ x: 1.5, y: 0 }, 2, 2)).toBe(true);
    expect(isPoint({ x: 0.25, y: 0 }, 2, 2)).toBe(false);
    expect(isPoint({ x: 3, y: 0 }, 2, 2)).toBe(false);
  });
});

describe('a valid pattern', () => {
  it('passes', () => {
    expect(isPattern(makePattern())).toBe(true);
    expect(collectPatternIssues(makePattern())).toEqual([]);
  });
});

describe('pattern invariants', () => {
  const pattern = makePattern();

  it('rejects an unsupported schema version', () => {
    expectIssue({ ...pattern, schemaVersion: 99 }, 'schemaVersion');
  });

  it('rejects non positive dimensions', () => {
    expectIssue({ ...pattern, width: 0 }, 'width must be a positive integer');
  });

  it('rejects a malformed colour', () => {
    expectIssue(
      { ...pattern, palette: [{ ...pattern.palette[0], color: 'red' }, pattern.palette[1]] },
      'color must match',
    );
  });

  it('rejects duplicate palette keys', () => {
    expectIssue(
      { ...pattern, palette: [pattern.palette[0], { ...pattern.palette[1], key: 'red' }] },
      'duplicates an earlier entry',
    );
  });

  it('requires index 0 of the intern table to be blank', () => {
    expectIssue(withCells(pattern, [[RED], []]), 'must be the blank cell');
  });

  it('allows only index 0 to be blank', () => {
    expectIssue(withCells(pattern, [[], [], [RED]]), 'only index 0 may be blank');
  });

  it('rejects duplicate interned contents', () => {
    expectIssue(withCells(pattern, [[], [RED], [RED]]), 'duplicates pattern.cellContents');
  });

  it('rejects a content index outside the table', () => {
    expectIssue(
      {
        ...pattern,
        cells: { width: 2, height: 2, rows: [[{ value: 99, count: 2 }], [{ value: 0, count: 2 }]] },
      },
      'outside the',
    );
  });

  it('rejects a row that does not sum to width', () => {
    expectIssue(
      {
        ...pattern,
        cells: { width: 2, height: 2, rows: [[{ value: 0, count: 3 }], [{ value: 0, count: 2 }]] },
      },
      'expands to 3 cells',
    );
  });

  it('rejects uncoalesced runs', () => {
    expectIssue(
      {
        ...pattern,
        cells: {
          width: 2,
          height: 2,
          rows: [
            [
              { value: 0, count: 1 },
              { value: 0, count: 1 },
            ],
            [{ value: 0, count: 2 }],
          ],
        },
      },
      'must be coalesced',
    );
  });

  it('rejects an unknown placement kind rather than dropping it', () => {
    expectIssue(withCells(pattern, [[], [{ kind: 'bead', thread: 'red' }]]), 'unsupported');
  });

  it('rejects a thread that is not in the palette', () => {
    expectIssue(
      withCells(pattern, [[], [{ kind: 'full', thread: 'green' }]]),
      'not in the palette',
    );
  });

  it('rejects placements out of canonical order', () => {
    expectIssue(withCells(pattern, [[], [BLUE_QUARTER, RED]]), 'out of canonical order');
  });

  it('rejects a duplicated placement within a cell', () => {
    expectIssue(withCells(pattern, [[], [RED, RED]]), 'duplicates the previous placement');
  });

  it('rejects a coordinate off the half step grid', () => {
    expectIssue(
      {
        ...pattern,
        points: [{ id: 'p', kind: 'frenchKnot', at: { x: 0.25, y: 1 }, thread: 'blue' }],
      },
      'multiple of',
    );
  });

  it('rejects a coordinate outside the chart', () => {
    expectIssue(
      { ...pattern, points: [{ id: 'p', kind: 'frenchKnot', at: { x: 9, y: 1 }, thread: 'blue' }] },
      'within [0, 2]',
    );
  });

  it('allows a coordinate on the far edge, since those are intersections', () => {
    expect(
      collectPatternIssues({
        ...pattern,
        points: [{ id: 'p', kind: 'frenchKnot', at: { x: 2, y: 2 }, thread: 'blue' }],
      }),
    ).toEqual([]);
  });

  it('rejects a zero length line', () => {
    expectIssue(
      {
        ...pattern,
        lines: [
          { id: 'l', kind: 'backstitch', from: { x: 1, y: 1 }, to: { x: 1, y: 1 }, thread: 'red' },
        ],
      },
      'zero length',
    );
  });

  it('rejects a stitch id reused across layers', () => {
    expectIssue(
      {
        ...pattern,
        points: [{ id: 'line-1', kind: 'frenchKnot', at: { x: 1, y: 1 }, thread: 'blue' }],
      },
      'duplicates another stitch id',
    );
  });

  it('rejects an unknown line kind', () => {
    expectIssue(
      {
        ...pattern,
        lines: [
          { id: 'l', kind: 'chainstitch', from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, thread: 'red' },
        ],
      },
      'unsupported',
    );
  });
});

describe('forward compatibility', () => {
  it('tolerates unknown properties, so optional fields stay additive', () => {
    const pattern = makePattern();
    const withExtra = withCells(pattern, [[], [{ kind: 'full', thread: 'red', strands: 2 }]]);
    expect(collectPatternIssues(withExtra)).toEqual([]);
  });
});

describe('project invariants', () => {
  const pattern = makePattern();
  const project = createEmptyProject({ id: 'project-1', pattern, now: NOW });

  it('accepts a valid project', () => {
    expect(isProject(project)).toBe(true);
  });

  it('rejects a negative mask', () => {
    const broken = {
      ...project,
      cellProgress: {
        width: 2,
        height: 2,
        rows: [[{ value: -1, count: 2 }], [{ value: 0, count: 2 }]],
      },
    };
    expect(collectProjectIssues(broken).length).toBeGreaterThan(0);
  });

  it('rejects a mask larger than 32 bits', () => {
    const broken = {
      ...project,
      cellProgress: {
        width: 2,
        height: 2,
        rows: [[{ value: 0x1ffffffff, count: 2 }], [{ value: 0, count: 2 }]],
      },
    };
    expect(collectProjectIssues(broken).length).toBeGreaterThan(0);
  });
});

describe('project against pattern', () => {
  const pattern = makePattern();
  const project = createEmptyProject({ id: 'project-1', pattern, now: NOW });

  it('accepts a matching pair', () => {
    expect(projectMatchesPattern(pattern, project)).toBe(true);
  });

  it('survives marking', () => {
    const marked = markPlacement(pattern, project, 1, 0, 1, true, LATER);
    expect(projectMatchesPattern(pattern, marked)).toBe(true);
  });

  it('catches a pattern id mismatch', () => {
    const wrong: Project = { ...project, patternId: 'other' };
    expect(collectProjectAgainstPatternIssues(pattern, wrong).join(' ')).toContain('patternId');
  });

  it('catches a dimension mismatch', () => {
    const wrong: Project = { ...project, width: 3 };
    expect(collectProjectAgainstPatternIssues(pattern, wrong).join(' ')).toContain(
      'but the pattern is',
    );
  });

  it('catches progress marking a stitch that does not exist', () => {
    const wrong: Project = {
      ...project,
      cellProgress: {
        width: 2,
        height: 2,
        rows: [
          [
            { value: 0b111, count: 1 },
            { value: 0, count: 1 },
          ],
          [{ value: 0, count: 2 }],
        ],
      },
    };
    expect(collectProjectAgainstPatternIssues(pattern, wrong).join(' ')).toContain(
      'does not exist',
    );
  });

  it('catches a line progress length mismatch', () => {
    const wrong: Project = { ...project, lineProgress: [] };
    expect(collectProjectAgainstPatternIssues(pattern, wrong).join(' ')).toContain(
      'lineProgress covers 0',
    );
  });

  it('catches a point progress length mismatch', () => {
    const wrong: Project = { ...project, pointProgress: [{ value: false, count: 5 }] };
    expect(collectProjectAgainstPatternIssues(pattern, wrong).join(' ')).toContain(
      'pointProgress covers 5',
    );
  });
});

describe('schema version', () => {
  it('is exported so storage layers can branch on it', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
