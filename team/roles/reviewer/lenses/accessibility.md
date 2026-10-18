<!-- agent-notes: { ctx: "reviewer lens: accessibility and design authority, conditional on UI changes", deps: [team/roles/reviewer/SKILL.md, team/roles/designer/SKILL.md, docs/adrs/0013-design-authority.md], state: draft, last: "claude@2026-09-09" } -->

## Lens: Accessibility

Activates when the change touches UI: components, templates, stylesheets, layouts.

Guiding question: can everyone use this, and does every non-accessibility judgment cite a source?

- Semantic structure: heading hierarchy, landmark regions, labelled form controls.
- Keyboard: every interactive element focusable and operable; focus order logical; focus visible.
- Screen readers: ARIA only where semantic HTML falls short; live regions for dynamic content.
- Contrast: 4.5:1 for normal text, 3:1 for large text and UI boundaries.
- Responsive: no horizontal scroll on small viewports; content reflows rather than clips.
- Motion: `prefers-reduced-motion` respected; nothing auto-plays.
- Performance: bundle growth and render cost of the change, against the project's budget.

Every accessibility finding cites the WCAG criterion. Every other visual finding cites a source, resolved top-down by files present: the project's `docs/design-profile.md` first (authoritative; a knowing contradiction recorded in the change is fine), an installed add-on's design artefacts second (advisory, named as such), and when neither exists say so once at the top and raise only accessibility and internal-consistency findings; taste becomes a question, never a finding. An unsourced aesthetic preference is not a finding.
