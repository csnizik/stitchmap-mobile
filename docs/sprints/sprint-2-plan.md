# Sprint 2 Plan — Phase 1: Data & Persistence

**Project:** StitchMap Mobile
**Phase:** 1 — Data & Persistence
**Depends on:** Sprint 1 (Phase 0) — complete.
**Revised:** scope grew after ADR-004. See "Scope change" below.

## Sprint goal

Define the core domain model and make it persist: real local storage behind the
existing `StorageAdapter`, plus a Firestore foundation for per-user patterns and
projects, with the 1 MB document limit handled by design. Local-first, with
write-through sync.

## Scope change (ADR-004)

The original S2-1 modeled a cell as one thread or blank. That represents full
cross stitches only. The stakeholder directed that the app must handle fractional
stitches, french knots, backstitch, and any other stitch type without compromise,
which required a three-layer model rather than a wider cell type.

Consequences:

- **S2-1 grew substantially** and remains a single story (#25).
- **S2-6 sync foundation moved to Sprint 3** (#30), to hold the sprint chunk
  roughly constant.
- **S2-3, S2-4, and S2-5 all grew**, since each now handles three stitch layers
  instead of one.
- Petite stitches, beads, sequins, lazy daisy, couching, and per-stitch strand
  counts are **deferred** and documented as additive in ADR-004.

## Scope decisions (approved)

- **Sync:** local-first with Firestore write-through. Offline queueing and
  conflict resolution are **out of scope** (deferred with S2-6 to Sprint 3).
- **Pattern import:** parsing real pattern file formats is **deferred**. This
  sprint uses seed/sample patterns to exercise the persistence path.
- **Firestore chunking:** N-row chunk documents under a parent pattern document,
  sized well under 1 MB, for stakeholder sign-off before the repository stories
  build on it.
- **Cost:** Firestore stays on the **Spark (free) tier** — no Blaze upgrade.
  Local emulator (free) is used for rules and repository tests. No spend.
- **Google sign-in:** **deferred** to the backlog.
- **Cell interning, opaque stitch ids:** approved at ADR-004 sign-off.

## Stories

| Issue | Story | Size | Status |
|---|---|---|---|
| #25 | S2-1 Domain model, all three stitch layers | XL | in review (PR #31) |
| #26 | S2-2 Real StorageAdapter backends | L | not started |
| #27 | S2-3 Firestore schema, rules, chunking | L | **sign-off gate** |
| #28 | S2-4 Pattern repository | L | blocked on #27 |
| #29 | S2-5 Project/progress repository | L | blocked on #27 |
| #30 | S2-6 Sync foundation | M | **moved to Sprint 3** |

## Sequencing / dependencies

1. **#25 Domain model** — foundation; everything depends on it.
2. **#26 Storage backends** and **#27 Firestore schema** — can run in parallel.
   **#27 is a sign-off gate:** the schema is approved before #28 and #29 build
   on it. Start #27 first, since it is the critical path.
3. **#28 Pattern repository** and **#29 Project repository** — need #25 and #27.

## Definition of Done (sprint)

Every story meets the standing DoD in `.github/copilot-instructions.md`. Firestore
work additionally requires: security rules tested against the emulator, chunking
documented in an ADR, and Backend Specialist sign-off on the schema.

## Exit criterion (Phase 1, revised)

A signed-in user's patterns and projects persist locally and write through to
Firestore (per-user, chunked, owner-scoped), survive an app restart, and load on
next sign-in — on iOS, Android, and web. All three stitch layers round-trip
intact. Seed data demonstrates the full path; import is deferred. Full
hydrate-on-sign-in sync lands in Sprint 3.

## Specialists

- **Backend Specialist** — heavy: Firestore schema, security rules, chunking
  (#27), plus repository persistence paths.
- **Developer** — domain model, storage backends, repositories.
- **QA** — emulator-based test plans for rules and repositories.
- **MLOps/AgentOps** — Sprint 1 retro instruction edits are applied and live on
  `develop`.
- **UX** — minimal this sprint (no new user-facing screens).

## Carry-forward

- Confirm branch protection requiring the CI checks on `develop` / `main`.
- Google sign-in logged as a backlog item.
- Expo Go no longer supports SDK 56 on physical iOS devices. A local development
  build is required for device testing, and #26's native backends will require
  one regardless. Costs nothing; needs a decision on whether `ios/` and
  `android/` are gitignored under continuous native generation.

## Ceremonies

Simulated per the operating model; only outputs surface. Stakeholder triggers each
boundary. No monetary cost proceeds without explicit stakeholder approval.
