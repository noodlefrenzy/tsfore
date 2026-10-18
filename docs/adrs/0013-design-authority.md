---
agent-notes: { ctx: "ADR: what design authority Dani answers to, the project design-profile stub, and the amendment to Done Gate 8b", deps: [CLAUDE.md, docs/adrs/template.md, docs/process/done-gate.md, docs/methodology/personas.md, .claude/agents/dani.md, docs/attributions.md], state: accepted, last: "claude@2026-08-05", key: ["resolution order keys on files present, not config", "external-catalog branch dropped", "floor is a sensor, not a ban list", "8b amended not added", "no dependency on ADR-0014", "COST AMENDED 2026-08-05: §6 step 1's dependency claim + §258 were false; ordering unchanged (:185 orders by value)", "§6 step 1 rescoped into slice A (zero-dep, may not be gate-wired) and slice B (browser, deferred)", "SHAPE AMENDED 2026-08-05: slice A measured, the measurement refuted at gate — contrast KEPT and widened to ancestor-scoped single-file pairs (~35, not 1); motion check must split motion vs paint properties"] }
---

# ADR-0013: Design Authority — What Dani Answers To

## Status

**Accepted** (2026-08-05) — ratified by the human at the Architecture Gate, with the § 5 rule 4 position ("Summon ships no taste") and its closed-door consequence explicitly on the record at ratification. Authored by Archie; challenged by Wei, debate record at `docs/history/tracking/2026-08-05-design-authority-and-addons-debate.md`. Wei's Round-1 challenges aimed at this ADR are C3 (blocking), C4, C5, C6, C7 (amendments demanded), C9 (argument), plus the design-vocabulary half of C2. All seven are answered in § Responses to the Architecture Gate; **four of them changed the design**, one materially (the external-catalog branch is gone).

**This ADR is the spec, not the build.** Nothing here edits `.claude/agents/dani.md`, `docs/process/done-gate.md`, `docs/attributions.md`, or anything in `packages/`. Every change those files need is written out verbatim below for a follow-up implementation PR to apply. Precedent: ADR-0007 and ADR-0012 were both spec-only.

**No dependency on ADR-0014.** Per C6 — this ADR has **zero** hard dependency on `docs/adrs/meta/0014-optional-addons.md` (optional third-party add-ons, first instance `impeccable`). Nothing here requires an add-on to exist, install, or be reachable. Every decision below holds on an install with no add-ons, which is the modal install. ADR-0013 can be ratified, implemented, and reversed independently of ADR-0014, and it should be — this half is docs-only and reversible, the other half is security-gated. The only contact point is § 5 (the seam), which states what happens *if* an add-on is ever present, and degrades to a no-op when one is not.

**Amended twice on 2026-08-05, both in § 6, both in place; the Decision is unchanged.** (1) A *cost amendment* — § 6 step 1's dependency claim and Consequences positive 6 were false and are corrected; the ordering was challenged and **survived**, and step 1 was rescoped into slice A / slice B. (2) A *shape amendment* — slice A was implemented and measured; the measurement was then **refuted at a second gate**, so slice A's contrast check is **kept** with its pairing rule widened, and its motion check is corrected. Struck text is left visible rather than deleted. Neither touches Status, which remains **Accepted**.

## Classification: canon

Per ADR-0007 §1 — *"a file is canon if it is about the user's project or the methodology they practice."* Ask the test question: when a stranger scaffolds a payments app with `summon-team`, does this file help *them*? Yes. It defines when their Dani may make a visual judgment, what a design profile in *their* repo means, and which Done Gate item their UI work must clear. That is methodology, not Summon's plumbing. It sits in the canon zone `docs/adrs/`, alongside 0001 (conventional commits), 0002 (TDD), 0003 (risk tiers) — all rules the user's project runs.

**The classification is load-bearing, and it did real work here.** The original three-branch proposal contained a *meta* element hiding inside a canon ADR: a "configured external catalog" branch that pointed at `../design-notes`, a personal sibling repo no scaffolded user has. Under §1 that branch fails the stranger test outright — it only makes sense to someone working on Summon. Rather than split the ADR or ship a canon file with a meta limb, **the branch is dropped** (§ 2). The meta residue is recorded once, in § 7, as a personal workflow note, and it ships nowhere.

**Dependency hygiene.** `scripts/check-canon.mjs` fails CI on a canon→meta edge, so this file's `deps` list names only canon files. ADR-0012 and ADR-0014 are meta and are cited in prose by title, deliberately not carried as declared dependencies — this ADR must remain readable and applicable in a scaffolded project where those files do not exist. Where an ADR-0012 mechanism is invoked below (the receipt rule, the capability registry), the invocation is written so that its absence degrades to prose discipline rather than to a dangling reference.

## Context

Dani is thin. `.claude/agents/dani.md` carries a prose WCAG checklist — 4.5:1 contrast, `prefers-reduced-motion`, focus order, bundle budgets, cross-browser — and **not one sensor**. Her trigger rule fires on any `.svelte`/`.tsx`/`.jsx`/`.vue`/CSS/SCSS change, so she runs often; what she does when she runs is read files and form an opinion. Relative to Vik (review lenses), Tara (tests that fail), and Pierrot (threat model, security intake), she has the least ability to be *wrong on the record* and the least ability to stop anything.

Two distinct gaps hide under "Dani is thin," and conflating them is what produced the original over-scoped proposal:

