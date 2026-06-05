import {
  countCells,
  getCell,
  gridCellCount,
  gridToCells,
  makeGrid,
  runLengthDecode,
  runLengthEncode,
} from '../grid';
import type { StitchCell } from '../types';

describe('runLengthEncode / runLengthDecode', () => {
  it('coalesces adjacent equal cells and round-trips', () => {
    const cells: StitchCell[] = ['a', 'a', 'a', null, null, 'b'];
    const runs = runLengthEncode(cells);
    expect(runs).toEqual([
      { value: 'a', count: 3 },
      { value: null, count: 2 },
      { value: 'b', count: 1 },
    ]);
    expect(runLengthDecode(runs)).toEqual(cells);
  });

  it('encodes an empty array as no runs', () => {
    expect(runLengthEncode([])).toEqual([]);
    expect(runLengthDecode([])).toEqual([]);
  });

  it('honours a custom equality function', () => {
    const runs = runLengthEncode(['A', 'a', 'b'], (x, y) => x.toLowerCase() === y.toLowerCase());
    expect(runs).toEqual([
      { value: 'A', count: 2 },
      { value: 'b', count: 1 },
    ]);
  });
});

describe('makeGrid', () => {
  it('builds an RLE grid whose runs may span rows', () => {
    const cells: StitchCell[] = ['x', 'x', 'x', 'x'];
    const grid = makeGrid(2, 2, cells);
    expect(grid).toEqual({ width: 2, height: 2, runs: [{ value: 'x', count: 4 }] });
    expect(gridToCells(grid)).toEqual(cells);
    expect(gridCellCount(grid)).toBe(4);
  });

  it('throws when the cell count does not match the dimensions', () => {
    expect(() => makeGrid(2, 2, ['x'])).toThrow(RangeError);
  });

  it('throws on negative or non-integer dimensions', () => {
    expect(() => makeGrid(-1, 2, [])).toThrow(RangeError);
    expect(() => makeGrid(1.5, 2, [])).toThrow(RangeError);
  });
});

describe('getCell', () => {
  // 3×2 grid:
  //   a a b
  //   b b a
  const grid = makeGrid<StitchCell>(3, 2, ['a', 'a', 'b', 'b', 'b', 'a']);

  it('reads cells by (x, y) across run boundaries', () => {
    expect(getCell(grid, 0, 0)).toBe('a');
    expect(getCell(grid, 2, 0)).toBe('b');
    expect(getCell(grid, 0, 1)).toBe('b');
    expect(getCell(grid, 2, 1)).toBe('a');
  });

  it('throws for out-of-bounds coordinates', () => {
    expect(() => getCell(grid, 3, 0)).toThrow(RangeError);
    expect(() => getCell(grid, 0, 2)).toThrow(RangeError);
    expect(() => getCell(grid, -1, 0)).toThrow(RangeError);
  });
});

describe('countCells', () => {
  it('counts matching cells without expanding the grid', () => {
    const grid = makeGrid<StitchCell>(3, 2, ['a', 'a', 'b', null, 'b', 'a']);
    expect(countCells(grid, (v) => v !== null)).toBe(5);
    expect(countCells(grid, (v) => v === 'a')).toBe(3);
    expect(countCells(grid, (v) => v === null)).toBe(1);
  });
});
