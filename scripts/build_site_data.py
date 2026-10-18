# agent-notes: { ctx: "builds site/data.js from committed benchmark CSVs", deps: [src/tsfore/evaluate.py, src/tsfore/datasets.py, docs/benchmarks/data/], state: active, last: "claude@2026-10-18", key: ["every table and chart on the site comes from here; prose numbers trace to docs/benchmarks reports", "run: uv run python scripts/build_site_data.py"] }
"""Build `site/data.js` from the gzipped per-window CSVs in `docs/benchmarks/data/`.

The site reads `window.TSFORE`. Leaderboards come from `tsfore.evaluate.leaderboard`,
so they match the Markdown reports exactly.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import wilcoxon

from tsfore import datasets
from tsfore.evaluate import leaderboard

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "benchmarks" / "data"

FAMILIES = {
    "stats": ["naive", "historic_average", "auto_ets", "auto_arima"],
    "timestral": ["timestral-5m", "timestral-28m", "timestral-123m", "timestral-209m"],
    "chronos": ["chronos-2-small", "chronos-2"],
}
FINANCE_PAIRS = [
    ("timestral-209m", "naive"),
    ("chronos-2", "naive"),
    ("auto_ets", "naive"),
    ("timestral-209m", "chronos-2"),
    ("timestral-209m", "auto_ets"),
    ("chronos-2", "auto_ets"),
    ("timestral-28m", "timestral-209m"),
    ("timestral-5m", "timestral-209m"),
    ("chronos-2-small", "chronos-2"),
]
COMPANION_PAIRS = [
    ("timestral-209m+cov", "timestral-209m"),
    ("timestral-209m+joint", "timestral-209m"),
    ("timestral-28m+cov", "timestral-28m"),
    ("timestral-28m+joint", "timestral-28m"),
    ("chronos-2+cov", "chronos-2"),
    ("chronos-2-small+cov", "chronos-2-small"),
]


def load(name: str) -> pd.DataFrame:
    return pd.read_csv(DATA / f"{name}.csv.gz")


def _round(x, nd=6):
    return None if x is None or not np.isfinite(x) else round(float(x), nd)


def board(df: pd.DataFrame) -> list[dict]:
    lb = leaderboard(df)
    cols = ["rel_mase", "rel_wql", "avg_rank", "coverage_80", "direction", "seconds"]
    return [{"model": m, **{c: _round(lb.loc[m, c]) for c in cols}} for m in lb.index]


def per_series(df: pd.DataFrame) -> dict[str, dict[str, dict]]:
    """Per series and model: MASE and WQL relative to naive, plus 80% coverage."""
    m = df.groupby(["series", "model"])[["mase", "wql", "coverage_80"]].mean()
    base = m.xs("naive", level="model")
    out: dict[str, dict[str, dict]] = {}
    for (series, model), row in m.iterrows():
        out.setdefault(series, {})[model] = {
            "mase": _round(row.mase / base.loc[series, "mase"]),
            "wql": _round(row.wql / base.loc[series, "wql"]),
            "cov": _round(row.coverage_80, 3),
        }
    return out


def paired(df: pd.DataFrame, pairs: list[tuple[str, str]]) -> list[dict]:
    """Paired Wilcoxon on per-window log MASE ratios; negative favours `a`."""
    wide = df.pivot_table(index=["series", "window"], columns="model", values="mase")
    rows = []
    for a, b in pairs:
        r = np.log(wide[a] / wide[b]).replace([np.inf, -np.inf], np.nan).dropna()
        rows.append(
            {
                "a": a,
                "b": b,
                "median": _round(float(np.median(r)), 5),
                "won": int((r < 0).sum()),
                "n": int(r.size),
                "p": float(f"{wilcoxon(r).pvalue:.3g}"),
            }
        )
    return rows


def ablation(df: pd.DataFrame, models: list[str], drops: list[list[str]]) -> list[dict]:
    """Geometric-mean relative scores with some series left out."""
    cells = per_series(df)
    out = []
    for drop in drops:
        keep = [s for s in cells if s not in drop]
        row = {"drop": drop}
        for model in models:
            row[model] = {
                k: _round(float(np.exp(np.mean([np.log(cells[s][model][k]) for s in keep]))), 3)
                for k in ("mase", "wql")
            }
        out.append(row)
    return out


def spans(suite: str, windows: int) -> dict[str, dict]:
    out = {}
    for s in datasets.load_suite(suite):
        first = s.values.size - windows * s.horizon
        out[s.name] = {
            "horizon": s.horizon,
            "from": str(pd.Timestamp(s.dates[first]).date()),
            "to": str(pd.Timestamp(s.dates[-1]).date()),
            "context": int(first),
        }
    return out


def build() -> dict:
    fin, fin6 = load("finance-48w-2026-10-18"), load("finance-6w-2026-10-17")
    prs, prs12 = load("pairs-36w-2026-10-18"), load("pairs-12w-2026-10-17")
    headline = ["timestral-209m", "chronos-2", "auto_ets"]
    return {
        "generated": "2026-10-18",
        "families": FAMILIES,
        "finance": {
            "windows": 48,
            "board": board(fin),
            "series": per_series(fin),
            "spans": spans("finance", 48),
            "paired": paired(fin, FINANCE_PAIRS),
            "ablation": ablation(fin, headline, [[], ["natgas_daily"], ["natgas_daily", "cpi_us_monthly"]]),
            "before": {"windows": 6, "board": board(fin6)},
        },
        "pairs": {
            "windows": 36,
            "board": board(prs),
            "series": per_series(prs),
            "spans": spans("pairs", 36),
            "paired": paired(prs, COMPANION_PAIRS),
            "before": {
                "windows": 12,
                "board": board(prs12),
                "paired": paired(prs12, COMPANION_PAIRS[:3] + COMPANION_PAIRS[4:]),
            },
        },
    }


def main(out: Path = ROOT / "site" / "data.js") -> None:
    payload = json.dumps(build(), separators=(",", ":"))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        f'// agent-notes: {{ ctx: "generated benchmark data for the results site", deps: [scripts/build_site_data.py], state: active, last: "claude@2026-10-18" }}\n// generated by scripts/build_site_data.py; do not edit\nwindow.TSFORE = {payload};\n'
    )
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)", file=sys.stderr)


if __name__ == "__main__":
    main()