1. **No authority.** When Dani reviews a UI change, there is nothing in the repo that says what this project's design is *supposed* to look like. So she either (a) says nothing beyond accessibility, or (b) invents taste on the spot and states it with the same confidence as a WCAG citation. (b) is the actual failure mode: an agent asserting "this spacing is wrong" with no cited source is indistinguishable, to the human reading it, from an agent citing a real house rule. That is the same overclaim problem the Done Gate's proof grades exist to police.
2. **No sensor.** The rules she *does* have — contrast ratios, reduced-motion — are deterministically checkable today, on every runtime and every plan tier, by a script. Nobody wrote it. Done Gate item 8 already names "deterministic aids: axe/Lighthouse" as if they existed. They do not.

The immediate trigger was a proposal to import design capability from a sibling repo, `../design-notes`, which has three separable layers: a personal cross-repo catalog (`inspirations/`, `references/` — non-portable by construction); distilled craft principles under `principles/web/` each ending in a grep-able `## Rules` block, including an `anti-patterns.md` whose ban list **its own header credits to "impeccable's detector rules, taste-skill's ban list, and our own tells"**; and a `design-consult` skill whose own Notes state it *"lives ONLY in design-notes; sibling repos reach it by opening a session here."*

That third fact is the whole story. The sibling repo's most useful layer is explicitly non-portable *by its author's own design*, and its second-most-useful layer is derived from two third parties. A proposal to "integrate design-notes into Summon" is therefore mostly a proposal to copy other people's ban lists through an intermediary, for an audience of one.

Meanwhile the modal `npx summon-team` user has: no design-notes, no add-on (ADR-0014 defaults to no), and frequently no design system at all — a solo dev on a fresh project. **Any design authority mechanism that only functions when an external catalog is reachable is a mechanism that does nothing for almost everyone who installs Summon.**

## Decision

Seven parts. §1 is the durable rule; §§2–7 apply it.

### 1. What "design authority" means, and Dani's resolution order

**Definition.** *Design authority* is the ordered set of in-repo sources Dani must consult, and must cite, before asserting any visual judgment that is not an accessibility fact. It is a **citation discipline**, not a knowledge base. Its purpose is to make the difference between "the house rule says X" and "I think X" visible to the human in every Dani finding.

**Resolution order.** Dani resolves authority by **files present in the repository**, top-down, first hit wins:

