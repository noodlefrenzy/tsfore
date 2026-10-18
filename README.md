<!-- agent-notes: { ctx: "project README: what tsfore is, setup, usage", deps: [CLAUDE.md, docs/adrs/0014-python-forecasting-harness-stack.md, docs/adrs/0015-statistical-baselines-and-evaluation.md, data/finance/README.md], state: active, last: "claude@2026-10-18" } -->
# tsfore

A playground for time series forecasting. It starts by putting Mistral's
[Timestral](https://github.com/mistralai/timestral) foundation models up against the
baselines any forecaster has to beat, and scores them all the same way.

The [Summon](https://github.com/summon-dev/summon) team framework (v3 branch) is installed
here, so `.claude/`, `docs/` and `team/` hold its agents, process docs and ADRs.

## Setup

```bash
uv sync --all-extras        # numpy/pandas core + timestral, chronos-2 and torch
uv sync                     # core only: baselines, statsforecast, metrics, no torch
```

Timestral runs on the GPU when torch sees one (`--device auto`, the default; `--device cpu`
to force CPU). The locked torch is a CUDA 13 build, so under WSL2 install a current NVIDIA
*Windows* driver and no Linux driver inside WSL. Timestral weights download from the
Hugging Face Hub on first use (5M is 21 MB, 209M is
837 MB). To run from the cache only, pass `--offline` or set `HF_HUB_OFFLINE=1`.

## Usage

```bash
uv run tsfore data list                       # the bundled finance series
uv run tsfore bench --suite finance --windows 6 --out results/
uv run tsfore bench --suite finance_daily --models naive,auto_ets,timestral-5m,timestral-209m
uv run tsfore bench --suite pairs --windows 12 --models naive,timestral-209m,timestral-209m+cov,chronos-2,chronos-2+cov

uv run tsfore run --dataset gold_monthly --models naive,auto_arima,timestral-28m
uv run tsfore run --synthetic seasonal --season 12 --horizon 24 --models seasonal_naive,auto_ets
uv run tsfore run --csv data/air.csv --value-col Passengers --time-col Month --season 12 --horizon 12
```

`bench` prints a leaderboard and, with `--out`, writes per-window results (CSV) and a
Markdown report. Each model's score on a series is divided by the baseline's (`--baseline`,
default `naive`, the random walk) and the ratios are combined with a geometric mean, as
GIFT-Eval does. The latest baseline run is in
[`docs/benchmarks/`](docs/benchmarks/).

| column | meaning |
|---|---|
| `rel_mase`, `rel_wql` | geometric mean over series of MASE / WQL ÷ the baseline's; below 1 beats it |
| `avg_rank` | mean per-series rank by MASE (1 = best) |
| `coverage_80` | share of actuals inside the 10%–90% band; well calibrated ≈ 0.8 |
| `direction` | share of correctly called up/down moves from the last observation |
| `seconds` | wall-clock time per forecast |

`run` shows plain means of `mae`, `rmse`, `smape`, `mase` and `wql` for one series.

**Models:**
- `naive`, `seasonal_naive`
- statsforecast: `historic_average`, `rw_drift`, `auto_ets`, `auto_arima`, `auto_theta`
- Timestral: `timestral-5m`, `-28m`, `-123m`, `-209m`
- Chronos-2: `chronos-2` (120M), `chronos-2-small` (28M)
- Any foundation model with `+cov` (related series as past covariates) or `+joint`
  (related series forecast jointly), e.g. `timestral-209m+cov`. These need the `pairs`
  suite, which pairs each target with related series (Brent/WTI, EUR/JPY, S&P 500/VIX).
  See ADR-0016.

**Data:** 11 public finance series, pinned to upstream commits: the S&P 500 (level and log
returns), the US 10-year yield, CPI, gold, VIX, WTI, Brent, natural gas, EUR and JPY. Eight
are committed in `data/finance/`. The S&P 500 and VIX are not, because their owners forbid
redistribution. They download from the same pinned commits the first time you use them,
so that step needs the network. `uv run tsfore data fetch` downloads all of them at once.
Each series' source and terms are in [`data/finance/README.md`](data/finance/README.md).

## Results site

`site/` is a single static page summarising the benchmarks for GitHub Pages: the three model
families, where each wins and loses, paired significance tests, corrections and the tests
still to run. Preview it with `python -m http.server -d site`, and rebuild its data from the
committed CSVs with `uv run python scripts/build_site_data.py`.

## Tests

```bash
uv run pytest               # fast and offline: Timestral is exercised with a tiny random-init model
                            # (S&P 500 / VIX tests skip until `tsfore data fetch` has run)
uv run pytest -m weights    # downloads Timestral-5M and checks it beats naive
```

## Layout

See [`docs/code-map.md`](docs/code-map.md). Decisions are in [`docs/adrs/`](docs/adrs/),
starting with [ADR-0014](docs/adrs/0014-python-forecasting-harness-stack.md) (stack) and
[ADR-0015](docs/adrs/0015-statistical-baselines-and-evaluation.md) (baselines, data, scoring).

## Licenses

tsfore is under the [MIT License](LICENSE). Third-party material keeps its own terms, which
[`NOTICE.md`](NOTICE.md) lists. The main ones:

- **Timestral weights** download from the Hugging Face Hub under Mistral AI's Modified MIT
  license. It withholds every right from companies whose monthly revenue exceeds $20M.
- **Chronos-2** code and weights are Apache-2.0.
- **Data:** each series keeps its source's terms. See [`data/finance/README.md`](data/finance/README.md).
