#!/usr/bin/env node
// agent-notes: { ctx: "composes team/ layers (role, persona, view, harness) into harness output per a party", deps: [docs/methodology/team-layers.md, team/README.md, team/checks.json, team/lines/tdd.json, team/parties/summon-core.json, team/harness/claude-code.json], state: draft, last: "claude@2026-09-09", key: ["zero dependencies; flat-scalar frontmatter parser only", "view content is never written into an agent file", "enforcement level per must-not: tool when every mapped tool is withheld, else prose; unmapped is prose", "checks: role claims joined to team/checks.json commands; unbound checks fall back to judgment", "Dissent must be additive: a bullet mostly contained in a lens or role sentence is refused", "lines named by the party are validated against its seats; a configured log adds a Log section to every agent"] }
//
// Reads a party under team/parties/, resolves each member's role, lens, and
// persona, and emits the harness adapter's artefacts plus roster.md (from the
// view) and enforcement.md (tool vs prose per boundary; bound vs judged per check).
//
//   node scripts/compose-team.mjs --party summon-core [--harness NAME] [--view NAME] [--out DIR]
//
// Exit 0 = composed. Exit 1 = a layer is malformed or a binding does not resolve.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Capabilities are verbs about the work. Tool names live only in harness adapters.
export const CAPABILITIES = ["read", "run", "write:src", "write:tests", "write:docs", "write:infra", "web", "notebook"];

export const ROLE_SECTIONS = ["Charter", "Standard", "Questions", "Boundaries", "Output"];
export const PERSONA_SECTIONS = ["Priors", "Dissent", "Voice", "Tells"];

// Body order for a composed agent. Documented in docs/methodology/team-layers.md § Composition.
const ROLE_HEAD = ["Charter", "Standard"];
const ROLE_MID = ["Questions"];
const ROLE_TAIL = ["Boundaries", "Output"];
const PERSONA_ORDER = ["Priors", "Dissent", "Tells"];

const DEFAULT_KEYS = { tools: "tools", disallowed: "disallowedTools", budget: "maxTurns" };

// summon: composed files carry no agent-notes block and are not listed in personas.md, so
// check-canon checks #1 and #2 will fail the day build/ is copied over .claude/agents/.
// Cutover (ADR-0015 sequencing step 4) teaches check-canon the composed shape first.

// --- parsing -----------------------------------------------------------------

const read = (p) => readFileSync(p, "utf8");
function readJson(p) {
  try {
    return JSON.parse(read(p));
  } catch (err) {
    throw new Error(`${p}: ${err.message}`);
  }
}
const listDirs = (dir) =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
const listFiles = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)) : []);

/** Flat `key: value` frontmatter. Enough for role and persona files; nesting is a defect here. */
export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return { data, body: text.slice(m[0].length) };
}

