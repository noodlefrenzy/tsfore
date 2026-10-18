---
agent-notes: { ctx: "ADR: adopt a domain glossary (docs/glossary.md) seeded with a fictional-domain example; process terms stay in spec docs; boundary vs code-map/agent-notes/spec-docs; downstream structural sensor; ownership", deps: [CLAUDE.md, docs/adrs/template.md, docs/methodology/phases.md, docs/process/done-gate.md, docs/process/doc-ownership.md, docs/scaffolds/code-map.md, docs/methodology/agent-notes.md, scripts/check-canon.mjs], state: accepted, last: "claude@2026-07-07" }
---

# ADR-0009: A Ubiquitous-Language Glossary (`docs/glossary.md`)

## Status

Accepted (2026-07-07) — ratified by the human after the Architecture Gate. Archie authored; Wei challenged as a standalone agent (six numbered challenges, five techniques); C1, C2, C3, C4, C5 conceded and reflected below, C6 dissolved once C1+C4 landed. The design changed materially from Round 1 — the "one artifact serves both framings" spine is retracted (§Retracted). The full Archie ↔ Wei debate is retained in Summon's development history. **OQ1 resolved at ratification: build the structural `health` check** (the human accepted Archie's argument over a possible YAGNI cut).

**This ADR is the spec, not the build.** It decides *whether* and *how* Summon adopts a domain glossary. The `docs/glossary.md` fictional-domain seed, the CLAUDE.md doc-index entry, the `doc-ownership.md` row, the structural check in the portable `health` registry, and the coined-term de-duplication pass across canon prose are a **single follow-up implementation PR**, sequenced after acceptance. Nothing here moves a file or edits code.

## Context

A five-persona audit of Matt Pocock's `domain-modeling` skill against Summon surfaced a **ubiquitous-language glossary** (Eric Evans / DDD) as Summon's single most-cited structural gap. Pat's evaluation confirmed it by grep: **zero hits** for `CONTEXT.md`, `glossary`, `ubiquitous`, or `domain model` anywhere in the repo. Summon has coined a substantial vocabulary and has no place that defines a project's *domain* language at all.

