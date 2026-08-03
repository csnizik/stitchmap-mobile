/**
 * Renders a pattern and its progress with Skia.
 *
 * Lives outside `app/` deliberately: with Expo Router in dev mode, components
 * inside `app/` are evaluated before CanvasKit finishes loading on web, so any
 * Skia component there throws "CanvasKit is not defined".
 *
 * The canvas is the size of the visible area, not the pattern. Panning and
 * zooming move a transform applied *inside* Skia rather than resizing or moving
 * the surface. A 250x250 chart would otherwise need a 5000x5000 surface, and
 * nothing could be culled. Because the transform is known here, #44 can compute
 * the visible region and skip everything else.
 *
 * Paths are built once at `baseCellSize` and scaled by the transform, so
 * zooming never rebuilds geometry.
 *
 * Input lives in `CanvasInteraction`, which is platform-split: Gesture Handler
 * on native, DOM pointer and wheel events on web. Rendering is shared.
 *
 * This is still the naive renderer: every cell is drawn on every frame. Baking
 * the static layer into a `Picture` and culling are #44.
 *
 * ## Geometry approximations
 *
 * Full and blank cells are exact. The fractional stitches are deliberately
 * rough, per the S3-1 acceptance criteria: quarters draw as half-size squares,
 * three-quarters as three of them, and halves as a triangle on one side of the
 * diagonal. Refining them to true stitch geometry is a later story.
 */

import { Canvas, Circle, Group, Line, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
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

/** Completed stitches fade back; what remains to stitch stays prominent. */
const COMPLETED_OPACITY = 0.22;
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

function paletteMap(pattern: Pattern): Map<ThreadKey, string> {
  const map = new Map<ThreadKey, string>();
  for (const entry of pattern.palette) {
    map.set(entry.key, entry.color);
  }
  return map;
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
function placementPath(
  placement: Placement,
  x: number,
  y: number,
  size: number,
): ReturnType<typeof Skia.Path.Make> {
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

interface DrawnPlacement {
  readonly key: string;
  readonly path: ReturnType<typeof Skia.Path.Make>;
  readonly color: string;
  readonly complete: boolean;
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

  // Expanded once per render rather than per cell: getCell is O(runs in row),
  // so reading cell by cell would be quadratic in run count.
  const placements = useMemo<DrawnPlacement[]>(() => {
    const drawn: DrawnPlacement[] = [];

    for (let y = 0; y < pattern.height; y += 1) {
      const contentRow = getRow(pattern.cells, y);
      const progressRow = getRow(project.cellProgress, y);

      for (let x = 0; x < pattern.width; x += 1) {
        const content: CellContent | undefined = pattern.cellContents[contentRow[x]];
        if (content === undefined || content.length === 0) {
          continue;
        }
        const mask = progressRow[x];

        content.forEach((placement, index) => {
          drawn.push({
            key: `${x}-${y}-${index}`,
            path: placementPath(placement, x * baseCellSize, y * baseCellSize, baseCellSize),
            color: palette.get(placement.thread) ?? '#999999',
            complete: isPlacementComplete(mask, index),
          });
        });
      }
    }

    return drawn;
  }, [pattern, project, baseCellSize, palette]);

  const gridLines = useMemo(() => {
    const lines: { key: string; p1: ReturnType<typeof vec>; p2: ReturnType<typeof vec> }[] = [];
    const w = bounds.contentWidth;
    const h = bounds.contentHeight;
    for (let x = 0; x <= pattern.width; x += 1) {
      lines.push({ key: `v${x}`, p1: vec(x * baseCellSize, 0), p2: vec(x * baseCellSize, h) });
    }
    for (let y = 0; y <= pattern.height; y += 1) {
      lines.push({ key: `h${y}`, p1: vec(0, y * baseCellSize), p2: vec(w, y * baseCellSize) });
    }
    return lines;
  }, [pattern.width, pattern.height, baseCellSize, bounds.contentWidth, bounds.contentHeight]);

  // Hairlines at low zoom merge into a solid wash, so they fade out instead.
  const gridOpacity = useDerivedValue(() => (scale.value < GRID_LINE_MIN_SCALE ? 0 : 1));

  const canvas = (
    <Canvas style={{ width: viewWidth, height: viewHeight }}>
      <Group transform={transform}>
        <Rect
          x={0}
          y={0}
          width={bounds.contentWidth}
          height={bounds.contentHeight}
          color={BACKGROUND_COLOR}
        />

        <Group opacity={gridOpacity}>
          {gridLines.map((line) => (
            <Line
              key={line.key}
              p1={line.p1}
              p2={line.p2}
              color={GRID_LINE_COLOR}
              strokeWidth={1}
            />
          ))}
        </Group>

        {placements.map((placement) => (
          <Group key={placement.key} opacity={placement.complete ? COMPLETED_OPACITY : 1}>
            <Path path={placement.path} color={placement.color} />
          </Group>
        ))}

        {/*
          Line and point stitches sit on the shared coordinate space, where
          integers are grid intersections, so they draw over cell boundaries
          rather than inside cells. Their progress lives in its own run lists,
          indexed by position in pattern.lines and pattern.points.
        */}
        {pattern.lines.map((line, index) => (
          <Group
            key={line.id}
            opacity={getRunListValue(project.lineProgress, index) ? COMPLETED_OPACITY : 1}
          >
            <Line
              p1={vec(line.from.x * baseCellSize, line.from.y * baseCellSize)}
              p2={vec(line.to.x * baseCellSize, line.to.y * baseCellSize)}
              color={palette.get(line.thread) ?? '#333333'}
              strokeWidth={Math.max(1.5, baseCellSize * 0.12)}
              strokeCap="round"
            />
          </Group>
        ))}

        {pattern.points.map((point, index) => (
          <Group
            key={point.id}
            opacity={getRunListValue(project.pointProgress, index) ? COMPLETED_OPACITY : 1}
          >
            <Circle
              cx={point.at.x * baseCellSize}
              cy={point.at.y * baseCellSize}
              r={Math.max(2, baseCellSize * 0.18)}
              color={palette.get(point.thread) ?? '#333333'}
            />
          </Group>
        ))}
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
