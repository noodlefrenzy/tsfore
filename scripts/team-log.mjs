#!/usr/bin/env node
// agent-notes: { ctx: "team event log: validate and append events, check a line's constraints over the log, compute the disagreement rate, render a table", deps: [team/events.json, team/lines/tdd.json, team/checks.json, docs/methodology/team-layers.md], state: draft, last: "sato@2026-09-11", key: ["zero dependencies; schema is data in team/events.json", "readJson and instanceOf are exported for dispatch.mjs, the third caller of each", "negative control: latest round per lens must carry a finding; verdict spread is the dissent rate's claim over a full window of real items", "disagreement rate = items with split lens verdicts / items with 2+ lens verdicts, most recent first", "line constraints (order, distinct-instance) are checked over claim events per item", "exports behind an entry-point guard for the tests", "--version prints summonVersion of <root>/.summon/manifest.json, bare, and reads nothing else (ADR-0006 #6): not team/version.json, not a package.json; an absent manifest says no installed version is recorded and names the file, a bad field names the file then its quoted key; no validation beyond the one field read"] }
//
// The event log is the runtime record every view renders from and every runtime
// check reads. One JSON object per line; see docs/methodology/team-layers.md § The event log.
//
//   node scripts/team-log.mjs append  --log FILE --event '{"t":...,"seat":...,"event":...}'
//   node scripts/team-log.mjs check   --log FILE --line NAME        exit 1 on any violation
//   node scripts/team-log.mjs dissent --log FILE [--last N] [--exclude a,b]   the disagreement rate; exit 1 on a full window with none split
//   node scripts/team-log.mjs render  --log FILE [--skin NAME] [--as table|tmux]
//   node scripts/team-log.mjs control --log FILE --item ID --lenses a,b,c   exit 1 unless every lens found something
//   node scripts/team-log.mjs --version [--root DIR]                        print summonVersion of .summon/manifest.json, bare
//
// --version is the scriptable form (a bare version, nothing else on stdout); `summon-team --version` is the human one.
// Schema, lines, skins, and .summon/manifest.json resolve from the repo this script lives in (or --root DIR).
// The Summon source repo is not a scaffolded project and carries no manifest: --version there is a refusal.

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_ROOT = resolve(import.meta.dirname, "..");
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (err) {
    throw new Error(`${p}: ${err.message}`);
  }
};
export const loadSchema = (root = DEFAULT_ROOT) => readJson(join(root, "team", "events.json"));
export function loadLine(name, root = DEFAULT_ROOT) {
  const p = join(root, "team", "lines", `${name}.json`);
  if (!existsSync(p)) throw new Error(`line "${name}" has no file at ${p}`);
  return readJson(p);
}
export function loadSkin(name, root = DEFAULT_ROOT) {
  const p = join(root, "team", "views", name, "party.json");
  if (!existsSync(p)) throw new Error(`skin "${name}" has no party.json at ${p}`);
  return readJson(p);
}
export function loadVersion(root = DEFAULT_ROOT) {
  const p = join(root, ".summon", "manifest.json");
  if (!existsSync(p)) throw new Error(`no installed version is recorded: ${p} does not exist`);
  const manifest = readJson(p);
  const version = manifest !== null && typeof manifest === "object" && !Array.isArray(manifest) ? manifest.summonVersion : undefined;
  if (typeof version !== "string" || version === "") throw new Error(`${p}: "summonVersion" must be a non-empty string, got ${JSON.stringify(version)}`);
  return version;
}

// --- events ------------------------------------------------------------------

/** Problems with one event against the schema. Empty means valid. */
export function validateEvent(e, schema) {
  const problems = [];
  if (typeof e !== "object" || e === null) return ["event is not an object"];
  for (const k of schema.common) if (e[k] === undefined) problems.push(`"${k}" is required on every event`);
  if (e.t !== undefined && (typeof e.t !== "string" || !ISO.test(e.t))) problems.push(`"t" must be an ISO 8601 timestamp, got ${JSON.stringify(e.t)}`);
  const spec = schema.events[e.event];
  if (e.event !== undefined && !spec) {
    problems.push(`event "${e.event}" is not one of ${Object.keys(schema.events).join(", ")}`);
    return problems;
  }
  if (spec) for (const k of spec.required) if (e[k] === undefined) problems.push(`"${k}" is required for event "${e.event}"`);
  if (e.verdict !== undefined && !schema.verdicts.includes(e.verdict)) problems.push(`verdict "${e.verdict}" is not one of ${schema.verdicts.join(", ")}`);
  if (e.severity !== undefined && !schema.severities.includes(e.severity)) problems.push(`severity "${e.severity}" is not one of ${schema.severities.join(", ")}`);
  if (e.grade !== undefined && !schema.grades.includes(e.grade)) problems.push(`grade "${e.grade}" is not one of ${schema.grades.join(", ")}`);
  return problems;
}

