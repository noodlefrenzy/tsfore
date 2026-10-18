---
agent-notes: { ctx: "canonical checklists for reusable review lenses; single source for persona + composite reviewer", deps: [CLAUDE.md, docs/process/operational-baseline.md], state: canonical, last: "claude@2026-08-04" }
---

# Review Lenses

The canonical checklists for the **reusable review lenses** — the operational and architectural-conformance passes that run during code review and at the sprint boundary.

These lenses are applied from two places: the owning **persona** (Ines for operational, Archie for conformance), when invoked directly, and the composite **`code-reviewer`** agent, which runs all lenses in one pass. Both reference this file so the checklist has **one home** and cannot drift between them. When a lens gains or loses a check, edit it here; the persona and the reviewer inherit the change.

Two lenses do **not** live here because they already have a single home: Vik's simplicity/YAGNI ladder (`.claude/agents/vik.md`) and Tara's test-quality checklist (`.claude/agents/tara.md`). Pierrot's security lens likewise lives in `.claude/agents/pierrot.md`. This file holds only the lenses that were previously duplicated.

## Operational Review Lens

**Owner:** Ines. **Read-only** — this lens identifies operational concerns and reports them; it does not implement fixes (that is Sato's job).

**Activates:**
- **Code review (situational)** — when the diff changes application behavior (not docs-only, not CI-only). A lightweight check against the list below.
- **Sprint boundary (Step 5b)** — a full audit of every applicable concern in `docs/process/operational-baseline.md` (the 11-concern catalog; this lens is its per-diff subset).
- **Pre-release** — a comprehensive operational-readiness review.

**What it checks:**
- **Logging coverage** — are significant operations logged, at appropriate levels (INFO for operations, WARNING for recoverable issues, ERROR for failures)? Do `--verbose` / `--debug` flags surface the extra detail?
- **Error-pattern consistency** — does new error handling follow the project's established pattern? Are user-facing errors actionable? Are internal errors caught and wrapped?
- **Config validation** — are new config values validated at startup? Do invalid values produce clear messages? Is `.env.example` / config documentation current?
- **Debug support** — can a developer diagnose a failure without attaching a debugger? Are there enough breadcrumbs in logs and error messages?
- **Graceful degradation** — do external calls have timeouts? Do failures produce user-friendly messages rather than stack traces or hangs?
- **Subprocess spawn safety** — do all subprocess spawn calls (`execa`, `child_process`, `spawn`) explicitly configure stdin/stdout/stderr? Is stdin `'ignore'` when the subprocess needs no input? Are timeouts set? Do integration tests spawn the real binary?

## Architectural Conformance Lens

**Owner:** Archie.

**Activates:** when the diff touches shared or core types — types consumed by multiple modules, pipeline abstractions, or types that cross package boundaries.

**Guiding question:** "Does this change introduce assumptions specific to one consumer, format, or platform into a shared type?"

**What it checks:**
1. **Read the relevant ADRs** for the area being changed, and check their fitness functions — does the change violate any?
2. **Consumer-specific leakage in shared types** — units, options, or data structures only one module cares about do not belong in shared types. Shared types use format-neutral representations; consumer-specific conversions happen at the boundary. Format-specific markup attached to a shared AST is flagged when the architecture plans multiple consumers.
3. **Architecture-doc claims still true** — if a doc states a property ("Core is format-neutral"), does the change maintain it?
4. **Flag violations as Important** — or **Critical** if they make a planned capability significantly harder to implement.

**Detection signal:** a shared type imports or references a consumer-specific namespace, uses consumer-specific units without conversion, or exposes properties only one consumer would use.

### Module Depth Sub-Lens

**Owner:** Archie. Applies when the diff introduces, moves, or reshapes a module boundary — a new abstraction, an extracted helper, a new indirection layer, or a change to what a module exposes.

- **Delete it in your head.** Inline the module at every call site and see what happens to the total complexity. If it drops, the module was only forwarding calls and should go. If the same logic springs back up in four different callers, the module was doing real work. A wrapper you can delete for free is worse than nothing — it costs a name, an import, and a hop.
- **Tests enter the same way callers do.** There is one way in, and both use it. When a test can only set up or assert by reaching around the module's front door, that is a report about the module's shape, not about the test — write the finding against the shape.
- **Measure leverage, not line counts.** The question is how much a caller gets back for the amount they have to learn. Counting implementation lines against interface lines rewards a bloated body, which is backwards. What you want flagged is a wide, demanding entry point guarding very little; the remedy is to move work inward, never to pad what is already there.

**Read "interface" broadly.** It covers everything a caller has to know to get the call right — the signature, yes, but equally the invariants they must uphold, the order operations have to happen in, how it fails, what configuration it presumes, and how it performs under load. Two required-but-undocumented call orderings make an interface wide no matter how short the signature is.

**Speculative boundaries are Vik's, not this lens's.** "An interface with one implementation" is already a named YAGNI violation in `.claude/agents/vik.md` § Simplicity & YAGNI Lens; it stays there. This lens judges the *shape* of a boundary that earns its place — not whether it should exist.

_Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) (`codebase-design`), MIT © 2026 Matt Pocock; the deep-module framing originates with Ousterhout, whose lines-ratio definition of depth is deliberately rejected above._
