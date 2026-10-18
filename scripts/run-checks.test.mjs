#!/usr/bin/env node
// agent-notes: { ctx: "tests for run-checks: executes a seat's bound checks, binds receipts to the tree, writes check events", deps: [scripts/run-checks.mjs, scripts/compose-team.mjs, scripts/team-log.mjs, team/events.json, docs/methodology/team-layers.md], state: draft, last: "tara@2026-09-10", key: ["no wall-clock reads: t is injected", "receipts bind to a tree state (head, dirty) and are stale when the head moves", "treeState ignores .summon/, so the log the tree binding is written to never dirties it", "commands run through the real shell against a fixture repo"] }
//
//   node --test scripts/run-checks.test.mjs
//
// Red phase, written before scripts/run-checks.mjs existed.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { runChecks, treeState } from "./run-checks.mjs";
import { readLog } from "./team-log.mjs";

const SCRIPT = resolve(import.meta.dirname, "run-checks.mjs");
const REPO = resolve(import.meta.dirname, "..");
const roots = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const ROLE = `---
name: tester
description: Writes failing tests first.
---
# Tester

## Charter

You write the failing tests first.

## Standard

Fails for the right reason.

## Questions

Time pinned?

## Boundaries

You do not write production code.

## Output

The tests.
`;
const PERSONA = `---
name: tara
role: tester
display: Tara
---
## Priors

A test that cannot fail is worse than none.

## Dissent

When the brief's arithmetic is off, she says the real number unprompted.

## Voice

Precise.

"Minus two."

## Tells

Counts.
`;

/** A fixture repo: a git tree with one commit, a team with one seat and three checks (pass, fail, unbound). */
function fixture(edit = () => {}) {
  const root = mkdtempSync(join(tmpdir(), "summon-run-"));
  roots.push(root);
  const files = {
    "team/roles/tester/SKILL.md": ROLE,
    "team/roles/tester/role.json": JSON.stringify({
      may: ["read", "run", "write:tests"],
      "must-not": ["write:src"],
      lenses: [],
      checks: [
        { id: "passes", claim: "FIXTURE-PASS The passing claim." },
        { id: "fails", claim: "FIXTURE-FAIL The failing claim." },
        { id: "judged", claim: "FIXTURE-JUDGED The unbound claim." },
      ],
    }),
    "team/personas/tara.md": PERSONA,
    "team/harness/claude-code.json": JSON.stringify({ harness: "claude-code", fitted: true, review: "x", output: { dir: ".claude/agents", file: "{name}.md" }, capabilities: { read: ["Read"], run: ["Bash"], "write:src": ["Write"], "write:tests": ["Write"] }, frontmatter: {}, budget: {} }),
    "team/parties/core.json": JSON.stringify({ name: "core", harness: "claude-code", members: [{ role: "tester", persona: "tara" }], formations: [] }),
    "team/events.json": readFileSync(join(REPO, "team/events.json"), "utf8"),
    "team/checks.json": JSON.stringify({
      log: ".summon/team-log.jsonl",
      passes: { run: "echo FIXTURE-OK-LINE && true", receipt: "the ok line" },
      fails: { run: "echo FIXTURE-BAD-LINE && exit 3", receipt: "the bad line" },
    }),
  };
  edit(files);
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  git("-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "fixture");
  return { root, git };
}

const T = "2026-09-09T12:00:00Z";

// --- tree state -------------------------------------------------------------
// ADR-0012 D8: evidence is bound to an exact tree state and invalidated when the tree changes.

test("treeState reports the head and whether the tree is dirty", () => {
  const { root } = fixture();
  const clean = treeState(root);
  assert.match(clean.head, /^[0-9a-f]{40}$/);
  assert.equal(clean.dirty, false);
  writeFileSync(join(root, "scratch.txt"), "x");
  assert.equal(treeState(root).dirty, true, "an untracked file makes the tree dirty");
});

// Pierrot 3, Tara Critical 2; § The work order: the tree state a spawn binds to ignores .summon/, the
// log's own footprint, so a receipt reads dirty for the code and not for the record. The repo tracks
// .summon/team-log.jsonl, so without this every open after the first would bind to a dirty tree.
test("treeState ignores changes under .summon/ so the log's own writes do not dirty the tree", () => {
  const { root } = fixture((f) => (f[".summon/team-log.jsonl"] = ""));
  const { head, dirty } = treeState(root);
  assert.equal(dirty, false, "clean at the fixture commit");
  writeFileSync(join(root, ".summon/team-log.jsonl"), `{"t":"${T}","seat":"tara","event":"spawn","harness":"claude-code","tree":{}}\n`);
  assert.deepEqual(treeState(root), { head, dirty: false }, "a tracked file under .summon/ modified does not dirty the tree");
  writeFileSync(join(root, ".summon/plan.json"), "{}");
  assert.equal(treeState(root).dirty, false, "an untracked file under .summon/ does not dirty the tree either");
  writeFileSync(join(root, "team/checks.json"), "{}");
  assert.equal(treeState(root).dirty, true, "a tracked file outside .summon/ modified still dirties the tree");
});

// --- running ----------------------------------------------------------------

test("runChecks executes each bound check for a seat, binds the receipt to the tree, and reports pass/fail by exit code", () => {
  const { root } = fixture();
  const r = runChecks(root, { party: "core", seat: "tara", at: T });
  assert.deepEqual(r.results.map((x) => [x.id, x.grade, x.exit]), [
    ["passes", "deterministic", 0],
    ["fails", "deterministic", 3],
    ["judged", "inferential", null],
  ]);
  const pass = r.results.find((x) => x.id === "passes");
  assert.match(pass.receipt, /FIXTURE-OK-LINE/);
  assert.match(r.results.find((x) => x.id === "fails").receipt, /FIXTURE-BAD-LINE/);
  assert.equal(pass.tree.dirty, false);
  assert.match(pass.tree.head, /^[0-9a-f]{40}$/);
  assert.equal(r.ok, false, "one bound check failed");
});

test("runChecks writes one check event per bound check to the configured log, with t injected and the tree attached, and none for unbound checks", () => {
  const { root } = fixture();
  runChecks(root, { party: "core", seat: "tara", at: T, item: "i1" });
  const log = readLog(join(root, ".summon/team-log.jsonl"));
  assert.deepEqual(log.map((e) => [e.event, e.seat, e.id, e.exit, e.item, e.t]), [
    ["check", "tara", "passes", 0, "i1", T],
    ["check", "tara", "fails", 3, "i1", T],
  ]);
  assert.equal(log[0].grade, "deterministic");
  assert.match(log[0].tree.head, /^[0-9a-f]{40}$/);
  assert.equal(typeof log[0].tree.dirty, "boolean");
  assert.match(log[0].receipt, /FIXTURE-OK-LINE/);
});

test("runChecks with no log configured runs and reports but writes nothing", () => {
  const { root } = fixture((f) => (f["team/checks.json"] = JSON.stringify({ passes: { run: "true", receipt: "" } })));
  const r = runChecks(root, { party: "core", seat: "tara", at: T });
  assert.equal(r.results.filter((x) => x.grade === "deterministic").length, 1);
  assert.throws(() => readLog(join(root, ".summon/team-log.jsonl")), /no such log/);
});

test("runChecks truncates a long receipt to its tail and says so", () => {
  const { root } = fixture((f) => (f["team/checks.json"] = JSON.stringify({ log: ".summon/team-log.jsonl", passes: { run: "seq 1 500", receipt: "the tail" } })));
  const r = runChecks(root, { party: "core", seat: "tara", at: T });
  const receipt = r.results.find((x) => x.id === "passes").receipt;
  assert.match(receipt, /500\s*$/);
  assert.doesNotMatch(receipt, /^1\n/);
  assert.match(receipt, /truncated/);
});

test("runChecks refuses an unknown party or seat, naming what it has", () => {
  const { root } = fixture();
  assert.throws(() => runChecks(root, { party: "nope", seat: "tara", at: T }), /party "nope"/);
  assert.throws(() => runChecks(root, { party: "core", seat: "nobody", at: T }), /seat "nobody".*tara/);
});

test("runChecks runs a formation's checks under the formation's seat name", () => {
  const { root } = fixture((f) => {
    f["team/roles/reviewer/SKILL.md"] = ROLE.replace("name: tester", "name: reviewer");
    f["team/roles/reviewer/role.json"] = JSON.stringify({ may: ["read", "run"], "must-not": ["write:src"], lenses: ["a"], checks: [{ id: "passes", claim: "x", lens: "a" }] });
    f["team/roles/reviewer/lenses/a.md"] = "## Lens: A\n\nA.\n";
    f["team/personas/vik.md"] = PERSONA.replace("name: tara", "name: vik").replace("role: tester", "role: reviewer\nlens: a").replace("display: Tara", "display: Vik");
    f["team/parties/core.json"] = JSON.stringify({ name: "core", harness: "claude-code", members: [{ role: "tester", persona: "tara" }], formations: [{ name: "party", role: "reviewer", members: [{ persona: "vik", lens: "a" }] }] });
  });
  const r = runChecks(root, { party: "core", seat: "party", at: T });
  assert.deepEqual(r.results.map((x) => [x.id, x.exit]), [["passes", 0]]);
  assert.equal(readLog(join(root, ".summon/team-log.jsonl"))[0].seat, "party");
});

// --- the CLI ----------------------------------------------------------------

const EXEC = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20_000 };

