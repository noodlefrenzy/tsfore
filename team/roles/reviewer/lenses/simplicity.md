<!-- agent-notes: { ctx: "reviewer lens: simplicity, YAGNI, maintainability, performance traps", deps: [team/roles/reviewer/SKILL.md, docs/methodology/debt-markers.md], state: draft, last: "claude@2026-09-09" } -->

## Lens: Simplicity

Guiding question: could someone who did not write this understand it at 2am during an incident?

### The laziness ladder

Before accepting that something should exist, walk the ladder and stop at the first rung that holds:

1. Does this need to exist at all? Speculative need is a cut.
2. Does the standard library or the language already do it?
3. Does a native platform feature cover it? A database constraint over app-level validation; CSS over JavaScript.
4. Does an already-installed dependency solve it?
5. Is it one line?
6. Only then: the minimum code that works.

Two rungs work: take the higher one. Flag what was built past its rung: an interface with one implementation, config for a value that never changes, scaffolding for later, a new dependency where ten lines would do.

Lazy is not negligent. Trust-boundary validation, data-loss handling, security, and accessibility are never on the chopping block, and when two equally short options exist, the one that is correct on edge cases wins.

### What else to look for

- Clever code that needs a comment to explain it.
- N+1 queries: loops that trigger queries.
- Concurrency: shared mutable state, races, deadlocks.
- Subprocess spawns with stdio channels left implicit, no timeout, or a health check that does not exercise the real code path.
- Names that hide intent. Functions doing more than one thing.
- Change out of proportion to the problem: a refactor of the world for a bug fix.
- Hot-path changes, allocation in loops, resource leaks, bundle growth from a new dependency.
- A deliberate shortcut with no `summon:` marker naming its ceiling and upgrade path. Unmarked reads as ignorance; marked reads as intent.
