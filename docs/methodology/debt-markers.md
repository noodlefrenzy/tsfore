---
agent-notes: { ctx: "summon: debt-marker convention for deliberate shortcuts", deps: [CLAUDE.md, docs/process/done-gate.md, docs/methodology/agent-notes.md], state: active, last: "vik@2026-06-15" }
---

# Debt Markers — the `summon:` comment convention

A debt marker is the inline counterpart to the tech-debt ledger. When code deliberately takes a shortcut, you mark it **where it lives**, naming the ceiling it hits and the upgrade path past it. The marker turns "we'll fix it later" — which reliably becomes "never" — into a grep-able, harvestable item.

> Borrowed shamelessly from the [ponytail](https://github.com/DietrichGebert/ponytail)
> `ponytail:` convention. The idea is good; we adapt it to Summon's existing
> tech-debt flow (Done Gate item 12 → `docs/tech-debt.md`).

## The marker

```
<comment> summon: <what was skipped>, <upgrade path / when to revisit>
```

Concrete examples:

```ts
// summon: in-memory map, swap for Redis if this runs multi-process
const cache = new Map<string, Session>();
```

```py
# summon: global lock, per-account locks if throughput matters
with GLOBAL_LOCK:
    ...
```

```ts
// summon: O(n^2) scan, fine under ~1k rows; index by id past that
for (const a of items) for (const b of items) ...
```

The shape is deliberate: **the ceiling** (`global lock`, `O(n^2) scan`, `naive heuristic`) and **the trigger** (`if throughput matters`, `past 1k rows`). A marker that just says "summon: hack" is noise — it names neither what breaks nor when.

## When to mark — and when not to

Mark when you make a **conscious, working simplification** with a known limit:

- The lazy-but-correct solution that has a scaling ceiling.
- A naive algorithm chosen because the input is small today.
- A single-process / single-region assumption that holds for now.

Do **not** use `summon:` for:

- **Bugs or unfinished work.** Those are `TODO`/`FIXME` (or better, an issue). A `summon:` marker describes code that *works* — it just won't scale or generalize past a stated point.
- **The non-negotiables.** Trust-boundary validation, data-loss handling, security, and accessibility are never "debt." They are done or the work is not done. You don't get to mark them and move on.

## Lifecycle

1. **Mark** at write time, in the same diff as the shortcut.
2. **Harvest** with `node scripts/harvest-debt.mjs` — lists every marker with its location. Run it during Vik's sprint-boundary dead-code/debt pass.
3. **Log** material debt into `docs/tech-debt.md` (Done Gate item 12), so the ledger and the board agree on what's outstanding.
4. **Pay down or delete.** When the ceiling is reached (or proven irrelevant), do the upgrade and remove the marker, or delete the marker if the concern evaporated. A marker for code that no longer exists is itself debt.

## Relationship to other conventions

- **agent-notes** (`docs/methodology/agent-notes.md`) describe a *file*; a `summon:` marker describes a *line of logic*. Different scope, different lifetime.
- **`docs/tech-debt.md`** is the ledger of record. Markers feed it; they don't replace it. The marker is the breadcrumb, the ledger is the map.
- The **Done Gate** (item 12, and the simplicity gate item 16) is where an agent confirms shortcuts taken this item were both marked and logged.
