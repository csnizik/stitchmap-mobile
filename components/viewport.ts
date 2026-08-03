/**
 * Viewport transform for the pattern canvas.
 *
 * The canvas is the size of the visible area, not the pattern. Panning and
 * zooming move a transform applied inside Skia rather than resizing or moving
 * the surface. That keeps the surface screen-sized no matter how large the
 * chart is, and it means the visible region is always computable, which is what
 * viewport culling in #44 depends on.
 *
 * Everything here is pure so it can run on the UI thread through a worklet and
 * be tested without a renderer.
 */

import type { Pattern } from '../lib/domain/types';

export interface Viewport {
  /** Pixels per pattern unit. 1 means one cell is `baseCellSize` pixels. */
  readonly scale: number;
  /** Canvas-space offset of the pattern origin, in pixels. */
  readonly translateX: number;
  readonly translateY: number;
}

export interface ViewportBounds {
  /** Visible area in pixels. */
  readonly viewWidth: number;
  readonly viewHeight: number;
  /** Full pattern size in pixels at scale 1. */
  readonly contentWidth: number;
  readonly contentHeight: number;
}

/**
 * Far enough in to tap a single cell comfortably. Against a base cell size of
 * roughly 20px this puts a cell near 160px, which is a large touch target.
 */
export const MAX_SCALE = 8;

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * The scale at which the entire pattern fits the viewport. This is the zoom-out
 * limit: zooming further out only adds empty space.
 */
export function fitScale({
  viewWidth,
  viewHeight,
  contentWidth,
  contentHeight,
}: ViewportBounds): number {
  'worklet';
  if (contentWidth <= 0 || contentHeight <= 0) {
    return 1;
  }
  return Math.min(viewWidth / contentWidth, viewHeight / contentHeight);
}

/**
 * The zoom-out limit.
 *
 * For a chart larger than the viewport this is the fit scale, since zooming
 * further out only adds empty space. For a chart smaller than the viewport the
 * fit scale exceeds 1, and using it would force a minimum zoom *in*, so the
 * limit is capped at 1.
 */
export function minScale(bounds: ViewportBounds): number {
  'worklet';
  return Math.min(fitScale(bounds), 1);
}

/**
 * Constrain translation so the chart cannot be lost off screen.
 *
 * When the scaled content is larger than the viewport, its edges are not
 * allowed inside the viewport, so there is never a gap at an edge while
 * content remains beyond the opposite one. When it is smaller, it is centred
 * instead: letting a small chart wander around a large empty viewport feels
 * broken rather than free.
 */
export function clampTranslation(viewport: Viewport, bounds: ViewportBounds): Viewport {
  'worklet';
  const scaledWidth = bounds.contentWidth * viewport.scale;
  const scaledHeight = bounds.contentHeight * viewport.scale;

  let translateX: number;
  if (scaledWidth <= bounds.viewWidth) {
    translateX = (bounds.viewWidth - scaledWidth) / 2;
  } else {
    translateX = clamp(viewport.translateX, bounds.viewWidth - scaledWidth, 0);
  }

  let translateY: number;
  if (scaledHeight <= bounds.viewHeight) {
    translateY = (bounds.viewHeight - scaledHeight) / 2;
  } else {
    translateY = clamp(viewport.translateY, bounds.viewHeight - scaledHeight, 0);
  }

  return { scale: viewport.scale, translateX, translateY };
}

/** Apply both limits at once. */
export function clampViewport(viewport: Viewport, bounds: ViewportBounds): Viewport {
  'worklet';
  const scale = clamp(viewport.scale, minScale(bounds), MAX_SCALE);
  return clampTranslation({ ...viewport, scale }, bounds);
}

/**
 * Zoom about a fixed point, so the content under the user's fingers stays put.
 *
 * Without this a pinch drifts: the content slides away from the gesture, which
 * reads as the app fighting the user.
 */
export function zoomAround(
  viewport: Viewport,
  focalX: number,
  focalY: number,
  nextScale: number,
  bounds: ViewportBounds,
): Viewport {
  'worklet';
  const scale = clamp(nextScale, minScale(bounds), MAX_SCALE);
  const ratio = scale / viewport.scale;

  // Keep the pattern point under the focal point stationary: the focal point's
  // offset from the origin scales by the same ratio as the content.
  return clampTranslation(
    {
      scale,
      translateX: focalX - (focalX - viewport.translateX) * ratio,
      translateY: focalY - (focalY - viewport.translateY) * ratio,
    },
    bounds,
  );
}

/**
 * Invert the transform: canvas pixels to pattern pixels.
 *
 * This is what makes tapping work while zoomed. The tap arrives in canvas
 * space; the hit test needs pattern space.
 */
export function canvasToPattern(
  canvasX: number,
  canvasY: number,
  viewport: Viewport,
): { readonly x: number; readonly y: number } {
  'worklet';
  return {
    x: (canvasX - viewport.translateX) / viewport.scale,
    y: (canvasY - viewport.translateY) / viewport.scale,
  };
}

/** Content size in pixels at scale 1. */
export function contentSize(
  pattern: Pattern,
  baseCellSize: number,
): { readonly contentWidth: number; readonly contentHeight: number } {
  'worklet';
  return {
    contentWidth: pattern.width * baseCellSize,
    contentHeight: pattern.height * baseCellSize,
  };
}

/**
 * The pattern-space rectangle currently visible, in cell units.
 *
 * Unused by this story: it exists because viewport culling in #44 is the whole
 * reason the transform lives inside Skia rather than on a wrapping view, and
 * having it here proves that decision actually pays off.
 */
export function visibleCellRange(
  viewport: Viewport,
  bounds: ViewportBounds,
  baseCellSize: number,
  pattern: Pattern,
): {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
} {
  'worklet';
  const topLeft = canvasToPattern(0, 0, viewport);
  const bottomRight = canvasToPattern(bounds.viewWidth, bounds.viewHeight, viewport);

  return {
    startX: Math.max(0, Math.floor(topLeft.x / baseCellSize)),
    startY: Math.max(0, Math.floor(topLeft.y / baseCellSize)),
    endX: Math.min(pattern.width, Math.ceil(bottomRight.x / baseCellSize)),
    endY: Math.min(pattern.height, Math.ceil(bottomRight.y / baseCellSize)),
  };
}
