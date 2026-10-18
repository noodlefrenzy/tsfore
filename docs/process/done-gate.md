---
agent-notes:
  ctx: "16-item Done Gate checklist, proof-graded"
  deps: [CLAUDE.md, docs/methodology/debt-markers.md, .claude/commands/grill.md]
  state: active
  last: "vik@2026-06-15"
---
# Done Gate — Detailed Checklist

This checklist is the quality gate every work item must pass before closing. Referenced by CLAUDE.md § Workflow.

## Backpressure, not say-so

The gate is a **proof ladder**, not a confidence poll. An agent can *say* a item is done; the gate decides whether that claim rests on **evidence**. Each item below carries a **proof grade** — the strongest grade the claim actually admits:

- **`deterministic`** — a command computes the verdict from observable state (a test, a typecheck, a script, a board query). Strongest. Prefer it wherever the claim allows. These should be cheap to re-run and hard to fake.
- **`inferential`** — an agent or reviewer interprets evidence. A code-review lens is legitimate here. Weaker than deterministic, and a candidate for *encoding into a deterministic sensor over time* (see `docs/methodology/debt-markers.md` and the canon guard `pnpm check:canon` for examples of prose rules turned into checks).
- **`human-judgement`** — the call genuinely needs a person: product fit, taste, risk appetite.

Forcing a taste claim to be deterministic is as wrong as eyeballing something a one-line check could prove. Pick the right grade and defend the fit.

> **Companion:** when an item's grade is `inferential`/`human-judgement`, or coverage looks thin, run **`/grill`** (`.claude/commands/grill.md`) to interrogate the claim — *"what realistic wrong implementation would still pass the checks you just named?"* It sharpens or builds the proof. It is a companion, never a gate: the verdict still comes from running the sensors.

Every work item must pass this gate before closing:

1. **Tests pass** _(deterministic)_ with zero failures.
2. **Typecheck passes** _(deterministic)_ with zero errors. If the project uses a type-checked language, the type checker must pass independently of tests (e.g., Vitest uses esbuild with no type checking, so `tsc` can fail even when tests pass). This catches missing imports, wrong generics, stale type references after migrations, and mock type mismatches.
3. **Formatted** _(deterministic)_ per project's formatter (no diffs).
4. **Linted** _(deterministic)_ with zero warnings.
5. **Code reviewed** _(inferential)_ — the code-reviewer agent (or at minimum one review lens) has been invoked.
6. **Acceptance criteria met** _(human-judgement)_ — the feature works as specified, not just "tests pass." The one claim that most often hides a wrong implementation behind a green suite; `/grill` it when in doubt.
7. **Docs current** _(inferential)_ — if the change affects user-facing behavior, Diego has updated docs.
8. **Accessibility reviewed** _(inferential; deterministic aids: axe/Lighthouse)_ — if any frontend/UI file was changed, Dani (accessibility lens) has reviewed. Dani must be spawned as a standalone agent, not reviewed inline by the coordinator.

    8b. **Visual verification** _(inferential — screenshot evidence, self-authored; see "what invalidates this" below)_ — if this item changes UI files (`ui/`, `pages/`, `components/`, templates, CSS, layouts), open the affected page(s) in a browser (via Playwright `browser_navigate` + `browser_take_screenshot`, or manual check) and confirm they render. This is not a full E2E suite — it is "does it render." Not applicable to CLIs, libraries, or backend-only services.

    The evidence must show, and the report must state: (1) the page rendered with no console errors — paste the console output, not a summary of it; (2) the specific element this item changed, visible in frame; (3) the commit SHA of the working tree when the screenshot was taken.

    **What invalidates this evidence:** any subsequent write to a UI file, stylesheet, or template; any dependency or build-config change; a screenshot taken at a different commit than the one being closed. If the tree moved after the screenshot, retake it. A screenshot is not proof and must not be described as one — it is the weakest grade of evidence on this gate, and it is accepted because "does it render" has no cheaper honest test today.

    **If `docs/design-profile.md` exists**, also name which of its sections the change touches, and confirm the rendered result is consistent with them — or state, in writing, that it deliberately departs and why. Dani owns this call.
