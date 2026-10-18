#!/usr/bin/env node
// agent-notes: { ctx: "tests for compose-team: layer composition, checks, enforcement, view isolation, refusals", deps: [scripts/compose-team.mjs, docs/methodology/team-layers.md, team/parties/summon-core.json, team/lines/tdd.json], state: draft, last: "tara@2026-09-09", key: ["fixture tree in a tmpdir for invariants; the real team/ tree for the smoke test", "every load-bearing spec sentence has a test whose wrong implementation is named in a comment", "pre-flight: no clock reads; expected directions derived from team-layers.md, not from the composer"] }
//
//   node --test scripts/compose-team.test.mjs
//
// Red phase first, then hardened against a mutation run (docs/history/code-reviews/
// 2026-09-09-compose-team-tara.md): each case names the wrong implementation it kills.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { compose, findRestatements, loadTeam } from "./compose-team.mjs";

const SCRIPT = resolve(import.meta.dirname, "compose-team.mjs");
const REPO = resolve(import.meta.dirname, "..");

// --- fixture -----------------------------------------------------------------

const ROLE_TESTER = `---
name: tester
description: Writes failing tests first.
---
<!-- FIXTURE-COMMENT-ROLE -->
# Tester

## Charter

FIXTURE-TESTER-CHARTER You write the failing tests first.

## Standard

FIXTURE-TESTER-STANDARD Fails for the right reason.

## Questions

FIXTURE-TESTER-QUESTIONS 1. Time pinned?

## Boundaries

FIXTURE-TESTER-BOUNDARY You do not write production code.

## Output

FIXTURE-TESTER-OUTPUT The tests.
`;

const ROLE_REVIEWER = `---
name: reviewer
description: Reads a change and reports what is wrong with it.
---
# Reviewer

## Charter

FIXTURE-REVIEWER-CHARTER You read a change and say what is wrong.

## Standard

Every finding cites a line.

## Questions

FIXTURE-REVIEWER-QUESTIONS The lens supplies them.

## Boundaries

FIXTURE-REVIEWER-BOUNDARY You do not fix what you find.

## Output

FIXTURE-REVIEWER-OUTPUT By severity.
`;

const ROLE_SCRIBE = ROLE_TESTER.replace("name: tester", "name: scribe").replaceAll("FIXTURE-TESTER", "FIXTURE-SCRIBE");

const LENS_SIMPLICITY = `<!-- FIXTURE-COMMENT-LENS -->
## Lens: Simplicity

FIXTURE-LENS-SIMPLICITY Could someone understand this at 2am? Flag an interface with one implementation or a factory with one product.
`;

const LENS_SECURITY = `## Lens: Security

FIXTURE-LENS-SECURITY If an attacker saw this diff, what would they try?
`;

const LENS_OPERATIONAL = `## Lens: Operational

FIXTURE-LENS-OPERATIONAL When this breaks at 3am, how will anyone know?
`;

const PERSONA_TARA = `---
name: tara
role: tester
display: Tara
---
<!-- FIXTURE-COMMENT-PERSONA -->
## Priors

FIXTURE-TARA-PRIORS A test that cannot fail is worse than none.

## Dissent

FIXTURE-TARA-DISSENT When the brief's arithmetic is off, she says the real number unprompted.

## Voice

FIXTURE-TARA-VOICE Precise and relentless.

"Counted the suite. Minus two."

## Tells

FIXTURE-TARA-TELLS Reports counts.
`;

const PERSONA_VIK = `---
name: vik
role: reviewer
lens: simplicity
display: Vik
---
## Priors

FIXTURE-VIK-PRIORS Most abstractions are premature.

## Dissent

FIXTURE-VIK-DISSENT When a record promised a deletion the diff did not deliver, he forces a side.

## Voice

FIXTURE-VIK-VOICE Dry and unhurried.

"Two are gone."

## Tells

FIXTURE-VIK-TELLS Counts callers.
`;

const PERSONA_PIERROT = `---
name: pierrot
role: reviewer
lens: security
display: Pierrot
---
## Priors

FIXTURE-PIERROT-PRIORS Every input is hostile.

## Dissent

FIXTURE-PIERROT-DISSENT When a control lives in the file an attacker would edit to remove it.

## Voice

FIXTURE-PIERROT-VOICE Deadpan.

"Six seconds."

## Tells

FIXTURE-PIERROT-TELLS Attaches a blast radius.
`;

const VIEW = {
  skin: "test-skin",
  title: "FIXTURE-VIEW-TITLE Fixture Party",
  members: {
    tara: { class: "FIXTURE-VIEW-CLASS-ARCHER", epithet: "FIXTURE-VIEW-EPITHET-TARA", accent: "#ef4444", sprite: "tara.png", blurb: "FIXTURE-VIEW-BLURB-TARA" },
    vik: { class: "FIXTURE-VIEW-CLASS-WARDEN", epithet: "FIXTURE-VIEW-EPITHET-VIK", accent: "#64748b", sprite: "vik.png", blurb: "FIXTURE-VIEW-BLURB-VIK" },
    pierrot: { class: "FIXTURE-VIEW-CLASS-NIGHTBLADE", epithet: "FIXTURE-VIEW-EPITHET-PIERROT", accent: "#7f1d1d", sprite: "pierrot.png", blurb: "FIXTURE-VIEW-BLURB-PIERROT" },
  },
  formations: {
    "review-party": { class: "FIXTURE-VIEW-CLASS-PARTY", accent: "#4f46e5", sprite: "party.png", blurb: "FIXTURE-VIEW-BLURB-PARTY" },
  },
};

