#!/usr/bin/env node
// agent-notes: { ctx: "tests for dispatch: a work order becomes a plan; spawn and claim events written from outside the model", deps: [scripts/dispatch.mjs, scripts/compose-team.mjs, scripts/team-log.mjs, scripts/run-checks.mjs, team/events.json, team/lines/tdd.json, docs/methodology/team-layers.md], state: draft, last: "claude@2026-09-10", key: ["no wall-clock reads: at is always injected", "the plan is the assignment and carries the line's constraints; a station never chooses its own instance", "distinct-instance is refused at plan time when the draw collides or a seat cannot supply two instances, and at claim time when the log shows the same instance on both stations", "only ok:true from the instance that claimed releases a station; the order constraint is enforced per item, before the claim is written", "the fixture's .gitignore and tracked empty log match the repo's, so tree.dirty is asserted against the real configuration"] }
//
//   node --test scripts/dispatch.test.mjs
//
// Red phase, written before scripts/dispatch.mjs existed. Second red on 2026-09-10 for the
// decisions out of the three-lens review (docs/history/code-reviews/2026-09-09-dispatch-{tara,vik,pierrot}.md);
// every test added then cites its finding in the comment above it.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { claim, loadOrder, open, plan } from "./dispatch.mjs";
import { appendEvent, checkLog, loadLine, loadSchema, readLog, validateEvent } from "./team-log.mjs";

const SCRIPT = resolve(import.meta.dirname, "dispatch.mjs");
const REPO = resolve(import.meta.dirname, "..");
const roots = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const T = "2026-09-09T12:00:00Z";
const T2 = "2026-09-09T12:05:00Z";
const T3 = "2026-09-09T12:10:00Z";
const LOG = ".summon/team-log.jsonl";

const role = (name, charter) => `---
name: ${name}
description: ${charter}
---
# ${name[0].toUpperCase() + name.slice(1)}

## Charter

FIXTURE-${name.toUpperCase()}-CHARTER ${charter}

## Standard

A standard.

## Questions

A question.

## Boundaries

A boundary.

## Output

An output.
`;
const persona = (name, roleName, marker, lens = null) => `---
name: ${name}
role: ${roleName}
${lens ? `lens: ${lens}\n` : ""}display: ${name[0].toUpperCase() + name.slice(1)}
---
## Priors

${marker}-PRIORS Priors.

## Dissent

${marker}-DISSENT When something only this persona would push on.

## Voice

${marker}-VOICE Voice.

"Line."

## Tells

${marker}-TELLS Tells.
`;
const lens = (name, marker) => `## Lens: ${name}\n\n${marker} Guiding question.\n`;

/** The checked-in tdd line, verbatim: red (tara) → green (sato) → review (review-party). */
const TDD = {
  name: "tdd",
  stations: [
    { name: "red", seat: "tara", emits: "tests" },
    { name: "green", seat: "sato", needs: ["tests"], emits: "change" },
    { name: "review", seat: "review-party", needs: ["change"], emits: "verdicts" },
  ],
  constraints: [
    { rule: "order", stations: ["red", "green", "review"] },
    { rule: "distinct-instance", stations: ["green", "review"] },
  ],
};
/** A line where one seat holds both constrained stations: only two instances of sato can satisfy it. */
const SOLO = {
  name: "solo",
  stations: [
    { name: "red", seat: "tara", emits: "tests" },
    { name: "green", seat: "sato", needs: ["tests"], emits: "change" },
    { name: "review", seat: "sato", needs: ["change"], emits: "verdicts" },
  ],
  constraints: [
    { rule: "order", stations: ["red", "green", "review"] },
    { rule: "distinct-instance", stations: ["green", "review"] },
  ],
};
/**
 * A line with three sato stations and a distinct-instance constraint spanning the first and last of
 * them. With sato: 2 the round-robin draw lands green and review on the same instance (1, 2, 1);
 * with sato: 3 it does not (1, 2, 3).
 */
const TRIPLE = {
  name: "triple",
  stations: [
    { name: "red", seat: "tara", emits: "tests" },
    { name: "green", seat: "sato", needs: ["tests"], emits: "change" },
    { name: "polish", seat: "sato", needs: ["change"], emits: "change" },
    { name: "review", seat: "sato", needs: ["change"], emits: "verdicts" },
  ],
  constraints: [
    { rule: "order", stations: ["red", "green", "polish", "review"] },
    { rule: "distinct-instance", stations: ["green", "review"] },
  ],
};
/** A line the fixture party exists alongside but does not opt into. */
const ROGUE = { name: "rogue", stations: [{ name: "red", seat: "tara", emits: "tests" }], constraints: [] };
/** A line naming a seat nobody composes. */
const GHOST = { name: "ghost", stations: [{ name: "red", seat: "nobody", emits: "tests" }], constraints: [] };

const ORDER = {
  id: "wo-1",
  party: "core",
  line: "tdd",
  items: [{ id: "i1", spec: "specs/i1.md" }, { id: "i2", spec: "specs/i2.md" }, { id: "i3", spec: "specs/i3.md" }],
  instances: { tara: 1, sato: 2, "review-party": 1 },
};

const HARNESS = {
  harness: "claude-code",
  fitted: true,
  review: "x",
  output: { dir: ".claude/agents", file: "{name}.md" },
  capabilities: { read: ["Read"], run: ["Bash"], "write:src": ["Write"], "write:tests": ["Write"] },
  frontmatter: {},
  budget: {},
  // concurrency 4 = tara 1 + sato 2 + review-party 1, so the default order sits exactly at the limit
  dispatch: { concurrency: 4, depth: 1, isolation: "worktree" },
};

/**
 * A fixture team: tester (tara), coder (sato), a review-party formation (vik, pierrot); party "core"
 * opts into lines tdd, solo, and triple; an order file at order.json. The .gitignore and the tracked
 * empty log match the repo's own (.summon/worktrees/ and .summon/plan.json ignored, .summon/team-log.jsonl
 * tracked), so what the tests say about the tree state holds for the real configuration. With
 * git: true the root is a repo with one commit.
 */
