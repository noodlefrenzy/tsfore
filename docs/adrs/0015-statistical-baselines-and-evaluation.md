---
agent-notes: { ctx: "ADR: statsforecast baselines, bundled finance data, relative-score evaluation", deps: [docs/adrs/template.md, docs/adrs/0014-python-forecasting-harness-stack.md, docs/adrs/0010-dependency-release-age-cooldown.md, src/tsfore/evaluate.py, src/tsfore/datasets.py], state: active, last: "claude@2026-10-18" }
---

# ADR-0015: Statistical Baselines, Finance Data and Relative-Score Evaluation

## Status

Accepted (2026-10-18). Ratified by the human. Proposed 2026-10-17.

## Context

To judge Timestral we need three things it can be measured against: classical models that a skeptic would accept as reasonable, real data rather than synthetic sines, and an aggregate score that doesn't let one large-scale series dominate. The human asked for financial data and "a simpler forecasting library (maybe sktime or something)".

Network constraints at build time: FRED, Yahoo, Stooq and the other market-data APIs are unreachable from the build environment, while `raw.githubusercontent.com` is reachable.

## Decision

1. **statsforecast (Nixtla) over sktime.** statsforecast's AutoETS, AutoARIMA and AutoTheta are the exact reference baselines GIFT-Eval and fev-bench report, so our relative scores line up with Timestral's published ones. Each model exposes `forecast(y, h, level)` on a plain array, which keeps the adapter to about 40 lines. sktime would give a larger, more uniform API, but here it would mostly wrap these same models under a heavier dependency surface. Adapter: `tsfore.forecasters.statistical.StatsForecastModel`, with the 20/40/60/80% intervals mapped exactly onto the deciles.
2. **History cap of 1024 points** (`max_context`) for statistical fits. AutoARIMA on 9,000 daily points is slow and old regimes rarely help. Timestral keeps its own 32k-step context, so the comparison favours each model's natural use.
3. **Bundled finance suite.** Eleven series from `github.com/datasets/*` (ODC-PDDL, public domain), pinned by commit SHA in `tsfore.datasets`. They cover equity index level and log returns, a 10-year yield, CPI, gold, VIX, WTI, Brent, natural gas, EUR and JPY. Cleaned `date,value` snapshots (about 1 MB) are committed under `data/finance/`, so tests and benchmarks run offline and reproducibly. `tsfore data fetch` regenerates them from the pinned SHAs.
4. **Evaluation:**
   - Rolling-origin windows at the series end.
   - Per-series means of MASE and WQL, divided by a baseline's.
   - **Geometric mean of the ratios** across series (the GIFT-Eval aggregation), plus average rank, mean 80% coverage, mean **directional accuracy** and runtime.
   - A failing model records NaN and an error per window; it never aborts the run.
   - Default baseline is **`naive` (random walk)**, the standard benchmark for asset prices and rates. Seasonal naive stays available through `--baseline`.

## Consequences

### Positive

- `tsfore bench --suite finance` gives a leaderboard and a Markdown report in a few minutes on a laptop CPU.
- Any new model (Timestral sizes included) drops into the same suite and scoring.

### Negative

- statsforecast pulls numba, scipy, statsmodels, pyarrow and fugue. That is heavy for "simple", though still lighter than torch.
- MASE on long nominal price series (S&P 500 since 1871) is inflated, because the in-sample scale is dominated by tiny early values. Ratios between models remain valid; absolute MASE there is not meaningful.
- Three to six windows at the series end is a small, regime-specific sample. Treat differences of a few percent as noise.
- Snapshots go stale. Refreshing means bumping SHAs deliberately and re-committing.

### Neutral

- Prices are forecast in levels. Transforms (log, returns) are dataset-level choices, and only `sp500_monthly_logret` is defined so far.

## Update 2026-10-18: S&P 500 and VIX are no longer committed

Decision §3 calls all eleven series ODC-PDDL public domain. That label comes from datahub.
For two of the series, the original sources' terms say otherwise. S&P Dow Jones Indices
prohibits reproducing S&P 500 levels without its written permission (FRED's SP500 notice),
and Cboe's site terms require its prior written consent to redistribute VIX data. So
`sp500_monthly` (and its derived `_logret`) and `vix_daily` are now `bundled=False`. They are
gitignored, and `load()` fetches them on first use from the same pinned commits. The suite,
the windows and the scores are unchanged. A fetch reproduces the earlier snapshots
byte-for-byte. Source terms per series: `data/finance/README.md`. (VERIFIED from source
pages, 2026-10-18.)
