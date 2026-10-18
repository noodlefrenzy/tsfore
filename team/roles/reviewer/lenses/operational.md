<!-- agent-notes: { ctx: "reviewer lens: operational baseline, conditional on behaviour changes", deps: [team/roles/reviewer/SKILL.md, docs/process/review-lenses.md, docs/process/operational-baseline.md], state: draft, last: "claude@2026-09-09" } -->

## Lens: Operational

Activates when the change alters application behaviour: not docs-only, not CI-only.

Guiding question: when this breaks at 3am, how will anyone know, and what will they see?

- Logging: does the new path log at its boundaries, with enough context to reconstruct what happened, and nothing sensitive?
- Error patterns: do errors follow the codebase's existing shape, or introduce a new one?
- Config: is every new setting validated at startup, with a clear failure when it is missing or wrong?
- Debug support: can the behaviour be reproduced or inspected without a debugger attached to production?
- Graceful degradation: when a dependency is slow or gone, does this path fail closed, fail open, or hang?
- Subprocess spawns: stdio explicit, stdin closed when unused, timeouts set, the health check exercising the real path.

This is the per-change check. The full audit runs at the sprint boundary against the operational baseline.