/** Read a JSONL log. A malformed line is named by number. A missing file is an error, not an empty log. */
export function readLog(file) {
  if (!existsSync(file)) throw new Error(`${file}: no such log`);
  const lines = readFileSync(file, "utf8").split("\n");
  const out = [];
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    try {
      out.push(JSON.parse(line));
    } catch (err) {
      throw new Error(`${file} line ${i + 1}: ${err.message}`);
    }
  });
  return out;
}

export function appendEvent(file, e, schema) {
  const problems = validateEvent(e, schema);
  if (problems.length) throw new Error(problems.join("; "));
  appendFileSync(file, JSON.stringify(e) + "\n");
}

export const instanceOf = (e) => e.instance ?? e.seat;
const byTime = (a, b) => String(a.t).localeCompare(String(b.t));

// --- the line ----------------------------------------------------------------

/** Check a line's constraints over the log. Returns { items, violations }. */
export function checkLog(log, line, schema) {
  const violations = [];
  log.forEach((e, i) => {
    for (const p of validateEvent(e, schema)) violations.push(`line ${i + 1}: ${p}`);
  });
  const claims = new Map(); // item -> [{station, instance, t}]
  for (const e of [...log].sort(byTime)) {
    if (e.event !== "claim" || !e.station) continue;
    if (!claims.has(e.item)) claims.set(e.item, []);
    claims.get(e.item).push({ station: e.station, instance: instanceOf(e), t: e.t });
  }
  for (const [item, seq] of claims) {
    for (const c of line.constraints ?? []) {
      if (c.rule === "order") {
        const first = (s) => seq.findIndex((x) => x.station === s);
        for (let i = 1; i < c.stations.length; i++) {
          const a = first(c.stations[i - 1]);
          const b = first(c.stations[i]);
          if (a !== -1 && b !== -1 && b < a) violations.push(`item "${item}": "${c.stations[i]}" before "${c.stations[i - 1]}"`);
        }
      } else if (c.rule === "distinct-instance") {
        const holders = (s) => new Set(seq.filter((x) => x.station === s).map((x) => x.instance));
        const [a, b] = c.stations;
        for (const inst of holders(a)) {
          if (holders(b).has(inst)) violations.push(`item "${item}": stations ${a} and ${b} held by the same instance ${inst}`);
        }
      } else {
        violations.push(`line "${line.name}": unknown constraint rule "${c.rule}"`);
      }
    }
  }
  return { items: claims.size, violations };
}

// --- the disagreement rate ---------------------------------------------------
// The post's decay metric. rate = items whose lens verdicts were not unanimous, over items
// that received two or more lens verdicts, taking the `last` most recently judged items.

export function disagreementRate(log, { last = 10, exclude = [] } = {}) {
  const byItem = new Map(); // item -> { lenses: Map(lens -> verdict), t }
  for (const e of [...log].sort(byTime)) {
    if (e.event !== "verdict" || exclude.includes(e.item)) continue;
    if (!byItem.has(e.item)) byItem.set(e.item, { lenses: new Map(), t: e.t });
    const it = byItem.get(e.item);
    it.lenses.set(e.lens, e.verdict);
    it.t = e.t;
  }
  const judged = [...byItem.values()].filter((it) => it.lenses.size >= 2).sort((a, b) => b.t.localeCompare(a.t)).slice(0, last);
  const split = judged.filter((it) => new Set(it.lenses.values()).size > 1).length;
  // A rate over fewer items than the window is a sample, not a signal; the caller decides on `enough`.
  return { items: judged.length, split, rate: judged.length ? split / judged.length : null, window: last, enough: judged.length >= last };
}

// --- the negative control -----------------------------------------------------
// ADR-0015 reversal trigger 1's instrument. On the planted-defect item, every named lens
// must have returned at least one finding in its latest review round, and the latest
// verdicts must not be unanimous. A pass says the formation still argues.

export function negativeControl(log, { item, lenses }) {
  const events = [...log].filter((e) => e.item === item).sort(byTime);
  const verdicts = {};
  const silent = [];
  const missing = [];
  for (const lens of lenses) {
    const vs = events.filter((e) => e.event === "verdict" && e.lens === lens);
    if (!vs.length) {
      missing.push(lens);
      continue;
    }
    const last = vs[vs.length - 1];
    const prev = vs.length > 1 ? vs[vs.length - 2].t : "";
    verdicts[lens] = last.verdict;
    const found = events.filter((e) => e.event === "finding" && e.lens === lens && e.t > prev && e.t <= last.t).length;
    if (found === 0) silent.push(lens);
  }
  // Presence only: every lens filed something on its planted defect. Verdicts are reported, not judged;
  // a fixture built to be caught by every lens cannot also measure whether verdicts split (that is the dissent rate's claim).
  return { ok: missing.length === 0 && silent.length === 0, missing, silent, verdicts };
}

// --- the renderer ------------------------------------------------------------
// The dullest view: one row per seat instance. A skin supplies class names; a persona-less
// role instance takes the role's class. Anything fancier reads the same rows.

