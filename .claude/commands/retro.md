---
description: "Kaizen retro that encodes each fix as a sensor, not just a logged issue."
---
<!-- agent-notes: { ctx: "kaizen retro that encodes fixes as sensors, not just issues", deps: [docs/methodology/personas.md, CLAUDE.md, scripts/check-canon.mjs, docs/methodology/debt-markers.md], state: active, last: "claude@2026-07-07" } -->
Reflect on the work done in this sprint/session. Consider:

1. What went well?
2. What was harder than expected?
3. Were there any recurring patterns or friction points?
4. What would have made the work easier or faster?
5. Are there any new conventions, gotchas, or patterns to document?
6. Which Summon agents (see `docs/methodology/personas.md`) were effectively engaged during this session? Which were missing?
7. Were there moments where a persona's perspective would have caught an issue earlier?
8. Should any persona definitions in `docs/methodology/personas.md` be updated based on this experience?
9. **Were any process issues identified in a previous retro still recurring?** If so, the previous fix was insufficient — escalate (see § Recurring issues).

### The magic-wand questions (ask these every time)

These two questions turn usage into improvement signal. Ask them at the end of every meaningful run:

> **If you had a magic wand, what one command, flag, output field, fixture, check, gate, or workflow change would make the next run easier, safer, or higher quality?**
>
> **What did you have to *infer* that the harness should have *proved*?**

Then **review the answers** — this needs human judgement. Some will be bad, some too expensive, some are gold. The point is not to collect lessons; it is to make the next run better. Encode the good ones; let the rest go.

## Encode the fix, not the memory

This is the rule that makes a retro compound instead of rot. When something went wrong, the instinct is to write it down — another paragraph in `CLAUDE.md` or a gotcha. **Resist it.** Ask first: *can the harness prove this so no one has to remember it?*

> Documentation can orient, but the highest-value fix is **executable**. Markdown explains the trap; a check prevents you falling into it.

For **every** finding, place its fix on the **encoding ladder** and push it as high as the finding allows:

| Rung | Fix form | Proof grade | Example |
|------|----------|-------------|---------|
| 1 (best) | **Encoded sensor** — a check, command, fixture, gate, lint rule, or typed wrapper that *fails* on the violation | `deterministic` | add a case to `scripts/check-canon.mjs`; a new `pnpm` check; a Done Gate item with a deterministic sensor |
| 2 | **Tracked work** — a GitHub issue for a fix that needs real sprint effort to encode | scheduled | "build an arch-check for boundary X" |
| 3 (last resort) | **Prose** — a note in `CLAUDE.md`, `gotchas.md`, or `team-directives.md` | `inferential` (memory) | a convention that genuinely can't be checked yet |

**Decision rule:** a finding may only land on a *lower* rung than encoded if you can say *why* it can't be encoded yet (too expensive, needs design, genuinely a judgement call). Record that reason. A prose-only fix for something that could be a check is how the same failure recurs next sprint.

**Remove the class, not the instance.** When you fix a finding, ask whether the fix kills the *whole category*. A shell-injection bug fixed in one place invites the next one; a safe `execDetached(cmd, args)` helper that nobody can bypass removes the class. Prefer the fix that makes the failure structurally impossible over the one that patches today's instance.

Then take these actions, in this order:

### 1. Encode the cheap deterministic fixes NOW (rung 1)

For findings whose fix is small and deterministic, **do it in this retro** — don't just file an issue:

- A drifting cross-file invariant → add a check to `scripts/check-canon.mjs` (verify with `pnpm check:canon`).
- A repeated manual setup/verification step → a `pnpm` script or a new `.claude/commands/` command if a repeatable workflow emerged.
- A deferred shortcut that lost its marker → a `summon:` marker (`docs/methodology/debt-markers.md`), confirmed by `pnpm harvest:debt`.
- An implicit architectural decision → an ADR in `docs/adrs/`.

Encoding now is cheaper than encoding never. If a guard/check/command was added, note it in the retro doc.

### 2. File GitHub issues for fixes that need sprint work (rung 2) — MANDATORY for the rest

For each remaining problem that can't be encoded on the spot, create a tracked issue so it can't evaporate:

1. Ensure the label exists: `gh label create "process-improvement" --description "Process issue identified in sprint retro" --color "d93f0b" --force`.
2. Create the issue, and **state the intended encoding** in the body — what check/command/gate should eventually exist, not just "be more careful":
   ```
   gh issue create --title "Process: <concise description>" --body "<what went wrong, the intended encoded fix (rung 1 target), and why it couldn't be encoded in the retro>" --label "process-improvement"
   ```
3. **These issues gate the next sprint.** They must be resolved or explicitly scheduled before new sprint work begins — enforced by `/sprint-boundary` Step 3.

**Why this matters:** an untracked lesson is a lesson nobody reads. A tracked issue that names its rung-1 target is a lesson on its way to becoming a check.

### 3. Prose, only with justification (rung 3)

Update `CLAUDE.md` / `gotchas.md` / `team-directives.md` for findings that genuinely can't be checked yet — and in the retro doc, say *why* each prose-only fix couldn't climb the ladder.

### Document the retro

Create a retrospective file at `docs/retrospectives/{{date}}-<topic>.md` (agent-notes frontmatter per `docs/methodology/agent-notes.md`) that summarizes the reflection and records the **encoding ledger** — the durable record of what each finding became:

```markdown
## Encoding ledger — Sprint N

| Finding | Rung | What was encoded / issue # | Class removed? | If not rung 1, why |
|---------|------|----------------------------|----------------|--------------------|
| <friction> | 1 / 2 / 3 | `scripts/check-canon.mjs` case / #123 / gotcha | yes / no | <reason or —> |
```

### Recurring issues — a finding that returns means the fix was too low on the ladder

If a problem identified in this retro was **also** identified in a previous retro (check `docs/retrospectives/`), the prior fix was insufficient — almost always because it landed on rung 3 (prose) when it needed rung 1 (a check). This is a red flag:

- Note it explicitly in the issue body: which prior retro, what the prior fix was, why it didn't hold.
- The new fix **must climb the ladder** — a recurring prose note becomes an issue with a rung-1 target; a recurring inferential gate item becomes a deterministic sensor. Do not re-file the same prose.
- Label with both `process-improvement` and `recurring` (`gh label create "recurring" --description "Issue that has recurred across sprints" --color "b60205" --force`).
