#!/usr/bin/env node
// agent-notes: { ctx: "static CSS contrast + reduced-motion checker (ADR-0013 §6 slice A)", deps: [docs/adrs/0013-design-authority.md, .claude/agents/dani.md], state: active, last: "claude@2026-08-06", key: ["ADVISORY ONLY — exit 0 unless --strict; may NOT be wired into Done Gate item 8 (ADR-0013 §6 binding constraint)", "checks exactly two things: statically resolvable contrast pairs, and motion declarations lacking reduced-motion coverage", "ancestor-scoped pairing within one file — NOT co-declaration, which the gate proved finds ~1/35th of real pairs", "motion split from paint per WCAG SC 2.3.3's colour/opacity exclusion", "zero dependencies, stdlib only, like check-canon.mjs"] }
//
//   node scripts/check-css-contrast-motion.mjs src/styles/global.css src/components/Card.astro
//
// Takes explicit paths, as axe-cli and pa11y do. Avoid `**` unless your shell has
// globstar enabled — an unexpanded glob would otherwise arrive as a literal path;
// the script exits 2 rather than reporting "0 findings" when nothing was readable.
// In a scaffolded project this script ships but the root package.json does not,
// so invoke it directly rather than via `pnpm check:css`.
//
// WHAT THIS IS NOT. This is not an accessibility floor and must not be described
// as one. It passes green on a page with no alt text, unlabeled inputs, div click
// handlers, no landmarks, or inverted headings — most of what actually blocks
// users. It checks two rules that happen to be statically decidable, and its
// silence means nothing. See ADR-0013 § 6, slice A.
//
// IT DOES NOT DETECT THE DEFECT IT WAS PARTLY JUSTIFIED BY. Issue #86 (two hero
// accents below 3:1 as a hover border) is invisible here: those colours arrive
// from a JS frontmatter array through an inline `style` attribute and are
// consumed via `color-mix()`, none of which is statically resolvable. This
// catches that *shape* when the value is a literal — a weaker claim. #86 stays
// open and stays slice B's or a human's. See `docs/process/gotchas.md`
// § "A sensor's reach is not its justification's reach".
//
// Exit 0 always, unless --strict is passed. Advisory by ratification.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// ── colour ───────────────────────────────────────────────────────────────────

const NAMED = { white: "#ffffff", black: "#000000" };

/** Expand #abc to #aabbcc; return null for anything that isn't a hex colour. */
function normalizeHex(value) {
  const v = String(value).trim().toLowerCase();
  const named = NAMED[v];
  if (named) return named;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (!m) return null;
  const h = m[1];
  return h.length === 3 ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : `#${h}`;
}

function channelLuminance(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const n = parseInt(normalizeHex(hex).slice(1), 16);
  return (
    0.2126 * channelLuminance((n >> 16) & 255) +
    0.7152 * channelLuminance((n >> 8) & 255) +
    0.0722 * channelLuminance(n & 255)
  );
}

/** WCAG 2.x contrast ratio. Symmetric; 1..21. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ── parsing ──────────────────────────────────────────────────────────────────

/** Strip comments so they can't be mistaken for declarations. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Flatten a stylesheet into { selector, decls, inReducedMotion } records.
 * At-rules are recursed into so nested rules are seen; @media conditions are
 * carried down only far enough to answer "is this inside reduced-motion".
 */
/** Split a rule body into its own declarations and any nested rule blocks. */
function splitBody(body) {
  let declText = "";
  const nested = [];
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf("{", i);
    if (open === -1) {
      declText += body.slice(i);
      break;
    }
    // The prelude of a nested rule starts after the last `;` before its `{`.
    const chunk = body.slice(i, open);
    const cut = chunk.lastIndexOf(";");
    declText += chunk.slice(0, cut + 1);
    const prelude = chunk.slice(cut + 1).trim();
    let depth = 1;
    let j = open + 1;
    while (j < body.length && depth > 0) {
      if (body[j] === "{") depth++;
      else if (body[j] === "}") depth--;
      j++;
    }
    nested.push({ prelude, body: body.slice(open + 1, j - 1) });
    i = j;
  }
  return { declText, nested };
}

/** Compose a nested selector against its parent (`&` explicit or implied). */
function composeSelector(parent, child) {
  if (!parent) return child;
  return child.includes("&")
    ? child.replace(/&/g, parent)
    : `${parent} ${child}`;
}

