---
description: "Produce an implementation plan, scanning first for architecture decisions needing a gate."
---
<!-- agent-notes: { ctx: "implementation planning workflow", deps: [docs/methodology/personas.md, docs/methodology/phases.md], state: active, last: "claude@2026-08-04" } -->
I need to plan the implementation of: $ARGUMENTS

Before writing the plan, ensure the goal is well-understood. If the request is vague, first run through Coach Cam elicitation (see `docs/methodology/personas.md`) or use `/kickoff` for full discovery.

## Architecture Decision Scan (Mandatory Pre-Step)

Before writing the plan, scan the work items for architectural decisions:

1. **For each item, ask:** Does this involve a new pattern, new integration, technology choice, data model change, or package boundary?
2. **If yes:** The item requires the Architecture Gate (see CLAUDE.md § Architecture Gate). Flag it in the plan as "**Requires Architecture Gate:** ADR + Wei debate before implementation."
3. **If any items require the gate:** The plan must schedule Phase 2 (Architecture) before Phase 3 (Implementation) for those items. They cannot enter the TDD pipeline until the ADR exists, Wei has challenged it, and the debate is tracked.
4. **List gated items** in a dedicated section of the plan document.

## Plan Document

Create or update a plan document in `docs/plans/`. The plan should include:

1. **Goal** — What we're trying to achieve and why.
2. **Constraints** — Any relevant ADRs, conventions, or technical limitations.
3. **Architecture Gate Items** — Items requiring ADR + Wei debate before implementation. For each: what decision needs an ADR, and why it's architectural (not just implementation detail).
4. **Approach** — Step-by-step implementation plan following TDD. Gated items must show Architecture phase before Implementation phase.
5. **Personas involved** — Which Summon agents should be consulted during implementation? (See `docs/methodology/personas.md`.) Include Wei for any gated items.
6. **Open Questions** — Anything that needs clarification before starting.
7. **Not Yet Specified** — Questions you can see coming but cannot yet word precisely, because what they depend on is itself undecided. See below.
8. **Out of Scope** — Work consciously ruled outside this plan's goal, each with the reason. See below.
9. **Acceptance Criteria** — How we'll know the work is done.

Check existing ADRs and plans for context before writing. Add agent-notes frontmatter per `docs/methodology/agent-notes.md`.

### Not Yet Specified vs. a work item

A plan that lists only what it knows overstates its own confidence. **Not Yet Specified** is where that admission goes: inside the goal, but still too blurry to act on.

Sort by **whether the question can be phrased sharply today** — being unable to answer it is not what puts it here:

- **Make it a work item** when you can already write the question down precisely, even if it is blocked and nobody can start on it.
- **Leave it in Not Yet Specified** when the question is still too blurry to write down that way.

Resist carving this section into item-shaped fragments. A single entry may later turn into three work items, or evaporate into none. As earlier items resolve and a question comes into focus, promote it to a real work item and remove it from here, so it never lives in two places at once.

### Out of Scope

This section is about the goal's edge, not about clarity. Something can be perfectly well understood and still sit outside what this plan set out to do — record it in one line with the reason it is out, rather than dropping it silently and letting it resurface as a question nobody remembers answering.

Nothing here is ever promoted to a work item. If the goal itself is redrawn later, these come back as input to a *new* plan, not as resumed work in this one. And when an existing work item turns out to sit past the goal, close it and leave a line here — finishing it would be work the goal never asked for.

_Both sections adapt conventions from [mattpocock/skills](https://github.com/mattpocock/skills) (`wayfinder`), MIT © 2026 Matt Pocock._

## Tracking Artifact

After the plan document is written, produce `docs/tracking/YYYY-MM-DD-<topic>-plan.md` summarizing the plan's goals, approach, key constraints, and acceptance criteria. Use the standard tracking format from `docs/process/tracking-protocol.md`. Set **Prior Phase** to the most recent tracking artifact for this topic (if any), or "None" if this is a standalone plan.

## Development Environment Check

After the plan is written, check whether a devcontainer is set up:

1. Check if `.devcontainer/devcontainer.json` exists.
2. **If it does not exist:** Ask the user: "No devcontainer is configured for this project. Would you like me to set one up before we start implementation? This ensures a consistent development environment. I can run `/devcontainer` to create one."
   - If yes: run `/devcontainer` with the project's tech stack as context.
   - If no: note the decision and proceed.
3. **If it already exists:** No action needed — proceed to implementation.
