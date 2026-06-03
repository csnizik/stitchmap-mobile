# Sprint 1 — Story Drafts

Canonical snapshot of the ten Sprint 1 stories at the moment of commitment. Issues created on the Project board mirror this content; if Issue bodies drift over time, this file is the original spec.

Each story below maps to one Issue using [`.github/ISSUE_TEMPLATE/user_story.md`](../../.github/ISSUE_TEMPLATE/user_story.md).

---

## Story 1 — Universal Expo SDK 56 Scaffold

**As a** developer, **I want** a universal Expo SDK 56 TypeScript project scaffold, **so that** the team has a working multi-platform baseline.

### Acceptance Criteria

- [ ] Expo SDK 56 project initialized via `create-expo-app` with the TypeScript template
- [ ] TypeScript strict mode enabled in `tsconfig.json`
- [ ] New Architecture and Hermes V1 confirmed enabled (SDK 56 defaults — verify and document in README)
- [ ] App boots successfully on iOS simulator, Android emulator, and web (`npx expo start`)
- [ ] Initial home screen displays a placeholder ("StitchMap Mobile" + app version pulled from `app.json`)
- [ ] `.gitignore` includes: `node_modules/`, `.expo/`, `dist/`, `*.env`, `.env.local`, build artifacts (`ios/`, `android/` if not using prebuild), `.DS_Store`
- [ ] README updated with prerequisites, install steps, and `npm run` script reference

### Size

M

### Dependencies

None.

### Specialists Invoked

None.

### Cost Flag

None.

---

## Story 2 — Linting, Formatting, Conventional Commits

**As a** developer, **I want** lint, format, and commit-message standards enforced locally, **so that** code quality stays consistent without manual review of trivia.

### Acceptance Criteria

