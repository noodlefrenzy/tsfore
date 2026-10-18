# agent-notes: { ctx: "tests for batched backtest windows and adapter forecast_batch", deps: [src/tsfore/backtest.py, src/tsfore/multivariate.py, src/tsfore/forecasters/timestral.py, src/tsfore/forecasters/chronos.py], state: active, last: "claude@2026-10-18", key: ["batched forecasts must equal per-window forecasts; padding must be neutral", "tiny random-init models check plumbing; -m weights checks real checkpoints"] }
import numpy as np
import pytest

from tsfore.backtest import backtest
from tsfore.data import Series, synthetic
from tsfore.forecasters import EVAL_LEVELS, QuantileForecast


def last_value(context, horizon):
    """Deterministic, context-dependent forecast so batched and per-window runs can be compared."""
    spread = np.linspace(-1, 1, len(EVAL_LEVELS)) * context.std()
    return QuantileForecast(context[-1] + np.tile(spread, (horizon, 1)))


class PerWindow:
    name = "m"

    def forecast(self, context, horizon):
        return last_value(context, horizon)


class Batched(PerWindow):
    def __init__(self, fail=False):
        self.batch_calls, self.window_calls, self.fail = [], 0, fail

    def forecast(self, context, horizon):
        self.window_calls += 1
        return super().forecast(context, horizon)

    def forecast_batch(self, contexts, horizon):
        self.batch_calls.append([c.size for c in contexts])
        if self.fail:
            raise RuntimeError("CUDA out of memory")
        return [last_value(c, horizon) for c in contexts]


def scores(df):
    return df.drop(columns=["seconds"]).reset_index(drop=True)


def test_backtest_batches_every_window_of_a_series_in_one_call():
    s = synthetic("random_walk", length=200, seed=3)
    model = Batched()
    res = backtest(s, [model], horizon=10, n_windows=4)
    assert model.batch_calls == [list(res["cutoff"])] and model.window_calls == 0
    assert res["seconds"].nunique() == 1 and res["seconds"].iloc[0] > 0  # batch time split evenly
    ref = backtest(s, [PerWindow()], horizon=10, n_windows=4)
    assert scores(res).equals(scores(ref))


def test_failed_batch_falls_back_to_per_window_forecasts():
    s = synthetic("random_walk", length=200, seed=3)
    model = Batched(fail=True)
    res = backtest(s, [model], horizon=10, n_windows=4)
    assert model.window_calls == 4 and res["error"].isna().all()
    assert scores(res).equals(scores(backtest(s, [PerWindow()], horizon=10, n_windows=4)))


def test_rows_stay_window_major_with_mixed_models():
    s = synthetic("random_walk", length=200, seed=3)
    res = backtest(s, [Batched(), PerWindow()], horizon=10, n_windows=3)
    assert list(res["window"]) == [0, 0, 1, 1, 2, 2]


class CompanionBatch:
    name = "cb"
    uses_companions = True

    def __init__(self):
        self.seen = None

    def forecast(self, context, horizon, companions):
        raise AssertionError("should have been batched")

    def forecast_batch(self, contexts, horizon, companions):
        self.seen = (contexts, companions)
        return [last_value(c, horizon) for c in contexts]


def test_companions_are_batched_and_cut_at_each_cutoff():
    n = 150
    base = synthetic("random_walk", length=n, seed=1)
    s = Series("pair", base.values, 1, None, 10, np.vstack([np.arange(n, dtype=float)]), ("up",))
    model = CompanionBatch()
    res = backtest(s, [model], horizon=10, n_windows=3)
    contexts, comps = model.seen
    for ctx, comp, cutoff in zip(contexts, comps, res["cutoff"], strict=True):
        assert ctx.size == cutoff and comp.shape == (1, cutoff)
        np.testing.assert_array_equal(comp, s.companions[:, :cutoff])


# --- adapters: ragged batches must match one-at-a-time forecasts --------------------------


