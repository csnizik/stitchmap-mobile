/**
 * Mapping canvas coordinates to grid cells.
 *
 * Pure and separate from the renderer so it can be tested without Skia, and so
 * pan and zoom (#43) can compose a transform in front of it without touching
 * the hit-test itself.
 */

import type { Pattern } from '../lib/domain/types';

export interface CellHit {
  readonly x: number;
  readonly y: number;
}

export interface HitTestOptions {
  readonly width: number;
  readonly height: number;
  readonly cellSize: number;
}

/**
 * Which cell contains a point, or null when the point falls outside the grid.
 *
 * Coordinates are relative to the canvas origin. Taps beyond the last cell
 * return null rather than clamping: clamping would mark a stitch the user did
 * not aim at, which is worse than ignoring the tap.
 */
export function cellAtPoint(
  pointX: number,
  pointY: number,
  { width, height, cellSize }: HitTestOptions,
): CellHit | null {
  if (cellSize <= 0) {
    return null;
  }
  // NaN comparisons are always false, so an unguarded NaN would slip past the
  // bounds checks below and produce a {NaN, NaN} hit. React Native Web does
  // not populate locationX/locationY, which is exactly how that arises.
  if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) {
    return null;
  }

  const x = Math.floor(pointX / cellSize);
  const y = Math.floor(pointY / cellSize);

  if (x < 0 || y < 0 || x >= width || y >= height) {
    return null;
  }
  // Guards against a negative coordinate rounding toward zero into cell 0.
  if (pointX < 0 || pointY < 0) {
    return null;
  }

  return { x, y };
}

/** Convenience wrapper taking the pattern's dimensions. */
export function cellAtPointInPattern(
  pointX: number,
  pointY: number,
  pattern: Pattern,
  cellSize: number,
): CellHit | null {
  return cellAtPoint(pointX, pointY, {
    width: pattern.width,
    height: pattern.height,
    cellSize,
  });
}
