import { filledGrid, gridToCells, makeGrid } from '../../domain/grid';
import {
  CHUNK_BUDGET_BYTES,
  MAX_CHUNKS,
  chunkDocumentId,
  decodePairsToRuns,
  encodeRunsToPairs,
  encodedSize,
  packGrid,
  packItems,
  shouldSpill,
  unpackGrid,
  unpackItems,
} from '../chunking';
import type { GridChunk } from '../chunking';

describe('chunkDocumentId', () => {
  it('zero pads so lexicographic order matches numeric order', () => {
    expect(chunkDocumentId(0)).toBe('0000');
    expect(chunkDocumentId(2)).toBe('0002');
    expect(chunkDocumentId(10)).toBe('0010');
    // The whole point: Firestore sorts document ids as strings.
    expect(chunkDocumentId(2) < chunkDocumentId(10)).toBe(true);
  });

  it('rejects a negative or non integer index', () => {
    expect(() => chunkDocumentId(-1)).toThrow(RangeError);
    expect(() => chunkDocumentId(1.5)).toThrow(RangeError);
  });

  it('rejects an index beyond the id width', () => {
    expect(() => chunkDocumentId(MAX_CHUNKS)).toThrow(RangeError);
  });
});

describe('run pair encoding', () => {
  it('flattens runs to pairs', () => {
    expect(
      encodeRunsToPairs([
        { value: 0, count: 40 },
        { value: 3, count: 2 },
      ]),
    ).toEqual([0, 40, 3, 2]);
  });

  it('round trips', () => {
    const runs = [
      { value: 7, count: 1 },
      { value: 0, count: 99 },
    ];
    expect(decodePairsToRuns(encodeRunsToPairs(runs))).toEqual(runs);
  });

  it('rejects an odd number of values', () => {
    expect(() => decodePairsToRuns([0, 40, 3])).toThrow(RangeError);
  });

  it('rejects a non positive count', () => {
    expect(() => decodePairsToRuns([0, 0])).toThrow(RangeError);
  });
});

describe('packGrid', () => {
  it('puts a small grid in one chunk', () => {
    const chunks = packGrid(filledGrid(10, 10, 0));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ index: 0, startRow: 0, rowCount: 10 });
  });

  it('round trips through unpackGrid', () => {
    const grid = makeGrid(
      4,
      7,
      Array.from({ length: 28 }, (_, i) => i % 3),
    );
    expect(gridToCells(unpackGrid(4, 7, packGrid(grid)))).toEqual(gridToCells(grid));
  });

  it('splits when the budget is exceeded, with contiguous chunks', () => {
    // A tiny budget forces many chunks without needing a huge fixture.
    const grid = makeGrid(
      3,
      9,
      Array.from({ length: 27 }, (_, i) => i % 4),
    );
    const chunks = packGrid(grid, 40);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });

    let expectedStart = 0;
    for (const chunk of chunks) {
      expect(chunk.startRow).toBe(expectedStart);
      expectedStart += chunk.rowCount;
    }
    expect(expectedStart).toBe(grid.height);
  });

  it('round trips after splitting', () => {
    const grid = makeGrid(
      3,
      9,
      Array.from({ length: 27 }, (_, i) => i % 4),
    );
    expect(gridToCells(unpackGrid(3, 9, packGrid(grid, 40)))).toEqual(gridToCells(grid));
  });

  it('always emits at least one row per chunk, even under an impossible budget', () => {
    const grid = filledGrid(50, 5, 1);
    const chunks = packGrid(grid, 1);
    expect(chunks).toHaveLength(5);
    expect(chunks.every((chunk) => chunk.rowCount === 1)).toBe(true);
    expect(gridToCells(unpackGrid(50, 5, chunks))).toEqual(gridToCells(grid));
  });

  it('rejects a non positive budget', () => {
    expect(() => packGrid(filledGrid(2, 2, 0), 0)).toThrow(RangeError);
  });

  it('keeps a realistic 200x200 chart in a single chunk', () => {
    // 20 runs per row, alternating, which is a detailed but ordinary chart.
    const cells: number[] = [];
    for (let y = 0; y < 200; y += 1) {
      for (let x = 0; x < 200; x += 1) {
        cells.push(Math.floor(x / 10) % 2);
      }
    }
    const chunks = packGrid(makeGrid(200, 200, cells));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].data.length).toBeLessThan(CHUNK_BUDGET_BYTES);
  });
});

