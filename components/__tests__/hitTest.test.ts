import { cellAtPoint } from '../hitTest';

const GRID = { width: 8, height: 8, cellSize: 20 };

describe('cellAtPoint', () => {
  it('maps the origin to the first cell', () => {
    expect(cellAtPoint(0, 0, GRID)).toEqual({ x: 0, y: 0 });
  });

  it('maps a point inside a cell to that cell', () => {
    expect(cellAtPoint(25, 45, GRID)).toEqual({ x: 1, y: 2 });
  });

  it('treats a cell boundary as belonging to the higher cell', () => {
    expect(cellAtPoint(20, 20, GRID)).toEqual({ x: 1, y: 1 });
  });

  it('maps the last pixel to the last cell', () => {
    expect(cellAtPoint(159, 159, GRID)).toEqual({ x: 7, y: 7 });
  });

  it('returns null just past the last cell', () => {
    // Rather than clamping: marking a stitch the user did not aim at is worse
    // than ignoring the tap.
    expect(cellAtPoint(160, 80, GRID)).toBeNull();
    expect(cellAtPoint(80, 160, GRID)).toBeNull();
  });

  it('returns null for negative coordinates', () => {
    expect(cellAtPoint(-1, 40, GRID)).toBeNull();
    expect(cellAtPoint(40, -1, GRID)).toBeNull();
    // -0.5 floors to -1, but a naive implementation could round toward zero.
    expect(cellAtPoint(-0.5, 40, GRID)).toBeNull();
  });

  it('returns null for a non-positive cell size', () => {
    expect(cellAtPoint(10, 10, { ...GRID, cellSize: 0 })).toBeNull();
  });

  it('scales with cell size', () => {
    expect(cellAtPoint(45, 45, { ...GRID, cellSize: 40 })).toEqual({ x: 1, y: 1 });
  });
  
  it('returns null for non-finite coordinates', () => {
    // React Native Web does not populate locationX/locationY on Pressable.
    expect(cellAtPoint(NaN, 40, GRID)).toBeNull();
    expect(cellAtPoint(40, NaN, GRID)).toBeNull();
    expect(cellAtPoint(Infinity, 40, GRID)).toBeNull();
  });
});
