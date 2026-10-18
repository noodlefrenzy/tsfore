<!-- agent-notes: { ctx: "checklist for flipping tsfore from private to public", deps: [LICENSE, NOTICE.md, data/finance/README.md, handoff.md], state: active, last: "claude@2026-10-18", key: ["MEATPUPPET: items need the human (GitHub settings, legal calls)", "mark items [x] with a date as they land"] } -->
# Taking tsfore public

The checklist for flipping `noodlefrenzy/tsfore` from private to public. Items marked
**MEATPUPPET:** need the human: GitHub settings, legal calls, or anything only the owner
can approve. Everything else is agent work. Tick items with the date as they land.

State on 2026-10-18: the repo is private. The 17-commit `claude/summon-timestral-harness`
branch (no PR) was squash-merged into `main` and deleted, so `main` is now the only branch.

## 1. Secrets and personal data

- [x] Scanned the full history of every branch (`git log -p --all`, 88k lines) for API keys,
  tokens, private keys, JWTs and `secret=`/`token=` assignments. No gitleaks or trufflehog
  is installed, so this was a regex sweep. (2026-10-18)
  - Only hit: `sk-live-4f8c…` in `team/fixtures/negative-control/planted.diff`. It is a
    **deliberately planted fake key**, the negative control that Summon's review harness must
    catch. It stays. Every other match was a doc placeholder (`your-api-token`).
