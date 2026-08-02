# Sprint 2 Retrospective — Internal / AgentOps

**Audience:** internal. Items needing stakeholder sign-off are flagged **[needs approval]**.
**Sprint:** 2 — Phase 1 Data & Persistence. **Delivery:** 5 planned stories, 1 unplanned story, 1 defect. Goal met.

---

## What went well

- **Tests found real bugs before the stakeholder did.** Not a formality this sprint. The chunking suite caught a truncation hole where missing trailing chunks were undetectable. The debounce suite caught three defects in the flush scheduler, including one that silently swallowed every write after the first batch. All three read correctly on the page.
- **Design-before-code held on the expensive decisions.** ADR-004 and ADR-005 were both signed off before implementation. Both would have been costly to reverse afterwards, and neither needed reversing.
- **Verifying against the emulator paid for itself immediately.** The Firestore nested-array constraint would have been discovered at runtime otherwise, after the schema was already in use.
- **Cost guardrail respected throughout.** Everything stayed on the Spark free tier. The write-budget problem was identified from the documented quota during design, not after hitting it.

## What created friction

1. **Dependency drift, three times.** `expo install --fix` once, `expo prebuild` twice. Each silently edited `package.json` and broke CI on a lockfile mismatch. One attempted fix (`git checkout package.json`) reverted three legitimately added dependencies along with the drift, because the branch had no commits protecting them.

2. **Node version mismatch between local and CI.** Local ran Node 24 / npm 11, CI ran Node 20 / npm 10. The two resolve platform-specific optional dependencies differently, so a lockfile generated locally was rejected by `npm ci`. This surfaced three separate times and was misdiagnosed twice as ordinary drift before the `EBADENGINE` warning was read properly.

3. **Work left uncommitted for hours.** #26 existed only as working-tree changes across a full session and an overnight break. Any of the recovery commands run during that window could have destroyed it.

4. **Files landed in the wrong directory twice.** Emulator tests under `lib/firestore/__tests__/` instead of `firestore-tests/`, where the config would never have run them. A merge resolution pasted into `app/(app)/_layout.tsx` instead of `app/_layout.tsx`.

5. **Chained commands ran after a failed commit.** `git commit && git push && gh pr create` created two empty PRs when the pre-commit hook rejected the commit, producing a confusing "no commits between develop and branch" error that took several cycles to trace back to formatting.

6. **Environment rot blocked progress repeatedly.** CocoaPods was five years old, Java was absent for the emulator, and Xcode had no iOS simulator runtime. Each stopped work cold and none was code-related.

7. **A silent defect survived a full sprint.** #38 shipped in Sprint 1 marked verified on three platforms. An unauthenticated cold start showed a white screen with no error. Sprint 1 verification ran under Expo Go, which SDK 56 no longer supports on physical iOS devices, and the first real development build exposed it.

## Root causes

- Items 1, 2, and 3 share a shape: **the toolchain was never pinned, and work was not protected early.** A version mismatch that produces a valid-looking lockfile is invisible until CI rejects it.
- Item 7 is about **what "verified" means.** It meant a working session on a hot-reloaded, already-signed-in app. It did not mean a cold start on a real build as a new user.

## Action items

**Already applied this sprint:**
- `.nvmrc` plus an `engines` field in `package.json`, with CI reading `node-version-file`. Ends item 2 permanently.
- `maxWorkers: 1` for emulator tests, after two suites sharing one emulator wiped each other's data mid-run.
- A regression test mounting the root layout unauthenticated, closing the specific gap behind item 7.

**Proposed instruction edits, none applied without approval:**

1. **[needs approval]** After any `expo` command that can modify `package.json` (`install --fix`, `prebuild`, `run:ios`, `run:android`), run `git diff package.json` before committing and revert unintended version changes.
2. **[needs approval]** Commit work in progress before running any environment or build command. Never leave a story as uncommitted working-tree changes across a session boundary.
3. **[needs approval]** Run `git commit`, `git push`, and `gh pr create` as separate commands. Chaining them causes later commands to run after a hook rejects the commit.
4. **[needs approval]** A story's cross-platform verification means a **cold start on a development build as a new, signed-out user**, not a hot reload of an existing session. State explicitly in the PR which of those was done.

**Process note, no instruction change:** local environment prerequisites (Node 24, CocoaPods 1.13+, Java for the Firestore emulator, an Xcode iOS simulator runtime) should be documented in the README. Three separate sessions stalled on these.

## Carry-forward into Sprint 3

- **Sequencing is the main risk, not code quality.** Two sprints produced roughly 4,000 lines of tested but unreachable code. Sprint 3 should open with a vertical slice that renders a pattern on screen, before more infrastructure.
- #30 sync foundation, deferred from Sprint 2, should follow the slice rather than precede it. Sync is worth more once there is something visible to sync.
- Android still has no manual device verification.
- Branch protection on `develop` and `main` remains unconfirmed.
