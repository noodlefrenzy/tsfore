# agent-notes: { ctx: "tests for Chronos-2 adapter, tiny random model + real-weights smoke", deps: [src/tsfore/forecasters/chronos.py], state: active, last: "claude@2026-10-17", key: ["random-init model checks plumbing only, never accuracy", "weights-marked tests are deselected by default; run with -m weights"] }
import numpy as np
import pytest

torch = pytest.importorskip("torch")
chronos = pytest.importorskip("chronos")

from tsfore.backtest import backtest  # noqa: E402
from tsfore.data import synthetic  # noqa: E402
from tsfore.forecasters import EVAL_LEVELS  # noqa: E402
from tsfore.forecasters.chronos import ChronosAdapter  # noqa: E402

# Same 21-level grid as the released amazon/chronos-2 config.
KNOTS = [0.01, *[round(0.05 * i, 2) for i in range(1, 20)], 0.99]


def tiny_adapter() -> ChronosAdapter:
    from chronos.chronos2 import Chronos2CoreConfig, Chronos2Model, Chronos2Pipeline

    config = Chronos2CoreConfig(
        d_model=32,
        d_kv=8,
        d_ff=64,
        num_layers=1,
        num_heads=4,
        chronos_config={
            "context_length": 256,
            "input_patch_size": 16,
            "input_patch_stride": 16,
            "output_patch_size": 16,
            "max_output_patches": 4,
            "quantiles": KNOTS,
            "use_reg_token": True,
            "use_arcsinh": True,
            "time_encoding_scale": 256,
        },
    )
    torch.manual_seed(0)
    model = Chronos2Model(config).eval()
    return ChronosAdapter.from_pipeline(Chronos2Pipeline(model), name="chronos-tiny")


def test_adapter_returns_eval_levels_in_raw_space():
    ctx = 100 + np.sin(np.arange(120) / 3)
    fc = tiny_adapter().forecast(ctx, horizon=20)
    assert fc.levels == EVAL_LEVELS
    assert fc.values.shape == (20, len(EVAL_LEVELS))
    assert np.all(np.isfinite(fc.values))
    assert np.all(np.diff(fc.values, axis=1) >= -1e-6)


def test_adapter_runs_inside_backtest():
    s = synthetic("seasonal", length=200, season_length=12, seed=0)
    res = backtest(s, [tiny_adapter()], horizon=24, n_windows=2)
    assert list(res["model"].unique()) == ["chronos-tiny"]
    assert res["wql"].notna().all()


def test_adapter_rejects_unknown_checkpoint():
    with pytest.raises(ValueError, match="chronos-2"):
        ChronosAdapter("amazon/chronos-2-xl")


@pytest.mark.weights
def test_real_small_checkpoint_beats_naive_on_seasonal_series():
    from tsfore.backtest import summarize
    from tsfore.forecasters import Naive

    s = synthetic("seasonal", length=400, season_length=24, noise=0.2, seed=2)
    res = backtest(s, [Naive(), ChronosAdapter("autogluon/chronos-2-small")], horizon=48, n_windows=3)
    table = summarize(res)
    assert table.loc["chronos-2-small", "mase"] < table.loc["naive", "mase"]
