// agent-notes: { ctx: "design tabs: swaps stylesheet and chrome labels per design", deps: [site/index.html, site/style.css, site/form.css, site/release.css, site/app.js], state: active, last: "claude@2026-10-19", key: ["runs after app.js so rendered stamps exist", "the inline head script picks the sheet before first paint; keep its map in sync with SHEETS", "choice lives in ?design= and localStorage; both are optional"] }
// Three designs share one page: the markup, data and prose never change, only the stylesheet and a few chrome labels.
(() => {
  "use strict";
  const SHEETS = { terminal: "style.css", form: "form.css", release: "release.css" };
  const SCHEME = { terminal: "dark", form: "light", release: "light" };
  // Chrome text per design. Terminal labels are read from the markup itself, so index.html stays the source for them.
  const VOCAB = {
    form: {
      brand: "TSFORE",
      cmd: "Past performances",
      keys: ["Card", "Entries", "Races", "Match races", "Coupled", "Inquiry", "Next card", "Conditions", "Glossary"],
      status: ["Sat 18 Oct 2026", "11 races", "Zero-shot"],
      stamps: { held: "Official", revised: "Amended", overturned: "Disqualified" },
    },
    release: {
      brand: "tsfore",
      cmd: "Statistical release",
      keys: ["Summary", "Families", "Series", "Tests", "Pairs", "Revisions", "Outlook", "Technical note", "Definitions"],
      status: ["Released 18 October 2026", "RTX 4090", "Zero-shot"],
      stamps: { held: "Confirmed", revised: "Revised", overturned: "Withdrawn" },
    },
  };

  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const slots = {
    brand: $$(".brand"),
    cmd: $$(".cmd"),
    keys: $$(".keys .key__label"),
    status: $$(".bar__status span"),
  };
  const original = {
    brand: [slots.brand[0].innerHTML],
    cmd: [slots.cmd[0].innerHTML],
    keys: slots.keys.map((el) => el.innerHTML),
    status: slots.status.map((el) => el.innerHTML),
    stamps: Object.fromEntries(["held", "revised", "overturned"].map((k) => [k, (document.querySelector(`.stamp--${k}`) || {}).textContent || k.toUpperCase()])),
  };

  function label(design) {
    const v = VOCAB[design];
    const put = (els, vals, fallback) => els.forEach((el, i) => (v ? (el.textContent = [].concat(vals)[i]) : (el.innerHTML = fallback[i])));
    put(slots.brand, v && v.brand, original.brand);
    put(slots.cmd, v && v.cmd, original.cmd);
    put(slots.keys, v && v.keys, original.keys);
    put(slots.status, v && v.status, original.status);
    for (const k of ["held", "revised", "overturned"]) {
      $$(`.stamp--${k}`).forEach((el) => (el.textContent = v ? v.stamps[k] : original.stamps[k]));
    }
  }

  function apply(design, { save = true } = {}) {
    if (!SHEETS[design]) design = "terminal";
    const current = document.getElementById("design-css");
    const swap = () => {
      document.documentElement.dataset.design = design;
      document.querySelector('meta[name="color-scheme"]').content = SCHEME[design];
      label(design);
    };
    if (current.getAttribute("href") === SHEETS[design]) {
      swap();
    } else {
      // load the new sheet beside the old one, then drop the old: no unstyled flash between them
      const next = current.cloneNode();
      next.href = SHEETS[design];
      next.addEventListener("load", () => { current.remove(); next.id = "design-css"; swap(); }, { once: true });
      next.addEventListener("error", () => next.remove(), { once: true });
      next.removeAttribute("id");
      current.after(next);
    }
    $$(".designs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.design === design)));
    if (!save) return;
    try { localStorage.setItem("tsfore-design", design); } catch (e) { /* storage blocked: the URL still carries it */ }
    const url = new URL(location.href);
    if (design === "terminal") url.searchParams.delete("design");
    else url.searchParams.set("design", design);
    history.replaceState(null, "", url);
  }

  document.querySelector(".designs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-design]");
    if (b) apply(b.dataset.design);
  });
  apply(document.documentElement.dataset.design || "terminal", { save: false });
})();
