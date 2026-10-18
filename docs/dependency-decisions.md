---
agent-notes:
  ctx: "dependency rationale and transitive dep inventory"
  deps: [docs/scaffolds/sbom.md]
  state: active
  last: "claude@2026-10-17"
---
# Dependency Decisions

<!-- This file explains WHY each dependency exists. Maintained by Pierrot. -->
<!-- Every top-level dependency must have an entry here before it's accepted. -->

## Top-Level Dependencies

For each dependency we've explicitly chosen, document the rationale.

### timestral — cooldown override APPROVED

- **Package:** `timestral` (git, `github.com/mistralai/timestral`)
- **Version:** `1.0.0` @ commit `a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff` (committed 2026-10-15)
- **License:** Apache-2.0 for the code. The weights on the Hugging Face Hub use a separate Modified MIT license.
- **Why we're using it:** evaluating it is the reason this project exists (ADR-0014).
- **Alternatives considered:** `timecopilot-timestral` on PyPI is a third-party wrapper from a different org, so it was rejected in favour of the vendor's own repo.
- **Cooldown (ADR-0010):** the commit was 2 days old when adopted, inside the 3-day window. uv `exclude-newer` cannot gate a git dependency, so the commit SHA is pinned instead. Override requested 2026-10-17 by the agent. **Approved 2026-10-17 by the human (lanzetta), citing the vendor announcement https://mistral.ai/news/timestral/.** The approval covers only this SHA (`a534bdb`), and moving to a newer commit needs a fresh cooldown check or a new override.
- **Added:** 2026-10-17 by sato

### chronos-forecasting (optional extra `chronos`)

- **Package:** `chronos-forecasting>=2.3,<3` from PyPI. It resolved to `2.3.2` (published 2026-09-08) under `exclude-newer`, so it is outside the cooldown window.
- **License:** Apache-2.0 for the code. The weights (`amazon/chronos-2` at `29ec376`, `autogluon/chronos-2-small` at `ddec013`) are also Apache-2.0.
- **Why we're using it:** Chronos-2 is the strongest published zero-shot competitor to Timestral. Benchmarking both under one harness is the comparison the project exists to make.
- **Alternatives considered:** going through AutoGluon-TimeSeries, which wraps the same pipeline but pulls a much larger dependency tree.
- **Transitive weight:** `transformers` 5.19.0, `accelerate` 1.15.0, `tokenizers`, `einops`. Torch is shared with the `timestral` extra.
- **Added:** 2026-10-17 by claude, at the human's request ("test timestral against chronos2")

### numpy, pandas

- **Package:** `numpy>=1.26`, `pandas>=2.2` (resolved under `exclude-newer = 2026-10-14`)
- **License:** BSD-3-Clause
- **Why we're using it:** array math and CSV and result tables, the minimum for a forecasting harness.
- **Alternatives considered:** Polars, which is faster but adds nothing at playground scale and is less familiar.
- **Added:** 2026-10-17 by sato

### statsforecast

- **Package:** `statsforecast>=2.0` (Nixtla), resolved under `exclude-newer`, so it is outside the cooldown window
- **License:** Apache-2.0
- **Why we're using it:** AutoETS, AutoARIMA and AutoTheta are the reference baselines GIFT-Eval and fev-bench report. Using them keeps tsfore's relative scores comparable to Timestral's published results (ADR-0015).
- **Alternatives considered:** sktime (BSD-3), which has a broader unified API but would mostly wrap these same models. pmdarima and statsmodels directly, which are slower and have no uniform interval API.
- **Transitive weight:** numba/llvmlite, scipy, statsmodels, pyarrow, fugue, coreforecast, utilsforecast.
- **Added:** 2026-10-17 by sato

### torch (transitive via timestral)

- **License:** BSD-3-Clause
- **Note:** on Linux the PyPI wheel pulls the CUDA libraries. See ADR-0014 § Negative.

---

## Transitive Dependencies

These are dependencies we pull in indirectly — we didn't choose them, but they're in our dependency tree because of packages we did choose. This table is regenerated whenever dependencies change (see `/pin-versions`).

| Package | Version | License | Pulled in by |
|---------|---------|---------|--------------|
| <!-- e.g. ms --> | <!-- 2.1.3 --> | <!-- MIT --> | <!-- express → debug → ms --> |

### License Flags

Any transitive dependency with a **copyleft license** (GPL, LGPL, AGPL, MPL) or an **uncommon/unknown license** is flagged here for Pierrot's review:

| Package | License | Pulled in by | Risk assessment |
|---------|---------|--------------|-----------------|
| <!-- populated during audits --> | | | |
