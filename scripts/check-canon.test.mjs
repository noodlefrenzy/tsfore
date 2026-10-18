#!/usr/bin/env node
// agent-notes: { ctx: "tests for check-canon: review-sentinel integrity, the team tree", deps: [scripts/check-canon.mjs, docs/process/gotchas.md, docs/methodology/team-layers.md], state: active, last: "tara@2026-09-11", key: ["catches the real 2026-08-06 placeholder verbatim", "false-positive guards: board pipeline prose and the /command placeholder both mention in-flight words", "entry-point guard regression: importing must not exit, running must print", "ten rules: the third pass's rule #11 (team/version.json) and its section here are gone; the installed version lives in .summon/manifest.json (ADR-0006 #6) and is not a canon rule"] }
//
//   node --test scripts/check-canon.test.mjs
//
// The check exists because prose did not hold. On 2026-08-06 a review agent
// briefed to "write the file on turn 1 and end it with a sentinel" wrote
// `PIERROT-COMPLETE: 0 findings, 0 critical` above a body reading
// `Status: IN PROGRESS`, then ran out of turns. The coordinator's gate compares
// the declared count against the findings present — 0 matched 0 — so it passed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { findSentinelProblems } from "./check-canon.mjs";

const SCRIPT = resolve(import.meta.dirname, "check-canon.mjs");

/** Write one markdown file into a fresh temp dir and scan it. */
function scan(contents) {
  const dir = mkdtempSync(join(tmpdir(), "summon-sentinel-"));
  writeFileSync(join(dir, "report.md"), contents);
  return findSentinelProblems(dir);
}

// --- the failure this check was built for -----------------------------------

test("catches the 2026-08-06 placeholder verbatim", () => {
  const problems = scan(
    `# Impeccable Add-on Implementation — Security Review (Pierrot)

Status: IN PROGRESS — review underway, findings below are being filled in.

PIERROT-COMPLETE: 0 findings, 0 critical
`
  );
  assert.ok(problems.length > 0, "the real placeholder must not pass");
  assert.match(problems.join("\n"), /IN PROGRESS/);
});

test("flags an in-flight status declaration above a sentinel", () => {
  const problems = scan(
    `# Review

Status: TBD

## Findings
### Finding 1 — something
REVIEW-COMPLETE: 1 findings (0 critical, 0 important)
`
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /before the work it attests to/);
});

test("flags a sentinel that is not the last line", () => {
  const problems = scan(
    `# Review

## Findings
### Finding 1 — something

REVIEW-COMPLETE: 1 findings (0 critical, 0 important)

Oh, one more thing I found afterwards.
`
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not the last line/);
});

test("flags a zero-findings sentinel with no sections describing what was checked", () => {
  const problems = scan(`# Review\n\nREVIEW-COMPLETE: 0 findings (0 critical)\n`);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /show its work/);
});

// --- false-positive guards --------------------------------------------------
//
// These matter more than the positives. A check that fires on correct reviews
// is one people learn to route around, which is worse than not having it — and
// the first draft of this check did exactly that on two real files.

test("accepts a genuinely clean review that shows its work", () => {
  const problems = scan(
    `# Review

## What I checked
Every input path, both failure branches, and the digest.

## Verified clean
No findings.

REVIEW-COMPLETE: 0 findings (0 critical, 0 important)
`
  );
  assert.deepEqual(problems, []);
});

test("does not fire on a review that discusses the board's In Progress stage", () => {
  // Regression: docs/history/code-reviews/2026-06-24-canon-checks.md analyses
  // the `Backlog → Ready → In Progress → In Review → Done` pipeline at length.
  const problems = scan(
    `# Review of checkStatusFlow

## Findings
### Finding 1 — the separator class is too narrow
The pipeline \`Backlog → Ready → In Progress → In Review → Done\` must stay ordered.
A set-style claim written In Progress, Done, Backlog would read as drift.

REVIEW-COMPLETE: 1 findings (0 critical, 1 important)
`
  );
  assert.deepEqual(problems, []);
});