function parseDeclarations(text) {
  const decls = new Map();
  // Split on `;` only outside quotes — a `content: "a;b"` must stay one declaration.
  const parts = [];
  let buf = "";
  let quote = null;
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
      buf += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
    } else if (ch === ";") {
      parts.push(buf);
      buf = "";
    } else buf += ch;
  }
  parts.push(buf);

  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (prop && value && /^[-a-z]+$/.test(prop)) decls.set(prop, value);
  }
  return decls;
}

/**
 * Flatten a stylesheet into { selector, decls, inReducedMotion } records.
 * Order is preserved, because the cascade's last-wins rule depends on it.
 * Native nesting is composed rather than skipped — a nested rule that silently
 * yielded nothing would hide real defects behind a syntax choice.
 */
function parseRules(css, inReducedMotion = false, out = [], parentSelector = "") {
  let i = 0;
  const src = css;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open === -1) break;
    const prelude = src.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    const body = src.slice(open + 1, j - 1);

    if (prelude.startsWith("@")) {
      const reduced = inReducedMotion || /prefers-reduced-motion\s*:\s*reduce/.test(prelude);
      if (/\{/.test(body)) parseRules(body, reduced, out, parentSelector);
    } else if (prelude) {
      const { declText, nested } = splitBody(body);
      const decls = parseDeclarations(declText);
      const selectors = prelude
        .split(",")
        .map((s) => composeSelector(parentSelector, s.trim()))
        .filter(Boolean);
      for (const selector of selectors) out.push({ selector, decls, inReducedMotion });
      for (const child of nested) {
        if (child.prelude.startsWith("@")) {
          const reduced = inReducedMotion || /prefers-reduced-motion\s*:\s*reduce/.test(child.prelude);
          parseRules(`${child.prelude}{${child.body}}`, reduced, out, selectors[0] ?? parentSelector);
        } else {
          parseRules(`${child.prelude}{${child.body}}`, inReducedMotion, out, selectors[0] ?? parentSelector);
        }
      }
    }
    i = j;
  }
  return out;
}

/** Every custom property declared anywhere in the file. */
export function collectTokens(css) {
  const tokens = new Map();
  // A token redefined under a theme selector (`:root` vs `[data-theme="light"]`)
  // has no single static value. We keep the last, but remember that it is
  // ambiguous so findings that depend on it can be reported as such rather than
  // asserted against one arbitrary theme.
  const ambiguous = new Set();
  for (const m of stripComments(css).matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
    const name = m[1];
    const value = m[2].trim();
    if (tokens.has(name) && tokens.get(name) !== value) ambiguous.add(name);
    tokens.set(name, value);
  }
  tokens.ambiguous = ambiguous;
  return tokens;
}

/**
 * Resolve a CSS colour value to a hex literal using only what this file states.
 * Returns null for anything not statically decidable — computed functions,
 * undefined tokens, keywords, gradients. Null means "say nothing", never "pass".
 */
export function resolveColor(value, tokens, seen = new Set()) {
  if (value == null) return null;
  const v = String(value).trim();
  const direct = normalizeHex(v);
  if (direct) return direct;

  const varMatch = /^var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)$/.exec(v);
  if (varMatch) {
    const name = varMatch[1];
    if (seen.has(name)) return null; // cyclic definition
    seen.add(name);
    if (tokens.has(name)) {
      const resolved = resolveColor(tokens.get(name), tokens, seen);
      if (resolved) return resolved;
    }
    if (varMatch[2] != null) return resolveColor(varMatch[2].trim(), tokens, seen);
  }
  return null;
}

/**
 * True when `ancestor` is the same element or an ancestor/base of `selector`.
 * `.card` bases `.card:hover`, `.card.active`, and `.card h3` — but not `.cards`.
 */
function isAncestorSelector(ancestor, selector) {
  if (ancestor === selector) return true;
  if (!selector.startsWith(ancestor)) return false;
  const next = selector[ancestor.length];
  return next !== undefined && !/[\w-]/.test(next);
}

// ── markup-derived DOM ancestry ──────────────────────────────────────────────
//
// Selector strings alone are not enough. In a real single-file component the
// background sits on `.hero-card` while the text rule is `.hero-meta h3`;
// neither string contains the other. The ancestry that connects them exists only
// in the markup, so we read it from there.

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/**
 * Pull `attr={ ... }`'s contents, honouring nested braces from `${}` interpolation.
 * A regex cannot do this correctly, and getting it wrong silently drops the
 * class that carries the background.
 */
