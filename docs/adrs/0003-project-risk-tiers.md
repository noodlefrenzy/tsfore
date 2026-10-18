---
agent-notes: { ctx: "ADR: four-question per-feature hazard wire (actuation/authority/injection/disclosure) gates safety track; tier is default sensitivity", deps: [CLAUDE.md, docs/process/done-gate.md, docs/adrs/0002-tdd-workflow.md], state: active, last: "archie@2026-07-03" }
---

# ADR-0003: Per-Feature Hazard Trip-Wire and Project Risk Tiers

## Status

Accepted (2026-06-06) — human-approved after the Architecture Gate (Archie/Wei debate), Pierrot safety sign-off (3 conditions applied), and Pat product sign-off (changes B/D/E applied; A/C deferred to R1 implementation). The full debate record is retained in Summon's own development history. **Not yet implemented** — see the Implementation note below.

## Context

Summon applies the same process rigor to every project regardless of blast radius. Two real deployments make the cost concrete:

- **`alpaca-trader`** takes real money via a live broker API and acts irreversibly and unsupervised. It needs durable-assertion re-checks, kill switches, fail-closed defaults, and audit trails.
- **`predictasaurv2`** is a prediction/analysis pipeline — real users and data, but recoverable failures.

A single fixed ceremony serves neither well. It is **too heavy** for toy/throwaway projects (Vik's standing anti-ceremony objection: TDD-on-XS, full 15-item Done Gate, and the ADR gate are dead weight on a weekend prototype) and **too light** for high-stakes ones (Pierrot's safety concern: a live-broker app with the same gate as a scratch script will ship unsupervised money-moving actions with no fail-closed posture).

