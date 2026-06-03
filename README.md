# StitchMap Mobile

A universal cross-stitch pattern and progress-tracking app for iOS, Android, and web, built from a single Expo codebase.

## Stack

- Expo SDK 56 · React Native 0.85 · React 19.2
- New Architecture + Hermes
- TypeScript (strict mode)

## Prerequisites

- Node.js 20+ (developed on 22)
- npm
- iOS: Xcode + simulator (macOS only), or Expo Go on a device
- Android: Android Studio + emulator, or Expo Go on a device

## Install

```bash
npm install
```

## Run

```bash
npm run start     # Expo dev server — pick a platform from the CLI
npm run ios       # iOS simulator (macOS)
npm run android   # Android emulator
npm run web       # Web browser
```

## Code Quality

Lint, format, and commit-message standards are enforced locally so code quality stays
consistent without manual review of trivia.

```bash
npm run lint          # ESLint (Expo + TypeScript + React Native rules)
npm run lint:fix      # ESLint with autofix
npm run format        # Prettier — write changes
npm run format:check  # Prettier — check only (no writes)
npm run typecheck     # tsc --noEmit (TypeScript strict mode)
```

[Husky](https://typicode.github.io/husky/) Git hooks run automatically (installed via the
`prepare` script on `npm install`):

- **pre-commit** — runs `npm run lint && npm run format:check`
- **commit-msg** — runs [commitlint](https://commitlint.js.org/) against the staged message

## Continuous Integration

CI runs on every pull request targeting `develop` and on every push to `main`, via
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). After an `install` job warms the
npm cache, the `lint`, `typecheck`, and `test` checks run in parallel on `ubuntu-latest`
and any failure fails the run:

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # test suite (added by the test-harness story)
```

> **Stakeholder action (manual, GitHub UI):** branch protection on `develop` and `main`
> must be configured to require the `Lint`, `Typecheck`, and `Test` status checks before
> merging. This cannot be automated; it is tracked in
> [`docs/sprints/sprint-1-plan.md`](docs/sprints/sprint-1-plan.md) under _Stakeholder Action Items_.

## Commit Message Convention

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) and are
validated by commitlint using the `@commitlint/config-conventional` ruleset. Each message must
be structured as:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Common `type` values: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`.

Examples:

```text
feat: add pattern progress tracker
fix(auth): handle expired session tokens
docs: document commit message convention
chore(deps): bump expo to SDK 56
```

Breaking changes are flagged with a `!` after the type/scope (e.g. `feat!: drop SDK 53 support`)
or a `BREAKING CHANGE:` footer.

## Project Conventions

The team operating model, role definitions, sprint cadence, and contribution rules live in [`.github/AGENTS.md`](.github/AGENTS.md). Sprint artifacts are in [`docs/sprints/`](docs/sprints/); architecture decisions in [`docs/decisions/`](docs/decisions/).

Branch from `develop`; pull requests target `develop`. `main` is release-only.
