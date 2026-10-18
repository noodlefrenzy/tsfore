# agent-notes: { ctx: "tests for series loading and synthetic generators", deps: [src/tsfore/data.py], state: active, last: "tara@2026-10-17" }
import numpy as np
import pytest

from tsfore.data import Series, load_csv, synthetic


def test_load_csv_reads_value_column_in_time_order(tmp_path):
    p = tmp_path / "s.csv"
    p.write_text("date,y\n2020-03,3\n2020-01,1\n2020-02,2\n")
    s = load_csv(p, value_col="y", time_col="date", season_length=12)
    np.testing.assert_allclose(s.values, [1, 2, 3])
    assert s.name == "s"
    assert s.season_length == 12


def test_load_csv_rejects_missing_column(tmp_path):
    p = tmp_path / "s.csv"
    p.write_text("a,b\n1,2\n")
    with pytest.raises(ValueError, match="y"):
        load_csv(p, value_col="y")


@pytest.mark.parametrize("kind", ["seasonal", "trend", "random_walk", "intermittent"])
def test_synthetic_is_reproducible_and_finite(kind):
    a = synthetic(kind, length=100, season_length=12, seed=3)
    b = synthetic(kind, length=100, season_length=12, seed=3)
    assert isinstance(a, Series)
    assert a.values.shape == (100,)
    assert np.all(np.isfinite(a.values))
    np.testing.assert_array_equal(a.values, b.values)


def test_synthetic_intermittent_is_non_negative_with_zeros():
    s = synthetic("intermittent", length=300, seed=0)
    assert s.values.min() >= 0
    assert (s.values == 0).mean() > 0.3


def test_synthetic_rejects_unknown_kind():
    with pytest.raises(ValueError):
        synthetic("nope")