Two framings arrived, and Round 1 wrongly fused them. Round 2 (Wei's C5) forces them apart, and they **are** separable:

- **Need A — canon (Pat):** a scaffolded project has no domain glossary. A stranger scaffolding a payments app should keep a glossary of *their* domain terms (Order, Invoice, Customer). This is the DDD ubiquitous language: the language shared with *domain experts*. **This need has no artifact today.**
- **Need B — meta (Vik):** Summon re-explains its own coined *process* terms in its own prose. The fix is to write the coined noun bare and point to its canonical definition — **which already exists in a spec doc.** This need does not require a new artifact; it requires a de-duplication discipline against docs Summon already ships.

**Corrected verbosity evidence (Wei C3 — I had this wrong).** The exact parenthetical `(deterministic / inferential / human-judgement)` recurs at **two** canon sites, not four: `CLAUDE.md:67` and `.claude/commands/grill.md:21`. `done-gate.md` §Backpressure (lines 14–20) is the **authoritative definition** of proof grade — three bold headings, one per grade — not an inline re-teach; counting it as verbosity *and* exempting it (as Round 1 did) was self-contradictory. `grill.md:6` cites only two of the three grades in passing. So the re-explanation tax is real but **small** — a couple of sites, a handful of lines. **The line-savings is not the case for this ADR, and I will not pretend otherwise.** The case is Need A: there is no domain glossary, and DDD ubiquitous language is a discipline worth shipping.

### The real collision is glossary-vs-spec-doc (Wei C1), and it kills the Round-1 seed

Round 1 proposed seeding `docs/glossary.md` with Summon's process terms (proof grade, Architecture Gate, wave, …) and asserted "one definition, one place." That rule is **false on arrival**: every one of those terms is *already* authoritatively defined in a canonical spec doc — proof grade in `done-gate.md`, agent-notes in `agent-notes.md`, the phases/waves in `phases.md`, the debate protocol in `team-governance.md`. A glossary entry for "proof grade" would **duplicate** `done-gate.md`; when the Done Gate evolves, you edit two canon files or they drift. This is the collision that matters, and Round 1's boundary (§3) missed it entirely by comparing the glossary only to `code-map.md` and agent-notes. Wei is right; the seed as designed manufactures the exact drift the ADR exists to prevent.

### Seeding process jargon also contradicts the DDD authority I cited (Wei C4)

Evans' ubiquitous language is the **domain** language shared with domain experts. A payments domain expert does not speak "sentinel," "adversarial debate," or "debt marker." Seeding a user's *domain* glossary with 11 framework-process terms pollutes the artifact and front-loads jargon the expert scrolls past to reach Order/Invoice. The ADR-0008 analogy — which Round 1 leaned on — actually points the **other** way: 0008 ships a *fictional user-domain* example (SQLite vs Postgres) to teach the ADR shape. The faithful 0009-analog is a *fictional-domain glossary* (Order, Invoice, Customer) that teaches the **format and discipline**, not Summon's real process vocabulary.

## Retracted from Round 1

- **The "dogfooding and shipping are one act" spine is withdrawn.** It conflated "these terms *appear* in shipped docs" (true) with "these terms *belong as entries* in the shipped glossary" (false — they belong in their spec docs). The collapse made the "one artifact, no fork" conclusion look inevitable; it was rhetoric, not proof (Wei C5). The two needs are served by two mechanisms below.
- **Seeding the glossary with process terms is withdrawn** (C1 + C4). The glossary ships seeded with a fictional-domain example instead.

## Decision

**Adopt, scoped — two mechanisms for two separable needs.** Six parts.

### 1. The scope decision, made explicit (answers Wei C5)

I decide the two needs get **different** treatments, and I defend the split rather than derive it from a collapse:

- **Need A (domain glossary) gets a new canon artifact** because nothing serves it today.
- **Need B (Summon's own coined-term consistency) gets a discipline, not an artifact,** because the canonical definitions already exist in spec docs and are already indexed by `CLAUDE.md`'s Process-Docs table. Adding a second place that *defines* them would be the C1 drift generator; adding a second place that merely *points* to them is redundant with the doc index Summon already has. **I reject a separate framework term-index file as YAGNI** (considered and declined below).

The needs are separable, so I separate them. This is the scope; §2 and §3 execute it.

### 2. The canon artifact: `docs/glossary.md`, seeded with a fictional-domain example (answers C4)

A single glossary ships at **`docs/glossary.md`**. It is **canon** — it ships into every scaffolded project — and it follows the **true ADR-0008 pattern**: it ships seeded with a *fictional-domain* worked example (Order, Invoice, Customer, with `_Avoid_` synonyms) that teaches the format and the discipline, marked "example — replace with your project's terms." The user replaces it with their real domain vocabulary, elicited by Cam in Discovery and arbitrated by Archie in Architecture.

It contains **no Summon process terms.** Those live in their spec docs (§3). This is what dodges C1: with process terms excluded, the glossary and the spec docs define disjoint vocabularies (domain nouns vs process nouns), so there is nothing to duplicate and nothing to drift.

Naming: `glossary.md`, **not** Pocock's `CONTEXT.md` — in a Claude Code project "context" collides head-on with the model's context window and `CLAUDE.md`. Trade-off: we lose recognisability for readers who know Pocock's convention; accepted, the collision cost is higher. I also reject a multi-context / `CONTEXT-MAP.md` layout: Summon is one methodology; a scaffolded project can split its own glossary if it ever grows separately-bounded subdomains. Shipping the map machinery now is speculative.

### 3. The boundary — four artifacts, disjoint by design (answers C1's core: the boundary Round 1 defended was the wrong one)

The blur is not three artifacts, it is **four**, and the sharpest edge is glossary-vs-spec-doc:

| Artifact | Answers | Vocabulary it owns | Granularity |
|----------|---------|--------------------|-------------|
| **`docs/glossary.md`** | "What does this **domain word** mean?" | the user's *domain* terms (Order, Invoice) | project-wide |
| **spec docs** (`done-gate.md`, `phases.md`, `agent-notes.md`, `team-governance.md`) | "What does this **process term** mean, and how does it work?" | Summon's *methodology* terms (proof grade, wave, agent-notes) | project-wide |
| **`docs/code-map.md`** | "**Where** is this built / how does data flow?" | modules, packages, APIs | project-wide structure |
| **agent-notes** | "What is **this file**, should I open it?" | one file's purpose/deps | per-file |

**The single-source rule (this is the C1 fix, stated as an invariant):** a term is defined in exactly one home. A **domain** term's home is the glossary. A **process** term's home is its spec doc. **Neither re-defines the other's vocabulary.** When any prose — glossary, command, or spec doc — needs to reference a term defined elsewhere, it writes the coined noun **bare** and, at most, links the home doc ("proof grade — see `done-gate.md` § Backpressure"). A **pointer is not a definition**, so it creates no drift. This is also exactly Need B's fix: `CLAUDE.md:67` and `grill.md:21` stop dragging the parenthetical and point to `done-gate.md`, which is already their neighbour in the doc index.

Discriminator, total over "describe the project" facts: understand a **domain word** → glossary; understand a **process word** → spec doc; **find or trace** code → code-map; decide whether to **read a file** → agent-notes. Recorded in `doc-ownership.md` (§6) so the boundary is discoverable, not folklore.

### 4. Entry format

Adapted from Pocock's `CONTEXT-FORMAT.md`, for **domain** terms only:

```md
**Order**:
A customer's request to purchase one or more items, priced at time of placement.
_Avoid_: purchase, transaction, cart

**Invoice**:
A request for payment issued after an Order is fulfilled.
_Avoid_: bill, receipt
```

Rules (enforced by review; the deterministic subset by §5):

- **One definition, one home** (§3). Domain terms are defined here and referenced bare elsewhere; process terms are *never* defined here.
- **Define what it IS, not what it does.** One or two sentences, no implementation detail — a glossary is not a spec (Pocock's hard rule).
- **Be opinionated.** Competing synonyms: pick one, list the rest under `_Avoid_`. This doubles as a de-AI-tells lever against elegant-variation drift (`ai-tells-catalog.md`).
- **Domain terms only.** General programming concepts (timeout, cache) and Summon process terms both stay out.

### 5. Anti-rot: the structural check runs DOWNSTREAM, in the portable `health` registry (answers Wei C2)

The glossary is **canon — it ships**, so it rots in the **user's** project, where a solo dev hand-maintaining Order/Invoice is exactly who duplicates a heading. Round 1's error was putting the check in the `IS_SUMMON_REPO`-guarded `canon` set, which no-ops downstream — disabling the sensor precisely where the artifact rots. Wei's direction is right; his literal fix ("unguard the check-canon function") is **incomplete**, because a scaffolded project has no workspace wired to run `check-canon.mjs` at all (ADR-0004 §Context). The architecturally correct home is therefore the **portable `health` registry** (ADR-0004 Decision 2), which *is* built to run downstream on-demand via `npx summon-team doctor` against the user's project.

**BUILD (deterministic, in `health`) — a structural glossary check that runs downstream:**
  1. **No duplicate term headings** — each `**Term**:` entry is unique. Deterministic; the direct analog of `checkAdrNumbering`'s duplicate check; near-zero false positives.
  2. **The glossary is linked from `CLAUDE.md`'s doc index** — a Summon-managed-wiring assertion (the doc index is Summon-managed), so it fits `health`'s remit ("is this project's Summon-installed wiring intact").

Invoking ADR-0004 Decision 2 to *guard* this check was a misapplication (I made it in Round 1): that guard covers sensors introspecting *Summon's own layout*; this check introspects the *user's* glossary, which is precisely what `health` is for. So the check is **not** `IS_SUMMON_REPO`-guarded; in Summon's own repo `doctor` runs both registries, so the glossary is checked here too, but the invariant is enforced *where it ships*.

**DO NOT BUILD — a content-drift / re-explanation prose sensor.** Tempting to flag "the same definition appears in two files," but it is the false-positive-prone prose matcher that ADR-0007 §9 already cut for cause: it fires on legitimate pointers, cannot trend to zero, and cannot tell a re-definition from a valid use. **Content freshness — the glossary matching the domain as understood — is a review discipline** owned by Archie/Cam (the Pocock inline-sharpen habit), not a sensor.

**Why C6 (carrying cost) dissolves.** Wei's strongest carrying-cost objection — "the value has no sensor, the seed is the most rot-prone content, so ship-and-abandon is modal" — is **defused by the C1+C4 fixes, exactly as Wei conceded it would be.** The shipped glossary no longer mirrors evolving spec-doc definitions (process terms are excluded and pointed-to, not copied — C1), and its seed is a *static fictional example* (Order/Invoice) that does not track Summon's process churn (C4). The rot-prone content is gone. What remains — a user's own domain glossary — is guarded downstream for its one deterministic failure mode (duplicate headings) by the now-unguarded `health` check (C2), and its content freshness is the user's own discipline, which is true of every doc they own.

### 6. Ownership: Archie owns, Cam contributes

`docs/glossary.md` is a **design artifact** — canonical *domain* vocabulary is an architectural concern (naming boundaries, resolving overloaded terms). **Archie owns it**; I run the Pocock "sharpen fuzzy language / challenge against the glossary" discipline in Architecture. **Cam contributes in Discovery**, where a project's domain terms first surface (Pocock's "capture inline, don't batch"). Not Diego's: Diego owns release-facing docs; a living design glossary is upstream of release. `doc-ownership.md` gets one row and the §3 single-source rule.

### Considered and rejected: a separate framework term-index (Need B as an artifact)

A meta pointer-index of Summon's own process terms → their spec homes was considered as the concrete deliverable for Vik's need. **Rejected as YAGNI:** the spec docs are already the single source, and `CLAUDE.md`'s Process-Docs table already indexes them. A pointer-index that only re-lists them is redundant machinery; the de-duplication discipline (§3, write bare + link the existing home) serves Need B with no new file. If a future contributor still wants one lookup surface, it is a rider on the doc index, not a new artifact.

## Where this ADR lives — CANON (`docs/adrs/0009-…`), stronger after Round 2

By ADR-0007 §1's subject test — *"when a stranger scaffolds a payments app, does this file help them build it?"* — this ADR is **canon**. Its decision is a portable methodology practice (keep a domain glossary), the shape of ADR-0002 (TDD) and ADR-0008 (the example datastore ADR). Round 2 *strengthens* the ruling: with process terms removed from the shipped artifact (C4), there is no longer any Summon-internal vocabulary baked into what ships — the glossary is a clean fictional-domain example, exactly ADR-0008's pattern. The only meta component, the `health` structural check, is code in the CLI, not this ADR's subject.

Numbering: 0009 in `docs/adrs/` keeps the union of `adrs/` (0001–0003, 0008–0009) and `adrs/meta/` (0004–0007) contiguous 1–9, which `checkAdrNumbering` enforces.

## Consequences

### Positive

- **Closes the real gap with the right artifact.** Scaffolded projects gain a DDD domain-vocabulary discipline they had zero of, shipped as a clean fictional-domain example — no process jargon polluting the domain language Evans defines.
- **No new drift edge.** Process terms keep their single home in the spec docs; the glossary owns a disjoint vocabulary (domain terms). The C1 duplication is designed out, not merely policed.
- **The anti-rot sensor runs where the artifact rots** — downstream, in the user's project, via the portable `health` registry, catching the one failure a solo maintainer actually hits (a duplicated term heading).
- **Need B is served without a new file.** The de-duplication discipline (write the coined noun bare, link its spec home) removes the small re-explanation tax at its two real sites and adds no maintenance surface.
- **A de-AI-tells lever.** The opinionated `_Avoid_` list suppresses elegant-variation drift the `ai-tells-catalog.md` fights.

### Negative

- **A fourth project-describing artifact is genuine new surface.** Glossary, spec docs, code-map, and agent-notes must be kept disjoint. Mitigation: the §3 single-source rule makes the split total (domain vs process vs structure vs per-file) and is recorded in `doc-ownership.md` — but the boundary between "domain term" and "process term" is enforced by review judgement, and a contributor could still file a process term into the glossary. The duplicate-heading sensor will not catch that; only review will.
- **The line-savings justification is weak, and Round 2 made it weaker** (the tax is two sites, not four). If the case rested on line count it would fail; it rests on Need A (no domain glossary exists) and DDD discipline. A reader expecting a big number will be underwhelmed — corrected in §Context.
- **Content freshness of the user's glossary has no sensor,** by deliberate choice (§5): glossary-vs-domain drift is caught only by Archie/Cam review. Accepted — the alternative is the prose-matcher trap ADR-0007 §9 rejected, and this is true of every doc a user owns.
- **Placing the check in `health` couples it to the `doctor` invocation path** (ADR-0004), which requires Node + network downstream. Accepted: `doctor` is a developer-invoked diagnostic, and `health` is the only path from which "the check runs in the user's project" is true without vendoring a copy that rots.

### Neutral

- **`docs/glossary.md` ships as a fictional-domain example** (ADR-0008 pattern: ship real, meaty content to learn from, then replace) — not an empty stub and not pre-seeded with methodology terms.
- **We diverge from Pocock's `CONTEXT.md` name and root placement.** `docs/glossary.md` avoids the context-window collision; lineage credited, convention adapted.
- **The multi-context map and a framework term-index are both deferred, not rejected forever.** Either can be added by the project that actually needs it.

### Open questions (for the Architecture Gate)

- **OQ1 — Is even the structural `health` check worth building for a one-file artifact?** I argued yes: duplicate-heading is the one deterministic failure a hand-maintained glossary hits, it runs downstream where that happens (C2), and it is ~15 structured lines. Wei may still push YAGNI on a single-file check. **RESOLVED at ratification (2026-07-07): build it.** The human accepted the argument; the `health` check is in scope for the follow-up implementation PR.
- **OQ2 — Domain-vs-process term classification is review judgement.** Is a boundary that relies on a reviewer distinguishing "Order" (glossary) from "wave" (spec doc) robust enough, or does it need a lint? I hold it does not — the distinction is obvious in practice and a lint would be the false-positive-prone prose matcher §5 rejects. Open.
- **OQ3 — Ownership: Archie-owns / Cam-contributes, or Cam outright** given that most *domain* terms surface in Discovery? I chose Archie because term *arbitration* is an architectural call; the Discovery-heavy elicitation is a fair argument to flip it. Open.