test("does not fire on a review that discusses a placeholder token", () => {
  // Regression: docs/history/code-reviews/2026-06-24-doctor-check-a.md discusses
  // the `/command` placeholder that checkCommandRefs deliberately ignores.
  const problems = scan(
    `# Review of checkCommandRefs

## Findings
### Finding 1 — resolves-or-builtin-or-placeholder
A token that is the \`/command\` placeholder is reported as ok. TBD is not a status here.

REVIEW-COMPLETE: 1 findings (0 critical, 0 important)
`
  );
  assert.deepEqual(problems, []);
});

test("ignores markdown files that carry no sentinel at all", () => {
  assert.deepEqual(scan(`# Some design note\n\nStatus: IN PROGRESS\n\nNotes follow.\n`), []);
});

test("tolerates a missing directory", () => {
  assert.deepEqual(findSentinelProblems(join(tmpdir(), "summon-does-not-exist-9f3a")), []);
});

test("scans nested directories, not just the top level", () => {
  const dir = mkdtempSync(join(tmpdir(), "summon-sentinel-"));
  mkdirSync(join(dir, "tracking"), { recursive: true });
  writeFileSync(
    join(dir, "tracking", "r.md"),
    `# R\n\nStatus: IN PROGRESS\n\nVIK-COMPLETE: 2 findings\n`
  );
  assert.equal(findSentinelProblems(dir).length, 1);
});

// --- entry-point guard ------------------------------------------------------
//
// The guard added to make this module importable is the same six characters
// whose absence was a Critical defect in the CSS checker. If it breaks the
// other way, `node scripts/check-canon.mjs` silently does nothing and exits 0 —
// a green CI that checked nothing.

test("importing this module does not run the CLI", () => {
  // Reaching this line at all proves it: a missing guard would have called
  // process.exit() during the import at the top of this file.
  assert.equal(typeof findSentinelProblems, "function");
});

test("running the script as a CLI still executes the checks", () => {
  const out = execFileSync(process.execPath, [SCRIPT], {
    cwd: resolve(import.meta.dirname, ".."),
    encoding: "utf8",
  });
  assert.match(out, /canon check:/, "the CLI must produce a verdict, not exit silently");
});

// --- check #10: the team tree (ADR-0015 sequencing step 4) --------------------
// Red phase for findTeamProblems. The composer already refuses a malformed layer at
// compose time; this check makes those refusals, plus three rules the composer does
// not own (adapters fitted, deps resolve, log validates), CI facts.

import { findTeamProblems } from "./check-canon.mjs";

const ROLE = `---
name: tester
description: Writes failing tests first.
---
<!-- agent-notes: { ctx: "fixture", deps: [team/roles/tester/role.json], state: draft, last: "t@2026-09-09" } -->
# Tester

## Charter

FIXTURE-CHARTER You write the failing tests first.

## Standard

Fails for the right reason.

## Questions

Time pinned?

## Boundaries

You do not write production code.

## Output

The tests.
`;
const PERSONA = (priors = "FIXTURE-PRIORS A test that cannot fail is worse than none.", dep = "team/roles/tester/SKILL.md") => `---
name: tara
role: tester
display: Tara
---
<!-- agent-notes: { ctx: "fixture", deps: [${dep}], state: draft, last: "t@2026-09-09" } -->
## Priors

${priors}

## Dissent

When the brief's arithmetic is off, she says the real number unprompted.

## Voice

Precise.

"Minus two."

## Tells

Counts.
`;
const TEAM = (edit = () => {}) => {
  const root = mkdtempSync(join(tmpdir(), "summon-canon-team-"));
  const files = {
    "team/roles/tester/SKILL.md": ROLE,
    "team/roles/tester/role.json": JSON.stringify({ may: ["read", "write:tests"], "must-not": ["write:src"], lenses: [] }),
    "team/personas/tara.md": PERSONA(),
    "team/views/skin/party.json": JSON.stringify({ skin: "skin", title: "FIXTURE-TITLE", members: { tara: { class: "FIXTURE-CLASS-ARCHER", accent: "#ef4444", blurb: "FIXTURE-BLURB" } } }),
    "team/harness/claude-code.json": JSON.stringify({ harness: "claude-code", fitted: true, review: "x", output: { dir: ".claude/agents", file: "{name}.md" }, capabilities: { read: ["Read"], "write:src": ["Write"], "write:tests": ["Write"] }, frontmatter: {}, budget: {} }),
    "team/parties/core.json": JSON.stringify({ name: "core", harness: "claude-code", view: "skin", members: [{ role: "tester", persona: "tara" }], formations: [] }),
    "team/events.json": JSON.stringify({ common: ["t", "seat", "event"], events: { claim: { required: ["item"] } }, severities: [], verdicts: ["accept"], grades: [] }),
    "team/checks.json": JSON.stringify({ log: ".summon/team-log.jsonl" }),
    ".summon/team-log.jsonl": JSON.stringify({ t: "2026-09-09T10:00:00Z", seat: "tara", event: "claim", item: "i1" }) + "\n",
  };
  edit(files);
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  return root;
};

