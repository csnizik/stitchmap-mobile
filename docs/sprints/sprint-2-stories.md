# Sprint 2 Stories — Phase 1: Data & Persistence

Six stories, ~25 points. Each is written in the repo issue-template shape and is
ready to become a GitHub issue. Story # is not the eventual issue/PR #.

---

## S2-1 — Domain model & types

### Story
As a developer, I want canonical, typed data models for patterns, palettes, and
projects, so that storage, sync, and UI all share one source of truth.

### Acceptance Criteria
- [ ] TypeScript types for `Pattern` (id, name, width×height in stitches, palette
      reference, grid representation), `PaletteEntry`/`ThreadKey` (symbol, color,
      thread brand/code, label), `Project`/progress (id, patternId, per-cell
      completed state, counts, timestamps), and `StitchCell` state.
- [ ] Grid representation chosen to support chunking and compact storage (e.g.
      row-major with run-length encoding); the choice is documented.
- [ ] Serialization/deserialization helpers with hand-rolled type guards (no new
      dependencies; do not add a schema library without flagging it).
- [ ] Unit tests for guards and round-trip serialization.
- [ ] Short data-model note added under `docs/`.

### Definition of Done
Standing DoD. No runtime backends required — this is types + pure functions.

### Specialists Invoked
- [x] Backend  - [ ] QA  - [ ] UX

### Story Size
M

### Dependencies
None (foundation for the rest of the sprint).

### Cost Flag
None.

### Sprint
2

---

## S2-2 — Real StorageAdapter backends

### Story
As a developer, I want real local-storage backends behind the existing
`StorageAdapter`, so that data persists on device and in the browser without
per-store platform code.

### Acceptance Criteria
- [ ] Native backend implemented with MMKV and/or expo-sqlite; web backend with
      IndexedDB — all behind the existing `StorageAdapter` interface, selected at
      runtime via the abstraction (no scattered `Platform.OS` checks).
- [ ] `InMemoryStorageAdapter` retained for tests.
- [ ] Dependencies added via `npx expo install`; native backends documented as
      requiring a dev build (not Expo Go).
- [ ] Tests run without native/network (InMemory or mocked); any native-backed
      checks are noted as manual.
- [ ] Verified on iOS, Android, and web.

### Definition of Done
Standing DoD, including the cross-platform note.

### Specialists Invoked
- [x] Backend  - [x] QA  - [ ] UX

### Story Size
L

### Dependencies
S2-1.

### Cost Flag
None (libraries are free, SDK-pinned).

---

## S2-3 — Firestore schema, security rules & chunking  *(sign-off gate)*

### Story
As the backend owner, I want a per-user Firestore schema with owner-scoped
security rules and a chunking strategy for large pattern grids, so that data
syncs safely within the 1 MB document limit.

### Acceptance Criteria
- [ ] Schema: `users/{uid}/patterns/{patternId}` (metadata) with grid data split
      into `users/{uid}/patterns/{patternId}/chunks/{chunkId}` (N-row chunks, each
      well under 1 MB); `users/{uid}/projects/{projectId}`.
- [ ] `firestore.rules`: a user may read/write only their own `users/{uid}/**`;
      everything else denied. Rules covered by emulator tests.
- [ ] Chunk-size calculation vs. the 1 MB limit and reassembly order documented in
      an ADR.
- [ ] Firebase emulator config committed for local rule/repository testing.
- [ ] Stays on Spark (free) tier — no Blaze.
- [ ] **Backend Specialist sign-off on the schema before S2-4/S2-5 build on it.**

### Definition of Done
Standing DoD + rules tested on the emulator + ADR recorded + schema signed off.

### Specialists Invoked
- [x] Backend  - [x] QA  - [ ] UX

### Story Size
L

### Dependencies
S2-1.

### Cost Flag
Firestore Spark free tier; emulator is local/free. No spend.

---

## S2-4 — Pattern repository (local + Firestore)

### Story
As a user, I want my patterns saved on my device and to my account, so that they
persist and are available when I sign in elsewhere.

### Acceptance Criteria
- [ ] `PatternRepository`: create, get, list, update, delete.
- [ ] Local-first: writes hit the `StorageAdapter` immediately, then write through
      to Firestore (chunked per S2-3).
- [ ] Read path reassembles chunks into the in-memory grid.
- [ ] Seed/sample pattern(s) provided to exercise the path (import is deferred).
- [ ] Tests against InMemory and the Firestore emulator.

### Definition of Done
Standing DoD.

### Specialists Invoked
- [x] Backend  - [x] QA  - [ ] UX

### Story Size
L

### Dependencies
S2-1, S2-2, S2-3.

### Cost Flag
Firestore Spark free tier. No spend.

---

## S2-5 — Project / progress repository

### Story
As a user, I want my stitching progress saved on my device and to my account, so
that I never lose where I am in a project.

### Acceptance Criteria
- [ ] `ProjectRepository`: create a project from a pattern, get, list, update
      progress, delete.
- [ ] Per-cell completed state stored compactly, consistent with the pattern grid
      representation; chunked if needed.
- [ ] Local-first with write-through to Firestore.
- [ ] Tests against InMemory and the emulator.

### Definition of Done
Standing DoD.

### Specialists Invoked
- [x] Backend  - [x] QA  - [ ] UX

### Story Size
M

### Dependencies
S2-1, S2-2, S2-3.

### Cost Flag
Firestore Spark free tier. No spend.

---

## S2-6 — Sync foundation

### Story
As a user, I want my data to load when I sign in and save as I work, so that my
patterns and progress follow my account across devices.

### Acceptance Criteria
- [ ] On sign-in, hydrate local stores from Firestore (pattern/project metadata;
      grid chunks lazy-loaded on demand).
- [ ] Write-through: local changes push to Firestore.
- [ ] Offline queueing and conflict resolution are explicitly **out of scope** and
      documented as such; the app must not crash when offline or unconfigured —
      local data still works.
- [ ] Tests against the emulator.

### Definition of Done
Standing DoD.

### Specialists Invoked
- [x] Backend  - [x] QA  - [ ] UX

### Story Size
M

### Dependencies
S2-4, S2-5.

### Cost Flag
Firestore Spark free tier. No spend.
