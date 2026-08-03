import { collectPatternIssues } from '../../domain/guards';
import { countPlacements } from '../../domain/progress';
import { PERFORMANCE_SIZES, generatePattern } from '../generatePattern';

describe('generatePattern', () => {
  it('produces a valid pattern', () => {
    // The generator builds through the same constructors as real patterns, so
    // a generated chart must satisfy every domain invariant. If it does not,
    // any performance figure measured against it is meaningless.
    expect(collectPatternIssues(generatePattern({ width: 40, height: 40 }))).toEqual([]);
  });

  it('honours the requested dimensions', () => {
    const pattern = generatePattern({ width: 30, height: 20 });
    expect(pattern.width).toBe(30);
    expect(pattern.height).toBe(20);
    expect(pattern.cells.rows).toHaveLength(20);
  });

  it('is deterministic for a given seed', () => {
    // A frame-rate figure from a different chart each run is not a measurement.
    const a = generatePattern({ width: 24, height: 24, seed: 7 });
    const b = generatePattern({ width: 24, height: 24, seed: 7 });
    expect(a).toEqual(b);
  });

  it('produces different charts for different seeds', () => {
    const a = generatePattern({ width: 24, height: 24, seed: 1 });
    const b = generatePattern({ width: 24, height: 24, seed: 2 });
    expect(a.cells).not.toEqual(b.cells);
  });

  it('includes blank cells', () => {
    const pattern = generatePattern({ width: 40, height: 40, blankRatio: 0.5 });
    expect(pattern.cellContents[0]).toEqual([]);
    expect(countPlacements(pattern)).toBeLessThan(40 * 40);
  });

  it('includes every placement kind at a realistic size', () => {
    const pattern = generatePattern({ width: 60, height: 60, fractionalRatio: 0.3 });
    const kinds = new Set(pattern.cellContents.flat().map((placement) => placement.kind));
    expect(kinds.has('full')).toBe(true);
    expect(kinds.has('half')).toBe(true);
    expect(kinds.has('quarter')).toBe(true);
    expect(kinds.has('threeQuarter')).toBe(true);
  });

  it('includes cells holding more than one placement', () => {
    const pattern = generatePattern({ width: 60, height: 60, fractionalRatio: 0.3 });
    expect(pattern.cellContents.some((content) => content.length > 1)).toBe(true);
  });

  it('generates line and point stitches when asked', () => {
    const pattern = generatePattern({
      width: 40,
      height: 40,
      lineCount: 25,
      pointCount: 10,
    });
    expect(pattern.lines).toHaveLength(25);
    expect(pattern.points).toHaveLength(10);
    expect(collectPatternIssues(pattern)).toEqual([]);
  });

  it('generates none by default', () => {
    const pattern = generatePattern({ width: 20, height: 20 });
    expect(pattern.lines).toEqual([]);
    expect(pattern.points).toEqual([]);
  });

  it('keeps run-length encoding effective', () => {
    // Pure per-cell noise would defeat RLE entirely and measure a case that
    // does not occur in real charts. Regions keep runs meaningfully long.
    const width = 100;
    const pattern = generatePattern({ width, height: 100, blankRatio: 0.3 });
    const runsPerRow =
      pattern.cells.rows.reduce((total, row) => total + row.length, 0) / pattern.height;
    expect(runsPerRow).toBeLessThan(width);
  });

  it('rejects invalid dimensions', () => {
    expect(() => generatePattern({ width: 0, height: 10 })).toThrow(RangeError);
    expect(() => generatePattern({ width: 10, height: -1 })).toThrow(RangeError);
    expect(() => generatePattern({ width: 10.5, height: 10 })).toThrow(RangeError);
  });

  it('builds the sizes the performance criteria are stated against', () => {
    // Guards against the constants drifting out of sync with the story.
    const typical = generatePattern({ ...PERFORMANCE_SIZES.typical });
    expect(typical.width).toBe(100);
    expect(typical.height).toBe(100);
    expect(collectPatternIssues(typical)).toEqual([]);
  });
});
