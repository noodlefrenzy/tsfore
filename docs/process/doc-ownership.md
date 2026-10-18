---
agent-notes:
  ctx: "who owns which docs, update rules"
  deps: [CLAUDE.md, docs/glossary.md, docs/adrs/0009-ubiquitous-language-glossary.md]
  state: active
  last: "claude@2026-08-04"
---
# Document Ownership

Extracted from CLAUDE.md to reduce context window load. Referenced by CLAUDE.md Process Docs Index.

## Ownership Table

| Doc | Owner | Path | Update trigger |
|-----|-------|------|---------------|
| SBOM + dependency decisions | Pierrot | `docs/sbom/sbom.md`, `docs/sbom/dependency-decisions.md` | Dependency add/remove/upgrade |
| Threat model | Pierrot | `docs/security/threat-model.md` | New endpoints, data types, integrations, auth flows; new owner-harm (C1–C8) or tool-supply surface |
| Design profile | The human (Dani cites) | `docs/design-profile.md` | A visual decision is made that outlives one PR. Dani never authors House rules (ADR-0013 §5 rule 4) |
| Performance budget | Vik (review) / Ines (verify) | `docs/performance-budget.md` | System evolution |
| Test strategy | Tara | `docs/test-strategy.md` | New test patterns or coverage targets |
| Technical debt | Grace (track) / Pat (prioritize) | `docs/tech-debt.md` | Sprint boundaries, shortcuts taken |
| Debt-marker convention | Vik | `docs/methodology/debt-markers.md` | Convention changes; harvested via `pnpm harvest:debt` |
| Runbooks | Ines | `docs/runbooks/` | New infrastructure or alerts |
| Config manifest | Ines | `docs/config-manifest.md` | New env vars, feature flags, config files |
| Changelog | Diego | `CHANGELOG.md` | Releases |
| AI-tells catalog | Diego | `docs/process/ai-tells-catalog.md` | New convergence patterns observed; calibration of exceptions |
| Review lenses | Ines (operational) / Archie (conformance) | `docs/process/review-lenses.md` | A reusable review lens gains, loses, or re-scopes a check |
| Security intake routing | Pierrot / Archie | `docs/process/security-intake.md` | A new security learning needs routing, or an intake surface (ADR/directive/gate/threat-model) is added |
| Code map | Coordinator | `docs/code-map.md` | New packages, modules, or significant API changes |
| Glossary (domain vocabulary) | Archie (arbitrate) / Cam (capture) | `docs/glossary.md` | New domain terms surface in Discovery/Architecture; overloaded or competing terms |
| Team directives | All agents | `docs/team-directives.md` | New conventions established during work |
| Attributions | Diego (record) / Pierrot (license terms) | `docs/attributions.md` | Third-party material is adopted, adapted, or declined |
| ADRs | Archie | `docs/adrs/` | Significant architectural decisions |
| Product context | Pat | `docs/product-context.md` | Kickoff Phase 1b, sprint boundaries, human corrections |

## The Single-Source Rule (glossary vs code-map vs agent-notes vs spec docs)

Four artifacts describe "the project," and it must be obvious which one owns a given fact. A term is defined in exactly one home; every other place references it bare and, at most, links the home (ADR-0009 §3). A pointer is not a definition, so it creates no drift.

| To learn… | Read | Owns |
|-----------|------|------|
| what a **domain word** means (Order, Invoice) | `docs/glossary.md` | the user's *domain* vocabulary |
| what a **process term** means (proof grade, wave, agent-notes) | its spec doc (`done-gate.md`, `phases.md`, `agent-notes.md`, `team-governance.md`) | Summon's *methodology* vocabulary |
| **where** something is built / how data flows | `docs/code-map.md` | modules, packages, APIs |
| whether to **open a given file** | that file's agent-notes | one file's purpose and deps |

Practical consequence: the glossary holds **domain terms only** — never Summon's own process terms (those stay in their spec docs and are referenced bare). When prose elsewhere needs a term defined in another home, it writes the coined noun plainly and links the home doc rather than re-defining it. `docs/glossary.md`'s duplicate-heading invariant is enforced downstream by the `summon doctor` glossary check.

## Dependency Management Rules

- Every top-level dependency must have a rationale entry in `dependency-decisions.md`.
- Transitive dependencies are inventoried with their license.
- Run `/pin-versions` to pin versions, regenerate SBOM, and update decisions.
- Copyleft or uncommon licenses in the transitive tree are flagged for review.

## Security & Threat Modeling

Pierrot owns the threat model (`docs/security/threat-model.md`). Created during kickoff Phase 3 (Architecture) with Archie providing data flow diagrams. Uses STRIDE analysis. Updated whenever the attack surface changes. At pre-release, Pierrot verifies the threat model is current.

## Performance Budget

Vik reviews during code review against `docs/performance-budget.md`. Ines verifies at pre-release by running benchmarks and load tests. Created during kickoff if the project has performance-sensitive requirements.

## Test Strategy

Tara owns `docs/test-strategy.md`. Defines what gets tested at which level, coverage targets, and test data strategy. Created during kickoff or first sprint.

## Technical Debt

Grace tracks in `docs/tech-debt.md`. Pat prioritizes debt against feature work at sprint boundaries. Debt that increases risk (security, data integrity, missing tests on critical paths) gets priority. Any debt open for 3+ sprints is escalated to the user.

## Runbooks

Ines owns `docs/runbooks/`. Every alert must have a corresponding runbook. Created alongside the infrastructure they support. Template at `docs/scaffolds/runbook-template.md`.

## Configuration Management

Ines owns `docs/config-manifest.md`. Every environment variable, feature flag, and config file is documented with values per environment. Audited before every deployment.

## Changelog

Diego owns `CHANGELOG.md`. At release time, generate entries from conventional commits, group by type, translate into user-facing language. Breaking changes include migration steps.

## What Ships (Canon vs Meta)

Summon's template repo is also its own development repo, so every doc is one of two kinds, and only one kind ships into a scaffolded project (ADR-0007).

**The test:** a file is **canon** if it is about the user's project or the methodology they practice; it is **meta** if it is about building or operating Summon itself. One question decides it — *"when a stranger scaffolds their app with `summon-team`, does this file help them build it, or does it only make sense to a Summon maintainer?"* Help the user → canon (ships). Only makes sense to us → meta (repo-only). The test keys on the file's **subject**, not its directory: a meta file in an otherwise-canon folder is still meta and is excluded individually.

**The two meta zones** (excluded from the scaffold by the CLI's `EXCLUDE_PATHS`):

- `docs/history/` — dev-history, war-stories, and design docs (code reviews, gate transcripts, cross-repo audits, site art bibles).
- `docs/adrs/meta/` — product ADRs about building `summon-team` itself. **Canon ADRs stay in `docs/adrs/`** (0001–0003, `template.md`, and the `0008` worked example) and ship.

Two more files are meta by subject and never ship: the marketing `README.md` (a project stub, `README-template.md`, ships as the user's README instead) and `.claude/handoff.md` (per-session scratch, gitignored).

**The one hard rule this creates:** a canon file must never carry an agent-notes `dep` on a meta file — downstream it becomes a dangling reference the user's `doctor` fails on. `scripts/check-canon.mjs` enforces this in CI (any canon→meta `dep` is a hard failure) and also asserts ADR numbers stay contiguous across both `adrs/` directories. Dead *prose* mentions of meta paths are a style matter caught by review, not the sensor — prefer generic phrasing ("the debate record for this decision") over a specific path that won't exist in the user's copy.