function extractBracedValue(attrs, name) {
  const start = new RegExp(`\\b${name}\\s*=\\s*\\{`).exec(attrs);
  if (!start) return null;
  let depth = 1;
  let i = start.index + start[0].length;
  const from = i;
  while (i < attrs.length && depth > 0) {
    if (attrs[i] === "{") depth++;
    else if (attrs[i] === "}") depth--;
    i++;
  }
  return depth === 0 ? attrs.slice(from, i - 1) : null;
}

/** Elements in the template, each carrying its ancestor chain (nearest first). */
export function parseMarkup(source) {
  // Drop frontmatter, style, and script so their contents can't look like tags.
  const body = source
    .replace(/^---[\s\S]*?---/, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  const elements = [];
  const stack = [];
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
    const [, closing, rawTag, attrs, selfClose] = m;
    const tag = rawTag.toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    // A plain `class="a b"` is exact. A dynamic `class={`a${cond?' b':''}`}` is
    // not, but its *literal* fragments are still real class names — and the
    // leading one is always present, which is usually where the background sits.
    // We recover those and flag the element, because a conditional fragment is
    // treated as present and can pair text against a background that may not
    // apply. That imprecision is a reason this check stays advisory.
    let classes = [];
    let dynamicClasses = false;
    const staticMatch = /\bclass\s*=\s*"([^"{}]*)"/.exec(attrs);
    if (staticMatch) {
      classes = staticMatch[1].split(/\s+/).filter(Boolean);
    } else {
      const expr = extractBracedValue(attrs, "class");
      if (expr !== null) {
        dynamicClasses = true;
        // Drop `${...}` interpolations first. Whatever they contribute is
        // conditional, and treating a conditional class as present would pair
        // text against a background that may not apply. The literal remainder
        // is unconditional, which is the part worth trusting.
        const unconditional = expr.replace(/\$\{[^{}]*\}/g, " ");
        for (const frag of unconditional.matchAll(/[`'"]([^`'"]*)[`'"]/g)) {
          classes.push(...frag[1].split(/\s+/).filter(Boolean));
        }
        classes = [...new Set(classes)];
      }
    }
    const el = { tag, classes, dynamicClasses, ancestors: [...stack].reverse() };
    elements.push(el);
    if (!selfClose && !VOID_TAGS.has(tag)) stack.push(el);
  }
  return elements;
}

/**
 * Parse one compound selector (`.a.b`, `article.card`, `h3:hover`).
 * `unsupported` is set for constructs we cannot evaluate — an id or attribute
 * we have no data for. Those must fail closed: a compound that matched
 * *everything* fabricated contrast failures against unrelated backgrounds.
 */
