#!/usr/bin/env node
// agent-notes: { ctx: "turns a work order into a plan; writes spawn and claim events from outside the model", deps: [scripts/compose-team.mjs, scripts/team-log.mjs, scripts/run-checks.mjs, team/events.json, docs/methodology/team-layers.md], state: draft, last: "claude@2026-09-10", key: ["the plan is the assignment and carries the line's constraints: instances are named and bound to stations at plan time, and claim reads one file", "one round-robin counter per seat across every station of every item; a draw that lands two distinct-instance stations on one instance is refused, never re-dealt", "seat names, instance counts, and item ids are validated at plan time because they reach a worktree path and a shell line", "open validates everything (head, plan shape, worktree paths, existing worktrees, events) before its first side effect, and is idempotent on the same head", "a return releases the station its instance last claimed on that item, only with ok true; a claim alone releases nothing"] }
//
// Dispatch is where scale lives (team-layers.md § The work order). The party says who may
// hold a seat; the order says how many instances run against which items on which line.
//
//   node scripts/dispatch.mjs plan  --order FILE --out FILE
//   node scripts/dispatch.mjs open  --plan FILE --at ISO
//   node scripts/dispatch.mjs claim --plan FILE --item ID --station NAME --at ISO
//
// Exit 1 on a malformed order, a party that cannot run the line, a limit exceeded, a plan
// that does not match the tree, or a claim the line's constraints refuse. Nothing is written
// on a refusal. Whether an instance gets a worktree is the adapter's dispatch.isolation
// (worktree | none), not a switch.
//
// claim is read-decide-append with no lock: two claims on one item started in the same instant
// can both pass. The line workflow runs an item's stations sequentially, so they never are.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { compose, loadTeam } from "./compose-team.mjs";
import { treeState } from "./run-checks.mjs";
import { appendEvent, instanceOf, loadLine, loadSchema, readJson, readLog, validateEvent } from "./team-log.mjs";

const WORKTREES = ".summon/worktrees";
const ISOLATION = ["worktree", "none"];
// A seat name becomes a worktree path; an item id reaches a shell line in the workflow prompt.
const SEAT = /^[A-Za-z0-9_-]+$/;
const ITEM = /^[A-Za-z0-9._-]+$/;
const INSTANCE = /^[A-Za-z0-9_-]+#[1-9]\d*$/;

// --- the order ---------------------------------------------------------------

/** Read a work order and check it against team/events.json workOrder. Names the offending field. */
export function loadOrder(path, schema = loadSchema()) {
  const order = readJson(path);
  const spec = schema.workOrder;
  for (const k of spec.required) if (order[k] === undefined) throw new Error(`order ${path}: "${k}" is required`);
  if (!Array.isArray(order.items)) throw new Error(`order ${path}: "items" must be an array`);
  order.items.forEach((item, i) => {
    for (const k of spec.item.required) if (item?.[k] === undefined) throw new Error(`order ${path}: item ${i}: "${k}" is required`);
    if (typeof item.id !== "string" || !ITEM.test(item.id)) throw new Error(`order ${path}: item ${i}: id ${JSON.stringify(item.id)} must match ${ITEM}`);
  });
  if (typeof order.instances !== "object" || order.instances === null || Array.isArray(order.instances)) throw new Error(`order ${path}: "instances" must be an object of seat: count`);
  for (const [seat, n] of Object.entries(order.instances)) {
    if (!Number.isInteger(n) || n < 1) throw new Error(`order ${path}: instances.${seat} must be a positive integer, got ${JSON.stringify(n)}`);
  }
  return order;
}

// --- plan: the assignment ----------------------------------------------------

/** Name every instance a station needs: seat#1..seat#n, in the order the line first uses each seat. */
function nameInstances(seats, order, isolation) {
  const out = [];
  for (const seat of seats) {
    const n = order.instances[seat] ?? 1;
    for (let i = 1; i <= n; i++) {
      const instance = `${seat}#${i}`;
      out.push({ seat, instance, worktree: isolation === "worktree" ? `${WORKTREES}/${instance}` : null });
    }
  }
  return out;
}

