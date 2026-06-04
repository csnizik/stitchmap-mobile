# ADR-003: EAS Build Pipeline

- **Status:** Accepted
- **Date:** 2026-06-04
- **Deciders:** Engineering
- **Sprint:** 1 (Story 10)

## Context

StitchMap Mobile is an Expo app that ships to iOS and Android. To produce
installable native binaries (and eventually store submissions) we need a managed
build service. Requirements:

- Build iOS and Android binaries from the single Expo codebase without
  maintaining our own macOS/Android build infrastructure.
- Separate build configurations for day-to-day development, internal preview
  testing, and production releases.
- **Incur no cost or build-quota usage without explicit stakeholder approval.**
  EAS builds draw from a limited free-tier quota, so an accidental or automatic
  build must be impossible.
- Provide a repeatable, auditable way to trigger a build once approval is given.

## Decision

Use **Expo Application Services (EAS) Build** as the native build pipeline,
configured via `eas.json` and triggered through a **manual, stakeholder-gated**
GitHub Actions workflow.

Configuration:

- **`eas.json`** defines three build profiles:
  - `development` — `developmentClient: true`, internal distribution, on the
    `development` channel. For local dev clients with the full debugging
    toolchain.
  - `preview` — internal distribution on the `preview` channel. For sharing
    test builds with the team / stakeholders without going through the stores.
  - `production` — store-ready builds on the `production` channel, with
    `autoIncrement` so build numbers advance automatically.
  - `cli.appVersionSource` is set to `remote` so EAS owns the version source of
    truth and local checkouts cannot drift.
- **`.github/workflows/eas-build.yml`** is the only automation that can start a
  build. It is gated behind `workflow_dispatch` (manual trigger only — it never
  runs on push, pull_request, or a schedule) and requires a
  `stakeholder_approved` input. A dedicated `approval-gate` job exits non-zero
  unless that input is **exactly the string `"true"`**; the `build` job
  `needs` the gate, so no build step can run without approval. The input
  defaults to `"false"` so the safe path is the default.
- The workflow authenticates to EAS with an `EXPO_TOKEN` repository secret and
  runs `eas build --non-interactive --no-wait`. Platform and profile are chosen
  at dispatch time.

### Gate verification (no builds this sprint)

No EAS builds are run during Sprint 1. The gate is verified by dispatching the
workflow with `stakeholder_approved` left at its default (`"false"`) and
confirming the `approval-gate` job fails with the refusal message before any
build step executes. A real build is only triggered after a stakeholder
completes the actions below and explicitly approves a run.

## Alternatives Considered

- **Local/manual native builds (Xcode + Android Studio).** No third-party
  service, but requires maintaining native toolchains, signing credentials, and
  per-developer setup. Rejected because it does not scale and is exactly what
  the managed Expo workflow is meant to avoid.
- **A generic CI runner (e.g. macOS GitHub Actions runners) building natively.**
  Possible, but we would have to reimplement credential management, caching, and
  the iOS/Android build matrix that EAS provides out of the box. Rejected for
  complexity.
- **Automatic builds on merge to `main`.** Convenient, but it would consume the
  free-tier build quota without explicit approval and risks unexpected spend.
  Rejected in favor of the manual, stakeholder-gated trigger.

## Consequences

- Positive: native iOS/Android builds are reproducible from a single
  configuration with clear development/preview/production separation.
- Positive: no build can run without a human explicitly approving it, so the
  free-tier quota is never consumed accidentally and no spend occurs without
  approval.
- Positive: the trigger is auditable — every build appears as a manually
  dispatched workflow run with the approving actor recorded.
- Negative: builds require a manual dispatch step; there is no continuous
  delivery on merge (an intentional trade-off this sprint).
- Neutral: `eas.json` and the workflow exist, but the project is not yet linked
  to an EAS project; that requires the stakeholder action below.

## Free-Tier Limits

EAS Build free tier provides **30 builds per month** shared across iOS and
Android. No builds are run in this sprint. Future builds count against this
quota and require stakeholder approval per the workflow gate.

## Stakeholder Action Required

- Create a (free) Expo account and log in (`eas login`).
- Run `eas init` in this repository to link it to an EAS project (this writes
  the `extra.eas.projectId`/`owner` into `app.json`).
- Add an `EXPO_TOKEN` repository secret (an Expo access token) so the workflow
  can authenticate to EAS.

No credit card is required for the free tier.
