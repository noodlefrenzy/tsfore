#!/usr/bin/env node
// agent-notes: { ctx: "harvest summon: debt markers into a ledger", deps: [docs/methodology/debt-markers.md], state: active, last: "vik@2026-06-15" }
//
// Lists every `summon:` debt marker in the tree (see
// docs/methodology/debt-markers.md). Run during Vik's sprint-boundary debt
// pass; material findings graduate into docs/tech-debt.md (Done Gate item 12).
//
//   node scripts/harvest-debt.mjs            # human-readable ledger
//   node scripts/harvest-debt.mjs --json     # machine-readable

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".astro",
]);
// summon: extension allowlist, widen if the team adds new source languages
const CODE_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|rb|php|svelte|vue|css|scss|sh|bash|toml|yaml|yml)$/;

// "summon:" then the body up to end of line. Tolerates any comment leader.
const MARKER = /summon:\s*(.+?)\s*$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (CODE_EXT.test(name)) yield full;
  }
}

const findings = [];
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    // Skip the convention's own definition file and this harvester.
    const m = line.match(MARKER);
    if (m) findings.push({ file: relative(ROOT, file), line: i + 1, note: m[1] });
  });
}

// Drop self-references: this script and the spec doc both contain "summon:".
const real = findings.filter(
  (f) =>
    !f.file.endsWith("scripts/harvest-debt.mjs") &&
    !f.file.endsWith("docs/methodology/debt-markers.md")
);

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(real, null, 2) + "\n");
} else if (real.length === 0) {
  console.log("No summon: debt markers found. Clean ledger.");
} else {
  console.log(`# Debt ledger — ${real.length} marker(s)\n`);
  console.log("| Location | Deferred work |");
  console.log("|----------|---------------|");
  for (const f of real) {
    console.log(`| \`${f.file}:${f.line}\` | ${f.note.replace(/\|/g, "\\|")} |`);
  }
}
