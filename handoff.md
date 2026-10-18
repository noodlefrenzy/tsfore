---
agent-notes: { ctx: "session handoff: state of tsfore after the 2026-10-18 desktop session", deps: [CLAUDE.md, docs/code-map.md, docs/benchmarks/finance-48w-2026-10-18.md, docs/benchmarks/pairs-36w-2026-10-18.md, DESIGN.md, PRODUCT.md], state: active, last: "claude@2026-10-18", key: ["committed at the repo root on purpose: .claude/handoff.md is gitignored", "fresh session: cp handoff.md .claude/handoff.md, then /resume"] }
---

# Session Handoff

**Updated:** 2026-10-18 (desktop session, WSL2 + RTX 4090)
**Branch:** `claude/summon-timestral-harness`, pushed and in sync with origin. **No PR opened.**
**Sprint / board:** none. tsfore has no GitHub Project; Summon's per-item board flow has not been used.

## Starting a fresh session

```bash
git checkout claude/summon-timestral-harness && git pull
cp handoff.md .claude/handoff.md      # /resume reads .claude/handoff.md (gitignored)
uv sync --all-extras                   # torch 2.14.1+cu130, timestral @a534bdb, chronos-forecasting 2.3.2
uv run pytest                          # expect 92 passed, 6 deselected
uv run pytest -m weights               # real-checkpoint tests; needs the HF cache or network
python -m http.server -d site          # preview the results site at http://127.0.0.1:8000
```

Read `docs/code-map.md` first. Keep the repo on the Linux filesystem, not `/mnt/c`.

## What exists

- **Harness** (`src/tsfore/`):
  - Models: rolling-origin backtest over naive, statsforecast (ETS, ARIMA, Theta, historic average), Timestral (5M/28M/123M/209M) and Chronos-2 (small/base).
  - Companion series via `+cov` and `+joint` model names (ADR-0016).
  - All windows of a series go to the GPU in one batched call, with a per-window fallback. Weights load once, before timing.
  - CLI: `tsfore run | bench | data`.
- **ADRs 0014, 0015 and 0016 are Accepted** (ratified 2026-10-18). ADR-0011 (Summon's own scanner ADR, inherited) is still Proposed and was deliberately left alone.
- **Benchmarks:** these two are current. Older reports carry dated per-claim update or correction notes.
  - `docs/benchmarks/finance-48w-2026-10-18.md`: 11 series × 48 windows.
  - `docs/benchmarks/pairs-36w-2026-10-18.md`: 6 pairs × 36 windows. Not 48, because the S&P 500 + VIX pairs only fit 36 yearly windows.
  - Raw per-window CSVs are committed gzipped in `docs/benchmarks/data/`.
- **Results site** (`site/`): a static market-terminal page for GitHub Pages. It covers:
  - the three model families, with where each wins and loses;
  - a quote board of every model on every series;
  - paired Wilcoxon tests;
  - companion results;
  - the 6→48-window corrections;
  - future tests, and the method.

  `scripts/build_site_data.py` rebuilds `site/data.js` from the committed CSVs using `tsfore.evaluate.leaderboard`, and `tests/test_site_data.py` pins that match. Design records:
  - `PRODUCT.md` and `DESIGN.md` at the repo root;
  - `.impeccable/design.json`, plus the two direction-round records (seed keys df8914cf → re-rolled → 982665b6, "Market Terminal").

  The impeccable finish review's final disposition was **ship**.

## Key results (48 windows, finance)

- Timestral leads: rel_MASE 0.848 (123M), against 0.890 for Chronos-2 and 0.893 for AutoETS. Its rel_WQL is 0.750.
- 28M, 123M and 209M are indistinguishable (p = 0.35). 5M is worse (p = 5e-4).
- Timestral's **point** lead over AutoETS is mostly natural gas. Without it they tie (0.876 vs 0.881), with window-level p = 0.12. The **WQL** lead survives without natgas (0.789 vs 0.821).
- Chronos-2 loses 3–5% to the random walk on Brent, WTI and EUR, which is most of its gap. It is best on the 10-year yield (0.944).
- Calibration: Timestral 0.81 (best). AutoETS over-covers (0.84) and Chronos-2 under-covers (0.78).
- Companions: only Chronos-2-small+cov helps (p = 0.017 on 216 windows; about 0.10 after Bonferroni).
- **Leakage caveat:** the monthly windows reach back to 1978, which is likely in both models' pretraining data.

## What to do next (in order)

1. **Merge or open a PR** for this branch. The site links to `main` (`docs/benchmarks/...`), so those links are dead until the merge. Run `/code-review` and the done gate first if following Summon process.
2. **GitHub Pages:** add a deploy workflow that serves `site/` (Actions: upload-pages-artifact plus deploy-pages, versions pinned per the 3-day cooldown). Then enable Pages in the repo settings.
3. **Pick a license** before going public. The site and README state none.
4. **Leakage-free evaluation** (P1 on the site): score only windows after each model's training cutoff, or start prospective forecasts now.
5. **Leave finance** (P1): GIFT-Eval or fev-bench subsets with real seasonality.
6. Then the site's P2 list: error by horizon step, known-future covariates (FOMC/OPEC/CPI release dates), calibration at 50/90/98% plus PIT, and returns for every series with a `historic_average` baseline.
7. Housekeeping:
   - Add CI (ruff and pytest).
   - Investigate why Timestral-5M is slower per window than 28M when batched.
   - Consolidate the site's font-size steps: the impeccable detector reports 18 advisory "off the DESIGN.md ramp" findings.

## Pending human decisions

- License (above).
- Whether to ratify ADR-0011 (inherited from Summon; it commits to building a dependency scanner).
- **impeccable update:** v4.6.0 (published 2026-10-15 22:22 UTC) was inside the 3-day cooldown on 2026-10-18. It is eligible after 2026-10-18 22:22 UTC: run `npx impeccable update` from `design-notes/`. The npm package is a shim that downloads a separate engine, so pinning an older version via npx isn't verifiable.

## Key context

- **Cooldown:** `[tool.uv] exclude-newer = "2026-10-14"` gates PyPI. Timestral is a git dependency pinned at `a534bdb` (override approved 2026-10-17, see `docs/dependency-decisions.md`).
- **Chronos-2 `+cov` and `+joint` are the same computation** at inference, so `+joint` is omitted from benchmarks.
- **AutoARIMA dominates wall clock:** the 48-window finance run took about 31 minutes, almost all of it ARIMA on the CPU. Foundation models are milliseconds per window, batched.
- **`results/` is gitignored.** To publish a new run, gzip its CSV into `docs/benchmarks/data/`, point `build()` in `scripts/build_site_data.py` at it, and rerun the script.
- **`.gitignore`:** the Python template's `/site` rule (mkdocs) was removed because it hid the site. `.impeccable/shots/`, `.impeccable/questions/` and `.playwright-mcp/` are ignored local scratch.
- **impeccable** is installed in `design-notes/.claude/skills/impeccable/`, not in tsfore. Run its scripts with cwd at tsfore.
- **Summon fixes made locally** (worth upstreaming): repointed role SKILL paths, `team/checks.json` rebound to uv/pytest/ruff, and restored the CLAUDE.md Description and Tech Stack lines.
