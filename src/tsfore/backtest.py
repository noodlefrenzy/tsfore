# agent-notes: { ctx: "rolling-origin backtest and per-model score summary", deps: [src/tsfore/data.py, src/tsfore/metrics.py, src/tsfore/forecasters/base.py], state: active, last: "claude@2026-10-18", invariants: ["a window's context never includes its own horizon, companions included", "a model that raises yields NaN scores plus an error, never aborts the run", "forecast_batch, when present, runs all windows of a series in one call"] }
"""Rolling-origin evaluation: the last `n_windows * horizon` steps are split into
back-to-back test windows; each model forecasts every window from all data before it."""

import time
from collections.abc import Sequence

import numpy as np
import pandas as pd

from tsfore import metrics
from tsfore.data import Series
from tsfore.forecasters.base import Forecaster, QuantileForecast

SCORES = ["mae", "rmse", "smape", "mase", "wql", "coverage_80", "direction", "seconds"]


def backtest(series: Series, models: Sequence[Forecaster], horizon: int, n_windows: int) -> pd.DataFrame:
    """One row per (model, window) with every score in `SCORES`."""
    y = series.values
    first_cutoff = y.size - n_windows * horizon
    if first_cutoff < 2:
        raise ValueError(
            f"{series.name} has {y.size} points; {n_windows} windows of {horizon} need at least "
            f"{n_windows * horizon + 2}"
        )
    cutoffs = [first_cutoff + w * horizon for w in range(n_windows)]
    runs = [_run_windows(model, series, cutoffs, horizon) for model in models]
    rows = []
    for w, cutoff in enumerate(cutoffs):
        train, actual = y[:cutoff], y[cutoff : cutoff + horizon]
        for model, run in zip(models, runs, strict=True):
            fc, seconds, error = run[w]
            row = {"series": series.name, "model": model.name, "window": w, "cutoff": cutoff}
            if error is not None:
                row.update({k: float("nan") for k in SCORES}, error=error)
            else:
                row.update(_score(actual, fc, train, series.season_length), error=None)
                row["seconds"] = seconds
            rows.append(row)
    return pd.DataFrame(rows)


Outcome = tuple[QuantileForecast | None, float, str | None]


def _run_windows(model: Forecaster, series: Series, cutoffs: list[int], horizon: int) -> list[Outcome]:
    """Forecast every window: in one `forecast_batch` call when the model has one (each
    window is charged an equal share of its time), else one call per window. A batch that
    raises falls back to per-window calls, so one bad window still fails alone. Models
    with a `load()` load before the clock starts, so `seconds` is forecasting time only."""
    try:
        if hasattr(model, "load"):
            model.load()
    except Exception as e:
        return [(None, float("nan"), f"{type(e).__name__}: {e}")] * len(cutoffs)
    if hasattr(model, "forecast_batch"):
        args = [[series.values[:c] for c in cutoffs], horizon]
        start = time.perf_counter()
        try:
            if getattr(model, "uses_companions", False):
                args.append([_companions(model, series, c) for c in cutoffs])
            fcs = model.forecast_batch(*args)
        except Exception:
            pass  # retried window by window below, where each error is recorded
        else:
            seconds = (time.perf_counter() - start) / len(cutoffs)
            return [(fc, seconds, None) for fc in fcs]
    outcomes = []
    for cutoff in cutoffs:
        start = time.perf_counter()
        try:
            fc = _forecast(model, series, series.values[:cutoff], horizon, cutoff)
        except Exception as e:  # one failing model must not sink a whole benchmark
            outcomes.append((None, float("nan"), f"{type(e).__name__}: {e}"))
        else:
            outcomes.append((fc, time.perf_counter() - start, None))
    return outcomes


def _companions(model: Forecaster, series: Series, cutoff: int) -> np.ndarray:
    if series.companions is None:
        raise ValueError(f"{model.name} needs companions, but {series.name} has none")
    return series.companions[:, :cutoff]


def _forecast(model: Forecaster, series: Series, train: np.ndarray, horizon: int, cutoff: int):
    """Companion-aware models (ADR-0016) also get the companions up to the same cutoff."""
    if not getattr(model, "uses_companions", False):
        return model.forecast(train, horizon)
    return model.forecast(train, horizon, _companions(model, series, cutoff))


def _score(
    actual: np.ndarray, fc: QuantileForecast, train: np.ndarray, season_length: int
) -> dict[str, float]:
    point = fc.median
    out = {
        "mae": metrics.mae(actual, point),
        "rmse": metrics.rmse(actual, point),
        "smape": metrics.smape(actual, point),
        "coverage_80": metrics.coverage(actual, fc.quantile(0.1), fc.quantile(0.9)),
        "direction": metrics.directional_accuracy(actual, point, train[-1]),
    }
    out["mase"] = _or_nan(lambda: metrics.mase(actual, point, train, season_length))
    out["wql"] = _or_nan(lambda: metrics.wql(actual, fc.values, fc.levels))
    return out


def _or_nan(fn) -> float:
    try:
        return fn()
    except ValueError:
        return float("nan")


def summarize(results: pd.DataFrame) -> pd.DataFrame:
    """Mean of each score per model, best MASE first."""
    return results.groupby("model")[SCORES].mean().sort_values("mase")
