# ADR-002: Error Tracking with Sentry

- **Status:** Accepted
- **Date:** 2026-06-04
- **Deciders:** Engineering
- **Sprint:** 1 (Story 9)

## Context

StitchMap Mobile ships to iOS, Android, and web from a single Expo codebase. We
need visibility into runtime errors — especially crashes during app start — so
that production issues are surfaced and triaged instead of silently affecting
users. Requirements:

- Capture unhandled JS errors and native crashes from app boot onward.
- Work across all three platforms from one configuration.
- Integrate cleanly with Expo SDK 56, the New Architecture, and Hermes.
- Cost nothing during development and incur no spend without explicit
  stakeholder approval.
- Never break the app when monitoring is not configured (e.g. local dev or
  contributors without a DSN).

## Decision

Use **`@sentry/react-native`** with the **Expo config plugin** as the error
tracking layer.

Configuration:

- `@sentry/react-native` is installed via `npx expo install` so the version is
  aligned with the Expo SDK, and the `@sentry/react-native` config plugin is
  registered in `app.json` under `expo.plugins`.
- Initialization lives in `lib/monitoring/sentry.ts` (`initSentry`) and is
  **guarded by the `EXPO_PUBLIC_SENTRY_DSN` env var**. When the DSN is absent or
  empty, `Sentry.init` is skipped entirely and the app boots normally — no DSN
  means no init and no crash.
- `app/_layout.tsx` calls `initSentry()` at module load (as early as possible so
  boot-time errors are captured) and exports the root layout wrapped with
  `Sentry.wrap`.
- `.env.example` documents `EXPO_PUBLIC_SENTRY_DSN`. The `EXPO_PUBLIC_` prefix
  lets Expo inline the value at build time; because it is embedded in the client
  bundle, the DSN must not be treated as a secret (Sentry DSNs are safe to ship
  in clients).

## Alternatives Considered

- **No error tracking (status quo).** Zero dependencies and zero cost, but
  leaves us blind to production failures. Rejected because surfacing runtime
  errors is the entire goal of this story.
- **Bugsnag.** Capable cross-platform crash reporting with a React Native SDK.
  Rejected because Sentry has first-class Expo support (a maintained config
  plugin and `expo install` integration), a generous free tier, and broader
  adoption in the Expo ecosystem.
- **Firebase Crashlytics.** Already in the Firebase orbit the app uses
  elsewhere, but it is native-crash focused, has a weaker JavaScript/web story,
  and requires additional native configuration that the managed Expo workflow
  does not handle as smoothly as the Sentry plugin. Rejected for now.

## Consequences

- Positive: unhandled JS errors and native crashes are captured from app start
  across iOS, Android, and web from a single configuration.
- Positive: initialization is fully optional — contributors without a DSN run
  the app unchanged, and CI/local builds never depend on Sentry being set up.
- Positive: stays on the Sentry free tier (5k errors/mo, 10k performance
  events/mo); no spend without explicit stakeholder approval.
- Negative: adds the `@sentry/react-native` dependency and a config plugin that
  must stay aligned with Expo SDK upgrades (manage via `expo install`).
- Neutral: performance tracing and profiling are left off for now; they can be
  enabled later by extending the `Sentry.init` options.

## Stakeholder Action Required

Create a Sentry account and a project for `stitchmap-mobile`, then provide the
DSN to be set as `EXPO_PUBLIC_SENTRY_DSN`. No credit card is required for the
free tier.
