# Sprint 2 Review — Phase 1: Data & Persistence

**Project:** StitchMap Mobile
**Phase:** 1 — Data & Persistence
**Sprint goal:** Define the core data model and make it persist. Real local storage behind the `StorageAdapter`, plus a Firestore foundation for per-user patterns and projects, with the 1 MB document limit handled by design.
**Result:** ✅ **Goal met.** All five stories delivered, plus one unplanned story and one defect fix.

---

## What shipped

| # | Story | What it means for the product |
|---|-------|-------------------------------|
| #25 | Domain model, all stitch types | Patterns can represent every stitch a real chart uses: full, half, quarter, and three-quarter stitches, backstitch, straight stitch, and french knots. A single cell can hold several stitches of different threads. Progress tracks each stitch in a cell independently. |
| #27 | Firestore schema, rules, chunking | Patterns of any size fit in Firestore despite its 1 MB per-document limit. Each user can read and write only their own data, verified against the emulator. |
| #28 | Pattern repository | Patterns save to the device and sync to the account. A failed sync leaves the local copy intact. |
| #29 | Project repository | Stitching progress saves and syncs, with writes batched so a long session does not exhaust the free Firestore tier. |
| #26 | MMKV and IndexedDB backends | Data actually persists: MMKV on phones, IndexedDB in the browser. Verified surviving a full app restart. |
| #36 | Emulator tests for the pattern store | The Firestore write protocol is verified against real Firestore rather than assumed. |
| #38 | Defect: white screen on cold start | Fixed a routing deadlock that showed a blank screen to any user who was not already signed in. |

---

## The significant decision this sprint

**All stitch types, no compromise.** Mid-sprint, the original cell model turned out to represent only full cross stitches. Supporting fractional stitches and backstitch was not a small extension: backstitch runs along cell edges rather than inside cells, so no cell-based structure could hold it.

The stakeholder call was to support everything properly rather than defer. That produced ADR-004 and a three-layer model, and roughly tripled the size of the first story.

**This was the right call and the right time to make it.** The alternative would have had to be torn out in Phase 3 anyway, after patterns already existed in the database.

Deferred as genuinely additive, requiring no structural change: petite stitches, beads, sequins, lazy daisy, couching, and per-stitch strand counts.

---

## What you can do now

Nothing new in the interface. The app still opens to sign-in and a near-empty shell.

Everything above is foundation: 262 automated tests plus emulator tests, all passing, and none of it visible to a user yet. Making it visible is Sprint 3.

---

## Honest assessment

**The data layer is complete and well tested, and no user can reach any of it.** Two sprints in, the demo is still a login screen.

That is the main risk carried into Sprint 3, and it shapes the plan: the next sprint starts with a vertical slice that puts a pattern on screen, rather than another layer of infrastructure.

---

## Decisions recorded

- **ADR-004** — three-layer stitch model, row-bounded run-length encoding, cell interning, progress bitmasks, derived counts
- **ADR-005** — Firestore schema, 200 KB chunk budget, owner-scoped security rules, write protocol

---

## Carried into Sprint 3

- **#30 Sync foundation** — deferred from this sprint to hold the sprint size roughly constant after the scope change
- Android has no manual device verification yet; the code path is identical to iOS
- Branch protection requiring CI checks on `develop` and `main` is still unconfirmed
- Sprint 1 review and retro documents were written but never committed
