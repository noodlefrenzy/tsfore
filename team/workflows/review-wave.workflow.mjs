// agent-notes: { ctx: "the review station of the line as a workflow: one agent per lens, schema-constrained verdicts, adversarial refutation of every finding", deps: [scripts/review-wave.mjs, team/parties/summon-core.json, docs/methodology/team-layers.md], state: draft, last: "claude@2026-09-09", key: ["runs only inside the Workflow tool; no filesystem here, so prepare and ingest live in scripts/review-wave.mjs", "args come from review-wave.mjs prepare: item, diff, lenses[{lens, persona, display, prompt}]", "earn-gated per ADR-0012 C: Workflow is a research preview; the prose formation stays the floor"] }
export const meta = {
  name: 'review-wave',
  description: 'Review one change with the party formation: one agent per lens, then refute every finding',
  whenToUse: 'The review station of the tdd line. Prepare args with scripts/review-wave.mjs prepare; ingest the return with review-wave.mjs ingest.',
  phases: [
    { title: 'Review', detail: 'one agent per lens, floor plus the conditionals the diff triggered' },
    { title: 'Refute', detail: 'a skeptic per finding, prompted to knock it down' },
  ],
}

// args: { item, diff, changed, lenses: [{ lens, persona, display, prompt, conditional, because }], skipped }
// Everything the lenses need is in the prompt prepare() built from the composed formation; this
// script adds no prose of its own beyond the task framing. No clock, no randomness: the ingest
// step stamps the time.

const FINDING = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: ['critical', 'important', 'suggestion'] },
    summary: { type: 'string' },
    file: { type: 'string' },
    line: { type: 'integer' },
    why: { type: 'string' },
  },
  required: ['severity', 'summary'],
}

const LENS_RESULT = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['accept', 'revise', 'veto'] },
    findings: { type: 'array', items: FINDING },
    clean: { type: 'string' },
  },
  required: ['verdict', 'findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['refuted', 'reason'],
}

const lenses = (args && args.lenses) || []
if (!lenses.length) throw new Error('review-wave: args.lenses is empty; run scripts/review-wave.mjs prepare first')
log(`reviewing ${args.item}: ${lenses.map((l) => l.lens).join(', ')}${args.skipped && args.skipped.length ? ` (skipped: ${args.skipped.map((s) => s.lens).join(', ')})` : ''}`)

const reviewPrompt = (l) => `${l.prompt}

# The change under review

Work item: ${args.item}
Changed paths: ${(args.changed || []).join(', ') || '(none listed)'}

\`\`\`diff
${args.diff}
\`\`\`

Apply your lens to this change and return your verdict (accept, revise, or veto) and your findings. Each finding names a severity, a one-sentence summary, and the file and line where you can. If your lens found nothing, say what you checked in \`clean\`.`

const refutePrompt = (l, f) => `You are a skeptic. A reviewer holding the ${l.lens} lens made this finding on work item ${args.item}:

- severity: ${f.severity}
- summary: ${f.summary}
- location: ${f.file || '?'}${f.line !== undefined ? `:${f.line}` : ''}

Here is the change:

\`\`\`diff
${args.diff}
\`\`\`

Try to refute the finding: show it is wrong, out of scope for the change, or already handled by the diff. Default to refuted=true if you cannot point at the line that makes the finding true. Return refuted and a one-sentence reason.`

// Every lens reviews independently; every finding is then refuted independently. No barrier:
// a lens with two findings is fully refuted while a slower lens is still reading.
const results = await pipeline(
  lenses,
  (l) => agent(reviewPrompt(l), { label: `review:${l.lens}`, phase: 'Review', schema: LENS_RESULT }).then((r) => ({ lens: l, r })),
  ({ lens: l, r }) => {
    if (!r) return { lens: l.lens, persona: l.persona, verdict: 'revise', findings: [], failed: true }
    return parallel(
      (r.findings || []).map((f) => () =>
        agent(refutePrompt(l, f), { label: `refute:${l.lens}`, phase: 'Refute', schema: VERDICT, effort: 'medium' }).then((v) => ({ ...f, refuted: v ? v.refuted : false, refutation: v ? v.reason : 'skeptic did not return; finding kept' })),
      ),
    ).then((findings) => ({ lens: l.lens, persona: l.persona, verdict: r.verdict, clean: r.clean, findings: findings.filter(Boolean) }))
  },
)

const lensResults = results.filter(Boolean)
const failed = lensResults.filter((x) => x.failed).map((x) => x.lens)
if (failed.length) log(`lenses that did not return (kept as revise with no findings, so the control can see the gap): ${failed.join(', ')}`)
const kept = lensResults.reduce((n, x) => n + x.findings.filter((f) => !f.refuted).length, 0)
const dropped = lensResults.reduce((n, x) => n + x.findings.filter((f) => f.refuted).length, 0)
log(`${lensResults.length} lenses returned; ${kept} findings survived refutation, ${dropped} refuted`)

return { item: args.item, lenses: lensResults, skipped: args.skipped || [] }
