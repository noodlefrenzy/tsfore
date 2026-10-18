---
agent-notes: { ctx: "low-ceremony project conventions, positive rules", deps: [CLAUDE.md, docs/process/gotchas.md, docs/adrs/0010-dependency-release-age-cooldown.md], state: active, last: "claude@2026-08-04" }
---

# Team Directives

Lightweight conventions the team has settled on. These are **positive rules** — "always X" / "prefer Y over Z" — that don't rise to the level of an ADR but are too important to forget between sessions.

**How this differs from `gotchas.md`:** Gotchas document failure modes and anti-patterns (defensive). Directives document agreed conventions and standards (prescriptive). Gotchas say "don't touch the stove." Directives say "we cook with gas, not electric."

**How this differs from ADRs:** ADRs document significant architectural decisions with context, alternatives, and consequences. Directives are small, low-ceremony rules that accumulate organically. If a directive grows complex enough to need "Alternatives Considered," promote it to an ADR.

## How to Add Directives

Any agent can add a directive to their section during normal work. The format is:

```
- **Directive name.** One-sentence rule. _Why:_ brief rationale.
```

Add directives when:
- The team settles on a convention during code review
- Sato discovers a pattern that should be consistent across the codebase
- Tara establishes a testing convention
- Archie makes a small structural decision that doesn't warrant an ADR
- The human explicitly states a preference

## Code Style (Sato)

<!-- Sato: add coding conventions here as you establish them.
     Examples: "Always use single quotes", "Prefer composition over inheritance", "API responses use camelCase", "Error messages include the failing value" -->

## Testing Conventions (Tara)

<!-- Tara: add testing conventions here as you establish them.
     Examples: "Integration tests hit the real database, never mocks", "Test names follow given_when_then format", "Fixtures go in tests/fixtures/, never inline" -->

## API & Interface Conventions (Archie)

- **Sequence a wide refactor as expand → migrate → contract, not as a vertical slice.** _Why:_ vertical slicing assumes a narrow change through many layers; a wide refactor is the inverse — one layer across many call sites — and forcing it into a tracer bullet guarantees a red build with no safe stopping point. Mechanics (batch sizing, blocking edges, the integration-branch fallback): `docs/process/gotchas.md` § Wide refactors. (Adapted from `to-tickets`, [mattpocock/skills](https://github.com/mattpocock/skills), MIT © 2026 Matt Pocock.)

<!-- Archie: add API design conventions here.
     Examples: "All CLI commands support --json output", "Config files use TOML, not YAML", "Public functions have docstrings, private don't" -->

## Documentation Conventions (Diego)

- **Don't hard-wrap Markdown prose.** Write one logical line per paragraph and let the editor and renderer soft-wrap it; never insert manual newlines to hit a column width. Lists, tables, code fences, and frontmatter keep their own line structure. _Why:_ hard wraps make diffs lie — a three-word edit reflows the whole paragraph, so `git blame` and PR diffs show lines changed that weren't. Soft-wrapped prose diffs at the sentence, not the column.
- **Prune agent-facing prose against the no-op test, on files you're already editing.** When you touch an agent or command file, check each sentence in isolation: does it change behavior versus what the model would do by default? If not, delete the whole sentence rather than trimming words from it. Prefer stating the target behavior over prohibiting the wrong one — naming a banned behavior makes it *more* available to the model, not less, so keep a prohibition only where no positive phrasing exists, and always name the behaviour you want alongside it. _Why:_ agent prose is Summon's actual shipped artifact, and lines that restate the default cost tokens and attention while changing nothing. Applies opportunistically — this is an editing standard, not a licence to open a repo-wide rewrite. (Adapted from `writing-great-skills`, [mattpocock/skills](https://github.com/mattpocock/skills), MIT © 2026 Matt Pocock.)

<!-- Diego: add documentation conventions here.
     Examples: "README quick-start must work in under 5 minutes", "Changelog entries use past tense", "API docs include a curl example for every endpoint" -->

## Security Conventions (Pierrot)

- **Age external dependencies before adopting them.** A newly added or upgraded direct dependency must be a version at least 3 days old, unless the human overrides (log the reason in `dependency-decisions.md`); prefer native enforcement (pnpm/Bun `minimumReleaseAge`). _Why:_ most compromised releases are caught and yanked within days — a cooldown means you're rarely first to install a poisoned one. Full reasoning, the CVE-override rule, and the window tiers: ADR-0010.
- **Vet and pin MCP servers like any other dependency.** Before adding an MCP server, review who publishes it and what access it grants (files, network, credentials); pin its version; keep approved servers on an allowlist rather than wiring in open-ended ones; and watch for rug-pulls — a trusted server changing behavior or tool schemas after you've adopted it. _Why:_ an MCP server is unvetted third-party code that hands your agent new powers, and it's a fast-growing, largely-unpinned tool-supply surface — cheap to gate now, expensive to retrofit after an incident.

<!-- Pierrot: add security conventions here.
     Examples: "Never log PII, even at debug level", "All user input validated at the boundary", "Secrets come from env vars, never config files" -->

## DevOps & Infrastructure (Ines)

- **Pin CI actions to immutable commit SHAs, not tags.** Reference every third-party GitHub Action (or equivalent CI plugin) by its full-length commit SHA with the human-readable version in a trailing comment (`uses: actions/checkout@<40-char-sha> # v4`), never by a mutable tag or branch. Keep the lockfile committed and matching the manifest. _Why:_ a tag like `v4` can be silently repointed by whoever controls the action, swapping in code you never reviewed — a live supply-chain vector — whereas a SHA can't move under you, and a committed lockfile makes any dependency change visible in the diff instead of resolving invisibly at build time.

<!-- Ines: add infra conventions here.
     Examples: "CI must pass before merge, no exceptions", "Docker images use distroless base", "All env vars documented in .env.example" -->

## Design & UX (Dani)

- **Team hero sprites live as `site/src/assets/team/<slug>.webp`.** Generated externally per the team hero-sprite art bible, exported to WebP at display sizes, and dropped into the assets folder; `TeamGrid.astro` renders a placeholder until each one lands. _Why:_ keeps generated binaries out of the build path and the page green before the art exists. (Convention, not an ADR — no alternatives analysis needed.)
- **Accent text on a fixed-dark panel must clear WCAG AA (4.5:1).** Lift dark brand accents with `color-mix(in srgb, var(--accent), white 42%)` rather than hand-picking lighter hexes. _Why:_ keeps the palette anchored to the bible while staying legible.

<!-- Dani: add more design conventions here.
     Examples: "All interactive elements have focus indicators", "Color is never the only differentiator" -->
