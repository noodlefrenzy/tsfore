# agent-notes: { ctx: "tests for finance dataset registry, cleaning, loading", deps: [src/tsfore/datasets.py], state: active, last: "tara@2026-10-18", key: ["clean() is tested on inline CSV text; no network"] }
import io

import numpy as np
import pandas as pd
import pytest

from conftest import requires_snapshot
from tsfore import datasets
from tsfore.datasets import DATA_DIR, FINANCE, DatasetSpec, clean, load, load_suite


def spec(**kw) -> DatasetSpec:
    base = dict(
        id="x",
        repo="datasets/x",
        sha="0" * 40,
        path="data/x.csv",
        date_col="Date",
        value_col="Price",
        freq="M",
        season_length=12,
        horizon=12,
        description="test",
    )
    return DatasetSpec(**{**base, **kw})


def raw(text: str) -> pd.DataFrame:
    return pd.read_csv(io.StringIO(text))


def test_clean_sorts_drops_missing_and_placeholder_zeros():
    df = raw("Date,Price\n2020-03-01,3\n2020-01-01,1\n2020-02-01,\n2020-04-01,0.0\n")
    out = clean(df, spec(drop_zeros=True))
    assert list(out.columns) == ["date", "value"]
    assert list(out["value"]) == [1.0, 3.0]
    assert out["date"].is_monotonic_increasing


def test_clean_keeps_zeros_unless_told_and_applies_start():
    df = raw("Date,Price\n2019-12-01,5\n2020-01-01,0\n2020-02-01,2\n")
    out = clean(df, spec(start="2020-01-01"))
    assert list(out["value"]) == [0.0, 2.0]


def test_clean_filters_long_format_rows():
    df = raw("Date,Country,Rate\n2020-01-01,Euro,0.9\n2020-01-01,Japan,110\n2020-01-02,Euro,0.91\n")
    out = clean(df, spec(value_col="Rate", filter_col="Country", filter_value="Euro"))
    assert list(out["value"]) == [0.9, 0.91]


def test_clean_rejects_missing_column():
    with pytest.raises(ValueError, match="Price"):
        clean(raw("Date,Other\n2020-01-01,1\n"), spec())


def test_registry_specs_are_consistent():
    assert len(FINANCE) >= 8
    for s in FINANCE.values():
        assert len(s.sha) == 40, s.id
        assert s.horizon >= 1 and s.season_length >= 1
        assert s.freq in ("M", "B")
        if s.derived_from:
            assert s.derived_from in FINANCE


@pytest.mark.parametrize("dataset_id", sorted(FINANCE))
def test_snapshot_loads(dataset_id):
    requires_snapshot(dataset_id)
    s = load(dataset_id)
    spec_ = FINANCE[dataset_id]
    assert s.name == dataset_id
    assert s.season_length == spec_.season_length
    assert s.values.size >= 5 * spec_.horizon
    assert np.all(np.isfinite(s.values))
    assert s.dates is not None and s.dates.size == s.values.size


def test_log_return_series_matches_price_series():
    requires_snapshot("sp500_monthly")
    price = load("sp500_monthly").values
    ret = load("sp500_monthly_logret").values
    np.testing.assert_allclose(ret, np.diff(np.log(price)))


def test_load_suite_returns_every_finance_series():
    requires_snapshot("sp500_monthly", "vix_daily")
    assert [s.name for s in load_suite("finance")] == list(FINANCE)
    with pytest.raises(ValueError):
        load_suite("nope")


RESTRICTED = {"sp500_monthly", "sp500_monthly_logret", "vix_daily"}


def test_restricted_sources_are_not_bundled():
    # S&P DJI and Cboe terms forbid redistribution, so these are fetched, never committed.
    assert {k for k, s in FINANCE.items() if not datasets.is_bundled(k)} == RESTRICTED


@pytest.mark.parametrize("dataset_id", sorted(k for k in FINANCE if k not in RESTRICTED))
def test_bundled_snapshot_is_committed(dataset_id):
    spec_ = FINANCE[dataset_id]
    assert (DATA_DIR / f"{spec_.derived_from or spec_.id}.csv").exists()


def _fake_fetch(calls):
    def fetch(ids, root):
        calls.append(list(ids))
        for i in ids:
            (root / f"{i}.csv").write_text("date,value\n2020-01-01,1.0\n2020-02-01,2.0\n2020-03-01,4.0\n")
        return [root / f"{i}.csv" for i in ids]

    return fetch


def test_unbundled_snapshot_is_fetched_on_first_load(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(datasets, "fetch", _fake_fetch(calls))
    assert list(load("vix_daily", root=tmp_path).values) == [1.0, 2.0, 4.0]
    np.testing.assert_allclose(load("sp500_monthly_logret", root=tmp_path).values, np.log([2.0, 2.0]))
    load("vix_daily", root=tmp_path)  # cached now: no second fetch
    assert calls == [["vix_daily"], ["sp500_monthly"]]


def test_missing_bundled_snapshot_is_an_error_not_a_fetch(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(datasets, "fetch", _fake_fetch(calls))
    with pytest.raises(FileNotFoundError):
        load("gold_monthly", root=tmp_path)
    assert calls == []
