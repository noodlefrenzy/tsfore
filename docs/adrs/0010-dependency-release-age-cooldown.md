---
agent-notes: { ctx: "ADR: N-day release-age cooldown on newly adopted dependency versions to blunt supply-chain attacks; native PM enforcement preferred; explicit logged override; scope = direct deps at add/upgrade", deps: [CLAUDE.md, docs/adrs/template.md, docs/adrs/0003-project-risk-tiers.md, .claude/commands/pin-versions.md, docs/process/done-gate.md, docs/team-directives.md, docs/sbom/dependency-decisions.md, .claude/agents/pierrot.md], state: accepted, last: "claude@2026-07-09" }
---

# ADR-0010: Dependency Release-Age Cooldown

## Status

Accepted (2026-07-09) — ratified by the human on merge of the implementation PR. Archie authored the topology, Pierrot supplied the threat rationale and owns enforcement, and Wei challenged the window (which set the default to 3 days, not 7). The `pin-versions.md` step, the done-gate sub-item, the `team-directives.md` line, and the `pierrot.md` ownership bullet are the *implementation* of this decision, not substitutes for it — the reasoning and the number live here.

## Context

Supply-chain attacks on package registries follow a consistent shape: an attacker compromises a maintainer account or a CI token and publishes a malicious version of an otherwise-trusted package — a malicious `postinstall`, credential exfiltration, or a subtly trojaned build. The defining property of these incidents is **time-to-detection**: the community, the registry, and scanners typically flag and yank the bad release within hours to a couple of days. The window in which you can be poisoned is the gap between publish and yank.

Summon already pins versions and regenerates an SBOM (`pin-versions.md`), and Pierrot runs CVE/audit scans. But `npm audit` / `pip audit` / `cargo audit` only catch *known-and-disclosed* CVEs — they are blind to a *fresh* malicious publish that has not yet been reported. Pinning locks you to a version; it does nothing to stop you pinning to the poisoned one on day zero. Nothing in Summon's current topology puts distance between "a version was published" and "we install it."

A cooldown closes exactly that gap: refuse to adopt a version until it has survived N days in the wild, by which point most compromised releases have been caught and pulled. It is a cheap probabilistic filter, not a guarantee. The evidence is honest about its limits: of ~21 catalogued npm/PyPI compromises, roughly half were caught within hours to a few days — the smash-and-grab, token-theft class the cooldown is good against — while the patient backdoors that do the real damage (event-stream ~2.5 months live, xz/CVE-2024-3094 ~5 weeks live behind a ~2-year social-engineering setup) outlast any fixed window. So the cooldown blunts the common, fast-caught attack and does nothing against a determined one; it must complement, never replace, CVE/audit and health checks. The cost is real and pointed: the same delay that protects you from a poisoned release also *delays a legitimate emergency patch*, so the design stands or falls on a clean override path.

Constraints: Summon scaffolds polyglot projects (npm/pnpm/pip/cargo/go). Enforcement must degrade gracefully where a package manager has no native cooldown. ADR-0003 risk tiers exist and could scale the window, but a per-tier matrix is speculative until asked for.

## Decision

Adopt a **default release-age cooldown of 3 days** on any dependency **version newly added or upgraded** in a change, with an **explicit, logged override**. Six parts:

1. **What "age" means.** The publish/upload timestamp of the *specific version being adopted* (npm `time[version]`, PyPI `upload_time_iso_8601`, crates.io `created_at`, Go proxy `.info` Time, RubyGems `created_at`), not the package's first-ever release. A version is adoptable when `now - publish_time >= 3 days`.

2. **Scope: direct dependencies at add/upgrade time.** The cooldown gates the versions the change deliberately chooses. Transitive versions are governed by the lockfile + audit; native package-manager cooldowns (below) extend the protection to the *resolved lockfile* transitively for free where available, but Summon does not *require* an agent to hand-verify the age of every transitive node.

3. **Mechanism: prefer native package-manager enforcement, fall back to an agent/script check.** Where the package manager ships a cooldown, configure it and let the resolver enforce it deterministically and transitively:
   - **pnpm** ≥ 10.16: `minimumReleaseAge: 4320` (minutes = 3 days) in `pnpm-workspace.yaml`, with `minimumReleaseAgeExclude` for sanctioned exceptions.
   - **Bun**: `minimumReleaseAge` in `bunfig.toml` (+ exclude list).
   - **npm** ≥ 11.10 / **Yarn** ≥ 4.10: the native minimum-release-age config / age gate per the package manager's docs.
   Where no native setting exists (pip, cargo, go today), `pin-versions.md` performs a registry timestamp check for each newly-adopted direct version and blocks releases younger than the window.