def ragged_contexts(seed=0, lengths=(150, 130, 110)):
    rng = np.random.default_rng(seed)
    full = 100 + rng.normal(size=max(lengths)).cumsum()
    comps = np.vstack([50 + rng.normal(size=full.size).cumsum()])
    return [full[:n] for n in lengths], [comps[:, :n] for n in lengths]


def tiny_models():
    pytest.importorskip("torch")
    out = []
    for module in ("test_timestral_adapter", "test_chronos_adapter"):
        try:
            out.append(__import__(module).tiny_adapter())
        except pytest.skip.Exception:
            pass
    if not out:
        pytest.skip("neither foundation model is installed")
    return out


def assert_batch_matches_single(model, contexts, companions=None, atol=1e-4):
    if companions is None:
        batched = model.forecast_batch(contexts, 16)
        single = [model.forecast(c, 16) for c in contexts]
    else:
        batched = model.forecast_batch(contexts, 16, companions)
        single = [model.forecast(c, 16, k) for c, k in zip(contexts, companions, strict=True)]
    assert len(batched) == len(contexts)
    for b, s in zip(batched, single, strict=True):
        assert b.levels == EVAL_LEVELS
        np.testing.assert_allclose(b.values, s.values, rtol=1e-4, atol=atol, err_msg=model.name)


def test_adapter_batches_ragged_contexts_like_single_calls():
    contexts, _ = ragged_contexts()
    for adapter in tiny_models():
        assert_batch_matches_single(adapter, contexts)


@pytest.mark.parametrize("mode", ["cov", "joint"])
def test_companion_wrapper_batches_like_single_calls(mode):
    from tsfore.multivariate import WithCompanions

    contexts, comps = ragged_contexts()
    for adapter in tiny_models():
        assert_batch_matches_single(WithCompanions(adapter, mode), contexts, comps)


@pytest.mark.weights
@pytest.mark.parametrize(
    "name", ["timestral-5m", "chronos-2-small", "timestral-5m+cov", "chronos-2-small+cov"]
)
def test_real_checkpoints_batch_like_single_calls(name):
    from tsfore import datasets
    from tsfore.forecasters import build

    s = datasets.load_pair("brent_daily", ["wti_daily"])
    cutoffs = [s.values.size - 20 * k for k in (4, 3, 2, 1)]
    contexts = [s.values[:c] for c in cutoffs]
    comps = [s.companions[:, :c] for c in cutoffs] if "+" in name else None
    assert_batch_matches_single(build(name, s.season_length), contexts, comps, atol=1e-3)


class SlowLoad(Batched):
    """Loading takes a while; forecasting is instant."""

    def __init__(self):
        super().__init__()
        self.loads = 0

    def load(self):
        import time

        self.loads += 1
        time.sleep(0.2)


def test_load_time_is_not_charged_to_forecast_seconds():
    s = synthetic("random_walk", length=200, seed=3)
    model = SlowLoad()
    res = backtest(s, [model], horizon=10, n_windows=4)
    assert model.loads == 1 and res["seconds"].max() < 0.05


def test_failing_load_is_recorded_per_window():
    class BadLoad(PerWindow):
        def load(self):
            raise OSError("weights not in cache")

    res = backtest(synthetic("random_walk", length=200, seed=3), [BadLoad()], horizon=10, n_windows=2)
    assert res["error"].notna().all() and res["error"].str.contains("weights not in cache").all()


@pytest.mark.parametrize(
    ("module_name", "cls", "repo"),
    [
        ("timestral", "TimestralAdapter", "mistralai/Timestral-5M"),
        ("chronos", "ChronosAdapter", "autogluon/chronos-2-small"),
    ],
)
def test_adapters_share_loaded_weights_across_instances(monkeypatch, module_name, cls, repo):
    import importlib

    module = importlib.import_module(f"tsfore.forecasters.{module_name}")
    calls = []
    module._load_cached.cache_clear()
    monkeypatch.setattr(module, "_from_pretrained", lambda *a: calls.append(a) or object())
    try:
        a, b = getattr(module, cls)(repo, device="cpu"), getattr(module, cls)(repo, device="cpu")
        assert a.load() is b.load() and len(calls) == 1
    finally:
        module._load_cached.cache_clear()
