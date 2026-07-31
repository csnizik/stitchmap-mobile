# Sprint 2 Stories — Phase 1: Data & Persistence

Revised after ADR-004. Five stories in Sprint 2; S2-6 moved to Sprint 3.
Story numbers are not issue numbers; the issue number is given for each.

---

## S2-1 — Domain model & types (issue #25)

### Story
As a developer, I want canonical, typed data models covering every stitch type,
so that storage, sync, and rendering all share one source of truth.

### Acceptance Criteria
- [x] Three stitch layers modelled: cell-occupying placements (full, half,
      quarter, three-quarter), line stitches (backstitch, straight), and point
      stitches (french knot).
- [x] One shared coordinate space where integers are grid intersections and
      half-steps are cell centres, so line and point stitches need no
      per-kind geometry.
- [x] Cells hold a list of placements, not a single thread, so multi-colour
      fractional cells are representable.
- [x] Row-bounded run-length encoded grid, with chunk slice and rejoin
      primitives that the Firestore chunking strategy depends on.
- [x] Cell interning: the grid stores indices into a per-pattern table of
      distinct cell contents, with index 0 reserved for blank.
- [x] Progress is a per-cell bitmask over that cell's placements, so each stitch
      in a shared cell is independently markable. Line and point progress are
      RLE boolean lists.
- [x] `schemaVersion` on both `Pattern` and `Project`.
- [x] Counts derived rather than stored, removing the drift risk.
- [x] Guards enforce every invariant in ADR-004 section 8, including palette
      reference validation across all three layers and rejection of unknown
      stitch kinds.
- [x] Serialization with `DomainParseError` carrying every failed invariant.
- [x] Opaque stitch ids.
- [x] Tests covering the above, including 32-bit mask edge cases and the chunk
      round trip.
- [x] `docs/data-model.md` and `docs/decisions/adr-004-domain-model.md`.

### Definition of Done
Standing DoD. Types and pure functions only; no runtime backends, so there is no
cross-platform smoke test for this story.

### Specialists Invoked
- [x] Backend  - [x] QA  - [ ] UX

### Story Size
XL (grew from M at ADR-004 sign-off)

### Dependencies
None (foundation for the rest of the sprint).

### Cost Flag
None.

### Deferred (additive later, per ADR-004)
Petite stitches, beads, sequins, lazy daisy, couching, per-stitch strand counts.

---

## S2-2 — Real StorageAdapter backends (issue #26)

### Story
As a developer, I want real local-storage backends behind the existing
`StorageAdapter`, so that data persists on device and in the browser without
per-store platform code.

### Acceptance Criteria
- [ ] Native backend implemented with MMKV and/or expo-sqlite; web backend with
      IndexedDB — all behind the existing `StorageAdapter` interface, selected at
      runtime via the abstraction (no scattered `Platform.OS` checks).
- [ ] `InMemoryStorageAdapter` retained for tests.
- [ ] Dependencies added via `npx expo install`.
- [ ] Native backends require a development build, not Expo Go. Document this,
      and note that Expo Go no longer supports SDK 56 on physical iOS devices.
- [ ] Tests run without native modules or network (InMemory or mocked); any
      native-backed checks are noted as manual.
- [ ] Verified on iOS, Android, and web.

### Definition of Done
Standing DoD, including the cross-platform note.

### Specialists Invoked
- [x] Backend  - [x] QA  - [ ] UX

### Story Size
L

### Dependencies
S2-1 (#25).

### Cost Flag
None (libraries are free and SDK-pinned; a local dev build costs nothing).

---

## S2-3 — Firestore schema, security rules & chunking (issue #27) *(sign-off gate)*

### Story
As the backend owner, I want a per-user Firestore schema with owner-scoped
security rules and a chunking strategy for large patterns, so that data syncs
safely within the 1 MB document limit.

### Acceptance Criteria
- [ ] Schema: `users/{uid}/patterns/{patternId}` holds metadata, `palette`,
      `cellContents`, `lines`, and `points`; grid data is split into
      `users/{uid}/patterns/{patternId}/chunks/{chunkId}` as N-row slices;
      `users/{uid}/projects/{projectId}` holds progress, chunked the same way.
- [ ] Chunks are pure integer runs and remain valid without the palette, per
      ADR-004 section 9. Use `chunkRows` and `joinChunks` from `lib/domain`.
- [ ] Size the `lines` and `points` lists against the 1 MB limit and decide
      whether they need their own fixed-count chunking. Do not assume they fit.
- [ ] `firestore.rules`: a user may read and write only their own
      `users/{uid}/**`; everything else denied. Rules covered by emulator tests.
- [ ] Chunk-size calculation and reassembly order documented in an ADR.
- [ ] Firebase emulator config committed for local rule and repository testing.
- [ ] Stays on Spark (free) tier — no Blaze.
- [ ] **Schema signed off before S2-4 and S2-5 build on it.**

### Definition of Done
Standing DoD + rules tested on the emulator + ADR recorded + schema signed off.

### Specialists Invoked
- [x] Backend  - [x] QA  - [ ] UX

### Story Size
L

### Dependencies
S2-1 (#25).

### Cost Flag
Firestore Spark free tier; emulator is local and free. No spend.

---

## S2-4 — Pattern repository (issue #28)

### Story
As a user, I want my patterns saved on my device and to my account, so that they
persist and are available when I sign in elsewhere.

### Acceptance Criteria
- [ ] `PatternRepository`: create, get, list, update, delete.
- [ ] Local-first: writes hit the `StorageAdapter` immediately, then write
      through to Firestore (chunked per S2-3).
- [ ] Read path rejoins chunks and validates with `parsePattern` before use.
- [ ] All three stitch layers round-trip intact.
- [ ] Seed/sample pattern(s) exercising fractional stitches, backstitch, and a
      french knot, since import is deferred.
- [ ] Tests against InMemory and the Firestore emulator.

### Definition of Done
Standing DoD.

### Specialists Invoked
- [x] Backend  - [x] QA  - [ ] UX

### Story Size
L

### Dependencies
S2-1 (#25), S2-2 (#26), S2-3 (#27, signed off).

### Cost Flag
Firestore Spark free tier. No spend.

---

## S2-5 — Project / progress repository (issue #29)

### Story
As a user, I want my stitching progress saved on my device and to my account, so
that I never lose where I am in a project.

### Acceptance Criteria
- [ ] `ProjectRepository`: create a project from a pattern, get, list, update
      progress, delete.
- [ ] Progress persisted as the bitmask grid plus the two boolean run lists.
- [ ] Local-first with write-through to Firestore.
- [ ] On load, run `collectProjectAgainstPatternIssues` (ADR-004 items 12 and 13)
      so a project can never reference a stitch its pattern does not have.
- [ ] Tests against InMemory and the emulator.

### Definition of Done
Standing DoD.

### Specialists Invoked
- [x] Backend  - [x] QA  - [ ] UX

### Story Size
L

### Dependencies
S2-1 (#25), S2-2 (#26), S2-3 (#27, signed off).

### Cost Flag
Firestore Spark free tier. No spend.

---

## S2-6 — Sync foundation (issue #30) — MOVED TO SPRINT 3

Deferred at ADR-004 sign-off to hold the Sprint 2 chunk roughly constant after
the domain model grew. Carried forward unchanged: hydrate local stores from
Firestore on sign-in, write-through on change, with offline queueing and conflict
resolution explicitly out of scope.

Depends on S2-4 (#28) and S2-5 (#29).
