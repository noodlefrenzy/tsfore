# agent-notes: { ctx: "naive and seasonal-naive baselines with Gaussian intervals", deps: [src/tsfore/forecasters/base.py], state: active, last: "sato@2026-10-17", key: ["interval widths follow Hyndman & Athanasopoulos FPP3 §5.5 benchmark formulas"] }
"""Benchmarks any forecasting model has to beat to be worth its cost.

Intervals assume Gaussian one-step residuals: for naive, sigma_h = sigma * sqrt(h);
for seasonal naive, sigma_h = sigma * sqrt(k + 1) with k = floor((h - 1) / m).
"""

from statistics import NormalDist

import numpy as np

from tsfore.forecasters.base import EVAL_LEVELS, QuantileForecast, check_inputs

_Z = np.array([NormalDist().inv_cdf(q) for q in EVAL_LEVELS])


def _residual_sigma(residuals: np.ndarray) -> float:
    return float(np.sqrt(np.mean(residuals**2))) if residuals.size else 0.0


def _gaussian(point: np.ndarray, sigma_h: np.ndarray) -> QuantileForecast:
    return QuantileForecast(point[:, None] + sigma_h[:, None] * _Z[None, :])


class Naive:
    """Repeat the last observation."""

    name = "naive"

    def forecast(self, context: np.ndarray, horizon: int) -> QuantileForecast:
        ctx = check_inputs(context, horizon)
        h = np.arange(1, horizon + 1)
        sigma = _residual_sigma(np.diff(ctx))
        return _gaussian(np.full(horizon, ctx[-1]), sigma * np.sqrt(h))


class SeasonalNaive:
    """Repeat the last observed season; naive when the context is shorter than a season."""

    name = "seasonal_naive"

    def __init__(self, season_length: int) -> None:
        if season_length < 1:
            raise ValueError(f"season_length must be >= 1, got {season_length}")
        self.season_length = season_length

    def forecast(self, context: np.ndarray, horizon: int) -> QuantileForecast:
        ctx = check_inputs(context, horizon)
        m = self.season_length
        if ctx.size <= m:
            return Naive().forecast(ctx, horizon)
        h = np.arange(1, horizon + 1)
        point = ctx[-m:][(h - 1) % m]
        sigma = _residual_sigma(ctx[m:] - ctx[:-m])
        return _gaussian(point, sigma * np.sqrt((h - 1) // m + 1))
