#!/usr/bin/env node
// agent-notes: { ctx: "prepare a review wave's arguments from the composed formation and a diff; ingest the wave's schema-validated result into the log", deps: [scripts/compose-team.mjs, scripts/team-log.mjs, team/workflows/review-wave.workflow.mjs, team/parties/summon-core.json, team/events.json], state: draft, last: "sato@2026-09-09", key: ["conditional lenses are chosen by changed paths against the party's globs, never by the model", "ingest validates every verdict and severity before writing; refuted findings are dropped and counted", "the workflow script cannot touch files, so this is the seam where the log is written from outside the model"] }
//
// The review station of the line, as two deterministic halves around one workflow run:
//
//   node scripts/review-wave.mjs prepare --party summon-core --formation review-party --item ID --diff FILE --out wave.json
//   (run team/workflows/review-wave.workflow.mjs with wave.json as args; it returns result JSON)
//   node scripts/review-wave.mjs ingest --result result.json [--instance review-party#1] [--at ISO]
//
// Exit 1 on an unresolved formation, an unreadable diff, or a result that fails the schema.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { compose, loadTeam } from "./compose-team.mjs";
import { appendEvent, loadSchema, validateEvent } from "./team-log.mjs";

// --- diff paths and globs -----------------------------------------------------

/** Paths on the +++ side of a unified diff; deletions (+++ /dev/null) are not changes to review. */
export function changedPaths(diff) {
  const out = [];
  for (const m of diff.matchAll(/^\+\+\+ (?:b\/)?(\S+)/gm)) if (m[1] !== "/dev/null") out.push(m[1]);
  return [...new Set(out)];
}

// One pass over the glob tokens: a chained replace would rewrite the `.*` that `**` emits.
const globToRe = (glob) =>
  new RegExp(
    "^" +
      glob
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*\/|\*\*|\*/g, (t) => (t === "**/" ? "(?:.*/)?" : t === "**" ? ".*" : "[^/]*")) +
      "$"
  );

/** Does a path match the include globs and none of the `!`-prefixed exclusions? */
export function matchesAny(path, globs) {
  const include = globs.filter((g) => !g.startsWith("!"));
  const exclude = globs.filter((g) => g.startsWith("!")).map((g) => g.slice(1));
  if (exclude.some((g) => globToRe(g).test(path))) return false;
  return include.some((g) => globToRe(g).test(path));
}

// --- prepare ------------------------------------------------------------------

function lensPrompt(role, lensText, persona) {
  const sec = (title, text) => (text ? `## ${title}\n\n${text}\n\n` : "");
  let out = `You are ${persona.display}, one lens of a review formation, holding the ${role.name} role. Read the change independently; other lenses read it too and are allowed to disagree with you.\n\n`;
  out += sec("Voice", persona.sections.get("Voice"));
  out += sec("Charter", role.sections.get("Charter")) + sec("Standard", role.sections.get("Standard")) + sec("Questions", role.sections.get("Questions"));
  out += `${lensText}\n\n`;
  for (const h of ["Priors", "Dissent", "Tells"]) out += sec(h, persona.sections.get(h));
  out += sec("Boundaries", role.sections.get("Boundaries")) + sec("Output", role.sections.get("Output"));
  return out.trimEnd() + "\n";
}

/** Build the workflow's args: one prompt per lens, floor plus the conditionals whose globs match the diff. */
export function prepare(root, { party: partyName, formation: formationName, item, diffPath }) {
  const team = loadTeam(root);
  const party = team.parties[partyName];
  if (!party) throw new Error(`party "${partyName}" has no file under team/parties/`);
  const f = (party.formations ?? []).find((x) => x.name === formationName);
  if (!f) throw new Error(`party "${partyName}" has no formation "${formationName}" (have: ${(party.formations ?? []).map((x) => x.name).join(", ") || "none"})`);
  compose(root, { party: partyName }); // validates every binding the same way the composer does
  const role = team.roles[f.role];
  const diffAbs = join(root, diffPath);
  if (!existsSync(diffAbs)) throw new Error(`diff ${diffPath} does not exist`);
  const diff = readFileSync(diffAbs, "utf8");
  const changed = changedPaths(diff);
  const seat = (m, conditional, because) => {
    const persona = team.personas[m.persona];
    return { lens: m.lens, persona: m.persona, display: persona.display, conditional, because, prompt: lensPrompt(role, role.lensText[m.lens], persona) };
  };
  const lenses = f.members.map((m) => seat(m, false, "floor"));
  const skipped = [];
  for (const c of f.conditional ?? []) {
    if (!c.paths) {
      skipped.push({ lens: c.lens, persona: c.persona ?? null, because: `no paths declared for "${c.when}"; undecidable without a model, so not applied` });
      continue;
    }
    const hits = changed.filter((p) => matchesAny(p, c.paths));
    if (!hits.length) {
      skipped.push({ lens: c.lens, persona: c.persona ?? null, because: `no changed path matches ${c.paths.join(", ")}` });
      continue;
    }
    if (!c.persona) {
      skipped.push({ lens: c.lens, persona: null, because: "conditional lens has no persona; the wave needs a seat to hold it" });
      continue;
    }
    lenses.push(seat({ persona: c.persona, lens: c.lens }, true, `changed: ${hits.join(", ")}`));
  }
  return { party: partyName, formation: formationName, item, diff, changed, lenses, skipped };
}

