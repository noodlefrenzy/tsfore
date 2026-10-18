#!/usr/bin/env node
// agent-notes: { ctx: "tests for team-log: event validation, line constraints over a log, disagreement rate, the table renderer, the version flag", deps: [scripts/team-log.mjs, team/events.json, team/lines/tdd.json, docs/methodology/team-layers.md], state: draft, last: "tara@2026-09-11", key: ["no wall-clock reads: every event carries an explicit t", "disagreement rate direction derived from the spec: non-unanimous items over items with 2+ lens verdicts; the control measures presence only, spread needs a full window of real items", "the separation constraint is checked over the log, not asserted by the seat", "--version is summonVersion of <root>/.summon/manifest.json and nothing else: every fixture root also carries team/version.json, a root package.json, and packages/summon-team/package.json with a version no test expects, so a fallback to any fails; the source repo has no manifest, so the no-root run from a foreign cwd asserts the refusal; error messages name .summon/manifest.json and, for a bad field, its quoted key"] }
//
//   node --test scripts/team-log.test.mjs
//
// Red phase, written before scripts/team-log.mjs existed.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { appendEvent, checkLog, disagreementRate, readLog, render, validateEvent } from "./team-log.mjs";

const SCRIPT = resolve(import.meta.dirname, "team-log.mjs");
const REPO = resolve(import.meta.dirname, "..");

const roots = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const SCHEMA = JSON.parse(readFileSync(join(REPO, "team/events.json"), "utf8"));
const LINE = JSON.parse(readFileSync(join(REPO, "team/lines/tdd.json"), "utf8"));
const SKIN = {
  skin: "test-skin",
  title: "Fixture",
  members: { tara: { class: "FIXTURE-CLASS-ARCHER" }, sato: { class: "FIXTURE-CLASS-SMITH" } },
  roles: { reviewer: { class: "FIXTURE-CLASS-WARDEN" } },
  formations: { "review-party": { class: "FIXTURE-CLASS-PARTY" } },
};

/** A fresh dir with a log file; `events` are written one per line, pinned times, no clock. */
function logDir(events = []) {
  const root = mkdtempSync(join(tmpdir(), "summon-log-"));
  roots.push(root);
  mkdirSync(join(root, ".summon"), { recursive: true });
  const file = join(root, ".summon", "team-log.jsonl");
  writeFileSync(file, events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : ""));
  return { root, file };
}

const T = (n) => `2026-09-09T10:${String(n).padStart(2, "0")}:00Z`;
const ev = (n, seat, event, rest = {}) => ({ t: T(n), seat, event, ...rest });

/** A clean run of one item through the tdd line, reviewed by four lenses that split. */
function cleanItem(item, n0, { unanimous = false, coder = "sato#1", reviewer = "review-party#1" } = {}) {
  const v = unanimous ? "accept" : "revise";
  return [
    ev(n0, "tara", "claim", { item, station: "red", instance: "tara#1" }),
    ev(n0 + 1, "tara", "return", { item, ok: true, instance: "tara#1" }),
    ev(n0 + 2, "sato", "claim", { item, station: "green", instance: coder }),
    ev(n0 + 3, "sato", "check", { item, id: "tests-green", grade: "deterministic", exit: 0, instance: coder }),
    ev(n0 + 4, "sato", "return", { item, ok: true, instance: coder }),
    ev(n0 + 5, "review-party", "claim", { item, station: "review", instance: reviewer }),
    ev(n0 + 6, "review-party", "verdict", { item, lens: "simplicity", verdict: "accept", instance: reviewer }),
    ev(n0 + 7, "review-party", "verdict", { item, lens: "test-quality", verdict: v, findings: unanimous ? 0 : 1, instance: reviewer }),
    ev(n0 + 8, "review-party", "verdict", { item, lens: "security", verdict: "accept", instance: reviewer }),
    ev(n0 + 9, "review-party", "return", { item, ok: true, instance: reviewer }),
  ];
}

// --- validation --------------------------------------------------------------
// team-layers.md § The event log: every event carries t, seat, event; each event type has required fields.

