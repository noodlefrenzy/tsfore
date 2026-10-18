# agent-notes: { ctx: "+cov/+joint wrappers: foundation models conditioned on companions", deps: [src/tsfore/forecasters/base.py, src/tsfore/backtest.py, docs/adrs/0016-companion-series-for-multivariate-evaluation.md], state: active, key: ["cov = companions as past covariates; joint = companions as extra forecast variates", "only the target row is returned and scored"], last: "claude@2026-10-18" }
"""Companion-aware forecasting (ADR-0016).

`WithCompanions(adapter, mode)` turns a foundation-model adapter into a model that the
backtest hands the companions to, cut at the same point as the target context:

- `cov`: the companions are past covariates. They condition the forecast but are not
  forecast themselves.
- `joint`: the companions are extra variates, forecast together with the target. The
  model's cross-variate attention sees all of them, and only the target row is kept.
"""

from __future__ import annotations

from typing import Protocol

import numpy as np

from tsfore.forecasters.base import QuantileForecast, check_inputs

MODES = ("cov", "joint")


class SupportsCompanions(Protocol):
    name: str

    def forecast_multi_batch(
        self, contexts: list[np.ndarray], horizon: int, companions: list[np.ndarray], mode: str
    ) -> list[QuantileForecast]: ...


class WithCompanions:
    uses_companions = True

    def __init__(self, adapter: SupportsCompanions, mode: str) -> None:
        if mode not in MODES:
            raise ValueError(f"unknown companion mode {mode!r}; choose from {MODES}")
        if not hasattr(adapter, "forecast_multi_batch"):
            raise ValueError(f"{adapter.name} cannot use companions; only foundation models can")
        self.adapter, self.mode = adapter, mode
        self.name = f"{adapter.name}+{mode}"

    def load(self):
        return self.adapter.load()

    def forecast(self, context: np.ndarray, horizon: int, companions: np.ndarray) -> QuantileForecast:
        return self.forecast_batch([context], horizon, [companions])[0]

    def forecast_batch(
        self, contexts: list[np.ndarray], horizon: int, companions: list[np.ndarray]
    ) -> list[QuantileForecast]:
        ctxs = [check_inputs(c, horizon) for c in contexts]
        comps = [_check_companions(k, c.size) for c, k in zip(ctxs, companions, strict=True)]
        return self.adapter.forecast_multi_batch(ctxs, horizon, comps, self.mode)


def _check_companions(companions: np.ndarray, length: int) -> np.ndarray:
    comps = np.atleast_2d(np.asarray(companions, dtype=float))
    if comps.shape[1] != length:
        raise ValueError(f"companions {comps.shape} do not align with a context of {length}")
    if not np.all(np.isfinite(comps)):
        raise ValueError("companions contain NaN or inf")
    return comps
