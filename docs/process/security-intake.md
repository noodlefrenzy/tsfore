---
agent-notes: { ctx: "routing table: how a security learning becomes canon (ADR/directive/gate/threat-model/persona)", deps: [docs/adrs/template.md, docs/process/done-gate.md, docs/team-directives.md, docs/scaffolds/threat-model.md], state: active, last: "claude@2026-07-09" }
---

# Security Intake — Routing a Learning Into Canon

When a security idea arrives — from an incident, a review, a research dig, or a plain "we should always…" — the question is not only *is it good* but *where does it live so it actually takes effect*. Summon has several surfaces, and putting a rule in the wrong one either buries it (a directive nobody reads at the moment it matters) or over-weights it (a Critical Rule for a niche case). This doc is the repeatable path so each learning lands once, in the right place, instead of being re-litigated every time.

## Route by what kind of artifact the idea wants to be

An idea can hit more than one row — most substantial ones do. Decide the ADR question *first* (below), then place the spokes.

| If the idea is… | …it becomes a | Test to apply |
|---|---|---|
| a **default that ships into every scaffolded project** AND has real alternatives or a contested number | an **ADR** (`docs/adrs/`) | "Would a reasonable team resolve this differently? Does it need an 'Alternatives Considered'?" → yes = ADR |
| a low-ceremony **"always X / never Y"** with no real debate | a **directive** (`docs/team-directives.md`, under the owning persona's section) | "Obvious once stated, one sentence plus a why?" → yes = directive |
| a **per-work-item condition checkable at close time** | a **Done-Gate item** (with a proof grade) | "Must a change *pass* this before it's Done?" → yes = gate item |
| an **attacker capability, attack surface, or trust boundary** — not a rule | a **threat-model entry** (`docs/scaffolds/threat-model.md`; Pierrot owns, Archie contributes DFDs) | "Does it describe a threat/asset/data-flow rather than a policy?" → yes = threat-model |
| a **capability an agent performs** (a scan, a review lens, a fix routine) | a **persona responsibility** (`.claude/agents/*.md`) and/or a **slash command** (`.claude/commands/*.md`) | "Is this a thing an agent *does*, on demand or in a phase?" → yes = persona/command |

## The meta-rule: decide the ADR question first, and let the ADR be the hub

Most substantial security learnings produce **more than one artifact**. When they do, ask **"does this need an ADR"** before placing anything else:

- **If yes** — the ADR is the single source of the decision and the number, and the directive, gate item, command, persona note, and threat-model entry are all **spokes that cite it**. This is what stops drift: change the window, the default, or the rule once, in the ADR, and the spokes still read true. (See ADR-0010, whose 3-day cooldown number lives only in the ADR while five other files reference it.)
- **If no** — the idea lands on **exactly one** surface (a directive, or a gate item, or a threat-model entry) and stays there. Don't scatter a low-ceremony rule across four files; that's how canon rots.

Sub-items note: a Done-Gate addition that shouldn't change the headline item count (checked by `scripts/check-canon.mjs`) is written as an inline sub-item (`13b`, `13c`), mirroring the existing pattern — not a new top-level number.

## Worked routings

- **"External dependencies must age N days before adoption."** Ships into every project, has a contested number and a first-class exception to itself (the CVE fast-track) → **ADR** (0010) + directive + gate sub-item + command step + persona ownership. The full five-surface spread; the ADR is the hub.
- **"Pin CI actions to commit SHAs, not tags."** A checkable close-time condition with an obvious rule and no real alternative → **directive** (Ines) + Done-Gate sub-item. No ADR.
- **"A compromised maintainer publishes a malicious version."** Not a rule at all — it's the *threat* → a **threat-model entry** (Tampering / supply-chain), which the cooldown ADR then references as its mitigation. This is why the threat-model row matters: it's where the *why* behind several rules lives.
- **"An MCP server can be a rug-pull or exfil channel."** Both a threat (owner-harm C6, the supply surface) and a low-ceremony rule → **threat-model note** + **directive** (Pierrot). No ADR — no contested default.

## What NOT to route into canon

Not every security idea earns a home. Reject, or park as "further reading," anything that:

- requires a **runtime control plane Summon doesn't run** (sandboxes, dual-LLM architectures, model fine-tuning, trace-verification firewalls) — Summon emits docs and agents, not an executing host;
- adds **ceremony disproportionate to the risk** for a solo-dev-scale project (heavyweight policy DSLs, formal-methods proofs);
- is **already covered** by an existing surface — extend that surface instead of adding a parallel one.

A single "further reading" pointer is a legitimate outcome. Bloating the framework with controls nobody runs is worse than not adopting the idea at all.
