// Canonical domain types for StitchMap.
//
// These are the single source of truth shared by storage, sync, and UI. They
// are intentionally plain, serializable interfaces (no class instances, no
// `Date` objects) so a value can round-trip through JSON without losing
// fidelity — see `serialization.ts`. Timestamps are ISO 8601 strings and ids
// are opaque strings.
//
// The grid is stored row-major with run-length encoding (RLE); see
// `docs/data-model.md` for the rationale behind that choice.

/**
 * Stable identifier for a palette entry within a pattern. Grid cells reference
 * a palette entry by its `ThreadKey` rather than embedding colour/brand data,
 * so the palette is the single source of truth for a thread's appearance.
 */
export type ThreadKey = string;

/**
 * A single thread/colour in a pattern's palette.
 *
 * `key` is referenced by grid cells; `symbol` is the glyph drawn on a printed
 * chart; `brand`/`code` identify the physical thread (e.g. DMC 310); `label`
 * is the human-readable name.
 */
export interface PaletteEntry {
  /** Stable key referenced by grid cells. */
  key: ThreadKey;
  /** Short symbol drawn on the chart, e.g. "X" or "●". */
  symbol: string;
  /** Display colour as a hex string, e.g. "#1A1A1A". */
  color: string;
  /** Thread manufacturer / brand, e.g. "DMC". */
  brand: string;
  /** Manufacturer's thread code, e.g. "310". */
  code: string;
  /** Human-readable label, e.g. "Black". */
  label: string;
}

/**
 * The contents of a single cell in a pattern grid: either the {@link ThreadKey}
 * of the palette entry to stitch there, or `null` for an intentionally blank
 * (unstitched) cell.
 */
export type StitchCell = ThreadKey | null;

/**
 * A run of identical values: `count` consecutive cells all holding `value`.
 * The building block of the run-length encoding.
 */
export interface Run<T> {
  value: T;
  count: number;
}

/**
 * A row-major, run-length-encoded grid of `width` × `height` cells.
 *
 * Cells are enumerated left-to-right, top-to-bottom; runs may span row
 * boundaries. The sum of every run's `count` always equals `width * height`.
 */
export interface Grid<T> {
  /** Number of cells per row. */
  width: number;
  /** Number of rows. */
  height: number;
  /** Run-length-encoded cells in row-major order. */
  runs: Run<T>[];
}

/** The chart for a pattern: which thread (if any) occupies each cell. */
export type StitchGrid = Grid<StitchCell>;

/** Per-cell completion state for a project: `true` where a cell is stitched. */
export type ProgressGrid = Grid<boolean>;

/**
 * A cross-stitch pattern: its dimensions (in stitches), its palette, and the
 * RLE chart referencing that palette.
 */
export interface Pattern {
  /** Opaque stable id. */
  id: string;
  /** Display name. */
  name: string;
  /** Width in stitches. */
  width: number;
  /** Height in stitches. */
  height: number;
  /** All threads used by the chart. */
  palette: PaletteEntry[];
  /** Row-major RLE chart; `grid.width`/`grid.height` match `width`/`height`. */
  grid: StitchGrid;
  /** Creation timestamp (ISO 8601). */
  createdAt: string;
  /** Last-modified timestamp (ISO 8601). */
  updatedAt: string;
}

/**
 * A user's in-progress work against a {@link Pattern}: which cells have been
 * stitched, plus cached counts for quick progress display.
 */
export interface Project {
  /** Opaque stable id. */
  id: string;
  /** Id of the {@link Pattern} this project tracks. */
  patternId: string;
  /** Row-major RLE per-cell completion state. */
  progress: ProgressGrid;
  /** Number of cells marked completed. */
  completedCount: number;
  /** Number of stitchable (non-blank) cells in the pattern. */
  totalCount: number;
  /** Creation timestamp (ISO 8601). */
  createdAt: string;
  /** Last-modified timestamp (ISO 8601). */
  updatedAt: string;
}
