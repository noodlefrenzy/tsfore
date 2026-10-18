// agent-notes: { ctx: "renders the results site from window.TSFORE", deps: [site/data.js, site/index.html, scripts/build_site_data.py], state: active, last: "claude@2026-10-18", key: ["tables and charts read data.js; prose numbers trace to docs/benchmarks reports", "innerHTML only takes data.js values and authored strings, escaped via esc()"] }
// tsfore results site. Tables and charts come from window.TSFORE (scripts/build_site_data.py).
(() => {
  "use strict";
  const D = window.TSFORE;
  if (!D) {
    document.querySelector("main").insertAdjacentHTML(
      "afterbegin",
      '<p class="note" role="alert">data.js did not load, so no figures can be shown. Rebuild it with <code>uv run python scripts/build_site_data.py</code>.</p>'
    );
    return;
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const f = (x, nd = 3) => (x == null ? "n/a" : Number(x).toFixed(nd));
  const pct = (x, nd = 1) => `${x < 0 ? "−" : "+"}${Math.abs(x * 100).toFixed(nd)}%`;
  const pval = (p) => (p < 0.001 ? p.toExponential(1).replace("e-", "e−") : p.toFixed(3));

  const FAM = { stats: "STATISTICS", timestral: "TIMESTRAL", chronos: "CHRONOS-2" };
  const INK = { stats: "var(--fam-stats)", timestral: "var(--fam-timestral)", chronos: "var(--fam-chronos)" };
  const famOf = (m) => (m.startsWith("timestral") ? "timestral" : m.startsWith("chronos") ? "chronos" : "stats");
  const LABEL = {
    naive: "Naive (random walk)", historic_average: "Historic average", auto_ets: "AutoETS", auto_arima: "AutoARIMA",
    "timestral-5m": "Timestral-5M", "timestral-28m": "Timestral-28M", "timestral-123m": "Timestral-123M", "timestral-209m": "Timestral-209M",
    "chronos-2-small": "Chronos-2-small", "chronos-2": "Chronos-2",
  };
  const label = (m) => {
    const [base, mode] = m.split("+");
    return (LABEL[base] || base) + (mode ? ` +${mode}` : "");
  };
  const SHORT = {
    naive: "NAIVE", historic_average: "HIST AVG", auto_ets: "ETS", auto_arima: "ARIMA",
    "timestral-5m": "5M", "timestral-28m": "28M", "timestral-123m": "123M", "timestral-209m": "209M",
    "chronos-2-small": "SMALL", "chronos-2": "BASE",
  };
  const short = (m) => {
    const [base, mode] = m.split("+");
    return (SHORT[base] || base) + (mode ? `+${mode.toUpperCase()}` : "");
  };
  const SERIES = {
    sp500_monthly: ["S&P 500 level", "monthly"], sp500_monthly_logret: ["S&P 500 log returns", "monthly"],
    us10y_monthly: ["10-year Treasury yield", "monthly"], cpi_us_monthly: ["US CPI", "monthly"], gold_monthly: ["Gold", "monthly"],
    vix_daily: ["VIX", "daily"], wti_daily: ["WTI crude", "daily"], brent_daily: ["Brent crude", "daily"],
    natgas_daily: ["Henry Hub natural gas", "daily"], eur_per_usd_daily: ["EUR per USD", "daily"], jpy_per_usd_daily: ["JPY per USD", "daily"],
  };
  const seriesName = (s) => s.split("+").map((p) => (SERIES[p] ? SERIES[p][0] : p)).join(" ← ");

  const lb = (suite) => Object.fromEntries(D[suite].board.map((r) => [r.model, r]));
  const FIN = lb("finance");
  const PRS = lb("pairs");
  const cell = (suite, series, model) => D[suite].series[series][model];
  const fin = (series, model, k = "mase") => cell("finance", series, model)[k];

  // ---------- ticker ----------
  function renderTape() {
    const items = D.finance.board
      .filter((r) => r.model !== "naive")
      .map((r) => {
        const d = r.rel_mase - 1;
        const sym = { stats: "", timestral: "TSTRL ", chronos: "CHRN2 " }[famOf(r.model)] + short(r.model);
        return `<li><span class="sym">${esc(sym)}</span><span>${f(r.rel_mase)}</span><span class="${d < 0 ? "up" : "dn"}">${pct(d)} VS RW</span></li>`;
      });
    const news = [
      "TIMESTRAL BEATS CHRONOS-2 ON 306 OF 528 WINDOWS, P=2.0E−5",
      "NATGAS CARRIES TIMESTRAL'S POINT EDGE OVER ETS",
      "NO MODEL BEATS THE RANDOM WALK ON OIL OR FX",
      "COMPANION SERIES: ONE DURABLE EFFECT, CHRONOS-2-SMALL+COV",
      "CORRECTION: VIX DOES NOT HELP EVERY MODEL",
    ].map((t) => `<li><span class="sym">NEWS</span><span>${esc(t)}</span></li>`);
    const once = items.concat(news).join("");
    const track = $("#tape");
    track.innerHTML = once + once.replace(/<li>/g, '<li aria-hidden="true">');
    const btn = $(".tape__toggle");
    btn.addEventListener("click", () => {
      const paused = document.querySelector(".tape").classList.toggle("is-paused");
      btn.setAttribute("aria-pressed", String(paused));
      btn.textContent = paused ? "PLAY" : "PAUSE";
      btn.setAttribute("aria-label", paused ? "Play ticker" : "Pause ticker");
    });
  }

  // ---------- family panes ----------
  function bestOf(fam) {
    return D.families[fam].filter((m) => FIN[m] && m !== "naive").sort((a, b) => FIN[a].rel_wql - FIN[b].rel_wql)[0];
  }
  function renderPanes() {
    const best = { stats: bestOf("stats"), timestral: bestOf("timestral"), chronos: bestOf("chronos") };
    const vals = Object.values(best).map((m) => FIN[m]);
    const minOf = (k) => Math.min(...vals.map((v) => v[k]));
    const covLead = vals.reduce((a, v) => (Math.abs(v.coverage_80 - 0.8) < Math.abs(a.coverage_80 - 0.8) ? v : a)).coverage_80;
    const lines = {
      stats: [
        ["w", "WINS", `US CPI: AutoETS ${f(fin("cpi_us_monthly", "auto_ets"), 2)}, the best of any model`],
        ["w", "WINS", `Gold: AutoARIMA ${f(fin("gold_monthly", "auto_arima"), 2)}, also the best`],
        ["l", "LOSES", `Natural gas: AutoETS ${f(fin("natgas_daily", "auto_ets"), 2)}, AutoARIMA ${f(fin("natgas_daily", "auto_arima"), 2)}`],
        ["l", "LOSES", `AutoARIMA's bands cover ${Math.round(fin("sp500_monthly", "auto_arima", "cov") * 100)}% on the S&P 500 level`],
      ],
      timestral: [
        ["w", "WINS", `Natural gas ${f(fin("natgas_daily", "timestral-209m"), 2)}, VIX ${f(fin("vix_daily", "timestral-209m"), 2)}`],
        ["w", "WINS", `Best-calibrated bands: ${f(FIN["timestral-209m"].coverage_80, 2)} against a 0.80 target`],
        ["l", "LOSES", `CPI points trail AutoETS: ${f(fin("cpi_us_monthly", "timestral-209m"), 2)} vs ${f(fin("cpi_us_monthly", "auto_ets"), 2)}`],
        ["t", "TIES", `Oil and FX: ${f(fin("brent_daily", "timestral-209m"))} Brent, ${f(fin("eur_per_usd_daily", "timestral-209m"))} EUR, the random walk's level`],
      ],
      chronos: [
        ["w", "WINS", `10-year yield ${f(fin("us10y_monthly", "chronos-2"), 2)}, the best of any model`],
        ["w", "WINS", `Fastest: ${Math.round(FIN["chronos-2"].seconds * 1000)} ms per window, batched`],
        ["l", "LOSES", `Oil and EUR: ${f(fin("brent_daily", "chronos-2"))} Brent, ${f(fin("eur_per_usd_daily", "chronos-2"))} EUR, worse than the random walk`],
        ["l", "LOSES", `Bands too narrow: ${f(FIN["chronos-2"].coverage_80, 2)} coverage`],
      ],
    };
    const who = {
      stats: "Fit per window from scratch: random walk, ETS, ARIMA.",
      timestral: "Mistral, 5M–209M parameters, context up to 32,768 steps.",
      chronos: "Amazon, 28M and 120M parameters, context up to 8,192 steps.",
    };
    $("#panes").innerHTML = Object.entries(best)
      .map(([fam, m]) => {
        const r = FIN[m];
        const q = (k, v, lead, unit = "") =>
          `<div class="quote"><dt>${k}</dt><dd class="${lead ? "is-lead" : ""}">${v}${unit}</dd></div>`;
        return `<article class="pane" style="--ink:${INK[fam]}" aria-label="${FAM[fam]}">
          <div class="pane__top"><span class="pane__name">${FAM[fam]}</span><span class="pane__best">BEST: ${esc(label(m).toUpperCase())}</span></div>
          <p class="pane__who">${who[fam]}</p>
          <dl class="quotes">
            ${q("rel MASE", f(r.rel_mase), r.rel_mase === minOf("rel_mase"))}
            ${q("rel WQL", f(r.rel_wql), r.rel_wql === minOf("rel_wql"))}
            ${q("80% coverage", f(r.coverage_80, 2), r.coverage_80 === covLead)}
            ${q("sec / window", f(r.seconds, 3), r.seconds === minOf("seconds"))}
          </dl>
          <ul class="pane__lines">${lines[fam].map(([c, k, t]) => `<li><b class="${c}">${k}</b><span>${esc(t)}</span></li>`).join("")}</ul>
        </article>`;
      })
      .join("");
  }

  // ---------- dossiers ----------
  function renderDossiers() {
    const d = {
      stats: {
        blurb: "The classical toolkit, refit on every window: the random walk (tomorrow equals today), the historic mean, and automatically selected exponential smoothing (ETS) and ARIMA from statsforecast. No pretraining, nothing to leak.",
        good: [
          ["Smooth, trending series", `On US CPI, AutoETS scores ${f(fin("cpi_us_monthly", "auto_ets"))}, ahead of Timestral-209M (${f(fin("cpi_us_monthly", "timestral-209m"))}) and far ahead of Chronos-2 (${f(fin("cpi_us_monthly", "chronos-2"))}).`],
          ["Monthly gold", `AutoARIMA ${f(fin("gold_monthly", "auto_arima"))} is the best point forecast on the series.`],
          ["Random walks, honestly", "The random walk itself is the hardest baseline on oil and FX. Nothing in this test beats it there, and the statistical models know to sit on it."],
        ],
        bad: [
          ["Spiky series", `Natural gas: AutoETS ${f(fin("natgas_daily", "auto_ets"))} and AutoARIMA ${f(fin("natgas_daily", "auto_arima"))} both lose to the random walk, while the foundation models reach ${f(fin("natgas_daily", "timestral-209m"))}.`],
          ["Uncertainty", `AutoETS bands run wide (${f(FIN.auto_ets.coverage_80, 2)} coverage; ${f(fin("natgas_daily", "auto_ets", "cov"), 2)} on natgas). AutoARIMA collapses to ${f(fin("sp500_monthly", "auto_arima", "cov"), 2)} on the S&P 500 level.`],
          ["Cost", `AutoARIMA takes ${f(FIN.auto_arima.seconds, 1)} s per window on the CPU, about ${Math.round(FIN.auto_arima.seconds / FIN["timestral-209m"].seconds)}× Timestral-209M batched on the GPU.`],
        ],
      },
      timestral: {
        blurb: "Mistral's pretrained forecaster, used zero-shot. It reads up to 32,768 past steps, emits 21 quantiles, and accepts past and known-future covariates. Four sizes were tested.",
        good: [
          ["Probabilistic accuracy, broadly", `rel WQL ${f(FIN["timestral-123m"].rel_wql)} for 123M. Leave natural gas out and 209M still scores ${f(D.finance.ablation[1]["timestral-209m"].wql)} against AutoETS's ${f(D.finance.ablation[1].auto_ets.wql)}.`],
          ["Spiky and volatile series", `Natural gas ${f(fin("natgas_daily", "timestral-209m"))}, VIX ${f(fin("vix_daily", "timestral-28m"))} (28M), S&P 500 level ${f(fin("sp500_monthly", "timestral-209m"))}.`],
          ["Calibration", `80% bands cover ${f(FIN["timestral-209m"].coverage_80, 2)}, the closest of any model to the target.`],
        ],
        bad: [
          ["Point forecasts outside natgas", `Without natural gas, 209M and AutoETS tie on rel MASE (${f(D.finance.ablation[1]["timestral-209m"].mase)} vs ${f(D.finance.ablation[1].auto_ets.mase)}).`],
          ["Size buys little past 28M", `28M, 123M and 209M are statistically indistinguishable (p = ${pval(D.finance.paired.find((r) => r.a === "timestral-28m").p)}); only 5M is worse.`],
          ["Companions", "Giving it a related series as a covariate or joint target changes nothing measurable."],
        ],
      },
      chronos: {
        blurb: "Amazon's second-generation Chronos, used zero-shot. It reads up to 8,192 past steps, emits 21 quantiles, and puts covariates and extra targets in one attention group. Two sizes were tested.",
        good: [
          ["Rates", `10-year Treasury yield ${f(fin("us10y_monthly", "chronos-2"))}, the best of any model; Timestral-209M scores ${f(fin("us10y_monthly", "timestral-209m"))}.`],
          ["Spiky series, like Timestral", `Natural gas ${f(fin("natgas_daily", "chronos-2"))} and S&P 500 level ${f(fin("sp500_monthly", "chronos-2"))}, level with the best.`],
          ["Speed", `${Math.round(FIN["chronos-2"].seconds * 1000)} ms per window batched, and its small model is the only one that measurably uses a companion series.`],
        ],
        bad: [
          ["Random walks", `It reacts to noise: Brent ${f(fin("brent_daily", "chronos-2"))}, WTI ${f(fin("wti_daily", "chronos-2"))}, EUR ${f(fin("eur_per_usd_daily", "chronos-2"))}, all worse than the random walk. That is most of its gap to Timestral.`],
          ["CPI", `${f(fin("cpi_us_monthly", "chronos-2"))} against ${f(fin("cpi_us_monthly", "auto_ets"))} for AutoETS.`],
          ["Calibration", `Bands too narrow: ${f(FIN["chronos-2"].coverage_80, 2)} coverage for an 80% band.`],
        ],
      },
    };
    $("#dossiers").innerHTML = Object.entries(d)
      .map(([fam, x]) => {
        const members = D.families[fam].filter((m) => FIN[m] && m !== "historic_average");
        const worst = Math.max(...members.map((m) => FIN[m].rel_mase));
        const rows = members
          .map((m) => {
            const r = FIN[m];
            const w = Math.max(4, (1 - (r.rel_mase - 0.8) / (Math.max(worst, 1) - 0.8 + 0.02)) * 100);
            return `<tr><td>${esc(label(m).replace(" (random walk)", ""))}</td><td>${f(r.rel_mase)}</td><td>${f(r.rel_wql)}</td><td>${f(r.coverage_80, 2)}</td><td class="bar-cell"><span class="mbar" style="width:${w.toFixed(0)}%"></span></td></tr>`;
          })
          .join("");
        const li = (arr) => arr.map(([a, b]) => `<li><span class="what">${esc(a)}</span><span class="why">${esc(b)}</span></li>`).join("");
        return `<article class="dossier" style="--ink:${INK[fam]}">
          <div class="dossier__id"><h3>${FAM[fam] === "STATISTICS" ? "Classical statistics" : FAM[fam] === "TIMESTRAL" ? "Timestral" : "Chronos-2"}</h3><p>${esc(x.blurb)}</p>
            <table class="members"><thead><tr><th>member</th><th>MASE</th><th>WQL</th><th>cov</th><th class="bar-cell"><span class="visually-hidden">skill</span></th></tr></thead><tbody>${rows}</tbody></table></div>
          <div class="dossier__good"><h4>Performs well</h4><ul class="evidence">${li(x.good)}</ul></div>
          <div class="dossier__bad"><h4>Performs poorly</h4><ul class="evidence">${li(x.bad)}</ul></div>
        </article>`;
      })
      .join("");
  }

  // ---------- quote board ----------
  const COLUMNS = {
    finance: { stats: ["naive", "historic_average", "auto_ets", "auto_arima"], timestral: ["timestral-5m", "timestral-28m", "timestral-123m", "timestral-209m"], chronos: ["chronos-2-small", "chronos-2"] },
    pairs: { stats: ["naive", "auto_ets", "auto_arima"], timestral: ["timestral-28m", "timestral-28m+cov", "timestral-28m+joint", "timestral-209m", "timestral-209m+cov", "timestral-209m+joint"], chronos: ["chronos-2-small", "chronos-2-small+cov", "chronos-2", "chronos-2+cov"] },
  };
  const state = { suite: "finance", metric: "mase" };

  function tint(metric, v) {
    if (v == null) return "transparent";
    if (metric === "cov") {
      const t = Math.min(1, Math.abs(v - 0.8) / 0.25);
      return `color-mix(in srgb, var(--amber) ${(t * 42).toFixed(0)}%, transparent)`;
    }
    const lv = Math.log(v);
    const t = Math.min(1, Math.abs(lv) / Math.log(1.6));
    return `color-mix(in srgb, ${lv < 0 ? "var(--better)" : "var(--worse)"} ${(t * 55).toFixed(0)}%, transparent)`;
  }

  function renderBoard() {
    const { suite, metric } = state;
    const cols = COLUMNS[suite];
    const models = Object.values(cols).flat();
    const board = lb(suite);
    const spans = D[suite].spans;
    const groupHead = Object.entries(cols)
      .map(([fam, ms]) => `<th colspan="${ms.length}" data-fam style="--ink:${INK[fam]}" scope="colgroup">${FAM[fam]}</th>`)
      .join("");
    const head = models
      .map((m, i) => `<th scope="col" class="${i && famOf(m) !== famOf(models[i - 1]) ? "gs" : ""}" title="${esc(label(m))}">${esc(short(m))}</th>`)
      .join("");
    const rows = Object.keys(D[suite].series)
      .map((s) => {
        const vals = models.map((m) => (D[suite].series[s][m] || {})[metric]);
        const score = (v) => (v == null ? Infinity : metric === "cov" ? Math.abs(v - 0.8) : v);
        const best = Math.min(...vals.filter((v, i) => models[i] !== "naive" || metric === "cov").map(score));
        const sp = spans[s];
        const tds = vals
          .map((v, i) => {
            const m = models[i];
            const isBest = score(v) === best && (m !== "naive" || metric === "cov");
            const gs = i && famOf(m) !== famOf(models[i - 1]) ? " gs" : "";
            return `<td class="${isBest ? "is-best" : ""}${gs}" style="--cell:${tint(metric, v)}">${metric === "cov" ? f(v, 2) : f(v, v != null && v >= 10 ? 1 : 3)}</td>`;
          })
          .join("");
        return `<tr><th scope="row">${esc(seriesName(s))}<span>${sp.from.slice(0, 7)} → ${sp.to.slice(0, 7)} · h=${sp.horizon}</span></th>${tds}</tr>`;
      })
      .join("");
    const foot = models
      .map((m, i) => {
        const r = board[m];
        const v = metric === "mase" ? r.rel_mase : metric === "wql" ? r.rel_wql : r.coverage_80;
        const gs = i && famOf(m) !== famOf(models[i - 1]) ? ' class="gs"' : "";
        return `<td${gs}>${metric === "cov" ? f(v, 2) : f(v, v >= 10 ? 1 : 3)}</td>`;
      })
      .join("");
    const metricName = { mase: "rel MASE", wql: "rel WQL", cov: "80% coverage" }[metric];
    $("#board").innerHTML = `<caption class="visually-hidden">${metricName} by series and model, ${suite} suite</caption>
      <thead><tr class="fam"><td></td>${groupHead}</tr><tr><th scope="col" style="text-align:left">series</th>${head}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th scope="row">${metric === "cov" ? "MEAN" : "SUITE (GEO MEAN)"}</th>${foot}</tr></tfoot>`;
    $("#board-note").textContent =
      metric === "cov"
        ? "80% coverage: share of outcomes inside the 10–90% band. 0.80 is calibrated; amber marks the distance from it. The outlined cell in each row is the closest to 0.80."
        : `${metricName}: the model's score divided by the random walk's on the same series, so 1.000 means no better than tomorrow-equals-today. The outlined cell in each row is the best forecaster on that series.`;
  }

  function wireControls() {
    document.querySelectorAll(".seg").forEach((seg) => {
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        if (b.dataset.suite) state.suite = b.dataset.suite;
        if (b.dataset.metric) state.metric = b.dataset.metric;
        renderBoard();
        const t = $("#board");
        t.classList.remove("is-ticking");
        void t.offsetWidth;
        t.classList.add("is-ticking");
      });
      seg.addEventListener("keydown", (e) => {
        if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        const bs = [...seg.querySelectorAll("button")];
        const i = bs.indexOf(document.activeElement);
        const n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
        n.focus();
        n.click();
        e.preventDefault();
      });
    });
  }

  // ---------- paired tests ----------
  function testRow(r) {
    const share = r.won / r.n;
    const left = Math.min(share, 0.5) * 100;
    const width = Math.abs(share - 0.5) * 100;
    return `<div class="test" role="row">
      <div class="test__pair" role="cell">${esc(label(r.a))}<span class="vs">vs</span>${esc(label(r.b))}</div>
      <div class="share" role="cell" aria-label="${esc(label(r.a))} better on ${r.won} of ${r.n} windows"><i class="${share < 0.5 ? "neg" : ""}" style="left:${left}%;width:${width}%"></i></div>
      <div class="test__won" role="cell">${r.won}/${r.n}</div>
      <div class="test__p ${r.p < 0.05 ? "sig" : ""}" role="cell">p ${pval(r.p)}</div>
    </div>`;
  }
  function renderTests() {
    const head = `<div class="test test--head" role="row"><div role="columnheader">first vs second</div><div role="columnheader">share of windows the first wins (centre line = 50%)</div><div class="test__won" role="columnheader">won</div><div class="test__p" role="columnheader">Wilcoxon</div></div>`;
    $("#tests-list").setAttribute("role", "table");
    $("#tests-list").innerHTML = head + D.finance.paired.map(testRow).join("");
    const cols = ["timestral-209m", "chronos-2", "auto_ets"];
    const names = { 0: "All 11 series", 1: "Without natural gas", 2: "Without natgas and CPI" };
    const rows = D.finance.ablation
      .map((row, i) => {
        const mins = ["mase", "wql"].map((k) => Math.min(...cols.map((c) => row[c][k])));
        const tds = cols
          .flatMap((c) => ["mase", "wql"].map((k, j) => `<td class="${row[c][k] === mins[j] ? "lead" : ""}">${f(row[c][k])}</td>`))
          .join("");
        return `<tr><th scope="row">${names[i]}</th>${tds}</tr>`;
      })
      .join("");
    $("#ablation").innerHTML = `<caption class="visually-hidden">Suite scores with series left out</caption>
      <thead><tr><th></th>${cols.map((c) => `<th colspan="2" scope="colgroup">${esc(label(c))}</th>`).join("")}</tr>
      <tr><th scope="col">series kept</th>${cols.map(() => "<th scope='col'>MASE</th><th scope='col'>WQL</th>").join("")}</tr></thead><tbody>${rows}</tbody>`;
  }

  // ---------- companions ----------
  function renderCompanions() {
    const before = Object.fromEntries(D.pairs.before.paired.map((r) => [r.a, r]));
    const rows = D.pairs.paired
      .map((r) => {
        const d = PRS[r.a].rel_mase / PRS[r.b].rel_mase - 1;
        const b = before[r.a];
        return `<tr><td>${esc(label(r.a))}</td><td class="${d < 0 ? "up" : "dn"}">${pct(d)}</td><td>${r.won}/${r.n}</td><td class="${r.p < 0.05 ? "sig" : ""}">${pval(r.p)}</td><td class="${b && b.p < 0.05 ? "sig" : ""}">${b ? pval(b.p) : "n/a"}</td></tr>`;
      })
      .join("");
    const s = "sp500_monthly+vix_daily";
    const pairsRow = [["timestral-28m", "timestral-28m+cov"], ["timestral-209m", "timestral-209m+cov"], ["chronos-2-small", "chronos-2-small+cov"], ["chronos-2", "chronos-2+cov"]]
      .map(([u, c]) => {
        const a = cell("pairs", s, u).mase;
        const b = cell("pairs", s, c).mase;
        const d = b / a - 1;
        return `<tr><td>${esc(label(u))}</td><td>${f(a)}</td><td>${f(b)}</td><td class="${d < -0.005 ? "up" : d > 0.005 ? "dn" : ""}">${pct(d)}</td></tr>`;
      })
      .join("");
    $("#comp").innerHTML = `<div>
        <h3>Each variant against its univariate self</h3>
        <table class="ctable"><caption class="visually-hidden">Companion variants versus univariate</caption>
          <thead><tr><th scope="col">variant</th><th scope="col">Δ rel MASE</th><th scope="col">won</th><th scope="col">p, 36w</th><th scope="col">p, 12w</th></tr></thead><tbody>${rows}</tbody></table>
        <p>Only Chronos-2-small with a covariate improves consistently, and it did so at both sample sizes. Six comparisons put a Bonferroni-corrected p near 0.10, and the improved model still trails univariate Timestral-28M (${f(PRS["chronos-2-small+cov"].rel_mase)} vs ${f(PRS["timestral-28m"].rel_mase)}).</p>
      </div>
      <div>
        <h3>S&amp;P 500 level, with VIX as companion</h3>
        <table class="ctable"><caption class="visually-hidden">S&amp;P 500 level with and without VIX</caption>
          <thead><tr><th scope="col">model</th><th scope="col">alone</th><th scope="col">+VIX</th><th scope="col">change</th></tr></thead><tbody>${pairsRow}</tbody></table>
        <p>At 12 windows every model improved with VIX. At 36 the effect splits: large for Chronos-2-small, small for Timestral-209M, none for Chronos-2, and negative for Timestral-28M. Market-implied volatility says something about next year's index level, but not reliably to every model.</p>
      </div>`;
  }

  // ---------- corrections ----------
  function renderClaims() {
    const t209 = FIN["timestral-209m"];
    const claims = [
      ["held", "Every Timestral size beats Chronos-2.", `Still true: even 5M scores ${f(FIN["timestral-5m"].rel_mase)} against ${f(FIN["chronos-2"].rel_mase)}, and 209M wins 306 of 528 windows.`],
      ["held", "Companion series barely matter; only Chronos-2-small+cov gains.", "Same result on three times the windows (p = 0.017 on 216)."],
      ["revised", "Timestral beats AutoETS.", `On average, yes (${f(t209.rel_mase)} vs ${f(FIN.auto_ets.rel_mase)}). On point forecasts the lead is natural gas; window by window it is not significant (p = 0.12). The WQL lead holds.`],
      ["revised", "Bigger Timestral is better.", "Only 5M is distinguishable. 28M, 123M and 209M tie; at 48 windows 123M leads by a hair."],
      ["overturned", "Chronos-2 is the only model below the random walk on natural gas.", `Timestral matches it (${f(fin("natgas_daily", "timestral-209m"))} vs ${f(fin("natgas_daily", "chronos-2"))}).`],
      ["overturned", "Only AutoETS has calibrated bands.", `Timestral is closer to 0.80 (${f(t209.coverage_80, 2)}); AutoETS over-covers (${f(FIN.auto_ets.coverage_80, 2)}).`],
      ["overturned", "VIX improves every model's S&P 500 forecast.", "Chronos-2 is unchanged and Timestral-28M gets worse."],
      ["overturned", "Chronos-2 is about 3× slower than Timestral.", "Those timings included loading the weights. Warm and batched, Chronos-2 is the faster model."],
    ];
    $("#claims").innerHTML = claims
      .map(([st, was, now]) => `<li class="claim"><span class="stamp stamp--${st}">${st.toUpperCase()}</span><p class="claim__was">${st === "overturned" ? `<s>${esc(was)}</s>` : esc(was)}</p><p class="claim__now">${esc(now)}</p></li>`)
      .join("");
  }

  function renderSlope() {
    const before = Object.fromEntries(D.finance.before.board.map((r) => [r.model, r.rel_mase]));
    const models = D.finance.board.map((r) => r.model).filter((m) => m !== "historic_average" && m !== "naive");
    const W = 460, H = 360, top = 26, bot = 20, xl = 112, xr = W - 112;
    const all = models.flatMap((m) => [before[m], FIN[m].rel_mase]);
    const lo = Math.min(...all) - 0.01, hi = Math.max(...all) + 0.01;
    const y = (v) => top + ((v - lo) / (hi - lo)) * (H - top - bot);
    const place = (side) => {
      const pts = models.map((m) => ({ m, v: side === "l" ? before[m] : FIN[m].rel_mase })).sort((a, b) => a.v - b.v);
      let last = -Infinity;
      for (const p of pts) { p.y = Math.max(y(p.v), last + 13); last = p.y; }
      return Object.fromEntries(pts.map((p) => [p.m, p.y]));
    };
    const L = place("l"), R = place("r");
    const lines = models.map((m) => {
      const c = INK[famOf(m)];
      const nm = famOf(m) === "stats" ? short(m) : `${famOf(m) === "timestral" ? "T" : "C"}-${short(m)}`;
      return `<g><line x1="${xl}" y1="${y(before[m])}" x2="${xr}" y2="${y(FIN[m].rel_mase)}" stroke="${c}" stroke-width="1.5"/>
        <circle cx="${xl}" cy="${y(before[m])}" r="2.5" fill="${c}"/><circle cx="${xr}" cy="${y(FIN[m].rel_mase)}" r="2.5" fill="${c}"/>
        <text x="${xl - 8}" y="${L[m] + 3.5}" text-anchor="end" fill="${c}" font-size="10">${esc(nm)} ${f(before[m])}</text>
        <text x="${xr + 8}" y="${R[m] + 3.5}" fill="${c}" font-size="10">${f(FIN[m].rel_mase)} ${esc(nm)}</text></g>`;
    }).join("");
    $("#slope").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="slope-t"><title id="slope-t">rel MASE at 6 and 48 windows: ${models.map((m) => `${label(m)} ${f(before[m])} to ${f(FIN[m].rel_mase)}`).join("; ")}</title>
      <text x="${xl}" y="12" text-anchor="middle" fill="var(--muted)" font-size="10">6 WINDOWS</text>
      <text x="${xr}" y="12" text-anchor="middle" fill="var(--muted)" font-size="10">48 WINDOWS</text>
      <line x1="${xl}" y1="${top - 6}" x2="${xl}" y2="${H - bot + 6}" stroke="var(--rule-hi)"/><line x1="${xr}" y1="${top - 6}" x2="${xr}" y2="${H - bot + 6}" stroke="var(--rule-hi)"/>
      ${lines}</svg>`;
  }

  // ---------- outlook ----------
  function renderOrders() {
    const orders = [
      [1, "Leakage-free windows", "Score only on data the models cannot have seen: windows after each model's training cutoff, or prospective forecasts made now and scored as the data arrives.", "Monthly windows reach back to 1978. If Timestral's CPI and S&P scores are partly memory, the monthly half of the lead could shrink."],
      [1, "Leave finance", "Run the same harness on GIFT-Eval or fev-bench subsets with real seasonality: energy load, retail, traffic, weather.", "Most of these series are near random walks, where no model can shine. Published benchmarks rank Chronos-2 highly; this suite may simply be the wrong terrain for it."],
      [2, "Error by horizon step", "Break MASE and WQL out by step (day 1 to day 20, month 1 to month 12) instead of averaging a window.", "Foundation models may win at long horizons and lose at short ones, or the reverse; window averages hide it."],
      [2, "Known-future covariates", "Feed calendar features and scheduled events (FOMC, OPEC and CPI release dates) as known-future inputs, which both models support.", "Past-only companions did little. Information about the future window is where covariates should earn their keep."],
      [2, "Calibration beyond 80%", "PIT histograms and coverage at 50, 90 and 98%.", "Timestral looks calibrated at 80%; tails matter more for risk, and Chronos-2's narrow bands may be worse there."],
      [2, "Returns everywhere", "Log returns for every price series, scored against the historic mean rather than the random walk.", "Price levels reward sitting on the last value. Returns test whether a model has any edge at all."],
      [3, "Equal-context ablation", "Cap Timestral at Chronos-2's 8,192 steps (and both at 1,024) and rerun.", "Separates architecture from context length, which differ by 4× here."],
      [3, "Fine-tuning", "A light fine-tune on each series' training windows against the zero-shot result.", "Zero-shot is the floor; the gap to fine-tuned tells you how much the pretraining is doing."],
      [3, "More foundation models", "TimesFM, Moirai, TiRex and Toto behind the same adapter protocol.", "Two models is a duel, not a field."],
      [3, "Pre-registered comparisons", "Fix the comparisons before running, and apply Holm correction.", "Several p-values here sit near 0.02 and would not survive a family-wise correction."],
    ];
    $("#orders").innerHTML = orders
      .map(([p, t, what, why]) => `<li class="order"><span class="prio prio--${p}" aria-label="priority ${p}">P${p}</span><div><h3>${esc(t)}</h3><p>${esc(what)}</p></div><p class="why"><b>Could change:</b> ${esc(why)}</p></li>`)
      .join("");
  }

  // ---------- navigation ----------
  function wireNav() {
    const links = [...document.querySelectorAll(".keys a")];
    document.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      const a = links.find((l) => l.dataset.key === e.key);
      if (!a) return;
      e.preventDefault();
      const target = document.querySelector(a.getAttribute("href"));
      target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      history.replaceState(null, "", a.getAttribute("href"));
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((l) => l.setAttribute("aria-current", String(l.getAttribute("href") === `#${en.target.id}`)));
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    document.querySelectorAll("main .sect").forEach((s) => io.observe(s));
  }

  renderTape();
  renderPanes();
  renderDossiers();
  renderBoard();
  wireControls();
  renderTests();
  renderCompanions();
  renderClaims();
  renderSlope();
  renderOrders();
  wireNav();
})();
