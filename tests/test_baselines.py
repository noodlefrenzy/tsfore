# agent-notes: { ctx: "tests for naive and seasonal-naive baselines", deps: [src/tsfore/forecasters/baselines.py, src/tsfore/forecasters/base.py], state: active, last: "tara@2026-10-17" }
import numpy as np
import pytest

from tsfore.forecasters import EVAL_LEVELS, Naive, SeasonalNaive


def test_naive_repeats_last_value_with_widening_intervals():
    ctx = np.array([1.0, 3.0, 2.0, 5.0, 4.0])
    fc = Naive().forecast(ctx, horizon=3)
    assert fc.values.shape == (3, len(EVAL_LEVELS))
    np.testing.assert_allclose(fc.median, [4.0, 4.0, 4.0])
    width = fc.quantile(0.9) - fc.quantile(0.1)
    assert np.all(np.diff(width) > 0)


def test_seasonal_naive_repeats_last_season():
    season = np.array([1.0, 5.0, 3.0])
    ctx = np.tile(season, 4)
    fc = SeasonalNaive(season_length=3).forecast(ctx, horizon=7)
    np.testing.assert_allclose(fc.median, [1, 5, 3, 1, 5, 3, 1])
    # perfectly periodic context -> zero residual spread
    np.testing.assert_allclose(fc.quantile(0.1), fc.quantile(0.9))


def test_seasonal_naive_falls_back_to_naive_on_short_context():
    ctx = np.array([2.0, 7.0])
    fc = SeasonalNaive(season_length=12).forecast(ctx, horizon=2)
    np.testing.assert_allclose(fc.median, [7.0, 7.0])


def test_quantiles_are_monotone_across_levels():
    rng = np.random.default_rng(0)
    ctx = rng.normal(size=200).cumsum()
    fc = SeasonalNaive(season_length=7).forecast(ctx, horizon=14)
    assert np.all(np.diff(fc.values, axis=1) >= 0)


def test_forecast_rejects_nan_context_and_bad_horizon():
    with pytest.raises(ValueError):
        Naive().forecast(np.array([1.0, np.nan]), horizon=1)
    with pytest.raises(ValueError):
        Naive().forecast(np.array([1.0, 2.0]), horizon=0)
