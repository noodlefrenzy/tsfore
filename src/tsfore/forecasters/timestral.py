# agent-notes: { ctx: "adapter from Mistral Timestral to the tsfore forecaster", deps: [src/tsfore/forecasters/base.py, docs/adrs/0014-python-forecasting-harness-stack.md], state: active, last: "claude@2026-10-18", key: ["timestral/torch import lazily so baselines run without the extra", "native 21 levels are interpolated onto EVAL_LEVELS", "device auto = cuda when torch sees a GPU", "loaded models are cached per (checkpoint, device) across instances", "forecast_multi: cov = past_covariates, joint = extra variates (ADR-0016)", "batches left-pad with NaN; Timestral masks it"], stale-risk: "timestral API (pinned commit) and Hub repo names" }
"""Timestral (mistralai/timestral) behind the tsfore `Forecaster` protocol.

Weights come from the Hugging Face Hub on first use and are cached. Set
`local_files_only=True` (or `HF_HUB_OFFLINE=1`) to run from the cache only.
"""

from __future__ import annotations

import functools
from typing import TYPE_CHECKING

import numpy as np

from tsfore.forecasters.base import EVAL_LEVELS, QuantileForecast, check_inputs

if TYPE_CHECKING:
    from timestral import TimestralForecaster

SIZES = ("5M", "28M", "123M", "209M")
REPOS = tuple(f"mistralai/Timestral-{s}" for s in SIZES)


def resolve_device(device: str) -> str:
    """`auto` becomes `cuda` when torch sees a GPU, else `cpu`; anything else passes through."""
    if device != "auto":
        return device
    import torch

    return "cuda" if torch.cuda.is_available() else "cpu"


class TimestralAdapter:
    """Zero-shot Timestral forecasts, loaded lazily on the first `forecast` call."""

    def __init__(
        self,
        repo_id: str = "mistralai/Timestral-5M",
        device: str = "auto",
        local_files_only: bool = False,
        name: str | None = None,
    ) -> None:
        # Local checkpoint directories pass through; only a mistyped Hub id is caught here.
        if repo_id.startswith("mistralai/") and repo_id not in REPOS:
            raise ValueError(f"unknown checkpoint {repo_id!r}; expected one of {REPOS}")
        self.repo_id = repo_id
        self.device = device
        self.local_files_only = local_files_only
        self.name = name or repo_id.rsplit("/", 1)[-1].lower()
        self._forecaster: TimestralForecaster | None = None

    @classmethod
    def from_forecaster(cls, forecaster: TimestralForecaster, name: str) -> TimestralAdapter:
        """Wrap an already-built forecaster (tests use a tiny random-init model)."""
        adapter = cls(repo_id=name, name=name)
        adapter._forecaster = forecaster
        return adapter

    def load(self) -> TimestralForecaster:
        """Load the weights now (the backtest does this before timing). Instances with the
        same checkpoint and device share one loaded model."""
        if self._forecaster is None:
            self._forecaster = _load_cached(self.repo_id, resolve_device(self.device), self.local_files_only)
        return self._forecaster

    def forecast(self, context: np.ndarray, horizon: int) -> QuantileForecast:
        return self.forecast_batch([context], horizon)[0]

    def forecast_batch(self, contexts: list[np.ndarray], horizon: int) -> list[QuantileForecast]:
        """One GPU call for many contexts of any lengths (left-padded with NaN, which Timestral masks)."""
        ctxs = [check_inputs(c, horizon)[None] for c in contexts]
        return self._to_eval_levels(self.load().forecast(_left_pad(ctxs), prediction_length=horizon))

    def forecast_multi(
        self, context: np.ndarray, horizon: int, companions: np.ndarray, mode: str
    ) -> QuantileForecast:
        """Target forecast conditioned on `companions` `(C, T)`; see tsfore.multivariate."""
        return self.forecast_multi_batch([context], horizon, [companions], mode)[0]

    def forecast_multi_batch(
        self, contexts: list[np.ndarray], horizon: int, companions: list[np.ndarray], mode: str
    ) -> list[QuantileForecast]:
        f = self.load()
        targets = [np.asarray(c, dtype=float)[None] for c in contexts]
        if mode == "cov":
            out = f.forecast(
                _left_pad(targets), prediction_length=horizon, past_covariates=_left_pad(companions)
            )
        elif mode == "joint":
            joint = [np.vstack([t, k]) for t, k in zip(targets, companions, strict=True)]
            out = f.forecast(_left_pad(joint), prediction_length=horizon)
        else:
            raise ValueError(f"unknown companion mode {mode!r}")
        return self._to_eval_levels(out)

    @staticmethod
    def _to_eval_levels(out) -> list[QuantileForecast]:
        """The target row (variate 0) of every series in the batch, at EVAL_LEVELS."""
        levels = np.asarray(out.quantile_levels)
        native = out.quantiles[:, 0].detach().cpu().double().numpy()  # (B, H, Q_native)
        return [
            QuantileForecast(np.stack([np.interp(EVAL_LEVELS, levels, row) for row in q])) for q in native
        ]


def _left_pad(rows: list[np.ndarray]) -> np.ndarray:
    """`(V, T_i)` arrays to one `(B, V, max T)` array, NaN-padded on the left (oldest side)."""
    length = max(r.shape[-1] for r in rows)
    out = np.full((len(rows), rows[0].shape[0], length), np.nan)
    for i, r in enumerate(rows):
        out[i, :, length - r.shape[-1] :] = r
    return out


@functools.cache
def _load_cached(repo_id: str, device: str, local_files_only: bool) -> TimestralForecaster:
    return _from_pretrained(repo_id, device, local_files_only)


def _from_pretrained(repo_id: str, device: str, local_files_only: bool) -> TimestralForecaster:
    try:
        from timestral import TimestralForecaster
    except ImportError as e:
        raise ImportError("Timestral is not installed; run `uv sync --extra timestral`") from e
    return TimestralForecaster.from_pretrained(repo_id, device=device, local_files_only=local_files_only)