test("CLI prints one line per check with grade and result, exits 1 when a bound check fails, 0 when all pass", () => {
  const { root } = fixture();
  assert.throws(
    () => execFileSync(process.execPath, [SCRIPT, "--party", "core", "--seat", "tara", "--at", T], { cwd: root, ...EXEC }),
    (err) => err.status === 1 && /passes\s+deterministic\s+pass/.test(err.stdout) && /fails\s+deterministic\s+FAIL \(exit 3\)/.test(err.stdout) && /judged\s+inferential\s+judged/.test(err.stdout)
  );
  const { root: good } = fixture((f) => (f["team/checks.json"] = JSON.stringify({ log: ".summon/team-log.jsonl", passes: { run: "true", receipt: "" } })));
  const out = execFileSync(process.execPath, [SCRIPT, "--party", "core", "--seat", "tara", "--at", T], { cwd: good, ...EXEC });
  assert.match(out, /1 deterministic \(1 pass, 0 fail\), 2 inferential \(judged\)/);
  assert.match(out, /head [0-9a-f]{7}/);
});

test("CLI without --at uses the current time, and refuses a missing --seat", () => {
  const { root } = fixture((f) => (f["team/checks.json"] = JSON.stringify({ log: ".summon/team-log.jsonl", passes: { run: "true", receipt: "" } })));
  execFileSync(process.execPath, [SCRIPT, "--party", "core", "--seat", "tara"], { cwd: root, ...EXEC });
  const [e] = readLog(join(root, ".summon/team-log.jsonl"));
  assert.match(e.t, /^\d{4}-\d{2}-\d{2}T/);
  assert.throws(() => execFileSync(process.execPath, [SCRIPT, "--party", "core"], { cwd: root, ...EXEC }), (err) => err.status === 1 && /--seat is required/.test(String(err.stderr)));
});
