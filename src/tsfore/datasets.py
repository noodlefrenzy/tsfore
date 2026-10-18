# agent-notes: { ctx: "finance dataset registry, pinned fetch, cleaning, loading", deps: [src/tsfore/data.py, data/finance/README.md], state: active, last: "sato@2026-10-18", key: ["pairs suite = target + companions inner-joined on dates (ADR-0016)", "sources pinned by commit SHA of github.com/datasets repos", "bundled=False (S&P 500, VIX): never committed, fetched on first load"], stale-risk: "upstream repos restructure files; bump sha deliberately" }
"""Public financial series for evaluation.

Every series comes from a `github.com/datasets/*` repository, pinned to a commit so a
fetch is reproducible. Cleaned snapshots (`date,value`) of the public-domain series are
committed under `data/finance/`. The S&P 500 and VIX are not: their owners forbid
redistribution, so `load()` fetches them on first use into the same (gitignored) path.
`fetch()` re-downloads any of them; bump a `sha` deliberately to refresh.
"""

import urllib.request
from dataclasses import dataclass, replace
from pathlib import Path

import numpy as np
import pandas as pd

from tsfore.data import Series

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "finance"


@dataclass(frozen=True)
class DatasetSpec:
    id: str
    repo: str
    sha: str
    path: str
    date_col: str
    value_col: str
    freq: str  # "M" monthly, "B" business daily
    season_length: int
    horizon: int
    description: str
    start: str | None = None
    drop_zeros: bool = False  # upstream pads unpublished months with 0.0
    filter_col: str | None = None
    filter_value: str | None = None
    derived_from: str | None = None  # computed from another snapshot instead of fetched
    transform: str | None = None  # "log_return"
    bundled: bool = True  # False: source terms forbid redistribution; fetched on first load

    @property
    def url(self) -> str:
        return f"https://raw.githubusercontent.com/{self.repo}/{self.sha}/{self.path}"


def _monthly(id, repo, sha, path, value_col, description, **kw) -> DatasetSpec:
    return DatasetSpec(id, repo, sha, path, "Date", value_col, "M", 12, 12, description, **kw)


def _daily(id, repo, sha, path, value_col, description, date_col="Date", **kw) -> DatasetSpec:
    # Business days: weekly "season" of 5; horizon of 20 trading days (about a month).
    return DatasetSpec(id, repo, sha, path, date_col, value_col, "B", 5, 20, description, **kw)


_SP500 = ("datasets/s-and-p-500", "07b81e6af68239acd65b901a11844d6d95db6ead", "data/data.csv")
_OIL = ("datasets/oil-prices", "c24526249395d1df291d2a6a63a510939cf65556")
_FX = ("datasets/exchange-rates", "c023dd8b8f879610641a7391c0394c3bbb42d0f7", "data/daily.csv")

_SPECS = [
    _monthly(
        "sp500_monthly",
        *_SP500,
        "SP500",
        "S&P 500 composite, monthly average (Shiller)",
        drop_zeros=True,
        bundled=False,
    ),
    DatasetSpec(
        "sp500_monthly_logret",
        *_SP500,
        "Date",
        "SP500",
        "M",
        12,
        12,
        "S&P 500 monthly log returns (near white noise)",
        derived_from="sp500_monthly",
        transform="log_return",
    ),
    _monthly(
        "us10y_monthly",
        "datasets/bond-yields-us-10y",
        "238315525deafefcf8334536990cafe23dc5eac4",
        "data/monthly.csv",
        "Rate",
        "US 10-year Treasury yield, % (Fed H.15)",
    ),
    _monthly(
        "cpi_us_monthly",
        "datasets/cpi-us",
        "dceeb872c839cd4932cf460995c1872ebb7b75d8",
        "data/cpiai.csv",
        "Index",
        "US CPI-U all items index (BLS)",
    ),
    _monthly(
        "gold_monthly",
        "datasets/gold-prices",
        "f6e97610178379ef8db280702fcaa3ec0875c5c2",
        "data/monthly.csv",
        "Price",
        "Gold, USD/oz, since the 1971 end of the fixed price",
        start="1971-01-01",
    ),
    _daily(
        "vix_daily",
        "datasets/finance-vix",
        "3dbea23c70cc2afbeeec8ac232c9ec72ac26ac21",
        "data/vix-daily.csv",
        "CLOSE",
        "CBOE VIX close (mean-reverting)",
        date_col="DATE",
        bundled=False,
    ),
    _daily(
        "wti_daily", *_OIL, "data/wti-daily.csv", "Price", "WTI crude spot, USD/bbl (negative in Apr 2020)"
    ),
    _daily("brent_daily", *_OIL, "data/brent-daily.csv", "Price", "Brent crude spot, USD/bbl"),
    _daily(
        "natgas_daily",
        "datasets/natural-gas",
        "64843b5bb8ed967f4af563eac2c1782380e2f2e0",
        "data/daily.csv",
        "Price",
        "Henry Hub natural gas spot, USD/MMBtu (spiky)",
    ),
    _daily(
        "eur_per_usd_daily",
        *_FX,
        "Exchange rate",
        "EUR per USD (FRED via datasets)",
        filter_col="Country",
        filter_value="Euro",
    ),
    _daily(
        "jpy_per_usd_daily",
        *_FX,
        "Exchange rate",
        "JPY per USD (FRED via datasets)",
        filter_col="Country",
        filter_value="Japan",
    ),
]

