#!/usr/bin/env bash
# Sprint 1 — Issue creation
#
# Creates all 10 Sprint 1 Issues on the stitchmap-mobile Project board, in the Backlog lane.
# Run ONCE after stakeholder approval of sprint-1-plan.md and sprint-1-stories.md.
#
# Requires: gh CLI authenticated with repo + project scope.
# Verify auth scope first:  gh auth status
# If 'project' scope missing:  gh auth refresh -s project
#
# Usage:  bash create-sprint-1-issues.sh
#
# This script is NOT committed to the repo. Discard after use; the canonical
# story spec lives in docs/sprints/sprint-1-stories.md.

set -euo pipefail

REPO="csnizik/stitchmap-mobile"
PROJECT="@stitchmap-mobile"
LABEL="story"

confirm() {
  read -r -p "Create all 10 Sprint 1 Issues on $REPO and add to project '$PROJECT'? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
}

create_issue() {
  local title="$1"
  local body="$2"
  echo ">> Creating: $title"
  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --label "$LABEL" \
    --project "$PROJECT" \
    --body "$body"
}

confirm

# --- Story 1 -----------------------------------------------------------------
create_issue \
  "[Sprint 1] As a developer, I want a universal Expo SDK 56 TypeScript scaffold" \
  "## Story
As a developer, I want a universal Expo SDK 56 TypeScript project scaffold, so that the team has a working multi-platform baseline.

## Acceptance Criteria
- [ ] Expo SDK 56 project initialized via create-expo-app with the TypeScript template
- [ ] TypeScript strict mode enabled in tsconfig.json
- [ ] New Architecture and Hermes V1 confirmed enabled
- [ ] App boots on iOS simulator, Android emulator, and web
- [ ] Initial home screen displays a placeholder
- [ ] .gitignore covers node_modules, .expo, dist, env files, build artifacts
- [ ] README updated with prerequisites and quick-start

## Definition of Done
- [ ] Acceptance criteria demonstrably met
- [ ] Tests written and passing in CI
- [ ] PR approved by SM/TL
- [ ] QA verified (if invoked)
- [ ] Documentation updated where applicable
- [ ] No new defects introduced
- [ ] No cost incurred without prior stakeholder approval

## Specialists Invoked
None.

## Story Size
M

## Dependencies
None.

## Sprint
1"

# --- Story 2 -----------------------------------------------------------------
create_issue \
  "[Sprint 1] As a developer, I want lint/format/commit-message standards enforced locally" \
  "## Story
As a developer, I want lint, format, and commit-message standards enforced locally, so that code quality stays consistent without manual review of trivia.

## Acceptance Criteria
- [ ] ESLint configured with Expo + TypeScript + React Native rules
- [ ] Prettier configured for TS, JS, MD, JSON, YAML
- [ ] commitlint configured with conventional commits ruleset
- [ ] Husky pre-commit (lint + format check) and commit-msg (commitlint) hooks
- [ ] Scripts: lint, lint:fix, format, format:check, typecheck
- [ ] README documents the commit message convention

## Definition of Done
- [ ] Acceptance criteria demonstrably met
- [ ] Tests written and passing in CI
- [ ] PR approved by SM/TL
- [ ] Documentation updated where applicable
- [ ] No new defects introduced
- [ ] No cost incurred without prior stakeholder approval

## Specialists Invoked
None.

## Story Size
S

## Dependencies
Story 1.

## Sprint
1"

# --- Story 3 -----------------------------------------------------------------
create_issue \
  "[Sprint 1] As a team, we want CI running on every PR to develop" \
  "## Story
As the team, we want CI running on every PR to develop, so that DoD checks (lint, typecheck, test) are automated and consistent.

## Acceptance Criteria
- [ ] .github/workflows/ci.yml triggers on PR to develop and push to main
- [ ] Jobs: install (with cache), then lint/typecheck/test in parallel
- [ ] Uses ubuntu-latest (free tier)
- [ ] Fails fast on any check failure
- [ ] Each run completes in <= 5 minutes
- [ ] Stakeholder configures branch protection requiring CI status checks (manual UI action, documented)

## Definition of Done
- [ ] Acceptance criteria demonstrably met
- [ ] Documentation updated where applicable
- [ ] No new defects introduced
- [ ] No cost incurred without prior stakeholder approval

