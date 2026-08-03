/**
 * Renders a pattern and its progress with Skia.
 *
 * Lives outside `app/` deliberately: with Expo Router in dev mode, components
 * inside `app/` are evaluated before CanvasKit finishes loading on web, so any
 * Skia component there throws "CanvasKit is not defined".
 *
 * This is the naive renderer. It draws every cell declaratively on every
 * render, which is correct and readable but will not scale. Baking the static
 * layer into a `Picture`, batching with `drawAtlas`, and culling to the
 * viewport are all S3-3 (#44). Do not optimise here.
 *
 * ## Geometry approximations
 *
 * Full and blank cells are exact. The fractional stitches are deliberately
 * rough, per the S3-1 acceptance criteria:
 *
 * - **quarter** draws as a half-size square in its corner. A real quarter
 *   stitch is a small triangle from the corner to the cell centre.
 * - **threeQuarter** draws as three quarter-squares, omitting the one
 *   diagonally opposite its corner.
 * - **half** draws as a triangle on one side of its diagonal. Which side is an
 *   arbitrary but consistent choice.
 *
 * These read clearly at a glance and are unambiguous about which quadrant is
 * occupied, which is what the slice needs. Refining them to true stitch
 * geometry is a later story and a UX decision.
 */

import { Canvas, Circle, Group, Line, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo, useRef } from 'react';
import { View } from 'react-native';
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
import { cellAtPointInPattern } from './hitTest';

/** Completed stitches fade back; what remains to stitch stays prominent. */
const COMPLETED_OPACITY = 0.22;
const GRID_LINE_COLOR = '#d8d2c8';
const BACKGROUND_COLOR = '#faf7f2';

export interface PatternCanvasProps {
  readonly pattern: Pattern;
  readonly project: Project;
  /** Side length of one cell in pixels. */
  readonly cellSize: number;
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

/**
 * Build the shape for one placement, positioned at the cell's top-left origin.
 */
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
      // A triangle on one side of the diagonal. 'forward' is the "/" diagonal,
      // running bottom-left to top-right; this fills the lower-right of it.
      // 'backward' is "\", filled on the lower-left.
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
  cellSize,
  onCellPress,
}: PatternCanvasProps) {
  const width = pattern.width * cellSize;
  const height = pattern.height * cellSize;

  const palette = useMemo(() => paletteMap(pattern), [pattern]);

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
            path: placementPath(placement, x * cellSize, y * cellSize, cellSize),
            color: palette.get(placement.thread) ?? '#999999',
            complete: isPlacementComplete(mask, index),
          });
        });
      }
    }

    return drawn;
  }, [pattern, project, cellSize, palette]);

  // Grid lines are drawn under the stitches so a partially filled cell still
  // reads as a cell.
  const gridLines = useMemo(() => {
    const lines: { key: string; p1: ReturnType<typeof vec>; p2: ReturnType<typeof vec> }[] = [];
    for (let x = 0; x <= pattern.width; x += 1) {
      lines.push({ key: `v${x}`, p1: vec(x * cellSize, 0), p2: vec(x * cellSize, height) });
    }
    for (let y = 0; y <= pattern.height; y += 1) {
      lines.push({ key: `h${y}`, p1: vec(0, y * cellSize), p2: vec(width, y * cellSize) });
    }
    return lines;
  }, [pattern.width, pattern.height, cellSize, width, height]);

  const containerRef = useRef<View>(null);

  const canvas = (
    <Canvas style={{ width, height }}>
      <Rect x={0} y={0} width={width} height={height} color={BACKGROUND_COLOR} />

      {gridLines.map((line) => (
        <Line key={line.key} p1={line.p1} p2={line.p2} color={GRID_LINE_COLOR} strokeWidth={1} />
      ))}

      {placements.map((placement) => (
        <Group key={placement.key} opacity={placement.complete ? COMPLETED_OPACITY : 1}>
          <Path path={placement.path} color={placement.color} />
        </Group>
      ))}

      {/*
        Line and point stitches sit on the shared coordinate space, where
        integers are grid intersections. They therefore draw over cell
        boundaries rather than inside cells, which is the whole reason they
        are not part of the cell grid.

        Their progress lives in its own run lists, indexed by position in
        pattern.lines and pattern.points, not in the cell mask.
      */}
      {pattern.lines.map((line, index) => (
        <Group
          key={line.id}
          opacity={getRunListValue(project.lineProgress, index) ? COMPLETED_OPACITY : 1}
        >
          <Line
            p1={vec(line.from.x * cellSize, line.from.y * cellSize)}
            p2={vec(line.to.x * cellSize, line.to.y * cellSize)}
            color={palette.get(line.thread) ?? '#333333'}
            strokeWidth={Math.max(1.5, cellSize * 0.12)}
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
            cx={point.at.x * cellSize}
            cy={point.at.y * cellSize}
            r={Math.max(2, cellSize * 0.18)}
            color={palette.get(point.thread) ?? '#333333'}
          />
        </Group>
      ))}
    </Canvas>
  );

  if (onCellPress === undefined) {
    return canvas;
  }

  return (
    // Coordinates come from the touch/pointer event rather than Pressable's
    // locationX/locationY, which React Native Web leaves undefined. Measuring
    // the view and subtracting its page offset works identically on native and
    // web, and pan/zoom (#43) can transform the result before the hit test.
    <View
      ref={containerRef}
      onStartShouldSetResponder={() => true}
      onResponderRelease={(event) => {
        const { pageX, pageY } = event.nativeEvent;
        containerRef.current?.measure((_x, _y, _w, _h, px, py) => {
          const hit = cellAtPointInPattern(pageX - px, pageY - py, pattern, cellSize);
          if (hit !== null) {
            onCellPress(hit.x, hit.y);
          }
        });
      }}
    >
      {canvas}
    </View>
  );
}
