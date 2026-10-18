#!/usr/bin/env node
// agent-notes: { ctx: "runs a seat's bound checks, binds each receipt to the tree state, writes check events to the log", deps: [scripts/compose-team.mjs, scripts/team-log.mjs, team/checks.json, team/events.json, docs/methodology/team-layers.md], state: draft, last: "sato@2026-09-10", key: ["treeState ignores .summon/: the record must not invalidate the receipts it stores", "deterministic checks only: an unbound check is reported as judged and never run", "receipt = last 40 lines of combined output, bound to {head, dirty} (ADR-0012 D8)", "exports runChecks + treeState behind an entry-point guard"] }
//
// The deterministic half of a seat's work, executed from outside the model. Each
// bound check in team/checks.json runs through the shell; its exit code and the tail
// of its output become a `check` event bound to the tree state the check ran against,
// so a receipt is invalidated the moment the head moves or the tree is dirty.
//
//   node scripts/run-checks.mjs --party summon-core --seat sato [--item ID] [--at ISO]
//
// Exit 0 = every bound check passed. Exit 1 = a bound check failed, or the seat is unknown.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { compose, loadTeam } from "./compose-team.mjs";
import { appendEvent, loadSchema } from "./team-log.mjs";

const TAIL_LINES = 40;
const TIMEOUT_MS = 10 * 60 * 1000;

// Raw stdout: porcelain status lines start with a space for an unstaged change, and a trim would eat it.
const git = (root, args) => {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return r.status === 0 ? r.stdout : null;
};

// The log's own footprint. The log is the team's own record, tracked under .summon/, and every
// event appended to it would otherwise dirty the tree and invalidate the receipts it stores; so
// a path under .summon/ (the log, the plan, the worktrees) never counts toward dirty.
const RECORD = ".summon/";
const outsideRecord = (line) => line.slice(3).split(" -> ").some((path) => !path.startsWith(RECORD));

/** The tree a receipt binds to: the commit it ran against, and whether anything outside .summon/ was uncommitted. */
export function treeState(root) {
  const head = git(root, ["rev-parse", "HEAD"])?.trim() ?? null;
  const status = git(root, ["status", "--porcelain"]);
  return { head, dirty: status === null ? null : status.split("\n").filter(Boolean).some(outsideRecord) };
}

function runCommand(root, cmd) {
  const r = spawnSync(cmd, { cwd: root, shell: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: TIMEOUT_MS });
  const combined = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const lines = combined.split("\n").filter((l, i, a) => l.length || i < a.length - 1);
  const tail = lines.slice(-TAIL_LINES);
  const receipt = (lines.length > TAIL_LINES ? `[truncated to last ${TAIL_LINES} of ${lines.length} lines]\n` : "") + tail.join("\n");
  const exit = r.status === null ? (r.error ? 124 : 1) : r.status;
  return { exit, receipt };
}

function seatsOf(party) {
  return [...(party.members ?? []).map((m) => m.as ?? m.persona), ...(party.formations ?? []).map((f) => f.name)];
}

/**
 * Run every bound check for one seat of one party. Returns { results, tree, ok }.
 * Writes one `check` event per bound check to the configured log, if any.
 */
export function runChecks(root, { party: partyName, seat, item, at }) {
  const team = loadTeam(root);
  const party = team.parties[partyName];
  if (!party) throw new Error(`party "${partyName}" has no file under team/parties/`);
  const seats = seatsOf(party);
  if (!seats.includes(seat)) throw new Error(`seat "${seat}" is not composed by party "${partyName}" (have: ${seats.join(", ")})`);
  const rows = compose(root, { party: partyName }).checks.filter((c) => c.member === seat);
  const tree = treeState(root);
  const t = at ?? new Date().toISOString();
  const results = rows.map((c) => {
    if (!c.run) return { id: c.id, claim: c.claim, grade: "inferential", exit: null, receipt: null, tree };
    const { exit, receipt } = runCommand(root, c.run);
    return { id: c.id, claim: c.claim, grade: "deterministic", run: c.run, exit, receipt, tree };
  });
  const logPath = team.checks?.log;
  if (logPath) {
    const abs = join(root, logPath);
    mkdirSync(dirname(abs), { recursive: true });
    const schema = loadSchema(root);
    for (const r of results) {
      if (r.grade !== "deterministic") continue;
      appendEvent(abs, { t, seat, event: "check", id: r.id, grade: r.grade, exit: r.exit, receipt: r.receipt, tree, ...(item ? { item } : {}) }, schema);
    }
  }
  return { results, tree, ok: results.every((r) => r.grade !== "deterministic" || r.exit === 0) };
}

// --- CLI ---------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!["--party", "--seat", "--item", "--at"].includes(a)) throw new Error(`unknown argument ${a}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${a} requires a value`);
    opts[a.slice(2)] = v;
    i++;
  }
  if (!opts.party) throw new Error("--party is required");
  if (!opts.seat) throw new Error("--seat is required");
  return opts;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const { results, tree, ok } = runChecks(process.cwd(), o);
  console.log(`seat ${o.seat} @ head ${tree.head ? tree.head.slice(0, 7) : "none"} (${tree.dirty ? "dirty" : "clean"})${o.item ? ` item ${o.item}` : ""}`);
  const width = Math.max(4, ...results.map((r) => r.id.length));
  for (const r of results) {
    const status = r.grade === "inferential" ? "judged" : r.exit === 0 ? "pass" : `FAIL (exit ${r.exit})`;
    console.log(`  ${r.id.padEnd(width)}  ${r.grade.padEnd(13)}  ${status}`);
  }
  const det = results.filter((r) => r.grade === "deterministic");
  const pass = det.filter((r) => r.exit === 0).length;
  console.log(`${det.length} deterministic (${pass} pass, ${det.length - pass} fail), ${results.length - det.length} inferential (judged)`);
  if (!ok) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(`run-checks: ${err.message}`);
    process.exit(1);
  }
}
