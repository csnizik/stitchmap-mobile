/**
 * Canonical domain types for StitchMap Mobile.
 *
 * Design rationale and invariants: docs/decisions/adr-004-domain-model.md
 *
 * Three stitch layers share one coordinate space:
 *   1. Cell-occupying stitches (full, half, quarter, three-quarter) live in the
 *      cell grid.
 *   2. Line stitches (backstitch, straight) run between arbitrary points.
 *   3. Point stitches (french knot) sit at a single point.
 *
 * Integer coordinates are grid intersections; half-steps are cell centres.
 */

/** Bumped whenever a stored shape changes in a way readers must know about. */
export const SCHEMA_VERSION = 1;
export type SchemaVersion = typeof SCHEMA_VERSION;

/** Identifies a palette entry. Unique within a pattern. */
export type ThreadKey = string;

/** Opaque identifier for a line or point stitch. Unique within a pattern. */
export type StitchId = string;

/** A single thread used by a pattern. */
export interface PaletteEntry {
  readonly key: ThreadKey;
  /** Chart symbol, for example 'A' or '#'. */
  readonly symbol: string;
  /** Display colour as '#rrggbb'. */
  readonly color: string;
  /** Manufacturer, for example 'DMC'. */
  readonly brand: string;
  /** Manufacturer code, for example '310'. */
  readonly code: string;
  /** Human-readable name, for example 'Black'. */
  readonly label: string;
}

/* ------------------------------------------------------------------ *
 * Layer 1: cell-occupying stitches
 * ------------------------------------------------------------------ */

export type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export const CORNERS: readonly Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

/** 'forward' is the '/' diagonal, 'backward' is the '\' diagonal. */
export type Slant = 'forward' | 'backward';

export const SLANTS: readonly Slant[] = ['forward', 'backward'];

export type PlacementKind = 'full' | 'half' | 'quarter' | 'threeQuarter';

export const PLACEMENT_KINDS: readonly PlacementKind[] = [
  'full',
  'half',
  'quarter',
  'threeQuarter',
];

export interface FullPlacement {
  readonly kind: 'full';
  readonly thread: ThreadKey;
}

export interface HalfPlacement {
  readonly kind: 'half';
  readonly slant: Slant;
  readonly thread: ThreadKey;
}

export interface QuarterPlacement {
  readonly kind: 'quarter';
  readonly corner: Corner;
  readonly thread: ThreadKey;
}

/**
 * A three-quarter stitch: one half stitch plus a quarter filling an adjacent
 * quadrant. Only the quarter's corner is stored, because it determines the
 * half's slant. A quarter at topLeft or bottomRight sits off the '\' diagonal,
 * so the half must be 'forward'; topRight or bottomLeft implies 'backward'.
 * Storing both would allow contradictory values.
 */
export interface ThreeQuarterPlacement {
  readonly kind: 'threeQuarter';
  readonly corner: Corner;
  readonly thread: ThreadKey;
}

export type Placement = FullPlacement | HalfPlacement | QuarterPlacement | ThreeQuarterPlacement;

/**
 * The contents of a single cell, in canonical order (see cells.ts).
 * An empty array is a blank cell.
 */
export type CellContent = readonly Placement[];

/** Progress masks are 32-bit, so a cell may hold at most 32 placements. */
export const MAX_PLACEMENTS_PER_CELL = 32;

/* ------------------------------------------------------------------ *
 * Shared coordinate space
 * ------------------------------------------------------------------ */

/**
 * A position on the chart. Integers are grid intersections, half-steps are
 * cell centres or edge midpoints. `x` is in [0, width], `y` in [0, height].
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Coordinates must be whole multiples of this. */
export const COORDINATE_STEP = 0.5;

/* ------------------------------------------------------------------ *
 * Layer 2: line stitches
 * ------------------------------------------------------------------ */

export type LineStitchKind = 'backstitch' | 'straight';

export const LINE_STITCH_KINDS: readonly LineStitchKind[] = ['backstitch', 'straight'];

export interface LineStitch {
  readonly id: StitchId;
  readonly kind: LineStitchKind;
  readonly from: Point;
  readonly to: Point;
  readonly thread: ThreadKey;
}

/* ------------------------------------------------------------------ *
 * Layer 3: point stitches
 * ------------------------------------------------------------------ */

export type PointStitchKind = 'frenchKnot';

export const POINT_STITCH_KINDS: readonly PointStitchKind[] = ['frenchKnot'];

export interface PointStitch {
  readonly id: StitchId;
  readonly kind: PointStitchKind;
  readonly at: Point;
  readonly thread: ThreadKey;
}

/* ------------------------------------------------------------------ *
 * Grid
 * ------------------------------------------------------------------ */

export interface Run<T> {
  readonly value: T;
  readonly count: number;
}

/**
 * A run-length encoded grid. Runs never cross a row boundary: `rows.length`
 * equals `height`, and each row's counts sum to `width`. That makes an N-row
 * slice a self-contained grid, which is what the Firestore chunking strategy
 * depends on.
 */
export interface Grid<T> {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly (readonly Run<T>[])[];
}

/** Indices into `Pattern.cellContents`. */
export type CellGrid = Grid<number>;

/** Per-cell completion bitmasks over that cell's placements. */
export type ProgressGrid = Grid<number>;

/* ------------------------------------------------------------------ *
 * Aggregates
 * ------------------------------------------------------------------ */

/** `cellContents[0]` is always the blank cell. */
export const BLANK_CELL_INDEX = 0;

export interface Pattern {
  readonly schemaVersion: SchemaVersion;
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly PaletteEntry[];
  /**
   * Distinct cell contents, interned. Index 0 is the blank cell; no other
   * entry is blank and no two entries are equal.
   */
  readonly cellContents: readonly CellContent[];
  readonly cells: CellGrid;
  readonly lines: readonly LineStitch[];
  readonly points: readonly PointStitch[];
  /** ISO 8601 timestamps. */
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Project {
  readonly schemaVersion: SchemaVersion;
  readonly id: string;
  readonly patternId: string;
  /** Must match the pattern's dimensions. */
  readonly width: number;
  readonly height: number;
  readonly cellProgress: ProgressGrid;
  /** Run-length encoded over `Pattern.lines` in order. */
  readonly lineProgress: readonly Run<boolean>[];
  /** Run-length encoded over `Pattern.points` in order. */
  readonly pointProgress: readonly Run<boolean>[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