- [x] Scanned for personal data. The only emails are `noreply` addresses (GitHub's
  `noodlefrenzy@users.noreply.github.com`, plus Anthropic's). No home-directory paths and no
  private IPs: the dotted-quad hits are package versions. (2026-10-18)
- [x] Tracked `.claude/` files are only agents and commands, with no `settings*.json`.
  `.env` and `.envrc` are gitignored. (2026-10-18)
- [x] No large blobs anywhere in history (none over 500 KB; the pack is 844 KB). (2026-10-18)
- [ ] MEATPUPPET: optionally run a real scanner before flipping, as a second opinion:
  `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.21.2 detect -s /repo` (pin a
  version that is more than 3 days old). Expect it to flag the planted fixture key.

## 2. License

- [x] `LICENSE`: MIT, Copyright (c) 2026 Michael Lanzetta. It uses the same text as Summon's
  LICENSE, which GitHub already detects as MIT. It has no agent-notes header, because a header
  would break detection. (2026-10-18)
- [x] `pyproject.toml`: `license = "MIT"` and `license-files = ["LICENSE", "NOTICE.md"]`. (2026-10-18)
- [x] `NOTICE.md` lists third-party material: Summon (MIT, `docs/licenses/summon-LICENSE.txt`,
  copied from `../summon` @ `7db2e71`), mattpocock/skills (MIT, already present), the fonts
  (OFL 1.1, already in `site/fonts/`), the model weights and the data. (2026-10-18)
- [x] README "Licenses", the PRODUCT.md constraint and the site footer now state MIT and link
  to NOTICE. The footer links point at `main`, so they go live after the merge. (2026-10-18)
- [ ] MEATPUPPET: confirm the copyright line. It is "Michael Lanzetta" (taken from the git
  author), not a handle.

## 3. Models (weights are not in the repo)

- [x] Confirmed that no weights are committed: `*.safetensors` is gitignored, and every
  checkpoint downloads from the HF Hub at run time. (2026-10-18)
- [x] Timestral code is Apache-2.0 (GitHub API). All four weight sizes (5M/28M/123M/209M)
  ship the same LICENSE file, Mistral's **Modified MIT**. It requires an attribution notice
  and gives **no rights to companies whose consolidated monthly revenue exceeds $20M**. That
  binds downstream users, not this repo, since the repo redistributes nothing. Disclosed in
  NOTICE.md and README. (2026-10-18, VERIFIED from the HF LICENSE files)
- [x] Chronos-2 (`amazon/chronos-2`, `autogluon/chronos-2-small`): code and weights are
  Apache-2.0 (GitHub API and HF card metadata). (2026-10-18, VERIFIED)
- [x] Benchmark CSVs and `site/data.js` contain only error metrics, no raw prices and no
  model weights. (2026-10-18)

## 4. Data in `data/finance/`

Datahub labels every package ODC-PDDL. For several series, though, its own README says that
label rests on an assumption ("would imagine this was public domain"). The original sources
were checked on 2026-10-18 (VERIFIED from the source pages):

- [x] Public domain, safe to ship: `us10y_monthly` (Fed H.15), `cpi_us_monthly` (BLS),
  `wti_daily`, `brent_daily` and `natgas_daily` (EIA; it asks for a source credit), and
  `eur_per_usd_daily` and `jpy_per_usd_daily` (FRED tags DEXUSEU and DEXJPUS
  "Public Domain: Citation Requested").
- [x] `gold_monthly`: World Bank data defaults to CC BY 4.0, which requires attribution. The
  credit line is now in `data/finance/README.md`. The Pink Sheet PDF/XLS itself was not
  checked for a dataset-specific notice. (2026-10-18)
- [x] `data/finance/README.md` now gives each series' original-source terms instead of the
  blanket "all PDDL" claim. (2026-10-18)
- [x] **MEATPUPPET: decide on `sp500_monthly` (and its derived `_logret`) and `vix_daily`.**
  Decided 2026-10-18: drop them from the repo and fetch them on use.
  - S&P 500: FRED's SP500 notice reads "Reproduction of S&P 500 in any form is prohibited
    except with the prior written permission of S&P Dow Jones Indices LLC". Shiller's series
    is built from those index levels, and datahub lists FRED SP500 as a source.
  - VIX: Cboe's site terms allow "one copy … for your personal non-commercial use". Anything
    else needs "Cboe's prior written consent".
  - Facts are not copyrightable in the US (Feist), and datahub has redistributed both for
    about a decade. But these are contractual terms of use, and publishing a snapshot is
    exactly what they forbid.
- [x] Implemented, with tests first (2026-10-18):
  - `DatasetSpec.bundled=False` for both, and `datasets.is_bundled()` makes a derived series
    follow its source.
  - `load()` fetches a missing unbundled snapshot from the same pinned commit. A missing
    *bundled* snapshot stays a `FileNotFoundError`, with no silent network call.
  - Both CSVs are `git rm --cached` and gitignored.
  - Tests that need them call `tests/conftest.py::requires_snapshot`, so they skip on a
    fresh clone instead of hitting the network. The CLI bench test now runs on bundled
    series only.
  - A fresh-clone simulation gave 96 passed and 7 skipped. A live fetch then reproduced
    both files **byte-for-byte**, so the published benchmarks stay reproducible.
- [x] Reworded "11 public-domain series" in `README.md`, `PRODUCT.md`, `site/index.html`
  (the dek and the method section), `CLAUDE.md` and `docs/code-map.md`. ADR-0015 is
  Accepted, so it got a dated update note instead of an edit to its decision. (2026-10-18)
- [x] **MEATPUPPET: purge the two CSVs from history before the flip.** Chose the squash-merge
  on 2026-10-18; done in § 7. They are still in the
  branch's earlier commits, and making the repo public publishes every reachable commit.
  There are two ways (see § 7):
  - squash-merge into `main` and delete the branch;
  - or `git filter-repo --path data/finance/sp500_monthly.csv --path data/finance/vix_daily.csv --invert-paths`
    and force-push, which keeps the granular commits.

## 5. Debris

- [x] Replaced the e-commerce example terms (Order/Invoice/Customer) in `docs/glossary.md`
  with tsfore's own vocabulary: series, horizon, cutoff, window, context, companion,
  baseline, suite and relative score. (2026-10-18)
- [x] Kept `docs/adrs/0008-example-sqlite-first-datastore.md`. It is Summon's labelled
  fictional example, and `scripts/check-canon.mjs` enforces contiguous ADR numbers, so
  deleting it would break the canon check. (2026-10-18)
- [x] `results/`, `.playwright-mcp/`, `.impeccable/shots/` and `.impeccable/questions/` are
  gitignored local scratch, so they don't ship. (2026-10-18)
- [ ] MEATPUPPET: decide whether `handoff.md` at the repo root should be public. It is session
  state, committed on purpose for cross-machine resume, and it is harmless but reads as
  internal. You could keep it, move it to `docs/`, or drop it after the merge.

## 6. Quality gates

- [x] `uv run pytest`: 92 passed, 6 deselected. `ruff check` and `ruff format --check` are
  clean. (2026-10-18, before these changes)
- [x] Re-ran after the data change: 103 passed, 6 deselected (snapshots present locally).
  `ruff check` and `ruff format --check` are clean. (2026-10-18)
- [ ] Add CI (ruff + pytest) under `.github/workflows/`, with action versions pinned by SHA
  and older than 3 days.

## 7. Merge and publish

- [x] Squash-merged `claude/summon-timestral-harness` into `main`, so `main`'s history never
  contains the S&P/VIX snapshots: `git log main -- data/finance/vix_daily.csv` is empty. Then
  deleted the branch locally and on origin, and no PR was ever opened from it. The old tip
  survives only as the **local, unpushed** tag `backup/summon-timestral-harness-2026-10-18`.
  Never push tags with `--tags`, and delete this one once you're satisfied. (2026-10-18)
- [ ] MEATPUPPET (optional, belt and braces): GitHub can keep serving unreferenced commits
  by SHA until it garbage-collects them. If that matters to you, ask GitHub Support to run
  GC on the repo before you flip it. Otherwise, the old commits are unreachable from any ref.
- [ ] Add a GitHub Pages workflow for `site/` (upload-pages-artifact + deploy-pages, pinned).
- [ ] MEATPUPPET: Settings → General → Danger Zone → **Change visibility → Public**.
- [ ] MEATPUPPET: Settings → Pages → Source: **GitHub Actions**. Then check that the site
  loads and that its `main` links resolve.
- [ ] MEATPUPPET: Settings → Code security → turn on **secret scanning**, **push
  protection**, **Dependabot alerts** and **private vulnerability reporting**.
- [ ] MEATPUPPET: Settings → Branches → protect `main` (require PRs or passing CI, as you
  prefer).
- [ ] MEATPUPPET: set the repo description, website (the Pages URL) and topics
  (`time-series`, `forecasting`, `foundation-models`, `benchmark`).