const HARNESS_CLAUDE = {
  harness: "claude-code",
  fitted: true,
  review: "on every release",
  output: { dir: ".claude/agents", file: "{name}.md" },
  capabilities: {
    read: ["Read", "Grep", "Glob"],
    run: ["Bash"],
    "write:src": ["Write", "Edit"],
    "write:tests": ["Write", "Edit"],
    "write:docs": ["Write", "Edit"],
    web: ["WebSearch", "WebFetch"],
  },
  frontmatter: { model: "inherit" },
  budget: { default: 20, reviewer: 15 },
  keys: { tools: "tools", disallowed: "disallowedTools", budget: "maxTurns" },
};

// A second agent-emitting adapter with every fitted value changed: tool names, key names,
// frontmatter, budget, output dir. Bodies composed on it must be byte-identical to claude-code's.
const HARNESS_OTHER = {
  harness: "other",
  fitted: true,
  review: "whenever",
  output: { dir: ".other/agents", file: "{name}.agent.md" },
  capabilities: {
    read: ["fs.read"],
    run: ["shell"],
    "write:src": ["fs.write"],
    "write:tests": ["fs.write"],
    "write:docs": ["fs.write"],
    web: ["http"],
  },
  frontmatter: { engine: "x" },
  budget: { default: 7 },
  keys: { tools: "allow", disallowed: "deny", budget: "turns" },
};

const HARNESS_SKILLS = {
  harness: "skills",
  fitted: true,
  review: "when the spec changes",
  output: { dir: ".agents/skills", file: "{role}/SKILL.md" },
  personas: false,
  capabilities: {},
  frontmatter: {},
  budget: {},
};

const PARTY = {
  name: "fixture",
  harness: "claude-code",
  view: "test-skin",
  members: [
    { role: "tester", persona: "tara" },
    { role: "reviewer", lens: "simplicity", persona: "vik" },
    { role: "reviewer", lens: "security", persona: "pierrot" },
  ],
  formations: [
    {
      name: "review-party",
      role: "reviewer",
      members: [
        { persona: "vik", lens: "simplicity" },
        { persona: "pierrot", lens: "security" },
      ],
      conditional: [{ lens: "operational", when: "FIXTURE-WHEN the change alters behaviour" }],
    },
  ],
};

const CHECKS = {
  "tests-green": { run: "pnpm test", receipt: "FIXTURE-RECEIPT the summary line" },
};

const LINE = {
  name: "fixture-line",
  stations: [
    { name: "red", seat: "tara", emits: "tests" },
    { name: "review", seat: "review-party", needs: ["tests"], emits: "verdicts" },
  ],
  constraints: [{ rule: "order", stations: ["red", "review"] }, { rule: "distinct-instance", stations: ["red", "review"] }],
};

const roots = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