test("validateEvent accepts each documented event with its required fields and rejects a missing one", () => {
  for (const [name, spec] of Object.entries(SCHEMA.events)) {
    const good = ev(1, "tara", name, Object.fromEntries(spec.required.map((k) => [k, k === "exit" ? 0 : k === "ok" ? true : k === "verdict" ? "accept" : k === "grade" ? "deterministic" : k === "severity" ? "critical" : k === "tree" ? { head: "abc", dirty: false } : "x"])));
    assert.deepEqual(validateEvent(good, SCHEMA), [], `${name} with all required fields should validate`);
    for (const k of spec.required) {
      const { [k]: _, ...bad } = good;
      const problems = validateEvent(bad, SCHEMA);
      assert.ok(problems.some((p) => p.includes(`"${k}"`)), `${name} without ${k} should name the field; got ${problems}`);
    }
  }
});

test("validateEvent rejects an unknown event, a bad verdict, a bad severity, a bad grade, and a missing common field", () => {
  assert.match(validateEvent(ev(1, "tara", "dance"), SCHEMA).join(), /event "dance"/);
  assert.match(validateEvent(ev(1, "tara", "verdict", { lens: "x", item: "i", verdict: "maybe" }), SCHEMA).join(), /verdict "maybe"/);
  assert.match(validateEvent(ev(1, "tara", "finding", { severity: "meh", summary: "s" }), SCHEMA).join(), /severity "meh"/);
  assert.match(validateEvent(ev(1, "tara", "check", { id: "x", grade: "vibes", exit: 0 }), SCHEMA).join(), /grade "vibes"/);
  assert.match(validateEvent({ seat: "tara", event: "claim", item: "i" }, SCHEMA).join(), /"t"/);
  assert.match(validateEvent(ev(1, "tara", "claim", { item: "i", t: "yesterday" }), SCHEMA).join(), /"t".*ISO/);
});

test("appendEvent validates, then appends one JSON line; readLog returns events in file order", () => {
  const { file } = logDir();
  appendEvent(file, ev(1, "tara", "claim", { item: "i1", station: "red" }), SCHEMA);
  appendEvent(file, ev(2, "tara", "return", { item: "i1", ok: true }), SCHEMA);
  assert.throws(() => appendEvent(file, ev(3, "tara", "dance"), SCHEMA), /event "dance"/);
  const log = readLog(file);
  assert.deepEqual(log.map((e) => e.event), ["claim", "return"]);
  assert.equal(readFileSync(file, "utf8").split("\n").filter(Boolean).length, 2, "the rejected event was not written");
});

test("readLog names the line of a malformed entry", () => {
  const { file } = logDir([ev(1, "tara", "claim", { item: "i" })]);
  writeFileSync(file, readFileSync(file, "utf8") + "{not json\n");
  assert.throws(() => readLog(file), /line 2/);
});

// --- the line ----------------------------------------------------------------
// team-layers.md § The line: stations in order per item; the station that reviews an item
// must not be held by the instance that coded it.

test("checkLog passes a clean run and reports zero violations", () => {
  const { file } = logDir(cleanItem("i1", 0));
  const r = checkLog(readLog(file), LINE, SCHEMA);
  assert.deepEqual(r.violations, []);
  assert.equal(r.items, 1);
});

test("checkLog reports the distinct-instance violation when the coder instance also holds the review station", () => {
  const { file } = logDir(cleanItem("i1", 0, { coder: "sato#1", reviewer: "sato#1" }));
  const r = checkLog(readLog(file), LINE, SCHEMA);
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /i1.*green.*review.*sato#1/);
});

test("checkLog reports an order violation when green is claimed before red for the same item", () => {
  const events = cleanItem("i1", 0);
  const red = events.find((e) => e.station === "red");
  const green = events.find((e) => e.station === "green");
  [red.t, green.t] = [green.t, red.t];
  events.sort((a, b) => a.t.localeCompare(b.t));
  const { file } = logDir(events);
  const r = checkLog(readLog(file), LINE, SCHEMA);
  assert.ok(r.violations.some((v) => /i1.*"green" before "red"/.test(v)), r.violations.join("; "));
});