FINANCE: dict[str, DatasetSpec] = {s.id: s for s in _SPECS}
SUITES: dict[str, list[str]] = {
    "finance": list(FINANCE),
    "finance_monthly": [k for k, s in FINANCE.items() if s.freq == "M"],
    "finance_daily": [k for k, s in FINANCE.items() if s.freq == "B"],
}

# Target -> companions for the `pairs` suite (ADR-0016). Each companion is a plausible
# lead or co-mover: the other crude benchmark, the other USD cross, implied volatility.
PAIRS: dict[str, tuple[str, ...]] = {
    "brent_daily": ("wti_daily",),
    "wti_daily": ("brent_daily",),
    "eur_per_usd_daily": ("jpy_per_usd_daily",),
    "jpy_per_usd_daily": ("eur_per_usd_daily",),
    "sp500_monthly": ("vix_daily",),
    "sp500_monthly_logret": ("vix_daily",),
}


def clean(raw: pd.DataFrame, spec: DatasetSpec) -> pd.DataFrame:
    """Raw upstream table to a sorted, gap-free `date,value` frame."""
    for col in (spec.date_col, spec.value_col, spec.filter_col):
        if col is not None and col not in raw.columns:
            raise ValueError(f"{spec.id}: column {col!r} not in {list(raw.columns)}")
    df = raw
    if spec.filter_col is not None:
        df = df[df[spec.filter_col].astype(str) == spec.filter_value]
    out = pd.DataFrame(
        {
            "date": pd.to_datetime(df[spec.date_col]),
            "value": pd.to_numeric(df[spec.value_col], errors="coerce"),
        }
    )
    out = out.dropna()
    if spec.drop_zeros:
        out = out[out["value"] != 0]
    if spec.start is not None:
        out = out[out["date"] >= pd.Timestamp(spec.start)]
    out = out.drop_duplicates("date", keep="last").sort_values("date")
    return out.reset_index(drop=True)


def fetch(ids: list[str] | None = None, root: Path = DATA_DIR) -> list[Path]:
    """Download, clean and write snapshots for `ids` (default: every fetched dataset)."""
    root.mkdir(parents=True, exist_ok=True)
    written, cache = [], {}
    for spec in (FINANCE[i] for i in (ids or list(FINANCE))):
        if spec.derived_from:
            continue
        if spec.url not in cache:
            with urllib.request.urlopen(spec.url, timeout=60) as resp:
                cache[spec.url] = pd.read_csv(resp)
        out = root / f"{spec.id}.csv"
        clean(cache[spec.url], spec).to_csv(out, index=False, date_format="%Y-%m-%d")
        written.append(out)
    return written


def is_bundled(dataset_id: str) -> bool:
    """Whether the snapshot is committed. A derived series follows its source."""
    spec = FINANCE[dataset_id]
    return FINANCE[spec.derived_from or spec.id].bundled


def load(dataset_id: str, root: Path = DATA_DIR) -> Series:
    """Load a snapshot as a `Series`, fetching an unbundled one on first use."""
    if dataset_id not in FINANCE:
        raise ValueError(f"unknown dataset {dataset_id!r}; choose from {list(FINANCE)}")
    spec = FINANCE[dataset_id]
    source = spec.derived_from or spec.id
    path = root / f"{source}.csv"
    if not path.exists() and not is_bundled(source):
        fetch([source], root)
    df = pd.read_csv(path, parse_dates=["date"])
    dates, values = df["date"].to_numpy(), df["value"].to_numpy(dtype=float)
    if spec.transform == "log_return":
        dates, values = dates[1:], np.diff(np.log(values))
    return Series(dataset_id, values, spec.season_length, dates, spec.horizon)


def load_pair(target_id: str, companion_ids: list[str] | tuple[str, ...], root: Path = DATA_DIR) -> Series:
    """The target with companions inner-joined on its dates. A daily companion of a
    monthly target becomes the monthly mean, keyed like the target (month start)."""
    target = load(target_id, root)
    cols = {"target": pd.Series(target.values, index=pd.DatetimeIndex(target.dates))}
    for cid in companion_ids:
        comp = load(cid, root)
        values = pd.Series(comp.values, index=pd.DatetimeIndex(comp.dates))
        if FINANCE[target_id].freq == "M" and FINANCE[cid].freq != "M":
            values = values.groupby(values.index.to_period("M")).mean()
            values.index = values.index.to_timestamp()
        cols[cid] = values
    joined = pd.concat(cols, axis=1, join="inner").sort_index()
    return replace(
        target,
        name="+".join([target_id, *companion_ids]),
        values=joined["target"].to_numpy(dtype=float),
        dates=joined.index.to_numpy(),
        companions=joined[list(companion_ids)].to_numpy(dtype=float).T,
        companion_names=tuple(companion_ids),
    )


def load_suite(name: str, root: Path = DATA_DIR) -> list[Series]:
    if name == "pairs":
        return [load_pair(t, c, root) for t, c in PAIRS.items()]
    if name not in SUITES:
        raise ValueError(f"unknown suite {name!r}; choose from {[*SUITES, 'pairs']}")
    return [load(i, root) for i in SUITES[name]]
