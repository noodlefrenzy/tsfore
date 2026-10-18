# agent-notes: { ctx: "tests for Timestral adapter, tiny random model + real-weights smoke", deps: [src/tsfore/forecasters/timestral.py], state: active, last: "tara@2026-10-17", key: ["random-init model checks plumbing only, never accuracy", "weights-marked tests are deselected by default; run with -m weights"] }
import numpy as np
import pytest

torch = pytest.importorskip("torch")
timestral = pytest.importorskip("timestral")

from tsfore.backtest import backtest  # noqa: E402
from tsfore.data import synthetic  # noqa: E402
from tsfore.forecasters import EVAL_LEVELS  # noqa: E402
from tsfore.forecasters.timestral import TimestralAdapter  # noqa: E402

# 21 levels like the released checkpoints: 0.01, 0.05..0.95 step 0.05, 0.99
KNOTS = (0.01, *[round(0.05 * i, 2) for i in range(1, 20)], 0.99)


def tiny_adapter() -> TimestralAdapter:
    config = timestral.TimestralConfig(
        patch_size=8,
        d_model=32,
        num_heads=4,
        mlp_hidden_dim=64,
        block_schedule=("time", "time_variate"),
        quantile_knots=KNOTS,
        block_size=4,
        context_length=256,
    )
    torch.manual_seed(0)
    model = timestral.TimestralModel(config)
    for p in model.parameters():
        torch.nn.init.normal_(p, std=0.05)
    return TimestralAdapter.from_forecaster(
        timestral.TimestralForecaster(model.eval()), name="timestral-tiny"
    )


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
    assert list(res["model"].unique()) == ["timestral-tiny"]
    assert res["wql"].notna().all()


def test_adapter_rejects_unknown_model_size():
    with pytest.raises(ValueError, match="Timestral-"):
        TimestralAdapter("mistralai/Timestral-1B")


@pytest.mark.weights
def test_real_5m_checkpoint_beats_naive_on_seasonal_series():
    from tsfore.backtest import summarize
    from tsfore.forecasters import Naive

    s = synthetic("seasonal", length=400, season_length=24, noise=0.2, seed=2)
    res = backtest(s, [Naive(), TimestralAdapter("mistralai/Timestral-5M")], horizon=48, n_windows=3)
    table = summarize(res)
    assert table.loc["timestral-5m", "mase"] < table.loc["naive", "mase"]


def test_auto_device_resolves_to_what_torch_sees():
    from tsfore.forecasters.timestral import resolve_device

    assert resolve_device("auto") == ("cuda" if torch.cuda.is_available() else "cpu")
    assert resolve_device("cpu") == "cpu"