## Specialists Invoked
None.

## Story Size
S

## Dependencies
Stories 1, 2, 6, 8.

## Cost Flag
GitHub Actions free tier — well under 2000 min/mo. No incursion.

## Sprint
1"

# --- Story 4 -----------------------------------------------------------------
create_issue \
  "[Sprint 1] As a user, I want the app to gate protected content behind sign-in" \
  "## Story
As a user, I want the app to gate protected content behind sign-in, so that unauthenticated visitors only see the auth screens.

## Acceptance Criteria
- [ ] Expo Router installed and configured
- [ ] Route structure: app/_layout.tsx, app/(auth)/_layout.tsx + login.tsx + register.tsx, app/(app)/_layout.tsx + index.tsx
- [ ] useAuth() stub returns { user: null, isLoading: false }
- [ ] Root layout redirects unauthenticated users to /login
- [ ] Authenticated users land on (app)/index
- [ ] Web URLs resolve on direct navigation; back/forward works
- [ ] Verified on iOS, Android, web

## Definition of Done
- [ ] Acceptance criteria demonstrably met
- [ ] Tests written and passing in CI
- [ ] PR approved by SM/TL
- [ ] Documentation updated where applicable
- [ ] No new defects introduced
- [ ] No cost incurred without prior stakeholder approval

## Specialists Invoked
- [x] UX

## Story Size
M

## Dependencies
Story 1.

## Sprint
1"

# --- Story 5 -----------------------------------------------------------------
create_issue \
  "[Sprint 1] As a developer, I want NativeWind configured for cross-platform styling" \
  "## Story
As a developer, I want NativeWind configured, so that styling works consistently across iOS, Android, and web with Tailwind-style utilities.

## Acceptance Criteria
- [ ] NativeWind v4 (or current stable) installed per Expo SDK 56 guide
- [ ] Metro and Babel configured for NativeWind
- [ ] tailwind.config.js with baseline design tokens (placeholder palette)
- [ ] className works on sample View/Text on iOS, Android, web
- [ ] ADR-001 in docs/decisions/

## Definition of Done
- [ ] Acceptance criteria demonstrably met
- [ ] PR approved by SM/TL
- [ ] Documentation updated where applicable
- [ ] No new defects introduced
- [ ] No cost incurred without prior stakeholder approval

## Specialists Invoked
- [x] UX

## Story Size
S

## Dependencies
Story 1.

## Sprint
1"

# --- Story 6 -----------------------------------------------------------------
create_issue \
  "[Sprint 1] As a developer, I want a Zustand + Immer state foundation in place" \
  "## Story
As a developer, I want a state-management foundation in place, so that stores can be added incrementally without bespoke wiring per store.

## Acceptance Criteria
- [ ] Zustand and Immer installed
- [ ] Canonical store pattern documented (lib/stores/exampleStore.ts)
- [ ] StorageAdapter interface defined in lib/storage/StorageAdapter.ts
- [ ] In-memory StorageAdapter stub provided
- [ ] Persistence middleware wired to accept StorageAdapter (no real persistence yet)
- [ ] Example store has passing unit test
- [ ] TS strict mode passes

## Definition of Done
- [ ] Acceptance criteria demonstrably met
- [ ] Tests written and passing in CI
- [ ] PR approved by SM/TL
- [ ] Documentation updated where applicable
- [ ] No new defects introduced
- [ ] No cost incurred without prior stakeholder approval

## Specialists Invoked
None.

## Story Size
S

## Dependencies
Stories 1, 8.

## Sprint
1"

# --- Story 7 -----------------------------------------------------------------
create_issue \
  "[Sprint 1] As a user, I want to register and sign in with email and password" \
  "## Story
As a user, I want to register and sign in with email and password, so that my account persists across devices.

## Acceptance Criteria
- [ ] Firebase JS SDK installed
- [ ] Firebase Auth initialized with AsyncStorage persistence on native, default on web
- [ ] Firebase config from env vars (EXPO_PUBLIC_FIREBASE_*) — no secrets in source
- [ ] useAuth() real implementation: { user, isLoading, signIn, signUp, signOut, error }
- [ ] Login screen with email/password, signInWithEmailAndPassword, errors surfaced
- [ ] Register screen with email/password + confirm, createUserWithEmailAndPassword, errors surfaced
- [ ] Logout from home screen
- [ ] Auth state drives (auth)/(app) redirect
- [ ] Verified on iOS, Android, web
- [ ] QA test plan delivered