/** Split a Markdown body into its level-2 sections. Text before the first `## ` is dropped. */
export function sections(body) {
  const out = new Map();
  for (const part of body.split(/^## /m).slice(1)) {
    const nl = part.indexOf("\n");
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
    out.set(heading, nl === -1 ? "" : part.slice(nl + 1).trim());
  }
  return out;
}

const stripComments = (text) => text.replace(/<!--[\s\S]*?-->\n?/g, "").trim();

function requireSections(secs, names, where) {
  const missing = names.filter((n) => !(secs.get(n) ?? "").trim());
  if (missing.length) throw new Error(`${where}: missing or empty section(s): ${missing.map((m) => `## ${m}`).join(", ")}`);
}

// --- the additive rule -------------------------------------------------------
// A Dissent bullet that mostly restates a sentence already in the bound lens or role adds
// context cost and no friction. Content-word containment is crude on purpose: it catches
// the paste-the-lens-in-first-person case and nothing subtler.

const words = (s) => new Set(s.toLowerCase().replace(/[`*_"'()[\]]/g, "").match(/[a-z][a-z-]{3,}/g) ?? []);
const sentencesOf = (text) => text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.replace(/^[-*\d.\s]+/, "").trim()).filter((s) => s.length > 20);

export function findRestatements(dissent, sources) {
  const pool = sources.flatMap(sentencesOf).map((s) => ({ s, w: words(s) }));
  const out = [];
  for (const bullet of sentencesOf(dissent)) {
    const bw = words(bullet);
    if (bw.size < 5) continue;
    for (const { s, w } of pool) {
      let hit = 0;
      for (const x of bw) if (w.has(x)) hit++;
      if (hit / bw.size >= 0.7) {
        out.push({ bullet, source: s });
        break;
      }
    }
  }
  return out;
}

// --- loading -----------------------------------------------------------------

function loadRole(dir, name) {
  const skillPath = join(dir, "SKILL.md");
  const metaPath = join(dir, "role.json");
  if (!existsSync(skillPath)) throw new Error(`role "${name}": missing ${skillPath}`);
  if (!existsSync(metaPath)) throw new Error(`role "${name}": missing ${metaPath}`);
  const skill = read(skillPath);
  const meta = readJson(metaPath);
  for (const key of ["may", "must-not"]) {
    for (const cap of meta[key] ?? []) {
      if (!CAPABILITIES.includes(cap)) {
        throw new Error(`role "${name}": capability "${cap}" in ${key} is not a work verb (expected one of ${CAPABILITIES.join(", ")}); tool names belong in a harness adapter`);
      }
    }
  }
  const { data, body } = parseFrontmatter(skill);
  const secs = sections(stripComments(body));
  requireSections(secs, ROLE_SECTIONS, `role "${name}" (${skillPath})`);
  const lensText = {};
  for (const lens of meta.lenses ?? []) {
    const p = join(dir, "lenses", `${lens}.md`);
    if (!existsSync(p)) throw new Error(`role "${name}": declares lens "${lens}" but ${p} is missing`);
    lensText[lens] = stripComments(read(p));
  }
  const checks = meta.checks ?? [];
  for (const c of checks) {
    if (!c.id || !c.claim) throw new Error(`role "${name}": every check needs an id and a claim (${metaPath})`);
    if (c.lens && !(meta.lenses ?? []).includes(c.lens)) throw new Error(`role "${name}": check "${c.id}" names lens "${c.lens}", which the role does not declare`);
  }
  return {
    name,
    skill,
    description: data.description ?? "",
    sections: secs,
    may: meta.may ?? [],
    mustNot: meta["must-not"] ?? [],
    lenses: meta.lenses ?? [],
    lensText,
    checks,
  };
}

function loadPersona(path, name) {
  const { data, body } = parseFrontmatter(read(path));
  const secs = sections(stripComments(body));
  requireSections(secs, PERSONA_SECTIONS, `persona "${name}" (${path})`);
  const raw = data.holds ?? (data.lens ? `${data.role}/${data.lens}` : data.role ?? "");
  const holds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [role, lens] = s.split("/");
      return { role, lens: lens ?? null };
    });
  if (!holds.length) throw new Error(`persona "${name}" (${path}): frontmatter must name a role (\`role:\` or \`holds:\`)`);
  return { name, holds, display: data.display || name, sections: secs };
}

function loadHarness(path, name) {
  const h = readJson(path);
  if (typeof h.fitted !== "boolean") {
    throw new Error(`harness "${name}" (${path}): must declare "fitted": true or false; the adapter is the only layer allowed to be fitted, and it has to say so`);
  }
  if (!h.output?.dir || !h.output?.file) throw new Error(`harness "${name}" (${path}): output.dir and output.file are required`);
  return {
    name,
    ...h,
    capabilities: h.capabilities ?? {},
    frontmatter: h.frontmatter ?? {},
    budget: h.budget ?? {},
    keys: { ...DEFAULT_KEYS, ...(h.keys ?? {}) },
  };
}

/** Read every layer under <root>/team. Validation errors name the file and the rule. */
export function loadTeam(root) {
  const base = join(root, "team");
  const roles = {};
  for (const name of listDirs(join(base, "roles"))) roles[name] = loadRole(join(base, "roles", name), name);
  const personas = {};
  for (const f of listFiles(join(base, "personas"), ".md")) {
    const name = f.replace(/\.md$/, "");
    personas[name] = loadPersona(join(base, "personas", f), name);
  }
  const views = {};
  for (const name of listDirs(join(base, "views"))) {
    const p = join(base, "views", name, "party.json");
    if (existsSync(p)) views[name] = readJson(p);
  }
  const harnesses = {};
  for (const f of listFiles(join(base, "harness"), ".json")) {
    const name = f.replace(/\.json$/, "");
    harnesses[name] = loadHarness(join(base, "harness", f), name);
  }
  const parties = {};
  for (const f of listFiles(join(base, "parties"), ".json")) parties[f.replace(/\.json$/, "")] = readJson(join(base, "parties", f));
  const checksPath = join(base, "checks.json");
  const checks = existsSync(checksPath) ? readJson(checksPath) : {};
  delete checks.$comment;
  const lines = {};
  for (const f of listFiles(join(base, "lines"), ".json")) lines[f.replace(/\.json$/, "")] = readJson(join(base, "lines", f));
  return { roles, personas, views, harnesses, parties, checks, lines };
}

// --- composition -------------------------------------------------------------

const uniq = (arr) => [...new Set(arr)];
const toolsFor = (harness, caps) => uniq(caps.flatMap((c) => harness.capabilities[c] ?? []));
const holdName = (h) => (h.lens ? `${h.role}/${h.lens}` : h.role);

function resolveSeat(team, m, where) {
  if (typeof m !== "object" || m === null) throw new Error(`${where}: members must be objects like { "persona": "vik", "lens": "simplicity" }, got ${JSON.stringify(m)}`);
  const role = team.roles[m.role];
  if (!role) throw new Error(`${where}: role "${m.role}" has no directory under team/roles/`);
  const lens = m.lens ?? null;
  if (lens && !role.lenses.includes(lens)) {
    throw new Error(`${where}: lens "${lens}" is not declared by role "${role.name}" (declared: ${role.lenses.join(", ") || "none"})`);
  }
  const lensText = lens ? role.lensText[lens] : null;
  if (!m.persona) return { role, lens, lensText, persona: null };
  const persona = team.personas[m.persona];
  if (!persona) throw new Error(`${where}: persona "${m.persona}" has no file under team/personas/`);
  if (!persona.holds.some((h) => h.role === m.role && (h.lens === null || h.lens === lens))) {
    throw new Error(`${where}: persona "${m.persona}" holds ${persona.holds.map(holdName).join(", ")} but the party assigns role "${m.role}"${lens ? ` on lens "${lens}"` : ""}`);
  }
  const restated = findRestatements(persona.sections.get("Dissent"), [
    ...ROLE_SECTIONS.map((s) => role.sections.get(s) ?? ""),
    lensText ?? "",
  ]);
  if (restated.length) {
    throw new Error(`${where}: persona "${m.persona}": Dissent restates the ${lens ? `${lens} lens` : `${role.name} role`} ("${restated[0].bullet}" ~ "${restated[0].source}"); Dissent holds only what the role and lens do not already say`);
  }
  return { role, lens, lensText, persona };
}

/** tool: every tool the boundary maps to is withheld. prose: the role needs a tool the boundary shares, or the adapter maps nothing. */
function enforcementRows(harness, member, role, allowed) {
  return role.mustNot.map((boundary) => {
    const mapped = harness.capabilities[boundary] ?? [];
    const level = mapped.length > 0 && mapped.every((t) => !allowed.includes(t)) ? "tool" : "prose";
    return { member, role: role.name, boundary, level };
  });
}

/** Join a role's check claims to the project's command bindings. */
function checkRows(team, member, role, lens) {
  return role.checks
    .filter((c) => !c.lens || c.lens === lens)
    .map((c) => {
      const b = team.checks[c.id];
      if (b?.run && role.mustNot.includes("run")) {
        throw new Error(`check "${c.id}" is bound to a command but role "${role.name}" must not run; bind it on a seat that may run, or leave it unbound so ${member} judges it`);
      }
      return { member, role: role.name, id: c.id, claim: c.claim, lens: c.lens ?? null, run: b?.run ?? null, receipt: b?.receipt ?? null, grade: b?.run ? "deterministic" : "inferential" };
    });
}

function frontmatter(harness, role, name, description, tools, disallowed) {
  const k = harness.keys;
  const lines = [
    "# composed by scripts/compose-team.mjs from team/ — do not edit; edit the layer and recompose",
    `name: ${name}`,
    `description: ${JSON.stringify(description)}`,
  ];
  if (tools.length) lines.push(`${k.tools}: ${tools.join(", ")}`);
  if (disallowed.length) lines.push(`${k.disallowed}: ${disallowed.join(", ")}`);
  for (const [key, v] of Object.entries(harness.frontmatter)) lines.push(`${key}: ${v}`);
  const budget = harness.budget[role.name] ?? harness.budget.default;
  if (budget !== undefined) lines.push(`${k.budget}: ${budget}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

const section = (title, text) => (text ? `## ${title}\n\n${text}\n\n` : "");

function checksSection(rows) {
  if (!rows.length) return "";
  let out = "## Checks\n\nRun these before judging anything. Each decides a claim by computation; report its result as deterministic evidence with the receipt pasted, not as an opinion. A check with no command bound in this project is judged instead, and the report grades that claim inferential.\n\n";
  for (const r of rows) {
    out += r.run ? `- **${r.claim}** Run \`${r.run}\`; receipt: ${r.receipt}.\n` : `- **${r.claim}** No command bound in this project; judge it and grade the claim inferential.\n`;
  }
  return out + "\n";
}

function logSection(log, seat) {
  if (!log) return "";
  return `## Log\n\nThis project keeps a team event log at \`${log}\`. Append events as you work, with \`node scripts/team-log.mjs append --log ${log} --event '<json>'\`: a \`claim\` (item, and station when working a line) when you take an item; a \`verdict\` per lens (accept, revise, or veto) when you finish a review; a \`return\` (ok true or false, and the item) when you finish; only ok true from the instance that claimed a station releases it on a line. Your seat is \`${seat}\`; carry an \`instance\` id such as \`${seat}#1\`. The log is what the disagreement rate and the line checks read; an event you do not write is work nobody can see.\n\n`;
}

function personaSections(persona) {
  let out = "";
  for (const h of PERSONA_ORDER) out += section(h, persona.sections.get(h));
  return out;
}

function agentBody(seat, checks, log) {
  const { role, lens, lensText, persona } = seat;
  let out = `You are ${persona.display}, holding the ${role.name} role${lens ? ` on the ${lens} lens` : ""}.\n\n`;
  out += section("Voice", persona.sections.get("Voice"));
  for (const h of ROLE_HEAD) out += section(h, role.sections.get(h));
  out += checksSection(checks);
  out += logSection(log, seat.as);
  for (const h of ROLE_MID) out += section(h, role.sections.get(h));
  if (lensText) out += `${lensText}\n\n`;
  out += personaSections(persona);
  for (const h of ROLE_TAIL) out += section(h, role.sections.get(h));
  return out.trimEnd() + "\n";
}

function formationBody(name, role, floor, conditional, checks, log) {
  let out = `You are ${name}, a formation of ${floor.length} lenses on the ${role.name} role${conditional.length ? `, plus ${conditional.length} conditional` : ""}. Each lens reads the same change independently and is allowed to disagree with the others; report where they do.\n\n`;
  for (const h of ROLE_HEAD) out += section(h, role.sections.get(h));
  out += checksSection(checks);
  out += logSection(log, name);
  for (const h of ROLE_MID) out += section(h, role.sections.get(h));
  for (const seat of floor) {
    out += `# ${seat.persona ? seat.persona.display : `Lens: ${seat.lens}`}\n\n`;
    if (seat.lensText) out += `${seat.lensText}\n\n`;
    if (seat.persona) out += section("Voice", seat.persona.sections.get("Voice")) + personaSections(seat.persona);
  }
  if (conditional.length) {
    out += "# Conditional lenses\n\nApply each of these only when its condition holds for the change under review; say which ones you applied and which you did not, and why.\n\n";
    for (const seat of conditional) {
      out += `## When ${seat.when}${seat.paths ? ` (decided by changed paths: ${seat.paths.join(", ")})` : ""}\n\n`;
      if (seat.lensText) out += `${seat.lensText.replace(/^## /m, "### ")}\n\n`;
      if (seat.persona) out += personaSections(seat.persona).replace(/^## /gm, "### ");
    }
  }
  for (const h of ROLE_TAIL) out += section(h, role.sections.get(h));
  return out.trimEnd() + "\n";
}

function renderRoster(view, party, seats, formations, lines = []) {
  const v = view ?? { title: party.name, members: {}, formations: {} };
  let out = `# ${v.title ?? party.name}\n\n`;
  out += `Party \`${party.name}\`, skin \`${v.skin ?? "none"}\`. Rendered from the view; nothing here reaches a prompt.\n\n`;
  out += "| Name | Class | Holds | Epithet | Blurb |\n|---|---|---|---|---|\n";
  for (const { role, persona, lens } of seats) {
    const m = v.members?.[persona.name] ?? {};
    out += `| ${persona.display} | ${m.class ?? ""} | ${lens ? `${role.name} / ${lens}` : role.name} | ${m.epithet ?? ""} | ${m.blurb ?? ""} |\n`;
  }
  if (formations.length) {
    out += "\n## Formations\n\n| Name | Class | Floor | Conditional | Blurb |\n|---|---|---|---|---|\n";
    for (const f of formations) {
      const m = v.formations?.[f.name] ?? {};
      const names = (list) => list.map((s) => (s.persona ? s.persona.display : s.lens)).join(", ");
      out += `| ${f.name} | ${m.class ?? ""} | ${names(f.floor)} | ${names(f.conditional) || "none"} | ${m.blurb ?? ""} |\n`;
    }
  }
  if (lines.length) {
    out += "\n## Lines\n\n| Line | Stations | Constraints |\n|---|---|---|\n";
    for (const l of lines) {
      const stations = (l.stations ?? []).map((s) => `${s.name}: ${s.seat}`).join(" → ");
      const constraints = (l.constraints ?? []).map((c) => `${c.rule}(${c.stations.join(", ")})`).join("; ");
      out += `| ${l.name} | ${stations} | ${constraints} |\n`;
    }
  }
  return out;
}

function renderEnforcement(harness, rows, checks) {
  const tool = rows.filter((r) => r.level === "tool").length;
  const bound = checks.filter((c) => c.run).length;
  let out = `# Enforcement on \`${harness.name}\`\n\n`;
  out += `Adapter fitted: ${harness.fitted}. ${rows.length} boundaries: ${tool} enforced at the tool layer, ${rows.length - tool} by prose only. ${checks.length} checks: ${bound} bound to a command (deterministic), ${checks.length - bound} judged (inferential).\n\n`;
  out += "## Boundaries\n\nA boundary is **tool** when every tool it maps to is withheld from the agent. It is **prose** when the role needs a tool the boundary shares, or the adapter maps it to nothing; the agent can read the rule but nothing stops it. A third level, **hook**, is reserved for a boundary enforced by a hook composed from the adapter's `paths`; the composer cannot probe whether one is installed, so `doctor` owns that column.\n\n";
  out += "| Member | Role | Must not | Level |\n|---|---|---|---|\n";
  for (const r of rows) out += `| ${r.member} | ${r.role} | ${r.boundary} | ${r.level} |\n`;
  out += "\n## Checks\n\nA check is **deterministic** when this project binds a command to it in `team/checks.json`; the agent runs the command and pastes the receipt. It is **inferential** when no command is bound; the agent judges the claim and the report grades it as such.\n\n";
  out += "| Member | Role | Check | Grade | Command |\n|---|---|---|---|---|\n";
  for (const c of checks) out += `| ${c.member} | ${c.role} | ${c.id} | ${c.grade} | ${c.run ? `\`${c.run}\`` : ""} |\n`;
  return out;
}

/**
 * Compose a party. Returns { files: [{ path, content }], enforcement: rows, checks: rows }.
 * Paths are relative to the output directory.
 */
export function compose(root, { party: partyName, harness: harnessName, view: viewName } = {}) {
  const team = loadTeam(root);
  const party = team.parties[partyName];
  if (!party) throw new Error(`party "${partyName}" has no file under team/parties/`);
  const harness = team.harnesses[harnessName ?? party.harness];
  if (!harness) throw new Error(`party "${partyName}": harness "${harnessName ?? party.harness}" has no adapter under team/harness/`);
  const viewKey = viewName ?? party.view ?? null;
  const view = viewKey ? team.views[viewKey] : null;
  if (viewKey && !view) throw new Error(`party "${partyName}": view "${viewKey}" has no party.json under team/views/`);

  const seats = (party.members ?? []).map((m, i) => {
    const where = `party "${partyName}" member ${i}`;
    if (!m?.persona) throw new Error(`${where}: a party member needs a persona`);
    return { ...resolveSeat(team, m, where), as: m.as ?? m.persona };
  });
  const formations = (party.formations ?? []).map((f, i) => {
    const where = `party "${partyName}" formation "${f.name ?? i}"`;
    if (!f.name) throw new Error(`${where}: a formation needs a name`);
    const role = team.roles[f.role];
    if (!role) throw new Error(`${where}: role "${f.role}" has no directory under team/roles/`);
    if (!(f.members ?? []).length) throw new Error(`${where}: a formation needs at least one floor member`);
    const seatOf = (m) => {
      if (typeof m !== "object" || m === null) throw new Error(`${where}: members must be objects like { "persona": "vik", "lens": "simplicity" }, got ${JSON.stringify(m)}`);
      if (!m.persona && !m.lens) throw new Error(`${where}: a formation member needs a persona, a lens, or both`);
      return resolveSeat(team, { role: f.role, persona: m.persona, lens: m.lens }, where);
    };
    const floor = f.members.map(seatOf);
    const conditional = (f.conditional ?? []).map((m) => {
      if (!m?.when) throw new Error(`${where}: a conditional lens needs a "when" trigger`);
      return { ...seatOf(m), when: m.when, paths: m.paths ?? null };
    });
    return { name: f.name, role, floor, conditional };
  });

  const seatNames = new Set([...seats.map((s) => s.as), ...formations.map((f) => f.name)]);
  const lines = (party.lines ?? []).map((name) => {
    const line = team.lines[name];
    if (!line) throw new Error(`party "${partyName}": line "${name}" has no file under team/lines/`);
    for (const st of line.stations ?? []) {
      if (!seatNames.has(st.seat)) throw new Error(`party "${partyName}": line "${name}" station "${st.name}" names seat "${st.seat}", which the party does not compose (have: ${[...seatNames].join(", ")})`);
    }
    for (const c of line.constraints ?? []) {
      for (const st of c.stations ?? []) if (!(line.stations ?? []).some((x) => x.name === st)) throw new Error(`line "${name}": constraint "${c.rule}" names station "${st}", which the line does not define`);
    }
    return line;
  });

  const files = [];
  const rows = [];
  const checks = [];
  const outPath = (vars) => join(harness.output.dir, harness.output.file.replace(/\{(\w+)\}/g, (_, k) => vars[k]));
  const emit = (path, content) => {
    if (files.some((f) => f.path === path)) throw new Error(`party "${partyName}": two members compose to the same file "${path}"; give one an "as" name`);
    files.push({ path, content });
  };

  if (harness.personas === false) {
    // Roles only: the portable, voiceless target. Role text is emitted verbatim.
    const used = uniq([...seats.map((s) => s.role.name), ...formations.map((f) => f.role.name)]).map((n) => team.roles[n]);
    for (const role of used) {
      const path = outPath({ role: role.name, name: role.name });
      emit(path, role.skill);
      for (const [lens, text] of Object.entries(role.lensText)) emit(join(dirname(path), "lenses", `${lens}.md`), text + "\n");
      rows.push(...enforcementRows(harness, role.name, role, toolsFor(harness, role.may)));
      checks.push(...checkRows(team, role.name, role, null), ...role.lenses.flatMap((l) => checkRows(team, role.name, role, l).filter((c) => c.lens === l)));
    }
  } else {
    for (const seat of seats) {
      const { role, persona, lens } = seat;
      const tools = toolsFor(harness, role.may);
      const disallowed = toolsFor(harness, role.mustNot).filter((t) => !tools.includes(t));
      const description = `${persona.display}: ${role.description}${lens ? ` Holds the ${lens} lens.` : ""}`;
      const seatChecks = checkRows(team, seat.as, role, lens);
      emit(outPath({ name: seat.as, role: role.name }), frontmatter(harness, role, seat.as, description, tools, disallowed) + agentBody(seat, seatChecks, team.checks.log ?? null));
      rows.push(...enforcementRows(harness, seat.as, role, tools));
      checks.push(...seatChecks);
    }
    for (const f of formations) {
      const tools = toolsFor(harness, f.role.may);
      const disallowed = toolsFor(harness, f.role.mustNot).filter((t) => !tools.includes(t));
      const lensNames = f.floor.map((s) => s.lens).filter(Boolean);
      const description = `${f.name}: ${f.role.description} A formation of ${lensNames.join(", ")}${f.conditional.length ? `, plus conditional ${f.conditional.map((s) => s.lens).join(", ")}` : ""}.`;
      const fChecks = uniq([null, ...lensNames, ...f.conditional.map((s) => s.lens)]).flatMap((l) => checkRows(team, f.name, f.role, l).filter((c) => c.lens === l));
      emit(outPath({ name: f.name, role: f.role.name }), frontmatter(harness, f.role, f.name, description, tools, disallowed) + formationBody(f.name, f.role, f.floor, f.conditional, fChecks, team.checks.log ?? null));
      rows.push(...enforcementRows(harness, f.name, f.role, tools));
      checks.push(...fChecks);
    }
    emit("roster.md", renderRoster(view, party, seats, formations, lines));
  }

  emit("enforcement.md", renderEnforcement(harness, rows, checks));
  return { files, enforcement: rows, checks };
}

// --- CLI ---------------------------------------------------------------------

const FLAGS = ["--party", "--harness", "--view", "--out"];

function parseArgs(argv) {
  const opts = { out: "build/team" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!FLAGS.includes(a)) throw new Error(`unknown argument ${a} (expected ${FLAGS.join(", ")})`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${a} requires a value`);
    opts[a.slice(2)] = v;
    i++;
  }
  if (!opts.party) throw new Error("--party is required");
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = compose(process.cwd(), opts);
  for (const f of result.files) {
    const abs = join(opts.out, f.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.content);
  }
  const tool = result.enforcement.filter((r) => r.level === "tool").length;
  const bound = result.checks.filter((c) => c.run).length;
  console.log(`composed ${result.files.length} files → ${opts.out}`);
  console.log(`enforcement: ${tool} boundaries at the tool layer, ${result.enforcement.length - tool} by prose only`);
  console.log(`checks: ${bound} deterministic (bound to a command), ${result.checks.length - bound} inferential (judged); see ${join(opts.out, "enforcement.md")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(`compose-team: ${err.message}`);
    process.exit(1);
  }
}
