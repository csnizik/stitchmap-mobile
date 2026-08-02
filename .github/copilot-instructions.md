# Copilot Instructions — StitchMap Mobile

StitchMap Mobile is a universal cross-stitch pattern and progress-tracking app
that runs on iOS, Android, and web from a single Expo codebase.

When assigned an issue: implement it to satisfy the issue's Acceptance Criteria,
open a PR against `develop`, and request review. Don't prompt for confirmation
mid-task. If a requirement is genuinely ambiguous or blocked, stop and say so in
the PR rather than guessing.

Before starting, check whether a PR already exists for this issue — open OR
closed. If one does, continue from that branch (reopen or build on it) instead
of opening a new one. Do not create a duplicate PR for an issue that has already
been worked.

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

## Git and toolchain hygiene

These exist because each has broken CI or destroyed work at least once.

- **Check `package.json` after any expo command that can rewrite it** —
  `expo install --fix`, `expo prebuild`, `expo run:ios`, `expo run:android`.
  Run `git diff package.json` before committing and revert version changes you
  did not intend. Prebuild in particular will silently bump the SDK toward the
  latest release.
- **Commit work in progress before running environment or build commands.**
  Never leave a story as uncommitted working-tree changes across a session
  boundary. Recovery commands run against an unprotected tree can destroy it,
  and have.
- **Run `git commit`, `git push`, and `gh pr create` as separate commands.**
  Chained with `&&` or newlines, the later commands still execute after the
  pre-commit hook rejects the commit, producing an empty branch and a confusing
  "no commits between develop and branch" error.
- **Node version is pinned in `.nvmrc` and enforced by `engines`.** Do not
  change one without the other, and do not regenerate `package-lock.json` on a
  different major version. npm 10 and npm 11 disagree about platform-specific
  optional dependencies, which produces a lockfile that looks fine locally and
  fails `npm ci` in CI.

## Conventions

- Branch from `develop`; PRs target `develop`, never `main`.
- Conventional Commits for all commits (feat:, fix:, chore:, docs:, etc.).
  The type goes before the colon: `chore: subject`, never `(chore): subject`.
- Use the PR template; fill out the Definition of Done checklist honestly.
- Tests live alongside the code and must not require paid services or network
  access to run. Tests needing the Firestore emulator live in `firestore-tests/`
  and run only via `npm run test:rules`, never in CI.
- Before requesting review, merge the latest `develop` into your branch to keep
  the conflict surface small. Favor small, promptly-opened PRs over long-lived
  branches that drift from `develop`.
- The sandbox cannot run simulators or reach live services. If a change touches
  styling or any runtime/boot configuration and you could not actually launch
  the app, say so explicitly in the PR and flag it for a stakeholder smoke test
  before merge — do not imply boot was verified when it was not.

## What "verified on iOS, Android, and web" means

It means a **cold start on a development build as a signed-out user**. Not a hot
reload. Not a session that was already signed in. Not Expo Go, which cannot load
this app's native modules and no longer supports physical iOS devices on SDK 56.

State in the PR which platforms were actually cold-started and which were not.
An honest "Android not verified, code path identical to iOS" is worth more than
a blanket claim.

This rule exists because a routing deadlock shipped marked verified on three
platforms and showed every signed-out user a blank screen for an entire sprint.
It failed silently: no error, no crash, no log. Only a cold start on a real build
surfaced it.

## Commands

- `npm ci` — install dependencies from the lockfile
- `npm run ios` / `npm run android` — build and run a development build.
  These run `expo run:*`, not `expo start`: the app uses native modules that
  Expo Go cannot load.
- `npm run web` — run in the browser
- `npm run typecheck` — typecheck (strict). Always run via the script; passing a
  filename to `tsc` makes it ignore `tsconfig.json` entirely.
- `npm test` — run the test suite
- `npm run test:rules` — emulator tests (needs Java and the Firebase emulator)
- `npm run lint` — lint

Local prerequisites: Node 24 (see `.nvmrc`), CocoaPods 1.13+ for iOS builds,
Java for the Firestore emulator, and an installed Xcode iOS simulator runtime.

## Definition of Done — every issue

- All acceptance criteria demonstrably met
- Tests written and passing
- Typecheck and lint pass
- Cold-started on a development build per the verification rule above, with any
  platform exceptions stated explicitly in the PR
- No new defects, no secrets committed, no cost incurred
- Docs updated where the change is user- or developer-facing

## Deeper context

Team operating model and per-role guidance: `.github/AGENTS.md` and
`.github/agents/`. Sprint artifacts: `docs/sprints/`. Architecture decisions:
`docs/decisions/`. This file is the operative instruction set; those add context.
