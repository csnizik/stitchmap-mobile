# ADR-005: Firestore schema, chunking, and security rules

**Status:** accepted
**Story:** S2-3 (#27). This is the sign-off gate for S2-4 (#28) and S2-5 (#29).
**Depends on:** ADR-004 domain model
**Tier:** Spark (free). Nothing here requires Blaze.

## The constraint that shapes everything

Firestore does not allow an array to contain another array. From the supported
data types reference: an array cannot contain another array value as one of its
elements. Nested _maps_ are fine; nested _arrays_ are not.

Two of our structures are arrays of arrays and therefore cannot be written as
native Firestore fields:

| Field                                    | Type             | Native?                             |
| ---------------------------------------- | ---------------- | ----------------------------------- |
| `Grid.rows`                              | `Run[][]`        | **No.** Array of arrays.            |
| `Pattern.cellContents`                   | `Placement[][]`  | **No.** Array of arrays.            |
| `Pattern.palette`                        | `PaletteEntry[]` | Yes. Array of flat maps.            |
| `Pattern.lines` / `points`               | `LineStitch[]`   | Yes. Array of maps containing maps. |
| `Project.lineProgress` / `pointProgress` | `Run<boolean>[]` | Yes. Array of flat maps.            |

Both non-native fields are stored as JSON strings. Nesting inside a string is
unconstrained, so this sidesteps the limit rather than working around it.

## 1. Collection layout

```
users/{uid}/
  patterns/{patternId}                 pattern metadata document
    chunks/{0000}                      N-row slices of the cell grid
    lineChunks/{0000}                  only when lines spill
    pointChunks/{0000}                 only when points spill

  projects/{projectId}                 project metadata document
    chunks/{0000}                      N-row slices of cellProgress
```

Everything a user owns lives under `users/{uid}`, which makes the security rules
a single match block.

### Pattern document

| Field                    | Type          | Notes                                          |
| ------------------------ | ------------- | ---------------------------------------------- |
| `schemaVersion`          | number        | From `SCHEMA_VERSION`.                         |
| `id`, `name`             | string        |                                                |
| `width`, `height`        | number        |                                                |
| `palette`                | array of maps | Native.                                        |
| `cellContents`           | string        | JSON. Array of arrays, so it cannot be native. |
| `lines`, `points`        | array of maps | Native, present only when not spilled.         |
| `linesCount`             | number        | Total lines, inline or chunked.                |
| `pointsCount`            | number        | Total points, inline or chunked.               |
| `linesChunkCount`        | number        | `0` when `lines` is inline.                    |
| `pointsChunkCount`       | number        | `0` when `points` is inline.                   |
| `cellChunkCount`         | number        | Number of documents in `chunks`.               |
| `createdAt`, `updatedAt` | string        | ISO 8601, matching the domain model.           |

Metadata lives in the parent so listing a user's patterns costs one read per
pattern and never touches a chunk.

### Chunk document

| Field      | Type   | Notes                                        |
| ---------- | ------ | -------------------------------------------- |
| `index`    | number | 0-based, matches the document ID.            |
| `startRow` | number | First row this chunk covers.                 |
| `rowCount` | number | Rows in this chunk. Variable, see section 3. |
| `data`     | string | JSON `number[][]`, see section 2.            |

`startRow` and `rowCount` are redundant with the ordered chunk sequence, but they
make a chunk self-describing, so a partial read is detectable rather than
silently misaligned.

Detecting a **truncated** sequence needs one more thing, found while testing:
chunks missing from the _end_ are still in order and still contiguous, so the
sequence alone cannot reveal them. Rejoining therefore takes the expected total
from the parent (`height` for grids, `linesCount` / `pointsCount` for lists) and
rejects a mismatch. That is why those counts are stored rather than derived.

### Project document

Mirrors the pattern: `schemaVersion`, `id`, `patternId`, `width`, `height`,
`lineProgress` and `pointProgress` as native arrays, `progressChunkCount`, and
timestamps. Progress chunks share the row-bounded layout, so a chunk of
`cellProgress` covers the same rows as the corresponding pattern chunk when the
budgets happen to align, though they are sized independently.

## 2. Grid encoding

Each chunk's `data` field is JSON of `number[][]`: one inner array per row,
holding flattened run pairs.

```
row runs [{value: 0, count: 40}, {value: 3, count: 2}]
encodes  [0, 40, 3, 2]

a 3-row chunk
         [[0,40,3,2],[0,42],[1,42]]
```

Flattening to pairs rather than serializing the `Run` objects is roughly a 4x
size reduction, because it drops the repeated `"value"` and `"count"` key text.

Decoding rebuilds `Run[]` per row and hands the result to `gridFromRows`, which
already validates that each row sums to `width`. No new validation path.

A denser binary encoding (varint, base64) would shrink this further. Not now:
JSON keeps chunks readable in the Firestore console during a phase where we are
still finding shape bugs, and section 4 shows we are nowhere near the limit for
realistic charts. Revisit only if measurement says otherwise.

## 3. Chunk sizing

Chunks are sized by **byte budget, not fixed row count**, because run density
varies enormously between a blank border row and a confetti row.

- **Budget: 200 KB of encoded `data` per chunk.** Roughly a fifth of the 1 MiB
  document limit.
- Rows are packed in order until adding the next row would exceed the budget.
- **A chunk always contains at least one row**, even if that row alone exceeds
  the budget. Otherwise the packer cannot make progress.
- If a single row exceeds **900 KB** encoded, the write is rejected with a clear
  error rather than producing a document Firestore will refuse. This is
  unreachable for any real chart, see section 4, but silent failure at the
  storage layer is worse than a loud one.

Why 200 KB rather than something closer to 1 MiB: the document limit counts field
names, the document path, and per-field overhead, not just the string. A 5x
margin means the encoding estimate never has to be exact.

**The implementation measures the actual encoded length rather than predicting
it.** Encode the row, check the length, decide. Estimation is for capacity
planning, not for the packing loop.

### Chunk document IDs

Zero-padded four digits: `0000`, `0001`, and so on. Firestore orders documents by
ID lexicographically, so unpadded IDs would sort chunk 10 before chunk 2. Four
digits caps a pattern at 10,000 chunks, which at 200 KB each is 2 GB, far beyond
any real chart. The cap is asserted on write.

### Lines and points

They stay inline in the parent document while small, and spill into
`lineChunks` / `pointChunks` under the same budget when they grow. The spill
threshold is 200 KB of encoded array, consistent with the grid budget.

`linesChunkCount` of `0` means inline. Readers branch on that, so the common
case costs no extra reads.

## 4. Budget math

Assumptions: run values are cell-content indices, typically under three digits;
counts under four digits. A run therefore costs about 8 characters of JSON
including separators.

| Chart                                     | Runs per row | Bytes per row | Total   | Chunks at 200 KB |
| ----------------------------------------- | ------------ | ------------- | ------- | ---------------- |
| 200x200 typical                           | 20           | ~165          | ~33 KB  | 1                |
| 200x200 confetti                          | 100          | ~810          | ~162 KB | 1                |
| 500x500 detailed                          | 60           | ~490          | ~245 KB | 2                |
| 1000x1000 detailed                        | 120          | ~970          | ~970 KB | 5                |
| 1000x1000 worst case, every cell distinct | 1000         | ~8 KB         | ~8 MB   | 40               |

The single-row ceiling is comfortable. Even a 10,000-stitch-wide row with every
cell distinct encodes to roughly 120 KB, well under the 900 KB rejection
threshold. That threshold exists for corrupt input, not for real charts.

Typical patterns fit in one chunk. Chunking is insurance for the large end, not
the common path.

## 5. Index exemptions

Firestore indexes every field by default. The `data` string and `cellContents`
are large, never queried, and never sorted on. Indexing them costs write
throughput and storage for nothing.

`firestore.indexes.json` carries single-field exemptions:

```json
{
  "indexes": [],
  "fieldOverrides": [
    { "collectionGroup": "chunks", "fieldPath": "data", "indexes": [] },
    { "collectionGroup": "lineChunks", "fieldPath": "data", "indexes": [] },
    { "collectionGroup": "pointChunks", "fieldPath": "data", "indexes": [] },
    { "collectionGroup": "patterns", "fieldPath": "cellContents", "indexes": [] }
  ]
}
```

## 6. Security rules

Auth scoping only. No shape validation.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Everything outside `users/{uid}` is denied, because there is no other match block
and Firestore denies by default.

Shape validation deliberately lives client-side in `guards.ts`. The rules
language cannot iterate arrays, so it could not check the row-sum invariant, the
canonical ordering, or the palette references even if we wanted it to. A partial
check in the place with the worse error messages would give false confidence.
The trade-off is explicit: a compromised client can write malformed data into its
own documents only, and `parsePattern` rejects it on read.

### Rules tests (emulator)

1. Signed-out reads and writes to any path are denied.
2. A user can read and write `users/{ownUid}/**`.
3. A user cannot read `users/{otherUid}/**`.
4. A user cannot write `users/{otherUid}/**`.
5. Chunk subcollections inherit the same scoping through the recursive wildcard.
6. Any path outside `users/` is denied for everyone.

## 7. Write protocol

A pattern write is one parent document plus N chunks. Firestore batches cap at
500 operations, so large writes span several batches and cannot be atomic.
Ordering makes partial failure safe rather than corrupt.

**Write order:**

1. Write all new chunk documents, in batches of up to 500.
2. Write the parent document, carrying `cellChunkCount`.
3. Delete stale chunks with `index >= cellChunkCount`, in batches.

**Why this order.** The parent is the commit point. If step 1 fails, the parent
either does not exist yet or still carries the old `chunkCount` pointing at the
old chunks, which are still intact. If step 3 fails, extra chunks linger beyond
`chunkCount` and are ignored by readers, so they are garbage rather than
corruption, and the next successful update cleans them.

**Read protocol:** fetch the parent, read `cellChunkCount`, fetch that many
chunks, verify the `index` and `startRow` sequence is complete and contiguous,
rejoin with `joinChunks`, then validate with `parsePattern`. A missing or
out-of-sequence chunk fails loudly.

## 8. Free tier budget

Spark allows 50,000 document reads, 20,000 writes, and 1 GiB storage per day.

**Reads are comfortable.** Listing patterns costs one read each and touches no
chunks. Opening a typical pattern costs two reads, parent plus one chunk. Lazy
chunk loading in Phase 2 rendering keeps large charts cheap.

**Writes are the real constraint, and it lands on S2-5 and S2-6, not here.**
Under naive write-through, every stitch marked is one chunk write. A stitcher
marking 500 stitches in a session would spend 500 writes, so the daily cap is
roughly 40 sessions across all users. That is not survivable.

The schema supports the fix rather than implementing it: because progress is
chunked by rows, a debounced flush of many marks touches only the chunks whose
rows changed, usually one. **S2-5 and S2-6 must debounce progress writes rather
than writing per stitch.** Flagging it here so it is a known requirement before
those stories start, not a discovery after the quota is hit.

No spend is incurred by anything in this ADR. The emulator is local and free.

## 9. Emulator configuration

`firebase.json` gains a Firestore emulator entry with rules and indexes wired up,
so rule tests and repository tests in S2-4 and S2-5 run locally against real
Firestore semantics at no cost and with no network.

## 10. Decision on chunk size

**200 KB, approved at sign-off.** Larger chunks mean fewer reads per pattern but
more rewritten bytes per progress update; smaller chunks the reverse. 200 KB puts
typical patterns in a single chunk while the worst realistic case stays under
five. 50 KB was the alternative considered, optimising instead for progress write
cost. Revisit if S2-5 measurement shows progress writes dominating.
