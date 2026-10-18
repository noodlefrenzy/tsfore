---
agent-notes: { ctx: "session handoff: clean slate after going public on main", deps: [CLAUDE.md, docs/code-map.md, docs/taking-repo-public.md, docs/benchmarks/finance-48w-2026-10-18.md, docs/benchmarks/pairs-36w-2026-10-18.md], state: active, last: "claude@2026-10-18", key: ["committed at the repo root on purpose: .claude/handoff.md is gitignored", "fresh session: cp handoff.md .claude/handoff.md, then /resume"] }
---

# Session Handoff

**Created:** 2026-10-18
**Sprint / board:** none. tsfore has no GitHub Project, and Summon's per-item board flow is unused.
**Session summary:** the repo has been through the go-public pass, recorded in `docs/taking-repo-public.md`:
- MIT license and third-party notices added;
- S&P 500 and VIX snapshots are no longer committed;
- the long-running branch was squash-merged into `main` and deleted;
- the results site is on GitHub Pages.

This is a clean slate: no work is in flight.

## Current State

- **Visibility:** public (2026-10-18). The license is detected as MIT.
- **Branches:** `main` (source) and `gh-pages` (the contents of `site/` only, the Pages source).
- **History:** the initial commit, the squash, then docs-only commits.
- **Uncommitted changes:** none.
- **Open PRs:** none, and none were ever opened.
- **Tests:** `uv run pytest` gives 103 passed and 6 deselected (`-m weights`). On a fresh clone, 7 S&P/VIX tests skip until `uv run tsfore data fetch` runs. Ruff is clean.
- **Results site:** https://noodlefrenzy.com/tsfore/, served from `gh-pages` (verified live on 2026-10-18). Its links point at `main` (`docs/benchmarks/...`, `LICENSE`, `NOTICE.md`).

## Starting a fresh session

```bash
git checkout main && git pull
cp handoff.md .claude/handoff.md      # /resume reads .claude/handoff.md (gitignored)
uv sync --all-extras                   # torch 2.14.1+cu130, timestral @a534bdb, chronos-forecasting 2.3.2
uv run tsfore data fetch               # optional: pulls the S&P 500 / VIX snapshots (not committed)
uv run pytest                          # 103 passed, 6 deselected (with the fetch)
python -m http.server -d site          # local preview of the results site
```

Read `docs/code-map.md` first. Keep the repo on the Linux filesystem, not `/mnt/c`.

## What exists

- **Harness** (`src/tsfore/`):
  - Rolling-origin backtests over:
    - naive;
    - statsforecast: ETS, ARIMA, Theta and historic average;
    - Timestral: 5M, 28M, 123M and 209M;
    - Chronos-2: small and base.
  - `+cov` and `+joint` companion series (ADR-0016).
  - Batched GPU calls with a per-window fallback.
  - CLI: `tsfore run | bench | data`.
- **Data:** 11 finance series pinned to datahub commits.
  - Eight are committed in `data/finance/`.
  - `sp500_monthly` (with its derived `_logret`) and `vix_daily` are `bundled=False`. They are gitignored, and `load()` fetches them on first use, because S&P DJI and Cboe forbid redistribution.
  - Each series' source terms are in `data/finance/README.md`.
- **Benchmarks:** these two are current. Raw per-window CSVs are gzipped in `docs/benchmarks/data/`.
  - `docs/benchmarks/finance-48w-2026-10-18.md`: 11 series × 48 windows.
  - `docs/benchmarks/pairs-36w-2026-10-18.md`: 6 pairs × 36 windows.
- **Licensing:**
  - `LICENSE` is MIT, Copyright (c) 2026 Michael Lanzetta.
  - `NOTICE.md` lists Summon (MIT), mattpocock/skills, the OFL fonts, the Timestral weights and Chronos-2 (Apache-2.0). The weights are Modified MIT, which withholds every right from companies with more than $20M monthly revenue. They are downloaded, never redistributed.
- **ADRs:** 0014, 0015 and 0016 are Accepted. 0015 carries a 2026-10-18 update note on the data change. 0011 (inherited from Summon) is still Proposed.

## Key results (48 windows, finance)

