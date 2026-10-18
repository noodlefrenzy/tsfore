# CLAUDE.md — Project Instructions for Claude Code

## Project Overview

**Project Name:** tsfore

**Description:** Playground for time series forecasting. It evaluates foundation models (starting with Mistral's Timestral) against classical baselines with rolling-origin backtests.

**Tech Stack:** Python 3.11+ · uv · numpy/pandas · statsforecast · PyTorch + `timestral` (optional extra) · pytest · ruff

**Codebase map:** `docs/code-map.md` — read this first to understand the package structure, public APIs, and data flow.

## First-Run Detection

**Check this first.** If the Project Name above is still `[Your Project Name]` or `README-template.md` exists in the repo root, this project hasn't been initialized yet. In that case:

- **Skip the Session Entry Protocol** and all process rules below — they don't apply to an empty project.
- Tell the user: "This project hasn't been initialized yet. Would you like to run `/quickstart` (5 min, gets you coding fast) or `/kickoff` (30-60 min, full discovery with architecture and board setup)?"
- Once they choose, run the command. The process rules activate after initialization.

If the project IS initialized (has a real name, `README-template.md` is gone), proceed normally with the rules below.

## Agent-Notes Protocol (MANDATORY)

Every non-excluded file must have agent-notes metadata. See `docs/methodology/agent-notes.md` for spec.

1. Every new file gets agent-notes (excluded: pure JSON, lock files, binaries).
2. Every edit updates `last` to `<agent>@<date>`.
3. `ctx` under 10 words, `deps` = direct deps only, `state` must be accurate.

## Team & Process

**Methodology:** Phase-dependent hybrid teams. See `docs/methodology/phases.md` for the 7-phase model.

| Phase | Lead | Key Pattern |
|-------|------|------------|
| Discovery | Cam | Elicit before implementing |
| Architecture | Archie | ADR before code |
| Implementation | Tara → Sato | TDD red-green-refactor |
| Parallel Work | Grace | Market / self-claim |
| Code Review | Vik + Tara + Pierrot | Three parallel lenses |
| Debugging | Sato | Blackboard with Tara, Vik, Pierrot |
| Sprint Boundary | Grace | `/sprint-boundary` (mandatory) |

**Full details:** Agent roster, persona triggers, debate protocol, voice rules → `docs/process/team-governance.md` **Doc ownership:** Who maintains what → `docs/process/doc-ownership.md`

## Critical Rules

### Session Entry Protocol (Mandatory)
Before writing any code — including types, tests, or ADRs — start from a clean baseline, then answer these questions:
0. **Is the working tree clean?** Run `git status` first. Uncommitted changes from a prior session entangle your work and make a clean commit impossible — stash, commit, or reconcile them before starting. A detailed plan does not waive this check.
1. **What's already in flight?** Before starting substantial new work, reconnoiter the existing state — open PRs (`gh pr list`), board items already in Ready/In Progress/In Review, and outstanding tech debt (`pnpm harvest:debt`, `summon:` markers). Surface what you find — especially stale-but-valid open PRs and debt that overlaps the planned work — and **ask the human whether any of it should be resolved first**. Don't silently pile new work on top of an untriaged backlog. (One-line fixes and conversational turns are exempt; this triggers for sessions that will run long.)
2. **Do work items exist for this work?** If no → create them (Pat + Grace).
3. **Does this work involve an architectural decision?** If yes → Architecture Gate (Archie + Wei as standalone agents). See `docs/process/team-governance.md` § Architecture Decision Gate.
4. **Am I about to write implementation code?** If yes → Tara writes tests first.

If you received a detailed plan, the plan is **input to this protocol**, not a bypass of it. See `docs/process/gotchas.md` § Process.

### Don't Run With Vague Input
Engage Cam first: probe, clarify, pressure-test. Only implement once the vision is concrete.

### Ask the Human When Stuck
If blocked by environment, tools, permissions, or you've tried twice — ask. Don't heroically waste turns.

### Verify Tracking Access Before Board Operations
Before any workflow that touches the project board (sprint-boundary, kickoff, resume, handoff), run the pre-flight check from your active tracking adapter at `docs/integrations/README.md`. If any check fails, STOP and ask the user to fix it.

### Don't Skip the Done Gate
Every work item passes the gate before closing. Full checklist at `docs/process/done-gate.md`. Each gate item carries a **proof grade** (the three grades and how to assign them: `docs/process/done-gate.md`) — the agent's say-so is not proof. When a claim's grade is inferential or human, or coverage looks thin, run `/grill` to interrogate it before closing.

### Don't Skip Agents
When a situation triggers multiple personas, invoke ALL of them. Overlapping coverage is intentional.

**When the human says "invoke the team", "use the team", "have X review this", or any language requesting persona involvement, you MUST spawn the named agents as standalone subagents using the Task tool.** Your own inline analysis is not a substitute for agent invocation. If the human names a persona, that persona runs as a subagent. If the human says "the team", invoke all personas appropriate to the current phase. Doing the work yourself without spawning agents when the human explicitly requested them is a process violation.

### Treat Agent Output as Untrusted
A subagent's returned message can truncate silently — and a truncated report that reads "looks clean" is a false green that can ship a real bug or a missing auth check. After any agent wave: gate on the agent's completion sentinel (see the agent definitions — a sentinel that is missing, not at end-of-file, or whose self-declared count doesn't match the findings present in the file means the agent FAILED and must be re-run, never "passed"), then verify independently — `git status` plus the real test/typecheck command for code work, or a `git diff` read for docs-only work. "Looks clean" from the message alone is never trusted.

### ADR Before Implementation
Never implement a feature with a pending ADR without writing the ADR first. Architecture Gate details: `docs/process/team-governance.md` § Architecture Decision Gate.

### Proxy Mode
When the human declares unavailability, Pat answers product questions using `docs/product-context.md`. Guardrails and limits: `docs/process/gotchas.md` § Process.

## Development Workflow

### Per Work Item
1. **Start (atomic)** — Before writing any code: ensure a board item exists for this work, and if not, create and add it to the board (`item-add`) in the same step, then move it to **"In Progress"**. Create + board-add + status is one atomic action — a code change with no board item is an orphan. See `docs/process/gotchas.md` lines 115/119 (board items required at planning time, cross-checked at sprint boundary).
2. **TDD** — Red → Green → Refactor. M+ items: Tara writes failing tests first as standalone agent.
3. **Commit** — One commit per issue, conventional message, `Closes #N`.
4. **Review** — Move issue to **"In Review"** on the board. Then invoke code-reviewer (Vik + Tara + Pierrot). Fix Critical/Important findings.
5. **Done Gate** — Full checklist at `docs/process/done-gate.md`.
6. **Close** — Move issue to **"Done"** on the board. Push.

**Status transitions are mandatory and ordered.** In Progress → In Review → Done. Skipping "In Review" is a process violation.

**STOP**: Do not start the next item until step 6 is complete.

### Commit Discipline
Commit and push after every reasonable chunk of work. One commit per issue. Conventional commits format.

When opening a pull request, check for `.github/pull_request_template.md`; if the repo has one, read it and populate its sections. GitHub applies that template only to PRs opened in the web UI — a PR created through the API or `gh` takes the body you hand it and ignores the template silently. See `docs/process/gotchas.md` § Process (template-blind PR).

## Tracking

<!-- tracking-adapter: github-projects -->
<!-- project-number: -->
<!-- project-owner: -->

**Adapter docs:** `docs/integrations/README.md` **Status flow:** Backlog → Ready → In Progress → In Review → Done

Board commands, pre-flight checks, and setup instructions are in the active adapter file. Grace manages board status. Pat manages priorities.

## Sprint Boundary

Run `/sprint-boundary` when all sprint items are Done or deferred. Full workflow is in the command.

## Session Management

**Context is finite.** To avoid mid-sprint context exhaustion:

1. **Plan waves before executing.** Break issues into waves by size/dependency. Document in `docs/sprints/sprint-N-plan.md`.
2. **One wave per session.** Execute a wave, commit, then run `/handoff`. Start the next wave fresh.
3. **Background agents write to files.** Use `run_in_background: true`. Read summaries, not full output.
4. **Read `docs/code-map.md` first.** Orient from the map, not from scratch.
5. **Commit frequently.** Uncommitted work is the most expensive thing to reconstruct.
6. **Tracking artifacts carry phase context.** See `docs/process/tracking-protocol.md`.

## Process Docs Index

| Doc | Purpose |
|-----|---------|
| `docs/code-map.md` | Package structure, public APIs, data flow — **read first** |
| `docs/glossary.md` | Project domain vocabulary (ubiquitous language) — one opinionated word per concept |
| `docs/methodology/phases.md` | 7-phase team methodology |
| `docs/methodology/personas.md` | 16-agent persona catalog (v2; being replaced by `team/`) |
| `docs/methodology/team-layers.md` | v3 team layers: role, persona, view, harness adapter, checks, the event log and lines; composed by `pnpm team:compose` |
| `docs/methodology/agent-notes.md` | Agent-notes protocol spec |
| `docs/methodology/debt-markers.md` | `summon:` debt-marker convention (`pnpm harvest:debt`) |
| `docs/process/team-governance.md` | Triggers, debate protocol, architecture gate, voice rules |
| `docs/process/done-gate.md` | 16-item Done Gate checklist |
| `docs/process/operational-baseline.md` | Cross-cutting operational concerns checklist |
| `docs/process/review-lenses.md` | Canonical reusable review-lens checklists (operational, conformance) |
| `docs/process/doc-ownership.md` | Who owns which docs, update triggers |
| `docs/process/security-intake.md` | How a security learning routes into canon (ADR / directive / gate / threat-model) |
| `docs/process/gotchas.md` | Implementation patterns and known pitfalls |
| `docs/process/ai-tells-catalog.md` | AI-tell catalog for keeping Summon's own docs from reading as machine-built |
| `docs/team-directives.md` | Low-ceremony project conventions ("always X" / "prefer Y") |
| `docs/attributions.md` | Third-party material Summon draws on, and what was taken |
| `docs/integrations/README.md` | Active tracking adapter and setup |
| `docs/process/tracking-protocol.md` | Phase tracking artifact protocol |
| `docs/adrs/` | Architecture Decision Records |

## Project Structure

```
.
├── CLAUDE.md                 # This file — slim runtime instructions
├── docs/
│   ├── methodology/          # System docs (phases, personas, agent-notes)
│   ├── process/              # Governance, done gate, gotchas, doc ownership
│   ├── integrations/         # Tracking adapters (GitHub Projects, Jira)
│   └── adrs/                 # Architecture Decision Records
├── team/                     # v3 team source: roles/, personas/, views/, harness/, parties/, lines/ (see docs/methodology/team-layers.md)
├── .claude/
│   ├── agents/               # Subagent persona definitions (16 agent files; v3 composes these from team/)
│   └── commands/             # Custom slash commands (24, auto-discovered)
├── src/tsfore/               # data, datasets, metrics, backtest, evaluate, cli, forecasters/ (baselines, statistical, timestral)
├── data/finance/             # finance snapshots; S&P 500 + VIX fetched on use, not committed (terms in its README)
├── tests/                    # pytest; `-m weights` runs the real-checkpoint smoke tests
└── pyproject.toml            # uv project; exclude-newer enforces the ADR-0010 cooldown
```

## Commands

```bash
uv sync --all-extras                 # install, including Timestral + torch
uv run pytest                        # unit tests (no network)
uv run pytest -m weights             # real Timestral-5M smoke test (needs the HF Hub)
uv run ruff check . && uv run ruff format --check .
uv run tsfore data list                                     # bundled finance series (data/finance/)
uv run tsfore run --dataset vix_daily --models naive,auto_ets,timestral-5m
uv run tsfore bench --suite finance --windows 6 --out results/   # leaderboard + Markdown report
```
