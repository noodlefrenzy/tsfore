---
agent-notes: { ctx: "canon example ADR — worked sample of a datastore decision for a fictional app; ships as a learn-from/delete template", deps: [CLAUDE.md, docs/adrs/template.md], state: accepted, last: "archie@2026-07-03" }
---

# ADR-0008: SQLite for the v1 data store, with a documented Postgres exit

> **Example ADR.** This is a worked sample for a *fictional* app, shipped so a new project has one real, meaty ADR to learn the shape from. Study it, then delete it or replace it with your own first decision. Nothing here binds your project.

## Status

Accepted (2026-07-03).

## Context

The app is a single-writer web service in its first weeks: one backend process, a few hundred rows, no concurrent writers, and a deploy target that is a single small VM. We need a data store now, and the choice tends to calcify — migrating a store after a schema and a year of data exist is a project, not an afternoon.

Two candidates are on the table: SQLite (embedded, file-backed) and Postgres (a separate server process). The pull toward Postgres is real: it is where this app almost certainly ends up if it succeeds — concurrent writers, a connection pool, extensions we might want (full-text search, `jsonb`, PostGIS). The pull toward SQLite is that none of that is true *yet*, and standing up, securing, backing up, and paying for a Postgres server is real operational weight we would carry from day one for a load we do not have.

The failure mode we most want to avoid is not "picked the smaller database." It is "picked the store we can never leave" — an early choice that leaks its assumptions across the codebase until switching means rewriting the data layer under load.

## Decision

Use **SQLite** for v1, accessed only through a thin repository layer, and write the Postgres exit down now while it is cheap.

Concretely:

- All data access goes through a `store/` module that exposes domain operations (`createOrder`, `listOrdersForUser`), never raw SQL, to the rest of the app. No handler imports the database driver directly.
- We use only SQL and types that Postgres also supports. No SQLite-only features (no `WITHOUT ROWID`, no dynamic typing tricks, no `rowid` as a public key). Timestamps are stored as ISO-8601 text, money as integer minor units — decisions that survive the move.
- Migrations are plain, ordered `.sql` files applied by a runner, not an ORM's implicit sync. The same files must run against Postgres with at most mechanical edits.
- The move-to-Postgres trigger is written into `docs/product-context.md`: the first of {a second writer process, sustained write contention, a feature that needs a Postgres-only extension}. Hitting the trigger opens a new ADR; it does not get debated ad hoc.

## Consequences

### Positive

- **Zero data-tier operations in v1.** No server to provision, secure, patch, or pay for. The database is a file in a backed-up volume; a restore is a file copy.
- **The repository boundary is the real insurance.** Because the app only ever calls `store/`, the eventual Postgres swap is scoped to one module and its tests, not the whole codebase — which is what makes the "store we can't leave" failure mode not apply here.
- **Tests are fast and hermetic.** Each test gets its own in-memory database with no fixtures server, so the suite stays parallel and deterministic.

### Negative

- **A migration is still coming if we succeed.** We are choosing to pay a known, bounded cost later instead of an unknown, unbounded one now. The discipline (repository layer, portable SQL) is what keeps that cost bounded — and it only holds if code review enforces it on every PR that touches `store/`.
- **We forgo Postgres-only features until the move.** If a near-term feature genuinely needs `jsonb` querying or full-text search, this decision is wrong and should be revisited immediately, not deferred to the trigger.
- **SQLite's single-writer model is a real ceiling.** Concurrent writes serialize. That is fine for one process and fatal for several — which is exactly why "a second writer" is the first item on the move trigger.

### Neutral

- The choice is reversible by design; the exit is documented rather than assumed. Reversibility was the point, not a happy accident.
- ORMs were considered and declined for v1 in favor of explicit SQL through the repository layer, on the same portability reasoning. That is a separate concern and would warrant its own ADR if revisited.
