---
agent-notes: { ctx: "ADR: offer a free/offline dependency scanner (osv-scanner) as a content-axis backstop to the ADR-0010 cooldown; opt-in CI scaffold (default off), CI-enforced where enabled; cloud behavioural scanner opt-in only; explicitly NOT an airbag", deps: [CLAUDE.md, docs/adrs/template.md, docs/adrs/0010-dependency-release-age-cooldown.md, .claude/commands/pin-versions.md, docs/process/done-gate.md, docs/team-directives.md, docs/sbom/dependency-decisions.md, .claude/agents/pierrot.md, docs/scaffolds/threat-model.md], state: proposed, last: "claude@2026-07-09" }
---

# ADR-0011: Dependency Supply-Chain Scan

## Status

Proposed (2026-07-09) — awaiting ratification. This ADR is the **spec, not the build**: it decides *whether*, *which tool*, and *how* Summon adds a dependency scanner; the `pin-versions` step, the done-gate sub-item, the team-directives lines, the `pierrot.md` ownership bullet, the CI scaffold, and the threat-model annotation are the *implementation*, sequenced into a follow-up PR after ratification. Archie authored the topology, Pierrot supplied the security substance and owns the malicious-hit veto, Ines owns the CI wiring, and Wei challenged — Wei's challenge changed this ADR materially (it retired the "airbag" framing and forced the honesty clause below).

## Context

ADR-0010 shipped a release-age **cooldown** — a *time* filter that refuses a dependency version until it has survived N days in the wild. Its Alternative E named, but deliberately deferred, a second control: *"the cooldown is the cheap seatbelt … a scanner is the airbag."* This ADR takes up that deferred decision, and it exists as its own record (rather than a footnote to 0010) because two things are now concrete that E left abstract: **(1)** a specific tool choice and enforcement mechanism have to be made, with real free-vs-cloud trade-offs; and **(2)** 2026 evidence has materially changed what an install-time scanner can honestly claim (see the honesty clause), which retires the "airbag" language E used.

**The coverage gap.** Summon's current supply-chain controls are blind in the same direction. `npm/pip/cargo audit` + the SBOM match installed versions against *already-disclosed CVEs* — they see only what has been triaged and published, never whether a package is *hostile*. The cooldown reads a publish timestamp and inspects nothing. None of them ever open the package and look at its contents or check it against a malicious-package feed. So four threat classes pass all three: malicious install/lifecycle scripts (`postinstall`, `build.rs`, `sdist` hooks), credential-exfil behaviour, malicious-from-v1 typosquats, and packages already on a curated malware list. A scanner is the only control that reasons about the *content* of the artifact.

**Constraints.** Summon is a Markdown methodology framework that *scaffolds* config/process into polyglot projects (npm/pnpm/pip/cargo/go); it runs no host and cannot intercept `npm install`. So "add a scanner" means scaffold a real tool + a CI check + a `pin-versions` step + a gate item — not build a scanner, and not a lifecycle pre-install hook. The landing page's promise is literally *"No runtime. No dependencies. Just markdown,"* which bounds what can be a **default**: a required cloud scanner would violate that promise on three axes (a SaaS dependency, a network/egress trust surface, and a cost).

## Decision

Adopt a dependency scan as a **content-axis** complement to the cooldown's time axis, in two nested decisions:

**Decision A — control strength: document-and-offer (opt-in CI scaffold, default off). NOT require; NOT default-on.**
Summon documents the scanner and ships a real, working, free CI scaffold that a project turns *on* by choice — it is not enabled by default. This keeps the framework's footprint minimal (nothing scanner-shaped is forced into a project that didn't ask for it) and adoption fully the owner's, at the accepted cost that the known-bad floor covers only projects that opt in. A hard *require* is rejected (it forces an external dependency and breeds override fatigue). Default-on scaffolding — the team's original recommendation, recorded as rejected Alternative G — was set aside deliberately, primarily to avoid **mandating a specific free tool**: a Summon-scaffolded project may already run in-house scanning, or may prefer a different scanner than osv-scanner, and a default-on scaffold quietly pushes one tool's choice onto every such project. Opt-in leaves the tool decision where it belongs — with the project. (A secondary point: for the *free* tool the net-new signal over the `audit` step already in `pin-versions` is modest, so shipping it on by default earns little to offset that imposition.) This is a lighter posture than ADR-0010's cooldown (which ships default-on); the asymmetry is intentional — the cooldown adds zero tooling and zero egress, while even the free scanner adds a binary and a CI step a project may not want.

**Decision B — default tool: free / OSS / offline. Cloud behavioural scanner is an opt-in upgrade only.**

