# agent-notes: { ctx: "tsfore command line: run, bench, data subcommands", deps: [src/tsfore/backtest.py, src/tsfore/evaluate.py, src/tsfore/datasets.py, src/tsfore/data.py, src/tsfore/forecasters/__init__.py], state: active, last: "claude@2026-10-17" }
"""`tsfore` CLI.

tsfore run --synthetic seasonal --season 12 --horizon 24 --models naive,seasonal_naive,auto_ets
tsfore run --dataset vix_daily --models seasonal_naive,auto_arima,timestral-5m
tsfore bench --suite finance --models seasonal_naive,auto_ets,auto_theta --out results/
tsfore data list | tsfore data fetch
"""

import argparse
import sys
from datetime import date
from pathlib import Path

import pandas as pd

from tsfore import datasets
from tsfore.backtest import backtest, summarize
from tsfore.data import SYNTHETIC_KINDS, load_csv, synthetic
from tsfore.evaluate import leaderboard, report_markdown, run_suite
from tsfore.forecasters import build

DEFAULT_BENCH_MODELS = "naive,seasonal_naive,historic_average,rw_drift,auto_ets,auto_arima,auto_theta"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="tsfore", description="Forecast backtests and benchmarks.")
    sub = p.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="backtest one series")
    src = run.add_mutually_exclusive_group(required=True)
    src.add_argument("--csv", help="CSV file with one series")
    src.add_argument("--synthetic", choices=SYNTHETIC_KINDS, help="generate a synthetic series")
    src.add_argument("--dataset", choices=list(datasets.FINANCE), help="a bundled finance series")
    run.add_argument("--value-col", default="y")
    run.add_argument("--time-col")
    run.add_argument("--season", type=int, help="season length (default: the dataset's, else 1)")
    run.add_argument("--horizon", type=int, help="default: the dataset's horizon")
    run.add_argument("--windows", type=int, default=3)
    run.add_argument("--models", default="naive,seasonal_naive")
    run.add_argument("--out", help="write per-window results to this CSV")

    bench = sub.add_parser("bench", help="benchmark models over a dataset suite")
    bench.add_argument("--suite", default="finance", choices=[*datasets.SUITES, "pairs"])
    bench.add_argument("--models", default=DEFAULT_BENCH_MODELS)
    bench.add_argument("--windows", type=int, default=3)
    bench.add_argument("--baseline", default="naive", help="reference model for rel_* scores")
    bench.add_argument("--out", type=Path, help="directory for results CSV and Markdown report")

    data = sub.add_parser("data", help="list or re-fetch the bundled finance datasets")
    data.add_argument("action", choices=["list", "fetch"])

    for sp in (run, bench):
        sp.add_argument(
            "--offline", action="store_true", help="load Timestral weights from the HF cache only"
        )
        sp.add_argument(
            "--device", default="auto", help="Timestral/Chronos device: auto (cuda if available), cuda, cpu"
        )
    return p.parse_args(argv)


def _factory(names: list[str], offline: bool, device: str):
    return lambda series: [build(m, series.season_length, offline, device) for m in names]


def cmd_run(args: argparse.Namespace) -> int:
    if args.dataset:
        series = datasets.load(args.dataset)
    elif args.csv:
        series = load_csv(args.csv, args.value_col, args.time_col, args.season or 1)
    else:
        series = synthetic(args.synthetic, season_length=args.season or 1)
    season = args.season or series.season_length
    horizon = args.horizon or series.horizon
    if horizon is None:
        sys.exit("--horizon is required for --csv and --synthetic")
    models = [build(m, season, args.offline, args.device) for m in args.models.split(",")]
    results = backtest(series, models, horizon, args.windows)
    if args.out:
        results.to_csv(args.out, index=False)
    with pd.option_context("display.float_format", "{:.4f}".format, "display.width", 140):
        print(f"{series.name}: {series.values.size} points, {args.windows} windows x h={horizon}")
        print(summarize(results))
    return 0


def cmd_bench(args: argparse.Namespace) -> int:
    names = args.models.split(",")
    results = run_suite(
        datasets.load_suite(args.suite), _factory(names, args.offline, args.device), args.windows
    )
    title = f"{args.suite} benchmark, {date.today().isoformat()}"
    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
        stem = f"{args.suite}-{date.today().isoformat()}"
        results.to_csv(args.out / f"{stem}.csv", index=False)
        (args.out / f"{stem}.md").write_text(report_markdown(results, title, args.baseline))
        print(f"wrote {args.out / stem}.csv and .md")
    with pd.option_context("display.float_format", "{:.3f}".format, "display.width", 140):
        print(title)
        print(leaderboard(results, args.baseline))
    return 0


def cmd_data(args: argparse.Namespace) -> int:
    if args.action == "fetch":
        for path in datasets.fetch():
            print(f"wrote {path}")
        return 0
    for spec in datasets.FINANCE.values():
        print(
            f"{spec.id:22s} {spec.freq}  m={spec.season_length:<3d} h={spec.horizon:<3d} {spec.description}"
        )
    return 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    return {"run": cmd_run, "bench": cmd_bench, "data": cmd_data}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
