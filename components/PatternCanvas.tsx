/**
 * Renders a pattern and its progress with Skia.
 *
 * Lives outside `app/` deliberately: with Expo Router in dev mode, components
 * inside `app/` are evaluated before CanvasKit finishes loading on web, so any
 * Skia component there throws "CanvasKit is not defined".
 *
 * The canvas is the size of the visible area, not the pattern. Panning and
 * zooming move a transform applied *inside* Skia rather than resizing or moving
 * the surface, so the surface stays screen-sized whatever the chart size.
 *
 * ## Why the drawing is baked
 *
 * The naive version declared one Skia element per placement. At 200x200 that is
 * tens of thousands of elements for React to reconcile and Skia to walk on
 * every frame, which measured at roughly 1 fps during a pan.
 *
 * Everything is now recorded into two `Picture`s instead:
 *
 * - **Static**, rebuilt only when the pattern changes, which is almost never.
 * - **Progress**, rebuilt only when progress changes, which happens on a tap.
 *
 * Neither depends on the viewport, so panning and zooming rebuild nothing at
 * all: the transform moves an already-recorded picture. Baking cost moves off
 * the frame path and onto the interaction path, where a few milliseconds do not
 * show.
 *
 * ## Geometry approximations
 *
 * Full and blank cells are exact. The fractional stitches are deliberately
 * rough, per the S3-1 acceptance criteria: quarters draw as half-size squares,
 * three-quarters as three of them, and halves as a triangle on one side of the
 * diagonal. Refining them to true stitch geometry is a later story.
 */

import { Canvas, Group, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint, SkPath } from '@shopify/react-native-skia';
import { useCallback, useMemo } from 'react';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { getRow } from '../lib/domain/grid';
import { getRunListValue, isPlacementComplete } from '../lib/domain/progress';
import type {
  CellContent,
  Corner,
  Pattern,
  Placement,
  Project,
  ThreadKey,
} from '../lib/domain/types';
import CanvasInteraction from './CanvasInteraction';
import { cellAtPoint } from './hitTest';
import { canvasToPattern, clampTranslation, contentSize, minScale } from './viewport';
import type { Viewport, ViewportBounds } from './viewport';

/**
 * Completed stitches are faded by overdrawing them with the background rather
 * than by drawing them at reduced opacity. Both look the same, but overdraw
 * keeps the static picture free of any progress state, so marking a stitch
 * never rebuilds it.
 */
const COMPLETED_FADE_ALPHA = 0.78;
const GRID_LINE_COLOR = '#d8d2c8';
const BACKGROUND_COLOR = '#faf7f2';

/** Grid lines vanish below this scale rather than smearing into a solid block. */
const GRID_LINE_MIN_SCALE = 0.35;

export interface PatternCanvasProps {
  readonly pattern: Pattern;
  readonly project: Project;
  /** Cell size in pixels at scale 1. */
  readonly baseCellSize: number;
  /** Visible area. The Skia surface is this size regardless of pattern size. */
  readonly viewWidth: number;
  readonly viewHeight: number;
  /** Called with the grid cell a tap landed in. Omit for a read-only canvas. */
  readonly onCellPress?: (x: number, y: number) => void;
}

/** Fractional offsets of a corner within a cell, in units of half a cell. */
function cornerOffset(corner: Corner): { readonly hx: number; readonly hy: number } {
  switch (corner) {
    case 'topLeft':
      return { hx: 0, hy: 0 };
    case 'topRight':
      return { hx: 1, hy: 0 };
    case 'bottomLeft':
      return { hx: 0, hy: 1 };
    case 'bottomRight':
      return { hx: 1, hy: 1 };
  }
}

function oppositeCorner(corner: Corner): Corner {
  switch (corner) {
    case 'topLeft':
      return 'bottomRight';
    case 'topRight':
      return 'bottomLeft';
    case 'bottomLeft':
      return 'topRight';
    case 'bottomRight':
      return 'topLeft';
  }
}

const ALL_CORNERS: readonly Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

