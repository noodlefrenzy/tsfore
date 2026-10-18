# agent-notes: { ctx: "tests for multi-series benchmark, relative scores, report", deps: [src/tsfore/evaluate.py], state: active, last: "tara@2026-10-17" }
import numpy as np
import pandas as pd
import pytest

from tsfore.data import synthetic
from tsfore.evaluate import leaderboard, report_markdown, run_suite
from tsfore.forecasters import Naive, SeasonalNaive


def fake_results() -> pd.DataFrame:
    rows = []
    # series a: model m is 2x worse than baseline; series b: 0.5x -> geometric mean 1.0
    for series, ratio in (("a", 2.0), ("b", 0.5)):
        for w in range(2):
            rows.append({"series": series, "model": "seasonal_naive", "window": w, "mase": 1.0, "wql": 0.1})
            rows.append({"series": series, "model": "m", "window": w, "mase": ratio, "wql": 0.1 * ratio})
    return pd.DataFrame(rows)


def test_leaderboard_uses_geometric_mean_of_ratios_to_baseline():
    board = leaderboard(fake_results(), baseline="seasonal_naive")
    assert board.loc["seasonal_naive", "rel_mase"] == pytest.approx(1.0)
    assert board.loc["m", "rel_mase"] == pytest.approx(1.0)
    assert board.loc["m", "rel_wql"] == pytest.approx(1.0)
    assert board.loc["m", "n_series"] == 2


def test_leaderboard_ranks_models_per_series():
    board = leaderboard(fake_results(), baseline="seasonal_naive")
    # m wins on b, loses on a -> both average rank 1.5
    assert board.loc["m", "avg_rank"] == pytest.approx(1.5)


def test_leaderboard_requires_baseline_present():
    with pytest.raises(ValueError, match="baseline"):
        leaderboard(fake_results(), baseline="nope")


def test_run_suite_builds_models_per_series_and_isolates_failures():
    class Broken(Naive):
        name = "broken"

        def forecast(self, context, horizon):
            raise RuntimeError("boom")

    suite = [
        synthetic("seasonal", length=120, season_length=12, seed=0),
        synthetic("trend", length=100, season_length=4, seed=1),
    ]
    seasons = []

    def factory(series):
        seasons.append(series.season_length)
        return [SeasonalNaive(series.season_length), Broken()]

    res = run_suite(suite, factory, n_windows=2, horizon=6)
    assert seasons == [12, 4]
    broken = res[res["model"] == "broken"]
    assert broken["mase"].isna().all()
    assert broken["error"].str.contains("boom").all()
    assert res.loc[res["model"] == "seasonal_naive", "error"].isna().all()


def test_report_markdown_has_leaderboard_and_per_series_table():
    suite = [synthetic("seasonal", length=120, season_length=12, seed=0)]
    res = run_suite(suite, lambda s: [Naive(), SeasonalNaive(12)], n_windows=2, horizon=12)
    md = report_markdown(res, title="demo")
    assert md.startswith("# demo")
    assert "| seasonal_naive |" in md and "| naive |" in md
    assert "synthetic-seasonal" in md
    assert not np.isnan(leaderboard(res).loc["naive", "rel_mase"])
