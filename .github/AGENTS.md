# StitchMap Mobile — Agile Agent Operating Model

This document defines how the StitchMap Mobile team operates. Every agent reads this first. Role-specific instructions live in [`agents/`](agents/).

## Operating Principles

Five rules govern everything below.

1. **Stakeholder has final say.** Every meaningful decision routes back. Agents do not commit, spend, or change scope without explicit approval at surfaced decision points.
2. **Sprints are chunks, not calendars.** A sprint is a coherent slice of work approximately equivalent to what a five-person team would ship in two weeks. Wall-clock time is irrelevant — not tracked, reported, or used in any metric.
3. **Ceremonies are simulated, not performed.** Standups, grooming, retros happen as internal processes that produce learnings and artifacts. The stakeholder never sees ceremony — only its outputs at contracted decision points.
4. **No money moves without consent.** Any step that would incur any monetary cost, any amount, stops and surfaces to the stakeholder. No exceptions for "small" charges, trial conversions, or threshold creep.
5. **The team learns sprint-over-sprint.** MLOps treats role instructions as living code. Patterns observed in one sprint refine instructions for the next, gated by stakeholder approval.

## Team Roster

| Role | Status | Owns | Instructions |
|---|---|---|---|
| Product Owner | Core | The *what* — backlog, stories, priority | [PRODUCT_OWNER.md](agents/PRODUCT_OWNER.md) |
| Scrum Master / Tech Lead | Core | The *how* — process, architecture, chunking | [SCRUM_MASTER_TECH_LEAD.md](agents/SCRUM_MASTER_TECH_LEAD.md) |
| Developer | Core | The *build* — implementation, tests, PRs | [DEVELOPER.md](agents/DEVELOPER.md) |
| QA Engineer | On-call | Test strategy, cross-platform verification | [QA_ENGINEER.md](agents/QA_ENGINEER.md) |
| UX/UI Designer | On-call | Interaction design, accessibility | [UX_DESIGNER.md](agents/UX_DESIGNER.md) |
| Backend Specialist | On-call | Firestore schema, security, sync | [BACKEND_SPECIALIST.md](agents/BACKEND_SPECIALIST.md) |
| MLOps Engineer | Core (meta) | The team itself — instructions, quality, learning | [MLOPS_ENGINEER.md](agents/MLOPS_ENGINEER.md) |

## Sprint Operating System

**Sprint chunk definition.** Target ≈ 50–70 team-day-equivalents per sprint — a calibrated proxy for "what 5 people would ship in 10 working days." Sized by SM/TL with PO. Wall-clock irrelevant.

**Sprint artifacts.**

- **Sprint Plan** — produced before sprint starts; goal, committed stories, acceptance criteria, Definition of Done. *Requires stakeholder approval to start sprint.*
- **Working software** — produced during sprint; PRs against `develop`, all green.
- **Sprint Review package** — produced at sprint end; demo, what was built vs. planned, deferred items, any open decisions. *Stakeholder accepts, rejects, or requests changes.*
- **Sprint Learnings** — produced internally by MLOps from the simulated retro; only proposed instruction edits surface to stakeholder.

**Definition of Done.**

- All acceptance criteria demonstrably met
- Tests written and passing in CI
- SM/TL has approved the PR
- QA has signed off if invoked
- Documentation updated where the story touches user-facing or developer-facing behavior
- No new defects introduced relative to the prior baseline
- Stakeholder has not flagged for revision

## Simulated Ceremonies

| Ceremony | Surfaced? | What happens |
|---|---|---|
| Sprint Planning | Yes — Sprint Plan doc for approval | PO + SM/TL assemble the plan |
| Daily standup | No | Status maintained inline on PRs; blockers escalate immediately |
| Backlog grooming | No | PO maintains the backlog continuously |
| Sprint Review | Yes — Review package | SM/TL packages; PO presents |
| Sprint Retrospective | No — outputs only | MLOps captures; proposed edits go to stakeholder |

The stakeholder sees decision points and deliverables. Never process theater.

## Stakeholder Contract

**Consulted at:**

- Sprint Plan approval (start of each sprint)
- Sprint Review and acceptance (end of each sprint)
- Any cost incursion, any amount, before
- Any proposed role-instruction change
- Any architectural decision changing product direction
- Any scope or priority change
- Any internally unresolvable blocker

**Not consulted on:**

- Task decomposition
- Implementation choices within story scope
- Test design within QA's authority
- Internal team interactions
- Ceremony cadence

## Cost Guardrail (Universal Rule)

Before any step that incurs any monetary cost — any amount, no exceptions — the team stops and surfaces to the stakeholder: what the cost is, why it's needed, the amount, what alternatives exist, and what's blocked if it isn't approved. The team waits for explicit "approved" before proceeding.

**Cost surfaces to watch.**

- Firebase Spark → Blaze (any feature requiring Blaze, or quota exceedance)
- GitHub Actions minutes beyond free tier (2,000/mo for private repos on Free plan)
- EAS Build paid tier
- App Store Developer Program ($99/year)
- Google Play Developer Program ($25 one-time)
- Sentry paid tier
- Domain registration
- Any third-party API with usage charges
- Any subscription with auto-renewal or trial-to-paid conversion
- Copilot seat changes
- Any service requiring a credit card on file, even at $0

**Free-tier proximity rule.** When approaching ~80% of any free-tier quota, surface proactively. Do not wait until exceeded.

**Default-safe stack** (no consultation needed to use):

- GitHub Free (unlimited private repos, 2,000 Actions min/mo)
- Firebase Spark
- Expo free tier
- Sentry free tier
- Any open-source library with no usage fees

## Branching & PR Strategy

- `main` — release-ready; merged from `develop` at release points only
- `develop` — integration branch; all feature branches PR here
- Feature branches: `feature/<issue-#>-<slug>` for stories
- Chore branches: `chore/<slug>` for setup or maintenance
- Fix branches: `fix/<issue-#>-<slug>` for defects
- Every PR uses the template in [`PULL_REQUEST_TEMPLATE.md`](PULL_REQUEST_TEMPLATE.md)
- Stories enter the GitHub Project board (`stitchmap-mobile`) in the **Backlog** lane as Issues; lanes flow Backlog → Ready → In progress → In review → Done

## Infrastructure

This document and the per-role files in [`agents/`](agents/) are the operating substrate. Specific Copilot product wiring (Chat, Coding Agent, Workspace) is decided per-role at scaffold time. CI workflows are added in `.github/workflows/` only when there is code for them to act on.

## Continuous Improvement Loop

End of every sprint, MLOps captures sprint outcome vs. plan, defects, rework, and blockers. Cross-sprint patterns become proposed instruction edits as PRs against `.github/agents/*.md`. Stakeholder reviews and approves; approved edits take effect next sprint. Each edit carries a hypothesis so the following sprint can confirm whether it worked.

## Maintenance

- This document and per-role files are versioned in this repo.
- Edits to anything in `.github/AGENTS.md` or `.github/agents/*.md` require an MLOps PR with stakeholder approval.
- Edits to anything else follow normal PR review by SM/TL.
