---
agent-notes: { ctx: "spec for the four team layers, checks, and how a party composes them", deps: [CLAUDE.md, docs/methodology/personas.md, docs/methodology/phases.md, docs/process/done-gate.md, team/README.md, team/events.json, team/fixtures/negative-control/README.md, scripts/compose-team.mjs, scripts/team-log.mjs, scripts/run-checks.mjs, scripts/review-wave.mjs, team/workflows/review-wave.workflow.mjs], state: draft, last: "claude@2026-09-11", key: ["role = the work, persona = the point of view, view = skin + renderer, adapter = the fitted part", "the event log is the runtime record every renderer and runtime check reads; the line is the per-item separation constraint over it", "capabilities are verbs about the work, never tool names", "checks split each role into what a command decides and what the model judges", "view content never enters model context; Dissent must add to the lens"] }
---

# Team Layers

A Summon agent is not one file. It is a **role** held by a **persona**, shown to the human through a **view**, and run on a harness through an **adapter**. The four are authored separately under `team/` and composed by `scripts/compose-team.mjs` into whatever a given harness reads.

The reason for the split is a question you should be able to ask of any sentence in any team file: *if the model and the harness were swapped tonight, would this sentence still be true?* Sentences that survive belong in a role or a persona. Sentences that do not belong in the adapter, and nowhere else.

A second split runs through every role: what a command can decide, and what only judgment can. The first half is declared as **checks** and bound to commands per project; the model runs them and pastes the receipt. The second half is the role's questions and the persona's dissent. The composer reports how much of each role is which.

## The four layers

### Role — the work

