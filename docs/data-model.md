# Data model

How StitchMap represents a pattern and a stitcher's progress through it.
Rationale and the full invariant list live in
`docs/decisions/adr-004-domain-model.md`. Everything here is exported from
`lib/domain`.

## The shape of it

A **pattern** is the chart. A **project** is one stitcher's progress through one
pattern. They are separate documents so the same pattern can back several
projects, and so progress writes never rewrite the chart.

Stitches fall into three groups with genuinely different geometry, so the model
has three layers.

| Layer | Examples | Where it lives |
|---|---|---|
| Cell-occupying | full cross, half, quarter, three-quarter | the cell grid |
| Line | backstitch, straight stitch | a flat list of point pairs |
| Point | french knot | a flat list of points |

Backstitch is why layers exist. It runs along cell *edges*, between grid
intersections, so no cell-indexed structure can hold it.

## Coordinates

One space serves all three layers:

- Integers are **grid intersections**: `(0, 0)` is the top-left corner of the
  chart, `(width, height)` the bottom-right.
- Half-steps are **cell centres** and **edge midpoints**: `(1.5, 2.5)` is the
  centre of cell `(1, 2)`.
- Coordinates must be multiples of `0.5` and within `[0, width]` by
  `[0, height]`.

So a backstitch under the top edge of cell `(0, 0)` is `from {x:0,y:0}` to
`{x:1,y:0}`, and a french knot in the middle of that cell is `{x:0.5,y:0.5}`.

Cells themselves are indexed `(x, y)` with `x` in `[0, width)`.

## Cells

A cell holds a list of placements, not a single thread, because real charts put
a three-quarter of one colour and a quarter of another in the same square.

```ts
type Placement =
  | { kind: 'full'; thread: ThreadKey }
  | { kind: 'half'; slant: 'forward' | 'backward'; thread: ThreadKey }
  | { kind: 'quarter'; corner: Corner; thread: ThreadKey }
  | { kind: 'threeQuarter'; corner: Corner; thread: ThreadKey };
```

`forward` is the `/` diagonal. For `threeQuarter`, only the quarter's corner is
stored; it determines the half's slant, so storing both could contradict.

An empty list is a blank cell.

## Two encodings you need to know about

### Run-length encoding, bounded to rows

Grids store runs, and **runs never cross a row boundary**:

```ts
interface Grid<T> {
  width: number;
  height: number;
  rows: Run<T>[][];   // rows.length === height, each row sums to width
}
```

This is what makes chunking safe. `sliceRows(grid, 4, 8)` is a valid standalone
grid, so a Firestore chunk needs no stitching back together beyond concatenation.
Use `chunkRows` and `joinChunks`.

### Cell interning

The grid does not store cell contents. It stores integers indexing
`pattern.cellContents`, a table of the distinct contents in that pattern.
Index `0` is always the blank cell.

```ts
const content = cellContentAt(pattern, x, y);   // resolves the index for you
```

Build a pattern's cell layer with `buildCellGrid(width, height, cells)`, which
interns and encodes in one step. It canonicalises each cell, so you can pass
placements in any order.

## Progress

Cell progress is a **bitmask per cell**, not a boolean, so each stitch in a
shared cell is independently markable. Bit `i` is placement `i` of that cell.
Zero means untouched, which is why a fresh project encodes to one run per row.

Line and point progress are run-length encoded boolean lists aligned to
`pattern.lines` and `pattern.points` by index.

```ts
let project = createEmptyProject({ id, pattern, now });
project = markPlacement(pattern, project, 1, 0, 1, true, now);  // one stitch
project = markCell(pattern, project, 1, 0, true, now);          // whole cell
project = markLine(project, 0, true, now);
```

Marking a placement that does not exist throws. Progress can never reference a
stitch that is not in the pattern.

There is no stored `completedCount`. Counts are derived:

```ts
const summary = summarizeProgress(pattern, project);
// { completed, total, cells: {...}, lines: {...}, points: {...} }
```

This is O(runs), not O(cells), and it cannot drift from the data.

## Validation

`isPattern` and `isProject` are type guards. When you want to know *why*
something failed, use the collectors, which return every problem rather than the
first:

```ts
const issues = collectPatternIssues(value);   // string[]
```

Some invariants need both documents (progress marking a stitch that does not
exist, list lengths matching). Those live in
`collectProjectAgainstPatternIssues(pattern, project)`, and the repository layer
runs them whenever a project is loaded alongside its pattern.

`parsePattern` and `parseProject` validate and throw `DomainParseError`, which
carries an `issues` array. Use them on anything crossing a storage boundary.
`serializePattern` validates on the way out too, so a corrupt in-memory pattern
fails before it reaches Firestore.

## Extending it

Deferred for now: petite stitches, beads, sequins, lazy daisy, couching, and
per-stitch strand counts. All are additive; none needs a structural change.

Two rules when you add one:

- **New optional field** (`strands`): backward compatible. Old readers ignore it.
- **New `kind`** (`bead`): not backward compatible. Bump `SCHEMA_VERSION`.

Guards tolerate unknown properties and reject unknown kinds, deliberately. A
reader that silently dropped a stitch it did not understand would corrupt a
pattern on round trip.

## Files

| File | Contents |
|---|---|
| `types.ts` | Every type and constant |
| `grid.ts` | RLE grid operations, chunking |
| `cells.ts` | Canonical ordering, interning |
| `progress.ts` | Bitmasks, mark operations, derived counts |
| `guards.ts` | Validation |
| `serialization.ts` | Parse and serialize, `DomainParseError` |
| `ids.ts` | Opaque stitch ids |
| `index.ts` | Public barrel |
