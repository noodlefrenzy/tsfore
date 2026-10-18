<!-- agent-notes: { ctx: "provenance and license of bundled finance snapshots", deps: [src/tsfore/datasets.py], state: active, last: "claude@2026-10-18", key: ["regenerate with `uv run tsfore data fetch`; SHAs live in datasets.py"] } -->
# Finance snapshots

Cleaned `date,value` CSVs used by `tsfore bench --suite finance` and the tests. Eight are
committed. `sp500_monthly.csv` and `vix_daily.csv` are gitignored, and `tsfore.datasets.load`
fetches them on first use, because their owners forbid redistribution (see the table). Each one
comes from a [datahub `datasets`](https://github.com/datasets) repository pinned to a commit
in `src/tsfore/datasets.py`. The datahub packages are all labelled **ODC-PDDL-1.0**. For
some series that label rests on the maintainer's assumption, not on the original source's
terms, so the table below gives the original source's terms (checked 2026-10-18):

| series | original source | its terms |
|---|---|---|
| `us10y_monthly` | Federal Reserve H.15 | US government work, public domain |
| `cpi_us_monthly` | BLS | US government work, public domain |
| `wti_daily`, `brent_daily`, `natgas_daily` | EIA | US government work, public domain. EIA asks for the credit "Source: U.S. Energy Information Administration" |
| `eur_per_usd_daily`, `jpy_per_usd_daily` | Federal Reserve H.10, via FRED | FRED tags them "Public Domain: Citation Requested" (DEXUSEU, DEXJPUS) |
| `gold_monthly` | World Bank Pink Sheet and Timothy Green's historical table (NMA) | World Bank data defaults to CC BY 4.0, so credit "Source: World Bank Commodity Price Data (The Pink Sheet)" |
| `sp500_monthly`, `sp500_monthly_logret` | Robert Shiller's data, built from S&P 500 index levels | **restricted**: S&P Dow Jones Indices prohibits reproduction without its written permission (the FRED SP500 notice) |
| `vix_daily` | Cboe | **restricted**: Cboe's site terms allow one personal copy and require its prior written consent to redistribute |

Credit goes to Robert Shiller for preparing and publishing the S&P 500 series.

Fetched 2026-10-17. Business-daily series keep only trading days, with no calendar gaps.

| id | series | freq | season | horizon | source |
|---|---|---|---|---|---|
| `sp500_monthly` | S&P 500 composite, monthly average (Shiller) | M | 12 | 12 | [`datasets/s-and-p-500`](https://github.com/datasets/s-and-p-500/blob/07b81e6af68239acd65b901a11844d6d95db6ead/data/data.csv) @ `07b81e6` |
| `sp500_monthly_logret` | S&P 500 monthly log returns (near white noise) | M | 12 | 12 | derived from `sp500_monthly` (log_return) |
| `us10y_monthly` | US 10-year Treasury yield, % (Fed H.15) | M | 12 | 12 | [`datasets/bond-yields-us-10y`](https://github.com/datasets/bond-yields-us-10y/blob/238315525deafefcf8334536990cafe23dc5eac4/data/monthly.csv) @ `2383155` |
| `cpi_us_monthly` | US CPI-U all items index (BLS) | M | 12 | 12 | [`datasets/cpi-us`](https://github.com/datasets/cpi-us/blob/dceeb872c839cd4932cf460995c1872ebb7b75d8/data/cpiai.csv) @ `dceeb87` |
| `gold_monthly` | Gold, USD/oz, since the 1971 end of the fixed price | M | 12 | 12 | [`datasets/gold-prices`](https://github.com/datasets/gold-prices/blob/f6e97610178379ef8db280702fcaa3ec0875c5c2/data/monthly.csv) @ `f6e9761` |
| `vix_daily` | CBOE VIX close (mean-reverting) | B | 5 | 20 | [`datasets/finance-vix`](https://github.com/datasets/finance-vix/blob/3dbea23c70cc2afbeeec8ac232c9ec72ac26ac21/data/vix-daily.csv) @ `3dbea23` |
| `wti_daily` | WTI crude spot, USD/bbl (negative in Apr 2020) | B | 5 | 20 | [`datasets/oil-prices`](https://github.com/datasets/oil-prices/blob/c24526249395d1df291d2a6a63a510939cf65556/data/wti-daily.csv) @ `c245262` |
| `brent_daily` | Brent crude spot, USD/bbl | B | 5 | 20 | [`datasets/oil-prices`](https://github.com/datasets/oil-prices/blob/c24526249395d1df291d2a6a63a510939cf65556/data/brent-daily.csv) @ `c245262` |
| `natgas_daily` | Henry Hub natural gas spot, USD/MMBtu (spiky) | B | 5 | 20 | [`datasets/natural-gas`](https://github.com/datasets/natural-gas/blob/64843b5bb8ed967f4af563eac2c1782380e2f2e0/data/daily.csv) @ `64843b5` |
| `eur_per_usd_daily` | EUR per USD (FRED via datasets) | B | 5 | 20 | [`datasets/exchange-rates`](https://github.com/datasets/exchange-rates/blob/c023dd8b8f879610641a7391c0394c3bbb42d0f7/data/daily.csv) @ `c023dd8`, rows where Country = Euro |
| `jpy_per_usd_daily` | JPY per USD (FRED via datasets) | B | 5 | 20 | [`datasets/exchange-rates`](https://github.com/datasets/exchange-rates/blob/c023dd8b8f879610641a7391c0394c3bbb42d0f7/data/daily.csv) @ `c023dd8`, rows where Country = Japan |

Cleaning (`tsfore.datasets.clean`):
- Rows with a missing value are dropped.
- For the S&P 500, trailing months that upstream pads with `0.0` are dropped.
- Gold starts in 1971, at the end of the fixed USD price.
- Dates are de-duplicated (last value wins) and sorted.
