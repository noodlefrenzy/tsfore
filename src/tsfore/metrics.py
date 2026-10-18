# agent-notes: { ctx: "point, probabilistic and directional forecast metrics", deps: [], state: active, last: "sato@2026-10-17", key: ["wql matches GIFT-Eval/fev mean weighted quantile loss (CRPS approximation)"] }
"""Forecast accuracy metrics. `y` is the actual horizon, all arrays align on time."""

from collections.abc import Sequence

import numpy as np


def _pair(y: np.ndarray, f: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    y, f = np.asarray(y, dtype=float), np.asarray(f, dtype=float)
    if y.shape != f.shape:
        raise ValueError(f"shape mismatch: actual {y.shape} vs forecast {f.shape}")
    return y, f


def mae(y: np.ndarray, f: np.ndarray) -> float:
    y, f = _pair(y, f)
    return float(np.mean(np.abs(y - f)))


def rmse(y: np.ndarray, f: np.ndarray) -> float:
    y, f = _pair(y, f)
    return float(np.sqrt(np.mean((y - f) ** 2)))


def smape(y: np.ndarray, f: np.ndarray) -> float:
    """Symmetric MAPE in [0, 2]; points where both are 0 count as 0 error."""
    y, f = _pair(y, f)
    denom = np.abs(y) + np.abs(f)
    terms = np.divide(2 * np.abs(y - f), denom, out=np.zeros_like(denom), where=denom > 0)
    return float(np.mean(terms))


def mase(y: np.ndarray, f: np.ndarray, train: np.ndarray, season_length: int) -> float:
    """MAE scaled by the in-sample MAE of the seasonal-naive forecast on `train`."""
    train = np.asarray(train, dtype=float)
    m = season_length if train.size > season_length else 1
    scale = float(np.mean(np.abs(train[m:] - train[:-m]))) if train.size > m else 0.0
    if scale == 0.0:
        raise ValueError("MASE is undefined: the in-sample seasonal-naive error is zero")
    return mae(y, f) / scale


def wql(y: np.ndarray, q: np.ndarray, levels: Sequence[float]) -> float:
    """Mean weighted quantile loss: 2 * sum pinball / sum |y|, averaged over levels."""
    y = np.asarray(y, dtype=float)
    q = np.asarray(q, dtype=float)
    if q.shape != (y.size, len(levels)):
        raise ValueError(f"quantiles must be ({y.size}, {len(levels)}), got {q.shape}")
    denom = np.sum(np.abs(y))
    if denom == 0:
        raise ValueError("WQL is undefined when the actuals sum to zero")
    err = y[:, None] - q
    lv = np.asarray(levels)[None, :]
    pinball = np.maximum(lv * err, (lv - 1) * err)
    return float(np.mean(2 * pinball.sum(axis=0) / denom))


def coverage(y: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> float:
    """Share of actuals inside [lo, hi]."""
    y, lo = _pair(y, lo)
    _, hi = _pair(y, hi)
    return float(np.mean((y >= lo) & (y <= hi)))


def directional_accuracy(y: np.ndarray, f: np.ndarray, last: float) -> float:
    """Share of steps where the forecast calls the sign of the move from `last` correctly.

    Steps where the forecast predicts no move are skipped; NaN if every step is flat
    (a naive forecast makes no directional call).
    """
    y, f = _pair(y, f)
    called = np.sign(f - last)
    mask = called != 0
    if not mask.any():
        return float("nan")
    return float(np.mean(called[mask] == np.sign(y - last)[mask]))
