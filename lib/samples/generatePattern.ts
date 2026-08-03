/**
 * Generates large patterns for performance work.
 *
 * The committed sample is 8x8. That is enough to prove the stack composes, and
 * useless for anything about scale: at 160px of content it fits a desktop
 * window at scale 5.5, which made an entire day of zoom behaviour look broken
 * when it was working correctly. Rendering work needs a chart the size of a
 * chart people actually stitch.
 *
 * Deterministic, so a frame-rate figure means something across runs and across
 * machines. The generator is seeded rather than using Math.random.
 */

import { buildCellGrid } from '../domain/cells';
import { createStitchId } from '../domain/ids';
import { SCHEMA_VERSION } from '../domain/types';
import type {
  LineStitch,
  PaletteEntry,
  Pattern,
  Placement,
  PointStitch,
  ThreadKey,
} from '../domain/types';

const CREATED_AT = '2026-08-03T00:00:00.000Z';

/**
 * A 32-bit mulberry-style PRNG. Seeded and reproducible, which matters here:
 * a performance number from a randomly different chart each run is not a
 * measurement.
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A palette large enough that colour lookup is not trivially cached. */
function buildPalette(size: number): PaletteEntry[] {
  const entries: PaletteEntry[] = [];
  for (let i = 0; i < size; i += 1) {
    // Evenly spaced hues, converted to hex without pulling in a colour library.
    const hue = (i * 360) / size;
    entries.push({
      key: `t${i}`,
      symbol: String.fromCharCode(33 + (i % 90)),
      color: hslToHex(hue, 45, 55),
      brand: 'DMC',
      code: String(100 + i),
      label: `Generated ${i}`,
    });
  }
  return entries;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const channel = (n: number): string => {
    const k = (n + h / 30) % 12;
    const value = lig - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export interface GeneratedPatternOptions {
  readonly width: number;
  readonly height: number;
  /** Same seed produces the same chart. */
  readonly seed?: number;
  /** Distinct threads. Real charts run 20 to 60. */
  readonly paletteSize?: number;
  /**
   * Fraction of cells left blank. Real charts have significant negative space,
   * and blank cells are the cheapest to draw, so this materially affects any
   * frame-rate figure.
   */
  readonly blankRatio?: number;
  /** Fraction of stitched cells that are fractional rather than full. */
  readonly fractionalRatio?: number;
  /** Backstitch segments. Dense charts carry thousands. */
  readonly lineCount?: number;
  readonly pointCount?: number;
  readonly id?: string;
}

/**
 * Build a pattern of arbitrary size.
 *
 * Cells are generated in regions rather than per-cell noise: a chart of pure
 * random colour would defeat run-length encoding entirely and measure a case
 * that does not occur. Regions give runs of realistic length while still
 * leaving plenty of detail.
 */
export function generatePattern({
  width,
  height,
  seed = 1,
  paletteSize = 40,
  blankRatio = 0.35,
  fractionalRatio = 0.12,
  lineCount = 0,
  pointCount = 0,
  id = `generated-${width}x${height}`,
}: GeneratedPatternOptions): Pattern {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`width and height must be positive integers`);
  }

  const random = makeRandom(seed);
  const palette = buildPalette(paletteSize);
  const threads: ThreadKey[] = palette.map((entry) => entry.key);

  const corners = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;
  const slants = ['forward', 'backward'] as const;

  const cells: Placement[][] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // Region index changes every few cells, so colours come in runs.
      const region = Math.floor(x / 7) + Math.floor(y / 5) * 3;
      const threadIndex = (region + Math.floor(random() * 2)) % threads.length;
      const thread = threads[threadIndex];

      if (random() < blankRatio) {
        cells.push([]);
        continue;
      }

      if (random() < fractionalRatio) {
        const roll = random();
        if (roll < 0.4) {
          cells.push([{ kind: 'half', slant: slants[Math.floor(random() * 2)], thread }]);
        } else if (roll < 0.7) {
          cells.push([{ kind: 'quarter', corner: corners[Math.floor(random() * 4)], thread }]);
        } else {
          // A shared cell: two placements of different threads, which is the
          // case a single-value cell model could not represent.
          cells.push([
            { kind: 'threeQuarter', corner: corners[Math.floor(random() * 4)], thread },
            {
              kind: 'quarter',
              corner: corners[Math.floor(random() * 4)],
              thread: threads[(threadIndex + 1) % threads.length],
            },
          ]);
        }
        continue;
      }

      cells.push([{ kind: 'full', thread }]);
    }
  }

  const built = buildCellGrid(width, height, cells);

  const lines: LineStitch[] = [];
  for (let i = 0; i < lineCount; i += 1) {
    // Axis-aligned along cell edges, which is what most backstitch is.
    const horizontal = random() < 0.5;
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    lines.push({
      id: createStitchId(random),
      kind: 'backstitch',
      from: { x, y },
      to: horizontal ? { x: x + 1, y } : { x, y: y + 1 },
      thread: threads[Math.floor(random() * threads.length)],
    });
  }

  const points: PointStitch[] = [];
  for (let i = 0; i < pointCount; i += 1) {
    points.push({
      id: createStitchId(random),
      kind: 'frenchKnot',
      at: { x: Math.floor(random() * width), y: Math.floor(random() * height) },
      thread: threads[Math.floor(random() * threads.length)],
    });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: `Generated ${width}x${height}`,
    width,
    height,
    palette,
    cellContents: built.cellContents,
    cells: built.cells,
    lines,
    points,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

/** The sizes the performance criteria in #44 are stated against. */
export const PERFORMANCE_SIZES = {
  /** A realistic mid-size chart. */
  typical: { width: 100, height: 100, lineCount: 200, pointCount: 60 },
  /** The upper end of what this app targets. */
  large: { width: 200, height: 200, lineCount: 600, pointCount: 200 },
} as const;