/** One round-robin counter per seat across every station of every item; a draw that collides on a distinct-instance pair is refused. */
function assign(line, order, instances) {
  const pool = new Map(); // seat -> [instance names]
  for (const i of instances) pool.set(i.seat, [...(pool.get(i.seat) ?? []), i.instance]);
  const next = new Map(); // seat -> index of the instance that takes the next draw
  const draw = (seat) => {
    const names = pool.get(seat);
    const k = next.get(seat) ?? 0;
    next.set(seat, (k + 1) % names.length);
    return names[k];
  };
  const distinct = (line.constraints ?? []).filter((c) => c.rule === "distinct-instance");
  return order.items.map((item) => {
    const stations = line.stations.map((st) => ({ station: st.name, seat: st.seat, instance: draw(st.seat), needs: st.needs ?? [], emits: st.emits }));
    for (const c of distinct) {
      const [a, b] = c.stations.map((name) => stations.find((s) => s.station === name));
      if (a.instance === b.instance) {
        throw new Error(`order "${order.id}": item "${item.id}": distinct-instance separates stations "${a.station}" and "${b.station}", but the draw lands both on "${a.instance}"; give seat "${a.seat}" more instances`);
      }
    }
    return { ...item, stations };
  });
}

/** Load the order, refuse what the party or adapter cannot run, and bind every station of every item to a named instance. */
export function plan(root, { orderPath }) {
  const schema = loadSchema(root);
  const order = loadOrder(resolve(root, orderPath), schema);
  const team = loadTeam(root);
  const party = team.parties[order.party];
  if (!party) throw new Error(`order "${order.id}": party "${order.party}" has no file under team/parties/`);
  if (!(party.lines ?? []).includes(order.line)) {
    throw new Error(`order "${order.id}": party "${order.party}" does not opt into line "${order.line}" (lines: ${(party.lines ?? []).join(", ") || "none"})`);
  }
  const line = loadLine(order.line, root);
  const seats = [...new Set((line.stations ?? []).map((s) => s.seat))];
  for (const seat of seats) if (typeof seat !== "string" || !SEAT.test(seat)) throw new Error(`line "${line.name}": seat ${JSON.stringify(seat)} must match ${SEAT}; it becomes a worktree path`);
  compose(root, { party: order.party }); // every binding, station seat, and constraint checked the way the composer checks it
  const harness = team.harnesses[party.harness];
  if (!harness) throw new Error(`party "${order.party}": harness "${party.harness}" has no adapter under team/harness/`);
  if (!harness.dispatch) throw new Error(`harness "${harness.name}" has dispatch: null; a harness with no spawner cannot dispatch`);
  const { concurrency, depth, isolation } = harness.dispatch;
  if (!ISOLATION.includes(isolation)) throw new Error(`harness "${harness.name}": dispatch.isolation ${JSON.stringify(isolation)} is not one of ${ISOLATION.join(", ")}`);

  for (const seat of Object.keys(order.instances)) {
    if (!seats.includes(seat)) throw new Error(`order "${order.id}": instances names "${seat}", which line "${line.name}" has no station for (seats: ${seats.join(", ")})`);
  }
  for (const c of line.constraints ?? []) {
    if (c.rule !== "distinct-instance") continue;
    const [a, b] = c.stations.map((name) => line.stations.find((s) => s.name === name));
    if (a.seat === b.seat && (order.instances[a.seat] ?? 1) < 2) {
      throw new Error(`line "${line.name}": constraint "distinct-instance" separates stations "${a.name}" and "${b.name}", both on seat "${a.seat}", which order "${order.id}" gives only ${order.instances[a.seat] ?? 1} instance; it needs at least 2`);
    }
  }
  const total = seats.reduce((n, seat) => n + (order.instances[seat] ?? 1), 0);
  if (total > concurrency) {
    throw new Error(`order "${order.id}" needs ${total} instances, over the "${harness.name}" adapter's dispatch.concurrency of ${concurrency}`);
  }
  const instances = nameInstances(seats, order, isolation);
  return {
    order: order.id,
    party: order.party,
    line: order.line,
    harness: harness.name,
    limits: { concurrency, depth, isolation },
    constraints: line.constraints ?? [],
    instances,
    items: assign(line, order, instances),
  };
}