test("checkLog reports invalid events in the log by line number before checking constraints", () => {
  const { file } = logDir([...cleanItem("i1", 0), { t: T(30), seat: "sato", event: "verdict", item: "i1", lens: "x", verdict: "maybe" }]);
  const r = checkLog(readLog(file), LINE, SCHEMA);
  assert.ok(r.violations.some((v) => /line 11.*verdict "maybe"/.test(v)));
});

// --- the disagreement rate ---------------------------------------------------
// The post's decay metric: disagreement rate, trending to zero. Direction from the spec:
// rate = items whose lens verdicts were NOT unanimous / items with two or more lens verdicts.
// A rate of 0 over enough items is the signal, so the tool must report the denominator.

test("disagreementRate counts items with split verdicts over items with two or more lens verdicts, most recent first", () => {
  const events = [...cleanItem("i1", 0), ...cleanItem("i2", 10, { unanimous: true }), ...cleanItem("i3", 20)];
  const { file } = logDir(events);
  const r = disagreementRate(readLog(file), { last: 10 });
  assert.deepEqual(r, { items: 3, split: 2, rate: 2 / 3, window: 10, enough: false });
  assert.deepEqual(disagreementRate(readLog(file), { last: 1 }), { items: 1, split: 1, rate: 1, window: 1, enough: true }, "the window takes the most recent items");
});

test("disagreementRate ignores items with a single lens verdict and reports null over no items", () => {
  const { file } = logDir([ev(1, "vik", "verdict", { item: "solo", lens: "simplicity", verdict: "accept" })]);
  assert.deepEqual(disagreementRate(readLog(file), { last: 10 }), { items: 0, split: 0, rate: null, window: 10, enough: false });
});

// The rate measures spread on real work; a planted fixture is excluded by name, and a rate over
// fewer items than the window is a sample, not a signal (first-runs report, finding 1).
test("disagreementRate excludes named items, so the planted fixture does not count as real work", () => {
  const events = [...cleanItem("i1", 0, { unanimous: true }), ...cleanItem("negative-control", 10)];
  const { file } = logDir(events);
  assert.deepEqual(disagreementRate(readLog(file), { last: 10, exclude: ["negative-control"] }), { items: 1, split: 0, rate: 0, window: 10, enough: false });
});

test("disagreementRate reports enough only when the window is full", () => {
  const events = Array.from({ length: 10 }, (_, i) => cleanItem(`i${i}`, i * 10, { unanimous: true })).flat();
  const { file } = logDir(events);
  const r = disagreementRate(readLog(file), { last: 10 });
  assert.equal(r.items, 10);
  assert.equal(r.enough, true);
  assert.equal(disagreementRate(readLog(file), { last: 11 }).enough, false);
});

test("CLI dissent exits 1 only when the window is full and every item was unanimous; a short sample says so and exits 0", () => {
  const short = logDir([...cleanItem("i1", 0, { unanimous: true }), ...cleanItem("i2", 10, { unanimous: true })]);
  assert.match(run(short.root, ["dissent", "--log", short.file, "--last", "10"]), /2 items[\s\S]*needs 10/);
  const full = logDir(Array.from({ length: 10 }, (_, i) => cleanItem(`i${i}`, i * 10, { unanimous: true })).flat());
  assert.throws(() => run(full.root, ["dissent", "--log", full.file, "--last", "10"]), (err) => err.status === 1 && /rate 0\.00/.test(String(err.stdout)) && /always agrees/.test(String(err.stdout)));
  const mixed = logDir([...Array.from({ length: 9 }, (_, i) => cleanItem(`i${i}`, i * 10, { unanimous: true })).flat(), ...cleanItem("i9", 90)]);
  assert.match(run(mixed.root, ["dissent", "--log", mixed.file, "--last", "10"]), /10 items, 1 non-unanimous, rate 0\.10/);
  const excluded = logDir([...Array.from({ length: 10 }, (_, i) => cleanItem(`i${i}`, i * 10, { unanimous: true })).flat(), ...cleanItem("negative-control", 100)]);
  assert.throws(() => run(excluded.root, ["dissent", "--log", excluded.file, "--last", "10", "--exclude", "negative-control"]), (err) => err.status === 1, "the fixture's split verdict does not rescue the rate");
});