test("team: a clean tree has no problems", () => {
  assert.deepEqual(findTeamProblems(TEAM()), []);
});

test("team: a tree with no team/ directory is skipped, not failed", () => {
  const root = mkdtempSync(join(tmpdir(), "summon-canon-noteam-"));
  assert.deepEqual(findTeamProblems(root), []);
});

test("team: a party that does not compose fails with the composer's own reason", () => {
  const root = TEAM((f) => (f["team/parties/core.json"] = JSON.stringify({ name: "core", harness: "claude-code", view: "skin", members: [{ role: "tester", persona: "nobody" }] })));
  const problems = findTeamProblems(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /party "core".*persona "nobody"/);
});

test("team: an adapter that is not fitted: true fails, naming the adapter", () => {
  // team-layers.md: fitted is "Always true. Every adapter is fitted to something."
  const root = TEAM((f) => (f["team/harness/claude-code.json"] = f["team/harness/claude-code.json"].replace('"fitted":true', '"fitted":false')));
  assert.ok(findTeamProblems(root).some((p) => /adapter "claude-code".*fitted/.test(p)), findTeamProblems(root).join("; "));
});

test("team: skin text that reaches a composed agent fails, naming the agent and the string", () => {
  // A persona whose own prose repeats its skin class is the realistic way a leak happens.
  const root = TEAM((f) => (f["team/personas/tara.md"] = PERSONA("I am FIXTURE-CLASS-ARCHER, and proud of it.")));
  const problems = findTeamProblems(root);
  assert.ok(problems.some((p) => /\.claude\/agents\/tara\.md.*FIXTURE-CLASS-ARCHER/.test(p)), problems.join("; "));
});

test("team: an agent-notes dep under team/ that does not resolve fails, naming the file and the dep", () => {
  const root = TEAM((f) => (f["team/personas/tara.md"] = PERSONA(undefined, "team/roles/nope/SKILL.md")));
  const problems = findTeamProblems(root);
  assert.ok(problems.some((p) => /team\/personas\/tara\.md.*"team\/roles\/nope\/SKILL\.md"/.test(p)), problems.join("; "));
});

test("team: an invalid event in the configured log fails by line number; a missing log file does not", () => {
  const bad = TEAM((f) => (f[".summon/team-log.jsonl"] += JSON.stringify({ t: "2026-09-09T10:01:00Z", seat: "tara", event: "dance" }) + "\n"));
  assert.ok(findTeamProblems(bad).some((p) => /team-log\.jsonl line 2.*event "dance"/.test(p)), findTeamProblems(bad).join("; "));
  const none = TEAM((f) => (f[".summon/team-log.jsonl"] = null));
  assert.deepEqual(findTeamProblems(none), []);
});

test("team: the checked-in tree passes", () => {
  assert.deepEqual(findTeamProblems(resolve(import.meta.dirname, "..")), []);
});
