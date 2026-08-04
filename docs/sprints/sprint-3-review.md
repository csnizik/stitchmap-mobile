# Sprint 3 Review — Phase 2: Workspace Rendering

**Project:** StitchMap Mobile
**Phase:** 2 — Workspace Rendering & Input
**Sprint goal:** Make the data layer visible and usable. Open a pattern, see it rendered, tap stitches to mark them, find the progress intact after a restart.
**Result:** ✅ **Goal met.** All four stories delivered, plus one defect fix.

---

## What shipped

| # | Story | What it means for the product |
|---|-------|-------------------------------|
| #42 | Vertical slice: seed, render, mark, persist | The app opens a pattern, draws it, and marks stitches that survive a restart. First time any of the Sprint 2 data layer became reachable. |
| #43 | Pan and zoom | The chart pans and zooms on touch and trackpad, and taps still land on the right cell at any zoom. |
| #44 | Rendering performance | A 200x200 chart went from unusable to workable. |
| #30 | Sync foundation | Signing in pulls the account's patterns and projects. Progress written on one device reaches the server. |
| #38 | Defect: white screen on cold start | Fixed a routing deadlock that showed a blank screen to every signed-out user. |

---

## What you can do now

Sign in, and the app opens a cross-stitch chart. Pan and zoom it. Tap a cell to mark it stitched, tap again to clear. Kill the app, relaunch, and the work is still there. Progress reaches the account within a few seconds.

**This was verified end to end against the live database**, not the emulator: marking a stitch on the simulator and watching the value change in the Firebase console.

That is the first time this project has done something a stitcher would recognise as the app.

---

## The number worth knowing

**Rendering a 200x200 chart went from roughly 1 fps to 19-23 fps during a pan.** A 500x500 chart previously hung hard enough to need two emulator restarts.

19-23 is not 60, and it ships anyway. It is usable, 200x200 is the stated ceiling rather than a midpoint, and the remaining cost sits in territory where the next moves are all substantial and speculative. The decision to accept it and move on was deliberate and is recorded in the PR.

---

## Two things that cost real time

**A test fixture that could not test the feature.** The committed sample is 8x8. On a desktop screen it fits at high magnification, which made zoom appear broken for most of a day while the code was working correctly. Three real bugs did surface from the chase, but the lesson was about the fixture.

The fix shipped with #44: a generator that builds realistic charts at any size, deterministically, plus an in-app size picker and frame-rate readout. Both are development-only and compiled out of release builds. Deleting them would mean rebuilding them the next time anyone touches rendering.

**A defect that had been live since Sprint 1.** #38 showed a blank screen to any user who was not already signed in, silently, with no error. It shipped marked verified on three platforms. What "verified" means has since been tightened, and a regression test now covers it.

---

## Known gaps

- **No way to sign out.** Sprint 1's home screen had a logout button; #42 replaced that screen and did not carry it over. Filed.
- **Android is unverified** across all four stories. The code paths are identical to iOS, but it needs its own development build.
- **Deprecated Skia path calls** warn on every render of a large chart. Cosmetic, filed.
- Fractional stitch geometry is still deliberately rough: quarters draw as squares rather than true corner triangles.

---

## Decisions recorded

No new ADRs this sprint. Two decisions worth noting, both documented in PRs:

- The viewport transform lives **inside** Skia rather than on a wrapping view, which is what makes the surface screen-sized regardless of chart size and keeps culling possible.
- Rendering is **baked into pictures** rather than declared as elements, which is the change that made large charts workable.
