#!/usr/bin/env bash
#
# create-sprint-2-issues.sh
# Bulk-creates the Sprint 2 (Phase 1: Data & Persistence) stories as GitHub issues.
#
# Requirements: GitHub CLI (`gh`) installed and authenticated for the repo.
# Run ONCE — re-running creates duplicate issues.
#
#   chmod +x create-sprint-2-issues.sh
#   ./create-sprint-2-issues.sh

set -uo pipefail

REPO="csnizik/stitchmap-mobile"
LABEL="story"

# Optional GitHub Project to file issues under. If your project's built-in
# "auto-add to project" workflow already files new repo issues into Backlog,
# leave this empty. If you set it and gh can't resolve it, the script keeps the
# issue (it just won't be added to the board) and prints a warning.
PROJECT="stitchmap-mobile"

# Ensure the `story` label exists (created in Sprint 1; harmless no-op if present).
gh label create "$LABEL" --repo "$REPO" --color 0E8A16 --description "User story" 2>/dev/null \
  || true

created=0
failed=0

create_issue () {
  local title="$1"
  local body="$2"
  local args=(--repo "$REPO" --title "$title" --body "$body" --label "$LABEL")
  if [[ -n "$PROJECT" ]]; then
    args+=(--project "$PROJECT")
  fi

  echo ">> Creating: $title"
  if gh issue create "${args[@]}"; then
    created=$((created + 1))
  elif [[ -n "$PROJECT" ]]; then
    # Most likely the --project flag couldn't resolve; retry without it so the
    # issue still gets created, then warn.
    echo "   (retrying without --project)"
    if gh issue create --repo "$REPO" --title "$title" --body "$body" --label "$LABEL"; then
      created=$((created + 1))
      echo "   WARN: created but not added to project '$PROJECT' — add it to the board manually."
    else
      failed=$((failed + 1))
      echo "   ERROR: failed to create '$title'"
    fi
  else
    failed=$((failed + 1))
    echo "   ERROR: failed to create '$title'"
  fi
}

create_issue "[Sprint 2] Domain model & types for patterns, palettes, and projects" "$(cat <<'EOF'
## Story
As a developer, I want canonical, typed data models for patterns, palettes, and projects, so that storage, sync, and UI all share one source of truth.

## Acceptance Criteria
- [ ] TypeScript types for `Pattern` (id, name, width×height in stitches, palette reference, grid representation), `PaletteEntry`/`ThreadKey` (symbol, color, thread brand/code, label), `Project`/progress (id, patternId, per-cell completed state, counts, timestamps), and `StitchCell` state.
- [ ] Grid representation chosen to support chunking and compact storage (e.g. row-major with run-length encoding); the choice is documented.
- [ ] Serialization/deserialization helpers with hand-rolled type guards (no new dependencies; do not add a schema library without flagging it).
- [ ] Unit tests for guards and round-trip serialization.
- [ ] Short data-model note added under `docs/`.

## Definition of Done
Standing DoD. No runtime backends required — this is types + pure functions.

## Specialists Invoked
- [x] Backend
- [ ] QA
- [ ] UX

## Story Size
M

## Dependencies
None (foundation for the rest of the sprint).

## Cost Flag
None.

## Sprint
2
EOF
)"

create_issue "[Sprint 2] Real StorageAdapter backends (MMKV/expo-sqlite, IndexedDB)" "$(cat <<'EOF'
## Story
As a developer, I want real local-storage backends behind the existing StorageAdapter, so that data persists on device and in the browser without per-store platform code.

## Acceptance Criteria
- [ ] Native backend implemented with MMKV and/or expo-sqlite; web backend with IndexedDB — all behind the existing `StorageAdapter` interface, selected at runtime via the abstraction (no scattered `Platform.OS` checks).
- [ ] `InMemoryStorageAdapter` retained for tests.
- [ ] Dependencies added via `npx expo install`; native backends documented as requiring a dev build (not Expo Go).
- [ ] Tests run without native/network (InMemory or mocked); any native-backed checks are noted as manual.
- [ ] Verified on iOS, Android, and web.

## Definition of Done
Standing DoD, including the cross-platform note.

## Specialists Invoked
- [x] Backend
- [x] QA
- [ ] UX

## Story Size
L

## Dependencies
S2-1.

