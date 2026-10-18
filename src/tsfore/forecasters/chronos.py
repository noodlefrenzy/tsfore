# agent-notes: { ctx: "adapter from Amazon Chronos-2 to the tsfore forecaster", deps: [src/tsfore/forecasters/base.py, src/tsfore/forecasters/timestral.py], state: active, last: "claude@2026-10-18", key: ["chronos/torch import lazily so baselines run without the extra", "asks the pipeline for EVAL_LEVELS directly; they are native knots", "sorts quantiles per step: Chronos-2 can emit crossed quantiles", "device auto = cuda when torch sees a GPU", "loaded models are cached per (checkpoint, device) across instances", "forecast_multi: cov = past_covariates dict, joint = 2-D target (ADR-0016)", "forecast_batch: ragged list, pipeline pads"], stale-risk: "chronos-forecasting Chronos2Pipeline API and Hub repo names" }
"""Chronos-2 (amazon-science/chronos-forecasting) behind the tsfore `Forecaster` protocol.

Weights come from the Hugging Face Hub on first use and are cached. Set
`local_files_only=True` (or `HF_HUB_OFFLINE=1`) to run from the cache only.
"""

from __future__ import annotations

import functools
from typing import TYPE_CHECKING

import numpy as np

from tsfore.forecasters.base import EVAL_LEVELS, QuantileForecast, check_inputs
from tsfore.forecasters.timestral import resolve_device

if TYPE_CHECKING:
    from chronos import Chronos2Pipeline

# CLI name -> Hub repo. chronos-2 is the 120M flagship; small is 28M.
CHECKPOINTS = {
    "chronos-2": "amazon/chronos-2",
    "chronos-2-small": "autogluon/chronos-2-small",
}


class ChronosAdapter:
    """Zero-shot Chronos-2 forecasts, loaded lazily on the first `forecast` call."""

    def __init__(
        self,
        repo_id: str = "amazon/chronos-2",
        device: str = "auto",
        local_files_only: bool = False,
        name: str | None = None,
    ) -> None:
        # Local checkpoint directories pass through; only a mistyped Hub id is caught here.
        if "/" in repo_id and "chronos" in repo_id and repo_id not in CHECKPOINTS.values():
            raise ValueError(f"unknown checkpoint {repo_id!r}; expected one of {tuple(CHECKPOINTS.values())}")
        self.repo_id = repo_id
        self.device = device
        self.local_files_only = local_files_only
        self.name = name or repo_id.rsplit("/", 1)[-1].lower()
        self._pipeline: Chronos2Pipeline | None = None

    @classmethod
    def from_pipeline(cls, pipeline: Chronos2Pipeline, name: str) -> ChronosAdapter:
        """Wrap an already-built pipeline (tests use a tiny random-init model)."""
        adapter = cls(repo_id=name, name=name)
        adapter._pipeline = pipeline
        return adapter

    def load(self) -> Chronos2Pipeline:
        """Load the weights now (the backtest does this before timing). Instances with the
        same checkpoint and device share one loaded model."""
        if self._pipeline is None:
            self._pipeline = _load_cached(self.repo_id, resolve_device(self.device), self.local_files_only)
        return self._pipeline

    def forecast(self, context: np.ndarray, horizon: int) -> QuantileForecast:
        return self.forecast_batch([context], horizon)[0]

    def forecast_batch(self, contexts: list[np.ndarray], horizon: int) -> list[QuantileForecast]:
        """One call for many contexts of any lengths; the pipeline left-pads them itself."""
        return self._predict([check_inputs(c, horizon) for c in contexts], horizon)

    def forecast_multi(
        self, context: np.ndarray, horizon: int, companions: np.ndarray, mode: str
    ) -> QuantileForecast:
        """Target forecast conditioned on `companions` `(C, T)`; see tsfore.multivariate."""
        return self.forecast_multi_batch([context], horizon, [companions], mode)[0]

    def forecast_multi_batch(
        self, contexts: list[np.ndarray], horizon: int, companions: list[np.ndarray], mode: str
    ) -> list[QuantileForecast]:
        pairs = zip(contexts, companions, strict=True)
        if mode == "cov":
            items = [
                {"target": c, "past_covariates": {f"companion_{i}": row for i, row in enumerate(k)}}
                for c, k in pairs
            ]
        elif mode == "joint":
            items = [np.vstack([c, k]) for c, k in pairs]
        else:
            raise ValueError(f"unknown companion mode {mode!r}")
        return self._predict(items, horizon)

    def _predict(self, items: list, horizon: int) -> list[QuantileForecast]:
        quantiles, _ = self.load().predict_quantiles(
            items, prediction_length=horizon, quantile_levels=list(EVAL_LEVELS)
        )
        # Row 0 is the target. Chronos-2's quantile head doesn't enforce monotonicity; sort
        # to honour the contract.
        return [QuantileForecast(np.sort(q[0].detach().cpu().double().numpy(), axis=1)) for q in quantiles]


@functools.cache
def _load_cached(repo_id: str, device: str, local_files_only: bool) -> Chronos2Pipeline:
    return _from_pretrained(repo_id, device, local_files_only)


def _from_pretrained(repo_id: str, device: str, local_files_only: bool) -> Chronos2Pipeline:
    try:
        from chronos import Chronos2Pipeline
    except ImportError as e:
        raise ImportError("Chronos-2 is not installed; run `uv sync --extra chronos`") from e
    return Chronos2Pipeline.from_pretrained(repo_id, device_map=device, local_files_only=local_files_only)