/** Build the shape for one placement, at the cell's top-left origin. */
function placementPath(placement: Placement, x: number, y: number, size: number): SkPath {
  const half = size / 2;
  const path = Skia.Path.Make();

  switch (placement.kind) {
    case 'full':
      path.addRect(Skia.XYWHRect(x, y, size, size));
      return path;

    case 'quarter': {
      const { hx, hy } = cornerOffset(placement.corner);
      path.addRect(Skia.XYWHRect(x + hx * half, y + hy * half, half, half));
      return path;
    }

    case 'threeQuarter': {
      // Three of the four quadrants: everything except the one diagonally
      // opposite this stitch's corner.
      const skip = oppositeCorner(placement.corner);
      for (const corner of ALL_CORNERS) {
        if (corner === skip) {
          continue;
        }
        const { hx, hy } = cornerOffset(corner);
        path.addRect(Skia.XYWHRect(x + hx * half, y + hy * half, half, half));
      }
      return path;
    }

    case 'half': {
      // 'forward' is the "/" diagonal, running bottom-left to top-right; this
      // fills the lower-right of it. 'backward' is "\", filled lower-left.
      if (placement.slant === 'forward') {
        path.moveTo(x, y + size);
        path.lineTo(x + size, y);
        path.lineTo(x + size, y + size);
      } else {
        path.moveTo(x, y);
        path.lineTo(x + size, y + size);
        path.lineTo(x, y + size);
      }
      path.close();
      return path;
    }
  }
}

/**
 * One paint per colour, reused across every draw call using it.
 *
 * A paint per placement would allocate tens of thousands of native objects
 * during a bake, which is most of the cost the bake exists to avoid.
 */
function makePaintCache(): (color: string) => SkPaint {
  const cache = new Map<string, SkPaint>();
  return (color) => {
    const existing = cache.get(color);
    if (existing !== undefined) {
      return existing;
    }
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(color));
    paint.setAntiAlias(true);
    cache.set(color, paint);
    return paint;
  };
}

function paletteMap(pattern: Pattern): Map<ThreadKey, string> {
  const map = new Map<ThreadKey, string>();
  for (const entry of pattern.palette) {
    map.set(entry.key, entry.color);
  }
  return map;
}

