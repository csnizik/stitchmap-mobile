# Data model: patterns, palettes & projects

This note describes the canonical domain types in `lib/domain/` — the single
source of truth shared by storage, sync, and UI. The types are plain,
JSON-serializable interfaces (no class instances, no `Date` objects), so any
value round-trips through JSON without loss. Timestamps are ISO 8601 strings and
ids are opaque strings.

## Types

| Type           | Purpose                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------- |
| `ThreadKey`    | Stable string key referencing a palette entry. Grid cells reference threads by key.       |
| `PaletteEntry` | One thread/colour: `key`, `symbol`, `color` (hex), `brand`, `code`, `label`.              |
| `StitchCell`   | A cell's contents: a `ThreadKey`, or `null` for an intentionally blank (unstitched) cell. |
| `Run<T>`       | `{ value, count }` — `count` consecutive cells holding `value`. The RLE building block.   |
| `Grid<T>`      | `{ width, height, runs }` — a row-major, run-length-encoded grid.                         |
| `StitchGrid`   | `Grid<StitchCell>` — a pattern's chart.                                                   |
| `ProgressGrid` | `Grid<boolean>` — a project's per-cell completion state.                                  |
| `Pattern`      | `id`, `name`, `width`×`height` (in stitches), `palette`, `grid`, timestamps.              |
| `Project`      | `id`, `patternId`, `progress`, `completedCount`, `totalCount`, timestamps.                |

The palette is embedded in the `Pattern`; cells reference palette entries by
`ThreadKey` rather than duplicating colour/brand data, so a thread's appearance
has one definition.

## Grid representation: row-major run-length encoding

Cells are enumerated left-to-right, top-to-bottom (row-major) and stored as
**run-length-encoded** runs of identical values. Runs may span row boundaries,
and the sum of every run's `count` always equals `width * height`.

Why RLE row-major:

- **Compact.** Cross-stitch charts have large blocks of one colour and large
  blank areas, which collapse to a handful of runs. This keeps documents small —
  important for the Firestore 1 MB per-document limit (see Sprint 2 chunking
  work), local storage, and sync payloads.
- **Chunking-friendly.** Row-major order means a grid can be split into N-row
  horizontal chunks deterministically, and chunks reassemble in order. The same
  layout is reused for `ProgressGrid`, so pattern and progress chunk identically.
- **No dependencies.** Encoding/decoding is a few lines of pure code
  (`lib/domain/grid.ts`); no compression library is required.

Trade-off: random per-cell access is O(runs) rather than O(1). The
`getCell(grid, x, y)` helper walks runs to resolve a coordinate; for hot paths a
caller can expand once with `gridToCells(grid)` and index the flat array. For
the storage/sync use cases this model targets, compactness wins.

## Helpers (`lib/domain/`)

- `grid.ts` — `runLengthEncode`/`runLengthDecode`, `makeGrid`, `gridToCells`,
  `gridCellCount`, `getCell`, `countCells`. All pure; inputs are never mutated.
- `guards.ts` — hand-rolled type guards (`isPattern`, `isProject`,
  `isStitchGrid`, `isProgressGrid`, `isPaletteEntry`, `isStitchCell`, …). Each
  narrows `unknown` and validates structural invariants (including that a grid's
  runs cover exactly `width * height` cells).
- `serialization.ts` — `serializePattern`/`deserializePattern` and the `Project`
  equivalents. Deserialization parses JSON and runs the matching guard, throwing
  `DomainParseError` on malformed input — no silent coercion.

## No schema library (by design)

Validation is hand-rolled rather than delegated to a schema library (zod, io-ts,
etc.). The model is small and the guards keep the dependency surface flat;
adding a schema library would be flagged in review before introducing it.
