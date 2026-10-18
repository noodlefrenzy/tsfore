# agent-notes: { ctx: "forecaster protocol and quantile forecast container", deps: [], state: active, last: "sato@2026-10-17", key: ["every forecaster returns EVAL_LEVELS so models score on equal terms"] }
"""The one contract every model in tsfore meets.

A forecaster takes a univariate context `(T,)` and a horizon and returns a
`QuantileForecast` at `EVAL_LEVELS`. Scoring every model at the same levels keeps
WQL comparable between baselines and foundation models that natively emit more.
"""

from dataclasses import dataclass
from typing import Protocol

import numpy as np

# Deciles, the levels GIFT-Eval and fev-bench score WQL at.
EVAL_LEVELS: tuple[float, ...] = (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9)


@dataclass(frozen=True)
class QuantileForecast:
    """`values` is `(H, Q)`, one column per level in `levels`, non-decreasing along Q."""

    values: np.ndarray
    levels: tuple[float, ...] = EVAL_LEVELS

    def __post_init__(self) -> None:
        if self.values.ndim != 2 or self.values.shape[1] != len(self.levels):
            raise ValueError(f"values must be (H, {len(self.levels)}), got {self.values.shape}")

    @property
    def median(self) -> np.ndarray:
        return self.quantile(0.5)

    def quantile(self, level: float) -> np.ndarray:
        for i, lv in enumerate(self.levels):
            if abs(lv - level) < 1e-9:
                return self.values[:, i]
        raise ValueError(f"level {level} is not one of {self.levels}")


class Forecaster(Protocol):
    name: str

    def forecast(self, context: np.ndarray, horizon: int) -> QuantileForecast: ...


def check_inputs(context: np.ndarray, horizon: int) -> np.ndarray:
    """Validate and return the context as a float 1-D array."""
    ctx = np.asarray(context, dtype=float)
    if ctx.ndim != 1 or ctx.size == 0:
        raise ValueError(f"context must be a non-empty 1-D array, got shape {ctx.shape}")
    if not np.all(np.isfinite(ctx)):
        raise ValueError("context contains NaN or inf")
    if horizon < 1:
        raise ValueError(f"horizon must be >= 1, got {horizon}")
    return ctx