9. **Board updated** _(deterministic)_ — status has passed through "In Progress" → "In Review" → "Done" in order (not skipping any). Verify by checking the item's current status on the board (`gh project item-list <NUMBER> --owner <OWNER> --format json`). If "In Review" status doesn't exist on the board, this is a board configuration failure — fix it before proceeding (see `/kickoff` Phase 5 Step 2).
10. **Migration safe** _(inferential; deterministic where a migration test exists)_ — if schema/data changes are involved, Archie's migration safety checklist passes.
11. **API compatible** _(inferential; deterministic with a contract test)_ — if API contracts changed, backward compatibility verified or new version created.
12. **Tech debt logged** _(deterministic + inferential)_ — if shortcuts were taken, they're marked in code with a `summon:` comment (`docs/methodology/debt-markers.md`) and material debt is recorded in `docs/tech-debt.md`. `pnpm harvest:debt` deterministically lists the markers; judging which are *material* is inferential. 12b. **Directives updated** _(inferential)_ — if a new convention was established or discovered during this work, add it to `docs/team-directives.md`.
13. **SBOM current** _(inferential; deterministic via dependency diff)_ — if dependencies were added/removed/upgraded, Pierrot has updated the SBOM. 13b. **Dependency cooldown honoured** _(inferential; deterministic where the package manager enforces `minimumReleaseAge` or a registry-age sensor exists)_ — if dependencies were added or upgraded, each newly-adopted direct version cleared the release-age cooldown (3-day default, ADR-0010), or an override is logged with a reason in `docs/sbom/dependency-decisions.md`. An emergency, human-approved CVE fix is a sanctioned override. 13c. **CI supply-chain integrity** _(deterministic where CI/manifest files changed)_ — if CI workflow files or the dependency manifest changed, third-party CI actions are pinned to immutable commit SHAs (not mutable tags), and the lockfile is committed and matches the manifest with no drift (`docs/team-directives.md` § DevOps).
14. **Operational baseline checked** _(inferential)_ — if this work item changes application behavior (not docs-only, not CI-only), verify it hasn't degraded the operational baseline (`docs/process/operational-baseline.md`):
    - Logging: new code paths log at appropriate levels.
    - Error patterns: new error handling follows the project's established pattern.
    - Config: any new config values are documented and validated.
    - README: if user-facing behavior changed, the quick-start is still accurate.
15. **External integration smoke-tested** _(deterministic; human-attested if the tool is absent from CI)_ — if this work item integrates with external tools, services, or binaries (subprocess spawning, external APIs, CLI tool invocation), the happy path has been verified against the real tool, not just mocks. Mocked unit tests verify internal logic; this gate verifies the integration actually works end-to-end. If the external tool is unavailable in CI, document which manual verification was performed and by whom.
16. **Simplicity check (YAGNI)** _(inferential)_ — the change is the minimum that meets the acceptance criteria. No unrequested abstractions, no speculative generality, no new dependency where stdlib or a few lines suffice (Vik's laziness ladder, `.claude/agents/vik.md`). This is not "code reviewed" again — it's the explicit question "did we build more than was asked?" Simplicity never overrides the non-negotiables in item 12's neighbours: validation, security, data-loss handling, and accessibility stay. Deliberate shortcuts are marked with `summon:` and logged per item 12.

## Encode the fix, not the memory

When an item keeps failing the same way — a migration step everyone forgets, an architecture rule misread every sprint — don't add another paragraph to the docs. **Encode it as a sensor** that fails on the violation, and the item's grade climbs from `inferential` toward `deterministic`. The canon guard (`scripts/check-canon.mjs`) is the first instance: "keep the persona roster in sync" stopped being a prose protocol and became a check. The gate gets stronger every time a recurring inference becomes a check.