| | Source | Present when | Dani's obligation |
|---|---|---|---|
| **D1** | `docs/design-profile.md` (the project's own design profile — § 3) | The user filled in the scaffolded stub | Authoritative. Cite the section. A change that contradicts it is an **Important** finding; a change that contradicts it *knowingly and in writing* is fine (the profile is amendable — say so in the PR). |
| **D2** | Design artifacts belonging to an installed add-on (e.g. a `DESIGN.md` an add-on generates) | Only if ADR-0014 is ratified **and** the user opted in | Advisory, subordinate to D1. Cite by path and name the add-on. Never presented as Summon's rule. |
| **D3** | Neither | The modal case | See below. |

**What Dani owes at D3 — the part that matters most, because it is the common case.** With no design profile and no add-on, Dani is restricted to claims she can source, and she must say so once, plainly, in her report: *"This project has no design profile; findings below are accessibility and internal-consistency only."* Concretely, at D3 she may raise:

- **Accessibility findings** — cited to WCAG criterion, and (once § 6 lands) backed by the design-floor script's output rather than her reading.
- **Internal-consistency findings** — "this component hardcodes `#3b82f6` while every sibling uses `var(--color-accent)`" is a sourced claim; the source is the repo. This is the single highest-value thing Dani can do without a profile, and it is checkable.
- **Questions to the human** — taste calls are raised as *questions*, never as findings: "no profile defines heading scale; is 1.25 intentional?"

And she may **not** assert an unsourced aesthetic preference as a finding. Not "this needs more whitespace." Not a ban on gradients. If Summon has no opinion, Dani says Summon has no opinion. This is the correct answer to "what does Dani owe when there is no authority," and it is deliberately unglamorous: **at D3 the honest deliverable is a smaller report, not a synthesised one.**

**Standing offer, once per project.** The first time Dani runs at D3 on a repo that contains UI files, she offers exactly once: *"There's no `docs/design-profile.md`. Want to fill in the stub? It takes about ten minutes and makes every later review sharper."* Once, then never again — a nag on every review is how a good prompt becomes noise the user learns to skip.

### 2. The config surface: there isn't one, and that is the decision

Per C7 — **the "configured external catalog" branch is dropped.** Not deferred, not shrunk: removed from the design.

Reasoning: a config key pointing at an out-of-repo catalog is a canon feature whose only reachable target is one person's private repo. It fails ADR-0007 §1's stranger test, it would need a home (ADR-0006's manifest? the ADR-0012 §E registry?) and thereby a schema, a validator, a doctor probe, and a failure mode when the path is stale — permanent public surface, `n=1`, on a capability whose value is "look something up somewhere else."

**So the resolution order keys on files present in the repo, and nothing else.** No manifest key, no registry pointer, no environment variable, no path config. `docs/design-profile.md` either exists or it does not.

**How a real external catalog reaches a Summon project, if anyone ever has one:** by producing a design profile and putting it in the repo. § 3's stub *is* the portable format — that is the answer to Wei's "define a catalog format other repos could produce." A design system's owner writes one profile per consuming project (or one canonical profile, copied in). This is deliberately dumb: a file, vendored, versioned with the code that obeys it, diffable in the PR that changes it, and with no live dependency on a repo the user may not have checked out. A vendored profile also cannot silently change under a project mid-sprint, which a linked catalog can.

**Capability-registry entries this ADR will owe.** ADR-0012 §E requires every advertised capability to carry a registry entry with status and enforcement level. That registry is itself unbuilt and sequenced first in ADR-0012's own plan, so **no entry can be added today** — this ADR instead names the entries it owes so the registry's first population does not have to re-derive them:

| Capability | Status | Required primitive | Enforcement level |
|---|---|---|---|
| `design-authority-resolution` | implemented on ratification | none | **prose** (agent discipline; no sensor possible — "did Dani cite her source" is not decidable from tree state) |
| `design-floor-check` (§ 6) | planned | Node + a headless browser | **script** — deterministic, runs on every runtime and plan tier |
| `design-profile-stub` | implemented on ratification | none | **scaffold output** |

If the registry never ships, these three rows are still the honest inventory and belong in whatever replaces it. **UNRESOLVED:** whether `design-floor-check` should additionally register as a Done-Gate-bound check once the receipt schema exists (§ 4) — that binding cannot be specified before the schema it depends on, which I own and have not designed.

### 3. The `docs/scaffolds/design-profile.md` stub

A stub ships at `docs/scaffolds/design-profile.md` and moves to `docs/design-profile.md` during `/scaffold` or `/kickoff`, per the existing scaffolds convention (`docs/scaffolds/` files relocate to their final locations; CLAUDE.md documents this and `threat-model.md` is the existing precedent).

**What actually transfers from a 9-section catalog profile format, and what is catalog-specific noise.** I read `../design-notes/references/TEMPLATE.md` for shape confirmation. Its 9-section format is itself credited upstream in its own header comment ("pattern from VoltAgent/awesome-claude-design"), so adopting the section list wholesale would carry a second-hand structure two hops from its origin, for the sake of shape. **The section list is not adopted.** The stub below is derived from what Dani actually needs to cite during a review — i.e. from `.claude/agents/dani.md`, which is ours.

Mapping, stated so the decision is auditable:

| Catalog-profile section | Verdict |
|---|---|
| Visual theme & atmosphere | **Transfers**, condensed into "Feel," and only because it is the field that lets Dani distinguish "wrong for this project" from "not to my taste." |
| Color palette & roles | **Transfers.** Tokens with roles are the highest-value field: it converts most colour findings from taste to consistency. |
| Typography rules | **Transfers**, condensed. Scale and faces; the pairing-logic essay does not. |
| Layout principles | **Transfers**, condensed to spacing scale + max width. |
| Do's and don'ts | **Transfers as "House rules"** — but authored by the project, empty by default. See § 5 on why Summon ships no rules here. |
| Agent prompt guide | **Transfers**, as "What Dani must check" — this is the field that makes the profile *actionable* rather than descriptive, and it is the one I would keep if I could keep only one. |
| Component stylings | **Noise for a stub.** A component vocabulary is discovered, not declared; an empty table invites fabrication. It belongs in the codebase. |
| Depth & elevation | **Noise for a stub.** Too fine-grained to be true on day one; folds into Feel. |
| Responsive behavior | **Noise for a stub** in this form — the useful residue ("what must survive every width") folds into "What Dani must check." |
| "Scope: a sibling repo, an admired external brand" framing | **Catalog-specific.** A catalog profiles *many* systems it does not own; a project has *one* system it does own. |
| Anti-references (what this must never look like) | **Catalog-specific and personal.** These are one person's dislikes. Available to the user as a free-text line under Feel; Summon supplies none. |

**Proposed stub content** (for the implementation PR; agent-notes elided here):

```markdown
# Design Profile — <Project>

Fill this in and Dani cites it. Leave it blank and Dani is limited to accessibility
and internal consistency — which is a fine place to be. Delete any section that
does not apply. Ten minutes now, sharper reviews forever.

**Status:** _unfilled_ · **Owner:** _<who decides visual questions>_

## Feel
Two or three sentences. What this should feel like to use. Optionally: what it
must never feel like.

## Colour tokens and roles
| Token | Value | Role | Notes |
|---|---|---|---|
| | | | |
Contrast floor for body text: 4.5:1 (WCAG AA) unless stated otherwise here.

## Type
Faces, what each is for, and the scale. One line each.

## Layout
Spacing scale, max content width, density. One line each.

## House rules
Project-specific do's and don'ts, blunt and imperative, each with its reason.
Summon ships none of these — they are yours. A rule without a reason will be
argued with.

## What Dani must check
The checks this project wants run before UI work is Done, beyond the standard
accessibility pass. Name the file or command that is ground truth where one
exists. Name anything that requires human sign-off rather than agent judgment.
```

The stub is canon (a user fills it in for their project — ADR-0007 §1, same as `docs/scaffolds/threat-model.md`).

### 4. Done Gate: amend item 8b, do not add an item

Per C4 — the item exists. `docs/process/done-gate.md:33`, added `vik@2026-06-15`. Adding a "visual proof" item would have produced a duplicate or a silent wording conflict with canon. **This ADR amends 8b and leaves item 8 alone except for one addition tied to § 6.**

Per C5 — **the grade stays `inferential` and the word "proof" does not appear.** A screenshot an agent takes, looks at, and declares fine is self-authored evidence with no binding to tree state; ADR-0012's interim receipt rule holds that a format-valid sentinel is still self-authored evidence, and a screenshot is weaker than a sentinel because it also requires the agent to *interpret* it. Design authority does not change the grade — knowing what the page is supposed to look like makes the judgment better, not the evidence stronger. What raises this item's grade is § 6's script, not this ADR.

The amendment does three things: names what the screenshot must show, names what invalidates it, and hooks the profile in.

**Proposed replacement wording for item 8b** (verbatim, for the implementation PR to apply at `docs/process/done-gate.md:33`):

> **8b. Visual verification** *(inferential — screenshot evidence, self-authored; see "what invalidates this" below)* — if this item changes UI files (`ui/`, `pages/`, `components/`, templates, CSS, layouts), open the affected page(s) in a browser (via Playwright `browser_navigate` + `browser_take_screenshot`, or manual check) and confirm they render. This is not a full E2E suite — it is "does it render." Not applicable to CLIs, libraries, or backend-only services.
>
> The evidence must show, and the report must state: (1) the page rendered with no console errors — paste the console output, not a summary of it; (2) the specific element this item changed, visible in frame; (3) the commit SHA of the working tree when the screenshot was taken.
>
> **What invalidates this evidence:** any subsequent write to a UI file, stylesheet, or template; any dependency or build-config change; a screenshot taken at a different commit than the one being closed. If the tree moved after the screenshot, retake it. A screenshot is not proof and must not be described as one — it is the weakest grade of evidence on this gate, and it is accepted because "does it render" has no cheaper honest test today.
>
> **If `docs/design-profile.md` exists**, also name which of its sections the change touches, and confirm the rendered result is consistent with them — or state, in writing, that it deliberately departs and why. Dani owns this call.

Note what is deliberately *not* claimed: the SHA requirement makes staleness **detectable by a human reading the report**, not **detected by a machine**. Binding evidence to tree state so that staleness is caught automatically is exactly the receipt schema ADR-0012 deferred to me, and it is not designed. This wording is the honest interim: the failure mode moves from invisible to visible, which is a real improvement and not the same as solving it.

**One addition to item 8** (accessibility), gated on § 6 landing — do not apply this until the script exists:

> Once `design-floor-check` is available, item 8 requires its output: run it and paste the result. Dani's review is then interpretation of a sensor reading, not a substitute for one. Item 8's grade moves from *inferential* to *deterministic* for the criteria the script covers, and stays *inferential* for the rest (focus order, cross-browser, "does this make sense").

### 5. The Summon/add-on seam, in design vocabulary

The proposed framing was *"Summon owns process, impeccable owns craft, Dani routes."* Wei calls it a slogan hiding a two-kings problem. **Agreed as to "Dani routes" — that verb was doing no work.** The hooks-and-installation half of the two-kings problem belongs to ADR-0014 and is not mine. The design-vocabulary half is, and here it is, stated as rules rather than a slogan:

1. **Precedence is D1 > D2 > D3** (§ 1). A project's own profile outranks anything an add-on generated. An add-on's design artifacts never silently become the project's design authority — they enter at D2, cited by path and by add-on name, so the human can always see which king spoke.
2. **The Done Gate is the release gate. Full stop.** An add-on's quality floor may block work that Summon's gate would pass — that is the user's choice in installing it, and Summon does not override it. An add-on's floor may **never** satisfy, waive, or substitute for a Done Gate item. There is no "impeccable passed, so 8b is covered." **More strict is allowed; less strict is not; equivalence is not claimed.** That is the entire conflict-resolution rule, and it is deliberately one-directional so there is no arbitration to litigate.
3. **Dani is the single reporting surface, not a router.** Findings from any source arrive to the human as Dani findings with the source cited inline. She does not forward, delegate, or defer to a third party's judgment — she reports it, attributed, and remains accountable for whether it applies. If an add-on's rule is wrong for this project, Dani says so.
4. **Summon ships no taste.** Summon's design vocabulary consists of accessibility criteria (external standards, not our expression) and internal consistency (derived from the user's own code). Everything aesthetic lives in the user's profile or an add-on. This is why there is no two-kings problem in the *vocabulary* half: Summon is not a claimant.

Rule 4 is also why § 3's "House rules" section ships empty, and § 6's floor contains no taste rules.

### 6. Sequencing: C9's sensor goes first

Wei's C9 argues the highest-value design work here needs no third party: Dani's existing rules are deterministically checkable today, the Script layer is available on every runtime and plan tier, ADR-0012 §B's ratified amendment makes a checkable rule left in prose *after its layer is available* a defect **now** without waiting for an observed failure, and item 8 already advertises aids nobody built. *"Dani's problem isn't that she lacks a catalog to consult; it's that her existing rules can't fail a build."*

**This is correct, and it is accepted as a prerequisite ordering rather than as a competing alternative.** It is not either/or: the sensor answers gap (2) from Context and the protocol answers gap (1), and they do not substitute for each other — a script cannot tell you the heading scale is wrong for this project, and a profile cannot fail a build. But if only one ships, the sensor is worth more, so it ships first.

Ratification order:

1. **`design-floor-check` — a script.** axe (or equivalent) + computed contrast + `prefers-reduced-motion` honoured + console-error capture, run against a rendered page. ~~No new runtime dependency beyond the headless browser Playwright already implies for 8b~~; no third-party skill; no supply-chain exposure beyond one well-known audited library, subject to ADR-0010's release-age cooldown and ADR-0011's scan like anything else. ~~Smaller than everything else in this ADR.~~

   **Cost amendment (named explicitly, per ADR-0012 § B's instrument), 2026-08-05.** The struck clauses are **false and are hereby corrected**; this step's *position* is unchanged. Two errors: (a) 8b's Playwright is an **MCP server** — `browser_navigate` and `browser_take_screenshot` are agent-side tool names (`docs/process/done-gate.md:33`), so 8b implies **no project dependency at all** and there was no already-paid cost to inherit; (b) "smaller than everything else" ranked on one axis. A script cannot call MCP tools, so the browser half needs `axe-core` plus a browser driver as real devDependencies — the **first dependency Summon has ever shipped**, into a scaffold that excludes the root `package.json` (`packages/summon-team/src/index.ts:47`) and whose every existing script is zero-dep stdlib Node. This is a deliberate correction to a ratified cost estimate, on the record here, and its consequence is priced in Consequences (positive 6, negative 3). **What is *not* amended is the ordering**: § 6 orders by value (`:185`, "if only one ships, the sensor is worth more"), not by size, and nothing found has changed what is worth more. Step 1 therefore stays first, **rescoped into two slices**:

   - **Slice A — static, zero-dependency, stdlib Node** (ships like `scripts/check-canon.mjs`): `prefers-reduced-motion` coverage, and arithmetic contrast on foreground/background pairs co-declared at a CSS declaration site — **widened to ancestor-scoped pairs within one file, per the shape amendment below**. Carries none of the cost above.
   - **Slice B — requires a browser** (axe DOM pass, computed/inherited contrast, console-error capture): carries the dependency decision. Deferred, **not promised**. It may **not** inherit § 6's script-over-hook justification — ADR-0012 § B's tie-breaker ("runs on every runtime and plan tier") holds only for a zero-dep script, so slice B must re-argue its form, and an agent-side MCP check is a live alternative to it.

   **Shape amendment (slice A measured, then the measurement refuted), 2026-08-05.** The amendment above specified slice A's contents without measuring them. A probe implementing slice A *exactly as written* was run against Summon's own site (`site/src/styles/global.css`, `site/src/components/TeamGrid.astro` — 384 lines, the whole source CSS surface) and reported **one** contrast pair, prompting a proposal to strike the contrast check on yield. **That proposal was refuted at a second gate and is withdrawn.** What follows is what survived. Evidence on #75.

   - **Contrast — kept, and its specified pairing rule widened.** The "one pair" number measured *the probe's shape, not the domain*: `co-declared on one selector` is the narrowest possible pairing rule. Widening to **ancestor-scoped pairs within a single file** — a background on `.hero-card` against `color` on its descendants, both literals in that file — yields roughly **35** statically resolvable pairs on the same 384 lines. Slice A therefore checks ancestor-scoped, single-file, literal-resolvable pairs. Cross-file, inherited, and computed pairs remain slice B's.
   - **The corpus was not clean, which settles the yield question.** Two of the 16 hero accents fall below WCAG 1.4.11's 3:1 as a hover `border-color` against `.hero-card`'s `#0f172a`: Pierrot `#7f1d1d` at **1.78:1** and Pat `#9f1239` at **2.23:1**. The accents are literals in the same file's frontmatter, so both are statically reachable. `TeamGrid.astro:148-155` shows Dani reasoned about *these two specific costumes* in 3:1 terms and recorded the mitigation as **a CSS comment with no sensor behind it** — § Context gap (2), verbatim, in the corpus the probe declared clean. A check that surfaces an unadjudicated judgment call has yield; "it reconfirms what a human already computed" was an artifact of finding only the one pair a human had annotated.
   - **Motion — kept, and the specified form is a false negative.** As written it is a *file-level existence* test: it returns PASS on `global.css` while two of three animated declarations sit outside every reduced-motion block. The code is nonetheless correct — those two are **paint** transitions (`background`, `border-color`), and WCAG SC 2.3.3's note excludes changes of colour or opacity from "motion animation" — so the naive per-declaration fix would trade the false negative for a false positive. Slice A must split on **motion properties** (`transform`, `translate`, `rotate`, `scale`, `animation`) versus paint properties. Whether a block covers *that selector* is selector matching, is out of scope, and is a standing reason this stays advisory.

   **On the yield instrument itself.** Defects-found-on-a-corpus is the wrong measure for a **regression guard**, and it was applied in one direction only: the same probe run found **zero** `animation:` declarations and **zero** `autoplay` attributes in those 384 lines, so a proposed "no auto-playing animations" check (`dani.md:80`'s second clause) scores lower than the check it was offered to replace. It is **not** added here; greppability is not yield. The corpus is also contaminated for this purpose — it was styled by Dani holding the contrast rule, and `global.css:5-6` is the fossil of a real defect (`#6366f1` at 4.47:1) that a human caught. A smoke detector that does not sound in a house that is not burning has not failed its evaluation. Slice A's measure is **pairs covered**, plus whether it would have caught the defects we know occurred; not defect count on a hardened corpus.

   **Consequence for ADR-0012 § B's ledger.** Both are checkable rules sitting in prose after the Script layer became available (`dani.md:78` contrast, `:80` motion), so § B's defect claim was correctly stated and **both remain slice A's to retire, in part**. An earlier draft of this amendment asserted contrast "cannot be paid down by any static script"; that is withdrawn as an overreach refuted by its own supporting example — `class="bg-indigo-600 text-white"` is a co-declared pair against a published constant palette, with no cascade to resolve, and is *easier* to check statically than CSS, not impossible. What is **not** changed: none of this lets Dani's rules fail a build, and Wei's asymmetry argument concerns a sensor that can fail a build. It may not be borrowed to justify shipping slice A — but it does cut against dropping slice A, since shipping it advisory is the only instrument that would ever measure its yield on real projects.

   **Binding constraint on slice A — it may not be wired into the Done Gate under this name.** A static check passes green on a page with no `alt` text, unlabeled form inputs, `div` click handlers with no keyboard path, no landmarks, and inverted heading order — most of what axe catches and most of what actually blocks users. Shipping that as `design-floor-check` behind Done Gate item 8 would manufacture gate confidence at zero cost, which is the false-green failure this ADR's own trigger 2 logic condemns. Slice A ships under an honest narrow name, advisory, and **item 8's deterministic upgrade (step 4) stays gated on slice B**, not on slice A. The false-*negative* rate is the measurement this ADR failed to ask for.
2. **The 8b amendment** (§ 4) — prose, near-zero cost, ships alongside (1).
3. **The stub + Dani's protocol** (§§ 1, 3) — docs-only.
4. **Item 8's deterministic upgrade** (§ 4's second block) — after (1) is proven in real reviews.

If the implementation PR can only carry part of this, it carries 1 and 2.

**Honest accounting:** by §B's ratified amendment, the *current* state — contrast and reduced-motion sitting in `dani.md` as prose while the Script layer is available — is a defect today, independent of this ADR. This ADR does not create that defect and does not fully retire it either; it schedules the fix and names it as pre-existing rather than letting it ride as new scope. § B's own tie-breaker ("when a script achieves the same determinism as a hook, prefer the script — it runs on every runtime and plan tier") is why (1) is a script and not a hook.

### 7. Attribution: no entry is owed for expression; a short entry is owed anyway

`docs/attributions.md` requires an entry whenever Summon carries a third party's **expression** — prose copied verbatim, or adapted closely enough that you could not have written it with the source closed. Its header also demands fidelity be graded by **diffing against the source text, not by recalling intent**, and records that an earlier revision got this wrong by grading from intent and understated four of six rows.

**Graded by diff, not intent, this ADR carries no expression from design-notes.** The two files read were `references/TEMPLATE.md` and `principles/web/anti-patterns.md`. Nothing from either appears here:

- The `BAN:` list is **not** copied, quoted, paraphrased, or restated — no ban of any kind appears in § 3's stub or § 6's floor, and § 5 rule 4 forbids Summon shipping taste rules at all. There is no line to diff.
- TEMPLATE.md's 9-section format is **not** adopted; § 3 states section-by-section which ideas transferred and rewrites all of them from `dani.md`'s checklist. The overlap that remains ("a design profile should mention colour and type") is a fact about design systems, not authored expression, and it fails the "could not have written it with the source closed" test in the other direction — I could, and did.

What *is* owed is a record, because attributions.md explicitly records notable **ideas** too ("Summon's whole argument is that decisions should be traceable, and 'where did this rule come from?' is the same question as 'who decided this?'"). Two ideas came from looking at that repo: that a design profile is a portable artifact worth normalizing to a fixed shape, and that a design consultation should cite a repo path for every claim (§ 1's citation discipline is that idea, applied to a different mechanism).

**Proposed `docs/attributions.md` addition** (verbatim, for Diego to apply; not applied here):

> ## design-notes (sibling repo, same author)
>
> - **Source:** `../design-notes` — a personal, unpublished cross-repo design catalog by this project's author.
> - **License:** n/a (same author). Recorded for traceability, not obligation.
> - **Reviewed at:** 2026-08-05, for ADR-0013.
> - **Nature of use:** **ideas only, no expression.** Graded by diffing the two files read (`references/TEMPLATE.md`, `principles/web/anti-patterns.md`) against ADR-0013's output; no shared phrasing, no shared structure. Taken: (a) that a design profile is a portable artifact worth a fixed shape — Summon's shape is its own, derived from `.claude/agents/dani.md`, and the upstream 9-section list was read and declined section by section in ADR-0013 §3; (b) that a design consultation must cite a repo path for every claim, which ADR-0013 §1 reuses as a citation discipline.
> - **Deliberately not taken:** the `BAN:` anti-pattern list and the distilled `principles/web/` rules. Two reasons, and the second is the binding one. First, they are perishable taste rules with no maintainer inside Summon. Second, **provenance**: that file's own header credits "impeccable's detector rules, taste-skill's ban list, and our own tells," so copying it into shipped canon would launder two third parties' expression through a sibling repo — the attribution obligation would be to parties we never reviewed and cannot cite. Also not taken: `inspirations/` and `references/`, a personal catalog that is non-portable by construction, and the `design-consult` skill, whose own Notes state it "lives ONLY in design-notes."

**Meta-only note, recorded once and shipped nowhere** (per § 2 and ADR-0007 §1): when working *in the Summon repo*, the author may consult design-notes by opening a session there. That is a personal workflow, not a Summon feature, has no config surface, and is invisible to every scaffolded project. It is on the record here so nobody later mistakes it for a capability and tries to build a pointer to it.

## Responses to the Architecture Gate

| # | Challenge | Response | Design changed? |
|---|---|---|---|
| **C2** (vocabulary half) | *"Dani routes" is a slogan hiding a two-kings problem.* | **Conceded.** "Routes" replaced with four explicit rules in § 5: precedence D1>D2>D3, the Done-Gate-is-the-release-gate one-directional rule (an add-on may block more, never less, and never claims equivalence), Dani as single accountable reporting surface rather than router, and Summon shipping no taste at all — which removes Summon as a claimant in the *vocabulary* dispute entirely. The hooks/installation half of C2 remains ADR-0014's to answer and this ADR does not borrow legitimacy for it. | **Yes** |
| **C3** (blocking) | *The §B justification for rejecting the `BAN:` list is a misquote; §B says "after its layer is available," the add-on defaults to no, so prose is the sanctioned floor and rejecting the list leaves the default user with no design floor.* | **The §B citation is withdrawn as wrong.** Wei quotes §B correctly (`:44`, `:62`); it does not say what was claimed, and the portability clause says nearly the opposite. Correction on the record: that framing came from the scoping message, not from analysis, and it should not have survived into a proposal. **The rejection stands on the honest grounds Wei himself concedes**: provenance — design-notes' `BAN:` header credits impeccable and taste-skill, so copying launders third-party expression through a sibling (§ 7); and maintenance — a taste list is perishable and Summon has no design maintainer. Added: **scope** — those bans encode one person's anti-references, and a framework that ships taste to strangers is making an aesthetic claim it cannot defend per project. **Wei's third path is taken, with a twist**: the default user does get a floor, but it is a *sensor*, not prose — § 6's `design-floor-check`, owing nothing to any source text, plus § 1's internal-consistency findings which derive from the user's own code. So the answer to "no floor at all" is not "copy a smaller list," it is "the floor is accessibility and consistency, both checkable, and Summon has no opinion on your gradients." | **Yes** |
| **C4** | *8b already exists; "adding" it produces a duplicate.* | **Conceded outright.** Verified at `done-gate.md:33`. Reframed as an amendment (§ 4) with exact replacement wording. Strengthening added: what the screenshot must show (console output pasted not summarised, the changed element in frame, the commit SHA), what invalidates it, and the profile hook. Design authority **does not** change 8b's grade. | **Yes** |
| **C5** | *A screenshot is not proof; calling it one contradicts ADR-0012's receipt rule.* | **Conceded.** Grade stays `inferential`; "proof" appears nowhere; the amended text says outright that a screenshot is not proof and must not be described as one. Named invalidators (§ 4). Not sequenced after the receipt schema, because that would block a cheap honest improvement on a design I have not written — instead § 4 states plainly that the SHA makes staleness *human-visible, not machine-detected*, and that closing the gap is the deferred receipt schema's job. | **Yes** |
| **C6** | *The two asks don't cohere; split them so the safe half isn't hostage.* | **Conceded and executed.** Stated at the top: zero hard dependency on ADR-0014. This ADR is ratifiable, implementable, and reversible alone; every decision holds on an install with no add-ons. The only contact point (§ 5) is a no-op when no add-on exists. | **Yes** (structural) |
| **C7** | *"Configured external catalog" has an audience of one; name the config surface, add the §E registry entry, or drop branch 2.* | **Branch 2 dropped**, not shrunk (§ 2). Resolution keys on files present in the repo; there is no config surface, which is the strongest available answer to "name the config surface." Catalog *format* defined instead: § 3's profile is the portable artifact, vendored into the repo, versioned with the code that obeys it. §E registry entries named (§ 2) with the honest caveat that the registry is unbuilt so none can be added yet. Personal use of design-notes recorded on the record as a meta-only convenience with no shipped surface (§ 7). | **Yes** (materially) |
| **C9** | *The highest-value work needs no third party; Dani's rules can't fail a build, and leaving them in prose is a defect by §B today.* | **Accepted as sequencing, not rejected as an alternative** (§ 6). The script ships **first**; the protocol is second and cheaper now that branch 2 is gone. Also accepted: the pre-existing defect is named as pre-existing rather than absorbed into this ADR's scope, and §B's script-over-hook tie-breaker is followed. The answer to "why not this instead?" is not "it's less interesting" — it is "this too, and first, because a script cannot tell you the heading scale is wrong for this project and a profile cannot fail a build." | **Yes** |

C1 and C8 are aimed at ADR-0014 and are not answered here.

## Alternatives Considered

**A. Copy design-notes' distilled principles and `BAN:` list into Summon canon.** The original ask. Rejected on provenance (laundering impeccable's and taste-skill's expression through a sibling — § 7), maintenance (perishable taste rules, no maintainer), and scope (one person's anti-references shipped to strangers as house rules). Wei concedes the rejection; only its original §B justification was wrong, and that is withdrawn. The real cost of rejection — the default user's missing floor — is paid by § 6's sensor instead, which is a better floor than the list would have been because it can fail a build.

**B. Sensor-first only: build `design-floor-check`, ship nothing else (C9's path taken to its conclusion).** The strongest alternative, and it is *mostly* adopted — §6 makes it step one. Rejected as the *whole* answer for one reason: it addresses Context gap (2) and leaves gap (1) untouched, so Dani keeps inventing taste on projects that do have a design system, and the human keeps being unable to tell a sourced finding from an opinion. A script has no opinion about whether your heading scale is right for your product; that is exactly the class of question a profile answers. Cost of being wrong here is low and symmetric: if the profile stub goes unfilled by everyone, we have shipped one unused Markdown stub and a paragraph in Dani's prompt, and § 1's D3 branch means Dani behaves exactly as today. That is a cheap bet with a capped downside, which is why both ship.

**C. Three-branch resolution with a configured external catalog** (the proposal as scoped). Rejected per C7 — permanent public config surface for `n=1`, fails ADR-0007 §1's stranger test, and creates a live dependency on a repo that can change under a project mid-sprint. A vendored profile is strictly better on every axis except convenience for one person.

**D. Port `design-consult` into Summon as a skill.** Rejected: the skill's value is the catalog it searches, and the catalog is non-portable by its author's explicit design. Porting the protocol without the corpus ships a search over nothing. Its one transferable idea — cite a repo path for every claim — is taken as an idea and reused in § 1's citation discipline.

**E. Do nothing; wait for ADR-0014 and let an add-on supply design capability.** Rejected: ADR-0014 defaults to **no**, so this makes the modal user's design story "install a 3.3 MB third party or have nothing," while leaving a checkable-rules-in-prose defect standing that §B already classifies as a defect. It also inverts the dependency Wei is trying to break in C6 — the safe half would then depend on the risky half.

**F. Make design authority mandatory (fail the gate when no profile exists).** Rejected as over-architecture: a solo dev on a fresh project has no design system yet and forcing them to invent one to close their first UI item is ceremony that will be filled with fiction. The standing offer in § 1 (once, then silence) is the proportionate version.

## Consequences

### Positive

- The modal user — no design-notes, no add-on — gets something real for the first time: a deterministic accessibility floor that can fail a build (§ 6), and a Dani who says "no profile exists, here is what I can actually source" instead of confidently inventing house rules.
- Unsourced aesthetic assertions from an agent become a **process violation** rather than a stylistic quibble. That is the specific harm this ADR exists to stop.
- 8b stops being weaker than it reads. It keeps its honest grade, but staleness becomes visible to a human, and "no console errors" now requires pasting the console rather than asserting it.
- The design profile is a plain vendored file — diffable, reviewable in the PR that changes it, versioned with the code, and impossible to break by moving a sibling repo.
- Item 8's advertised "deterministic aids: axe/Lighthouse" stop being vapour, retiring a §B defect that predates this ADR.
- ~~Zero new supply-chain exposure. No third party is required by anything here.~~ **Corrected 2026-08-05 (see § 6's amendment block).** True of §§ 1–5, 7 and of § 6's slice A, all of which add no dependency. **False of § 6's slice B**, which needs `axe-core` plus a browser driver — the first dependency Summon would ship. The original claim contradicted § 6's own concession ("one well-known audited library") and is corrected rather than excused, because a reader six months from now quotes *Consequences* to wave a `playwright` devDependency through.
- Splitting cleanly from ADR-0014 means the reversible docs-only half can ship this week without waiting on a threat model.

### Negative

- **Two-layer maintenance, again.** Dani's rules now exist as prose (`dani.md`) *and* as a script (§ 6). They can drift. ADR-0012 already priced this for the enforcement-adapter class and the burden is real, permanent, and now slightly larger.
- **The stub may go unfilled forever.** If it does, §§ 1 and 3 were dead weight and only § 6 earned its place. Reversal trigger 1 below watches exactly this.
- **`design-floor-check` is unwritten and unestimated here.** "axe plus a headless browser" is a sentence, not a design: page discovery (which routes? which states?), the fixture problem for component libraries with no server, and the false-positive rate on a real app are all unaddressed. **UNRESOLVED** — it needs its own small design pass before implementation, and if that pass finds it expensive, § 6's sequencing claim ("smaller than everything else in this ADR") is falsified and the ordering should be revisited rather than forced.

  **Clause fired, ordering survived (2026-08-05).** The design pass ran (`docs/history/tracking/2026-08-05-design-floor-check-design-pass.md`) and did falsify the sizing claim — see § 6's amendment block. **It did not falsify the ordering**, which rests on value (`:185`, "the sensor is worth more"), not size, and the pass never engaged that sentence. Wei refuted the proposed reorder on that basis and two others; the gate record is `docs/history/tracking/2026-08-05-adr-0013-section-6-ruling.md` plus § "Responses to the second gate" in the design pass. Of the three items named above, page discovery is **resolved** (take URLs as arguments, as `axe-cli`/`pa11y`/Lighthouse CI do — no registry, no canon addition), component-library fixtures are **declared a non-goal**, and the false-positive rate remains **UNRESOLVED and unmeasurable** until the script exists. A fourth item, unnamed here and more serious than any of them, emerged from the gate: the **false-negative** rate of a static-only check (§ 6, slice A constraint).
- **8b's SHA requirement is discipline, not enforcement.** Nothing detects a wrong SHA. This is a known half-measure standing in for the deferred receipt schema, which I own and have not designed — and this ADR adds a second consumer for a schema that already had one waiting.
- **Dani gets more verbose in one specific case**: at D3 on a repo with a design profile she must additionally reconcile against it, and reconciliation reports are longer than opinions.
- **Summon now has an official position that it ships no taste.** That closes a door: if we later decide a shared house style is valuable, § 5 rule 4 has to be reopened and re-argued, and users will have built profiles on the assumption we would not.

### Neutral

- Nothing about `../design-notes` changes; it remains a personal repo reached by opening a session there.
- The user-visible surface added is one Markdown stub, one paragraph in Dani's prompt, and a script. No CLI surface, no config key, no manifest change, no new command.
- Three capability-registry rows are owed whenever the ADR-0012 §E registry ships.

## Reversal triggers

1. **Six months after ratification, no scaffolded project has a filled-in `docs/design-profile.md`** (including the author's own). Then §§ 1 and 3 failed and should be deleted; keep § 6.
2. **`design-floor-check`'s false-positive rate makes people skip item 8.** A sensor people route around is worse than prose. Fix the rules or withdraw the check from the gate; do not leave a check everyone waives.
3. **The stub's "House rules" section becomes a vector for agents to invent rules and then cite them back to themselves.** If profiles start filling with agent-authored taste, require human authorship of that section explicitly or drop it.
4. **ADR-0014 is rejected outright and no add-on mechanism ever exists.** Then § 5's D2 row and rules 1–3 are dead text and should be struck; §§ 1–4, 6, 7 stand unchanged.
