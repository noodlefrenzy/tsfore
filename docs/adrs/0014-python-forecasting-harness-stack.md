---
agent-notes: { ctx: "ADR: Python/uv harness stack for evaluating Timestral", deps: [docs/adrs/template.md, docs/adrs/0010-dependency-release-age-cooldown.md, pyproject.toml], state: active, last: "claude@2026-10-18" }
---

# ADR-0014: Python Forecasting Harness Stack

## Status

Accepted (2026-10-18). Ratified by the human. Proposed 2026-10-17. The Timestral release-age cooldown override was approved by the human on 2026-10-17 (see [dependency-decisions](../dependency-decisions.md)).

## Context

tsfore is a playground for time series forecasting. Its first job is to evaluate Mistral's Timestral foundation models (released 2026-10-15, four sizes from 5M to 209M parameters, 21 quantiles, context up to 32,768 steps) against classical baselines, on series we pick.

Timestral ships as a standalone PyTorch inference package on GitHub, not on PyPI, and its weights are on the Hugging Face Hub. Nothing here serves traffic. The product is a measurement: "is Timestral better than seasonal naive on this data, and by how much, per unit of compute?"

## Decision

1. **Python ≥ 3.11 managed with uv**, with a `src/` layout, `pytest` and `ruff`. This is a library plus a CLI. There is no web API or UI yet; add a notebook or Streamlit view when a result needs one.
2. **numpy + pandas only in the core.** Baselines, metrics and the backtest don't import torch.
3. **Timestral is an optional extra** (`uv sync --extra timestral`), pinned to a commit SHA through `[tool.uv.sources]`. The adapter imports it lazily.
4. **One forecaster contract.** `forecast(context: (T,), horizon) -> QuantileForecast` at the decile `EVAL_LEVELS`. Models that natively emit other levels (Timestral emits 21) are interpolated onto the deciles. Every model is then scored with the same WQL that GIFT-Eval and fev-bench use.
5. **Rolling-origin backtest** with back-to-back windows at the series end, scored with MAE, RMSE, sMAPE, MASE, WQL, 80% interval coverage and wall-clock seconds.
6. **The ADR-0010 cooldown is enforced natively** with uv `exclude-newer`. Git dependencies are outside its reach, so they are pinned by SHA and logged as explicit overrides.

## Consequences

### Positive

- Baselines and metrics run in seconds with no GPU or model download.
- Adding a model means writing one adapter class and one entry in `forecasters.build`.
- Tests exercise the real Timestral code path with a tiny random-init model, so CI needs no network access to the Hub.

### Negative

- PyPI `torch` on Linux pulls the CUDA wheels (several GB). A CPU-only machine could use the PyTorch CPU index instead; that is not wired up yet.
- The harness is univariate only. Timestral's covariate and multivariate support is not exercised yet.
- Gaussian intervals on the baselines are a known simplification, the textbook benchmark rather than a strong probabilistic baseline.

### Neutral

- Real-weight accuracy checks are marked `@pytest.mark.weights` and deselected by default.
