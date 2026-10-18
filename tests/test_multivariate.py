# agent-notes: { ctx: "tests for companion series: alignment, cutoff slicing, +cov/+joint wrappers", deps: [src/tsfore/multivariate.py, src/tsfore/datasets.py, src/tsfore/backtest.py, docs/adrs/0016-companion-series-for-multivariate-evaluation.md], state: active, last: "tara@2026-10-18", key: ["adapter tests reuse the tiny random-init models; they check plumbing, not accuracy"] }
import numpy as np
import pandas as pd
import pytest

from conftest import requires_snapshot
from tsfore import datasets
from tsfore.backtest import backtest
from tsfore.data import Series, synthetic
from tsfore.forecasters import EVAL_LEVELS, Naive, QuantileForecast, build


def test_daily_pair_is_inner_joined_on_dates():
    s = datasets.load_pair("brent_daily", ["wti_daily"])
    brent, wti = datasets.load("brent_daily"), datasets.load("wti_daily")
    shared = np.intersect1d(brent.dates, wti.dates)
    assert s.name == "brent_daily+wti_daily"
    assert s.companion_names == ("wti_daily",)
    assert s.companions.shape == (1, shared.size) and s.values.size == shared.size
    np.testing.assert_array_equal(s.dates, shared)
    i = np.searchsorted(wti.dates, shared[-1])
    assert s.companions[0, -1] == wti.values[i]
    assert (s.season_length, s.horizon) == (brent.season_length, brent.horizon)


def test_daily_companion_of_monthly_target_is_a_monthly_mean():
    requires_snapshot("sp500_monthly", "vix_daily")
    s = datasets.load_pair("sp500_monthly_logret", ["vix_daily"])
    vix = datasets.load("vix_daily")
    assert pd.Timestamp(s.dates[0]) >= pd.Timestamp("1990-01-01")
    month = pd.Timestamp(s.dates[5])
    in_month = pd.DatetimeIndex(vix.dates).to_period("M") == month.to_period("M")
    assert s.companions[0, 5] == pytest.approx(vix.values[in_month].mean())


def test_pairs_suite_loads_with_companions():
    requires_snapshot("sp500_monthly", "vix_daily")
    suite = datasets.load_suite("pairs")
    assert len(suite) >= 4
    assert all(s.companions is not None and s.companions.shape[1] == s.values.size for s in suite)


class Spy:
    """Records what the backtest hands a companion-aware model."""

    name = "spy"
    uses_companions = True

    def __init__(self):
        self.calls = []

    def forecast(self, context, horizon, companions):
        self.calls.append((context, companions))
        return QuantileForecast(np.repeat(context[-1], horizon * len(EVAL_LEVELS)).reshape(horizon, -1))


def companion_series(n=120):
    base = synthetic("random_walk", length=n, seed=1)
    comps = np.vstack([np.arange(n, dtype=float), -np.arange(n, dtype=float)])
    return Series("pair", base.values, 1, None, 10, comps, ("up", "down"))


def test_backtest_slices_companions_at_the_cutoff():
    s, spy = companion_series(), Spy()
    res = backtest(s, [spy], horizon=10, n_windows=3)
    assert res["error"].isna().all()
    for (context, comps), cutoff in zip(spy.calls, res["cutoff"], strict=True):
        assert context.size == cutoff and comps.shape == (2, cutoff)
        np.testing.assert_array_equal(comps, s.companions[:, :cutoff])


def test_univariate_models_ignore_companions():
    s = companion_series()
    plain = Series("pair", s.values, 1, None, 10)
    a = backtest(s, [Naive()], horizon=10, n_windows=2)
    b = backtest(plain, [Naive()], horizon=10, n_windows=2)
    np.testing.assert_array_equal(a["mase"], b["mase"])


def test_companion_model_on_plain_series_records_an_error():
    res = backtest(synthetic("seasonal", length=100), [Spy()], horizon=10, n_windows=2)
    assert res["error"].str.contains("companions").all()


def test_registry_builds_companion_wrappers():
    cov = build("timestral-5m+cov", season_length=1, device="cpu")
    assert cov.name == "timestral-5m+cov" and cov.uses_companions and cov.mode == "cov"
    joint = build("chronos-2+joint", season_length=1)
    assert joint.name == "chronos-2+joint" and joint.mode == "joint"
    with pytest.raises(ValueError, match="companions"):
        build("naive+cov", season_length=1)
    with pytest.raises(ValueError, match="mode"):
        build("chronos-2+sideways", season_length=1)


def tiny_models():
    pytest.importorskip("torch")
    out = []
    try:
        from test_timestral_adapter import tiny_adapter as tiny_timestral

        out.append(tiny_timestral())
    except pytest.skip.Exception:
        pass
    try:
        from test_chronos_adapter import tiny_adapter as tiny_chronos

        out.append(tiny_chronos())
    except pytest.skip.Exception:
        pass
    if not out:
        pytest.skip("neither foundation model is installed")
    return out


@pytest.mark.parametrize("mode", ["cov", "joint"])
def test_adapters_use_companions_and_return_eval_levels(mode):
    from tsfore.multivariate import WithCompanions

    rng = np.random.default_rng(0)
    ctx = 100 + rng.normal(size=150).cumsum()
    comps = np.vstack([50 + rng.normal(size=150).cumsum(), 20 + rng.normal(size=150).cumsum()])
    for adapter in tiny_models():
        fc = WithCompanions(adapter, mode).forecast(ctx, 16, comps)
        assert fc.levels == EVAL_LEVELS and fc.values.shape == (16, len(EVAL_LEVELS))
        assert np.all(np.isfinite(fc.values)) and np.all(np.diff(fc.values, axis=1) >= -1e-6)
        # Random-init weights make the effect tiny; any change proves the companions got in.
        assert not np.array_equal(fc.values, adapter.forecast(ctx, 16).values), adapter.name
