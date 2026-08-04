# Sprint 3 Retrospective — Internal / AgentOps

**Audience:** internal. Items needing stakeholder sign-off are flagged **[needs approval]**.
**Sprint:** 3 — Phase 2 Workspace Rendering. **Delivery:** 4 stories, 1 defect. Goal met.

---

## What went well

- **The vertical slice paid for itself.** Opening with #42 rather than more infrastructure surfaced four integration problems in one story: a sync failure blanking the screen, a crash on the signed-out frame, taps not working on web, and MMKV breaking unrelated test suites. Each would have been found later and more expensively.
- **Tests caught bugs that read correctly.** An infinite hydration loop (3,539 attempts), a stale-state toggle in the workspace test, and three defects in the flush scheduler last sprint. None were visible by inspection.
- **The Skia risk was retired before anything was built on it.** #42's first three acceptance criteria were `expo-doctor` and a trivial canvas. Had Skia not worked on SDK 56, that would have surfaced in an hour rather than after a sprint of rendering work.
- **A performance decision was made on measurement rather than instinct.** Culling was planned and then dropped: 4x the cells cost 17% more frame time, so cell count was no longer the constraint. The reasoning is recorded so nobody redoes it.

## What created friction

1. **A day lost to a fixture, not a bug.** Zoom appeared broken on web for most of a session. The cause was an 8x8 sample fitting a desktop window at scale 5.5, leaving a zoom range of 5.5 to 6. Several rounds of changes were made to code that was working. Three real bugs did fall out of the chase, but the time was disproportionate.

2. **Repeated blind diagnosis.** More than once, a diagnostic `console.log` was placed inside a function that was never called, and the resulting silence was read as evidence. This happened with the workspace render logs, the layout logs, and the bake counters. Each cost a full round trip.

3. **Environment problems outnumbered code problems.** A stale Metro process on port 8081 held a bad file index for an entire debugging session while every `--clear` started a *different* server. CocoaPods was five years old. Xcode had no simulator runtime. `onLayout` does not fire reliably on react-native-web. Deleting `ios/build` broke the native build because codegen output lived there.

4. **Lint rules that do not model the libraries.** React Compiler's immutability rule cannot express reanimated shared values, where mutating `.value` is the entire API. Two structural workarounds were attempted before accepting a documented suppression. The set-state-in-effect rule was a legitimate catch; the immutability one was not.

5. **File placement errors.** A test landed in `lib/repositories/` instead of `__tests__/`, a `.ts` file needed to be `.tsx` for generics, then `.tsx` broke the same generics as JSX. Emulator tests landed under `lib/` where the config would never have run them.

## Root causes

- Items 1 and 2 share a shape: **acting on inference instead of evidence.** The fixture problem persisted because symptoms were plausible; the logging problem persisted because absence of output was treated as data without checking the log would run.
- Item 3 is not fixable by process. It is the cost of a native toolchain, and the useful response is to check environment state early rather than assume code is at fault.

## Action items

**Already applied this sprint:**
- A deterministic pattern generator and an in-app size picker with frame-rate readout, so rendering work has something real to measure against.
- A regression test for the root layout mounting unauthenticated.
- Root `__mocks__` for MMKV, and jest setup entries for Skia and Gesture Handler.

**Proposed instruction edits, none applied:**

1. **[needs approval]** When adding a diagnostic log, state which function it is inside and confirm that function runs on the path being tested. Silence from a log that never executes is not evidence.
2. **[needs approval]** Before debugging behaviour that looks wrong, confirm the fixture can demonstrate the behaviour. A test pattern that fits the viewport cannot exercise zoom; an empty list cannot exercise pagination.
3. **[needs approval]** When a symptom could be environmental, check for stale processes, cached state, and tool versions before changing code. Specifically: `lsof -i:8081` before trusting any Metro restart.

## Carry-forward into Sprint 4

- **No sign-out affordance.** Filed. Verifying auth currently requires uninstalling the app.
- **Android is unverified** across the whole sprint.
- **Deprecated Skia path API.** Filed. Warns on every bake.
- Rendering sits at 19-23 fps at 200x200 by decision. Two cheap experiments were identified and not run, recorded in the #44 PR.
- Branch protection requiring CI checks on `develop` and `main` remains unconfirmed. This has now been carried for three sprints.
