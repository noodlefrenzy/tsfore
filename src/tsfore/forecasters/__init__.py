# agent-notes: { ctx: "forecaster registry and public exports", deps: [src/tsfore/forecasters/base.py, src/tsfore/forecasters/baselines.py, src/tsfore/forecasters/statistical.py, src/tsfore/forecasters/timestral.py, src/tsfore/forecasters/chronos.py], state: active, last: "claude@2026-10-17" }
from tsfore.forecasters.base import EVAL_LEVELS, Forecaster, QuantileForecast
from tsfore.forecasters.baselines import Naive, SeasonalNaive

__all__ = ["EVAL_LEVELS", "Forecaster", "Naive", "QuantileForecast", "SeasonalNaive", "build"]


def build(spec: str, season_length: int, local_files_only: bool = False, device: str = "auto") -> Forecaster:
    """Build a forecaster from a CLI name: naive, seasonal_naive, a statsforecast kind
    (auto_ets, auto_arima, auto_theta, rw_drift, historic_average), timestral-5m ... -209m, chronos-2 or chronos-2-small.
    A foundation-model name may take a `+cov` or `+joint` suffix (ADR-0016)."""
    from tsfore.forecasters.chronos import CHECKPOINTS, ChronosAdapter
    from tsfore.forecasters.statistical import KINDS, StatsForecastModel
    from tsfore.forecasters.timestral import SIZES, TimestralAdapter

    key = spec.strip().lower()
    if "+" in key:  # <model>+cov / <model>+joint: conditioned on companions (ADR-0016)
        from tsfore.multivariate import WithCompanions

        base, mode = key.rsplit("+", 1)
        return WithCompanions(build(base, season_length, local_files_only, device), mode)
    if key == "naive":
        return Naive()
    if key in ("seasonal_naive", "snaive"):
        return SeasonalNaive(season_length)
    if key in KINDS:
        return StatsForecastModel(key, season_length)
    for size in SIZES:
        if key == f"timestral-{size.lower()}":
            return TimestralAdapter(
                f"mistralai/Timestral-{size}", device=device, local_files_only=local_files_only
            )
    if key in CHECKPOINTS:
        return ChronosAdapter(CHECKPOINTS[key], device=device, local_files_only=local_files_only)
    choices = [
        "naive",
        "seasonal_naive",
        *KINDS,
        *(f"timestral-{s.lower()}" for s in SIZES),
        *CHECKPOINTS,
    ]
    raise ValueError(f"unknown model {spec!r}; choose from {choices}")
