# agent-notes: { ctx: "statsforecast models behind the tsfore forecaster protocol", deps: [src/tsfore/forecasters/base.py, docs/adrs/0015-statistical-baselines-and-evaluation.md], state: active, last: "sato@2026-10-17", key: ["prediction intervals at 20/40/60/80% map exactly onto the deciles", "max_context caps history: Auto* fits are O(T) to O(T^2)"] }
"""Classical statistical baselines from Nixtla's statsforecast.

These are the reference models GIFT-Eval and fev-bench report against, so scores here
line up with the published Timestral numbers.
"""

import numpy as np

from tsfore.forecasters.base import EVAL_LEVELS, QuantileForecast, check_inputs

KINDS = ("auto_ets", "auto_arima", "auto_theta", "rw_drift", "historic_average")

# A central interval at level L has bounds at quantiles (1 - L/100)/2 and (1 + L/100)/2.
_INTERVALS = [20, 40, 60, 80]


def _column(level: float) -> str:
    if abs(level - 0.5) < 1e-9:
        return "mean"
    width = round(abs(2 * level - 1) * 100)
    return f"{'lo' if level < 0.5 else 'hi'}-{width}"


class StatsForecastModel:
    """One statsforecast model, refit from scratch on each context."""

    def __init__(self, kind: str, season_length: int, max_context: int = 1024) -> None:
        if kind not in KINDS:
            raise ValueError(f"unknown kind {kind!r}; choose from {KINDS}")
        self.kind = kind
        self.name = kind
        self.season_length = season_length
        self.max_context = max_context

    def _model(self, n: int):
        from statsforecast import models

        # Seasonal fits need at least two full seasons.
        m = self.season_length if n >= 2 * self.season_length else 1
        if self.kind == "auto_ets":
            return models.AutoETS(season_length=m)
        if self.kind == "auto_arima":
            return models.AutoARIMA(season_length=m)
        if self.kind == "auto_theta":
            return models.AutoTheta(season_length=m)
        if self.kind == "rw_drift":
            return models.RandomWalkWithDrift()
        return models.HistoricAverage()

    def forecast(self, context: np.ndarray, horizon: int) -> QuantileForecast:
        ctx = check_inputs(context, horizon)[-self.max_context :]
        out = self._model(ctx.size).forecast(y=ctx, h=horizon, level=_INTERVALS)
        values = np.column_stack([out[_column(q)] for q in EVAL_LEVELS]).astype(float)
        return QuantileForecast(np.sort(values, axis=1))