// --- the renderer ------------------------------------------------------------
// team-layers.md § View: a renderer reads the log and the skin; the skin supplies class names
// for personas, formations, and persona-less role instances.

test("render draws one row per seat instance with its skin class, current item, station, and last event", () => {
  const { file } = logDir([...cleanItem("i1", 0), ev(40, "reviewer", "claim", { item: "i2", station: "review", instance: "reviewer#3" })]);
  const out = render(readLog(file), { skin: SKIN, as: "table" });
  assert.match(out, /tara#1 .*FIXTURE-CLASS-ARCHER.*i1.*return/);
  assert.match(out, /review-party#1 .*FIXTURE-CLASS-PARTY.*i1.*return/);
  assert.match(out, /reviewer#3 .*FIXTURE-CLASS-WARDEN.*i2.*review.*claim/, "a persona-less role instance takes the role's class");
  assert.match(out, /Fixture/);
});

test("render without a skin still draws every instance", () => {
  const { file } = logDir(cleanItem("i1", 0));
  const out = render(readLog(file), { as: "table" });
  assert.match(out, /sato#1/);
  assert.doesNotMatch(out, /FIXTURE-CLASS/);
});

// --- the CLI -----------------------------------------------------------------

const EXEC = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 };
const run = (cwd, args) => execFileSync(process.execPath, [SCRIPT, ...args], { cwd, ...EXEC });

test("CLI append writes a validated event; dissent prints the rate line; check prints the summary; render prints the table", () => {
  const { root, file } = logDir(cleanItem("i1", 0));
  run(root, ["append", "--log", file, "--event", JSON.stringify(ev(50, "vik", "claim", { item: "i9", station: "review", instance: "vik#1" }))]);
  assert.equal(readLog(file).length, 11);
  assert.match(run(root, ["dissent", "--log", file, "--last", "10"]), /^disagreement: 1 items, 1 non-unanimous, rate 1\.00 \(window 10\)/m);
  assert.match(run(root, ["check", "--log", file, "--line", "tdd"]), /^line tdd: 2 items, 0 violations/m);
  assert.match(run(root, ["render", "--log", file]), /vik#1/);
});

test("CLI exits 1 with the reason: invalid event, line violation, unknown line, missing log", () => {
  const { root, file } = logDir(cleanItem("i1", 0, { coder: "sato#1", reviewer: "sato#1" }));
  const fails = (args, re) => assert.throws(() => run(root, args), (err) => err.status === 1 && re.test(String(err.stderr) + String(err.stdout)), args.join(" "));
  fails(["append", "--log", file, "--event", JSON.stringify(ev(1, "tara", "dance"))], /event "dance"/);
  fails(["check", "--log", file, "--line", "tdd"], /1 violations[\s\S]*i1.*sato#1/);
  fails(["check", "--log", file, "--line", "nope"], /line "nope"/);
  fails(["dissent", "--log", join(root, "missing.jsonl")], /missing\.jsonl/);
});

test("the checked-in bindings point disagreement-rate and line-respected at this tool", () => {
  const checks = JSON.parse(readFileSync(join(REPO, "team/checks.json"), "utf8"));
  assert.match(checks["disagreement-rate"].run, /team-log\.mjs dissent/);
  assert.match(checks["line-respected"].run, /team-log\.mjs check .* --line tdd/);
  assert.equal(checks.log, ".summon/team-log.jsonl");
});

// --- the negative control -----------------------------------------------------
// ADR-0015 reversal trigger 1, as split after the first runs: on a planted-defect item, every
// named lens must return at least one finding in its latest round (presence). Verdict spread is
// not measured here; the dissent rate over real items measures it. A fixture built so that every
// lens catches something cannot also be the fixture that measures whether verdicts split.

import { negativeControl } from "./team-log.mjs";

const LENSES = ["simplicity", "security"];
const control = (n0, { findings = { simplicity: 1, security: 1 }, verdicts = { simplicity: "revise", security: "accept" } } = {}) => {
  const out = [];
  let n = n0;
  for (const lens of LENSES) {
    for (let i = 0; i < findings[lens]; i++) out.push(ev(n++, "review-party", "finding", { item: "negative-control", lens, severity: "important", summary: `planted ${lens} defect` }));
    out.push(ev(n++, "review-party", "verdict", { item: "negative-control", lens, verdict: verdicts[lens], findings: findings[lens] }));
  }
  return out;
};

test("negativeControl passes when every lens found something, and reports the verdicts as information", () => {
  const { file } = logDir(control(0));
  const r = negativeControl(readLog(file), { item: "negative-control", lenses: LENSES });
  assert.deepEqual(r, { ok: true, missing: [], silent: [], verdicts: { simplicity: "revise", security: "accept" } });
});

test("negativeControl fails when a lens returned no finding, naming the lens", () => {
  const { file } = logDir(control(0, { findings: { simplicity: 1, security: 0 } }));
  const r = negativeControl(readLog(file), { item: "negative-control", lenses: LENSES });
  assert.equal(r.ok, false);
  assert.deepEqual(r.silent, ["security"]);
});

test("negativeControl passes on unanimous verdicts when every lens found something: unanimity is not the control's claim", () => {
  const { file } = logDir(control(0, { verdicts: { simplicity: "veto", security: "veto" } }));
  const r = negativeControl(readLog(file), { item: "negative-control", lenses: LENSES });
  assert.equal(r.ok, true);
  assert.equal("unanimous" in r, false, "the result carries no unanimity flag to be misread as a failure");
});

test("negativeControl fails when a lens never returned a verdict, naming it as missing", () => {
  const { file } = logDir(control(0).filter((e) => !(e.event === "verdict" && e.lens === "security")));
  const r = negativeControl(readLog(file), { item: "negative-control", lenses: LENSES });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ["security"]);
});

test("negativeControl reads only the most recent review of the item", () => {
  // An earlier failed run (a silent lens), then a later passing one: the later one counts.
  const events = [...control(0, { findings: { simplicity: 1, security: 0 } }), ...control(20)];
  const { file } = logDir(events);
  assert.equal(negativeControl(readLog(file), { item: "negative-control", lenses: LENSES }).ok, true);
});

test("CLI control prints the verdict per lens and exits 1 on a silent lens, never on unanimity", () => {
  const { root, file } = logDir(control(0, { verdicts: { simplicity: "veto", security: "veto" } }));
  const out = run(root, ["control", "--log", file, "--item", "negative-control", "--lenses", LENSES.join(",")]);
  assert.match(out, /^negative control negative-control: ok \(2 lenses found something\)/m);
  assert.match(out, /simplicity: veto/);
  const { root: r2, file: f2 } = logDir(control(0, { findings: { simplicity: 1, security: 0 } }));
  assert.throws(() => run(r2, ["control", "--log", f2, "--item", "negative-control", "--lenses", LENSES.join(",")]), (err) => err.status === 1 && /no finding from security/.test(String(err.stdout)));
});

// --- the version flag --------------------------------------------------------
// Spec (work order first-run, fourth pass; team-layers.md § The version; ADR-0006 § Additional
// Decisions #6): every scaffolded project carries the one install manifest, .summon/manifest.json,
// { manifestVersion, summonVersion, targets, scaffolded, source }. `node scripts/team-log.mjs
// --version` prints summonVersion, bare, and exits 0: the scriptable form (`summon-team --version`
// is the human one). --root DIR reads DIR/.summon/manifest.json; no --root means the repo this
// script lives in, and this source repo records no installed version, so that run is a refusal.
// Nothing else is read: not team/version.json (the third pass's file, gone), not the root
// package.json, not packages/summon-team/package.json (a scaffolded project has none of them).
// Errors exit 1 naming .summon/manifest.json; when the file is there but the field is wrong, the
// field is named too; when the file is absent, the message says no installed version is recorded.
//
// Every run below sets cwd to a directory other than the root under test, so an implementation
// that resolves from process.cwd() fails at least one of them.

const MANIFEST = join(".summon", "manifest.json");

/** A well-formed manifest around one summonVersion; `rest` overrides or adds fields. */
const manifestOf = (summonVersion, rest = {}) => ({ manifestVersion: 1, summonVersion, targets: ["claude"], scaffolded: "2026-09-11T00:00:00.000Z", source: "local", ...rest });

/**
 * A fresh root. `manifest` goes to .summon/manifest.json: an object as JSON, a string verbatim,
 * undefined for no file (the .summon/ directory is still there, as in any project with a log).
 * Three decoys are always present, each carrying a version no test expects: team/version.json
 * (the third pass's file), a root package.json, and packages/summon-team/package.json (the first
 * two passes' files). A fallback to any of them prints a version and exits 0, which fails the
 * test that took it.
 */
function pkgRoot(manifest, decoy = "7.7.7-decoy") {
  const root = mkdtempSync(join(tmpdir(), "summon-pkg-"));
  roots.push(root);
  mkdirSync(join(root, ".summon"), { recursive: true });
  mkdirSync(join(root, "team"), { recursive: true });
  mkdirSync(join(root, "packages", "summon-team"), { recursive: true });
  if (manifest !== undefined) writeFileSync(join(root, MANIFEST), typeof manifest === "string" ? manifest : JSON.stringify(manifest));
  writeFileSync(join(root, "team", "version.json"), JSON.stringify({ "summon-team": decoy, scaffolded: null, source: null }));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture-root", version: decoy }));
  writeFileSync(join(root, "packages", "summon-team", "package.json"), JSON.stringify({ name: "summon-team", version: decoy }));
  return root;
}

// One decoy for the whole section (second review): its only job is to be a cwd that is not the
// root under test, carrying a version no test expects at every path an implementation might
// resolve from cwd, the manifest included. No run writes into it, so one is enough.
const DECOY = pkgRoot(manifestOf("9.9.9-decoy"), "9.9.9-decoy");

// The message names the file: a project has several files with a version in them and the user
// needs to know which one to open. For a bad field it names the field after the path, by its
// quoted key. For an absent file it says no installed version is recorded, in either order.
const NAMES_FILE = /\.summon[\/\\]manifest\.json/;
const NAMES_FILE_THEN_FIELD = /\.summon[\/\\]manifest\.json[\s\S]*"summonVersion"/;
const NO_INSTALLED_VERSION = /no installed version[\s\S]*\.summon[\/\\]manifest\.json|\.summon[\/\\]manifest\.json[\s\S]*no installed version/i;
const fails = (args, re) =>
  assert.throws(() => run(DECOY, args), (err) => err.status === 1 && re.test(String(err.stderr) + String(err.stdout)), `${args.join(" ")} should exit 1 matching ${re}`);

test("CLI --version with no --root, from a foreign cwd, refuses: this source repo records no installed version", () => {
  // The default root is the repo this script lives in. The Summon source repo is not a scaffolded
  // project and carries no manifest (team-layers.md § The version), so the honest answer is the
  // refusal, not a version. The cwd's own manifest says 9.9.9-decoy: an implementation that
  // resolves from cwd prints that and exits 0, which fails here.
  assert.equal(existsSync(join(REPO, MANIFEST)), false, "precondition: the source repo has no .summon/manifest.json");
  fails(["--version"], NO_INSTALLED_VERSION);
});

test("CLI --version --root DIR prints DIR/.summon/manifest.json's summonVersion as the only line of stdout and exits 0, not the cwd's", () => {
  const root = pkgRoot(manifestOf("1.2.3"));
  assert.equal(run(DECOY, ["--version", "--root", root]), "1.2.3\n");
});

test("CLI --version reads .summon/manifest.json and none of the three decoys, when all four carry different versions", () => {
  const root = pkgRoot(manifestOf("1.2.3"));
  writeFileSync(join(root, "team", "version.json"), JSON.stringify({ "summon-team": "4.4.4", scaffolded: null, source: null }));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "workspace-root", version: "5.5.5" }));
  writeFileSync(join(root, "packages", "summon-team", "package.json"), JSON.stringify({ name: "summon-team", version: "6.6.6" }));
  assert.equal(run(DECOY, ["--version", "--root", root]), "1.2.3\n");
});

test("CLI --version does not require --log, an event schema, a packages/ tree, a root package.json, or team/version.json", () => {
  // The scaffolded-project shape: .summon/manifest.json and nothing else a version could come from.
  const root = pkgRoot(manifestOf("0.0.1", { source: "github:summon-dev/summon" }));
  rmSync(join(root, "packages"), { recursive: true, force: true });
  rmSync(join(root, "package.json"), { force: true });
  rmSync(join(root, "team", "version.json"), { force: true });
  assert.equal(run(DECOY, ["--version", "--root", root]).trim(), "0.0.1");
});

test("CLI --version exits 1 naming .summon/manifest.json and the field when summonVersion is absent", () => {
  fails(["--version", "--root", pkgRoot({ manifestVersion: 1, targets: ["claude"], scaffolded: "2026-09-11T00:00:00.000Z", source: "local" })], NAMES_FILE_THEN_FIELD);
});

test("CLI --version exits 1 naming .summon/manifest.json and the field when summonVersion is empty", () => {
  fails(["--version", "--root", pkgRoot(manifestOf(""))], NAMES_FILE_THEN_FIELD);
});

test("CLI --version exits 1 naming .summon/manifest.json and the field when summonVersion is not a string", () => {
  fails(["--version", "--root", pkgRoot(manifestOf(3))], NAMES_FILE_THEN_FIELD);
  fails(["--version", "--root", pkgRoot(manifestOf(null))], NAMES_FILE_THEN_FIELD);
  fails(["--version", "--root", pkgRoot(manifestOf(["1.2.3"]))], NAMES_FILE_THEN_FIELD);
});

test("CLI --version exits 1 naming .summon/manifest.json and the field when the manifest is valid JSON but not an object", () => {
  // A non-object has no summonVersion to read: the field is what is missing, so it is named.
  fails(["--version", "--root", pkgRoot('"1.2.3"')], NAMES_FILE_THEN_FIELD);
  fails(["--version", "--root", pkgRoot("null")], NAMES_FILE_THEN_FIELD);
  fails(["--version", "--root", pkgRoot("[]")], NAMES_FILE_THEN_FIELD);
});

test("CLI --version exits 1 saying no installed version is recorded, naming .summon/manifest.json, when the file is missing and every decoy is present and versioned", () => {
  // pkgRoot writes team/version.json, a root package.json, and packages/summon-team/package.json
  // with 7.7.7-decoy: an implementation that falls back to any of them prints a version and
  // exits 0, which fails here. Both shapes of absence: .summon/ there without the file (a project
  // with a log), and no .summon/ at all.
  fails(["--version", "--root", pkgRoot(undefined)], NO_INSTALLED_VERSION);
  const bare = pkgRoot(undefined);
  rmSync(join(bare, ".summon"), { recursive: true, force: true });
  fails(["--version", "--root", bare], NO_INSTALLED_VERSION);
});

test("CLI --version exits 1 naming .summon/manifest.json when the file is malformed JSON", () => {
  fails(["--version", "--root", pkgRoot("{not json")], NAMES_FILE);
});

test("CLI usage line for an unknown command mentions --version", () => {
  fails(["bogus"], /usage[^\n]*--version/);
});

test("CLI still rejects an unknown leading flag with the usage line after --version is added", () => {
  fails(["--versionx"], /usage/);
});
