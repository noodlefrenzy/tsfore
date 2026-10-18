---
agent-notes:
  ctx: "codebase structural overview for humans and agents"
  deps: [src/tsfore/backtest.py, src/tsfore/forecasters/__init__.py]
  state: active
  last: "claude@2026-10-18"
  key: ["UPDATE when adding packages, modules, or changing public APIs"]
---
# Code Map

Structural overview of the codebase. Read this at the start of every session instead of exploring from scratch, and keep it current when modules or public APIs change.

## Architecture at a Glance

```
datasets (data/finance snapshots) ─┐
CSV / synthetic ───────────────────┴▶ data.Series ──▶ backtest.backtest(series, models, horizon, n_windows)
                                         │  for each window: model.forecast(context, h)
                                         ▼
                     forecasters/  ──▶ QuantileForecast (H × EVAL_LEVELS)
                                         │
                                         ▼
                     metrics (mae, rmse, smape, mase, wql, coverage, direction) ──▶ summarize() ──▶ cli table / CSV

evaluate.run_suite(series list, model factory) ──▶ long results ──▶ leaderboard() / report_markdown()
```

## Dependency Graph

```
forecasters/base ── (numpy only; Forecaster protocol, QuantileForecast, EVAL_LEVELS)
  ├── forecasters/baselines ── Naive, SeasonalNaive
  ├── forecasters/statistical ── StatsForecastModel (lazy import of statsforecast)
  ├── forecasters/timestral ── TimestralAdapter (lazy import of timestral + torch)
  └── forecasters/chronos ──── ChronosAdapter (lazy import of chronos + torch)
metrics ── (numpy only)
data ── (numpy, pandas)
datasets ── data (pinned github.com/datasets sources → data/finance/*.csv)
backtest ── data, metrics, forecasters/base
evaluate ── backtest, data
multivariate ── forecasters/base (adapters provide forecast_multi)
cli ── backtest, evaluate, datasets, data, forecasters.build
```

## Package / Module Summaries

| Module | Public API | Notes |
|---|---|---|
| `tsfore.data` | `Series(name, values, season_length, dates, horizon, companions, companion_names)`, `load_csv`, `synthetic`, `SYNTHETIC_KINDS` | Univariate target; optional `(C, N)` companions (ADR-0016). |
| `tsfore.datasets` | `FINANCE`, `SUITES`, `PAIRS`, `DatasetSpec`, `load`, `load_pair`, `load_suite`, `fetch`, `clean` | 11 finance series; snapshots in `data/finance/` (S&P 500 and VIX are `bundled=False`: gitignored, fetched by `load()` on first use). The `pairs` suite inner-joins each target with its companions. |
| `tsfore.forecasters.statistical` | `StatsForecastModel(kind, season_length, max_context=1024)`, `KINDS` | auto_ets, auto_arima, auto_theta, rw_drift, historic_average. |
| `tsfore.evaluate` | `run_suite`, `leaderboard(results, baseline="naive")`, `report_markdown` | Geometric mean of per-series ratios to the baseline. |
| `tsfore.forecasters` | `Forecaster`, `QuantileForecast`, `EVAL_LEVELS`, `Naive`, `SeasonalNaive`, `build(spec, season_length)` | Every model returns the decile levels. |
| `tsfore.forecasters.timestral` | `TimestralAdapter(repo_id, device, local_files_only)`, `.from_forecaster()`, `.load()`, `.forecast_batch()` | Interpolates Timestral's 21 levels onto the deciles. |
| `tsfore.forecasters.chronos` | `ChronosAdapter(repo_id, device, local_files_only)`, `.from_pipeline()`, `.load()`, `.forecast_batch()`, `CHECKPOINTS` | Requests the deciles directly and sorts them, because Chronos-2 can emit crossed quantiles. |
| `tsfore.multivariate` | `WithCompanions(adapter, mode)`, `MODES` | `+cov` or `+joint` wrapper; the backtest passes it companions cut at the same point as the target context. |
| `tsfore.metrics` | `mae`, `rmse`, `smape`, `mase`, `wql`, `coverage`, `directional_accuracy` | `mase` and `wql` raise `ValueError` when undefined; backtest records NaN. |
| `tsfore.backtest` | `backtest(...) -> DataFrame`, `summarize(df)`, `SCORES` | Back-to-back windows ending at the series end; a raising model yields NaN plus `error`. Models with `uses_companions` also get `companions[:, :cutoff]`. Models with `forecast_batch` get every window of a series in one call; `load()` runs before timing. |
| `tsfore.cli` | `main(argv)`: `run`, `bench`, `data list/fetch` | |

## Results site

`site/` is a static, build-free page for GitHub Pages (market-terminal design; see `DESIGN.md` and `PRODUCT.md`). `scripts/build_site_data.py` turns the gzipped per-window CSVs in `docs/benchmarks/data/` into `site/data.js`, reusing `tsfore.evaluate.leaderboard`; `site/app.js` renders every table and chart from it. After a new benchmark run, gzip its CSV into `docs/benchmarks/data/`, point `build()` at it, and rerun the script.

## Adding a model

Implement `name` and `forecast(context, horizon) -> QuantileForecast` (see `forecasters/base.py`), then register a CLI name in `forecasters.build`.