| Tier | Tool | Trust surface | Signal |
|------|------|---------------|--------|
| **Free floor (opt-in scaffold, default off)** | `osv-scanner` (Google, Apache-2.0, single Go binary) over the resolved lockfile — OSV.dev including its **malicious-packages** dataset — beside the native `npm/pip/cargo audit` already in `pin-versions`. First-class `--offline` mode. | Local binary + a public feed; **no account, no code upload, zero egress**; air-gap-capable. | Known-vulnerable + **known-malicious** packages, polyglot. Feed-based. |
| **Opt-in upgrade** | Socket / StepSecurity | Cloud account; behavioural install-script analysis; **uploads package identities/source to a third party**; no air-gap. | Behavioural detection of *suspicious-but-unreported* publishes — the strongest signal available, and the most evadable (see honesty clause). |
| **Free partial (GitHub only)** | Dependabot malware alerts (GA 2026-03, npm-only, curated-list) | GitHub-hosted; zero-config. | Known-malicious list for repos already on GitHub. |

osv-scanner is the tool the scaffold offers because it is free, polyglot, offline-capable, and **leaks nothing** — it adds no trust surface, which is the exact objection ADR-0010 raised against mandating Socket. (Decision B picks *which* tool a project would run; Decision A keeps that scaffold opt-in.) Snyk is not the default (per-seat, CVE-first, overlaps audit). `npm audit signatures` / provenance is orthogonal (it answers "who built this," not "is it hostile") — enable where free.