// --- ingest -------------------------------------------------------------------

/** Write a wave's result to the log as claim, findings, verdicts, return. Validates everything first. */
export function ingest(root, { result, station = "review", instance, at }) {
  const team = loadTeam(root);
  const logPath = team.checks?.log;
  if (!logPath) throw new Error("no log configured in team/checks.json; the wave's result has nowhere to go");
  const schema = loadSchema(root);
  const seat = instance.replace(/#\d+$/, "");
  const t = at ?? new Date().toISOString();
  const base = { t, seat, instance, item: result.item };
  const events = [{ ...base, event: "claim", station }];
  let kept = 0;
  let refuted = 0;
  const verdicts = {};
  for (const l of result.lenses ?? []) {
    const survivors = (l.findings ?? []).filter((x) => !x.refuted);
    refuted += (l.findings ?? []).length - survivors.length;
    for (const x of survivors) {
      kept++;
      events.push({ ...base, event: "finding", lens: l.lens, severity: x.severity, summary: x.summary, ...(x.file ? { file: x.file } : {}), ...(x.line !== undefined ? { line: x.line } : {}) });
    }
    events.push({ ...base, event: "verdict", lens: l.lens, verdict: l.verdict, findings: survivors.length });
    verdicts[l.lens] = l.verdict;
  }
  events.push({ ...base, event: "return", ok: true, summary: `${Object.entries(verdicts).map(([k, v]) => `${k} ${v}`).join(", ")}` });
  const problems = events.flatMap((e, i) => validateEvent(e, schema).map((p) => `event ${i + 1} (${e.event}${e.lens ? ` ${e.lens}` : ""}): ${p}`));
  if (problems.length) throw new Error(problems.join("; "));
  const abs = join(root, logPath);
  mkdirSync(dirname(abs), { recursive: true });
  for (const e of events) appendEvent(abs, e, schema);
  return { written: events.length, findings: kept, refuted, verdicts };
}

// --- CLI ---------------------------------------------------------------------

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = { cmd };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith("--")) throw new Error(`unknown argument ${a}`);
    const v = rest[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${a} requires a value`);
    opts[a.slice(2)] = v;
    i++;
  }
  if (!["prepare", "ingest"].includes(cmd)) throw new Error("usage: review-wave.mjs prepare|ingest ...");
  return opts;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  if (o.cmd === "prepare") {
    for (const k of ["party", "formation", "item", "diff"]) if (!o[k]) throw new Error(`--${k} is required`);
    const args = prepare(root, { party: o.party, formation: o.formation, item: o.item, diffPath: o.diff });
    const out = o.out ?? "wave.json";
    writeFileSync(join(root, out), JSON.stringify(args, null, 2));
    console.log(`prepared ${out} for item ${args.item}: ${args.changed.length} changed paths`);
    console.log(`lenses: ${args.lenses.map((l) => `${l.lens} (${l.persona}${l.conditional ? `, conditional: ${l.because.replace(/^changed: /, "")}` : ""})`).join(", ")}`);
    if (args.skipped.length) console.log(`skipped: ${args.skipped.map((s) => `${s.lens} (${s.persona ?? "no persona"}): ${s.because}`).join("; ")}`);
    console.log(`next: run team/workflows/review-wave.workflow.mjs with ${out} as args, then ingest the result`);
    return;
  }
  if (!o.result) throw new Error("--result is required");
  const result = JSON.parse(readFileSync(join(root, o.result), "utf8"));
  const r = ingest(root, { result, station: o.station ?? "review", instance: o.instance ?? "review-party#1", at: o.at });
  console.log(`wrote ${r.written} events for ${result.item}: ${r.findings} finding${r.findings === 1 ? "" : "s"} kept, ${r.refuted} refuted; ${Object.entries(r.verdicts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(`review-wave: ${err.message}`);
    process.exit(1);
  }
}
