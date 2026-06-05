# Sprint 2 Plan — Phase 1: Data & Persistence

**Project:** StitchMap Mobile
**Phase:** 1 — Data & Persistence
**Depends on:** Sprint 1 (Phase 0) — complete.

## Sprint goal

Define the core domain model and make it persist: real local storage behind the
existing `StorageAdapter`, plus a Firestore foundation for per-user patterns and
projects, with the 1 MB document limit handled by design. Local-first, with a
write-through sync foundation.

## Scope decisions (approved)

- **Sync:** local-first with simple Firestore write-through. Offline queueing and
  conflict resolution are **out of scope** this sprint (deferred to a later phase).
- **Pattern import:** parsing real pattern file formats is **deferred**. This sprint
  uses seed/sample patterns to exercise the persistence path.
- **Firestore chunking:** the Backend Specialist designs "split the grid into N-row
  chunk documents under a parent pattern document," sized well under 1 MB, for
  stakeholder sign-off before the repository stories build on it.
- **Cost:** Firestore stays on the **Spark (free) tier** — no Blaze upgrade. Local
  emulator (free) is used for rules/repository tests. No spend.
- **Google sign-in:** **deferred** to the backlog (out of Sprint 2).
- **Capacity:** ~25 story points.

## Capacity & sizing

Target ~25 points (≈ a 5-person, 2-week iteration in team-day-equivalents),
consistent with Sprint 1. Six stories; see `sprint-2-stories.md`.

## Sequencing / dependencies

1. **S2-1 Domain model** (foundation — everything depends on it)
2. **S2-2 Storage backends** and **S2-3 Firestore schema + rules** (parallel; S2-3
   is a **sign-off gate** — schema is approved before repositories build on it)
3. **S2-4 Pattern repository** and **S2-5 Project/progress repository** (need 1–3)
4. **S2-6 Sync foundation** (needs 4 and 5)

## Definition of Done (sprint)

Every story meets the standing DoD in `.github/copilot-instructions.md`. Firestore
work additionally requires: security rules tested against the emulator, chunking
documented in an ADR, and Backend Specialist sign-off on the schema.

## Exit criterion (Phase 1)

A signed-in user's patterns and projects persist locally and sync to Firestore
(per-user, chunked, owner-scoped), survive an app restart, and load on next
sign-in — on iOS, Android, and web. Seed data demonstrates the full path; import
is deferred.

## Specialists

- **Backend Specialist** — heavy: Firestore schema, security rules, chunking (S2-3),
  plus repository sync paths.
- **Developer** — domain model, storage backends, repositories.
- **QA** — emulator-based test plans for rules and repositories.
- **MLOps/AgentOps** — always engaged; the Sprint 1 retro instruction edits are
  applied to `.github/copilot-instructions.md` before work begins.
- **UX** — minimal this sprint (no new user-facing screens beyond what's needed to
  demonstrate persistence).

## Carry-forward from Sprint 1

- Approved retro instruction edits applied to `.github/copilot-instructions.md`
  (existing-PR check, boot-verification flag, merge-`develop`-before-review).
- Confirm branch protection requiring the CI checks on `develop` / `main`.
- Google sign-in logged as a backlog item.

## Ceremonies

Simulated per the operating model; only outputs surface. Stakeholder triggers each
boundary (Review → Retro → next planning). No monetary cost proceeds without
explicit stakeholder approval.
