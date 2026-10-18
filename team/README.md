---
agent-notes: { ctx: "source tree for the composed team; read team-layers.md first", deps: [docs/methodology/team-layers.md, scripts/compose-team.mjs, scripts/team-log.mjs, scripts/run-checks.mjs, scripts/review-wave.mjs], state: draft, last: "claude@2026-09-09" }
---

# team/

The team is authored here as four layers and composed into harness output by `scripts/compose-team.mjs`. The spec is `docs/methodology/team-layers.md`; read it before editing anything below.

```
team/
├── roles/<role>/         the work: SKILL.md (Agent Skills) + role.json (boundaries) [+ lenses/]
├── personas/<name>.md    the point of view: priors, dissent, voice, tells
├── views/<skin>/         the skin: party.json, keyed by persona; never reaches a prompt
├── harness/<name>.json   the fitted part: tool names, budgets, output paths; marked fitted
├── parties/<name>.json   bindings: which persona holds which role, on which harness, in which skin, on which lines
├── lines/<name>.json     stations bound to seats, handoffs, and per-item constraints (order, distinct-instance)
├── events.json           schema for the runtime event log (.summon/team-log.jsonl)
├── checks.json           this project's commands for each role's declared checks, and the log path
├── fixtures/             the negative-control diff the review formation must not wave through
└── workflows/            the stations that run as Workflow scripts: review-wave (one station) and line (a whole dispatch plan); review-wave.mjs and dispatch.mjs prepare their args and write their events
```

Watch and measure:

```
node scripts/team-log.mjs render  --log .summon/team-log.jsonl --skin jrpg-16bit   # the table view
node scripts/team-log.mjs dissent --log .summon/team-log.jsonl --last 10           # the decay metric
node scripts/team-log.mjs check   --log .summon/team-log.jsonl --line tdd          # separation of duties, per item
pnpm team:checks --seat sato                                                        # run a seat's bound checks; receipts bound to the tree
pnpm team:control                                                                   # the negative control, after the formation reviews the fixture
```

Compose:

```
pnpm team:compose                       # summon-core party, claude-code adapter → build/team/
node scripts/compose-team.mjs --party summon-core --harness skills --out build/skills
```

`build/` is gitignored. Do not edit composed files; edit the layer and recompose.
