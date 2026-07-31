# ADR-004: Domain model for patterns, progress, and all stitch types

**Status:** accepted
**Supersedes:** the model originally proposed in PR #31
**Blocks:** S2-3 (#27) Firestore schema and chunking, S2-4 (#28), S2-5 (#29)

## Why this replaces the original model

PR #31 modeled a cell as `ThreadKey | null` and progress as `Grid<boolean>`. That
represents full cross stitches and nothing else. Supporting fractional stitches,
french knots, and backstitch is not a widening of the cell type:

- A cell can hold more than one stitch (a three-quarter of one color plus a
  quarter of another is common), so a cell is a list, not a value.
- Backstitch runs along and across cell _edges_, between grid intersections. No
  cell-indexed structure can hold it at any cell type richness.
- Once a cell holds several stitches, per-cell boolean progress cannot express
  "the three-quarter is done, the quarter is not."

PR #31's serialization layer, guard style, `DomainParseError` handling, and test
structure are retained. `types.ts` and `grid.ts` were rewritten.

## Decisions taken at sign-off

1. **Cell interning: yes.** The grid stores integer indices into a per-pattern
   table of distinct cell contents.
2. **Petite stitches: deferred**, along with beads, sequins, lazy daisy, and
   other specialty stitches. All are additive later under the policy in section 5.
3. **Stitch ids: opaque.** Nothing parses them; imported patterns may carry ids
   from other tools.
4. **Strand counts: deferred.** Mixing strand counts by stitch type is a
   specialty technique and lands with the others.

## 1. Coordinate space

One space serves every layer.

- The chart is `width` x `height` **cells**. Cell `(x, y)` has `x` in
  `[0, width)`, `y` in `[0, height)`.
- **Intersections** are integer points `(x, y)` with `x` in `[0, width]` and `y`
  in `[0, height]`. There are `(width + 1) * (height + 1)` of them.
- A **cell center** is `(x + 0.5, y + 0.5)`. An **edge midpoint** is one integer
  and one half-step.

Point coordinates are constrained to multiples of `0.5` within the chart bounds.
That covers every position real stitches occupy: backstitch and long stitch run
intersection to intersection, french knots sit at intersections or cell centers,
beads sit at cell centers. Finer granularity would be a `schemaVersion` bump.

The payoff is that layers 2 and 3 need no per-stitch-kind geometry. Adding a new
specialty stitch later is a new `kind` value, not a new structure.

## 2. Layer 1: cell-occupying stitches

```ts
export type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

/** 'forward' is the '/' diagonal, 'backward' is the '\' diagonal. */
export type Slant = 'forward' | 'backward';

export type Placement =
  | { kind: 'full'; thread: ThreadKey }
  | { kind: 'half'; slant: Slant; thread: ThreadKey }
  | { kind: 'quarter'; corner: Corner; thread: ThreadKey }
  | { kind: 'threeQuarter'; corner: Corner; thread: ThreadKey };

/** Contents of one cell, in canonical order. An empty array is a blank cell. */
export type CellContent = readonly Placement[];
```

A discriminated union rather than an optional `orientation` field, so TypeScript
strict mode rejects `{ kind: 'full', corner: 'topLeft' }` at compile time.

`threeQuarter` carries only the corner of its quarter portion, because the corner
determines the half portion's slant: a quarter at `topLeft` or `bottomRight` sits
off the `\` diagonal, so the half must be `forward`, and vice versa. Storing both
would allow contradictory values.

Three-quarter is its own kind rather than a `half` plus a `quarter`, because
stitchers, charts, and thread estimation all treat it as one stitch. A cell can
still hold a separate `quarter` of a different thread alongside it.

## 3. Cell interning

The grid does not store `CellContent` values. It stores integer indices into a
per-pattern table of distinct cell contents.

```ts
cellContents: readonly CellContent[];   // index 0 is reserved for [] (blank)
cells: Grid<number>;                    // indices into cellContents
```

Rationale:

- **Size.** This sprint exists to fit inside the Firestore 1 MB document limit. A
  200x200 detailed chart runs roughly 4,000 runs after RLE. Storing inline cell
  objects costs about 45 bytes per run, or ~180 KB. Storing integers costs about
  15 bytes per run, or ~60 KB.
- **Equality.** RLE coalescing needs to know when two adjacent cells are equal.
  With indices that is integer comparison, and canonical ordering is enforced
  once, when the intern table is built, rather than everywhere.
- **Chunking.** The intern table and palette live in the parent pattern document.
  Chunks become pure integer runs that need no palette to be valid, which is
  exactly the property S2-3 wants.

Interning is only sound if equal cells produce equal keys, so contents are
canonicalised (sorted by a total order, exact duplicates dropped) before keying.
Keys are JSON tuples rather than delimited strings, so a thread key containing
punctuation cannot collide with a delimiter.

## 4. Row-bounded runs

Runs stop at row ends. The grid stores one run list per row.

```ts
export interface Run<T> {
  readonly value: T;
  readonly count: number;
}

export interface Grid<T> {
  readonly width: number;
  readonly height: number;
  /** rows.length === height; each row's counts sum to width. */
  readonly rows: readonly (readonly Run<T>[])[];
}
```

The cost of forbidding row-crossing runs is bounded and small: worst case
`height - 1` extra runs, so a 500x500 solid block goes from 1 run to 500 against
250,000 cells. What it buys:

- Chunking for S2-3 is `rows.slice(start, end)`. No run is split on write or
  re-coalesced on read, and no run is touched by two chunks at once.
- Chunks are genuinely independent, which is the precondition for lazy-loading
  only the visible region in Phase 2 rendering.
- `getCell` drops from O(all runs) to O(runs in that row), and row access for the
  renderer is O(1).
- The invariant is structural. It cannot be violated by construction rather than
  being caught by a validator.

## 5. Layers 2 and 3: line and point stitches

```ts
export interface Point {
  readonly x: number;
  readonly y: number;
}

export type LineStitchKind = 'backstitch' | 'straight';

export interface LineStitch {
  readonly id: StitchId;
  readonly kind: LineStitchKind;
  readonly from: Point;
  readonly to: Point;
  readonly thread: ThreadKey;
}

export type PointStitchKind = 'frenchKnot';

export interface PointStitch {
  readonly id: StitchId;
  readonly kind: PointStitchKind;
  readonly at: Point;
  readonly thread: ThreadKey;
}
```

Both are flat lists on the pattern, not cell-indexed. Stable ids exist because
Phase 3 selection, undo, park, and frog all need to address an individual stitch.
Ids are opaque: nothing parses them, and validation requires only a non-empty
string, so patterns imported from other tools keep their own identifiers.

### Extension policy

Deferred stitches (petite, beads, sequins, lazy daisy, couching, Smyrna) and
deferred attributes (strand counts) are **additive**. No structural change to
`Point`, `LineStitch`, `PointStitch`, `Placement`, or the coordinate space is
required for any of them. Petite is a new `Placement` member; beads and sequins
sit at cell centers as new `PointStitchKind` values; couching is a new
`LineStitchKind`; strand counts are optional fields.

Two categories, with different compatibility consequences:

| Change                                               | Compatibility                                                 | Version impact              |
| ---------------------------------------------------- | ------------------------------------------------------------- | --------------------------- |
| Adding an **optional field** (for example `strands`) | Backward compatible. Old readers ignore it.                   | None required.              |
| Adding a **new `kind`** (for example `bead`)         | **Not** backward compatible. Old readers cannot represent it. | Minor `schemaVersion` bump. |

The guards therefore tolerate unknown _properties_ but reject unknown _kinds_. A
reader that cannot represent a stitch must fail loudly rather than round-trip a
pattern while quietly deleting stitches it did not understand.

## 6. Progress model

```ts
export interface Project {
  readonly schemaVersion: SchemaVersion;
  readonly id: string;
  readonly patternId: string;
  readonly width: number;
  readonly height: number;
  /** Bitmask per cell over that cell's CellContent placements. 0 is untouched. */
  readonly cellProgress: Grid<number>;
  /** RLE over pattern.lines in order. */
  readonly lineProgress: readonly Run<boolean>[];
  /** RLE over pattern.points in order. */
  readonly pointProgress: readonly Run<boolean>[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

Cell progress is a bitmask, not a boolean, so each placement in a multi-stitch
cell is independently markable. Bit `i` corresponds to placement `i` of that
cell's content. An untouched chart is all zeros, which encodes to one run per
row, so compactness is preserved.

The limit is 32 placements per cell, because JavaScript bitwise operators are
32-bit. Real cells hold at most four. Exceeding it is a validation error, not
silent truncation. Every mask operation ends in `>>> 0`, because `1 << 31` is
negative as a signed int32, and `completeMask(32)` is special-cased because
`1 << 32` evaluates to `1`.

## 7. Derived counts

`completedCount` and `totalCount` are **removed** from `Project` and computed by
`summarizeProgress` instead. In the original model they were unchecked stored
fields, and the tests already disagreed with each other about the value for a
2x2 grid. Deriving them eliminates the drift rather than validating against it.
Both are O(runs), not O(cells). If profiling later shows a need, they can be
reintroduced as an explicitly-labelled cache.

## 8. Validation invariants

Enforced in `guards.ts`, each with a test.

**Pattern**

1. `cells.rows.length === height`, and every row's counts sum to `width`.
2. Every run count is a positive integer, and no two adjacent runs share a value.
3. `cellContents[0]` is `[]`. No other entry is `[]`, and no two entries are
   structurally equal.
4. Every index in `cells` is in range of `cellContents`.
5. Every `Placement.thread`, `LineStitch.thread`, and `PointStitch.thread` exists
   in `palette`, and palette keys are unique.
6. Every placement list is in canonical order with no exact duplicates, and holds
   at most 32 placements.
7. Every `Point` coordinate is a multiple of `0.5` and within bounds. Line
   stitches have `from !== to`.
8. Line and point ids are unique across both layers combined.
9. `PaletteEntry.color` matches `#rrggbb`.
10. Unknown `kind` values are rejected; unknown properties are tolerated.

**Project** 11. `width` and `height` match `cellProgress` dimensions; masks are integers in
`[0, 0xffffffff]`. 12. No mask sets a bit beyond the placement count of the cell content at that
position. Requires the pattern, so it lives in
`collectProjectAgainstPatternIssues`. 13. `lineProgress` and `pointProgress` totals match the pattern's list lengths.
Also a cross-document check.

Items 12 and 13 run wherever a project is loaded next to its pattern, which is
the repository layer in S2-4 and S2-5.

## 9. Implications for S2-3 (#27)

- The parent pattern document holds metadata, `palette`, `cellContents`, and the
  `lines` and `points` lists. It is small.
- Grid chunks are N-row slices of `cells.rows`, pure integer runs, independently
  valid. `chunkRows` and `joinChunks` are the primitives, and their round trip is
  covered by tests.
- `cellProgress` chunks identically, since it shares the row-bounded layout.
- `lines` and `points` can be large on a dense pattern and may need their own
  fixed-count chunking. S2-3 should size this rather than assume it fits.

## 10. Scope and sequencing

S2-1 stays a single L story (#25) but is materially larger than originally sized.
S2-6 sync foundation (#30) moves to Sprint 3 to hold the sprint chunk roughly
constant. S2-3, S2-4, and S2-5 all grow, since each now handles three layers
instead of one.
