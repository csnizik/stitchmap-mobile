# Sprint 3 Stories — Phase 2: Workspace Rendering

Four stories, ~25 points. Written in the repo issue-template shape.

**S3-1 ships alone.** Nothing else starts until it merges.

---

## S3-1 — Vertical slice: seed, render, mark, persist

### Story
As a stitcher, I want to open the app and see my pattern on screen and tap
stitches to mark them done, so that the app does something useful for the first
time.

### Why this story exists
Sprints 1 and 2 built a complete data layer with no consumer. This story is the
first consumer. It deliberately spans domain, storage, repository, and UI so that
any mismatch between those layers surfaces now rather than after three more
stories are built on top.

Keep it thin. Anything not required to prove the path end to end belongs in a
later story.

### Acceptance Criteria

**Retire the Skia risk first**
- [ ] `npx expo-doctor` passes, or its warnings are reported in the PR.
- [ ] A trivial Skia canvas renders on an iOS development build and on web.
- [ ] **If Skia does not work on SDK 56, stop and flag it in the issue.** Do not
      work around it silently; the fallback is a stakeholder decision.

**Seed**
- [ ] On first launch after sign-in, the sample pattern is written through
      `PatternRepository` and a `Project` is created for it via
      `createEmptyProject`.
- [ ] Seeding is idempotent. Relaunching does not duplicate or reset progress.

**Render**
- [ ] The pattern renders as a grid using `@shopify/react-native-skia`, at a
      fixed zoom and position. Pan and zoom are S3-2.
- [ ] Each cell shows its thread colour from the palette. Blank cells are
      visibly blank.
- [ ] Completed stitches are visually distinct from incomplete ones.
- [ ] Fractional stitches (half, quarter, three-quarter) render in roughly the
      right part of the cell. Rough is acceptable here; refinement is a later
      story.
- [ ] Backstitch and french knots render. They sit on the shared coordinate
      space, so they draw over cell boundaries rather than inside cells.

**Mark**
- [ ] Tapping a cell marks every placement in it complete; tapping again clears
      it. Use `markCell` from `lib/domain/progress`.
- [ ] Tapping a blank cell does nothing and does not throw.
- [ ] The rendering updates immediately on tap.

**Persist**
- [ ] Progress saves through `ProjectRepository`, which debounces the remote
      write.
- [ ] `repo.flush()` is called when the app backgrounds and on sign-out. Without
      this the last few seconds of stitching never leave the device.
- [ ] Cold start restores the same progress.

**Verify**
- [ ] Cold start on an iOS development build as a signed-out user: sign in,
      pattern renders, mark stitches, kill the app, relaunch, progress intact.
- [ ] Same on web.
- [ ] Android stated explicitly as verified or not.

### Definition of Done
Standing DoD, including the cold-start verification rule.

### Specialists Invoked
- [x] UX  - [x] QA  - [ ] Backend

### Story Size
L

### Dependencies
#25, #26, #27, #28, #29 — all merged.

### Cost Flag
None. Skia is free; Firestore stays on Spark.

### Out of scope
Pan and zoom, performance work, per-placement marking, a pattern list, pattern
import, thread key or palette UI.

---

## S3-2 — Pan and zoom

### Story
As a stitcher, I want to pan and zoom the chart, so that I can work on a detailed
area and still get an overview.

### Acceptance Criteria
- [ ] Pinch to zoom and drag to pan, using `react-native-gesture-handler` and
      `react-native-reanimated`.
- [ ] Gestures run on the UI thread. Marking a stitch while zoomed still hits the
      correct cell.
- [ ] Zoom is clamped to sensible bounds: far enough out to see a 250x250 chart
      whole, far enough in to tap a single cell comfortably.
- [ ] Panning is bounded so the chart cannot be lost off screen.
- [ ] Tap-to-mark and pan are distinguishable. A drag does not mark a stitch.
- [ ] Works with a mouse and trackpad on web, not only touch.
- [ ] Cold start verification on iOS and web.

### Definition of Done
Standing DoD.

### Specialists Invoked
- [x] UX  - [x] QA  - [ ] Backend

### Story Size
L

### Dependencies
S3-1.

### Cost Flag
None.

---

## S3-3 — Rendering performance at real pattern sizes

### Story
As a stitcher with a large chart, I want panning and zooming to stay smooth, so
that the app is usable on the patterns I actually stitch.

### Why this is sized XL
The slice renders one small pattern naively. A 250x250 chart is 62,500 cells, and
redrawing all of them per frame will not hold a frame budget. This story is where
the rendering strategy from the original stack decision is actually implemented.

### Acceptance Criteria
- [ ] The static pattern is baked into a Skia `Picture` rather than redrawn per
      frame, with dynamic progress overlaid separately.
- [ ] Repeated elements draw via `drawAtlas` rather than individual draw calls.
- [ ] Only the visible region renders. Off-screen chunks are not drawn.
- [ ] Grid chunks load lazily from the repository as the viewport moves, using
      the chunk boundaries established in ADR-005.
- [ ] Marking a stitch does not re-bake the static layer.
- [ ] A generated 250x250 test pattern pans and zooms without visible stutter on
      an iOS device and on web. **State the observed frame rate in the PR**, not
      an impression.
- [ ] A generated 500x500 pattern still opens and remains usable, even if less
      smooth. Record the numbers.

### Definition of Done
Standing DoD plus stated frame-rate observations at both sizes.

### Specialists Invoked
- [x] QA  - [ ] UX  - [ ] Backend

### Story Size
XL

### Dependencies
S3-1, S3-2.

### Cost Flag
None.

---

## S3-4 — Sync foundation (issue #30)

### Story
As a stitcher, I want my patterns and progress to load when I sign in, so that my
work follows my account across devices.

### Note
Deferred from Sprint 2. Sequenced last here because sync is worth more once there
is something visible to sync, and it is the story most safely cut if the sprint
runs long.

### Acceptance Criteria
- [ ] On sign-in, local stores hydrate from Firestore using
      `syncIndexFromRemote` and `fetch` on both repositories.
- [ ] Grid chunks load lazily rather than eagerly on sign-in.
- [ ] Local changes write through, using the existing debounce for progress.
- [ ] Offline queueing and conflict resolution remain explicitly **out of
      scope**. The app must not crash when offline or unconfigured, and local
      data must keep working.
- [ ] A project loaded next to its pattern runs
      `collectProjectAgainstPatternIssues` so progress cannot reference a stitch
      the pattern lacks.
- [ ] Emulator tests for the hydrate path.
- [ ] Cold start verification on iOS and web.

### Definition of Done
Standing DoD.

### Specialists Invoked
- [x] Backend  - [x] QA  - [ ] UX

### Story Size
M

### Dependencies
S3-1.

### Cost Flag
Firestore Spark free tier. Watch the daily write quota during testing; the
debounce exists because of it.