We need a mechanism that scales ceremony to consequence. This ADR defines it. It is the **keystone** for Wave 2: it gates the review-reliability rigor (gap #2) and the S1 safety track, neither of which is designed here.

**Round 2 inversion (Wei).** Round 1 made *project tier* the load-bearing unit. Wei's challenge showed this is the wrong unit: **risk is a per-feature property, not a per-project label.** `alpaca-trader`'s catastrophic surface is the handful of functions that place live orders; ~90% (config, logging, CLI, backtest) carries no such stakes, yet a project-level Tier 2 forces the safety track onto all of it. The inverse fails worse: a "standard" Tier-1 SaaS app with a single `POST /transfer` endpoint or an `rm -rf` cleanup job gets *zero* safety track. A coarse project label both over- and under-covers, and — being set once at kickoff — rots silently when a money-touching feature arrives in sprint 6 (the exact silent-false-green this whole audit exists to kill).

This revision therefore **inverts the keystone**: the load-bearing mechanism is a small, objective, fail-closed **per-feature hazard trip-wire**, evaluated on the per-work-item gate that *already runs for every item*. The **project risk tier is demoted** to a cheap *default sensitivity* — a baseline the trip-wire can only override **upward**, never downward. Any single item that trips the wire gets the S1 safety track, in any project, regardless of tier.

## Decision

Two mechanisms, in priority order: **(A) a per-feature hazard trip-wire** that is the actual gate switching on the S1 safety track, and **(B) a project risk tier** that sets a cheap default sensitivity the trip-wire can override upward. The trip-wire is load-bearing; the tier is a default.

### 1. The hazard trip-wire (load-bearing)

A small, objective, **fail-closed** checklist evaluated **per work item** at the Session Entry / board-add step that already runs for every item (CLAUDE.md § Session Entry Protocol, Step 1 — "do work items exist"). It is the **same** evaluation `/kickoff` runs to seed the default tier (§3); the difference is cadence — kickoff runs it once for the project default, every board-add re-runs it for that item.

**Trip-wire — four questions. Any "yes" (or any "unsure") → the S1 safety track is ON for this item.**

1. **No human in the loop?** Does this feature take an action that *no human approves per-occurrence* — a scheduled/triggered/autonomous action, or an auto-applied effect — **or route untrusted/model-influenced input into a privileged action or tool call?** (An LLM/agent that can invoke tools counts as no-reliable-human-in-the-loop: the model is the untrusted actor and there is no per-occurrence human gate between its output and the privileged capability.)
2. **Irreversible or moves money/safety-critical state?** Does it move real money or assets, take an irreversible external action (trade, payment, delete, send, physical actuation), or change safety-/legality-critical state?
3. **Standing credentials?** Does it act using standing credentials that grant real-world authority (live broker key, prod DB write, cloud admin, payment processor) without a per-action human gate?
4. **Sensitive data exposure?** Does this feature read, export, log, transmit, or expose personal/regulated/secret data (PII, PHI, credentials, financial records) to a destination or party that could retain or leak it — regardless of whether it "moves" anything? A read-only disclosure of regulated data is itself the irreversible harm (a GDPR/HIPAA breach), so it trips the wire even when no money moves and no "action" is taken.

Rules:
- **Fail-closed.** Ambiguous, unknown, or unevaluated ⇒ treated as a "yes" ⇒ safety track ON until an ADR or `product-context.md` note explicitly justifies otherwise. Silence never means safe.
- **Scoped to the item.** A trip on `place_order()` arms the safety track for *that* path, not for the project's logging or backtest code. This is the point: it covers exactly the hazardous surface, no more.
- **Overrides tier upward only.** A tripped item in a Tier-0 or Tier-1 project gets the safety track anyway. The tier can never *suppress* a trip.
- **Where it lives.** A short "Hazard Trip-Wire (4 checks)" subsection in the Session Entry Protocol so the coordinator runs it on every board-add, mirrored in `pierrot.md` (owns the safety lens). No new standalone doc (per Section 2's "no new docs" conclusion — Wei, Pat, Diego).

### 2. The project risk tier (default sensitivity, demoted)

The tier no longer gates the safety track. It sets a **default sensitivity** — how heavy the *non-safety* ceremony baseline is (TDD relaxations, Done-Gate breadth, review-lens count) — and it pre-arms the trip-wire's posture so a high-stakes project doesn't rely on remembering to evaluate every item. We keep **three tiers** because the audit surfaced exactly three baseline-ceremony classes.

*Why three, not two or four:* Two tiers cannot separate "no stakes, lighten the baseline" from "stakes everywhere, default the trip-wire armed." Four-plus invite boundary litigation. The audit surfaced exactly three baseline classes (disposable, recoverable, catastrophic-by-default), so three is the smallest model that fits — **and the cost of a wrong tier is now bounded**, because the trip-wire, not the tier, decides safety.

A project takes the **highest** tier for which any criterion is true (same objective wording as the trip-wire, applied project-wide):

**Tier 2 — High-stakes by default.** The trip-wire's typical answer across the project's core features is "yes" — it routinely moves money, acts irreversibly, runs unsupervised, or carries safety/legal/regulatory exposure. The safety track is **pre-armed**: items are assumed to trip unless one is shown not to.

**Tier 1 — Standard / production (the baseline).** Real users or data, but most features are recoverable and non-catastrophic. The safety track is **off by default and switched on per-item by the trip-wire.** This is today's Summon process for everything the wire doesn't trip.

**Tier 0 — Toy / disposable.** A **falsifiable assertion**, not a self-certification (§3): *no prod users, no real money, no safety/regulatory stakes, no standing credentials, will be deleted.* Lighter author-facing baseline. **The trip-wire still runs** — the moment any item trips it, that item gets the safety track and the Tier-0 assertion is re-armed for review (it just became false).

### 3. Storage, setting, and changing the tier

**Storage.** A single source of truth in `CLAUDE.md`, in the Tracking config region (alongside the tracking-adapter markers ~line 104), as a visible field:

```
<!-- risk-tier: 1 -->
```

`CLAUDE.md` is chosen over `docs/product-context.md` because every agent and command already reads `CLAUDE.md` on session entry; the tier must be impossible to miss. `product-context.md` carries the *rationale* (one short "Risk Tier" subsection explaining why this project is tiered as it is), but `CLAUDE.md` holds the authoritative value.

**Setting.** `/kickoff` runs the **trip-wire's four questions** against the project's core features to seed the default tier, records the value in `CLAUDE.md`, and writes the rationale to `product-context.md`. A Tier-0 default additionally requires the **falsifiable assertion** (no prod users / no real money / no safety or regulatory stakes / no standing credentials / will be deleted) written verbatim in `product-context.md` — Tier 0 is never a bare self-declaration. `/quickstart` defaults to **Tier 1** (never Tier 0) and notes the project should be re-tiered at first proper kickoff. **The Tier-1 default here governs the *safety floor*, not the full baseline.** A quickstart project runs at the Tier-1 default for **safety posture** — trip-wire armed, security (Pierrot) lens non-droppable, the part that must never be skipped on the fast path — but **inherits `quickstart.md`'s documented ceremony reductions** (board, threat-model, test-strategy, and architecture-gate deferred) until first `/kickoff`. This resolves the apparent contradiction that quickstart defers ceremony Tier 1 nominally requires: the tier default sets only the non-negotiable safety floor, and quickstart's own documented reductions govern the deferred baseline until kickoff promotes the project to its real tier.

**Re-checking (the part that doesn't rot).** The tier is set once, but the **trip-wire is re-evaluated per work item** at board-add (§1), so a money-touching feature in sprint 6 self-flags and gets the safety track *without* anyone remembering to re-tier. In addition, **`/sprint-boundary` carries a re-tier trigger**: if any item this sprint tripped the wire in a Tier-0/1 project, the boundary flags a tier re-evaluation. This closes the lifecycle hole — risk is anchored to the per-item gate, not to a once-at-kickoff label.

**Changing the tier.** Re-tiering is a documented, explicit act — never a silent edit:
- **Re-tiering DOWN** (e.g., 2→1, or 1→0) requires a one-line justification in `product-context.md` and, because it lowers the *default* posture, a Pierrot sign-off recorded there. Down-tiering **cannot** disarm the trip-wire — items that trip still get the safety track.
- **Re-tiering UP** (e.g., 1→2) is a **safety event**: the project's default stakes changed. It triggers a one-time **Tier-2 onboarding** — pre-arm the safety track and retro-review existing money-moving / irreversible / unsupervised paths against the Unsupervised-Action checklist (S1) before the next release. Logged in `product-context.md` with a date. (Note: a single tripped *item* never required a re-tier to get the safety track — the wire already gave it one. Up-tiering is about the *default*, for when tripping becomes the norm.)

### 4. What the tier gates (differential *baseline* ceremony)

The tier scales the **non-safety baseline** only. The **safety track is gated by the trip-wire (§1), per item, not by this table** — the table's "Safety track" row records *posture*, not a switch. Tier 1 is the baseline; deltas shown.

| Control | Tier 0 (lighter) | Tier 1 (baseline) | Tier 2 (heavier) |
|---|---|---|---|
| **TDD (ADR-0002)** | Red-green-refactor still applies; standalone-Tara-on-M+ relaxed to author discretion. **TDD-on-XS** not required. | Full ADR-0002. | Full ADR-0002, no relaxations. |
| **ADR gate** | Only for genuinely hard-to-reverse choices; default to a one-line note. | Standard Architecture Decision Gate. | Standard gate. (Any item that **trips the wire**, at any tier, also requires the S1 Safety Contract ADR for that path — see Safety track row.) |
| **Done Gate** | Core only: tests, typecheck, format/lint, "it works." Items 7, 12–15 best-effort. | All 15 items. | All 15 items. Item 10 (migration safety) and 11 (API compat) non-waivable. (Tripped items add the Unsupervised-Action checklist regardless of tier.) |
| **Code review** | Other lenses may drop to one for items that **do not** trip the wire; the **security (Pierrot) lens always runs — never optional, at any tier**. | Full multi-lens review (security lens never dropped). | Full multi-lens review, ordered safety-first. |
| **Safety track (S1)** — *gated by trip-wire, not tier* | Off **unless an item trips the wire** → then ON for that item. | Off **unless an item trips the wire** → then ON for that item. | **Pre-armed**: items assumed to trip unless shown otherwise. |

**The security (Pierrot) lens is non-droppable at every tier, including Tier 0, whether or not the item trips.** This extends the gap-#2 veto (security lens never skipped on small *diffs*) to all *tiers*. The reason is structural: the security lens is *also the independent trip-detector* — it is the only check on a misjudged "no," and under Wave 1's principle the author judging the wire is the untrusted actor. Tier 0 may drop the *other* lenses to one and lighten the baseline, but it can never drop the lens that audits the wire itself. Tiers 1 and 2 never drop it either.

**Trip-wire overrides the whole table upward.** Any item that trips the wire (§1) gets, regardless of tier: the S1 safety track, the **non-droppable Pierrot lens** (per the gap-#2 veto — never skipped on small diffs), the Unsupervised-Action checklist, and the S1 Safety Contract ADR for that path. The tier sets the *floor*; the wire raises it per item. **No tier — including Tier 0 — can lighten a control that protects other people or external systems** once the wire has tripped.

### 5. Default and fail-safe

Two fail-closed defaults:

- **Unset tier** (no `risk-tier:` field, or an unrecognised value) ⇒ **Tier 1**, never Tier 0. An unset tier most likely means kickoff hasn't run or the field was deleted; dropping to Tier 0 would silently strip baseline ceremony from a possibly-real project. Tier 1 keeps the full baseline at recoverable cost (mild over-ceremony on a genuine toy). Tier 2 is deliberately *not* the default for the *tier* — but note the next bullet handles the safety dimension independently.
- **Unevaluated trip-wire** ⇒ **treated as tripped** (safety track ON for the item) until explicitly justified in an ADR or `product-context.md` note. This is the more important fail-closed: it means a forgotten evaluation fails *toward* safety, not away from it. The two defaults compose — an uninitialised project is Tier 1 *and* every item's wire is presumed tripped until evaluated, so it can never silently ship an unsupervised money path.

**The common case carries near-zero ceremony cost.** For a project where no item ever trips the wire, the contributor never sets a tier (the Tier-1 default is auto-written), never invokes the safety track, and the only visible artifact of this whole mechanism is **four "no" answers, once, at kickoff** — the two-mechanism conceptual cost in the Negative section below is paid *only* by projects that actually carry hazard.

### 6. Relationship to the rest of Wave 2

This ADR establishes only the tier dimension. It does not design the controls it gates:

- **Gap #2 (review reliability, re-spec'd with guardrails G1–G5):** how rigorously the file+sentinel review machinery is applied **may scale by tier** (e.g., input-sharding seam passes mandatory at Tier 2). That tuning belongs to gap #2's ADR; this ADR only guarantees the tier exists for it to read.
- **S1 (Safety Contract ADR + Unsupervised-Action checklist):** applies to **any item that trips the hazard wire**, in any project, at any tier — *not* "only at Tier 2." Its content — durable-assertion re-check-at-use, authority-freshness, kill switch, fail-closed, audit trail — is specified in the S1 ADR. This ADR's only S1 commitment is the **gate**: a tripped item turns S1 on (fail-closed if unevaluated); Tier 2 pre-arms it; up-tiering to 2 retro-reviews existing paths against it. **Dependency direction: S1 owns the hazard *taxonomy* — the control sets for each hazard class (actuation, authority, disclosure, injection) — and the trip-wire is S1's *detection front-end*.** The wire must carry **at least one question per S1 hazard class** (today: Q2 actuation, Q1+Q3 authority/injection, Q4 disclosure). S1 is free to demand a control for a hazard the wire under-detects, and a richer S1 taxonomy should drive *adding* a wire question — not the reverse. The taxonomy owns the wire; the wire does not bound the taxonomy.

### Implementation note (R1, follows acceptance)

This ADR specifies the mechanism; it does not wire it in. The **R1 implementation step that follows human acceptance** wires the design into the operative surfaces:

- the `<!-- risk-tier: N -->` field into `CLAUDE.md` (§3);
- the four-question trip-wire step into the **Session Entry Protocol** and mirrored into `pierrot.md` (§1);
- the tier-seeding trip-wire run into `kickoff.md` **Phase 1b** (§3);
- the Tier-1 safety-floor default into `quickstart.md` (§3, per Change B);
- the re-tier trigger into `/sprint-boundary` (§3).

Pat's review changes **A** (command-file wiring) and **C** (Session Entry trip-wire step) are part of this R1 step, not of the ADR text. Until R1 lands, this ADR is the spec, not the live process.

## Consequences

### Positive

- Ceremony scales to consequence at the **right granularity**: the safety track lands on the hazardous *features*, not whole projects. Toy projects stay light (answers the **Wei/Vik/Pat** anti-ceremony objection from Section 2), and a single hazardous endpoint in an otherwise-standard project gets the safety track (closes the under-coverage hole Wei raised).
- **Doesn't rot.** Risk is anchored to the per-item gate that already runs every board-add, plus a `/sprint-boundary` re-tier trigger — a sprint-6 payments feature self-flags without anyone remembering to re-tier.
- **Cost of a wrong tier is now bounded.** Mis-tiering only changes the *baseline*; the trip-wire, not the tier, decides safety, and it fails closed. The one-directional expensive error (silent green on a real hazard) is removed.
- Tier is one legible default in `CLAUDE.md`; the trip-wire lives in surfaces the coordinator already reads (Session Entry Protocol, `pierrot.md`) — no new doc, no hidden state.
- Gives gap #2 and S1 a clean, *objective* dependency (the four trip-wire questions) instead of an upfront subjective judgement.

### Negative

- **Per-item trip-wire is recurring friction.** It runs on *every* board-add, not once at kickoff. Mitigation: four yes/no questions, and for most Tier-0/1 items every answer is an obvious "no." But it is more touch-points than a single label, and the discipline only holds if the gate is actually run — which is why it rides the Session Entry step that already runs, rather than a new gate.
- **Trip-wire false-positives.** Fail-closed means "unsure → on," so ambiguous items pull the safety track even when not strictly needed; the author's escape is an ADR/`product-context.md` justification, which is itself ceremony. Accepted as the safe-direction cost — over-covering a feature is recoverable, under-covering a money path is not.
- **Tier-gaming on the baseline.** Authors may still under-tier to dodge *baseline* ceremony, or claim Tier 0 falsely. Mitigation: Tier 0 now requires a falsifiable written assertion, and the trip-wire runs regardless of tier so under-tiering can no longer strip *safety*. The residual risk is baseline-only and recoverable.
- **Two mechanisms to learn.** Contributors must understand both "what tier is this project" and "does this item trip the wire." More conceptual surface than a single dial. Accepted because the single dial was demonstrably the wrong unit — **and the cost is asymmetric: in the common no-hazard case it collapses to four "no" answers once at kickoff (§5), so the two-mechanism cost is paid only by projects that actually carry hazard.**
- **Re-tiering up mid-project is still a cost event** — retro-review of pre-existing paths. Reduced in likelihood (the wire already covered new hazardous items as they landed) but real when tripping becomes the project norm.
- **The wire fails open on a confident wrong "no."** Fail-closed handles *omission* (unevaluated ⇒ tripped), not *commission*: an author who evaluates the wire and answers "no" with conviction on a genuinely hazardous item routes it past the safety track. The compensating control is the **non-droppable security (Pierrot) lens (§4, condition 2)** — running at every tier whether or not the item trips, it is the independent re-check on a misjudged "no." It does not make the wire infallible; it ensures a wrong "no" still meets one adversarial reviewer before merge.

### Neutral

- Three tiers remains a judgement call, but **less load-bearing** now that it only sets the baseline; if the middle is overloaded a future ADR can split it.
- Tier value lives in `CLAUDE.md`; rationale and the Tier-0 assertion live in `product-context.md`. The trip-wire lives in the Session Entry Protocol and `pierrot.md`.
- Existing summon projects fall to the Tier-1 default with every item's wire presumed-tripped-until-evaluated — no baseline behavior change, but the *first* hazardous item now self-flags.

### Acceptance metric (Pat) — does this actually reduce ceremony?

Point 5 (Wei) is correct that "make a tiering decision at kickoff" is itself process, and nothing in Round 1 *measured* whether it reduced ceremony. The instruments below are **countable from records the project already produces** (board entries, Done-Gate records) — no faith, no unfalsifiable claims:

- **Ceremony delta (the real claim):** per closed work item, count the mandatory controls actually applied — *(review lenses run, Done-Gate items checked, TDD-on-XS required y/n)* — tallied from the board / Done-Gate records the project already produces. **Claim:** Tier-0/1 *non-tripping* items show a **lower mean control count** than the flat-process baseline. **Baseline stated explicitly:** flat process = all 15 Done-Gate items + full multi-lens review on every item.
- **Trip-to-track coverage (replaces "zero incidents"):** every item that tripped the wire has a recorded S1 artifact (Safety Contract ADR or Unsupervised-Action checklist) **before merge** → **trip-to-track coverage = 100%**. This is falsifiable by audit and needs no incident to occur — unlike "zero safety incidents," which a solo project trivially satisfies (zero tripped items ⇒ zero incidents) and so proves nothing.
- **Kill criterion (bound to the instruments):** revert to flat process if non-tripping Tier-0/1 items show **no reduction in mean control count**, OR any tripped item merged without its S1 artifact (trip-to-track < 100%). This binds the mechanism to the outcome it claims, exactly as Section 2's kill criterion binds gaps #1/#3.
- **Small-n acknowledgment:** the trial runs across the **next 2 sprints OR the next 2 summon repos, whichever yields ≥1 tripped item.** A single toy project may never trip the wire, leaving the safety half of the claim untested; the trial is not complete until at least one trip is observed and its trip-to-track coverage measured.