// --- open: spawn events and worktrees ----------------------------------------

function logPathOf(root) {
  const logPath = loadTeam(root).checks?.log;
  if (!logPath) throw new Error("no log configured in team/checks.json; a spawn nobody can see is not a dispatch");
  return join(root, logPath);
}

/** True when the worktree exists and is a git worktree at head; false when nothing is there; a refusal for anything else. */
function worktreeExistsAt(root, worktree, head) {
  const abs = join(root, worktree);
  if (!existsSync(abs)) return false;
  // A plain directory inside the repo would answer rev-parse with the main head, so the top level must be the path itself.
  const top = spawnSync("git", ["-C", abs, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const topPath = top.status === 0 ? realpathSync(top.stdout.trim()) : null;
  if (topPath !== realpathSync(abs)) throw new Error(`worktree ${worktree} exists but is not a git worktree of its own (top level: ${topPath ?? "none"}); remove the directory, or git worktree prune and open again`);
  const r = spawnSync("git", ["-C", abs, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const at = r.status === 0 ? r.stdout.trim() : null;
  if (at !== head) throw new Error(`worktree ${worktree} is at ${at ?? "no git head"}, not the head ${head} this spawn binds to; git worktree remove it, or open a plan against its head`);
  return true;
}

function addWorktree(root, worktree) {
  const abs = join(root, worktree);
  const r = spawnSync("git", ["worktree", "add", "--detach", abs], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) throw new Error(`git worktree add ${worktree}: ${(r.stderr || r.stdout || "").trim() || `exit ${r.status}`}`);
}

/**
 * Write one spawn event per planned instance not already spawned for this order at this head, and
 * create its worktree when isolation asks for one. Every refusal comes before the first side effect.
 */
export function open(root, { planPath, at }) {
  const p = readJson(resolve(root, planPath));
  const logFile = logPathOf(root);
  const schema = loadSchema(root);
  const tree = treeState(root);
  if (!tree.head) throw new Error(`${root} is not a git repository; a spawn binds to a head, and there is none`);
  const isolated = p.limits?.isolation === "worktree";
  for (const i of p.instances ?? []) {
    if (!INSTANCE.test(i.instance)) throw new Error(`plan ${planPath}: instance ${JSON.stringify(i.instance)} is not a seat#n name`);
    const expected = isolated ? `${WORKTREES}/${i.instance}` : null;
    if (i.worktree !== expected) throw new Error(`plan ${planPath}: instance "${i.instance}" has worktree ${JSON.stringify(i.worktree)}, not ${JSON.stringify(expected)}; the path follows from the instance and is not the plan's to choose`);
  }
  const log = existsSync(logFile) ? readLog(logFile) : [];
  const spawned = new Set(log.filter((e) => e.event === "spawn" && e.order === p.order && e.tree?.head === tree.head).map(instanceOf));
  const events = p.instances.filter((i) => !spawned.has(i.instance)).map((i) => ({ t: at, seat: i.seat, instance: i.instance, event: "spawn", order: p.order, harness: p.harness, tree, worktree: i.worktree }));
  const problems = events.flatMap((e) => validateEvent(e, schema).map((x) => `spawn ${e.instance}: ${x}`));
  if (problems.length) throw new Error(problems.join("; "));
  const missing = isolated ? p.instances.filter((i) => !worktreeExistsAt(root, i.worktree, tree.head)) : [];
  // Worktrees before events: a failed add leaves nothing in the log, and a rerun adds only what is missing.
  for (const i of missing) addWorktree(root, i.worktree);
  mkdirSync(dirname(logFile), { recursive: true });
  for (const e of events) appendEvent(logFile, e, schema);
  return events;
}

// --- claim: the separation-of-duties boundary --------------------------------

/** The stations of one item that have returned: a return with ok true releases whatever its instance last claimed there. */
function returnedStations(log, item) {
  const holding = new Map(); // instance -> station
  const returned = new Set();
  for (const e of log) {
    if (e.item !== item) continue;
    if (e.event === "claim" && e.station) holding.set(instanceOf(e), e.station);
    if (e.event === "return" && e.ok === true && holding.has(instanceOf(e))) returned.add(holding.get(instanceOf(e)));
  }
  return returned;
}

/** Write the claim for the instance the plan assigned, unless the log shows the plan's constraints would be broken. */
export function claim(root, { planPath, item, station, at }) {
  const p = readJson(resolve(root, planPath));
  const row = p.items.find((i) => i.id === item);
  if (!row) throw new Error(`item "${item}" is not in plan ${planPath} (items: ${p.items.map((i) => i.id).join(", ")})`);
  const st = row.stations.find((s) => s.station === station);
  if (!st) throw new Error(`item "${item}" has no station "${station}" in plan ${planPath} (stations: ${row.stations.map((s) => s.station).join(", ")})`);
  const logFile = logPathOf(root);
  const schema = loadSchema(root);
  const log = existsSync(logFile) ? readLog(logFile) : [];
  if (!Array.isArray(p.constraints)) throw new Error(`plan ${planPath} carries no constraints; it is stale (written before the plan carried the line), run plan again`);
  const constraints = p.constraints;

  const returned = returnedStations(log, item);
  for (const c of constraints) {
    if (c.rule !== "order" || !c.stations.includes(station)) continue;
    const owed = c.stations.slice(0, c.stations.indexOf(station)).find((s) => !returned.has(s));
    if (owed) throw new Error(`item "${item}": cannot claim "${station}" until "${owed}" has returned (line "${p.line}" order: ${c.stations.join(" → ")})`);
  }
  for (const c of constraints) {
    if (c.rule !== "distinct-instance" || !c.stations.includes(station)) continue;
    const other = c.stations.find((s) => s !== station);
    const held = log.some((e) => e.event === "claim" && e.item === item && e.station === other && instanceOf(e) === st.instance);
    if (held) throw new Error(`item "${item}": instance "${st.instance}" already claimed "${other}", and distinct-instance keeps "${other}" and "${station}" on different instances`);
  }

  const e = { t: at, seat: st.seat, instance: st.instance, event: "claim", item, station, order: p.order };
  mkdirSync(dirname(logFile), { recursive: true });
  appendEvent(logFile, e, schema);
  return e;
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
  if (!["plan", "open", "claim"].includes(cmd)) throw new Error("usage: dispatch.mjs plan|open|claim ...");
  const required = { plan: ["order", "out"], open: ["plan"], claim: ["plan", "item", "station"] }[cmd];
  for (const k of required) if (!opts[k]) throw new Error(`--${k} is required`);
  return opts;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const at = o.at ?? new Date().toISOString();
  if (o.cmd === "plan") {
    const p = plan(root, { orderPath: o.order });
    writeFileSync(resolve(root, o.out), JSON.stringify(p, null, 2));
    console.log(`planned ${p.order}: ${p.instances.length} instances, ${p.items.length} items → ${o.out}`);
    return;
  }
  if (o.cmd === "open") {
    const events = open(root, { planPath: o.plan, at });
    if (!events.length) {
      console.log(`${o.plan}: already open at this head, nothing written`);
      return;
    }
    console.log(`opened ${events[0].order}: ${events.length} spawn events${events.some((e) => e.worktree) ? `, worktrees under ${WORKTREES}` : ""}`);
    return;
  }
  const e = claim(root, { planPath: o.plan, item: o.item, station: o.station, at });
  console.log(`claimed ${e.station} on ${e.item} for ${e.instance}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(`dispatch: ${err.message}`);
    process.exit(1);
  }
}
