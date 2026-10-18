#!/usr/bin/env node
// agent-notes: { ctx: "CLI-level tests for the static CSS checker — the region the Critical bug lived in", deps: [scripts/check-css-contrast-motion.mjs, docs/adrs/0013-design-authority.md], state: active, last: "claude@2026-08-06", key: ["C1 regression: the script must run when its own path contains a space", "asserts ADR-0013 §6's advisory constraint: exit 0 without --strict even with findings", "spawns the real script rather than importing it, because the entry-point guard is what broke"] }
//
//   node --test scripts/check-css-contrast-motion.cli.test.mjs
//
// The unit tests exercised the pure functions and found nothing wrong with them.
// The Critical defect was in the six characters of the entry-point guard, which
// no unit test could reach. These spawn the script the way a user does.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(import.meta.dirname, "check-css-contrast-motion.mjs");

const DEFECTIVE = `<article class="card"><p class="t">x</p></article>
<style>.card { background: #0f172a; } .card .t { color: #1e293b; }</style>`;

/** Run the script, returning { status, stdout }. Never throws on exit 1. */
function run(args, scriptPath = SCRIPT) {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" });
    return { status: 0, stdout };
  } catch (err) {
    return { status: err.status, stdout: String(err.stdout ?? "") };
  }
}

function fixture(dirName = "plain") {
  const dir = mkdtempSync(join(tmpdir(), "css-check-"));
  const sub = join(dir, dirName);
  mkdirSync(sub, { recursive: true });
  const file = join(sub, "bad.astro");
  writeFileSync(file, DEFECTIVE);
  return { dir: sub, file };
}

test("CLI: reports a real defect", () => {
  const { file } = fixture();
  const { stdout } = run([file]);
  assert.match(stdout, /1\.22:1 < 4\.5:1/);
  assert.match(stdout, /1 finding/);
});

test("C1: runs when its OWN path contains a space", () => {
  // The original guard compared import.meta.url (percent-encoded) against
  // argv[1] (raw), so a space made main() silently never run: exit 0, no output.
  const { dir, file } = fixture();
  const spaced = join(dir, "dir with space");
  mkdirSync(spaced, { recursive: true });
  const relocated = join(spaced, "check-css-contrast-motion.mjs");
  copyFileSync(SCRIPT, relocated);
  const { stdout } = run([file], relocated);
  assert.match(stdout, /1 finding/, "a space in the script path must not silence the script");
});

test("C1b: runs when its own path contains non-ASCII characters", () => {
  const { dir, file } = fixture();
  const odd = join(dir, "dossiér");
  mkdirSync(odd, { recursive: true });
  const relocated = join(odd, "check-css-contrast-motion.mjs");
  copyFileSync(SCRIPT, relocated);
  assert.match(run([file], relocated).stdout, /1 finding/);
});

test("ADR-0013 §6: advisory — exit 0 even with findings", () => {
  const { file } = fixture();
  assert.equal(run([file]).status, 0, "slice A may not fail a build by default");
});

test("--strict opts in to a non-zero exit", () => {
  const { file } = fixture();
  assert.equal(run(["--strict", file]).status, 1);
});

test("--strict still exits 0 when there are no findings", () => {
  const { dir } = fixture();
  const clean = join(dir, "clean.css");
  writeFileSync(clean, `.a { background: #000000; } .a { color: #ffffff; }`);
  assert.equal(run(["--strict", clean]).status, 0);
});

test("no arguments prints usage and exits 2 rather than reporting a false all-clear", () => {
  const { status, stdout } = run([]);
  assert.equal(status, 2);
  assert.doesNotMatch(stdout, /0 finding/, "an empty invocation must not read as a pass");
});

test("a glob that matched nothing does not print a reassuring all-clear", () => {
  // An unexpanded glob arrives as a literal path that does not exist.
  const { stdout, status } = run(["site/**/*.css"]);
  assert.equal(status, 2, "unreadable inputs must not be summarised as 0 findings");
  assert.doesNotMatch(stdout, /^css contrast\+motion: 0 finding/m);
});

test("an unreadable file is surfaced, not swallowed", () => {
  const { stdout } = run([join(tmpdir(), "definitely-missing-9d2f.css")]);
  assert.match(stdout + "", /no readable/i);
});
