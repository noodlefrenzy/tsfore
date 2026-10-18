# agent-notes: { ctx: "tests that site data matches the harness leaderboard", deps: [scripts/build_site_data.py, src/tsfore/evaluate.py], state: active, last: "claude@2026-10-18", key: ["reads the committed gzipped CSVs in docs/benchmarks/data"] }
import importlib.util
from pathlib import Path

import pytest

from tsfore.evaluate import leaderboard

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def site():
    spec = importlib.util.spec_from_file_location("build_site_data", ROOT / "scripts" / "build_site_data.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_board_matches_the_harness_leaderboard(site):
    df = site.load("finance-48w-2026-10-18")
    lb = leaderboard(df)
    for row in site.board(df):
        assert row["rel_mase"] == pytest.approx(lb.loc[row["model"], "rel_mase"], abs=1e-6)
        assert row["rel_wql"] == pytest.approx(lb.loc[row["model"], "rel_wql"], abs=1e-6)


def test_per_series_naive_is_the_unit(site):
    cells = site.per_series(site.load("pairs-36w-2026-10-18"))
    assert all(c["naive"]["mase"] == 1.0 and c["naive"]["wql"] == 1.0 for c in cells.values())


def test_paired_counts_every_window(site):
    df = site.load("finance-48w-2026-10-18")
    (row,) = site.paired(df, [("timestral-209m", "chronos-2")])
    assert row["n"] == 11 * 48 and 0 <= row["won"] <= row["n"] and 0 < row["p"] < 1
