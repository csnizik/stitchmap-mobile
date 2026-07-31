import {
  chunkRows,
  countCells,
  decodeRow,
  encodeRow,
  filledGrid,
  getCell,
  getRow,
  gridFromRows,
  gridToCells,
  joinChunks,
  makeGrid,
  mapGrid,
  reduceRuns,
  rowLength,
  setCell,
  sliceRows,
} from '../grid';

describe('run length encoding', () => {
  it('collapses adjacent equal values', () => {
    expect(encodeRow(['a', 'a', 'b', 'b', 'b', 'c'])).toEqual([
      { value: 'a', count: 2 },
      { value: 'b', count: 3 },
      { value: 'c', count: 1 },
    ]);
  });

  it('round trips', () => {
    const values = [1, 1, 2, 3, 3, 3];
    expect(decodeRow(encodeRow(values))).toEqual(values);
  });

  it('encodes an empty row as no runs', () => {
    expect(encodeRow([])).toEqual([]);
  });

  it('honours a custom equality', () => {
    const runs = encodeRow(
      ['A', 'a', 'b'],
      (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
    );
    expect(runs).toHaveLength(2);
  });

  it('reports expanded length', () => {
    expect(
      rowLength([
        { value: 0, count: 4 },
        { value: 1, count: 2 },
      ]),
    ).toBe(6);
  });
});

describe('makeGrid', () => {
  it('keeps runs inside rows', () => {
    // A single value everywhere still produces one run per row, never one
    // run spanning the whole grid. This is the chunking invariant.
    const grid = makeGrid(3, 2, [7, 7, 7, 7, 7, 7]);
    expect(grid.rows).toHaveLength(2);
    expect(grid.rows[0]).toEqual([{ value: 7, count: 3 }]);
    expect(grid.rows[1]).toEqual([{ value: 7, count: 3 }]);
  });

  it('rejects a cell count that does not match the dimensions', () => {
    expect(() => makeGrid(2, 2, [1, 2, 3])).toThrow(RangeError);
  });

  it('rejects non positive dimensions', () => {
    expect(() => makeGrid(0, 2, [])).toThrow(RangeError);
    expect(() => makeGrid(2, 2.5, [])).toThrow(RangeError);
  });

  it('round trips through gridToCells', () => {
    const cells = [1, 1, 2, 3, 3, 3];
    expect(gridToCells(makeGrid(3, 2, cells))).toEqual(cells);
  });
});

describe('gridFromRows', () => {
  it('accepts rows that sum to width', () => {
    const grid = gridFromRows(2, [[{ value: 0, count: 2 }], [{ value: 1, count: 2 }]]);
    expect(grid.height).toBe(2);
  });

  it('rejects a row that does not sum to width', () => {
    expect(() => gridFromRows(2, [[{ value: 0, count: 3 }]])).toThrow(RangeError);
  });

  it('rejects a non positive run count', () => {
    expect(() => gridFromRows(2, [[{ value: 0, count: 0 }]])).toThrow(RangeError);
  });
});

describe('cell access', () => {
  const grid = makeGrid(3, 2, [1, 1, 1, 2, 2, 3]);

  it('reads cells', () => {
    expect(getCell(grid, 0, 0)).toBe(1);
    expect(getCell(grid, 1, 1)).toBe(2);
    expect(getCell(grid, 2, 1)).toBe(3);
  });

  it('rejects out of bounds reads', () => {
    expect(() => getCell(grid, 3, 0)).toThrow(RangeError);
    expect(() => getCell(grid, 0, 2)).toThrow(RangeError);
    expect(() => getCell(grid, 0.5, 0)).toThrow(RangeError);
  });

  it('expands a single row', () => {
    expect(getRow(grid, 1)).toEqual([2, 2, 3]);
  });
});

describe('setCell', () => {
  it('splits a run', () => {
    const grid = makeGrid(3, 1, [1, 1, 1]);
    expect(setCell(grid, 1, 0, 9).rows[0]).toHaveLength(3);
  });

  it('recoalesces when a value is restored', () => {
    const grid = makeGrid(3, 1, [1, 2, 1]);
    expect(setCell(grid, 1, 0, 1).rows[0]).toEqual([{ value: 1, count: 3 }]);
  });

  it('returns the same reference when nothing changes', () => {
    const grid = makeGrid(2, 1, [1, 1]);
    expect(setCell(grid, 0, 0, 1)).toBe(grid);
  });

  it('does not mutate the original', () => {
    const grid = makeGrid(2, 1, [1, 1]);
    setCell(grid, 0, 0, 5);
    expect(getCell(grid, 0, 0)).toBe(1);
  });
});

describe('aggregation', () => {
  const grid = makeGrid(3, 2, [0, 0, 1, 1, 1, 0]);

  it('counts cells matching a predicate', () => {
    expect(countCells(grid, (v) => v === 1)).toBe(3);
  });

  it('reduces over runs weighted by count', () => {
    expect(reduceRuns(grid, (sum, value, count) => sum + value * count, 0)).toBe(3);
  });

  it('maps and recoalesces', () => {
    const mapped = mapGrid(grid, () => 'x');
    expect(mapped.rows[0]).toEqual([{ value: 'x', count: 3 }]);
  });
});

describe('chunking', () => {
  const grid = makeGrid(
    4,
    7,
    Array.from({ length: 28 }, (_, i) => i % 3),
  );

  it('slices a self contained grid', () => {
    const slice = sliceRows(grid, 2, 5);
    expect(slice.height).toBe(3);
    expect(slice.width).toBe(4);
    expect(gridToCells(slice)).toEqual(gridToCells(grid).slice(8, 20));
  });

  it('rejects an invalid range', () => {
    expect(() => sliceRows(grid, 3, 3)).toThrow(RangeError);
    expect(() => sliceRows(grid, 0, 99)).toThrow(RangeError);
  });

  it('splits into chunks with a short final chunk', () => {
    const chunks = chunkRows(grid, 3);
    expect(chunks.map((c) => c.height)).toEqual([3, 3, 1]);
  });

  it('round trips through join, which is what S2-3 depends on', () => {
    expect(gridToCells(joinChunks(chunkRows(grid, 3)))).toEqual(gridToCells(grid));
  });

  it('rejects joining chunks of differing widths', () => {
    expect(() => joinChunks([filledGrid(2, 1, 0), filledGrid(3, 1, 0)])).toThrow(RangeError);
  });

  it('rejects joining nothing', () => {
    expect(() => joinChunks([])).toThrow(RangeError);
  });
});

describe('filledGrid', () => {
  it('produces one run per row', () => {
    const grid = filledGrid(100, 3, 0);
    expect(grid.rows.every((row) => row.length === 1)).toBe(true);
  });
});