A role describes a job and the standard the job must meet. `team/roles/<role>/SKILL.md` is an [Agent Skills](https://agentskills.io) document, so a role runs unchanged on any tool that reads the spec. Its body has five sections, all required:

| Section | Answers |
|---|---|
| **Charter** | What this work is, in a paragraph. |
| **Standard** | What done means. The bar, not the steps. |
| **Questions** | The judgment checklist the role runs. For a reviewer, the lens supplies it. |
| **Boundaries** | What this role does not do, as facts about the work. The prose form of `must-not`. |
| **Output** | The shape of what comes back. |

`role.json` beside it declares the machine-readable half:

```json
{
  "may": ["read", "run", "write:tests"],
  "must-not": ["write:src"],
  "lenses": [],
  "checks": [
    { "id": "tests-red", "claim": "Each new test fails before the implementation exists." },
    { "id": "no-wall-clock", "claim": "No new test reads the real clock." }
  ]
}
```

Capabilities are verbs about the work: `read`, `run`, `write:src`, `write:tests`, `write:docs`, `write:infra`, `web`, `notebook`. They are never tool names. `must-not` is the separation-of-duties list; it is what keeps a tester from making a failing test easier to pass, and it is the part of the role the adapter tries to enforce and reports on when it cannot.

A **check** is a claim a command can decide. The role declares the claim; the project binds the command (see Checks below). A check may carry a `lens`, in which case only members holding that lens receive it.

A role with several **lenses** (the reviewer has five) keeps each in `lenses/<lens>.md`. A persona binds to one lens; a formation binds to several.

A role contains no persona voice and no harness vocabulary. If a sentence names a vendor, a tool, or a turn budget, it is in the wrong file.

### Persona — the point of view

A persona is a named way of holding a role. `team/personas/<persona>.md` has frontmatter (`name`, `role`, optional `lens`, optional `holds`, `display`) and four required sections. `role` and `lens` name the primary seat; `holds` lists every seat the persona may take, as `role` or `role/lens` entries, when one person holds more than one (Tara is the tester and also the test-quality review lens). A party may only bind a persona to a seat it holds.

| Section | Answers |
|---|---|
| **Priors** | What this person believes about the work and notices first. |
| **Dissent** | What they push on that the role and lens do not already say. The friction budget. |
| **Voice** | One sentence describing the register, and one exemplar line. |
| **Tells** | How a reader knows it was them. |

Dissent is the section that matters, and it is governed by one rule: **it holds only what the role and lens do not already say.** The composer refuses a Dissent bullet whose content is mostly contained in a sentence of the bound lens or role. Restating the lens in the first person is the cheapest way to fill the section and adds nothing; if the rule empties a persona's Dissent, that persona is decoration and should be cut. Whether dissent survives at runtime is a separate question, measured by the reviewer role's `disagreement-rate` check, not by this file.

A persona contains no capabilities, no tool names, and no process steps; those are the role's.

### View — skin and renderer

A view has two halves. A **skin** is static presentation data: `team/views/<skin>/party.json`, keyed by persona, by formation, and by role (so a persona-less instance on a line has a class and an accent). A **renderer** reads the event log and a skin and draws the team in motion: a table, a tmux wall, an assembly line, a battlefield. Skins feed the site, the roster printout, and any header a human reads. Neither half **ever** enters an agent's context; a composer test pins that. The layer exists so every renderer reads one data file and one log instead of a vendor's transcript, and so a skin can be swapped without touching the work. `scripts/team-log.mjs render --skin <skin>` is the first renderer.

### Harness adapter — the fitted part

`team/harness/<harness>.json` is the only file under `team/` that may name a vendor's product. It carries:

| Field | Holds |
|---|---|
| `fitted` | Always `true`. Every adapter is fitted to something; `review` says to what. |
| `review` | What invalidates this file: a model release, a harness release, a spec change. |
| `output` | Where artefacts go: `dir`, and `file` with `{name}` or `{role}` placeholders. |
| `capabilities` | Work verb to tool names. Empty on a target with no tool layer. |
| `keys` | The frontmatter key names for allow, deny, and budget on this harness. |
| `frontmatter` | Fixed keys every agent gets. |
| `budget` | Turn budgets by role, plus `default`. |
| `paths` | Globs per write capability, so a hook can be composed from the same source as the role. |
| `formation` | How a formation is emitted: `single-file` today. |
| `personas` | `false` on a roles-only target. |

When a harness ships a release, this is the file to reread against the migration notes. If a release forces a change outside it, the seam is wrong; record that against the ADR's reversal triggers rather than patching around it.

## Parties and composition

A party, `team/parties/<party>.json`, binds the layers:

```json
{
  "harness": "claude-code",
  "view": "jrpg-16bit",
  "members": [
    { "role": "reviewer", "lens": "simplicity", "persona": "vik" },
    { "role": "coder", "persona": "sato" },
    { "role": "reviewer", "lens": "test-quality", "persona": "tara", "as": "tara-review" }
  ],
  "formations": [
    {
      "name": "review-party",
      "role": "reviewer",
      "members": [{ "persona": "vik", "lens": "simplicity" }, { "persona": "pierrot", "lens": "security" }],
      "conditional": [{ "lens": "operational", "when": "the change alters application behaviour" }]
    }
  ]
}
```

A member is a role, an optional lens, and a persona that holds that seat. `as` names the output when one persona holds two seats on the same harness. A **formation** is one agent carrying several lenses: the `members` are its floor, always applied; `conditional` lenses carry a `when` trigger and are applied only when it holds, and the formation reports which it applied. A conditional lens may name a persona or stand alone. This is ADR-0012's review-wave roster: the floor is fixed here, the conditionals are the diff-computed additions, and the workflow that evaluates the triggers is sequenced there.

`node scripts/compose-team.mjs --party summon-core --out build/team` writes one artefact per member and formation in the adapter's format, `roster.md` rendered from the view, and `enforcement.md`. A composed agent's body runs in this order: the persona's Voice, then the role's Charter and Standard, then Checks, then the role's Questions, then the bound lens, then the persona's Priors, Dissent, and Tells, then the role's Boundaries and Output. The `skills` adapter emits roles alone, no personas, which is the portable, voiceless configuration.

## Checks

`team/checks.json` binds check ids to commands for this project:

```json
{
  "tests-green": { "run": "pnpm test", "receipt": "the pass/fail summary lines, pasted" }
}
```

The composer joins each role's declared checks to these bindings. A bound check is emitted into the agent with its command and the receipt to paste, and is graded **deterministic**. An unbound check is emitted as a claim to judge and is graded **inferential**, using the proof grades from the done gate. The enforcement report counts both, per member, so the answer to "how much of this role is a script and how much is a model?" is a number per project. Claims are portable; commands are not, which is why they live apart.

The composer wires checks. `scripts/run-checks.mjs --party <party> --seat <seat> [--item <id>]` runs them: every bound check for that seat executes through the shell, and its exit code plus the last forty lines of output become a `check` event in the log, bound to the tree it ran against (`tree: { head, dirty }`). A receipt is evidence about that head and that cleanliness only; when the head moves or the tree is dirty, the receipt is stale and the check runs again. Unbound checks are listed as judged and never run; the seat judges them and writes its own `check` event with the grade `inferential`. The runner exits non-zero when any bound check fails, so it doubles as a gate.

### The negative control

`team/fixtures/negative-control/` holds a diff with one planted defect per floor lens of the review formation. The formation reviews it as item `negative-control`; then `team-log.mjs control --item negative-control --lenses <floor>` passes only if every named lens filed at least one finding in its latest round. It measures presence: every lens is running and still catches an obvious defect. It does not measure whether verdicts split, because a fixture built so that every lens catches something cannot also be the fixture that measures spread; the first real run showed that (five lenses, five vetoes, thirty-four findings that differed in content). Spread is the dissent rate's claim, over a full window of real items with the fixture excluded by name. Both are bound as the reviewer's checks and together are the instrument behind the ADR's first reversal trigger: a formation that waves the fixture through, or agrees with itself on ten real changes in a row, has stopped arguing.

## The event log

`.summon/team-log.jsonl` is the team's runtime record: one JSON object per line, schema in `team/events.json`. Every event carries `t` (ISO 8601), `seat`, and `event`; most carry `instance` (`sato#3`) and `item`. The event types:

| Event | Required | Means |
|---|---|---|
| `spawn` | `harness`, `tree` | a seat instance started, against a tree state |
| `claim` | `item` (+ `station`) | the seat took a work item, at a station of a line |
| `check` | `id`, `grade`, `exit` (+ `receipt`, `tree`) | a declared check ran, or was judged; `tree` binds a receipt to a head and a dirty flag |
| `finding` | `severity`, `summary` | one review finding |
| `verdict` | `lens`, `verdict`, `item` | one lens's verdict on one item: `accept`, `revise`, or `veto` |
| `return` | `ok` | the seat finished |

The log is what every renderer draws from and what the runtime checks read. `team-log.mjs append` validates before it writes; `dissent` computes the disagreement rate (items whose lens verdicts were not unanimous, over items with two or more lens verdicts, most recent first, `--exclude` for fixtures), and fails only when the window is full and every item in it was unanimous, since a rate over fewer items is a sample rather than a signal; `check --line` enforces a line's constraints; `render` draws the table. When a project sets `log` in `team/checks.json`, the composer adds a `Log` section to every agent telling it which events to write and how. A seat that does not write its events is work nobody can see; until the check runner and the dispatch workflow write events from outside the model, the log is self-reported.

## The line

Maker-checker only means something per work item. `team/lines/<line>.json` names stations bound to seats, the artefact each hands on, and constraints:

```json
{
  "name": "tdd",
  "stations": [
    { "name": "red", "seat": "tara", "emits": "tests" },
    { "name": "green", "seat": "sato", "needs": ["tests"], "emits": "change" },
    { "name": "review", "seat": "review-party", "needs": ["change"], "emits": "verdicts" }
  ],
  "constraints": [
    { "rule": "order", "stations": ["red", "green", "review"] },
    { "rule": "distinct-instance", "stations": ["green", "review"] }
  ]
}
```

A party opts into lines with `"lines": ["tdd"]`; the composer refuses a station that names a seat the party does not compose. `team-log.mjs check --line tdd` reads `claim` events per item and reports an item whose stations ran out of order or whose coding and reviewing stations were held by the same instance. That is separation of duties enforced at the log layer, per item, after the fact: detected, not prevented, until the line runs as a dispatch workflow.

The review station is the first station to run as a script. `scripts/review-wave.mjs prepare --party <party> --formation review --item <id> --diff <file> --out <args.json>` reads the formation and the diff, decides each conditional lens from the changed paths against the `paths` globs the party declares (a `!` glob excludes; the report names the matching paths, or says why a lens was skipped), and writes one prompt per lens carrying the role's charter, the lens, and the persona, and nothing from the skin or the adapter. `team/workflows/review-wave.workflow.mjs` is the workflow that runs between: one agent per lens returning a schema-constrained verdict, then a skeptic per finding prompted to refute it. `review-wave.mjs ingest --result <file> --instance <id>` validates the return and writes `claim`, the surviving `finding`s, one `verdict` per lens, and `return` to the log, so the events come from outside the model. The workflow is earn-gated per ADR-0012 C: it runs only when the human opts into the Workflow tool in a session, and the prose formation stays the floor until it has.

## The work order

Scale is dispatch, not party. The party says who may hold a seat; a work order says how many instances of a seat run against which items, on which line. A work order is a JSON file, anywhere, with this shape:

```json
{
  "id": "wo-138-a",
  "party": "summon-core",
  "line": "tdd",
  "items": [{ "id": "138-a", "spec": "docs/sprints/138-a.md" }],
  "instances": { "tara": 1, "sato": 2, "review-party": 1 }
}
```

`items[].id` is the `item` every event carries; `spec` is a path or text the first station reads; an item may also carry `diff` for a line that starts at review. `instances` counts per seat, and a seat the order does not name gets one instance if a station needs it. The schema lives in `team/events.json` under `workOrder`, next to the events it produces.

`scripts/dispatch.mjs` turns an order into a plan and writes the events a harness would otherwise leave to the model:

- `plan --order <file> --out <plan.json>` loads the party, the line, and the adapter; refuses an order whose line the party does not opt into, whose seat the party does not compose, whose instance count exceeds the adapter's `dispatch.concurrency`, or whose `distinct-instance` constraint cannot be met (two constrained stations on the same seat with fewer than two instances). It names every instance (`sato#1`, `sato#2`) with a worktree path under `.summon/worktrees/<instance>` when the adapter's `dispatch.isolation` is `worktree` (the other value is `none`; anything else is refused), and assigns one instance per station per item by one round-robin counter per seat, advanced by every station of every item in the order the line draws them. For every `distinct-instance` constraint the instances on an item differ; when the draw would put both constrained stations on one instance, `plan` refuses and names the seat that needs more instances rather than quietly re-dealing. The plan is the assignment, and it carries the line's constraints, so a station is never left to choose its own instance and `claim` reads one file. Seat names, instance counts, and item ids are validated here because they reach a worktree path and a shell line downstream.
- `open --plan <file>` writes one `spawn` event per instance, carrying `harness`, `instance`, `order`, `tree`, and `worktree`, and creates the worktrees when isolation asks for it, before any event is written. It refuses outside a git repository, refuses a plan whose worktree path is not the one its instance name implies, and refuses an existing worktree that is not at the head it is binding to; a rerun on the same head is idempotent and writes no second `spawn`. The tree state a spawn binds to ignores `.summon/`, the log's own footprint, so a receipt reads `dirty` for the code and not for the record.
- `claim --plan <file> --item <id> --station <name>` writes the `claim` event for the instance the plan assigned, and refuses before writing when the log shows the item's earlier stations have not returned (the `order` constraint) or when the assigned instance already holds a station the constraint separates it from (`distinct-instance`). This is the separation-of-duties boundary enforced at dispatch, before the seat runs, rather than detected by `team-log.mjs check --line` after. It is exactly as strong as the events it reads: `claim` trusts the `return` events on the log, which the seats write themselves until a hook writes them from outside the model, so the refusal guards against an honest out-of-order run, not against a seat that edits the log. A `return` releases a station only when it carries `ok: true` and the item, and comes from the instance that claimed it.

Parallelism limits (`concurrency`, `depth`, `isolation`) belong in the harness adapter's `dispatch` field and are expected to expire with the harness; a `skills` adapter has `dispatch: null` because a skill has no spawner. The workflow that runs a plan (`team/workflows/line.workflow.mjs`: one pipeline per item, one agent per station, the review station delegating to `review-wave`) is earn-gated with the review station; `plan`, `open`, and `claim` run without it, so a human dispatching by hand still gets the events and the refusals.

## The version

Every scaffolded project carries `.summon/manifest.json`, the install manifest ADR-0006 § Additional Decisions #6 defines and the add-on installer already writes: `manifestVersion`, `summonVersion` (the summon-team release that wrote the project), `targets`, and, added by ADR-0015, `scaffolded` (the ISO timestamp of the scaffold) and `source` (`github:<template>` verbatim, or `local` with no path). The scaffolder writes it at scaffold time from its own build-baked version, Case A included, which ADR-0015 records as superseding ADR-0006's clause that a Claude-only install writes none. `team-log.mjs --version` prints `summonVersion`, bare, as the scriptable form, and says no installed version is recorded when the file is absent, which is the case in the Summon source repo itself; `summon-team --version` prints the human one. The point is upgrades: a later pass, by a person or a model, reads the manifest to learn which version of the layers a project is on and patches the difference rather than guessing from the files. On the GitHub path the layers come from the template's default branch at download time while `summonVersion` names the release that ran, so the label can drift until the download is pinned to the release; that is owed to the release process.

## The enforcement report

For every `must-not` in every member, `enforcement.md` says whether the harness enforces it at the **tool** layer (every tool the boundary maps to is withheld) or by **prose** only (the role needs a tool the boundary shares, or the adapter maps it to nothing). A third level, **hook**, is reserved for a boundary enforced by a hook composed from the adapter's `paths`; the composer cannot probe whether one is installed, so that column belongs to `doctor`. On Claude Code, writing source and writing tests share the same tools, so a tester's boundary against source is prose. It was prose in the v2 roster as well; the report only makes it visible.

## Who writes what

Reviewers and challengers cannot write files; that is their boundary. Gate records and review documents are written by the coordinator, or by the review-wave workflow, from the returned message. A role that reports is not a role that files.

## Where each kind of edit goes

| You want to change | Edit |
|---|---|
| What a reviewer checks by judgment | the role, or its lens |
| What a role can prove with a command | the role's `checks`, then `team/checks.json` for this project |
| How Vik argues | the persona |
| Vik's sprite or class name | the view |
| Which tools Claude Code gives a reviewer | the adapter |
| Who reviews what, and which lenses are conditional | the party |
| Which seat works which station, and who may not review what they coded | the line |
| How the team looks while it runs | a renderer over the log, plus a skin |

If an edit seems to need two layers, the seam is probably in the wrong place. Say so in the ADR rather than smearing the change across both.