## Cost Flag
None (libraries are free, SDK-pinned).

## Sprint
2
EOF
)"

create_issue "[Sprint 2] Firestore schema, security rules, and grid chunking" "$(cat <<'EOF'
## Story
As the backend owner, I want a per-user Firestore schema with owner-scoped security rules and a chunking strategy for large pattern grids, so that data syncs safely within the 1 MB document limit.

## Acceptance Criteria
- [ ] Schema: `users/{uid}/patterns/{patternId}` (metadata) with grid data split into `users/{uid}/patterns/{patternId}/chunks/{chunkId}` (N-row chunks, each well under 1 MB); `users/{uid}/projects/{projectId}`.
- [ ] `firestore.rules`: a user may read/write only their own `users/{uid}/**`; everything else denied. Rules covered by emulator tests.
- [ ] Chunk-size calculation vs. the 1 MB limit and reassembly order documented in an ADR.
- [ ] Firebase emulator config committed for local rule/repository testing.
- [ ] Stays on Spark (free) tier — no Blaze.
- [ ] Backend Specialist sign-off on the schema before the repository stories (S2-4/S2-5) build on it.

## Definition of Done
Standing DoD + rules tested on the emulator + ADR recorded + schema signed off.

## Specialists Invoked
- [x] Backend
- [x] QA
- [ ] UX

## Story Size
L

## Dependencies
S2-1.

## Cost Flag
Firestore Spark free tier; emulator is local/free. No spend.

## Sprint
2
EOF
)"

create_issue "[Sprint 2] Pattern repository (local + Firestore)" "$(cat <<'EOF'
## Story
As a user, I want my patterns saved on my device and to my account, so that they persist and are available when I sign in elsewhere.

## Acceptance Criteria
- [ ] `PatternRepository`: create, get, list, update, delete.
- [ ] Local-first: writes hit the `StorageAdapter` immediately, then write through to Firestore (chunked per S2-3).
- [ ] Read path reassembles chunks into the in-memory grid.
- [ ] Seed/sample pattern(s) provided to exercise the path (import is deferred).
- [ ] Tests against InMemory and the Firestore emulator.

## Definition of Done
Standing DoD.

## Specialists Invoked
- [x] Backend
- [x] QA
- [ ] UX

## Story Size
L

## Dependencies
S2-1, S2-2, S2-3.

## Cost Flag
Firestore Spark free tier. No spend.

## Sprint
2
EOF
)"

create_issue "[Sprint 2] Project/progress repository (local + Firestore)" "$(cat <<'EOF'
## Story
As a user, I want my stitching progress saved on my device and to my account, so that I never lose where I am in a project.

## Acceptance Criteria
- [ ] `ProjectRepository`: create a project from a pattern, get, list, update progress, delete.
- [ ] Per-cell completed state stored compactly, consistent with the pattern grid representation; chunked if needed.
- [ ] Local-first with write-through to Firestore.
- [ ] Tests against InMemory and the emulator.

## Definition of Done
Standing DoD.

## Specialists Invoked
- [x] Backend
- [x] QA
- [ ] UX

## Story Size
M

## Dependencies
S2-1, S2-2, S2-3.

## Cost Flag
Firestore Spark free tier. No spend.

## Sprint
2
EOF
)"

create_issue "[Sprint 2] Sync foundation (hydrate on sign-in, write-through)" "$(cat <<'EOF'
## Story
As a user, I want my data to load when I sign in and save as I work, so that my patterns and progress follow my account across devices.

## Acceptance Criteria
- [ ] On sign-in, hydrate local stores from Firestore (pattern/project metadata; grid chunks lazy-loaded on demand).
- [ ] Write-through: local changes push to Firestore.
- [ ] Offline queueing and conflict resolution are explicitly out of scope and documented as such; the app must not crash when offline or unconfigured — local data still works.
- [ ] Tests against the emulator.

## Definition of Done
Standing DoD.

## Specialists Invoked
- [x] Backend
- [x] QA
- [ ] UX

## Story Size
M

## Dependencies
S2-4, S2-5.

## Cost Flag
Firestore Spark free tier. No spend.

## Sprint
2
EOF
)"

echo
echo "Done. Created: $created  Failed: $failed"
if [[ "$failed" -ne 0 ]]; then
  exit 1
fi
