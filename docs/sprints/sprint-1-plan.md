# Sprint 1 Plan

**Sprint number:** 1
**Roadmap phase:** Phase 0 — Foundation
**Status:** Awaiting stakeholder approval

## Sprint Goal

Reach the Phase 0 exit criterion of the roadmap: **app boots on iOS, Android, and web; auth screens are functional; the protected shell renders.**

## Committed Stories

Ten stories. Full drafts in [`sprint-1-stories.md`](sprint-1-stories.md). Issue numbers added once created on the Project board.

| # | Issue | Title | Size | Dependencies | Specialists |
|---|---|---|---|---|---|
| 1 | TBD | Universal Expo SDK 56 Scaffold | M | — | — |
| 2 | TBD | Linting, Formatting, Conventional Commits | S | 1 | — |
| 3 | TBD | CI Workflow | S | 1, 2, 6, 8 | — |
| 4 | TBD | Expo Router with Auth/App Route Groups (stub auth) | M | 1 | UX |
| 5 | TBD | NativeWind Styling Foundation | S | 1 | UX |
| 6 | TBD | Zustand + Immer State Foundation | S | 1, 8 | — |
| 7 | TBD | Firebase Auth — Real Sign-In | L | 1, 4, 5, 6, 8 | UX, QA, Backend |
| 8 | TBD | Test Harness — jest-expo + RNTL | S | 1 | QA |
| 9 | TBD | Sentry Error Tracking | S | 1 | — |
| 10 | TBD | EAS Build Pipeline Skeleton | S | 1 | — |

**Total:** ~25 story points. Sprint 1 establishes the chunk calibration baseline; subsequent sprints aim for comparable size relative to stakeholder-perceived deliverable scale.

## Execution Sequence

Parallelizable where dependencies permit.

1. Story 1 (blocking all others)
2. In parallel: Stories 2, 5, 8, 9, 10
3. In parallel: Stories 6, 4
4. Story 3 (after 2, 6, 8 — needs lint/typecheck/test all present to wire CI)
5. Story 7 (after 4, 5, 6, 8)

## Specialists Invoked

- **UX:** Stories 4, 5, 7 — placeholder layouts, baseline design tokens, login/register screen design
- **QA:** Stories 7, 8 — auth flow test plan, test harness patterns
- **Backend:** Story 7 — Firebase project + Auth configuration

## Sprint Demo Plan

At sprint end, the Sprint Review package will include:

1. App booting on iOS simulator, Android emulator, and web browser
2. Signing up a new user, signing in, signing out, redirect logic
3. A triggered error landing in the Sentry dashboard
4. CI passing on a sample PR
5. `eas-build.yml` workflow refusing to run without `stakeholder_approved: true` input

## Definition of Done (per `.github/AGENTS.md`)

For each story:

- All acceptance criteria demonstrably met
- Tests written and passing in CI
- SM/TL has approved the PR
- QA has signed off if invoked
- Documentation updated where the story touches user-facing or developer-facing behavior
- No new defects introduced relative to the prior baseline
- Stakeholder has not flagged for revision

## Cost Surfaces

All free tier. No monetary cost will be incurred this sprint. The following require stakeholder account setup before the corresponding story can complete:

| Story | Service | Tier | Credit card required |
|---|---|---|---|
| 7 | Firebase | Spark (free) | No |
| 9 | Sentry | Free | No |
| 10 | Expo EAS | Free | No |

GitHub Actions usage projected at well under the 2,000 min/mo free-tier ceiling (estimated ~50–100 minutes for Sprint 1 CI runs).

## Stakeholder Action Items

- [ ] Create Firebase project on Spark tier (Story 7), enable Email/Password Auth, provide config values
- [ ] Create Sentry project (Story 9), provide DSN
- [ ] Expo account login + `eas init` to link this repo (Story 10)
- [ ] Configure branch protection on `develop` and `main` after Story 3 lands — require the CI status checks (`Lint`, `Typecheck`, `Test`) to pass before merging (GitHub UI: Settings → Branches → Branch protection rules; cannot be automated)

## Risks & Unknowns

- **Expo SDK 56 stability.** SDK 56 is the latest release. If beta-adjacent friction surfaces, the team will recommend pinning to SDK 55 (zero cost mitigation).
- **NativeWind v4 + SDK 56 compatibility.** Documented as compatible; minor config friction possible.
- **Branch protection setup** requires stakeholder UI action; not blocking sprint execution.

## Sprint Retrospective Hypothesis

Sprint 1 is also the team's first calibration cycle. MLOps will track:

- Whether the 25-point chunk feels stakeholder-comparable to "a 5-person team's 2 weeks"
- Whether any role's instructions cause friction during execution
- Whether the cost guardrail surfaces things at the right cadence

Findings will inform proposed instruction edits before Sprint 2.
