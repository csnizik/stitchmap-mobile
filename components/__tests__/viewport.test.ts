import {
  MAX_SCALE,
  canvasToPattern,
  clamp,
  clampTranslation,
  clampViewport,
  fitScale,
  minScale,
  visibleCellRange,
  zoomAround,
} from '../viewport';
import type { Viewport, ViewportBounds } from '../viewport';

/** A large chart: 250x250 cells at 20px, viewed through a phone-sized window. */
const LARGE: ViewportBounds = {
  viewWidth: 400,
  viewHeight: 800,
  contentWidth: 5000,
  contentHeight: 5000,
};

/** A small chart that fits the viewport with room to spare. */
const SMALL: ViewportBounds = {
  viewWidth: 400,
  viewHeight: 800,
  contentWidth: 160,
  contentHeight: 160,
};

const IDENTITY: Viewport = { scale: 1, translateX: 0, translateY: 0 };

describe('clamp', () => {
  it('constrains to the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('fitScale', () => {
  it('finds the scale where the whole chart is visible', () => {
    // Width is the binding constraint: 400/5000.
    expect(fitScale(LARGE)).toBeCloseTo(0.08);
  });

  it('exceeds 1 when the content is smaller than the viewport', () => {
    expect(fitScale(SMALL)).toBeGreaterThan(1);
  });

  it('does not divide by zero on empty content', () => {
    expect(fitScale({ ...LARGE, contentWidth: 0, contentHeight: 0 })).toBe(1);
  });
});

describe('minScale', () => {
  it('lets a large chart zoom out until it fits', () => {
    expect(minScale(LARGE)).toBeCloseTo(0.08);
  });

  it('never forces a small chart to zoom in', () => {
    // fitScale is above 1 here; using it as the minimum would prevent viewing
    // the chart at its natural size.
    expect(minScale(SMALL)).toBe(1);
  });
});

describe('clampViewport', () => {
  it('rejects zooming past the maximum', () => {
    expect(clampViewport({ ...IDENTITY, scale: 999 }, LARGE).scale).toBe(MAX_SCALE);
  });

  it('rejects zooming out past the fit scale', () => {
    expect(clampViewport({ ...IDENTITY, scale: 0.001 }, LARGE).scale).toBeCloseTo(0.08);
  });

  it('leaves a scale within range alone', () => {
    expect(clampViewport({ ...IDENTITY, scale: 2 }, LARGE).scale).toBe(2);
  });
});

describe('clampTranslation', () => {
  it('keeps the left and top edges from drifting inward', () => {
    // A positive translate would leave a gap on the left while content
    // remains off-screen to the right.
    const result = clampTranslation({ scale: 1, translateX: 50, translateY: 50 }, LARGE);
    expect(result.translateX).toBe(0);
    expect(result.translateY).toBe(0);
  });

  it('keeps the right and bottom edges from drifting inward', () => {
    const result = clampTranslation({ scale: 1, translateX: -99999, translateY: -99999 }, LARGE);
    expect(result.translateX).toBe(LARGE.viewWidth - LARGE.contentWidth);
    expect(result.translateY).toBe(LARGE.viewHeight - LARGE.contentHeight);
  });

  it('allows panning freely in between', () => {
    const result = clampTranslation({ scale: 1, translateX: -1000, translateY: -1000 }, LARGE);
    expect(result.translateX).toBe(-1000);
    expect(result.translateY).toBe(-1000);
  });

  it('centres content smaller than the viewport instead of letting it wander', () => {
    const result = clampTranslation({ scale: 1, translateX: 0, translateY: 0 }, SMALL);
    expect(result.translateX).toBe((SMALL.viewWidth - SMALL.contentWidth) / 2);
    expect(result.translateY).toBe((SMALL.viewHeight - SMALL.contentHeight) / 2);
  });

  it('centres regardless of the attempted translation', () => {
    const wandered = clampTranslation({ scale: 1, translateX: -500, translateY: 300 }, SMALL);
    const centred = clampTranslation(IDENTITY, SMALL);
    expect(wandered).toEqual(centred);
  });

  it('accounts for scale when deciding whether content overflows', () => {
    // At scale 4 the small chart (160px) becomes 640px, wider than the 400px
    // viewport, so it should pan rather than centre.
    const result = clampTranslation({ scale: 4, translateX: -100, translateY: 0 }, SMALL);
    expect(result.translateX).toBe(-100);
  });
});

describe('zoomAround', () => {
  it('keeps the point under the focus stationary', () => {
    const before: Viewport = { scale: 1, translateX: -200, translateY: -300 };
    const focalX = 150;
    const focalY = 400;

    const patternPointBefore = canvasToPattern(focalX, focalY, before);
    const after = zoomAround(before, focalX, focalY, 2, LARGE);
    const patternPointAfter = canvasToPattern(focalX, focalY, after);

    expect(patternPointAfter.x).toBeCloseTo(patternPointBefore.x, 5);
    expect(patternPointAfter.y).toBeCloseTo(patternPointBefore.y, 5);
  });

  it('holds the focus when zooming out as well', () => {
    const before: Viewport = { scale: 4, translateX: -2000, translateY: -2000 };
    const patternPointBefore = canvasToPattern(200, 400, before);
    const after = zoomAround(before, 200, 400, 2, LARGE);
    const patternPointAfter = canvasToPattern(200, 400, after);

    expect(patternPointAfter.x).toBeCloseTo(patternPointBefore.x, 5);
    expect(patternPointAfter.y).toBeCloseTo(patternPointBefore.y, 5);
  });

  it('still respects the scale limits', () => {
    expect(zoomAround(IDENTITY, 200, 400, 999, LARGE).scale).toBe(MAX_SCALE);
  });
});

describe('canvasToPattern', () => {
  it('inverts the identity transform', () => {
    expect(canvasToPattern(100, 200, IDENTITY)).toEqual({ x: 100, y: 200 });
  });

  it('inverts translation', () => {
    expect(canvasToPattern(100, 200, { scale: 1, translateX: -50, translateY: -25 })).toEqual({
      x: 150,
      y: 225,
    });
  });

  it('inverts scale', () => {
    expect(canvasToPattern(100, 200, { scale: 2, translateX: 0, translateY: 0 })).toEqual({
      x: 50,
      y: 100,
    });
  });

  it('inverts both together', () => {
    // This is the case that matters: tapping while panned and zoomed.
    const viewport: Viewport = { scale: 2, translateX: -100, translateY: -60 };
    expect(canvasToPattern(300, 240, viewport)).toEqual({ x: 200, y: 150 });
  });
});

describe('visibleCellRange', () => {
  const pattern = { width: 250, height: 250 } as never;

  it('covers the whole chart when fully zoomed out', () => {
    const viewport = clampViewport({ ...IDENTITY, scale: 0.001 }, LARGE);
    const range = visibleCellRange(viewport, LARGE, 20, pattern);
    expect(range.startX).toBe(0);
    expect(range.startY).toBe(0);
    expect(range.endX).toBe(250);
  });

  it('narrows to a small window when zoomed in', () => {
    const viewport: Viewport = { scale: 4, translateX: -2000, translateY: -2000 };
    const range = visibleCellRange(viewport, LARGE, 20, pattern);
    // 400px of viewport at scale 4 shows 100 pattern px, which is 5 cells.
    expect(range.endX - range.startX).toBeLessThanOrEqual(6);
  });

  it('never reports cells outside the pattern', () => {
    const viewport: Viewport = { scale: 0.05, translateX: 0, translateY: 0 };
    const range = visibleCellRange(viewport, LARGE, 20, pattern);
    expect(range.startX).toBeGreaterThanOrEqual(0);
    expect(range.endX).toBeLessThanOrEqual(250);
    expect(range.endY).toBeLessThanOrEqual(250);
  });
});