/** Build a minimal team/ tree in a fresh tmpdir; `edit` mutates the file map before writing. A null entry is not written. */
function fixture(edit = () => {}) {
  const root = mkdtempSync(join(tmpdir(), "summon-team-"));
  roots.push(root);
  const files = {
    "team/roles/tester/SKILL.md": ROLE_TESTER,
    "team/roles/tester/role.json": JSON.stringify({ may: ["read", "run", "write:tests"], "must-not": ["write:src"], lenses: [], checks: [{ id: "tests-green", claim: "FIXTURE-CHECK-GREEN The suite passes." }, { id: "no-wall-clock", claim: "FIXTURE-CHECK-CLOCK No test reads the clock." }] }),
    "team/roles/reviewer/SKILL.md": ROLE_REVIEWER,
    "team/roles/reviewer/role.json": JSON.stringify({ may: ["read", "run"], "must-not": ["write:src", "write:tests", "write:docs"], lenses: ["simplicity", "security", "operational"], checks: [{ id: "tests-green", claim: "FIXTURE-CHECK-GREEN The suite passes.", lens: "security" }] }),
    "team/roles/reviewer/lenses/simplicity.md": LENS_SIMPLICITY,
    "team/roles/reviewer/lenses/security.md": LENS_SECURITY,
    "team/roles/reviewer/lenses/operational.md": LENS_OPERATIONAL,
    "team/roles/scribe/SKILL.md": ROLE_SCRIBE,
    "team/roles/scribe/role.json": JSON.stringify({ may: ["read"], "must-not": [], lenses: [] }),
    "team/personas/tara.md": PERSONA_TARA,
    "team/personas/vik.md": PERSONA_VIK,
    "team/personas/pierrot.md": PERSONA_PIERROT,
    "team/views/test-skin/party.json": JSON.stringify(VIEW),
    "team/harness/claude-code.json": JSON.stringify(HARNESS_CLAUDE),
    "team/harness/other.json": JSON.stringify(HARNESS_OTHER),
    "team/harness/skills.json": JSON.stringify(HARNESS_SKILLS),
    "team/parties/fixture.json": JSON.stringify(PARTY),
    "team/checks.json": JSON.stringify(CHECKS),
    "team/lines/fixture-line.json": JSON.stringify(LINE),
  };
  edit(files);
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

const party = (overrides) => JSON.stringify({ ...PARTY, ...overrides });
const fileNamed = (result, suffix) => {
  const f = result.files.find((f) => f.path.endsWith(suffix));
  assert.ok(f, `no composed file ends with ${suffix}; have ${result.files.map((f) => f.path).join(", ")}`);
  return f;
};
const frontmatterOf = (content) => content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
const bodyOf = (content) => content.replace(/^---\n[\s\S]*?\n---\n/, "");
const agentsIn = (result) => result.files.filter((f) => /\/agents\//.test(f.path));
const EXEC = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 };
const runCli = (cwd, args) => execFileSync(process.execPath, [SCRIPT, ...args], { cwd, ...EXEC });

// --- composition -------------------------------------------------------------

test("one agent file per member, named for the persona, in the adapter's output dir", () => {
  const out = compose(fixture(), { party: "fixture" });
  assert.deepEqual(
    agentsIn(out).map((f) => f.path).sort(),
    [".claude/agents/pierrot.md", ".claude/agents/review-party.md", ".claude/agents/tara.md", ".claude/agents/vik.md"]
  );
});

test("frontmatter: name, description, tools from role.may through the adapter's keys, budget from the adapter", () => {
  // Wrong implementation killed: an agent with no description composes but is never selected.
  const out = compose(fixture(), { party: "fixture" });
  const fm = frontmatterOf(fileNamed(out, "vik.md").content);
  assert.match(fm, /^name: vik$/m);
  assert.match(fm, /^description: "Vik: Reads a change and reports what is wrong with it\. Holds the simplicity lens\."$/m);
  assert.match(fm, /^tools: Read, Grep, Glob, Bash$/m);
  assert.match(fm, /^disallowedTools: Write, Edit$/m);
  assert.match(fm, /^model: inherit$/m);
  assert.match(fm, /^maxTurns: 15$/m, "reviewer budget is 15 in the fixture adapter");
  assert.match(frontmatterOf(fileNamed(out, "tara.md").content), /^maxTurns: 20$/m, "tester has no budget entry, so the default applies");
});

test("body carries every role and persona section, in the documented order, and only the bound lens", () => {
  // team-layers.md § Composition names the order. Wrong implementation killed: dropping any one section.
  const out = compose(fixture(), { party: "fixture" });
  const body = fileNamed(out, "vik.md").content;
  const expected = [
    "FIXTURE-VIK-VOICE",
    "FIXTURE-REVIEWER-CHARTER",
    "FIXTURE-REVIEWER-QUESTIONS",
    "FIXTURE-LENS-SIMPLICITY",
    "FIXTURE-VIK-PRIORS",
    "FIXTURE-VIK-DISSENT",
    "FIXTURE-VIK-TELLS",
    "FIXTURE-REVIEWER-BOUNDARY",
    "FIXTURE-REVIEWER-OUTPUT",
  ];
  const positions = expected.map((marker) => {
    const i = body.indexOf(marker);
    assert.notEqual(i, -1, `${marker} missing from composed vik.md`);
    return i;
  });
  for (let i = 1; i < positions.length; i++) assert.ok(positions[i] > positions[i - 1], `${expected[i]} should follow ${expected[i - 1]}`);
  assert.doesNotMatch(body, /FIXTURE-LENS-(SECURITY|OPERATIONAL)/, "a member bound to one lens must not receive the other lenses");
});

test("a member with no lens gets all five role sections and Standard, with no lens heading", () => {
  const out = compose(fixture(), { party: "fixture" });
  const body = fileNamed(out, "tara.md").content;
  for (const m of ["FIXTURE-TESTER-CHARTER", "FIXTURE-TESTER-STANDARD", "FIXTURE-TESTER-QUESTIONS", "FIXTURE-TESTER-BOUNDARY", "FIXTURE-TESTER-OUTPUT", "FIXTURE-TARA-TELLS"]) {
    assert.ok(body.includes(m), `tara.md lacks ${m}`);
  }
  assert.doesNotMatch(body, /## Lens:/);
});

test("HTML comments (agent-notes) in any layer are stripped from the composed agent", () => {
  // Wrong implementation killed: agent-notes shipping into every prompt.
  const out = compose(fixture(), { party: "fixture" });
  for (const f of agentsIn(out)) assert.doesNotMatch(f.content, /FIXTURE-COMMENT-/, `${f.path} carries a source comment`);
});

test("frontmatter values may be quoted", () => {
  const root = fixture((files) => {
    files["team/personas/vik.md"] = PERSONA_VIK.replace("display: Vik", 'display: "Vik"');
  });
  const out = compose(root, { party: "fixture" });
  assert.match(fileNamed(out, "vik.md").content, /^You are Vik, holding/m);
});

test("two seats held by one persona compose to two distinct files when the party names them", () => {
  // Wrong implementation killed: both seats at .claude/agents/tara.md, last write wins.
  const root = fixture((files) => {
    files["team/personas/tara.md"] = PERSONA_TARA.replace("role: tester\n", "role: tester\nholds: tester, reviewer/security\n");
    files["team/parties/fixture.json"] = party({
      members: [{ role: "tester", persona: "tara" }, { role: "reviewer", lens: "security", persona: "tara", as: "tara-review" }],
      formations: [],
    });
  });
  const out = compose(root, { party: "fixture" });
  const paths = agentsIn(out).map((f) => f.path);
  assert.deepEqual(paths.sort(), [".claude/agents/tara-review.md", ".claude/agents/tara.md"]);
  assert.match(frontmatterOf(fileNamed(out, "tara-review.md").content), /^name: tara-review$/m);
  assert.deepEqual([...new Set(out.enforcement.filter((r) => r.member === "tara-review").map((r) => r.role))], ["reviewer"]);
  assert.equal(out.enforcement.filter((r) => r.member === "tara-review").length, 3, "one row per reviewer must-not");
});

test("refuses two seats that compose to the same file", () => {
  const root = fixture((files) => {
    files["team/personas/tara.md"] = PERSONA_TARA.replace("role: tester\n", "role: tester\nholds: tester, reviewer/security\n");
    files["team/parties/fixture.json"] = party({ members: [{ role: "tester", persona: "tara" }, { role: "reviewer", lens: "security", persona: "tara" }], formations: [] });
  });
  assert.throws(() => compose(root, { party: "fixture" }), /same file "\.claude\/agents\/tara\.md".*"as"/);
});

// --- the adapter is the only fitted layer -------------------------------------
// team-layers.md: "the point of isolating it is that next time only this file has to be reread."

test("composing on a different adapter changes frontmatter and paths and nothing else", () => {
  // Wrong implementation killed: any harness vocabulary leaking into the body.
  const root = fixture();
  const a = compose(root, { party: "fixture" });
  const b = compose(root, { party: "fixture", harness: "other" });
  assert.deepEqual(agentsIn(b).map((f) => f.path).sort(), [".other/agents/pierrot.agent.md", ".other/agents/review-party.agent.md", ".other/agents/tara.agent.md", ".other/agents/vik.agent.md"]);
  for (const fa of agentsIn(a)) {
    const fb = agentsIn(b).find((f) => f.path.endsWith(fa.path.replace(".claude/agents/", "/").replace(".md", ".agent.md")));
    assert.equal(bodyOf(fb.content), bodyOf(fa.content), `${fa.path}: body differs across adapters`);
  }
  const fm = frontmatterOf(fileNamed(b, "vik.agent.md").content);
  assert.match(fm, /^allow: fs\.read, shell$/m);
  assert.match(fm, /^deny: fs\.write$/m);
  assert.match(fm, /^engine: x$/m);
  assert.match(fm, /^turns: 7$/m);
});

// --- the view never enters model context ------------------------------------
// team-layers.md: "They never enter an agent's context. A test on the composer pins that."

test("no view content reaches any agent file: title, skin, class, epithet, accent, sprite, blurb", () => {
  const out = compose(fixture(), { party: "fixture" });
  const agents = agentsIn(out);
  assert.equal(agents.length, 4);
  const leaks = ["FIXTURE-VIEW-", "Fixture Party", "test-skin", "#ef4444", "#64748b", "#4f46e5", "tara.png", "vik.png", "party.png"];
  for (const f of agents) for (const leak of leaks) assert.ok(!f.content.includes(leak), `${f.path} contains view content "${leak}"`);
});

test("the roster is rendered from the view and names every member's class, epithet, and display name", () => {
  const out = compose(fixture(), { party: "fixture" });
  const roster = fileNamed(out, "roster.md").content;
  for (const m of ["FIXTURE-VIEW-TITLE", "Tara", "FIXTURE-VIEW-CLASS-ARCHER", "FIXTURE-VIEW-EPITHET-TARA", "Vik", "FIXTURE-VIEW-CLASS-WARDEN", "FIXTURE-VIEW-CLASS-PARTY"]) {
    assert.ok(roster.includes(m), `roster.md lacks ${m}`);
  }
  assert.match(roster, /\| review-party \|[^\n]*\| Vik, Pierrot \| operational \|/, "formation row lists floor and conditional");
});

test("refuses a party whose named view has no party.json; a party with no view composes with no skin", () => {
  assert.throws(() => compose(fixture((f) => (f["team/parties/fixture.json"] = party({ view: "nope" }))), { party: "fixture" }), /view "nope"/);
  const out = compose(fixture((f) => (f["team/parties/fixture.json"] = party({ view: undefined }))), { party: "fixture" });
  assert.match(fileNamed(out, "roster.md").content, /skin `none`/);
});

// --- the enforcement report --------------------------------------------------
// team-layers.md: tool when every mapped tool is withheld; prose when the role needs one
// of them, or when the adapter maps the boundary to nothing.

test("enforcement: withheld-everywhere is tool; shared with a needed capability is prose; formations are reported", () => {
  const out = compose(fixture(), { party: "fixture" });
  const find = (member, boundary) => out.enforcement.find((r) => r.member === member && r.boundary === boundary);
  assert.equal(find("tara", "write:src")?.level, "prose", "tester may write:tests, which shares Write/Edit with write:src");
  assert.equal(find("vik", "write:src")?.level, "tool");
  assert.equal(find("vik", "write:tests")?.level, "tool");
  assert.equal(find("review-party", "write:docs")?.level, "tool");
  const md = fileNamed(out, "enforcement.md").content;
  assert.match(md, /\| tara \| tester \| write:src \| prose \|/);
  assert.match(md, /\| vik \| reviewer \| write:src \| tool \|/);
  assert.match(md, /10 boundaries: 9 enforced at the tool layer, 1 by prose only/);
});

test("enforcement: a boundary is prose when the role needs any one of its tools", () => {
  // Wrong implementation killed: `some` instead of `every`.
  const root = fixture((files) => {
    const h = { ...HARNESS_CLAUDE, capabilities: { ...HARNESS_CLAUDE.capabilities, "write:src": ["Write", "Edit", "NotebookEdit"], notebook: ["NotebookEdit"] } };
    files["team/harness/claude-code.json"] = JSON.stringify(h);
    files["team/roles/reviewer/role.json"] = JSON.stringify({ may: ["read", "run", "notebook"], "must-not": ["write:src"], lenses: ["simplicity", "security", "operational"] });
  });
  const out = compose(root, { party: "fixture" });
  assert.equal(out.enforcement.find((r) => r.member === "vik" && r.boundary === "write:src")?.level, "prose");
});

test("enforcement: a must-not the adapter maps to nothing is prose", () => {
  const root = fixture((files) => {
    files["team/roles/tester/role.json"] = JSON.stringify({ may: ["read", "run", "write:tests"], "must-not": ["write:src", "notebook"], lenses: [] });
  });
  const out = compose(root, { party: "fixture" });
  assert.equal(out.enforcement.find((r) => r.member === "tara" && r.boundary === "notebook")?.level, "prose");
});

test("enforcement: a prose boundary is still carried by the role's Boundaries prose in the agent body", () => {
  const out = compose(fixture(), { party: "fixture" });
  assert.match(fileNamed(out, "tara.md").content, /FIXTURE-TESTER-BOUNDARY/);
});

// --- checks: the deterministic half ------------------------------------------
// team-layers.md § Checks: a role declares claims; the project binds commands; unbound
// claims are judged and graded inferential.

test("checks: a bound check is emitted with its command and receipt; an unbound one falls back to judgment", () => {
  const out = compose(fixture(), { party: "fixture" });
  const body = fileNamed(out, "tara.md").content;
  assert.match(body, /## Checks/);
  assert.match(body, /\*\*FIXTURE-CHECK-GREEN The suite passes\.\*\* Run `pnpm test`; receipt: FIXTURE-RECEIPT the summary line\./);
  assert.match(body, /\*\*FIXTURE-CHECK-CLOCK No test reads the clock\.\*\* No command bound in this project; judge it and grade the claim inferential\./);
  const checks = body.indexOf("## Checks");
  assert.ok(checks > body.indexOf("FIXTURE-TESTER-STANDARD") && checks < body.indexOf("FIXTURE-TESTER-QUESTIONS"), "Checks sit between Standard and Questions");
  const rows = out.checks.filter((c) => c.member === "tara");
  assert.deepEqual(rows.map((c) => [c.id, c.grade]), [["tests-green", "deterministic"], ["no-wall-clock", "inferential"]]);
  const md = fileNamed(out, "enforcement.md").content;
  // tara: tests-green (bound) + no-wall-clock (judged); pierrot and review-party each hold security: tests-green (bound). 4 checks, 3 bound.
  assert.match(md, /4 checks: 3 bound to a command \(deterministic\), 1 judged \(inferential\)/);
  assert.match(md, /\| tara \| tester \| no-wall-clock \| inferential \|  \|/);
});

test("checks: a lens-scoped check reaches only members and formations that hold that lens", () => {
  const out = compose(fixture(), { party: "fixture" });
  assert.doesNotMatch(fileNamed(out, "vik.md").content, /## Checks/, "vik holds simplicity; the check is scoped to security");
  assert.match(fileNamed(out, "pierrot.md").content, /## Checks[\s\S]*FIXTURE-CHECK-GREEN/);
  assert.match(fileNamed(out, "review-party.md").content, /## Checks[\s\S]*FIXTURE-CHECK-GREEN/, "the formation holds security");
});

test("checks: refuses a bound check on a role that must not run; the same check unbound is judged", () => {
  // Vik F0 (2026-09-09): a designer with must-not run was told to run pnpm check:css.
  const bound = fixture((f) => {
    f["team/roles/tester/role.json"] = JSON.stringify({ may: ["read", "write:tests"], "must-not": ["run", "write:src"], lenses: [], checks: [{ id: "tests-green", claim: "FIXTURE-CHECK-GREEN The suite passes." }] });
  });
  assert.throws(() => compose(bound, { party: "fixture" }), /check "tests-green" is bound to a command but role "tester" must not run/);
  const unbound = fixture((f) => {
    f["team/roles/tester/role.json"] = JSON.stringify({ may: ["read", "write:tests"], "must-not": ["run", "write:src"], lenses: [], checks: [{ id: "no-wall-clock", claim: "FIXTURE-CHECK-CLOCK No test reads the clock." }] });
  });
  assert.equal(compose(unbound, { party: "fixture" }).checks.find((c) => c.member === "tara").grade, "inferential");
});

test("checks: refuses a check that names a lens the role does not declare, or lacks a claim", () => {
  assert.throws(
    () => compose(fixture((f) => (f["team/roles/tester/role.json"] = JSON.stringify({ may: ["read"], "must-not": [], lenses: [], checks: [{ id: "x", claim: "y", lens: "vibes" }] }))), { party: "fixture" }),
    /check "x" names lens "vibes"/
  );
  assert.throws(
    () => compose(fixture((f) => (f["team/roles/tester/role.json"] = JSON.stringify({ may: ["read"], "must-not": [], lenses: [], checks: [{ id: "x" }] }))), { party: "fixture" }),
    /every check needs an id and a claim/
  );
});

// --- lines and the log -------------------------------------------------------
// team-layers.md § The line: a party opts into lines; every station seat must be a seat the
// party composes. § The event log: a configured log adds a Log section to every agent.

test("a party's lines are validated against its seats and listed in the roster", () => {
  const out = compose(fixture((f) => (f["team/parties/fixture.json"] = party({ lines: ["fixture-line"] }))), { party: "fixture" });
  assert.match(fileNamed(out, "roster.md").content, /\| fixture-line \| red: tara → review: review-party \| order\(red, review\); distinct-instance\(red, review\) \|/);
  assert.throws(() => compose(fixture((f) => (f["team/parties/fixture.json"] = party({ lines: ["nope"] }))), { party: "fixture" }), /line "nope" has no file/);
  const bad = fixture((f) => {
    f["team/lines/fixture-line.json"] = JSON.stringify({ ...LINE, stations: [{ name: "red", seat: "nobody" }] });
    f["team/parties/fixture.json"] = party({ lines: ["fixture-line"] });
  });
  assert.throws(() => compose(bad, { party: "fixture" }), /station "red" names seat "nobody", which the party does not compose/);
  const badConstraint = fixture((f) => {
    f["team/lines/fixture-line.json"] = JSON.stringify({ ...LINE, constraints: [{ rule: "order", stations: ["red", "ship"] }] });
    f["team/parties/fixture.json"] = party({ lines: ["fixture-line"] });
  });
  assert.throws(() => compose(badConstraint, { party: "fixture" }), /constraint "order" names station "ship"/);
});

test("a configured log adds a Log section naming the seat, the path, and the events to write; no log, no section", () => {
  const out = compose(fixture((f) => (f["team/checks.json"] = JSON.stringify({ ...CHECKS, log: ".summon/FIXTURE-LOG.jsonl" }))), { party: "fixture" });
  const tara = fileNamed(out, "tara.md").content;
  const logSec = tara.slice(tara.indexOf("## Log"), tara.indexOf("FIXTURE-TESTER-QUESTIONS"));
  assert.ok(logSec.startsWith("## Log"), "tara.md has a Log section");
  for (const m of [".summon/FIXTURE-LOG.jsonl", "Your seat is `tara`", "`claim`", "`verdict`", "`return`", "team-log.mjs append"]) assert.ok(logSec.includes(m), `Log section lacks ${m}`);
  assert.ok(tara.indexOf("## Log") > tara.indexOf("## Checks") && tara.indexOf("## Log") < tara.indexOf("FIXTURE-TESTER-QUESTIONS"), "Log follows Checks and precedes Questions");
  assert.match(fileNamed(out, "review-party.md").content, /Your seat is `review-party`/);
  assert.doesNotMatch(fileNamed(compose(fixture(), { party: "fixture" }), "tara.md").content, /## Log/);
});

// --- formations --------------------------------------------------------------

test("a formation is one agent carrying every floor member's lens and dissent, plus conditional lenses with their triggers, with the role's tools", () => {
  const out = compose(fixture(), { party: "fixture" });
  const f = fileNamed(out, "review-party.md");
  assert.match(frontmatterOf(f.content), /^name: review-party$/m);
  assert.match(frontmatterOf(f.content), /^tools: Read, Grep, Glob, Bash$/m);
  assert.match(frontmatterOf(f.content), /^disallowedTools: Write, Edit$/m);
  for (const m of ["FIXTURE-REVIEWER-CHARTER", "FIXTURE-LENS-SIMPLICITY", "FIXTURE-LENS-SECURITY", "FIXTURE-VIK-DISSENT", "FIXTURE-PIERROT-DISSENT", "FIXTURE-LENS-OPERATIONAL", "FIXTURE-WHEN", "FIXTURE-REVIEWER-OUTPUT"]) {
    assert.ok(f.content.includes(m), `formation lacks ${m}`);
  }
  const at = (m) => f.content.indexOf(m);
  assert.ok(at("FIXTURE-LENS-SIMPLICITY") < at("FIXTURE-LENS-SECURITY"), "floor lenses appear in party order");
  assert.ok(at("FIXTURE-LENS-SECURITY") < at("# Conditional lenses") && at("# Conditional lenses") < at("FIXTURE-LENS-OPERATIONAL"), "conditional lenses follow the floor under their own heading");
  assert.ok(at("FIXTURE-WHEN") < at("FIXTURE-LENS-OPERATIONAL"), "the trigger precedes the lens it gates");
  assert.match(f.content, /a formation of 2 lenses on the reviewer role, plus 1 conditional/);
});

test("refuses a formation with no floor members, a conditional lens with no trigger, a member that does not hold the seat, or a missing role", () => {
  const cases = [
    [{ formations: [{ name: "x", role: "reviewer", members: [] }] }, /formation "x": a formation needs at least one floor member/],
    [{ formations: [{ name: "x", role: "reviewer", members: [{ persona: "vik", lens: "simplicity" }], conditional: [{ lens: "operational" }] }] }, /formation "x": a conditional lens needs a "when" trigger/],
    [{ formations: [{ name: "x", role: "reviewer", members: [{ persona: "tara", lens: "simplicity" }] }] }, /formation "x": persona "tara" holds tester but the party assigns role "reviewer" on lens "simplicity"/],
    [{ formations: [{ name: "x", role: "nope", members: [] }] }, /formation "x": role "nope" has no directory/],
    [{ formations: [{ name: "x", role: "reviewer", members: ["vik"] }] }, /members must be objects/],
    [{ formations: [{ name: "x", role: "reviewer", members: [{}] }] }, /a formation member needs a persona, a lens, or both/],
  ];
  for (const [overrides, re] of cases) {
    assert.throws(() => compose(fixture((f) => (f["team/parties/fixture.json"] = party(overrides))), { party: "fixture" }), re);
  }
});

// --- the skills adapter: roles only ------------------------------------------
// team-layers.md: "The skills adapter emits roles alone, no personas."

test("skills harness emits one SKILL.md per role the party uses, verbatim, with lenses, and no persona, view, or unused role", () => {
  const out = compose(fixture(), { party: "fixture", harness: "skills" });
  const paths = out.files.map((f) => f.path).sort();
  assert.deepEqual(paths, [
    ".agents/skills/reviewer/SKILL.md",
    ".agents/skills/reviewer/lenses/operational.md",
    ".agents/skills/reviewer/lenses/security.md",
    ".agents/skills/reviewer/lenses/simplicity.md",
    ".agents/skills/tester/SKILL.md",
    "enforcement.md",
  ]);
  assert.equal(fileNamed(out, "tester/SKILL.md").content, ROLE_TESTER, "role text is emitted verbatim");
  assert.equal(fileNamed(out, "lenses/security.md").content, LENS_SECURITY.trim() + "\n");
  for (const f of out.files) {
    assert.doesNotMatch(f.content, /FIXTURE-(TARA|VIK|PIERROT|VIEW)-/, `${f.path} carries persona or view text on a roles-only target`);
  }
  assert.ok(out.enforcement.every((r) => r.level === "prose"), "an adapter with no tool map enforces nothing");
});

// --- refusals ----------------------------------------------------------------

test("refuses a party that names a persona with no file", () => {
  assert.throws(() => compose(fixture((f) => (f["team/parties/fixture.json"] = party({ members: [{ role: "tester", persona: "nobody" }], formations: [] }))), { party: "fixture" }), /persona "nobody"/);
});

test("refuses a member whose persona does not hold the assigned seat", () => {
  assert.throws(
    () => compose(fixture((f) => (f["team/parties/fixture.json"] = party({ members: [{ role: "reviewer", persona: "tara" }], formations: [] }))), { party: "fixture" }),
    /persona "tara" holds tester but the party assigns role "reviewer"/
  );
});

test("refuses a lens the role does not declare, even for a persona that holds the role on any lens", () => {
  // Wrong implementation killed: dropping the declared-lens check (the holds check must not fire first).
  const root = fixture((files) => {
    files["team/personas/vik.md"] = PERSONA_VIK.replace("lens: simplicity\n", "");
    files["team/parties/fixture.json"] = party({ members: [{ role: "reviewer", lens: "vibes", persona: "vik" }], formations: [] });
  });
  assert.throws(() => compose(root, { party: "fixture" }), /lens "vibes" is not declared by role "reviewer"/);
});

test("refuses a persona whose Dissent is empty, heading-only, absent, or comment-only", () => {
  const variants = {
    empty: PERSONA_VIK.replace(/## Dissent\n\n[^\n]+\n/, "## Dissent\n\n"),
    absent: PERSONA_VIK.replace(/## Dissent\n\n[^\n]+\n\n/, ""),
    comment: PERSONA_VIK.replace(/## Dissent\n\n[^\n]+\n/, "## Dissent\n\n<!-- later -->\n"),
  };
  for (const [name, text] of Object.entries(variants)) {
    assert.throws(() => compose(fixture((f) => (f["team/personas/vik.md"] = text)), { party: "fixture" }), /persona "vik".*## Dissent/, `variant ${name}`);
  }
});

test("refuses a Dissent bullet that restates the bound lens or the role", () => {
  // team-layers.md: "Dissent holds only what the role and lens do not already say."
  const root = fixture((files) => {
    files["team/personas/vik.md"] = PERSONA_VIK.replace("FIXTURE-VIK-DISSENT When a record promised a deletion the diff did not deliver, he forces a side.", "When an interface has one implementation or a factory has one product, flag it.");
  });
  assert.throws(() => compose(root, { party: "fixture" }), /persona "vik": Dissent restates the simplicity lens/);
  assert.deepEqual(findRestatements("A short one.", ["A short one indeed."]), [], "bullets under five content words are not compared");
});

test("refuses a role missing a required section, a role.json, or a SKILL.md, naming the file", () => {
  const cases = [
    [(f) => (f["team/roles/tester/SKILL.md"] = ROLE_TESTER.replace("## Charter", "## Chartr")), /role "tester" \(.*SKILL\.md\): missing or empty section\(s\): ## Charter/],
    [(f) => (f["team/roles/tester/role.json"] = null), /role "tester": missing .*role\.json/],
    [(f) => (f["team/roles/tester/SKILL.md"] = null), /role "tester": missing .*SKILL\.md/],
    [(f) => (f["team/roles/tester/role.json"] = "{"), /role\.json: .*JSON/],
    [(f) => (f["team/roles/reviewer/lenses/security.md"] = null), /role "reviewer": declares lens "security" but .* is missing/],
    [(f) => (f["team/personas/vik.md"] = PERSONA_VIK.replace("## Voice", "## Voic")), /persona "vik" \(.*vik\.md\): missing or empty section\(s\): ## Voice/],
    [(f) => (f["team/personas/vik.md"] = PERSONA_VIK.replace("role: reviewer\nlens: simplicity\n", "")), /persona "vik" \(.*\): frontmatter must name a role/],
  ];
  for (const [edit, re] of cases) assert.throws(() => compose(fixture(edit), { party: "fixture" }), re);
});

test("refuses a harness adapter that does not declare whether it is fitted, or lacks an output shape", () => {
  const { fitted, ...noFitted } = HARNESS_CLAUDE;
  assert.throws(() => compose(fixture((f) => (f["team/harness/claude-code.json"] = JSON.stringify(noFitted))), { party: "fixture" }), /harness "claude-code" \(.*\): must declare "fitted"/);
  const { output, ...noOutput } = HARNESS_CLAUDE;
  assert.throws(() => compose(fixture((f) => (f["team/harness/claude-code.json"] = JSON.stringify(noOutput))), { party: "fixture" }), /harness "claude-code".*output\.dir and output\.file/);
  assert.throws(() => compose(fixture(), { party: "fixture", harness: "nope" }), /harness "nope" has no adapter/);
  assert.throws(() => compose(fixture(), { party: "nope" }), /party "nope" has no file/);
});

test("refuses a tool name in may or in must-not; capabilities are work verbs", () => {
  // team-layers.md: capabilities "are never tool names."
  assert.throws(() => compose(fixture((f) => (f["team/roles/tester/role.json"] = JSON.stringify({ may: ["Read", "Bash"], "must-not": [], lenses: [] }))), { party: "fixture" }), /capability "Read" in may/);
  assert.throws(() => compose(fixture((f) => (f["team/roles/tester/role.json"] = JSON.stringify({ may: ["read"], "must-not": ["Write"], lenses: [] }))), { party: "fixture" }), /capability "Write" in must-not/);
});

// --- the real tree -----------------------------------------------------------

test("the checked-in summon-core party composes on the claude-code adapter", () => {
  const out = compose(REPO, { party: "summon-core" });
  const names = agentsIn(out).map((f) => f.path);
  for (const n of ["cam", "pat", "archie", "tara", "sato", "vik", "pierrot", "wei", "grace", "ines", "dani", "debra", "diego", "prof", "cloud", "review-party"]) assert.ok(names.includes(`.claude/agents/${n}.md`), `summon-core lacks ${n}`);
  assert.equal(agentsIn(out).length, 16, "fifteen seats and one formation");
  const vik = fileNamed(out, "vik.md").content;
  assert.match(vik, /^## Lens: Simplicity$/m);
  assert.match(vik, /^## Tells$/m);
  assert.doesNotMatch(vik, /Grey Warden/, "the view stays out of the prompt");
  const formation = fileNamed(out, "review-party.md").content;
  assert.match(formation, /^# Conditional lenses$/m);
  assert.match(formation, /^### Lens: Operational$/m);
  assert.match(formation, /^### Lens: Accessibility$/m);
  assert.match(formation, /^### Dissent$/m, "a conditional lens with a persona carries that persona's dissent");
  assert.ok(out.checks.some((c) => c.grade === "deterministic") && out.checks.some((c) => c.grade === "inferential"), "the real tree has both bound and judged checks");
  assert.equal(out.checks.find((c) => c.member === "review-party" && c.id === "disagreement-rate")?.grade, "deterministic", "the disagreement rate is bound to team-log.mjs");
  assert.match(fileNamed(out, "roster.md").content, /\| tdd \| red: tara → green: sato → review: review-party \|/);
  assert.match(vik, /## Log[\s\S]*\.summon\/team-log\.jsonl/);
});

test("loadTeam reads every layer of the checked-in tree, and the party uses roles and personas that exist", () => {
  const team = loadTeam(REPO);
  const p = team.parties["summon-core"];
  const rolesUsed = new Set([...p.members.map((m) => m.role), ...p.formations.map((f) => f.role)]);
  const personasUsed = new Set([...p.members.map((m) => m.persona), ...p.formations.flatMap((f) => f.members.map((m) => m.persona))]);
  for (const r of rolesUsed) assert.ok(team.roles[r], `party uses role ${r}`);
  for (const q of personasUsed) assert.ok(team.personas[q], `party uses persona ${q}`);
  assert.deepEqual(Object.keys(team.roles).sort(), ["architect", "challenger", "cloud", "coder", "data-scientist", "designer", "elicitor", "operator", "product", "reviewer", "teacher", "tester", "tracker", "writer"]);
  assert.deepEqual(Object.keys(team.personas).sort(), ["archie", "cam", "cloud", "dani", "debra", "diego", "grace", "ines", "pat", "pierrot", "prof", "sato", "tara", "vik", "wei"]);
  for (const q of Object.keys(team.personas)) assert.ok(team.views["jrpg-16bit"].members[q]?.class, `skin lacks ${q}`);
  for (const r of Object.keys(team.roles)) assert.ok(team.views["jrpg-16bit"].roles[r]?.class, `skin lacks a role entry for ${r}`);
  assert.equal(team.harnesses["claude-code"].fitted, true);
  assert.equal(team.harnesses.skills.fitted, true);
  assert.ok(team.views["jrpg-16bit"] && team.views.plain);
  assert.ok(Object.keys(team.checks).length >= 5, "the project binds commands to checks");
});

// --- the CLI -----------------------------------------------------------------

test("CLI writes the composed tree under --out and prints counted summaries", () => {
  const root = fixture();
  const out = join(root, "build");
  const stdout = runCli(root, ["--party", "fixture", "--out", out]);
  assert.match(stdout, /composed 6 files/);
  assert.match(stdout, /enforcement: 9 boundaries at the tool layer, 1 by prose only/);
  assert.match(stdout, /checks: 3 deterministic \(bound to a command\), 1 inferential \(judged\)/);
  assert.match(readFileSync(join(out, ".claude/agents/vik.md"), "utf8"), /FIXTURE-VIK-DISSENT/);
  assert.match(readFileSync(join(out, "roster.md"), "utf8"), /FIXTURE-VIEW-CLASS-WARDEN/);
  assert.match(readFileSync(join(out, "enforcement.md"), "utf8"), /\| vik \| reviewer \| write:src \| tool \|/);
});

test("CLI --harness skills writes .agents/skills and no agent files", () => {
  const root = fixture();
  const out = join(root, "build");
  runCli(root, ["--party", "fixture", "--harness", "skills", "--out", out]);
  assert.equal(readFileSync(join(out, ".agents/skills/tester/SKILL.md"), "utf8"), ROLE_TESTER);
  assert.throws(() => readFileSync(join(out, ".claude/agents/vik.md")), /ENOENT/);
});

test("CLI exits 1 with the reason: refused composition, unknown flag, flag without value, missing --party", () => {
  const cases = [
    [fixture((f) => (f["team/parties/fixture.json"] = party({ members: [{ role: "tester", persona: "nobody" }], formations: [] }))), ["--party", "fixture"], /persona "nobody"/],
    [fixture(), ["--party", "fixture", "--nope"], /unknown argument --nope/],
    [fixture(), ["--party", "fixture", "--out"], /--out requires a value/],
    [fixture(), [], /--party is required/],
  ];
  for (const [root, args, re] of cases) {
    assert.throws(() => runCli(root, [...args, ...(args.includes("--out") ? [] : ["--out", join(root, "build")])]), (err) => err.status === 1 && re.test(String(err.stderr)), `args ${args.join(" ")}`);
  }
});