- [ ] ESLint configured with Expo + TypeScript + React Native rules
- [ ] Prettier configured for TS, JS, MD, JSON, YAML
- [ ] commitlint configured with the conventional commits ruleset
- [ ] Husky installed with `pre-commit` hook running `npm run lint && npm run format:check` and `commit-msg` hook running commitlint
- [ ] Scripts in `package.json`: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`
- [ ] README section documents the commit message convention (with examples)

### Size

S

### Dependencies

Story 1.

### Specialists Invoked

None.

### Cost Flag

None.

---

## Story 3 — CI Workflow

**As** the team, **we want** CI running on every PR to `develop`, **so that** DoD checks (lint, typecheck, test) are automated and consistent.

### Acceptance Criteria

- [ ] `.github/workflows/ci.yml` triggers on `pull_request` to `develop` and `push` to `main`
- [ ] Jobs run in this order: `install` (with npm cache), then `lint`, `typecheck`, `test` (in parallel)
- [ ] Uses `ubuntu-latest` runner (free tier)
- [ ] Fails fast on any check failure
- [ ] Each CI run completes in ≤ 5 minutes (verified against a sample PR)
- [ ] Stakeholder action documented in sprint plan: configure branch protection on `develop` and `main` requiring CI status checks (cannot be automated; requires GitHub UI)

### Size

S

### Dependencies

Stories 1, 2, 6, 8 (CI needs lint, typecheck, and test to all exist).

### Specialists Invoked

None.

### Cost Flag

GitHub Actions free tier — 2,000 min/mo for private repos. Estimated Sprint 1 CI usage: ~50–100 min total. No incursion.

---

## Story 4 — Expo Router with Auth/App Route Groups (stub auth)

**As a** user, **I want** the app to gate protected content behind sign-in, **so that** unauthenticated visitors only see the auth screens.

### Acceptance Criteria

- [ ] Expo Router installed and configured
- [ ] File-based routing structure created:
  - `app/_layout.tsx` (root layout with auth redirect logic)
  - `app/(auth)/_layout.tsx`, `app/(auth)/login.tsx`, `app/(auth)/register.tsx`
  - `app/(app)/_layout.tsx`, `app/(app)/index.tsx` (home placeholder)
- [ ] `useAuth()` hook stub in `lib/auth/useAuth.ts` returns `{ user: null, isLoading: false }` (real impl arrives in Story 7)
- [ ] Root layout reads `useAuth()` and redirects unauthenticated users to `/login`
- [ ] Authenticated users (when stub is manually toggled to return a user) land on `(app)/index`
- [ ] Web URLs resolve correctly on direct navigation (`/login`, `/register`)
- [ ] Browser back/forward works on web
- [ ] Tested on iOS, Android, and web

### Size

M

### Dependencies

Story 1.

### Specialists Invoked

UX (placeholder layout sketch for the protected shell and auth screens).

### Cost Flag

None.

---

## Story 5 — NativeWind Styling Foundation

**As a** developer, **I want** NativeWind configured, **so that** styling works consistently across iOS, Android, and web with Tailwind-style utilities.

### Acceptance Criteria

- [ ] NativeWind v4 (or current stable) installed per the Expo SDK 56 setup guide
- [ ] Metro and Babel configured for NativeWind
- [ ] `tailwind.config.js` includes the `app/` directory and configures a baseline design token set (colors, spacing, typography — placeholder palette; finalized in a later sprint by UX)
- [ ] `className` works on a sample `<View>` and `<Text>` on iOS, Android, and web
- [ ] ADR-001 created in `docs/decisions/ADR-001-styling-with-nativewind.md` capturing the choice and alternatives considered (StyleSheet, Tamagui, Restyle)

### Size

S

### Dependencies

Story 1.

### Specialists Invoked

UX (baseline token set).

### Cost Flag

None.

---

## Story 6 — Zustand + Immer State Foundation

**As a** developer, **I want** a state-management foundation in place, **so that** stores can be added incrementally without bespoke wiring per store.

### Acceptance Criteria

- [ ] Zustand and Immer installed
- [ ] Canonical store pattern documented (`lib/stores/exampleStore.ts`): typed state, typed actions, Immer middleware
- [ ] `StorageAdapter` interface defined in `lib/storage/StorageAdapter.ts` — methods: `getItem`, `setItem`, `removeItem`, `clear` (real implementations deferred to a later sprint)
- [ ] In-memory `StorageAdapter` stub provided for the interim
- [ ] Persistence middleware wired to accept a `StorageAdapter` instance (no real persistence yet; just the wiring)
- [ ] Example store has a passing unit test demonstrating state updates and actions
- [ ] TS strict mode passes

### Size

S

### Dependencies

Stories 1, 8.

### Specialists Invoked

None.

### Cost Flag

None.

---

## Story 7 — Firebase Auth — Real Sign-In

**As a** user, **I want** to register and sign in with email and password, **so that** my account persists across devices.

### Acceptance Criteria

- [ ] Firebase JS SDK installed
- [ ] Firebase Auth initialized with AsyncStorage persistence on native (`initializeAuth` + `getReactNativePersistence`), default persistence on web
- [ ] Firebase config loaded from env vars (`EXPO_PUBLIC_FIREBASE_*`) — no secrets in source
- [ ] `useAuth()` hook from Story 4 replaced with real implementation: returns `{ user, isLoading, signIn, signUp, signOut, error }`
- [ ] Login screen: email + password fields, submit calls `signInWithEmailAndPassword`, errors surfaced clearly
- [ ] Register screen: email + password fields (with confirm), submit calls `createUserWithEmailAndPassword`, errors surfaced clearly
- [ ] Logout works from the home screen
- [ ] Auth state drives the `(auth)`/`(app)` redirect logic
- [ ] Verified on iOS, Android, and web
- [ ] QA test plan delivered covering: successful login, wrong password, unregistered email, network failure, logout, persistence across app restart

### Size

L

### Dependencies

Stories 1, 4, 5, 6, 8.

### Specialists Invoked

UX (login/register screen UX), QA (auth flow test plan), Backend (Firebase project + Auth config).

### Cost Flag

**Firebase Spark (free) tier — Authentication free up to 50k MAU.** No incursion.

**Stakeholder action required:** Create Firebase project on Spark tier, enable Email/Password Auth provider, provide Firebase config values via secure channel. No credit card on file required.

---

## Story 8 — Test Harness — jest-expo + RNTL

**As a** developer, **I want** the test harness configured, **so that** unit and integration tests can be written from day one.

### Acceptance Criteria

- [ ] `jest-expo` preset configured in `jest.config.js`
- [ ] `@testing-library/react-native` installed
- [ ] Jest setup file configures matchers and global test environment
- [ ] Sample tests pass: one component render test, one Zustand store test (the Story 6 example store)
- [ ] `npm test` runs the suite and reports cleanly
- [ ] Test scripts in `package.json`: `test`, `test:watch`, `test:coverage`

### Size

S

### Dependencies

Story 1.

### Specialists Invoked

QA (test pattern guidance).

### Cost Flag

None.

---

## Story 9 — Sentry Error Tracking

**As a** developer, **I want** Sentry capturing errors from app start, **so that** production issues are surfaced.

### Acceptance Criteria

- [ ] `@sentry/react-native` installed with the Expo config plugin
- [ ] Sentry initialization guarded by env var `EXPO_PUBLIC_SENTRY_DSN` — no DSN = no init, app does not crash
- [ ] `app/_layout.tsx` initializes Sentry on boot when DSN is present
- [ ] `env.example` file documents required env vars
- [ ] Manual error capture verified in dev — a temporary `Sentry.captureException` lands in the Sentry dashboard
- [ ] ADR-002 created in `docs/decisions/ADR-002-error-tracking-with-sentry.md`

### Size

S

### Dependencies

Story 1.

### Specialists Invoked

None.

### Cost Flag

**Sentry free tier — 5k errors/mo, 10k performance events/mo.** Adequate for development. No incursion.

**Stakeholder action required:** Create Sentry account + project for `stitchmap-mobile`, provide DSN. No credit card on file required.

---

## Story 10 — EAS Build Pipeline Skeleton

**As** the team, **we want** EAS configuration in place, **so that** builds can be triggered when the stakeholder explicitly approves.

### Acceptance Criteria

- [ ] `eas.json` configured with `development`, `preview`, and `production` profiles
- [ ] Project linked to EAS (free tier, no auto-builds)
- [ ] `.github/workflows/eas-build.yml` workflow created, gated behind `workflow_dispatch` with required input `stakeholder_approved` (must equal the string `"true"` to proceed); workflow refuses and exits non-zero otherwise
- [ ] No actual EAS builds run during this sprint — the gate is documented and verified by attempting a run without approval and confirming refusal
- [ ] ADR-003 created in `docs/decisions/ADR-003-eas-build-pipeline.md` documenting the gate, profiles, and free-tier limits

### Size

S

### Dependencies

Story 1.

### Specialists Invoked

None.

### Cost Flag

**EAS free tier — 30 builds/mo across iOS + Android.** No builds run in this sprint. Future builds require stakeholder approval per the workflow gate.

**Stakeholder action required:** Expo account (free), `eas init` to link this repo. No credit card on file required.
