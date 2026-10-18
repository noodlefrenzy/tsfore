---
description: "Run the multi-lens code review (Vik, Tara, Pierrot, Archie) on the current changes."
---
<!-- agent-notes: { ctx: "multi-lens code review shorthand, delegates to code-reviewer agent", deps: [.claude/agents/code-reviewer.md, docs/process/tracking-protocol.md], state: active, last: "claude@2026-07-07" } -->
Run a multi-perspective code review on the current changes.

This command delegates to the **code-reviewer agent** (`.claude/agents/code-reviewer.md`), which is the canonical definition of the multi-lens review process. Invoke it as a subagent.

## What Happens

The code-reviewer agent applies four core lenses plus situational checks:

1. **Vik** — Simplicity, maintainability, performance
2. **Tara** — Test quality and coverage
3. **Pierrot** — Security and compliance
4. **Archie** — Architectural conformance (activates when shared types are touched)
5. **Ines** (situational) — Operational baseline (activates when app behavior changes)

Plus migration safety and API compatibility checks when relevant.

See the agent definition for full lens details, output format, and review document template.

## After the Review

Produce a tracking artifact at `docs/tracking/YYYY-MM-DD-<topic>-review.md` summarizing the review findings (Critical/Important/Suggestion counts), key issues found, and resolution status. If a full review document was written to `docs/code-reviews/`, link to it. Use the standard tracking format from `docs/process/tracking-protocol.md`.