function parseCompound(part) {
  const base = part.replace(/::?[\w-]+(\([^)]*\))?/g, ""); // drop pseudo-classes/elements
  const classes = [...base.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const tagMatch = /^([a-zA-Z][\w-]*)/.exec(base);
  const tag = tagMatch ? tagMatch[1].toLowerCase() : null;
  const unsupported = /[#[]/.test(base);
  return { tag, classes, unsupported };
}

function compoundMatches(compound, node) {
  if (compound.unsupported) return false;
  if (compound.tag && compound.tag !== node.tag) return false;
  if (!compound.tag && compound.classes.length === 0) return false; // never match-all
  return compound.classes.every((c) => node.classes.includes(c));
}

/**
 * Whether `selector` matches `el`. Supports tag/class/compound selectors joined
 * by descendant or child combinators. Sibling combinators are not supported and
 * return false rather than guessing.
 */
export function matchesSelector(selector, el) {
  if (/[~+]/.test(selector)) return false;
  const parts = selector.split(/\s*>\s*|\s+/).filter(Boolean).map(parseCompound);
  const subject = parts.pop();
  if (!compoundMatches(subject, el)) return false;
  // Remaining compounds must appear in order among the ancestors (nearest first
  // in `el.ancestors`, so walk the requirements from the innermost outwards).
  let idx = 0;
  for (const need of parts.reverse()) {
    let found = false;
    while (idx < el.ancestors.length) {
      if (compoundMatches(need, el.ancestors[idx++])) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

// ── checks ───────────────────────────────────────────────────────────────────

// Foreground properties and the WCAG threshold each is held to.
// `color` is text (1.4.3, AA normal text). Borders and outlines convey UI state
// rather than text, so they answer to 1.4.11's 3:1 instead.
const FOREGROUND = new Map([
  ["color", { threshold: 4.5, criterion: "WCAG 1.4.3 (AA, normal text)" }],
  ["border-color", { threshold: 3, criterion: "WCAG 1.4.11 (non-text contrast)" }],
  ["outline-color", { threshold: 3, criterion: "WCAG 1.4.11 (non-text contrast)" }],
]);

/**
 * Ancestor-scoped contrast pairs within a single file.
 *
 * The pairing rule is the whole point: pairing only co-declared properties on
 * one selector finds roughly 1/35th of the real pairs, which is how an earlier
 * measurement wrongly concluded this check had no yield (ADR-0013 § 6).
 */
export function findContrastFindings(css, elements = null) {
  const clean = stripComments(css);
  const tokens = collectTokens(clean);
  const rules = parseRules(clean);

  const backgrounds = [];
  for (const rule of rules) {
    const raw = rule.decls.get("background-color") ?? rule.decls.get("background");
    const bg = resolveColor(raw, tokens);
    if (bg) backgrounds.push({ selector: rule.selector, bg });
  }

  const findings = [];
  const seen = new Set();
  const usesAmbiguous = (raw) =>
    [...(tokens.ambiguous ?? [])].some((name) => String(raw ?? "").includes(name));

  const record = (f) => {
    const key = `${f.selector}|${f.property}`;
    if (seen.has(key)) return; // one verdict per rule+property, never two
    seen.add(key);
    findings.push(f);
  };
  const make = (selector, prop, fg, bg, bgSelector, extra = {}) => {
    const { threshold, criterion } = FOREGROUND.get(prop);
    const ratio = contrastRatio(fg, bg);
    return {
      selector, property: prop, fg, bg, bgSelector, ratio, threshold, criterion,
      passes: ratio >= threshold, ...extra,
    };
  };

  // Preferred path: real DOM ancestry from the markup. When it is available it is
  // authoritative — the selector-string fallback below must not also report, or a
  // single element gets two contradictory verdicts.
  const haveMarkup = Boolean(elements && elements.length > 0);
  if (haveMarkup) {
    for (const el of elements) {
      // Nearest background wins; within one element, the LAST declaration wins,
      // because that is what the cascade does.
      let bg = null;
      let bgSelector = null;
      let viaDynamicClass = false;
      for (const node of [el, ...el.ancestors]) {
        for (const cand of backgrounds) {
          if (matchesSelector(cand.selector, node)) {
            bg = cand.bg;
            bgSelector = cand.selector;
            viaDynamicClass = Boolean(node.dynamicClasses);
          }
        }
        if (bg) break;
      }
      if (!bg) continue;
      for (const rule of rules) {
        if (!matchesSelector(rule.selector, el)) continue;
        for (const prop of FOREGROUND.keys()) {
          const raw = rule.decls.get(prop);
          const fg = resolveColor(raw, tokens);
          if (!fg) continue;
          record(make(rule.selector, prop, fg, bg, bgSelector, {
            viaDynamicClass,
            ambiguousToken: usesAmbiguous(raw) || usesAmbiguous(bgSelector),
          }));
        }
      }
    }
    return findings;
  }

  // The only path for a bare stylesheet with no markup: pair on selector-string
  // ancestry (`.card` bases `.card h3` and `.card:hover`).
  for (const rule of rules) {
    for (const prop of FOREGROUND.keys()) {
      const raw = rule.decls.get(prop);
      const fg = resolveColor(raw, tokens);
      if (!fg) continue;
      let best = null;
      for (const cand of backgrounds) {
        if (!isAncestorSelector(cand.selector, rule.selector)) continue;
        // Longest selector is the specificity proxy; on a tie the later
        // declaration wins, per the cascade.
        if (!best || cand.selector.length >= best.selector.length) best = cand;
      }
      if (best) {
        record(make(rule.selector, prop, fg, best.bg, best.selector, {
          ambiguousToken: usesAmbiguous(raw),
        }));
      }
    }
  }
  return findings;
}

// Properties that move things. WCAG SC 2.3.3's note explicitly excludes changes
// of colour and opacity from "motion animation", so paint transitions
// (background, border-color, box-shadow) are NOT motion and flagging them would
// be a false positive.
const MOTION_PROPS = ["transform", "translate", "rotate", "scale", "animation", "perspective"];

/** Motion declarations, plus whether the file has any reduced-motion block. */
export function findMotionFindings(css) {
  const clean = stripComments(css);
  const rules = parseRules(clean);
  const hasReducedMotionBlock = /@media[^{]*prefers-reduced-motion\s*:\s*reduce/.test(clean);

  const motion = [];
  for (const rule of rules) {
    if (rule.inReducedMotion) continue; // the mitigation itself isn't a finding
    for (const [prop, value] of rule.decls) {
      if (MOTION_PROPS.includes(prop)) {
        motion.push({ selector: rule.selector, property: prop, value });
        continue;
      }
      if (prop === "transition") {
        // Each comma-separated part names the property it transitions.
        for (const part of value.split(",")) {
          const named = part.trim().split(/\s+/)[0]?.toLowerCase();
          if (MOTION_PROPS.includes(named)) {
            motion.push({ selector: rule.selector, property: named, value: part.trim() });
          }
        }
      }
    }
  }
  return { motion, hasReducedMotionBlock };
}

/** A .css file is CSS; an .astro/.vue/.svelte file is CSS only inside <style>. */
export function extractCss(source, filename) {
  if (/\.css$/i.test(filename)) return source;
  const blocks = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  return blocks.join("\n");
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function main(argv) {
  const strict = argv.includes("--strict");
  const files = argv.filter((a) => !a.startsWith("--"));
  if (files.length === 0) {
    console.error("usage: node scripts/check-css-contrast-motion.mjs [--strict] <file...>");
    console.error("       advisory by default; --strict exits 1 on findings");
    return 2;
  }

  let failures = 0;
  let pairsChecked = 0;
  let readable = 0;
  const unreadable = [];

  for (const file of files) {
    let css;
    let elements = null;
    try {
      const source = readFileSync(file, "utf8");
      css = extractCss(source, file);
      // A single-file component carries its own DOM ancestry; a bare .css does not.
      if (!/\.css$/i.test(file)) elements = parseMarkup(source);
    } catch {
      unreadable.push(file);
      continue;
    }
    readable++;
    if (!css.trim()) continue;

    const contrast = findContrastFindings(css, elements);
    const { motion, hasReducedMotionBlock } = findMotionFindings(css);
    pairsChecked += contrast.length;

    const bad = contrast.filter((f) => !f.passes);
    const motionUncovered = hasReducedMotionBlock ? [] : motion;
    if (bad.length === 0 && motionUncovered.length === 0) continue;

    console.log(`\n${file}`);
    for (const f of bad) {
      failures++;
      console.log(
        `  contrast  ${f.ratio.toFixed(2)}:1 < ${f.threshold}:1  ${f.selector} { ${f.property}: ${f.fg} } on ${f.bg} (from ${f.bgSelector})`
      );
      console.log(`            ${f.criterion}`);
    }
    if (motionUncovered.length > 0) {
      failures++;
      console.log(`  motion    ${motionUncovered.length} motion declaration(s), no @media (prefers-reduced-motion: reduce) in this file`);
      for (const m of motionUncovered.slice(0, 5)) {
        console.log(`            ${m.selector} { ${m.property} }`);
      }
    }
  }

  // "0 findings" over zero readable files is a false green, and an unexpanded
  // glob (no `globstar`) arrives here as a literal path that does not exist.
  // Refuse to summarise that as a pass.
  if (readable === 0) {
    console.log(`\nno readable input: ${unreadable.length} path(s) could not be read.`);
    for (const f of unreadable.slice(0, 5)) console.log(`  ! ${f}`);
    console.log("nothing was checked — this is not a pass. Check the paths (an unexpanded glob lands here).");
    return 2;
  }
  for (const f of unreadable) console.log(`  ! unreadable, skipped: ${f}`);

  console.log(
    `\ncss contrast+motion: ${failures} finding(s) across ${readable} readable file(s); ${pairsChecked} contrast pair(s) statically resolved.`
  );
  console.log(
    "advisory — a static check cannot see alt text, labels, keyboard paths, landmarks, or heading order. Silence here is not a pass."
  );
  return strict && failures > 0 ? 1 : 0;
}

// `import.meta.url` is percent-encoded and `process.argv[1]` is not, so comparing
// them directly makes the script a silent no-op — exit 0, no output — whenever its
// own path contains a space or a non-ASCII character. Summon scaffolds into
// arbitrary user directories, so that is a false green waiting to happen.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
