# agent-notes: { ctx: "smoke tests for the tsfore CLI subcommands", deps: [src/tsfore/cli.py], state: active, last: "tara@2026-10-18" }
from tsfore import datasets
from tsfore.cli import main


def test_data_list_names_every_dataset(capsys):
    assert main(["data", "list"]) == 0
    out = capsys.readouterr().out
    assert "vix_daily" in out and "sp500_monthly_logret" in out


def test_run_on_bundled_dataset_uses_its_season_and_horizon(capsys):
    assert main(["run", "--dataset", "gold_monthly", "--models", "naive,seasonal_naive"]) == 0
    out = capsys.readouterr().out
    assert "3 windows x h=12" in out and "seasonal_naive" in out


def test_bench_writes_csv_and_markdown(tmp_path, capsys, monkeypatch):
    # Bundled series only, so the test stays offline on a fresh clone.
    monkeypatch.setitem(
        datasets.SUITES, "finance_monthly", ["us10y_monthly", "cpi_us_monthly", "gold_monthly"]
    )
    rc = main(
        [
            "bench",
            "--suite",
            "finance_monthly",
            "--models",
            "naive,seasonal_naive",
            "--windows",
            "2",
            "--out",
            str(tmp_path),
        ]
    )
    assert rc == 0
    assert len(list(tmp_path.glob("finance_monthly-*.csv"))) == 1
    md = next(tmp_path.glob("finance_monthly-*.md")).read_text()
    assert "## Leaderboard" in md and "| 3 |" in md  # n_series renders as an int
