---
agent-notes: { ctx: "ADR: companion series for covariate and joint forecasting", deps: [docs/adrs/0014-python-forecasting-harness-stack.md, docs/adrs/0015-statistical-baselines-and-evaluation.md, src/tsfore/data.py, src/tsfore/backtest.py, src/tsfore/multivariate.py], state: active, last: "claude@2026-10-18" }
---

# ADR-0016: Companion Series for Multivariate Evaluation

## Status

Accepted (2026-10-18). Ratified by the human. Proposed 2026-10-17.

## Context

ADR-0014 kept the harness univariate. Timestral and Chronos-2 can both condition on related series, as past covariates or as jointly forecast variates. Chronos-2 was designed around that. A univariate-only comparison therefore undersells at least one model. The human asked for a multivariate comparison, for example VIX alongside the S&P 500 and Brent with WTI.

## Decision

1. **The target stays univariate. Other series ride along as companions.** `Series` gains an optional `companions` array `(C, N)` aligned with `values`, plus `companion_names`. Only the target is scored, so metrics, the leaderboard and reports are unchanged.
2. **The backtest slices companions at the target's cutoff.** A model sees `companions[:, :cutoff]` and never the horizon. Covariates that are known in the future (calendars, scheduled events) are out of scope.
3. **Models that use companions are opt-in wrappers.** The registry names are `<model>+cov` (companions passed as past covariates) and `<model>+joint` (companions stacked as extra variates and forecast together). The target row is the one returned. A wrapper sets `uses_companions = True`, and only then does the backtest pass companions. Every univariate model runs unchanged on a companion series.
4. **There is a separate `pairs` suite.** Each entry is a target joined to its companions on shared dates (inner join), so every model, including the univariate ones, sees the same truncated target. Daily companions of monthly targets are aggregated to monthly means.

## Consequences

### Positive

- Running univariate, +cov and +joint on identical windows isolates what the extra series buy each model.
- No change to the `Forecaster` protocol, the metrics or the existing suites.

### Negative

- Inner joins shorten series. VIX starts in 1990, so S&P pairs lose 120 years of history. The `pairs` scores are therefore not comparable with the `finance` suite's.
- Contemporaneous companion values are allowed up to the cutoff. That is correct for same-day closes, but a companion published with a lag would leak a little. None in the current suite is.

### Neutral

- Statistical baselines don't use companions. Adding exogenous ARIMA (`AutoARIMA` with `X`) is possible later.
