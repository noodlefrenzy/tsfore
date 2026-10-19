<!-- agent-notes: { ctx: "third-party licenses for code, weights, data, fonts", deps: [LICENSE, docs/attributions.md, data/finance/README.md, docs/dependency-decisions.md], state: active, last: "claude@2026-10-19", key: ["LICENSE itself carries no agent-notes: a header would break GitHub's license detection"] } -->
# Third-party notices

tsfore's own code and docs are under the [MIT License](LICENSE), Copyright (c) 2026
Michael Lanzetta. The material below belongs to others and keeps its own terms.

## Vendored in this repository

| What | Where | License |
|---|---|---|
| Summon team framework: agents, commands, process docs, `team/`, `scripts/*.mjs` | `.claude/`, `docs/methodology/`, `docs/process/`, `team/`, `scripts/` | MIT, Copyright (c) 2026 summon-dev, [`docs/licenses/summon-LICENSE.txt`](docs/licenses/summon-LICENSE.txt) |
| Passages adapted from mattpocock/skills (via Summon) | listed in [`docs/attributions.md`](docs/attributions.md) | MIT, Copyright (c) 2026 Matt Pocock, [`docs/licenses/mattpocock-skills-LICENSE.txt`](docs/licenses/mattpocock-skills-LICENSE.txt) |
| Martian Mono font | `site/fonts/martian-mono-*.woff2` | SIL OFL 1.1, [`site/fonts/OFL-martianmono.txt`](site/fonts/OFL-martianmono.txt) |
| Archivo font | `site/fonts/archivo-*.woff2` | SIL OFL 1.1, [`site/fonts/OFL-archivo.txt`](site/fonts/OFL-archivo.txt) |
| Public Sans font | `site/fonts/public-sans-*.woff2` | SIL OFL 1.1, [`site/fonts/OFL-publicsans.txt`](site/fonts/OFL-publicsans.txt) |
| Finance data snapshots | `data/finance/*.csv` | per series, see [`data/finance/README.md`](data/finance/README.md) |

## Downloaded at run time, not redistributed

tsfore does not ship model weights. They download from the Hugging Face Hub on first use,
and you accept their licenses when you download them.

- **Timestral** (`mistralai/Timestral-5M`, `-28M`, `-123M`, `-209M`): the code is Apache-2.0.
  The weights are under Mistral AI's **Modified MIT License**, which withholds every right
  from a company, or the employer of a person, whose consolidated monthly revenue exceeded
  $20 million in the preceding month. Read the
  [LICENSE](https://huggingface.co/mistralai/Timestral-5M/blob/main/LICENSE) before using the
  weights at work.
- **Chronos-2** (`amazon/chronos-2`, `autogluon/chronos-2-small`): the code and weights are
  both Apache-2.0.
- Python dependencies keep their own licenses. See [`docs/dependency-decisions.md`](docs/dependency-decisions.md).

## Benchmark results

The files in `docs/benchmarks/` and `site/data.js` hold error scores (MAE, MASE, WQL and so
on) computed from the series above. They contain no raw prices.
