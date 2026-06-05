# StitchMap Mobile

A universal cross-stitch pattern and progress-tracking app for iOS, Android, and web, built from a single Expo codebase.

## Stack

- Expo SDK 56 · React Native 0.85 · React 19.2
- New Architecture + Hermes
- TypeScript (strict mode)
- [NativeWind](https://www.nativewind.dev/) v4 (Tailwind CSS utilities) for styling

## Prerequisites

- Node.js 20+ (developed on 22)
- npm
- iOS: Xcode + simulator (macOS only), or Expo Go on a device
- Android: Android Studio + emulator, or Expo Go on a device

## Install

```bash
npm install
```

## Environment

Copy the example env file and fill in any values you need for local development:

```bash
cp .env.example .env
```

Variables prefixed with `EXPO_PUBLIC_` are inlined into the client bundle at
build time, so they must not contain secrets.

| Variable                 | Required | Description                                                                        |
| ------------------------ | -------- | ---------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SENTRY_DSN` | No       | Sentry DSN for error tracking. Leave empty to disable Sentry — the app still runs. |

Error tracking is provided by Sentry (see
[ADR-002](docs/decisions/ADR-002-error-tracking-with-sentry.md)); it only
initializes when `EXPO_PUBLIC_SENTRY_DSN` is set.

## Run

```bash
npm run start     # Expo dev server — pick a platform from the CLI
npm run ios       # iOS simulator (macOS)
npm run android   # Android emulator
npm run web       # Web browser
```

## Routing

Navigation uses [Expo Router](https://docs.expo.dev/router/introduction/) (file-based
routing). The `app/` directory defines the route tree:

```
app/
  _layout.tsx          # Root layout — reads useAuth() and gates access
  (auth)/
    _layout.tsx
    login.tsx          # /login
    register.tsx       # /register
  (app)/
    _layout.tsx
    index.tsx          # / (protected home placeholder)
```

The root layout redirects unauthenticated visitors to `/login`, so only the `(auth)`
screens are reachable while signed out. Authentication is backed by Firebase Auth (see
[Authentication](#authentication)); the root layout reads
[`useAuth()`](lib/auth/useAuth.ts) and gates access based on the live auth state. Web
builds use the metro bundler with `output: "single"` so deep links such as `/login`
resolve on direct navigation and browser back/forward works.

## Authentication

Email/password authentication is powered by the [Firebase JS SDK](https://firebase.google.com/docs/auth).
The pieces:

```
lib/firebase/config.ts   # firebaseConfig from EXPO_PUBLIC_FIREBASE_* env vars
lib/firebase/auth.ts     # initializes the app + Auth (per-platform persistence)
lib/auth/AuthProvider.tsx # context: { user, isLoading, error, signIn, signUp, signOut }
lib/auth/useAuth.ts      # consumer hook (must be used within <AuthProvider>)
lib/auth/errors.ts       # maps Firebase error codes to friendly messages
```

`AuthProvider` (mounted in [`app/_layout.tsx`](app/_layout.tsx)) subscribes to
`onAuthStateChanged` and exposes the current user plus `signIn`/`signUp`/`signOut`
actions. On native (iOS/Android), Auth is initialized with
`getReactNativePersistence(AsyncStorage)` so sessions survive app restarts; on web,
Firebase's default browser persistence is used.

### Configuration

The Firebase web config is supplied via environment variables (never committed). Copy the
template and fill in the values from your Firebase project (console → Project settings →
Your apps → Web app):

```bash
cp .env.example .env
# then edit .env
```

| Variable                                   | Required |
| ------------------------------------------ | -------- |
| `EXPO_PUBLIC_FIREBASE_API_KEY`             | yes      |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`         | yes      |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID`          | yes      |
| `EXPO_PUBLIC_FIREBASE_APP_ID`              | yes      |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`      | optional |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | optional |

A Firebase web config is not a secret (access is enforced by Auth + Security Rules), but
it is kept out of source so each environment can supply its own project. The `EXPO_PUBLIC_`
prefix tells Expo to inline the values into the client bundle at build time.

> **Stakeholder action (manual):** create a Firebase project on the Spark (free) tier,
> enable the Email/Password sign-in provider, and share the config values via a secure
> channel. The QA test plan for this flow lives in
> [`docs/qa/sprint-1-story-7-auth-test-plan.md`](docs/qa/sprint-1-story-7-auth-test-plan.md).

## Styling

Styling uses [NativeWind](https://www.nativewind.dev/) v4, which brings Tailwind CSS
utility classes to React Native via the `className` prop and renders consistently on iOS,
Android, and web. The configuration:

```
tailwind.config.js   # design tokens + content globs (registers nativewind/preset)
global.css           # Tailwind entry point (@tailwind base/components/utilities)
metro.config.js      # Metro wrapped with withNativeWind (input: ./global.css)
babel.config.js      # babel-preset-expo (jsxImportSource: nativewind) + nativewind/babel
nativewind-env.d.ts  # className type support (references nativewind/types)
```

`global.css` is imported once from [`app/_layout.tsx`](app/_layout.tsx). Style components
with utility classes, e.g.:

```tsx
<View className="flex-1 items-center justify-center bg-surface-light">
  <Text className="text-title font-semibold text-brand-700">StitchMap Mobile</Text>
</View>
```

Baseline design tokens (`brand`/`surface` colors, `xs`–`xl` spacing, and a
`caption`/`body`/`title` type ramp) live in `tailwind.config.js` as **placeholders**; UX
finalizes the palette, spacing scale, and typography in a later sprint. The rationale and
alternatives considered are recorded in
[`docs/decisions/ADR-001-styling-with-nativewind.md`](docs/decisions/ADR-001-styling-with-nativewind.md).

## Code Quality

Lint, format, and commit-message standards are enforced locally so code quality stays
consistent without manual review of trivia.

```bash
npm run lint          # ESLint (Expo + TypeScript + React Native rules)
npm run lint:fix      # ESLint with autofix
npm run format        # Prettier — write changes
npm run format:check  # Prettier — check only (no writes)
npm run typecheck     # tsc --noEmit (TypeScript strict mode)
npm run test          # Jest (jest-expo preset + React Native Testing Library)
npm run test:watch    # Jest in watch mode
npm run test:coverage # Jest with coverage report
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
npm run test --if-present  # test suite (jest-expo)
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