describe('unpackGrid sequence validation', () => {
  const grid = makeGrid(
    3,
    6,
    Array.from({ length: 18 }, (_, i) => i % 4),
  );
  const chunks = packGrid(grid, 40);

  it('rejects zero chunks', () => {
    expect(() => unpackGrid(3, 6, [])).toThrow(RangeError);
  });

  it('rejects a missing chunk', () => {
    expect(() => unpackGrid(3, 6, chunks.slice(0, chunks.length - 1))).toThrow(RangeError);
  });

  it('rejects chunks out of order', () => {
    const reordered = [chunks[1], chunks[0], ...chunks.slice(2)];
    expect(() => unpackGrid(3, 6, reordered)).toThrow(RangeError);
  });

  it('rejects a chunk whose startRow does not follow', () => {
    const tampered: GridChunk[] = [{ ...chunks[0], startRow: 5 }, ...chunks.slice(1)];
    expect(() => unpackGrid(3, 6, tampered)).toThrow(RangeError);
  });

  it('rejects a chunk whose rowCount disagrees with its data', () => {
    const tampered: GridChunk[] = [{ ...chunks[0], rowCount: 99 }, ...chunks.slice(1)];
    expect(() => unpackGrid(3, 6, tampered)).toThrow(RangeError);
  });

  it('rejects a truncated sequence, which is otherwise in order and contiguous', () => {
    expect(() => unpackGrid(3, 6, chunks.slice(0, chunks.length - 1))).toThrow(RangeError);
  });

  it('rejects malformed JSON', () => {
    const tampered: GridChunk[] = [{ ...chunks[0], data: '{not json' }, ...chunks.slice(1)];
    expect(() => unpackGrid(3, 6, tampered)).toThrow(RangeError);
  });

  it('rejects a row that does not sum to width', () => {
    const tampered: GridChunk[] = [{ index: 0, startRow: 0, rowCount: 1, data: '[[0,99]]' }];
    expect(() => unpackGrid(3, 1, tampered)).toThrow(RangeError);
  });
});

describe('item chunks', () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ id: `stitch-${i}`, n: i }));

  it('reports encoded size', () => {
    expect(encodedSize([1, 2, 3])).toBe('[1,2,3]'.length);
  });

  it('says a small list does not spill', () => {
    expect(shouldSpill(items)).toBe(false);
  });

  it('says an oversized list spills', () => {
    expect(shouldSpill(items, 10)).toBe(true);
  });

  it('round trips in one chunk', () => {
    expect(unpackItems(packItems(items), items.length)).toEqual(items);
  });

  it('round trips when split', () => {
    const chunks = packItems(items, 60);
    expect(chunks.length).toBeGreaterThan(1);
    expect(unpackItems(chunks, items.length)).toEqual(items);
  });

  it('keeps chunk starts contiguous', () => {
    const chunks = packItems(items, 60);
    let expectedStart = 0;
    for (const chunk of chunks) {
      expect(chunk.start).toBe(expectedStart);
      expectedStart += chunk.count;
    }
    expect(expectedStart).toBe(items.length);
  });

  it('handles an empty list as zero chunks', () => {
    expect(packItems([])).toEqual([]);
    expect(unpackItems([], 0)).toEqual([]);
  });

  it('rejects chunks out of order', () => {
    const chunks = packItems(items, 60);
    expect(() => unpackItems([chunks[1], chunks[0], ...chunks.slice(2)], items.length)).toThrow(
      RangeError,
    );
  });

  it('rejects a truncated item sequence', () => {
    const chunks = packItems(items, 60);
    expect(() => unpackItems(chunks.slice(0, chunks.length - 1), items.length)).toThrow(RangeError);
  });

  it('rejects a count that disagrees with the data', () => {
    const chunks = packItems(items, 60);
    expect(() =>
      unpackItems([{ ...chunks[0], count: 99 }, ...chunks.slice(1)], items.length),
    ).toThrow(RangeError);
  });
});
