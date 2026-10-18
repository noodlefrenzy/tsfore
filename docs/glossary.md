---
agent-notes: { ctx: "tsfore domain glossary (forecasting vocabulary)", deps: [CLAUDE.md, docs/adrs/0009-ubiquitous-language-glossary.md], state: active, last: "claude@2026-10-18" }
---

# Glossary

The **ubiquitous language** for this project — the domain vocabulary the team and the code share (Eric Evans, _Domain-Driven Design_). One opinionated word per concept, defined once, used everywhere: in conversation, in issue titles, in variable and file names. When everyone names a thing the same way, the agents spend fewer words describing it and the codebase stays navigable.

This file holds **domain** terms — the nouns of what you're building (Order, Invoice, Patient, Trade). It does **not** hold Summon's own process vocabulary (proof grade, wave, agent-notes); those are defined in their spec docs and referenced bare. See `docs/process/doc-ownership.md` for the boundary between this glossary, `docs/code-map.md`, and agent-notes.

**Owner:** Archie (Architecture). Cam captures new terms during Discovery; Archie arbitrates overloaded or competing terms and keeps this file the single source of truth for domain meaning.

## How to use it

- **Define what a term _is_, not what it does.** One or two sentences. A glossary is not a spec — no implementation detail.
- **Be opinionated.** When several words compete for one concept, pick one and list the rest under `_Avoid_`. This is also a guard against elegant-variation drift (`docs/process/ai-tells-catalog.md`): if the code and docs all say `Order`, nothing silently renames it to "purchase" three files later.
- **Domain terms only.** General programming concepts (cache, timeout) and Summon process terms both stay out.
- **One heading per term.** Each entry is a `**Term**:` heading; keep them unique (the `summon doctor` glossary check flags duplicates).

## Forecasting terms

**Series**:
One univariate target sequence with its season length and forecast horizon, plus optional companions (`tsfore.data.Series`).
_Avoid_: dataset (a dataset is the source a series is loaded from), signal

**Horizon**:
The number of steps forecast at once from a cutoff.
_Avoid_: lead time, lookahead

**Cutoff**:
The last observation a model sees before forecasting a window. Everything after it is held out.
_Avoid_: origin (except in "rolling-origin"), split point

**Window**:
One cutoff plus the horizon of actuals after it. A backtest scores back-to-back windows that end at the series end.
_Avoid_: fold, split

**Context**:
The history up to a cutoff that a model receives as input.
_Avoid_: lookback, input window

**Companion**:
A related series fed to a model alongside the target, cut at the same cutoff (`+cov` as past covariates, `+joint` forecast jointly; ADR-0016).
_Avoid_: exogenous variable, feature, covariate (except in the `+cov` mode name)

**Baseline**:
The model every score is divided by, by default `naive` (the random walk).
_Avoid_: benchmark (a benchmark is a run of a suite)

**Suite**:
A named list of series run together by `tsfore bench`, such as `finance` or `pairs`.
_Avoid_: benchmark set, collection

**Relative score**:
A model's per-series MASE or WQL divided by the baseline's, combined across series with a geometric mean (`rel_mase`, `rel_wql`). Below 1 beats the baseline.
_Avoid_: skill score, normalized error
