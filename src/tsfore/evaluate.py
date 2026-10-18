# agent-notes: { ctx: "multi-series benchmark runner, leaderboard, markdown report", deps: [src/tsfore/backtest.py, src/tsfore/data.py, docs/adrs/0015-statistical-baselines-and-evaluation.md], state: active, last: "sato@2026-10-17", key: ["aggregation = geometric mean of per-series ratios to a baseline (GIFT-Eval style)", "default baseline is naive (random walk), the finance benchmark"] }
"""Benchmark many models over many series and aggregate fairly.

Raw MASE/WQL are not comparable across series of different scale and difficulty, so
each model's per-series score is divided by the baseline's on the same series and the
ratios are combined with a geometric mean, the aggregation GIFT-Eval and fev-bench use.
The default baseline is the random walk (`naive`): for asset prices and rates it is the
benchmark to beat, and seasonal naive is a weak reference on series with no seasonality.
"""

from collections.abc import Callable, Sequence

import numpy as np
import pandas as pd

from tsfore.backtest import backtest
from tsfore.data import Series
from tsfore.forecasters.base import Forecaster

ModelFactory = Callable[[Series], Sequence[Forecaster]]


def run_suite(
    suite: Sequence[Series], factory: ModelFactory, n_windows: int = 3, horizon: int | None = None
) -> pd.DataFrame:
    """Backtest every series with the models `factory` builds for it.

    `horizon` overrides each series' own; one of the two must be set.
    """
    frames = []
    for series in suite:
        h = horizon or series.horizon
        if h is None:
            raise ValueError(f"{series.name} has no horizon; pass horizon=")
        frames.append(backtest(series, list(factory(series)), h, n_windows))
    return pd.concat(frames, ignore_index=True)


def _geomean(x: pd.Series) -> float:
    x = x[np.isfinite(x) & (x > 0)]
    return float(np.exp(np.log(x).mean())) if len(x) else float("nan")


def leaderboard(results: pd.DataFrame, baseline: str = "naive") -> pd.DataFrame:
    """One row per model: relative MASE/WQL (geometric mean over series), average rank,
    and plain means of coverage, direction and runtime. Best relative WQL first."""
    if baseline not in set(results["model"]):
        raise ValueError(f"baseline {baseline!r} is not among the models {sorted(set(results['model']))}")
    per_series = results.groupby(["series", "model"]).mean(numeric_only=True)
    base = per_series.xs(baseline, level="model")
    board = pd.DataFrame(index=sorted(set(results["model"])))
    for metric in ("mase", "wql"):
        if metric not in per_series:
            continue
        ratio = per_series[metric] / base[metric].reindex(per_series.index, level="series")
        board[f"rel_{metric}"] = ratio.groupby(level="model").apply(_geomean)
    ranks = per_series["mase"].groupby(level="series").rank(method="average")
    board["avg_rank"] = ranks.groupby(level="model").mean()
    for col in ("coverage_80", "direction", "seconds"):
        if col in per_series:
            board[col] = per_series[col].groupby(level="model").mean()
    board["n_series"] = per_series["mase"].notna().groupby(level="model").sum()
    if "error" in results:
        board["failures"] = results["error"].notna().groupby(results["model"]).sum()
    sort_key = "rel_wql" if "rel_wql" in board else "rel_mase"
    return board.sort_values([sort_key, "avg_rank"])


def _md_table(df: pd.DataFrame, index_name: str) -> str:
    def fmt(v):
        if isinstance(v, float | np.floating):
            return "—" if np.isnan(v) else f"{v:.3f}"
        return str(v)

    cols = [index_name, *map(str, df.columns)]
    lines = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for idx, *row in df.itertuples():  # itertuples keeps int columns int
        lines.append("| " + " | ".join([str(idx), *(fmt(v) for v in row)]) + " |")
    return "\n".join(lines)


def report_markdown(results: pd.DataFrame, title: str, baseline: str = "naive") -> str:
    """Leaderboard, per-series MASE, and any model failures, as Markdown."""
    board = leaderboard(results, baseline)
    per_series = results.pivot_table(index="series", columns="model", values="mase", aggfunc="mean")
    parts = [
        f"# {title}",
        "",
        f"{results['series'].nunique()} series, {results['window'].nunique()} windows each. "
        f"`rel_*` = geometric mean over series of the ratio to `{baseline}`; below 1 beats it. "
        "`direction` = share of correctly called up/down moves (— when a model never calls one).",
        "",
        "## Leaderboard",
        "",
        _md_table(board, "model"),
        "",
        "## MASE per series",
        "",
        _md_table(per_series[board.index], "series"),
    ]
    if "error" in results and results["error"].notna().any():
        errs = results[results["error"].notna()].groupby(["model", "series"])["error"].first()
        parts += ["", "## Failures", ""] + [f"- `{m}` on `{s}`: {e}" for (m, s), e in errs.items()]
    return "\n".join(parts) + "\n"
