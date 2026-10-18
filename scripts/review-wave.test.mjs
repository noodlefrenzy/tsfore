#!/usr/bin/env node
// agent-notes: { ctx: "tests for review-wave: prepare a wave's args from the formation and a diff; ingest its result into the log from outside the model", deps: [scripts/review-wave.mjs, scripts/compose-team.mjs, scripts/team-log.mjs, team/workflows/review-wave.workflow.mjs, team/parties/summon-core.json], state: draft, last: "tara@2026-09-09", key: ["conditional lenses are selected by changed paths against the party's declared globs, deterministically", "ingest validates every verdict and severity against the schema before writing a single event", "the workflow script is syntax-checked and its meta pinned as a pure literal"] }
//
//   node --test scripts/review-wave.test.mjs
//
// Red phase, written before scripts/review-wave.mjs existed.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { changedPaths, ingest, matchesAny, prepare } from "./review-wave.mjs";
import { readLog } from "./team-log.mjs";

const REPO = resolve(import.meta.dirname, "..");
const WORKFLOW = join(REPO, "team/workflows/review-wave.workflow.mjs");
const roots = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const ROLE_REVIEWER = `---
name: reviewer
description: Reads a change and reports what is wrong with it.
---
# Reviewer

## Charter

FIXTURE-CHARTER You read a change and say what is wrong.

## Standard

Every finding cites a line.

## Questions

FIXTURE-QUESTIONS The lens supplies them.

## Boundaries

FIXTURE-BOUNDARY You do not fix what you find.

## Output

FIXTURE-OUTPUT By severity.
`;
const persona = (name, lens, marker) => `---
name: ${name}
role: reviewer
lens: ${lens}
display: ${name[0].toUpperCase() + name.slice(1)}
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

function fixture(edit = () => {}) {
  const root = mkdtempSync(join(tmpdir(), "summon-wave-"));
  roots.push(root);
  const files = {
    "team/roles/reviewer/SKILL.md": ROLE_REVIEWER,
    "team/roles/reviewer/role.json": JSON.stringify({ may: ["read", "run"], "must-not": ["write:src"], lenses: ["simplicity", "security", "operational", "accessibility"] }),
    "team/roles/reviewer/lenses/simplicity.md": lens("Simplicity", "FIXTURE-LENS-SIMPLICITY"),
    "team/roles/reviewer/lenses/security.md": lens("Security", "FIXTURE-LENS-SECURITY"),
    "team/roles/reviewer/lenses/operational.md": lens("Operational", "FIXTURE-LENS-OPERATIONAL"),
    "team/roles/reviewer/lenses/accessibility.md": lens("Accessibility", "FIXTURE-LENS-ACCESSIBILITY"),
    "team/personas/vik.md": persona("vik", "simplicity", "FIXTURE-VIK"),
    "team/personas/pierrot.md": persona("pierrot", "security", "FIXTURE-PIERROT"),
    "team/personas/ines.md": persona("ines", "operational", "FIXTURE-INES"),
    "team/personas/dani.md": persona("dani", "accessibility", "FIXTURE-DANI"),
    "team/harness/claude-code.json": JSON.stringify({ harness: "claude-code", fitted: true, review: "x", output: { dir: ".claude/agents", file: "{name}.md" }, capabilities: { read: ["Read"], run: ["Bash"], "write:src": ["Write"] }, frontmatter: {}, budget: {} }),
    "team/parties/core.json": JSON.stringify({
      name: "core",
      harness: "claude-code",
      members: [],
      formations: [
        {
          name: "review-party",
          role: "reviewer",
          members: [{ persona: "vik", lens: "simplicity" }, { persona: "pierrot", lens: "security" }],
          conditional: [
            { persona: "ines", lens: "operational", when: "behaviour changes", paths: ["src/**", "!**/*.md"] },
            { persona: "dani", lens: "accessibility", when: "UI changes", paths: ["**/*.tsx", "**/*.css"] },
          ],
        },
      ],
    }),
    "team/events.json": readFileSync(join(REPO, "team/events.json"), "utf8"),
    "team/checks.json": JSON.stringify({ log: ".summon/team-log.jsonl" }),
    "change.diff": "diff --git a/src/orders/repo.ts b/src/orders/repo.ts\n--- a/src/orders/repo.ts\n+++ b/src/orders/repo.ts\n@@ -1 +1 @@\n-x\n+y\ndiff --git a/docs/notes.md b/docs/notes.md\n--- a/docs/notes.md\n+++ b/docs/notes.md\n@@ -1 +1 @@\n-a\n+b\n",
  };
  edit(files);
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  return root;
}

// --- diff paths and globs -----------------------------------------------------

test("changedPaths reads the +++ side of a unified diff and ignores deletions", () => {
  const diff = "--- a/gone.ts\n+++ /dev/null\n--- a/x.ts\n+++ b/x.ts\n--- /dev/null\n+++ b/new/y.css\n";
  assert.deepEqual(changedPaths(diff), ["x.ts", "new/y.css"]);
});

test("matchesAny handles ** and * and a leading ! as exclusion", () => {
  assert.equal(matchesAny("src/a/b.ts", ["src/**"]), true);
  assert.equal(matchesAny("docs/x.md", ["src/**"]), false);
  assert.equal(matchesAny("site/x.css", ["**/*.css"]), true);
  assert.equal(matchesAny("src/README.md", ["src/**", "!**/*.md"]), false, "an exclusion wins over an inclusion");
  assert.equal(matchesAny("src/a.ts", ["src/**", "!**/*.md"]), true);
});

// --- prepare ------------------------------------------------------------------
// team-layers.md § The line: the formation is the floor; conditional lenses join when their
// trigger holds. The trigger is decided by the changed paths, not by the model.

test("prepare builds one lens entry per floor member with a prompt carrying the charter, the lens, and the persona, and no skin or harness text", () => {
  const root = fixture();
  const args = prepare(root, { party: "core", formation: "review-party", item: "i1", diffPath: "change.diff" });
  assert.equal(args.item, "i1");
  assert.deepEqual(args.lenses.map((l) => [l.lens, l.persona, l.conditional]), [
    ["simplicity", "vik", false],
    ["security", "pierrot", false],
    ["operational", "ines", true],
  ]);
  const vik = args.lenses[0].prompt;
  for (const m of ["FIXTURE-CHARTER", "FIXTURE-LENS-SIMPLICITY", "FIXTURE-VIK-DISSENT", "FIXTURE-OUTPUT", "FIXTURE-BOUNDARY"]) assert.ok(vik.includes(m), `vik prompt lacks ${m}`);
  assert.doesNotMatch(vik, /FIXTURE-LENS-SECURITY|FIXTURE-PIERROT/, "a lens prompt carries only its own lens and persona");
  assert.doesNotMatch(vik, /maxTurns|disallowedTools|model: inherit/, "no harness frontmatter in a prompt");
  assert.equal(args.diff, readFileSync(join(root, "change.diff"), "utf8"));
  assert.deepEqual(args.changed, ["src/orders/repo.ts", "docs/notes.md"]);
});

test("prepare includes a conditional lens only when a changed path matches its globs, and says why", () => {
  const root = fixture();
  const behaviour = prepare(root, { party: "core", formation: "review-party", item: "i1", diffPath: "change.diff" });
  assert.ok(behaviour.lenses.some((l) => l.lens === "operational" && /src\/orders\/repo\.ts/.test(l.because)));
  assert.ok(!behaviour.lenses.some((l) => l.lens === "accessibility"));
  const ui = fixture((f) => (f["change.diff"] = "--- a/site/x.css\n+++ b/site/x.css\n@@ -1 +1 @@\n-a\n+b\n"));
  const args = prepare(ui, { party: "core", formation: "review-party", item: "i2", diffPath: "change.diff" });
  assert.deepEqual(args.lenses.map((l) => l.lens), ["simplicity", "security", "accessibility"]);
  assert.deepEqual(args.skipped.map((s) => s.lens), ["operational"], "skipped conditionals are reported, not silent");
});

test("prepare refuses an unknown formation, and a conditional lens with no paths is skipped and reported as undecidable", () => {
  const root = fixture();
  assert.throws(() => prepare(root, { party: "core", formation: "nope", item: "i", diffPath: "change.diff" }), /formation "nope"/);
  const noPaths = fixture((f) => {
    const p = JSON.parse(f["team/parties/core.json"]);
    delete p.formations[0].conditional[0].paths;
    f["team/parties/core.json"] = JSON.stringify(p);
  });
  const args = prepare(noPaths, { party: "core", formation: "review-party", item: "i", diffPath: "change.diff" });
  assert.ok(args.skipped.some((s) => s.lens === "operational" && /no paths/.test(s.because)));
});

// --- ingest -------------------------------------------------------------------
// The workflow returns schema-validated verdicts; the script writes the events. The seat
// never writes its own verdict, which is the half of the log ADR-0015 wanted outside the model.

const RESULT = {
  item: "i1",
  lenses: [
    { lens: "simplicity", persona: "vik", verdict: "revise", findings: [{ severity: "important", summary: "one-implementation interface", file: "src/n.ts", line: 3, refuted: false }, { severity: "suggestion", summary: "naming", file: "src/n.ts", line: 9, refuted: true }] },
    { lens: "security", persona: "pierrot", verdict: "accept", findings: [] },
  ],
};

test("ingest writes claim, one finding per surviving finding, one verdict per lens, and return, with t and instance injected", () => {
  const root = fixture();
  const r = ingest(root, { result: RESULT, station: "review", instance: "review-party#7", at: "2026-09-09T13:00:00Z" });
  const log = readLog(join(root, ".summon/team-log.jsonl"));
  assert.deepEqual(log.map((e) => [e.event, e.seat, e.instance, e.lens ?? null]), [
    ["claim", "review-party", "review-party#7", null],
    ["finding", "review-party", "review-party#7", "simplicity"],
    ["verdict", "review-party", "review-party#7", "simplicity"],
    ["verdict", "review-party", "review-party#7", "security"],
    ["return", "review-party", "review-party#7", null],
  ]);
  assert.equal(log[0].station, "review");
  assert.equal(log[1].summary, "one-implementation interface");
  assert.equal(log[2].findings, 1, "the refuted finding is dropped from the count");
  assert.ok(log.every((e) => e.t === "2026-09-09T13:00:00Z" && e.item === "i1"));
  assert.deepEqual(r, { written: 5, findings: 1, refuted: 1, verdicts: { simplicity: "revise", security: "accept" } });
});

test("ingest refuses a result with an invalid verdict or severity before writing anything", () => {
  const root = fixture();
  const bad = { ...RESULT, lenses: [{ lens: "simplicity", persona: "vik", verdict: "maybe", findings: [] }] };
  assert.throws(() => ingest(root, { result: bad, station: "review", instance: "x#1", at: "2026-09-09T13:00:00Z" }), /verdict "maybe"/);
  assert.throws(() => readLog(join(root, ".summon/team-log.jsonl")), /no such log/, "nothing was written");
  const badSev = { ...RESULT, lenses: [{ lens: "simplicity", persona: "vik", verdict: "accept", findings: [{ severity: "meh", summary: "s", refuted: false }] }] };
  assert.throws(() => ingest(root, { result: badSev, station: "review", instance: "x#1", at: "2026-09-09T13:00:00Z" }), /severity "meh"/);
});

test("ingest refuses when no log is configured", () => {
  const root = fixture((f) => (f["team/checks.json"] = JSON.stringify({})));
  assert.throws(() => ingest(root, { result: RESULT, station: "review", instance: "x#1", at: "2026-09-09T13:00:00Z" }), /no log configured/);
});

// --- the workflow script ------------------------------------------------------
// The script runs only inside the harness, so the tests pin what can be pinned from outside:
// it parses, its meta is a pure literal with the phases it uses, and it names no clock.

test("every checked-in workflow script parses and its meta is a pure literal naming its phases", () => {
  const dir = resolve(import.meta.dirname, "..", "team", "workflows");
  const files = readdirSync(dir).filter((f) => f.endsWith(".workflow.mjs")).map((f) => join(dir, f));
  assert.ok(files.includes(WORKFLOW), "review-wave is among them");
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    // The Workflow tool runs the body in an async context, so a top-level return and await are legal
    // there; wrap it the same way before asking node to parse it.
    const wrapped = `async function __workflow(args) {\n${src.replace(/^export const meta/m, "const meta")}\n}`;
    execFileSync(process.execPath, ["--check", "-"], { input: wrapped, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 10_000 });
    const meta = src.match(/^export const meta = (\{[\s\S]*?\n\})\n/m);
    assert.ok(meta, `${file}: meta is the first statement`);
    assert.doesNotMatch(meta[1], /\$\{|\.\.\.|\(\)/, `${file}: meta is a pure literal: no interpolation, spreads, or calls`);
    const phasesInMeta = [...meta[1].matchAll(/title:\s*'([^']+)'/g)].map((m) => m[1]);
    const phasesUsed = [...src.matchAll(/phase:\s*'([^']+)'/g)].map((m) => m[1]);
    for (const p of new Set(phasesUsed)) assert.ok(phasesInMeta.includes(p), `${file}: phase '${p}' is used but not declared in meta`);
    assert.doesNotMatch(src, /Date\.now|new Date\(\)|Math\.random/, `${file}: no clock or randomness inside a workflow script`);
    assert.match(src, /schema:/, `${file}: agent returns are schema-constrained`);
  }
  assert.match(readFileSync(WORKFLOW, "utf8"), /refut/i, "review findings are adversarially verified before they reach the human");
});

// --- the CLI ------------------------------------------------------------------

const EXEC = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20_000 };
const SCRIPT = resolve(import.meta.dirname, "review-wave.mjs");

test("CLI prepare writes the args file and names the lenses chosen and skipped; CLI ingest reads a result file and writes the log", () => {
  const root = fixture();
  const out = execFileSync(process.execPath, [SCRIPT, "prepare", "--party", "core", "--formation", "review-party", "--item", "i1", "--diff", "change.diff", "--out", "wave.json"], { cwd: root, ...EXEC });
  assert.match(out, /lenses: simplicity \(vik\), security \(pierrot\), operational \(ines, conditional: src\/orders\/repo\.ts\)/);
  assert.match(out, /skipped: accessibility \(dani\): no changed path matches/);
  const args = JSON.parse(readFileSync(join(root, "wave.json"), "utf8"));
  assert.equal(args.lenses.length, 3);
  writeFileSync(join(root, "result.json"), JSON.stringify(RESULT));
  const out2 = execFileSync(process.execPath, [SCRIPT, "ingest", "--result", "result.json", "--instance", "review-party#1", "--at", "2026-09-09T13:00:00Z"], { cwd: root, ...EXEC });
  assert.match(out2, /wrote 5 events for i1: 1 finding kept, 1 refuted; simplicity revise, security accept/);
  assert.equal(readLog(join(root, ".summon/team-log.jsonl")).length, 5);
});

test("the checked-in party's review formation prepares against the negative-control fixture", () => {
  const args = prepare(REPO, { party: "summon-core", formation: "review-party", item: "negative-control", diffPath: "team/fixtures/negative-control/planted.diff" });
  assert.deepEqual(args.lenses.filter((l) => !l.conditional).map((l) => l.lens), ["simplicity", "test-quality", "security", "conformance"]);
  assert.ok(args.lenses.some((l) => l.lens === "operational" && l.conditional), "the fixture changes src/, so the operational lens joins");
  assert.ok(args.skipped.some((s) => s.lens === "accessibility"), "no UI file in the fixture");
});
