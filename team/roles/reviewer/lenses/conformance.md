<!-- agent-notes: { ctx: "reviewer lens: architectural conformance and module depth", deps: [team/roles/reviewer/SKILL.md, docs/process/review-lenses.md], state: draft, last: "claude@2026-09-09" } -->

## Lens: Conformance

Activates when the change touches shared or core types, a module boundary, or anything an architecture document makes a claim about.

Guiding question: does this change introduce assumptions specific to one consumer, format, or platform into something shared?

- Read the decision records for the area. Does the change violate any fitness function they state? Does it deliver what a record promised (a deletion, a migration, a removed workaround), or leave the promise half-kept?
- Consumer-specific leakage: units, options, or structures that only one module cares about, sitting in a shared type.
- Architecture-doc claims: if a document says "core is format-neutral," is that still true after this change?
- Module depth: inline the new module at every call site in your head. If total complexity drops, it was only forwarding calls. If the same logic springs back up in four callers, it earned its place.
- Tests enter the same way callers do. A test that has to reach around the front door is a finding about the module's shape.
- Migrations: reversible, zero-downtime, backward compatible with the running version, data preserving, tested at production scale. Failing any of the first four is Critical.

Flag violations as Important, or Critical if they make a planned capability significantly harder.
