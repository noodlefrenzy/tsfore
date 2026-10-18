// agent-notes: { ctx: "a dispatch plan as a workflow: one pipeline per item, one agent per station, claims through dispatch.mjs", deps: [scripts/dispatch.mjs, team/lines/tdd.json, team/workflows/review-wave.workflow.mjs, docs/methodology/team-layers.md], state: draft, last: "claude@2026-09-09", key: ["runs only inside the Workflow tool; the plan comes from dispatch.mjs plan and the events from dispatch.mjs claim and the seats' own Log sections", "each station is the composed seat as a custom agent type, so the prompt here is the work order and nothing about the role", "earn-gated per ADR-0012 C with the review station; plan, open, and claim run without it"] }
export const meta = {
  name: 'line',
  description: 'Run a dispatch plan: every item through every station of its line, in order, on the instances the plan assigned',
  whenToUse: 'After dispatch.mjs plan and open. Each station claims through dispatch.mjs claim, which refuses an out-of-order or same-instance claim before the seat starts.',
  phases: [
    { title: 'Red', detail: 'the tester station writes the failing tests for each item' },
    { title: 'Green', detail: 'the coder station makes them pass, on a different instance from the one that will review' },
    { title: 'Review', detail: 'the review formation reads the change; refutation lives in the review-wave workflow' },
  ],
}

// args: { planPath, plan: { order, line, limits, items: [{ id, spec, stations: [{ station, seat, instance, needs, emits }] }] } }
// The plan is dispatch.mjs plan's output, read by the caller and passed in whole, because a workflow
// has no filesystem. No clock here: every claim and return is stamped by the seat's shell.

const STATION_RESULT = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    summary: { type: 'string' },
    emitted: { type: 'string', description: 'what this station handed on: the test paths, the diff, or the verdicts, as text the next station can read' },
    refused: { type: 'string', description: 'the dispatch refusal message, verbatim, when the claim was refused' },
  },
  required: ['ok', 'summary'],
}

const PHASE = { red: 'Red', green: 'Green', review: 'Review' }

function stationPrompt(plan, item, st, previous) {
  const claim = `node scripts/dispatch.mjs claim --plan ${plan.planPath} --item ${item.id} --station ${st.station} --at "$(date -u +%FT%TZ)"`
  let p = `Work order ${plan.order}, line ${plan.line}, item ${item.id}, station ${st.station}. You are instance ${st.instance}; write that instance id on every event you log.\n\n`
  p += `First command, before anything else:\n\n    ${claim}\n\nIf it refuses, stop: return ok=false, summary=its message, refused=its message. Do not work an item whose claim was refused.\n\n`
  if (item.spec) p += `## The item\n\n${item.spec}\n\n`
  if (st.needs && st.needs.length && previous) p += `## What the previous station handed you (${st.needs.join(', ')})\n\n${previous}\n\n`
  p += `## What this station emits\n\n${st.emits}. Put it in \`emitted\` as text the next station can read without your context: paths for tests, a unified diff for a change, one line per lens for verdicts.\n\n`
  p += `When you finish, log your \`return\` event as your Log section says, then return.`
  return p
}

async function runStation(plan, item, st, previous) {
  const opts = { label: `${st.station}:${item.id}`, phase: PHASE[st.station] || st.station, schema: STATION_RESULT, agentType: st.seat }
  if (plan.limits && plan.limits.isolation === 'worktree') opts.isolation = 'worktree'
  const r = await agent(stationPrompt(plan, item, st, previous), opts)
  if (!r) return { station: st.station, instance: st.instance, ok: false, summary: 'seat did not return', emitted: '' }
  return { station: st.station, instance: st.instance, ...r }
}

const plan = { ...args.plan, planPath: args.planPath }
// pipeline() hands the first stage the item itself as its "previous result"; only later stages get a stage record.
const stages = (plan.items[0] ? plan.items[0].stations : []).map((_, i) => async (prevResult, item) => {
  const st = item.stations[i]
  const prev = i === 0 ? null : prevResult
  if (prev && prev.halted) return prev
  const previous = prev ? prev.emitted : null
  const r = await runStation(plan, item, st, previous)
  const done = [...(prev ? prev.done : []), r]
  if (!r.ok) {
    log(`${item.id}: ${st.station} on ${st.instance} did not pass (${r.refused ? 'refused: ' : ''}${r.summary}); later stations skipped`)
    return { halted: true, done, emitted: '' }
  }
  return { halted: false, done, emitted: r.emitted || '' }
})

const results = await pipeline(plan.items, ...stages)
const items = plan.items.map((item, i) => ({ id: item.id, stations: results[i] ? results[i].done : [], halted: results[i] ? results[i].halted : true }))
const finished = items.filter((x) => !x.halted).length
log(`${finished} of ${items.length} items reached the end of the line`)
return { order: plan.order, line: plan.line, items }
