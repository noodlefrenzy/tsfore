---
agent-notes: { ctx: "third-party provenance record for adapted external material", deps: [CLAUDE.md, docs/process/doc-ownership.md], state: active, last: "claude@2026-08-04" }
---

# Attributions

Third-party material Summon has drawn on, and what was actually taken. Summon ships its canon into user projects via `npx summon-team`, so anything borrowed travels with it — this file travels too, and records what came from where.

**Owner:** Diego, with Pierrot on license terms.

## What belongs here

An entry is required whenever Summon carries a third party's **expression** — prose copied verbatim, or adapted closely enough that you could not have written it with the source closed. Ideas, vocabulary, and techniques carry no legal obligation (copyright does not cover procedures or methods), but we record notable ones anyway: Summon's whole argument is that decisions should be traceable, and "where did this rule come from?" is the same question as "who decided this?".

When adding an entry, also leave a one-line provenance note at the borrowing site, so a file that gets moved or copied downstream carries its own lineage.

## mattpocock/skills

- **Source:** <https://github.com/mattpocock/skills>
- **License:** MIT — Copyright (c) 2026 Matt Pocock. Full permission notice and warranty disclaimer: [`docs/licenses/mattpocock-skills-LICENSE.txt`](licenses/mattpocock-skills-LICENSE.txt), reproduced verbatim and shipped with this project.
- **Reviewed at:** commit `2ab9580` (2026-07-28)
- **Nature of use:** no `SKILL.md` file is vendored or copied whole. Four of the six sites below nonetheless carry **adapted expression** — structure, ordering, and some phrasing tracking the upstream text closely enough that they are derivative works, not merely shared ideas. They are labelled as such, and the MIT permission notice ships alongside them.

The fidelity column is graded by **diffing against the upstream text**, not by recalling intent. An earlier revision of this file graded from intent and understated four of six rows; the labels below were re-derived from an actual comparison.

| Summon file | Upstream source | What was taken | Fidelity |
|---|---|---|---|
| `docs/methodology/phases.md` § Phase 6 | `skills/engineering/diagnosing-bugs` | The feedback-loop entry gate (a named, already-run, red-capable command before any hypothesis), the minimise-before-hypothesising rule, and "no correct seam is itself the finding" | **Adapted expression** — criteria set and section order follow upstream; Summon adds the control run, repeat count, proof grades, named owners, and the evidence burden on the seam clause |
| `.claude/agents/sato.md` § Debugging | `skills/engineering/diagnosing-bugs` | The loop-shape ladder, loop-tightening mechanisms, and the instrument-one-prediction-at-a-time rule | **Adapted expression** — condensed, reordered, and rewritten against Summon's debt-marker convention |
| `.claude/commands/plan.md` | `skills/engineering/wayfinder` | "Not Yet Specified" and "Out of Scope" as plan sections, and the sharpness test that separates them (can you *state* the question precisely, not answer it) | **Adapted expression** — upstream's fog-of-war and out-of-scope sections, re-nouned to Summon's plan/work-item vocabulary and rewritten, but structurally derived |
| `docs/process/review-lenses.md` § Module Depth | `skills/engineering/codebase-design` | The deletion test, interface-as-test-surface, and depth-as-leverage | **Adapted expression** — check names and several glosses track upstream wording |
| `docs/team-directives.md` (Diego) | `skills/productivity/writing-great-skills` | The no-op test for agent prose, and prompting the positive rather than the prohibition | Idea — no shared phrasing on a diff |
| `docs/team-directives.md` (Archie) | `skills/engineering/to-tickets` | Expand → migrate → contract sequencing for a wide refactor | Idea — no shared phrasing on a diff |

**Deliberately not taken from `codebase-design`:** its "one adapter is hypothetical, two is real" test, which duplicates a YAGNI violation Summon already names in `.claude/agents/vik.md`; and its full module/seam/adapter lexicon, which would stand a second architectural vocabulary against `docs/glossary.md` and ADR-0009.

Summon's `docs/glossary.md` (ADR-0009) also originates from a 2026-07-07 audit of this repository's `domain-modeling` skill. That ADR adopted the glossary convention while rejecting the upstream file's name and placement; see `docs/history/tracking/2026-07-07-context-glossary-debate.md`.

**Not adopted, deliberately.** Three skills were reviewed and declined. Upstream ships none of the three in its own plugin manifest — they live under `skills/misc/` and `skills/in-progress/`, outside it — so declining them agrees with the author's own judgement rather than contradicting it.

- `git-guardrails-claude-code` — the hook script fails **open**. It pipes its input through `jq` with no `set -euo pipefail` and no dependency check, so on a machine without `jq` the command string is empty, no pattern matches, and the script exits 0 (allow). A guardrail that silently permits what it claims to block is worse than none, because it produces belief in protection that isn't there.
- `setup-pre-commit` — instructs `husky lint-staged prettier` with no versions plus `npx husky init`, which would resolve to whatever is latest at run time. Summon's release-age cooldown (ADR-0010) and dependency scan (ADR-0011) forbid that for our own installs; upstream is under no obligation to know or follow Summon's ADRs.
- `wizard` — writes captured API keys to a plaintext `.env` without asserting the file is gitignored. Writing a key to a local `.env` is ordinary practice, and the skill does several things right (hidden input, pushing CI secrets via `gh secret set` rather than to disk); it is declined because secret handling is a surface Summon should design deliberately rather than inherit, not because the code is careless. It is also marked in-progress upstream.

## design-notes (sibling repo, same author)

- **Source:** `../design-notes` — a personal, unpublished cross-repo design catalog by this project's author.
- **License:** n/a (same author). Recorded for traceability, not obligation.
- **Reviewed at:** 2026-08-05, for ADR-0013.
- **Nature of use:** **ideas only, no expression.** Graded by diffing the two files read (`references/TEMPLATE.md`, `principles/web/anti-patterns.md`) against ADR-0013's output; no shared phrasing, no shared structure. Taken: (a) that a design profile is a portable artifact worth a fixed shape — Summon's shape is its own, derived from `.claude/agents/dani.md`, and the upstream 9-section list was read and declined section by section in ADR-0013 §3; (b) that a design consultation must cite a repo path for every claim, which ADR-0013 §1 reuses as a citation discipline.
- **Deliberately not taken:** the `BAN:` anti-pattern list and the distilled `principles/web/` rules. Two reasons, and the second is the binding one. First, they are perishable taste rules with no maintainer inside Summon. Second, **provenance**: that file's own header credits "impeccable's detector rules, taste-skill's ban list, and our own tells," so copying it into shipped canon would launder two third parties' expression through a sibling repo — the attribution obligation would be to parties we never reviewed and cannot cite. Also not taken: `inspirations/` and `references/`, a personal catalog that is non-portable by construction, and the `design-consult` skill, whose own Notes state it "lives ONLY in design-notes."

## Prior art acknowledged in canon

These shape Summon's methodology without any of their text being carried:

- **Eric Evans**, *Domain-Driven Design* — the ubiquitous-language glossary (ADR-0009).
- **John Ousterhout**, *A Philosophy of Software Design* — deep modules. Summon's Module Depth sub-lens deliberately rejects his lines-ratio definition of depth in favour of depth-as-leverage.
- **Michael Feathers**, *Working Effectively with Legacy Code* — the seam concept underlying the test-surface check.