4. **Override — explicit and logged; a CVE fix is the sanctioned case, but not an automatic one.** The human (or Pierrot on security grounds) may override for a specific version. The override is recorded in `docs/sbom/dependency-decisions.md` with the version, the date, and the reason. **Adopting a fresh version because it fixes an actively-exploited CVE is an approved override — the cooldown must never be the reason a security patch is delayed.** Critically, "it's a security fix" is *human-approved, not auto-detected*: attackers deliberately disguise malicious releases as urgent security patches precisely to skip cooldowns, so the fast path exists but a human authorises it. In native package managers the override is the exclude list; otherwise it is an entry the check reads and honours.

5. **Window = 3 days, configurable; uniform across tiers by default.** 3 days is the default because the detection data is bimodal: the attacks a cooldown actually catches are caught *fast* (ua-parser-js was live ~4 hours; the Shai-Hulud npm worm was largely yanked within hours), so most of the protection is banked in the first day or two, and every additional day is pure delay on legitimate upgrades — a "patch-adoption tax" for near-zero marginal malware coverage. The window is a project setting: **7 days** is a reasonable higher-margin choice (it is where much of the ecosystem's tooling defaults) and **14 days** is a paranoid tier for regulated / high-assurance projects. ADR-0003 tiers *may* lengthen it, but the default is uniform — per-tier windows are deferred as YAGNI until a project needs them.

6. **Enforcement grade climbs toward deterministic.** Today the check is agent-run inside `pin-versions.md` → **inferential**. The registry-timestamp comparison is trivially a script, so a follow-up can build it as a deterministic sensor — a `pin-versions` sub-check or a check in the project's portable health-check registry, the natural downstream home for a per-project dependency assertion. This is the done-gate "encode the fix, not the memory" path.

## Alternatives Considered

- **A. No cooldown — status quo (pin + lockfile + audit).** Rejected: audit is blind to undisclosed fresh malware, which is the entire threat. Pinning locks you *to* the poisoned version on day zero.
- **B. Directive-only, no ADR.** Rejected as the *recording* vehicle — the rule needs an Alternatives Considered, a contested default, and a first-class exception to itself (the CVE fast-track), which is exactly what `team-directives.md`'s own promotion rule says makes something an ADR. Adopted as one *implementation* surface: the directive is the human-readable one-liner this ADR authorises.
- **C. Window = 7 days (Pierrot's recommendation).** A defensible higher-margin default — 7 sits past the bulk of the detect-and-yank curve and is where Renovate/Dependabot-style tooling commonly lands. Rejected *as the default* in favour of 3 because the fast-caught class is caught in hours, so days 4–7 buy little marginal coverage while taxing every legitimate upgrade; 7 is retained as a documented higher-assurance tier. This was a genuine split — the number is a one-file setting precisely so a project can pick its own point on the friction/margin curve.
- **D. Window = 14 / 30 days.** 30 starves normal upgrade flow and breeds blanket overrides that hollow the rule out; 14 is retained only as an explicit paranoid tier for regulated projects.
- **E. Third-party supply-chain platform (Socket, StepSecurity, osv-scanner).** Stronger signal — behavioural/install-script analysis rather than age, and it catches a 4-hour-old bad package and a 4-month-old one alike. Rejected as a *requirement* because it adds an external dependency and a network trust surface to every scaffolded project, but **recommended as a complementary control**: the cooldown is the cheap seatbelt against opportunistic smash-and-grab, a scanner is the airbag. Native PM cooldown gives most of the cheap benefit at zero added trust surface.
- **F. Provenance/attestation only (npm provenance, sigstore).** Answers "who published this," not "has it survived contact with the world." A signed malicious release from a compromised account still signs cleanly. Orthogonal and complementary, not a substitute.

## Consequences

### Positive

- Closes the undisclosed-fresh-malware gap that audit/pinning structurally cannot see.
- Where the package manager supports it, enforcement is deterministic and free (resolver-level, and it covers transitive deps too).
- The override path makes the CVE fast-track explicit and human-gated, so the rule can neither silently block security work nor be tricked into waving through malware disguised as a fix.
- Ships as canon into every scaffolded project — a real portable hardening default, not Summon-internal.

### Negative

- **Delays legitimate upgrades**, including non-CVE bug fixes, by up to the window. Mitigation: the logged override, and a short (3-day) default.
- **False sense of security.** A patient or persistent attacker outlasts any fixed window, and cooldowns do nothing about pre-existing vulns or malicious-from-v1 typosquats. Must be stated so nobody treats it as sufficient — it is necessary-not-sufficient, paired with audit/health checks.
- **Polyglot enforcement is uneven** — deterministic in pnpm/Bun/npm/Yarn, agent-run elsewhere until the sensor lands. The grade is honestly `inferential` for pip/cargo/go in the interim.
- **Override erosion risk.** If overriding is easier than waiting, the rule decays to theatre. The logged-with-reason requirement in `dependency-decisions.md` is the friction that keeps it honest; a lower default window reduces the temptation to override at all.

### Neutral

- ADR-0003 tiers *may* scale the window later; deferred, not decided here.
- The deterministic sensor is a follow-up, homed in `pin-versions` or the project's health-check registry.
