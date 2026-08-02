# Sprint 3 Plan — Phase 2: Workspace Rendering

**Project:** StitchMap Mobile
**Phase:** 2 — Workspace Rendering & Input
**Depends on:** Sprint 2 (Phase 1) — complete.

## Sprint goal

Make the data layer visible and usable. A signed-in user opens a pattern, sees
it rendered, taps stitches to mark them complete, and finds their progress
intact after restarting the app.

## Why this sprint is shaped this way

Two sprints produced a complete, well-tested data layer that no user can reach.
Roughly 4,000 lines of code, 262 automated tests, and an app that still opens to
a sign-in screen and an empty shell.

That is the main risk carried into this sprint. Every interface built in Sprint 2
was designed for a consumer that did not exist yet, and each time two layers were
joined during that sprint, the join revealed something.

So **S3-1 is a vertical slice and it ships first, alone.** It touches domain,
storage, repository, and UI in one story. If those layers do not compose, that is
discovered in one story rather than after four more are built on top.

Nothing else starts until S3-1 merges.

## Scope decisions (approved)

- **Skia from the start.** The slice renders with `@shopify/react-native-skia`
  rather than plain React Native views. Views would be discarded work, and the
  performance story in S3-3 depends on Skia primitives.
- **Seed on first launch.** The sample pattern is written through
  `PatternRepository` on first run, which is also the shape real pattern import
  will take. No dev-only loader button.
- **No pattern list.** The app opens straight into the seeded pattern. A library
  screen is a separate story and proves nothing about the stack.
- **Tap marks a whole cell.** Tap to complete every placement in a cell, tap
  again to clear. Choosing *which* stitch in a shared cell is a Phase 3 tool.
- **#30 sync foundation stays in this sprint**, sequenced last.
- **Capacity: ~25 points.**

## Stories

| Issue | Story | Size | Blocks |
|---|---|---|---|
| TBD | S3-1 Vertical slice: seed, render, mark, persist | L | everything |
| TBD | S3-2 Pan and zoom | L | |
| TBD | S3-3 Rendering performance at real pattern sizes | XL | |
| #30 | S3-4 Sync foundation | M | |

## Sequencing

1. **S3-1 alone.** No parallel work. It is the risk reducer and the others build
   on whatever it establishes.
2. **S3-2 and S3-3** after it. S3-3 depends on S3-2, since viewport culling needs
   a viewport.
3. **#30 last.** Sync is worth more once there is something visible to sync, and
   it is the story most safely cut if the sprint runs long.

## Risk to retire first

**Skia compatibility with SDK 56 is unverified.** The locked stack names Skia,
but nothing has confirmed `@shopify/react-native-skia` against React Native 0.85
and the New Architecture, which is mandatory as of SDK 55.

The first task of S3-1 is `npx expo-doctor`, which now validates dependencies
against React Native Directory, plus a trivial Skia canvas rendered on a
development build on iOS and web.

**If Skia does not work on SDK 56, stop and flag it.** That is a stack decision
for the stakeholder, not something to work around silently. The fallback options,
in order of preference, are: pin to a working Skia version, render with plain
React Native views for the slice and revisit, or reconsider the rendering choice
in an ADR.

Do not begin the rest of S3-1 until a Skia canvas has been seen on a device.

## Definition of Done (sprint)

Standing DoD in `.github/copilot-instructions.md`, including the verification
rule: **cold start on a development build as a signed-out user**, with platform
exceptions stated explicitly.

Rendering stories additionally require a stated frame-rate observation on a
realistic pattern, not just "it looked smooth".

## Exit criterion (Phase 2)

On iOS and web, from a cold start: sign in, land on the seeded sample pattern
rendered as a grid, pan and zoom it, tap cells to mark and unmark stitches, kill
the app, relaunch, and find the same progress. A 250x250 pattern pans and zooms
without visible stutter.

## Specialists

- **UX** — heavy for the first time. Grid presentation, thread symbols, marked
  versus unmarked state, and what a partially completed cell looks like.
- **Developer** — Skia rendering, gestures, wiring the repositories to the UI.
- **QA** — cold start verification, performance observation at realistic sizes.
- **Backend Specialist** — light, only for #30.

## Carry-forward from Sprint 2

- Android has no manual device verification. Worth resolving during this sprint,
  since rendering performance is the area most likely to differ by platform.
- Branch protection requiring CI checks on `develop` and `main` is still
  unconfirmed.
- Local environment prerequisites are not in the README.

## Cost

Nothing in this sprint incurs cost. Skia is free, Firestore stays on Spark, and
device testing uses local development builds rather than EAS.