**Enforcement — CI, out-of-band from the agent, is the real control (where enabled).** Summon cannot execute a scan; it can only instruct an agent to, and asking the agent to self-scan is circular — the agent is the surface the malware targets. So the load-bearing home is the **opt-in CI step** (or a check in the project's health-check registry) that, once a project turns it on, runs `osv-scanner` on the committed lockfile and blocks merge on a malicious-package hit, without the agent's cooperation. The `pin-versions` step is the local/no-CI fallback. This sets the done-gate grade: **deterministic** where the project has enabled the CI scan, **inferential** for an agent-run local scan or any behavioural "clean," **n/a** — the default — where the project has not opted in. Because the scaffold is off by default, most projects sit at **n/a** until they choose otherwise; the gate item reads "scan enabled? if so, green; if not, recorded as not-adopted," never a false "we scanned."

**Override.** A human-approved bypass of a scan finding is recorded in the same `docs/sbom/dependency-decisions.md` log ADR-0010 already defines (`package, version, finding, reason, approved-by, date`). One audit trail for fresh-and-flagged packages let in anyway. Overrides are human-approved, never agent-self-cleared.

### Honesty clause (load-bearing — do not soften downstream)

**This is not an airbag. There is no install-time airbag.** ADR-0010's Alternative E called a scanner "the airbag"; 2026 evidence retires that framing. *Cloak and Detonate* (arXiv 2607.02357, July 2026) tested 1,613 malicious agent skills against 8 install-time scanners; self-extracting packing bypassed **all eight >90%** — and the domain is Claude Code / Codex agent skills, Summon's exact surface. The only defense that held was *runtime* auditing, which Summon has no host to run. Therefore:

- The scaffolded default (osv-scanner) is a **known-bad content backstop** — it catches *reported*-malicious and *disclosed*-vulnerable packages that cleared the age gate. It makes no claim to catch novel malice.
- The opt-in behavioural upgrade (Socket) catches *opportunistic, non-adaptive* malware (real value against the Shai-Hulud worm, dumb `postinstall` exfil), but a determined attacker who reads its published red flags obfuscates around them — >90% evadable under adaptive attack.
- The **old + behaviourally-malicious** quadrant — the patient backdoor (xz ~5 weeks live behind a ~2-year setup; event-stream) — passes the cooldown *and* the scan, and is covered only by human provenance/health review. The ADR states this plainly so nobody treats the scan as sufficient.

Framing to use everywhere downstream (including any marketing): the cooldown is a seatbelt (time axis); the scan is a second, overlapping seatbelt (content axis). Neither is an airbag. Summon's own marketing must not describe this control as one.

### Composition with ADR-0010 (no redundancy)

Orthogonal axes, each covering the other's blind spot:

| | ADR-0010 cooldown | ADR-0011 scan |
|---|---|---|
| **Axis** | Time — refuse a version until it has survived N days | Content — check a version against a known-bad feed |
| **Catches** | Fast-caught smash-and-grab, *before it's even reported*, by waiting | A *reported* malicious/vulnerable package, at any age, that cleared the age gate |
| **Blind to** | A patient backdoor; a not-yet-reported malicious-from-v1 typosquat | A brand-new malicious publish not yet in the feed |

The cooldown's blind spot (a bad release that survives N days) is the scan's strength (feed-reported → caught at any age); the scan's blind spot (fresh unreported malware) is the cooldown's strength (age it out until the feed catches up). Neither subsumes the other.

## Alternatives Considered

- **A. No scanner — status quo (cooldown + audit + SBOM).** Rejected: the content axis is entirely unguarded; a reported-malicious package that cleared the cooldown is adopted silently.
- **B. Require a scanner (hard gate).** Rejected as a blanket rule — forces an external dependency and a trust surface onto every scaffolded project (ADR-0010's Alternative E logic), over-fits a 3-file CLI to the same mandate as a fintech, and breeds the override fatigue that hollows a gate out. Retained only as the free deterministic floor a project can opt into, never a requirement.
- **C. Default to a cloud behavioural scanner (Socket).** Rejected: egresses the project's dependency identities/source to a third party, adds a network trust surface and cost, and breaks air-gapped/regulated projects — a default that would contradict "no runtime, no dependencies, just markdown." Socket is the documented opt-in upgrade instead.
- **D. Docs + an opt-in CI scaffold (Wei's lighter option) — ADOPTED (this is Decision A).** Pure docs-only with *nothing* scaffolded stays rejected as theatre — a prose mandate no tooling runs never deploys. The adopted form pairs the docs with a real, working CI scaffold a project switches on by choice: the only non-theatrical enforcement is an out-of-band CI scan, not an "agent, please scan" instruction. Chosen over default-on (Alternative G) to keep the framework's footprint opt-in.
- **E. Extend ADR-0010's Alternative E instead of minting a new ADR (Wei's framing objection).** Considered seriously: E already rejected scanners-as-requirement and recommended them as complementary. Rejected because the tool selection, the CI-enforcement mechanism, and — decisively — the 2026 evasion evidence that retires the "airbag" claim are a substantive new decision that deserves its own record, not a silent edit to a ratified ADR. Recorded here so the dissent is on file.
- **F. Snyk, or provenance/attestation only.** Snyk rejected as default (per-seat cost, CVE-first, overlaps audit/osv). `npm audit signatures`/Sigstore provenance is orthogonal and complementary (verifies the builder, not the intent) — enable where free, not a substitute.
- **G. Recommend-and-scaffold, default-on and removable (the team's original recommendation).** Rejected at ratification in favour of the opt-in posture (D). It would ship a working control into every scaffolded project by default — symmetric with ADR-0010's default-on cooldown — but the owner declined to **mandate a specific free tool**: some projects already run in-house scanning, and others may prefer an alternative to osv-scanner, so a default-on scaffold imposes one tool's choice on projects that may have their own. Opt-in keeps tool selection with the project. (The free tool's modest net-new signal over the existing `audit` step was a secondary reason: little upside to offset the imposition.) Recorded so the rejected majority recommendation, and the reason it lost, are on file.

## Consequences

### Positive
- Closes the content-axis gap that time/CVE controls structurally cannot see — for projects that opt in, reported-malicious packages that cleared the cooldown are now caught.
- The offered tool adds **no trust surface and zero egress** (osv-scanner offline), so a project can enable it without violating the framework's own promise — and a project that wants nothing extra keeps a truly bare footprint.
- Where enabled, CI enforcement is deterministic and out-of-band from the agent — a real control, not a "we told it to."
- The framework's own footprint stays minimal: the default install ships docs and an *offered* scaffold, not an on-by-default binary + CI step.
- One shared, human-gated override log with ADR-0010; one audit trail for every fresh-or-flagged package let in anyway.

### Negative
- **Partial redundancy.** osv-scanner overlaps the existing `audit` step (it widens the feed, not the technique), and for GitHub-hosted repos Dependabot already covers much of the known-malicious set. The net-new signal from the *free* default is modest; the large net-new signal (behavioural) lives only in the opt-in cloud tool, which most projects won't enable.
- **The strongest tool is the most evadable.** Per the honesty clause, behavioural scanning is >90% evadable under adaptive attack. This control raises the floor against opportunistic malware; it does not stop a determined adversary.
- **Override erosion, sharpened by agents.** If a scan cries wolf, the entity clicking "override" is often the agent itself, which waves through faster and less accountably than a human. The human-gated, logged-override discipline (inherited from ADR-0010) is the only thing holding this up.
- **Opt-in means most projects get no floor.** This is the accepted cost of the lighter posture over default-on (Alternative G): a scaffold a project must switch on is a scaffold most projects leave off, so the realized content-axis coverage across Summon's install base is lower than a default-on control would deliver. The ADR takes minimal-footprint over broad-by-default coverage deliberately; downstream docs must not describe the scan as protecting projects that never enabled it.
- **Real enforcement depends on the CI scaffold (Ines) — where opted in.** Without CI, the done-gate item is inferential "we ran it locally" rather than deterministic — an implementation-PR dependency, flagged like ADR-0007's.

### Neutral
- The **old + malicious** quadrant stays open by design, covered only by human review — stated, not solved.
- ADR-0003 risk tiers *may* later nudge high-assurance projects to enable the behavioural upgrade; deferred, not decided here.
- Marketing/site copy must continue to frame this as a seatbelt, never an airbag — the honesty clause governs downstream prose.