export default function PatternCanvas({
  pattern,
  project,
  baseCellSize,
  viewWidth,
  viewHeight,
  onCellPress,
}: PatternCanvasProps) {
  const palette = useMemo(() => paletteMap(pattern), [pattern]);

  const bounds = useMemo<ViewportBounds>(
    () => ({
      viewWidth,
      viewHeight,
      ...contentSize(pattern, baseCellSize),
    }),
    [viewWidth, viewHeight, pattern, baseCellSize],
  );

  // Start fully zoomed out and centred, so the first sight of a chart is the
  // whole chart.
  const initial = useMemo(() => {
    const fitted = minScale(bounds);
    return clampTranslation({ scale: fitted, translateX: 0, translateY: 0 }, bounds);
  }, [bounds]);

  const scale = useSharedValue(initial.scale);
  const translateX = useSharedValue(initial.translateX);
  const translateY = useSharedValue(initial.translateY);
  const startScale = useSharedValue(initial.scale);
  const startX = useSharedValue(initial.translateX);
  const startY = useSharedValue(initial.translateY);

  const transform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  const handleTap = useCallback(
    (canvasX: number, canvasY: number, viewport: Viewport) => {
      if (onCellPress === undefined) {
        return;
      }
      // The tap arrives in canvas space; the hit test needs pattern space.
      const point = canvasToPattern(canvasX, canvasY, viewport);
      const hit = cellAtPoint(point.x, point.y, {
        width: pattern.width,
        height: pattern.height,
        cellSize: baseCellSize,
      });
      if (hit !== null) {
        onCellPress(hit.x, hit.y);
      }
    },
    [onCellPress, pattern.width, pattern.height, baseCellSize],
  );

  /**
   * The chart itself. Depends only on the pattern, so it survives every pan,
   * zoom, and stitch marked.
   */
  const staticPicture = useMemo(
    () =>
      createPicture((canvas: SkCanvas) => {
        const paintFor = makePaintCache();
        const { contentWidth, contentHeight } = contentSize(pattern, baseCellSize);

        canvas.drawRect(
          Skia.XYWHRect(0, 0, contentWidth, contentHeight),
          paintFor(BACKGROUND_COLOR),
        );

        // Grid lines first, so a partially filled cell still reads as a cell.
        const gridPaint = Skia.Paint();
        gridPaint.setColor(Skia.Color(GRID_LINE_COLOR));
        gridPaint.setStrokeWidth(1);
        gridPaint.setStyle(1); // stroke
        for (let x = 0; x <= pattern.width; x += 1) {
          canvas.drawLine(x * baseCellSize, 0, x * baseCellSize, contentHeight, gridPaint);
        }
        for (let y = 0; y <= pattern.height; y += 1) {
          canvas.drawLine(0, y * baseCellSize, contentWidth, y * baseCellSize, gridPaint);
        }

        // Cells, expanded a row at a time: getCell is O(runs in row), so
        // reading cell by cell would be quadratic in run count.
        for (let y = 0; y < pattern.height; y += 1) {
          const contentRow = getRow(pattern.cells, y);
          for (let x = 0; x < pattern.width; x += 1) {
            const content: CellContent | undefined = pattern.cellContents[contentRow[x]];
            if (content === undefined || content.length === 0) {
              continue;
            }
            for (const placement of content) {
              const path = placementPath(
                placement,
                x * baseCellSize,
                y * baseCellSize,
                baseCellSize,
              );
              canvas.drawPath(path, paintFor(palette.get(placement.thread) ?? '#999999'));
            }
          }
        }

        // Line and point stitches sit on the shared coordinate space, where
        // integers are grid intersections, so they draw over cell boundaries
        // rather than inside cells.
        const strokeWidth = Math.max(1.5, baseCellSize * 0.12);
        for (const line of pattern.lines) {
          const paint = Skia.Paint();
          paint.setColor(Skia.Color(palette.get(line.thread) ?? '#333333'));
          paint.setStrokeWidth(strokeWidth);
          paint.setStyle(1);
          paint.setStrokeCap(1); // round
          paint.setAntiAlias(true);
          canvas.drawLine(
            line.from.x * baseCellSize,
            line.from.y * baseCellSize,
            line.to.x * baseCellSize,
            line.to.y * baseCellSize,
            paint,
          );
        }

        const radius = Math.max(2, baseCellSize * 0.18);
        for (const point of pattern.points) {
          canvas.drawCircle(
            point.at.x * baseCellSize,
            point.at.y * baseCellSize,
            radius,
            paintFor(palette.get(point.thread) ?? '#333333'),
          );
        }
      }),
    [pattern, baseCellSize, palette],
  );

  /**
   * Completed stitches, faded by overdrawing with a translucent background.
   *
   * Separate from the static picture so marking a stitch rebuilds only this
   * one, and so panning rebuilds neither. Fading by overdraw rather than by
   * opacity is what allows the split: the static layer never has to know
   * anything about progress.
   */
  const progressPicture = useMemo(
    () =>
      createPicture((canvas: SkCanvas) => {
        const fade = Skia.Paint();
        fade.setColor(Skia.Color(BACKGROUND_COLOR));
        fade.setAlphaf(COMPLETED_FADE_ALPHA);

        for (let y = 0; y < pattern.height; y += 1) {
          const contentRow = getRow(pattern.cells, y);
          const progressRow = getRow(project.cellProgress, y);
          for (let x = 0; x < pattern.width; x += 1) {
            const mask = progressRow[x];
            if (mask === 0) {
              continue;
            }
            const content: CellContent | undefined = pattern.cellContents[contentRow[x]];
            if (content === undefined) {
              continue;
            }
            content.forEach((placement, index) => {
              if (!isPlacementComplete(mask, index)) {
                return;
              }
              canvas.drawPath(
                placementPath(placement, x * baseCellSize, y * baseCellSize, baseCellSize),
                fade,
              );
            });
          }
        }

        const strokeWidth = Math.max(1.5, baseCellSize * 0.12);
        pattern.lines.forEach((line, index) => {
          if (!getRunListValue(project.lineProgress, index)) {
            return;
          }
          const paint = Skia.Paint();
          paint.setColor(Skia.Color(BACKGROUND_COLOR));
          paint.setAlphaf(COMPLETED_FADE_ALPHA);
          paint.setStrokeWidth(strokeWidth);
          paint.setStyle(1);
          paint.setStrokeCap(1);
          canvas.drawLine(
            line.from.x * baseCellSize,
            line.from.y * baseCellSize,
            line.to.x * baseCellSize,
            line.to.y * baseCellSize,
            paint,
          );
        });

        const radius = Math.max(2, baseCellSize * 0.18);
        pattern.points.forEach((point, index) => {
          if (!getRunListValue(project.pointProgress, index)) {
            return;
          }
          canvas.drawCircle(point.at.x * baseCellSize, point.at.y * baseCellSize, radius, fade);
        });
      }),
    [pattern, project, baseCellSize],
  );

  // Hairlines at low zoom merge into a solid wash. Left in the static picture
  // for now; hiding them by scale would mean re-baking, which defeats the
  // point. Worth revisiting if it reads badly on a large chart.
  void GRID_LINE_MIN_SCALE;

  const canvas = (
    <Canvas style={{ width: viewWidth, height: viewHeight }}>
      <Group transform={transform}>
        <Picture picture={staticPicture} />
        <Picture picture={progressPicture} />
      </Group>
    </Canvas>
  );

  return (
    <CanvasInteraction
      values={{ scale, translateX, translateY, startScale, startX, startY }}
      bounds={bounds}
      baseCellSize={baseCellSize}
      onTap={handleTap}
      width={viewWidth}
      height={viewHeight}
    >
      {canvas}
    </CanvasInteraction>
  );
}