- **Point accuracy (rel_MASE):** Timestral-123M 0.848, Chronos-2 0.890, AutoETS 0.893. Timestral's rel_WQL is 0.750.
- **Model size:** 28M, 123M and 209M are indistinguishable (p = 0.35). 5M is worse (p = 5e-4).
- **The natural-gas effect:** Timestral's point lead over AutoETS is mostly natural gas. Without it they tie (0.876 vs 0.881). The WQL lead survives without it (0.789 vs 0.821).
- **Calibration (80% interval):** Timestral 0.81 is best. AutoETS over-covers at 0.84 and Chronos-2 under-covers at 0.78.
- **Companions:** only Chronos-2-small+cov helps, at p = 0.017 (about 0.10 after Bonferroni).
- **Leakage caveat:** the monthly windows reach back to 1978, which is likely in the pretraining data.

## What To Do Next (in order)

1. **Finish the go-public leftovers** in `docs/taking-repo-public.md`. Most are `MEATPUPPET:` items for the owner:
   - confirm the copyright name;
   - decide on `handoff.md` staying public;
   - security settings: secret scanning, push protection, Dependabot alerts and private vulnerability reporting;
   - branch protection on `main`;
   - the repo description and topics;
   - optionally gitleaks, plus GitHub Support GC of the old unreachable commits.
2. **Add CI**: `.github/workflows/` running ruff and pytest. Pin actions by SHA, with releases older than 3 days (ADR-0010).
3. **Leakage-free evaluation** (P1 on the site): score only windows after each model's training cutoff, or start prospective forecasts now.
4. **Leave finance** (P1): GIFT-Eval or fev-bench subsets with real seasonality.
5. **Then the site's P2 list:**
   - error by horizon step;
   - known-future covariates (FOMC, OPEC and CPI release dates);
   - calibration at 50/90/98% plus PIT;
   - returns for every series against a `historic_average` baseline.
6. **Housekeeping:**
   - find out why Timestral-5M is slower per window than 28M when batched;
   - consolidate the site's font-size steps (impeccable reports 18 "off the DESIGN.md ramp" findings).

## Pending human decisions

- Whether to ratify ADR-0011. It is inherited from Summon and commits to building a dependency scanner.
- **impeccable update:** v4.6.0 is eligible after 2026-10-18 22:22 UTC. Run `npx impeccable update` from `design-notes/`.

## Key context

- **Cooldown:** `[tool.uv] exclude-newer = "2026-10-14"` gates PyPI. Timestral is a git dependency pinned at `a534bdb` (override approved 2026-10-17, see `docs/dependency-decisions.md`).
- **Local backup tag:** `backup/summon-timestral-harness-2026-10-18` (local only) holds the pre-squash branch, *including the restricted CSVs*.
  - Never `git push --tags`.
  - Delete it with `git tag -d` once satisfied.
  - Any new restricted series should get `bundled=False` and an entry in `.gitignore`.
- **Publishing a new run:** `results/` is gitignored.
  1. Gzip the run's CSV into `docs/benchmarks/data/`.
  2. Point `build()` in `scripts/build_site_data.py` at it.
  3. Rerun the script (`tests/test_site_data.py` pins the match).
- **Refreshing the site:** after committing changes to `site/` on `main`, run
  `git subtree split --prefix site -b gh-pages-new && git push -f origin gh-pages-new:gh-pages && git branch -D gh-pages-new`
  (or replace this with a Pages Actions workflow).
- **AutoARIMA dominates wall clock:** about 31 minutes for the 48-window finance run, almost all of it on the CPU.
- **Chronos-2 `+cov` and `+joint`** are the same computation at inference, so benchmarks omit `+joint`.
- **Example ADR:** `docs/adrs/0008-example-*` is Summon's labelled fictional example. Keep it, because `scripts/check-canon.mjs` enforces contiguous ADR numbering.
- **Planted fake key:** the `sk-live-…` string in `team/fixtures/negative-control/planted.diff` is fake on purpose. Secret scanners will flag it.
- **impeccable** lives in `design-notes/.claude/skills/impeccable/`. Run its scripts with tsfore as the cwd.