function fixture(edit = () => {}, { git = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "summon-dispatch-"));
  roots.push(root);
  const files = {
    "team/roles/tester/SKILL.md": role("tester", "Writes failing tests first."),
    "team/roles/tester/role.json": JSON.stringify({ may: ["read", "run", "write:tests"], "must-not": ["write:src"], lenses: [] }),
    "team/roles/coder/SKILL.md": role("coder", "Makes the failing tests pass."),
    "team/roles/coder/role.json": JSON.stringify({ may: ["read", "run", "write:src"], "must-not": ["write:tests"], lenses: [] }),
    "team/roles/reviewer/SKILL.md": role("reviewer", "Reads a change and reports what is wrong with it."),
    "team/roles/reviewer/role.json": JSON.stringify({ may: ["read", "run"], "must-not": ["write:src"], lenses: ["simplicity", "security"] }),
    "team/roles/reviewer/lenses/simplicity.md": lens("Simplicity", "FIXTURE-LENS-SIMPLICITY"),
    "team/roles/reviewer/lenses/security.md": lens("Security", "FIXTURE-LENS-SECURITY"),
    "team/personas/tara.md": persona("tara", "tester", "FIXTURE-TARA"),
    "team/personas/sato.md": persona("sato", "coder", "FIXTURE-SATO"),
    "team/personas/vik.md": persona("vik", "reviewer", "FIXTURE-VIK", "simplicity"),
    "team/personas/pierrot.md": persona("pierrot", "reviewer", "FIXTURE-PIERROT", "security"),
    "team/harness/claude-code.json": JSON.stringify(HARNESS),
    "team/parties/core.json": JSON.stringify({
      name: "core",
      harness: "claude-code",
      members: [
        { role: "tester", persona: "tara" },
        { role: "coder", persona: "sato" },
      ],
      formations: [{ name: "review-party", role: "reviewer", members: [{ persona: "vik", lens: "simplicity" }, { persona: "pierrot", lens: "security" }] }],
      lines: ["tdd", "solo", "triple"],
    }),
    "team/lines/tdd.json": JSON.stringify(TDD),
    "team/lines/solo.json": JSON.stringify(SOLO),
    "team/lines/triple.json": JSON.stringify(TRIPLE),
    "team/lines/rogue.json": JSON.stringify(ROGUE),
    "team/lines/ghost.json": JSON.stringify(GHOST),
    "team/events.json": readFileSync(join(REPO, "team/events.json"), "utf8"),
    "team/checks.json": JSON.stringify({ log: LOG }),
    "order.json": JSON.stringify(ORDER),
    // The repo's own rule: worktrees and the plan are ignored; the log is tracked (empty here, as at init).
    ".gitignore": ".summon/worktrees/\n.summon/plan.json\n",
    [LOG]: "",
  };
  edit(files);
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), typeof content === "string" ? content : JSON.stringify(content));
  }
  const run = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (git) {
    run("init", "-q");
    run("-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
    run("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "fixture");
  }
  return { root, git: run };
}

/** Apply several fixture edits in order. */
const edits = (...fns) => (f) => { for (const fn of fns) fn(f); };
/** Edit the order in a fixture's file map. */
const withOrder = (patch) => (f) => (f["order.json"] = JSON.stringify({ ...ORDER, ...patch }));
/** Edit the harness in a fixture's file map. */
const withHarness = (patch) => (f) => (f["team/harness/claude-code.json"] = JSON.stringify({ ...HARNESS, ...patch }));
/** The adapter with isolation none: spawn events carry worktree null and nothing is created on disk. */
const NONE = withHarness({ dispatch: { concurrency: 4, depth: 1, isolation: "none" } });
/** Write a plan for the fixture's order under .summon/ (ignored by git, as in the repo) and return its path relative to root. */
const PLAN = ".summon/plan.json";
function planned(root, orderPath = "order.json") {
  const p = plan(root, { orderPath });
  writeFileSync(join(root, PLAN), JSON.stringify(p));
  return { plan: p, planPath: PLAN };
}
/** The station rows of one item in a plan, keyed by station name. */
const stationsOf = (p, item) => Object.fromEntries(p.items.find((i) => i.id === item).stations.map((s) => [s.station, s]));
/** A schema-valid return event for an instance on an item. */
const returned = (seat, instance, item, t, ok = true) => ({ t, seat, instance, event: "return", ok, item });
/** A schema-valid claim event written by hand, as a seat with a shell could. */
const claimed = (seat, instance, item, station, t) => ({ t, seat, instance, event: "claim", item, station, order: "wo-1" });
/** The events on the log, or [] when no log has been written yet. */
const logOrEmpty = (root) => (existsSync(join(root, LOG)) ? readLog(join(root, LOG)) : []);
/** Claim a station for an item and write its return, so the next station may be claimed. */
function walk(root, planPath, item, station, t, ok = true) {
  const e = claim(root, { planPath, item, station, at: t });
  appendEvent(join(root, LOG), returned(e.seat, e.instance, item, t, ok), loadSchema(root));
  return e;
}

// --- the order ----------------------------------------------------------------
// team-layers.md § The work order: a JSON file, anywhere, with id, party, line, items, instances.
// The schema lives in team/events.json under workOrder, next to the events it produces. Instance
// counts and item ids are validated here because they reach a worktree path and a shell line downstream.

test("loadOrder parses a well-formed order so that the file the human wrote is the file dispatch runs", () => {
  const { root } = fixture();
  const o = loadOrder(join(root, "order.json"));
  assert.equal(o.id, "wo-1");
  assert.equal(o.party, "core");
  assert.equal(o.line, "tdd");
  assert.deepEqual(o.items.map((i) => i.id), ["i1", "i2", "i3"]);
  assert.deepEqual(o.instances, { tara: 1, sato: 2, "review-party": 1 });
});

test("loadOrder refuses an order missing any required field, naming the field, so a half-written order never becomes a plan", () => {
  for (const field of ["id", "party", "line", "items", "instances"]) {
    const { root } = fixture((f) => {
      const o = { ...ORDER };
      delete o[field];
      f["order.json"] = JSON.stringify(o);
    });
    assert.throws(() => loadOrder(join(root, "order.json")), new RegExp(`"${field}"`), `missing ${field} must be named`);
  }
});

test("loadOrder refuses an item without an id, because the id is the item every event carries", () => {
  const { root } = fixture(withOrder({ items: [{ id: "i1" }, { spec: "specs/anon.md" }] }));
  assert.throws(() => loadOrder(join(root, "order.json")), /"id"/);
});

// Vik 2, Pierrot 5
test("loadOrder refuses an instance count that is not a positive integer, naming instances.<seat>, so a zero, a fraction, a string, or a boolean never reaches the draw", () => {
  for (const bad of [0, -1, 1.5, "2", true]) {
    const { root } = fixture(withOrder({ instances: { tara: 1, sato: bad, "review-party": 1 } }));
    assert.throws(() => loadOrder(join(root, "order.json")), /instances\.sato/, `instances.sato = ${JSON.stringify(bad)} must be refused by name`);
  }
});

// Pierrot 6
test("loadOrder refuses an item id outside [A-Za-z0-9._-], naming the id, because the id reaches a shell line in the workflow prompt", () => {
  const { root } = fixture(withOrder({ items: [{ id: "i1; echo x" }] }));
  assert.throws(() => loadOrder(join(root, "order.json")), /i1; echo x/);
});

// --- plan: the assignment -------------------------------------------------------
// § The work order: plan names every instance, gives each a worktree when isolation asks for it,
// and assigns one instance per station per item by one round-robin counter per seat, advanced by
// every station of every item in the order the line draws them. The plan is the assignment; a
// station is never left to choose its own instance.

test("plan names the order, party, line, harness, and the adapter's dispatch limits, and every instance as seat#n from 1 with a worktree under .summon/worktrees", () => {
  const { root } = fixture();
  const p = plan(root, { orderPath: "order.json" });
  assert.equal(p.order, "wo-1");
  assert.equal(p.party, "core");
  assert.equal(p.line, "tdd");
  assert.equal(p.harness, "claude-code");
  assert.deepEqual(p.limits, { concurrency: 4, depth: 1, isolation: "worktree" });
  const instances = p.instances.map((i) => [i.seat, i.instance, i.worktree]).sort((a, b) => a[1].localeCompare(b[1]));
  assert.deepEqual(instances, [
    ["review-party", "review-party#1", ".summon/worktrees/review-party#1"],
    ["sato", "sato#1", ".summon/worktrees/sato#1"],
    ["sato", "sato#2", ".summon/worktrees/sato#2"],
    ["tara", "tara#1", ".summon/worktrees/tara#1"],
  ]);
});

test("plan assigns one instance per station per item, carrying the station's seat, needs, and emits from the line", () => {
  const { root } = fixture();
  const p = plan(root, { orderPath: "order.json" });
  assert.deepEqual(p.items.map((i) => i.id), ["i1", "i2", "i3"]);
  const s = stationsOf(p, "i1");
  assert.deepEqual(Object.keys(s), ["red", "green", "review"], "stations in the line's order");
  assert.deepEqual(s.red, { station: "red", seat: "tara", instance: "tara#1", needs: [], emits: "tests" });
  assert.deepEqual(s.green, { station: "green", seat: "sato", instance: "sato#1", needs: ["tests"], emits: "change" });
  assert.deepEqual(s.review, { station: "review", seat: "review-party", instance: "review-party#1", needs: ["change"], emits: "verdicts" });
  for (const i of p.items) for (const st of i.stations) assert.ok(p.instances.some((x) => x.instance === st.instance), `${st.instance} is a named instance`);
});

test("plan round-robins a seat's instances across items, so with sato: 2 and three items green is held by sato#1, sato#2, sato#1", () => {
  const { root } = fixture();
  const p = plan(root, { orderPath: "order.json" });
  assert.deepEqual(p.items.map((i) => stationsOf(p, i.id).green.instance), ["sato#1", "sato#2", "sato#1"]);
  assert.deepEqual(p.items.map((i) => stationsOf(p, i.id).red.instance), ["tara#1", "tara#1", "tara#1"], "a single instance takes every item");
});

// Tara Suggestion 1, Vik clean (c); the rule is now the spec's sentence, and the expected draw is written from it
test("plan advances one counter per seat across every station of every item, so on solo with sato: 2 sato#1 codes and sato#2 reviews every item", () => {
  const { root } = fixture(withOrder({ line: "solo", instances: { tara: 1, sato: 2 } }));
  const p = plan(root, { orderPath: "order.json" });
  // Draws for sato in line order: i1 green, i1 review, i2 green, i2 review, i3 green, i3 review = 1, 2, 1, 2, 1, 2.
  assert.deepEqual(p.items.map((i) => stationsOf(p, i.id).green.instance), ["sato#1", "sato#1", "sato#1"]);
  assert.deepEqual(p.items.map((i) => stationsOf(p, i.id).review.instance), ["sato#2", "sato#2", "sato#2"]);
});

test("plan gives a seat the order does not name exactly one instance when a station needs it", () => {
  const { root } = fixture(withOrder({ instances: { sato: 2 } }));
  const p = plan(root, { orderPath: "order.json" });
  assert.deepEqual(p.instances.filter((i) => i.seat === "tara").map((i) => i.instance), ["tara#1"]);
  assert.deepEqual(p.instances.filter((i) => i.seat === "review-party").map((i) => i.instance), ["review-party#1"]);
  assert.equal(p.instances.length, 4);
});

test("plan sets worktree to null when the adapter's isolation is none, so nothing downstream creates one", () => {
  const { root } = fixture(NONE);
  const p = plan(root, { orderPath: "order.json" });
  assert.equal(p.limits.isolation, "none");
  assert.ok(p.instances.every((i) => i.worktree === null), "no instance has a worktree");
});

// Vik 9
test("the plan carries the line's constraints, so claim reads the plan and not the line file, and an edited line cannot loosen a plan already dealt", () => {
  const { root } = fixture();
  const { plan: p, planPath } = planned(root);
  assert.deepEqual(p.constraints, TDD.constraints);
  writeFileSync(join(root, "team/lines/tdd.json"), JSON.stringify({ ...TDD, constraints: [] }));
  assert.throws(() => claim(root, { planPath, item: "i1", station: "green", at: T }), /red/, "the plan's order constraint still holds");
  assert.deepEqual(logOrEmpty(root), [], "a refused claim writes nothing");
});

// --- plan: distinct-instance ----------------------------------------------------
// § The line: the station that reviews an item must not be held by the instance that coded it.
// When one seat holds both constrained stations, only two instances of that seat can satisfy it;
// and when the draw would put both stations on one instance, plan refuses rather than re-dealing.

test("plan on a line where one seat holds both constrained stations assigns two different instances of that seat to every item", () => {
  const { root } = fixture(withOrder({ line: "solo", instances: { tara: 1, sato: 2 } }));
  const p = plan(root, { orderPath: "order.json" });
  assert.equal(p.items.length, 3);
  for (const item of p.items) {
    const s = stationsOf(p, item.id);
    assert.equal(s.green.seat, "sato");
    assert.equal(s.review.seat, "sato");
    assert.notEqual(s.green.instance, s.review.instance, `item ${item.id}: green and review must be held by different instances`);
  }
});

// Vik 1 over Tara Critical 1: a collision at plan time refuses and names the seat; it does not re-deal
test("plan refuses the triple line with sato: 2, where the draw lands green and review on one instance, naming both stations and the seat that needs more instances", () => {
  const { root } = fixture(withOrder({ line: "triple", instances: { tara: 1, sato: 2 } }));
  assert.throws(() => plan(root, { orderPath: "order.json" }), (err) => /green/.test(err.message) && /review/.test(err.message) && /\bsato\b/.test(err.message));
});

// Vik 1, Tara Critical 1
test("plan accepts the triple line with sato: 3, and green and review sit on different instances for every item without any re-deal", () => {
  const { root } = fixture(withOrder({ line: "triple", instances: { tara: 1, sato: 3 } }));
  const p = plan(root, { orderPath: "order.json" });
  assert.equal(p.items.length, 3);
  for (const item of p.items) {
    const s = stationsOf(p, item.id);
    assert.notEqual(s.green.instance, s.review.instance, `item ${item.id}: green and review must be held by different instances`);
  }
  // The draw is the rule's, untouched: three sato stations per item over three instances.
  assert.deepEqual(p.items.map((i) => [stationsOf(p, i.id).green.instance, stationsOf(p, i.id).polish.instance, stationsOf(p, i.id).review.instance]), [
    ["sato#1", "sato#2", "sato#3"],
    ["sato#1", "sato#2", "sato#3"],
    ["sato#1", "sato#2", "sato#3"],
  ]);
});

test("plan refuses a line whose distinct-instance constraint cannot be met with one instance of the shared seat, naming the constraint, the seat, and both stations", () => {
  const { root } = fixture(withOrder({ line: "solo", instances: { tara: 1, sato: 1 } }));
  assert.throws(() => plan(root, { orderPath: "order.json" }), (err) => /distinct-instance/.test(err.message) && /"sato"|\bsato\b/.test(err.message) && /green/.test(err.message) && /review/.test(err.message));
});

test("plan refuses the distinct-instance line when the shared seat is left unnamed in the order, since an unnamed seat gets only one instance", () => {
  const { root } = fixture(withOrder({ line: "solo", instances: { tara: 1 } }));
  assert.throws(() => plan(root, { orderPath: "order.json" }), /distinct-instance/);
});

// Tara Important 4
test("plan accepts the tdd line with a single sato, because green and review sit on different seats and the refusal is about a shared seat", () => {
  const { root } = fixture(withOrder({ instances: { tara: 1, sato: 1, "review-party": 1 } }));
  const p = plan(root, { orderPath: "order.json" });
  assert.equal(p.instances.length, 3);
  for (const item of p.items) {
    const s = stationsOf(p, item.id);
    assert.notEqual(s.green.instance, s.review.instance);
  }
});

// --- plan: refusals -------------------------------------------------------------
// § The work order: refuses an order whose line the party does not opt into, whose seat the party
// does not compose, whose instance count exceeds the adapter's dispatch.concurrency, whose
// instances name a seat the line has no station for, or whose adapter's isolation is unknown.

test("plan refuses an order whose line the party does not opt into, naming the line and the party", () => {
  const { root } = fixture(withOrder({ line: "rogue" }));
  assert.throws(() => plan(root, { orderPath: "order.json" }), (err) => /rogue/.test(err.message) && /core/.test(err.message));
});

test("plan refuses a line whose station names a seat the party does not compose, naming the seat", () => {
  const { root } = fixture((f) => {
    withOrder({ line: "ghost" })(f);
    const party = JSON.parse(f["team/parties/core.json"]);
    party.lines = ["tdd", "ghost"];
    f["team/parties/core.json"] = JSON.stringify(party);
  });
  assert.throws(() => plan(root, { orderPath: "order.json" }), /nobody/);
});

test("plan refuses an order whose total instances exceed the adapter's concurrency, naming the count and the limit, and allows a total exactly at the limit", () => {
  const { root: at } = fixture();
  assert.equal(plan(at, { orderPath: "order.json" }).instances.length, 4, "4 of 4 is allowed");
  const { root: over } = fixture(withOrder({ instances: { tara: 1, sato: 3, "review-party": 1 } }));
  assert.throws(() => plan(over, { orderPath: "order.json" }), (err) => /concurrency/.test(err.message) && /\b5\b/.test(err.message) && /\b4\b/.test(err.message));
});

// Vik 2, Pierrot 5
test("plan refuses an instances key that no station of the line uses, naming the key and listing the line's seats, so a typo does not silently plan one instance", () => {
  const { root } = fixture(withOrder({ instances: { tara: 1, sato: 2, "review-party": 1, satto: 2 } }));
  assert.throws(
    () => plan(root, { orderPath: "order.json" }),
    (err) => /satto/.test(err.message) && /\btara\b/.test(err.message) && /\bsato\b/.test(err.message) && /review-party/.test(err.message)
  );
});

test("plan refuses an adapter with dispatch: null, because a harness with no spawner cannot dispatch", () => {
  const { root } = fixture(withHarness({ dispatch: null }));
  assert.throws(() => plan(root, { orderPath: "order.json" }), (err) => /dispatch/.test(err.message) && /claude-code/.test(err.message));
});

// Vik 10
test("plan refuses an adapter whose dispatch.isolation is neither worktree nor none, naming the harness and the value and listing both, so a second harness cannot teach this script a word silently", () => {
  const { root } = fixture(withHarness({ dispatch: { concurrency: 4, depth: 1, isolation: "container" } }));
  assert.throws(
    () => plan(root, { orderPath: "order.json" }),
    (err) => /claude-code/.test(err.message) && /container/.test(err.message) && /worktree/.test(err.message) && /\bnone\b/.test(err.message)
  );
});

test("plan refuses an order naming a party that has no file, so a typo does not plan against nothing", () => {
  const { root } = fixture(withOrder({ party: "nope" }));
  assert.throws(() => plan(root, { orderPath: "order.json" }), /party "nope"/);
});

// Pierrot 1
test("plan refuses a formation whose name would carry a worktree path out of .summon/worktrees, naming the name", () => {
  const { root } = fixture((f) => {
    const party = JSON.parse(f["team/parties/core.json"]);
    party.formations[0].name = "../escape";
    f["team/parties/core.json"] = JSON.stringify(party);
    f["team/lines/tdd.json"] = JSON.stringify({ ...TDD, stations: TDD.stations.map((s) => (s.seat === "review-party" ? { ...s, seat: "../escape" } : s)) });
    withOrder({ instances: { tara: 1, sato: 2, "../escape": 1 } })(f);
  });
  assert.throws(() => plan(root, { orderPath: "order.json" }), /\.\.\/escape/);
});

// --- open: spawn events and worktrees -------------------------------------------
// § The work order: open writes one spawn event per instance, carrying harness, instance, order,
// tree, and worktree, and creates the worktrees when isolation asks for it, before any event is
// written. It refuses outside a git repository, refuses a plan whose worktree path is not the one
// its instance implies, refuses a worktree that is not at the head it binds to, and is idempotent
// on the same head. The tree state a spawn binds to ignores .summon/, the log's own footprint.
// § The event log: the events come from outside the model.

test("open writes one schema-valid spawn event per instance to the configured log, with t injected and the tree bound to the repo head", () => {
  const { root } = fixture(undefined, { git: true });
  const { plan: p, planPath } = planned(root);
  open(root, { planPath, at: T });
  const log = readLog(join(root, LOG));
  assert.equal(log.length, 4);
  const schema = loadSchema(root);
  for (const e of log) assert.deepEqual(validateEvent(e, schema), [], `spawn event for ${e.instance} is schema-valid`);
  assert.deepEqual(
    log.map((e) => [e.event, e.seat, e.instance, e.order, e.harness, e.t]).sort((a, b) => a[2].localeCompare(b[2])),
    [
      ["spawn", "review-party", "review-party#1", "wo-1", "claude-code", T],
      ["spawn", "sato", "sato#1", "wo-1", "claude-code", T],
      ["spawn", "sato", "sato#2", "wo-1", "claude-code", T],
      ["spawn", "tara", "tara#1", "wo-1", "claude-code", T],
    ]
  );
  for (const e of log) {
    assert.match(e.tree.head, /^[0-9a-f]{40}$/);
    // Pierrot 3, Tara Critical 2: the plan sits under .summon/ and the log is tracked there; this holds
    // because treeState ignores .summon/ (pinned directly in run-checks.test.mjs), not because the fixture hides it.
    assert.equal(e.tree.dirty, false, "treeState ignores .summon/, so the plan and the log do not dirty the tree");
    const planned = p.instances.find((i) => i.instance === e.instance);
    assert.ok(planned, `${e.instance} is in the plan`);
  }
});

test("open with worktree isolation creates a git worktree per instance under .summon/worktrees at the head the spawn event binds to, and the spawn event names it", () => {
  const { root, git } = fixture(undefined, { git: true });
  const { planPath } = planned(root);
  open(root, { planPath, at: T });
  const listed = git("worktree", "list", "--porcelain");
  for (const inst of ["tara#1", "sato#1", "sato#2", "review-party#1"]) {
    assert.ok(existsSync(join(root, ".summon/worktrees", inst)), `worktree dir for ${inst} exists`);
    assert.ok(listed.includes(`worktrees/${inst}`), `git knows the worktree for ${inst}`);
  }
  const log = readLog(join(root, LOG));
  assert.deepEqual(log.map((e) => e.worktree).sort(), [".summon/worktrees/review-party#1", ".summon/worktrees/sato#1", ".summon/worktrees/sato#2", ".summon/worktrees/tara#1"]);
  // Tara Suggestion 3
  for (const e of log) {
    assert.equal(git("-C", join(root, e.worktree), "rev-parse", "HEAD").trim(), e.tree.head, `${e.instance}'s worktree sits at the head its spawn bound`);
  }
});

// Vik 3, Vik 7: isolation none is the only way to spawn without a worktree, and the event says so
test("open with isolation none writes spawn events with worktree null and creates no worktrees, so the log never names a directory that does not exist", () => {
  const { root } = fixture(NONE, { git: true });
  const { planPath } = planned(root);
  open(root, { planPath, at: T });
  const log = readLog(join(root, LOG));
  assert.equal(log.length, 4);
  assert.ok(log.every((e) => e.worktree === null));
  assert.equal(existsSync(join(root, ".summon/worktrees")), false);
});

test("open validates every spawn event against the schema before writing any, so a schema the events cannot satisfy leaves the log untouched", () => {
  const { root } = fixture(edits(NONE, (f) => {
    const schema = JSON.parse(f["team/events.json"]);
    schema.events.spawn.required.push("fixture-required");
    f["team/events.json"] = JSON.stringify(schema);
  }), { git: true });
  const { planPath } = planned(root);
  assert.throws(() => open(root, { planPath, at: T }), /"fixture-required"/);
  assert.deepEqual(logOrEmpty(root), [], "nothing was written");
});

test("open refuses when no log is configured, because a spawn nobody can see is not a dispatch", () => {
  const { root } = fixture(edits(NONE, (f) => (f["team/checks.json"] = JSON.stringify({}))), { git: true });
  const { planPath } = planned(root);
  assert.throws(() => open(root, { planPath, at: T }), /no log configured/);
});

// Tara Important 6
test("open leaves the log untouched when the root is not a git repository and isolation is worktree, because worktrees come before events", () => {
  const { root } = fixture();
  const { planPath } = planned(root);
  assert.throws(() => open(root, { planPath, at: T }), /git|worktree/);
  assert.deepEqual(logOrEmpty(root), []);
});

// Pierrot 8
test("open refuses outside a git repository even with isolation none, because a spawn bound to no head binds nothing", () => {
  const { root } = fixture(NONE);
  const { planPath } = planned(root);
  assert.throws(() => open(root, { planPath, at: T }), /git repository/);
  assert.deepEqual(logOrEmpty(root), []);
});

// Pierrot 1
test("open refuses a plan whose worktree is not .summon/worktrees/<instance>, naming the instance, and neither writes an event nor creates a worktree", () => {
  for (const edited of ["scratch/sato#1", ".summon/worktrees/sato#2"]) {
    const { root } = fixture(undefined, { git: true });
    const { plan: p, planPath } = planned(root);
    p.instances.find((i) => i.instance === "sato#1").worktree = edited;
    writeFileSync(join(root, planPath), JSON.stringify(p));
    assert.throws(() => open(root, { planPath, at: T }), /sato#1/, `worktree hand-edited to ${edited} must be refused naming the instance`);
    assert.deepEqual(logOrEmpty(root), [], "nothing was written");
    assert.equal(existsSync(join(root, "scratch")), false, "nothing was created at the edited path");
    assert.equal(existsSync(join(root, ".summon/worktrees")), false, "no worktree was created before the refusal");
  }
});

// Pierrot 4
test("open twice on the same head is idempotent: the log has exactly one spawn per instance and the second open writes none", () => {
  const { root } = fixture(undefined, { git: true });
  const { planPath } = planned(root);
  open(root, { planPath, at: T });
  open(root, { planPath, at: T2 });
  const spawns = readLog(join(root, LOG)).filter((e) => e.event === "spawn");
  assert.deepEqual(spawns.map((e) => e.instance).sort(), ["review-party#1", "sato#1", "sato#2", "tara#1"]);
});

// Pierrot 4
test("open refuses an existing worktree that is not at the head the spawn would bind to, naming the worktree and the head, and writes no spawn", () => {
  const { root, git } = fixture(undefined, { git: true });
  const first = planned(root);
  open(root, { planPath: first.planPath, at: T });
  writeFileSync(join(root, "later.txt"), "x");
  git("-c", "user.name=t", "-c", "user.email=t@t", "add", "later.txt");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "later");
  const { planPath } = planned(root);
  const before = readLog(join(root, LOG)).length;
  assert.throws(() => open(root, { planPath, at: T2 }), (err) => /worktree/.test(err.message) && /head/i.test(err.message));
  assert.equal(readLog(join(root, LOG)).length, before, "no spawn was written for a stale worktree");
});

// Pierrot 4(b): a plain directory inside the repo answers `rev-parse HEAD` with the main head, so the
// head check alone would accept it and the seat would run in the main tree while the log says otherwise.
test("open refuses a plain directory at the worktree path, because it is not a worktree of its own, and writes no spawn", () => {
  const { root } = fixture(undefined, { git: true });
  const { planPath } = planned(root);
  mkdirSync(join(root, ".summon/worktrees/sato#1"), { recursive: true });
  assert.throws(() => open(root, { planPath, at: T }), /worktree.*sato#1.*not a git worktree/);
  assert.deepEqual(logOrEmpty(root), [], "no spawn was written for a foreign directory");
});

// A plan written before constraints were carried in the plan would claim with none; that is a silent
// weakening of the line, so a plan without the key is stale and says so.
test("claim refuses a plan that carries no constraints, naming it stale, rather than claiming with none", () => {
  const { root } = fixture();
  const { plan: p, planPath } = planned(root);
  delete p.constraints;
  writeFileSync(join(root, planPath), JSON.stringify(p));
  assert.throws(() => claim(root, { planPath, item: "i1", station: "red", at: T }), /stale|constraints/);
  assert.deepEqual(logOrEmpty(root), [], "nothing was written");
});

// --- claim: the separation-of-duties boundary -----------------------------------
// § The work order: claim writes the claim event for the instance the plan assigned, and refuses
// before writing when the log shows the item's earlier stations have not returned (order) or when
// the assigned instance already holds a station the constraint separates it from (distinct-instance).
// A return releases a station only when it carries ok: true and the item, and comes from the
// instance that claimed it. This is the boundary enforced at dispatch, before the seat runs.

test("claim on the first station writes a claim event for the plan's instance on an empty log and returns it", () => {
  const { root } = fixture();
  const { planPath } = planned(root);
  const e = claim(root, { planPath, item: "i1", station: "red", at: T });
  assert.deepEqual(e, { t: T, seat: "tara", instance: "tara#1", event: "claim", item: "i1", station: "red", order: "wo-1" });
  assert.deepEqual(readLog(join(root, LOG)), [e]);
});

test("claim on a later station refuses until the earlier station has returned for that item, naming the item, the station claimed, and the station owed, and writes nothing on refusal", () => {
  const { root } = fixture();
  const { planPath } = planned(root);
  assert.throws(() => claim(root, { planPath, item: "i1", station: "green", at: T }), (err) => /"i1"|\bi1\b/.test(err.message) && /green/.test(err.message) && /red/.test(err.message));
  assert.deepEqual(logOrEmpty(root), [], "a refused claim writes nothing");
  claim(root, { planPath, item: "i1", station: "red", at: T });
  assert.throws(() => claim(root, { planPath, item: "i1", station: "green", at: T2 }), /red/, "a claim on red is not a return from red");
  appendEvent(join(root, LOG), returned("tara", "tara#1", "i1", T2), loadSchema(root));
  const e = claim(root, { planPath, item: "i1", station: "green", at: T3 });
  assert.equal(e.instance, "sato#1");
  assert.equal(e.station, "green");
  assert.throws(() => claim(root, { planPath, item: "i2", station: "green", at: T3 }), /red/, "the order constraint is per item: i1's return does not release i2");
});

test("claim on review refuses until both red and green have returned, because the order constraint chains every earlier station", () => {
  const { root } = fixture();
  const { planPath } = planned(root);
  const schema = loadSchema(root);
  claim(root, { planPath, item: "i1", station: "red", at: T });
  appendEvent(join(root, LOG), returned("tara", "tara#1", "i1", T), schema);
  // Vik 12: take the count before the refusal, so the comparison can fail.
  const before = readLog(join(root, LOG)).length;
  assert.throws(() => claim(root, { planPath, item: "i1", station: "review", at: T2 }), /green/, "red returned, green still owed");
  assert.equal(readLog(join(root, LOG)).length, before, "nothing written on refusal");
  claim(root, { planPath, item: "i1", station: "green", at: T2 });
  appendEvent(join(root, LOG), returned("sato", "sato#1", "i1", T2), schema);
  const e = claim(root, { planPath, item: "i1", station: "review", at: T3 });
  assert.equal(e.instance, "review-party#1");
});

// Tara Important 5
test("claim on review refuses naming red when green has returned but red never did, because the chain reaches every earlier station and not only the previous one", () => {
  const { root } = fixture();
  const { planPath } = planned(root);
  const schema = loadSchema(root);
  const file = join(root, LOG);
  appendEvent(file, claimed("sato", "sato#1", "i1", "green", T), schema);
  appendEvent(file, returned("sato", "sato#1", "i1", T2), schema);
  const before = readLog(file).length;
  assert.throws(() => claim(root, { planPath, item: "i1", station: "review", at: T3 }), /red/);
  assert.equal(readLog(file).length, before, "nothing written on refusal");
});

// Vik 4
test("a return with ok: false does not release the station, so a station that aborted still blocks the next one", () => {
  const { root } = fixture();
  const { planPath } = planned(root);
  claim(root, { planPath, item: "i1", station: "red", at: T });
  appendEvent(join(root, LOG), returned("tara", "tara#1", "i1", T2, false), loadSchema(root));
  const before = readLog(join(root, LOG)).length;
  assert.throws(() => claim(root, { planPath, item: "i1", station: "green", at: T3 }), /red/);
  assert.equal(readLog(join(root, LOG)).length, before, "nothing written on refusal");
});

// Tara Important 1
test("a return from an instance that never claimed on the item does not release the station another instance holds", () => {
  const { root } = fixture();
  const { planPath } = planned(root);
  claim(root, { planPath, item: "i1", station: "red", at: T });
  appendEvent(join(root, LOG), returned("sato", "sato#2", "i1", T2), loadSchema(root));
  assert.throws(() => claim(root, { planPath, item: "i1", station: "green", at: T3 }), /red/, "sato#2's return is not tara#1's");
});

// Tara Suggestion 2
test("a return that carries a seat but no instance does not release a station claimed by a named instance", () => {
  const { root } = fixture();
  const { planPath } = planned(root);
  claim(root, { planPath, item: "i1", station: "red", at: T });
  appendEvent(join(root, LOG), { t: T2, seat: "tara", event: "return", ok: true, item: "i1" }, loadSchema(root));
  assert.throws(() => claim(root, { planPath, item: "i1", station: "green", at: T3 }), /red/, "\"tara\" is not \"tara#1\"");
});

test("claim refuses when the plan's instance already holds a station the distinct-instance constraint separates from this one, naming the instance and both stations, and writes nothing", () => {
  // solo line: plan gives i1 green and review to two different sato instances. A hand-written claim
  // in the log shows the review instance already coded i1; the plan's assignment cannot be honoured.
  const { root } = fixture(withOrder({ line: "solo", instances: { tara: 1, sato: 2 } }));
  const { plan: p, planPath } = planned(root);
  const schema = loadSchema(root);
  const s = stationsOf(p, "i1");
  const reviewer = s.review.instance;
  const file = join(root, LOG);
  appendEvent(file, claimed("tara", "tara#1", "i1", "red", T), schema);
  appendEvent(file, returned("tara", "tara#1", "i1", T), schema);
  appendEvent(file, claimed("sato", reviewer, "i1", "green", T2), schema);
  appendEvent(file, returned("sato", reviewer, "i1", T2), schema);
  const before = readLog(file).length;
  assert.throws(() => claim(root, { planPath, item: "i1", station: "review", at: T3 }), (err) => err.message.includes(reviewer) && /green/.test(err.message) && /review/.test(err.message));
  assert.equal(readLog(file).length, before, "a refused claim writes nothing");
});

// Tara Important 2
test("claim on review succeeds for the plan's other sato instance when a different sato instance coded the item, because distinct-instance compares instances and not seats", () => {
  const { root } = fixture(withOrder({ line: "solo", instances: { tara: 1, sato: 2 } }));
  const { plan: p, planPath } = planned(root);
  walk(root, planPath, "i1", "red", T);
  const green = walk(root, planPath, "i1", "green", T2);
  const review = claim(root, { planPath, item: "i1", station: "review", at: T3 });
  assert.equal(review.seat, "sato");
  assert.equal(green.seat, "sato");
  assert.notEqual(review.instance, green.instance);
  assert.equal(review.instance, stationsOf(p, "i1").review.instance, "the claim is for the instance the plan assigned");
});

// Tara Important 3
test("distinct-instance is per item: the instance that coded i1 may review i2", () => {
  const { root } = fixture(withOrder({ line: "solo", instances: { tara: 1, sato: 3 } }));
  const { plan: p, planPath } = planned(root);
  const coderOf1 = stationsOf(p, "i1").green.instance;
  // One counter per seat: i1 draws sato#1, sato#2; i2 draws sato#3, sato#1. So i1's coder reviews i2.
  assert.equal(stationsOf(p, "i2").review.instance, coderOf1);
  walk(root, planPath, "i1", "red", T);
  assert.equal(walk(root, planPath, "i1", "green", T).instance, coderOf1);
  walk(root, planPath, "i2", "red", T2);
  walk(root, planPath, "i2", "green", T2);
  const review = claim(root, { planPath, item: "i2", station: "review", at: T3 });
  assert.equal(review.instance, coderOf1, "coding i1 does not bar reviewing i2");
});

test("claim refuses an item or a station that is not in the plan, naming it, so nothing is claimed off-plan", () => {
  const { root } = fixture();
  const { planPath } = planned(root);
  assert.throws(() => claim(root, { planPath, item: "i9", station: "red", at: T }), /"i9"|\bi9\b/);
  assert.throws(() => claim(root, { planPath, item: "i1", station: "polish", at: T }), /polish/);
  assert.deepEqual(logOrEmpty(root), []);
});

test("an item walked red, green, review through claim and return leaves a log that team-log's line check reports clean, with distinct coding and reviewing instances", () => {
  const { root } = fixture();
  const { planPath } = planned(root);
  const schema = loadSchema(root);
  const file = join(root, LOG);
  walk(root, planPath, "i1", "red", T);
  const green = walk(root, planPath, "i1", "green", T2);
  const review = walk(root, planPath, "i1", "review", T3);
  assert.notEqual(green.instance, review.instance);
  const { items, violations } = checkLog(readLog(file), loadLine("tdd", root), schema);
  assert.equal(items, 1);
  assert.deepEqual(violations, []);
});

// --- the CLI ----------------------------------------------------------------------
// plan, open, and claim run without the workflow, so a human dispatching by hand still gets the
// events and the refusals.

const EXEC = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20_000 };

test("CLI plan writes the plan file and prints one line naming the order, the instance count, and the item count", () => {
  const { root } = fixture();
  const out = execFileSync(process.execPath, [SCRIPT, "plan", "--order", "order.json", "--out", PLAN], { cwd: root, ...EXEC });
  assert.equal(out.trim().split("\n").length, 1, "one line");
  assert.match(out, /wo-1/);
  assert.match(out, /4 instances/);
  assert.match(out, /3 items/);
  const p = JSON.parse(readFileSync(join(root, PLAN), "utf8"));
  assert.equal(p.order, "wo-1");
  assert.equal(p.instances.length, 4);
  assert.equal(p.items.length, 3);
});

test("CLI plan exits non-zero with the refusal on stderr and writes no plan file", () => {
  const { root } = fixture(withOrder({ line: "rogue" }));
  assert.throws(
    () => execFileSync(process.execPath, [SCRIPT, "plan", "--order", "order.json", "--out", PLAN], { cwd: root, ...EXEC }),
    (err) => err.status !== 0 && /rogue/.test(String(err.stderr))
  );
  assert.equal(existsSync(join(root, PLAN)), false);
});

// Vik 7: isolation none replaces the --no-worktrees switch
test("CLI open with isolation none writes the spawn events at the given time with worktree null and creates no worktrees; CLI claim writes the claim for the plan's instance", () => {
  const { root } = fixture(NONE, { git: true });
  execFileSync(process.execPath, [SCRIPT, "plan", "--order", "order.json", "--out", PLAN], { cwd: root, ...EXEC });
  execFileSync(process.execPath, [SCRIPT, "open", "--plan", PLAN, "--at", T], { cwd: root, ...EXEC });
  const spawned = readLog(join(root, LOG));
  assert.equal(spawned.length, 4);
  assert.ok(spawned.every((e) => e.event === "spawn" && e.t === T && e.worktree === null));
  assert.equal(existsSync(join(root, ".summon/worktrees")), false);
  execFileSync(process.execPath, [SCRIPT, "claim", "--plan", PLAN, "--item", "i1", "--station", "red", "--at", T2], { cwd: root, ...EXEC });
  const log = readLog(join(root, LOG));
  assert.equal(log.length, 5);
  assert.deepEqual(log[4], { t: T2, seat: "tara", instance: "tara#1", event: "claim", item: "i1", station: "red", order: "wo-1" });
});

// Vik 7
test("CLI open refuses --no-worktrees on stderr, because whether an instance gets a worktree is the adapter's isolation and not a switch", () => {
  const { root } = fixture(NONE, { git: true });
  execFileSync(process.execPath, [SCRIPT, "plan", "--order", "order.json", "--out", PLAN], { cwd: root, ...EXEC });
  assert.throws(
    () => execFileSync(process.execPath, [SCRIPT, "open", "--plan", PLAN, "--at", T, "--no-worktrees"], { cwd: root, ...EXEC }),
    (err) => err.status !== 0 && /no-worktrees/.test(String(err.stderr))
  );
  assert.deepEqual(logOrEmpty(root), [], "a refused open writes nothing");
});

test("CLI open with worktree isolation creates the worktrees under .summon/worktrees", () => {
  const { root, git } = fixture(undefined, { git: true });
  execFileSync(process.execPath, [SCRIPT, "plan", "--order", "order.json", "--out", PLAN], { cwd: root, ...EXEC });
  execFileSync(process.execPath, [SCRIPT, "open", "--plan", PLAN, "--at", T], { cwd: root, ...EXEC });
  assert.ok(existsSync(join(root, ".summon/worktrees/sato#2")));
  assert.ok(git("worktree", "list", "--porcelain").includes("worktrees/sato#2"));
});

test("CLI claim exits non-zero with the refusal on stderr when the earlier station has not returned, and writes nothing", () => {
  const { root } = fixture();
  execFileSync(process.execPath, [SCRIPT, "plan", "--order", "order.json", "--out", PLAN], { cwd: root, ...EXEC });
  assert.throws(
    () => execFileSync(process.execPath, [SCRIPT, "claim", "--plan", PLAN, "--item", "i1", "--station", "green", "--at", T], { cwd: root, ...EXEC }),
    (err) => err.status !== 0 && /red/.test(String(err.stderr)) && /green/.test(String(err.stderr))
  );
  assert.deepEqual(logOrEmpty(root), []);
});

test("CLI refuses a missing --order, --plan, --item, or --station on stderr rather than planning against nothing", () => {
  const { root } = fixture();
  const fails = (args, re) => assert.throws(() => execFileSync(process.execPath, [SCRIPT, ...args], { cwd: root, ...EXEC }), (err) => err.status !== 0 && re.test(String(err.stderr)));
  fails(["plan", "--out", PLAN], /--order/);
  fails(["open", "--at", T], /--plan/);
  fails(["claim", "--plan", PLAN, "--station", "red", "--at", T], /--item/);
  fails(["claim", "--plan", PLAN, "--item", "i1", "--at", T], /--station/);
});

// --- the checked-in party -----------------------------------------------------------
// The spec's own example order plans against the real summon-core party, tdd line, and claude-code
// adapter, whose dispatch field is the live limit the tests above fixture.

test("the spec's example order plans against the checked-in summon-core party on the tdd line under the claude-code adapter's live limits", () => {
  const { root: elsewhere } = fixture(withOrder({ id: "wo-138-a", party: "summon-core", items: [{ id: "138-a", spec: "docs/sprints/138-a.md" }] }));
  const p = plan(REPO, { orderPath: join(elsewhere, "order.json") });
  assert.equal(p.order, "wo-138-a");
  assert.equal(p.harness, "claude-code");
  assert.deepEqual(p.limits, { concurrency: 10, depth: 1, isolation: "worktree" });
  const s = stationsOf(p, "138-a");
  assert.deepEqual([s.red.instance, s.green.instance, s.review.instance], ["tara#1", "sato#1", "review-party#1"]);
  assert.notEqual(s.green.instance, s.review.instance);
});
