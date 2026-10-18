# agent-notes: { ctx: "tests for rolling-origin backtest and scoring", deps: [src/tsfore/backtest.py, src/tsfore/data.py], state: active, last: "tara@2026-10-17" }
import numpy as np
import pytest

from tsfore.backtest import backtest, summarize
from tsfore.data import Series, synthetic
from tsfore.forecasters import Naive, SeasonalNaive


def test_windows_are_non_overlapping_and_end_at_series_end():
    s = Series("ramp", np.arange(50, dtype=float), season_length=1)
    res = backtest(s, [Naive()], horizon=5, n_windows=3)
    assert list(res["cutoff"]) == [35, 40, 45]
    assert set(res["model"]) == {"naive"}


def test_backtest_never_leaks_future_into_context():
    seen: list[int] = []

    class Spy(Naive):
        name = "spy"

        def forecast(self, context, horizon):
            seen.append(len(context))
            return super().forecast(context, horizon)

    s = Series("ramp", np.arange(30, dtype=float), season_length=1)
    backtest(s, [Spy()], horizon=4, n_windows=2)
    assert seen == [22, 26]


def test_seasonal_naive_beats_naive_on_seasonal_data():
    s = synthetic("seasonal", length=240, season_length=12, noise=0.1, seed=1)
    res = backtest(s, [Naive(), SeasonalNaive(12)], horizon=12, n_windows=4)
    table = summarize(res)
    assert table.loc["seasonal_naive", "mase"] < table.loc["naive", "mase"]
    assert {"mae", "rmse", "smape", "mase", "wql", "coverage_80"} <= set(table.columns)


def test_backtest_rejects_too_short_series():
    s = Series("tiny", np.arange(10, dtype=float), season_length=1)
    with pytest.raises(ValueError):
        backtest(s, [Naive()], horizon=5, n_windows=3)
