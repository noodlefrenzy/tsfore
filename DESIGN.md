---
name: tsfore results site
description: Market-terminal reporting of a forecasting benchmark, for technical peers.
colors:
  ground: "#000000"
  pane: "#0b0b0b"
  pane-hi: "#141414"
  rule: "#2b2b2b"
  rule-hi: "#474747"
  text: "#ececec"
  prose: "#d2d2d2"
  code: "#ffd29c"
  row: "#1b1b1b"
  muted: "#a3a3a3"
  dim: "#7a7a7a"
  amber: "#ffa028"
  amber-ink: "#1a0f00"
  better: "#4aa8ff"
  worse: "#ff5a4e"
  fam-stats: "#ececec"
  fam-timestral: "#45e3b8"
  fam-chronos: "#c49bff"
typography:
  headline:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2rem, 1.2rem + 2.4vw, 3.6rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(1.6rem, 1.1rem + 1.6vw, 2.5rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  quote:
    fontFamily: "Martian Mono, ui-monospace, Menlo, monospace"
    fontSize: "clamp(1.25rem, 0.9rem + 1vw, 1.75rem)"
    fontWeight: 600
    lineHeight: 1.15
  data:
    fontFamily: "Martian Mono, ui-monospace, Menlo, monospace"
    fontSize: "0.74rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Martian Mono, ui-monospace, Menlo, monospace"
    fontSize: "0.66rem"
    fontWeight: 700
    letterSpacing: "0.06em"
rounded:
  none: "0px"
spacing:
  gutter: "clamp(16px, 3vw, 40px)"
  cell-y: "7px"
  cell-x: "10px"
  pane: "14px"
  section: "64px"
components:
  function-key:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.muted}"
    typography: "{typography.data}"
    padding: "0 12px"
  function-key-current:
    backgroundColor: "#1d1205"
    textColor: "{colors.amber}"
  segment:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.muted}"
    typography: "{typography.data}"
    padding: "8px 12px"
  segment-selected:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
  pane:
    backgroundColor: "{colors.pane}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "{spacing.pane}"
---

<!-- agent-notes: { ctx: "impeccable design system for the tsfore results site", deps: [site/style.css, site/index.html, PRODUCT.md], state: active, last: "claude@2026-10-18", key: ["recorded from the built site, not the plan", "sidecar: .impeccable/design.json"] } -->

## Overview

A 1990s financial terminal repurposed to report a model benchmark. Model families are quoted like securities: a pane per family, a quote grid per series, findings on a ticker, corrections stamped as corrections. It is a Read surface for technical peers, so the terminal grammar carries data and navigation while running prose stays in a proportional face at reading measure.

The scene that sets the theme: a forecasting engineer at a desk with several monitors, reading results between runs. Dark is the terminal's native register, not a category default.

## Colors

Restrained, terminal-strict. True black ground with near-black panes separated by hairline rules. **Amber** is the chrome: commands, function keys, selected segments, the best value in a comparison, significant p-values. It is never decoration.

- **Quote ink:** `better` (blue) and `worse` (red) mean better or worse than the random-walk baseline, or which side of 50% a paired test falls. Blue/red, not green/red, for colour-vision safety, and every tinted cell also prints its number.
- **Family ink:** statistics white, Timestral teal, Chronos-2 violet. Used only to identify a family (pane names, group headers, chart lines and member bars), never for good or bad.
- `prose` is the slightly softer white for long body text; `code` tints inline code and variables; `row` is the faint rule between table rows.
- Secondary text is neutral `muted` / `dim` on black, all at or above 4.5:1 for body sizes.

## Typography

Two families, self-hosted (OFL, `site/fonts/`).

- **Martian Mono at `font-stretch: 87.5%`** for everything that is data, a command or a label: quotes, tables, function keys, stamps, the ticker. Tabular numerals everywhere (`font-variant-numeric: tabular-nums` on `body`).
- **Archivo**: condensed (`font-stretch: 70–75%`, weight 800) for the wire headline and section heads; normal width for body prose at 65–75ch.
- Labels are uppercase mono at 0.66–0.72rem with 0.06–0.08em tracking. Headings are sentence case, never uppercase.

## Layout

Hairline-ruled grids, not cards: panes sit in a grid with `gap: 1px` over a `rule-hi` background, so the rules are the gaps. Max content width 1320px inside a fluid gutter. Section heads split heading and dek into two columns on desktop. Dense tables scroll inside their own focusable region; the page never scrolls sideways. Breakpoints: 1080px (dossiers to two columns), 860px (everything single column), 620px (compact bar).

## Elevation & Depth

None. No shadows and no blur; depth comes from the three ground levels (`ground`, `pane`, `pane-hi`) and hairline rules. The one inset outline (1px amber) marks the best value in a quote-board row.

## Shapes

Square corners everywhere (`rounded.none`). Colour chips are 9px squares. Status stamps are rectangular outlines, filled only for OVERTURNED.

## Components

- **Command bar:** sticky. Amber brand block, a command echo (`FMVS <GO>`), numbered function keys (the number keys 1–8 jump to sections; the key in view gets `aria-current`), run status on the right.
- **Ticker tape:** the page's single authored motion: a linear marquee of model quotes and headlines. It pauses on hover or focus, has a PAUSE/PLAY button, and is static under `prefers-reduced-motion`.
- **Family pane:** header strip (family chip and best member), one-line description, a 2×2 quote grid (rel MASE, rel WQL, 80% coverage, sec/window; the lead across families in amber), and WINS / LOSES / TIES lines.
- **Quote board:** series × model table, sticky row headers, family group headers, cells tinted by log-ratio to the baseline (or by distance from 0.80 for coverage), best per row outlined in amber, footer row with the suite score. Suite and metric switch through segmented radio groups (arrow keys work).
- **Paired-test row:** pair, win-share bar diverging from a 50% centre line, won/n, p-value (amber when p < 0.05).
- **Claim stamp:** HELD (blue outline), REVISED (amber outline), OVERTURNED (red fill; the claim text struck through).
- **Order row:** priority block (P1 filled amber, P2 amber outline, P3 grey outline), test name and description, "Could change" consequence.

## Do's and Don'ts

- Do render every table and chart from `site/data.js` (`scripts/build_site_data.py`); a number in prose must trace to a committed report.
- Do print the number in every coloured cell; colour is never the only carrier.
- Do keep amber for commands, selection and the leading value only.
- Do use mono for data and labels only; prose stays in Archivo.
- Don't add rounded corners, shadows, gradients or glass.
- Don't use family colours to mean better or worse, or the blue/red quote ink to identify a family.
- Don't add a second motion; state transitions stay at 160–220ms colour fades.
