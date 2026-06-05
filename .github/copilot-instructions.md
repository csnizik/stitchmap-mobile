# Copilot Instructions — StitchMap Mobile

StitchMap Mobile is a universal cross-stitch pattern and progress-tracking app
that runs on iOS, Android, and web from a single Expo codebase.

When assigned an issue: implement it to satisfy the issue's Acceptance Criteria,
open a PR against `develop`, and request review. Don't prompt for confirmation
mid-task. If a requirement is genuinely ambiguous or blocked, stop and say so in
the PR rather than guessing.

## Stack — do not deviate without flagging it in the PR

- Expo SDK 56, React Native 0.85, React 19.2, New Architecture, Hermes
- TypeScript, strict mode
- Expo Router (file-based) for navigation
- NativeWind for styling
- Zustand + Immer for state
- Firebase JS SDK (NOT @react-native-firebase) for Auth + Firestore
- jest-expo + React Native Testing Library for tests
- Sentry (@sentry/react-native) for error tracking
- EAS for builds

All code must work on iOS, Android, and web. Platform-specific logic goes behind
an abstraction (e.g. a StorageAdapter interface), never scattered Platform.OS
checks.

## Hard guardrails

1. NO COST, EVER, WITHOUT APPROVAL. Do not add anything that incurs a charge:
   no paid services, no Firebase Blaze features, no paid dependencies, no
   enabling billing. If a task appears to require spend, STOP and flag it in the
   PR — do not proceed.
2. No new dependencies outside the stack above without explaining why in the PR.
3. No secrets in source. Config comes from EXPO_PUBLIC_* env vars. Never commit
   .env* files (they are gitignored).
4. No Firestore schema or security-rule changes without flagging them clearly in
   the PR.
5. Read the versioned Expo docs at https://docs.expo.dev/versions/v56.0.0/
   before using an Expo API — APIs change between SDK versions.
6. Add dependencies with `npx expo install <pkg>`, never `npm install <pkg>`.
  expo install pins versions to the SDK 56 set; npm install floats them and
  breaks peer ranges (e.g. react / react-test-renderer must be the same version).

## Conventions

- Branch from `develop`; PRs target `develop`, never `main`.
- Conventional Commits for all commits (feat:, fix:, chore:, docs:, etc.).
- Use the PR template; fill out the Definition of Done checklist honestly.
- Tests live alongside the code and must not require paid services or network
  access to run.

## Commands

- `npm install` — install dependencies
- `npm run web` / `npm run ios` / `npm run android` — run per platform
- `npx tsc --noEmit` — typecheck (strict)
- `npm test` — run the test suite
- `npm run lint` — lint

(Some scripts above are added by in-progress foundation stories; if one is
missing, the issue you're working may be the one that adds it.)

## Definition of Done — every issue

- All acceptance criteria demonstrably met
- Tests written and passing
- Typecheck and lint pass
- Works on iOS, Android, and web (note any platform exceptions in the PR)
- No new defects, no secrets committed, no cost incurred
- Docs updated where the change is user- or developer-facing

## Deeper context

Team operating model and per-role guidance: `.github/AGENTS.md` and
`.github/agents/`. Sprint artifacts: `docs/sprints/`. Architecture decisions:
`docs/decisions/`. This file is the operative instruction set; those add context.