export function render(log, { skin = null, as = "table" } = {}) {
  const rows = new Map(); // instance -> { seat, item, station, last, t }
  for (const e of [...log].sort(byTime)) {
    const key = instanceOf(e);
    const row = rows.get(key) ?? { instance: key, seat: e.seat, item: "", station: "", last: "", t: "" };
    if (e.event === "claim") {
      row.item = e.item ?? row.item;
      row.station = e.station ?? row.station;
    } else if (e.item) row.item = e.item;
    row.last = e.event;
    row.t = e.t;
    rows.set(key, row);
  }
  const classOf = (seat) => skin?.members?.[seat]?.class ?? skin?.formations?.[seat]?.class ?? skin?.roles?.[seat]?.class ?? "";
  const list = [...rows.values()];
  const cols = ["instance", "class", "item", "station", "last", "t"];
  const data = list.map((r) => [r.instance, classOf(r.seat), r.item, r.station, r.last, r.t]);
  if (as === "tmux") {
    return `${skin?.title ?? "team"}\n` + data.map((d) => `┌ ${d[0]} ${d[1] ? `(${d[1]})` : ""}\n│ ${d[2] || "idle"} ${d[3] ? `@ ${d[3]}` : ""}\n└ ${d[4]} ${d[5]}`).join("\n");
  }
  const width = cols.map((c, i) => Math.max(c.length, ...data.map((d) => String(d[i]).length)));
  const fmt = (d) => d.map((v, i) => String(v).padEnd(width[i])).join("  ").trimEnd();
  return [skin?.title ?? "team", fmt(cols), fmt(width.map((w) => "-".repeat(w))), ...data.map(fmt)].join("\n") + "\n";
}

// --- CLI ---------------------------------------------------------------------

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = { cmd, last: 10, as: "table", root: DEFAULT_ROOT };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith("--")) throw new Error(`unknown argument ${a}`);
    const v = rest[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${a} requires a value`);
    opts[a.slice(2)] = v;
    i++;
  }
  if (cmd === "--version") return opts;
  if (!["append", "check", "dissent", "render", "control"].includes(cmd)) throw new Error(`usage: team-log.mjs append|check|dissent|render|control --log FILE [...] | --version [--root DIR]`);
  if (!opts.log) throw new Error("--log is required");
  return opts;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.cmd === "--version") {
    console.log(loadVersion(o.root));
    return;
  }
  const schema = loadSchema(o.root);
  if (o.cmd === "append") {
    if (!o.event) throw new Error("--event is required");
    let e;
    try {
      e = JSON.parse(o.event);
    } catch (err) {
      throw new Error(`--event is not JSON: ${err.message}`);
    }
    appendEvent(o.log, e, schema);
    console.log(`appended ${e.event} for ${instanceOf(e)} → ${o.log}`);
    return;
  }
  const log = readLog(o.log);
  if (o.cmd === "check") {
    if (!o.line) throw new Error("--line is required");
    const r = checkLog(log, loadLine(o.line, o.root), schema);
    console.log(`line ${o.line}: ${r.items} items, ${r.violations.length} violations`);
    for (const v of r.violations) console.log(`  - ${v}`);
    if (r.violations.length) process.exit(1);
    return;
  }
  if (o.cmd === "dissent") {
    const exclude = (o.exclude ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const r = disagreementRate(log, { last: Number(o.last), exclude });
    console.log(`disagreement: ${r.items} items, ${r.split} non-unanimous, rate ${r.rate === null ? "n/a" : r.rate.toFixed(2)} (window ${r.window}${exclude.length ? `, excluding ${exclude.join(", ")}` : ""})`);
    if (!r.enough) {
      console.log(`${r.items} items judged; the rate needs ${r.window} to mean anything`);
      return;
    }
    if (r.rate === 0) {
      console.log("every judged item in a full window was unanimous; a reviewer that always agrees carries no information");
      process.exit(1);
    }
    return;
  }
  if (o.cmd === "control") {
    if (!o.item || !o.lenses) throw new Error("--item and --lenses (comma-separated) are required");
    const lenses = o.lenses.split(",").map((x) => x.trim()).filter(Boolean);
    const r = negativeControl(log, { item: o.item, lenses });
    if (r.ok) {
      console.log(`negative control ${o.item}: ok (${lenses.length} lenses found something)`);
      for (const [lens, v] of Object.entries(r.verdicts)) console.log(`  ${lens}: ${v}`);
      return;
    }
    const why = [r.missing.length ? `no verdict from ${r.missing.join(", ")}` : "", r.silent.length ? `no finding from ${r.silent.join(", ")}` : ""].filter(Boolean).join("; ");
    console.log(`negative control ${o.item}: FAILED (${why})`);
    for (const [lens, v] of Object.entries(r.verdicts)) console.log(`  ${lens}: ${v}`);
    process.exit(1);
  }
  if (o.cmd === "render") {
    process.stdout.write(render(log, { skin: o.skin ? loadSkin(o.skin, o.root) : null, as: o.as }));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(`team-log: ${err.message}`);
    process.exit(1);
  }
}