## Definition of Done
- [ ] Acceptance criteria demonstrably met
- [ ] Tests written and passing in CI
- [ ] PR approved by SM/TL
- [ ] QA verified
- [ ] Documentation updated where applicable
- [ ] No new defects introduced
- [ ] No cost incurred without prior stakeholder approval

## Specialists Invoked
- [x] UX
- [x] QA
- [x] Backend

## Story Size
L

## Dependencies
Stories 1, 4, 5, 6, 8.

## Cost Flag
Firebase Spark (free) tier — Auth free to 50k MAU. No incursion. Stakeholder action required: create project + provide config.

## Sprint
1"

# --- Story 8 -----------------------------------------------------------------
create_issue \
  "[Sprint 1] As a developer, I want the test harness configured (jest-expo + RNTL)" \
  "## Story
As a developer, I want the test harness configured, so that unit and integration tests can be written from day one.

## Acceptance Criteria
- [ ] jest-expo preset configured in jest.config.js
- [ ] @testing-library/react-native installed
- [ ] Jest setup file configures matchers and global env
- [ ] Sample tests pass: one render test, one Zustand store test
- [ ] npm test runs and reports
- [ ] Scripts: test, test:watch, test:coverage

## Definition of Done
- [ ] Acceptance criteria demonstrably met
- [ ] Tests written and passing in CI
- [ ] PR approved by SM/TL
- [ ] Documentation updated where applicable
- [ ] No new defects introduced
- [ ] No cost incurred without prior stakeholder approval

## Specialists Invoked
- [x] QA

## Story Size
S

## Dependencies
Story 1.

## Sprint
1"

# --- Story 9 -----------------------------------------------------------------
create_issue \
  "[Sprint 1] As a developer, I want Sentry capturing errors from app start" \
  "## Story
As a developer, I want Sentry capturing errors from app start, so that production issues are surfaced.

## Acceptance Criteria
- [ ] @sentry/react-native installed with Expo config plugin
- [ ] Sentry init guarded by EXPO_PUBLIC_SENTRY_DSN — no DSN = no init, no crash
- [ ] app/_layout.tsx initializes Sentry when DSN present
- [ ] env.example documents required env vars
- [ ] Manual error capture verified in Sentry dashboard
- [ ] ADR-002 in docs/decisions/

## Definition of Done
- [ ] Acceptance criteria demonstrably met
- [ ] PR approved by SM/TL
- [ ] Documentation updated where applicable
- [ ] No new defects introduced
- [ ] No cost incurred without prior stakeholder approval

## Specialists Invoked
None.

## Story Size
S

## Dependencies
Story 1.

## Cost Flag
Sentry free tier — 5k errors/mo. No incursion. Stakeholder action required: create project + provide DSN.

## Sprint
1"

# --- Story 10 ----------------------------------------------------------------
create_issue \
  "[Sprint 1] As a team, we want EAS build pipeline skeleton in place" \
  "## Story
As the team, we want EAS configuration in place, so that builds can be triggered when the stakeholder explicitly approves.

## Acceptance Criteria
- [ ] eas.json with development, preview, production profiles
- [ ] Project linked to EAS (free tier, no auto-builds)
- [ ] .github/workflows/eas-build.yml gated behind workflow_dispatch with input stakeholder_approved='true' — refuses otherwise
- [ ] No actual builds run this sprint; gate verified by attempting refused run
- [ ] ADR-003 in docs/decisions/

## Definition of Done
- [ ] Acceptance criteria demonstrably met
- [ ] PR approved by SM/TL
- [ ] Documentation updated where applicable
- [ ] No new defects introduced
- [ ] No cost incurred without prior stakeholder approval

## Specialists Invoked
None.

## Story Size
S

## Dependencies
Story 1.

## Cost Flag
EAS free tier — 30 builds/mo. No builds this sprint. Stakeholder action required: eas init + Expo login.

## Sprint
1"

echo ""
echo "✓ All 10 Sprint 1 Issues created and added to project '$PROJECT'."
echo ""
echo "Next: review Issues on the Project board, then move them from Backlog → Ready"
echo "after the Sprint 1 Plan PR is merged to develop."
