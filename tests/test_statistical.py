# agent-notes: { ctx: "tests for statsforecast-backed statistical baselines", deps: [src/tsfore/forecasters/statistical.py], state: active, last: "tara@2026-10-17" }
import numpy as np
import pytest

pytest.importorskip("statsforecast")

from tsfore.data import synthetic  # noqa: E402
from tsfore.forecasters import EVAL_LEVELS, build  # noqa: E402
from tsfore.forecasters.statistical import KINDS, StatsForecastModel  # noqa: E402


@pytest.mark.parametrize("kind", KINDS)
def test_every_kind_returns_monotone_deciles(kind):
    s = synthetic("trend", length=120, season_length=12, seed=0)
    fc = StatsForecastModel(kind, season_length=12).forecast(s.values, horizon=12)
    assert fc.levels == EVAL_LEVELS
    assert fc.values.shape == (12, len(EVAL_LEVELS))
    assert np.all(np.isfinite(fc.values))
    assert np.all(np.diff(fc.values, axis=1) >= 0)


def test_auto_ets_tracks_a_clean_seasonal_pattern():
    s = synthetic("seasonal", length=144, season_length=12, noise=0.05, seed=4)
    train, test = s.values[:-12], s.values[-12:]
    fc = StatsForecastModel("auto_ets", season_length=12).forecast(train, horizon=12)
    assert np.mean(np.abs(fc.median - test)) < 0.3


def test_max_context_truncates_history():
    # A level shift far in the past must not matter once it falls outside the window.
    y = np.concatenate([np.full(500, 1000.0), 10 + np.random.default_rng(0).normal(0, 0.1, 200)])
    fc = StatsForecastModel("historic_average", season_length=1, max_context=100).forecast(y, horizon=3)
    np.testing.assert_allclose(fc.median, 10, atol=0.1)


def test_unknown_kind_and_build_names():
    with pytest.raises(ValueError):
        StatsForecastModel("prophet", season_length=1)
    assert build("auto_arima", season_length=12).name == "auto_arima"
