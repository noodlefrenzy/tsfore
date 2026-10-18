# agent-notes: { ctx: "series type with optional companions, CSV loader, synthetic generators", deps: [docs/adrs/0016-companion-series-for-multivariate-evaluation.md], state: active, last: "claude@2026-10-17" }
"""Series for experiments: load from CSV or generate synthetically.

The target is always univariate. `companions` optionally carries related series aligned
with it (ADR-0016), which companion-aware models may condition on.
"""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class Series:
    name: str
    values: np.ndarray
    season_length: int = 1
    dates: np.ndarray | None = None  # datetime64, aligned with values when known
    horizon: int | None = None  # the series' default forecast horizon, when it has one
    companions: np.ndarray | None = None  # (C, N) related series, aligned with values
    companion_names: tuple[str, ...] = ()


def load_csv(path: str | Path, value_col: str, time_col: str | None = None, season_length: int = 1) -> Series:
    """Read one value column; sort by `time_col` when given. Missing values are interpolated."""
    path = Path(path)
    df = pd.read_csv(path)
    for col in (value_col, time_col):
        if col is not None and col not in df.columns:
            raise ValueError(f"column {col!r} not in {path.name}; columns are {list(df.columns)}")
    if time_col is not None:
        df = df.sort_values(time_col, kind="stable")
    values = pd.to_numeric(df[value_col], errors="coerce").interpolate(limit_direction="both")
    return Series(path.stem, values.to_numpy(dtype=float), season_length)


SYNTHETIC_KINDS = ("seasonal", "trend", "random_walk", "intermittent")


def synthetic(
    kind: str, length: int = 240, season_length: int = 12, noise: float = 0.3, seed: int = 0
) -> Series:
    """Reproducible test series with a known structure."""
    rng = np.random.default_rng(seed)
    t = np.arange(length, dtype=float)
    eps = rng.normal(scale=noise, size=length)
    if kind == "seasonal":
        values = 10 + 3 * np.sin(2 * np.pi * t / season_length) + eps
    elif kind == "trend":
        values = 5 + 0.1 * t + 2 * np.sin(2 * np.pi * t / season_length) + eps
    elif kind == "random_walk":
        values = 50 + rng.normal(size=length).cumsum()
    elif kind == "intermittent":
        values = np.where(rng.random(length) < 0.35, rng.poisson(4, length) + 1, 0).astype(float)
    else:
        raise ValueError(f"unknown kind {kind!r}; choose from {SYNTHETIC_KINDS}")
    return Series(f"synthetic-{kind}", values, season_length)
