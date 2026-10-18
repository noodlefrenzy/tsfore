# agent-notes: { ctx: "tests for point and probabilistic metrics", deps: [src/tsfore/metrics.py], state: active, last: "tara@2026-10-17" }
import numpy as np
import pytest

from tsfore.metrics import coverage, directional_accuracy, mae, mase, rmse, smape, wql


def test_point_metrics_on_known_values():
    y = np.array([1.0, 2.0, 3.0, 4.0])
    f = np.array([2.0, 2.0, 2.0, 2.0])
    assert mae(y, f) == pytest.approx(1.0)
    assert rmse(y, f) == pytest.approx(np.sqrt(1.5))
    # sMAPE per point: 2|y-f|/(|y|+|f|) -> 2/3, 0, 2/5, 4/6
    assert smape(y, f) == pytest.approx(np.mean([2 / 3, 0, 2 / 5, 4 / 6]))


def test_mase_scales_by_in_sample_seasonal_naive_error():
    train = np.array([0.0, 1.0, 0.0, 1.0, 0.0, 1.0])
    # seasonal naive with m=2 is perfect in-sample -> scale 0 -> undefined
    with pytest.raises(ValueError):
        mase(np.array([1.0]), np.array([1.0]), train, season_length=2)
    # m=1: in-sample |diff| is always 1 -> MASE == MAE
    y, f = np.array([3.0, 5.0]), np.array([1.0, 1.0])
    assert mase(y, f, train, season_length=1) == pytest.approx(3.0)


def test_wql_is_zero_for_perfect_quantiles_and_penalises_miss():
    y = np.array([10.0, 20.0])
    levels = (0.1, 0.5, 0.9)
    perfect = np.repeat(y[:, None], 3, axis=1)
    assert wql(y, perfect, levels) == pytest.approx(0.0)
    off = perfect + 5.0
    assert wql(y, off, levels) > 0.0


def test_wql_median_only_equals_half_normalised_mae():
    # With only q=0.5, pinball loss = 0.5|e|, so WQL = 2*0.5*sum|e|/sum|y| = sum|e|/sum|y|.
    y = np.array([4.0, 6.0])
    q = np.array([[5.0], [3.0]])
    assert wql(y, q, (0.5,)) == pytest.approx((1 + 3) / 10)


def test_coverage_counts_hits_inside_interval():
    y = np.array([0.0, 5.0, 10.0, 15.0])
    lo = np.array([-1.0, 6.0, 9.0, 14.0])
    hi = np.array([1.0, 7.0, 11.0, 14.5])
    assert coverage(y, lo, hi) == pytest.approx(0.5)


def test_metrics_reject_shape_mismatch():
    with pytest.raises(ValueError):
        mae(np.zeros(3), np.zeros(4))


def test_directional_accuracy_scores_sign_of_change_from_last_observation():
    last = 10.0
    y = np.array([11.0, 9.0, 12.0, 8.0])
    f = np.array([10.5, 10.5, 9.5, 9.0])  # up, up, down, down
    assert directional_accuracy(y, f, last) == pytest.approx(0.5)


def test_directional_accuracy_is_nan_for_a_flat_forecast():
    assert np.isnan(directional_accuracy(np.array([11.0, 9.0]), np.array([10.0, 10.0]), 10.0))
