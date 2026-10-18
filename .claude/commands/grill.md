---
description: "Interrogate a claim of done until it rests on named proof, not confidence."
---
<!-- agent-notes: { ctx: "interrogate a claim of done until it rests on real proof", deps: [docs/process/done-gate.md, .claude/agents/wei.md, .claude/agents/tara.md], state: active, last: "claude@2026-07-07" } -->
Interrogate and defend the definition of done for: $ARGUMENTS

(No argument: grill the current work item / uncommitted change.)

`/grill` makes the team **defend a claim of done** — one claim at a time — until each rests on proof you can name, not on confidence. It is the Done Gate's companion (`docs/process/done-gate.md` § Backpressure): use it when a gate item's grade is `inferential`/`human-judgement`, when coverage looks thin, or before calling anything shippable. **It never gates** — the verdict still comes from running the sensors. If there is no definition of done yet, build one here, then defend it.

Run this with **Wei** (devil's advocate — `.claude/agents/wei.md`) driving the interrogation and **Tara** (coverage veto — `.claude/agents/tara.md`) judging whether the named proof actually distinguishes right from wrong. Spawn them as standalone agents, not inline.

## The question that does the work

> **What realistic wrong implementation would still pass the checks you just named?**

If such an implementation exists, the proof is too weak. Sharpen it.

## How to grill

Treat "done" as a set of claims, each owing proof. First **inspect** (don't quiz): the acceptance criteria (never skip these), the tests, the commands/CI, architecture rules, runtime surfaces, and any `summon:` debt markers (`pnpm harvest:debt`). Then take **one claim at a time**. Each turn carries:

1. **The claim** under examination.
2. **The proof** you would stand behind — and its **grade** (`deterministic` / `inferential` / `human-judgement`, same scale as the Done Gate).
3. **Why that grade fits** *this* claim — pick the strongest grade the claim admits.
4. **What it would still miss.**

Drive toward, for each material claim or failure mode:

- What observable state makes it true?
- **What wrong implementation still looks green?** (the load-bearing question)
- What proof distinguishes the right state from that wrong one — at what grade?
- How is it invoked? What is pass vs. fail? What evidence does it leave?
- **Is the proof itself alive** — what known-bad fixture makes it fail when it should? (negative control)
- Does it prove behavior at the layer the claim lives at, from a clean state, on this revision?

Do not accept "it's tested." Sharpen until a claim names an observable state, an oracle, an invocation, and a pass condition. A found tool or config proves only that a *candidate* exists — make the sensor earn it.

When proof is thin, pick and defend **one** move: reuse and verify an existing sensor · strengthen a weak one · build a direct one · instrument the product so the state becomes observable · accept a narrower deterministic proxy · route to a named human/inferential reviewer · knowingly defer the risk (and say what that risk is).

## Encode, don't just note

If grilling exposes a recurring inference that *should* be deterministic, that's a magic-wand answer: **encode the fix, not the memory** (`docs/methodology/debt-markers.md` § Encode). Prefer a new check/command over a new prose reminder, and raise it to Grace as tracked work.

## Stop

Stop when every material claim is lined up against a proof grade you can defend — with its invocation, pass condition, and evidence — or is knowingly assigned to a named reviewer with the evidence they need.

Leave a compact **proof contract**, folded into the work item or the review tracking artifact (`docs/process/tracking-protocol.md`) — not a new ledger:

| Claim | Grade | Sensor / reviewer | Pass condition | Evidence | Gap |
|---|---|---|---|---|---|

Never call the work proven while a row is missing, unknown, or stale — name the gap plainly.
