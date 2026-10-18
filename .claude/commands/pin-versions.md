---
description: "Pin dependency versions and regenerate the SBOM and dependency-decisions doc."
---
<!-- agent-notes: { ctx: "pin dependency versions, enforce cooldown, update SBOM + decisions", deps: [docs/sbom/sbom.md, docs/sbom/dependency-decisions.md, docs/adrs/0010-dependency-release-age-cooldown.md], state: active, last: "claude@2026-07-09" } -->
Pin all dependency versions and update the SBOM and dependency documentation.

This command does three things: pins versions in package manager files, regenerates the SBOM, and updates the dependency decisions doc. Run it after adding/removing/upgrading dependencies, or on demand to lock down the current state.

---

## Step 1: Detect Package Manager

Identify the package manager(s) in use by checking for:
- `package.json` / `package-lock.json` → npm/pnpm/yarn/bun
- `requirements.txt` / `pyproject.toml` / `Pipfile` → pip/poetry/pipenv
- `Cargo.toml` / `Cargo.lock` → cargo
- `go.mod` / `go.sum` → go
- `Gemfile` / `Gemfile.lock` → bundler

If multiple are present (e.g., monorepo), handle each one.

---

## Step 2: Pin Versions

For each package manager detected:

### npm/pnpm/yarn/bun
- Run `npm ls --json --all` (or equivalent) to get the full dependency tree.
- Ensure `package.json` uses exact versions (no `^` or `~` prefixes) for all direct dependencies.
- Regenerate the lock file: `npm install` (or equivalent).

### pip
- If using `requirements.txt`: ensure all entries use `==` pinning.
- If using `pyproject.toml` with optional deps: pin in the appropriate section.
- Run `pip freeze > requirements.txt` or update as appropriate.
- If a `requirements-dev.txt` exists, update it too.

### cargo
- `Cargo.lock` handles pinning. Ensure it's committed (not in `.gitignore`).
- Verify `Cargo.toml` versions match lock file.

### go
- `go.sum` handles pinning. Run `go mod tidy` to clean up.

### General
- If the project uses a different package manager, adapt accordingly. Ask the human if unsure (per "Ask the Human When Stuck" rule).

---

## Step 2.5: Enforce the Release-Age Cooldown (ADR-0010)

Before locking any **newly added or upgraded** direct dependency, verify each chosen version is at least **3 days old** (measured from the version's registry publish timestamp), unless the human has approved an override. The 3-day window is the default set by ADR-0010 — that ADR is the single source for the number; treat 7 days (higher margin) and 14 days (regulated projects) as its documented tiers.

- **pnpm** (≥ 10.16): set `minimumReleaseAge: 4320` (minutes = 3 days) in `pnpm-workspace.yaml`; record any exception in `minimumReleaseAgeExclude` and mirror it in `dependency-decisions.md`.
- **Bun**: set `minimumReleaseAge` in `bunfig.toml`.
- **npm** (≥ 11.10) / **Yarn** (≥ 4.10): apply the native minimum-release-age config / age gate per the package manager's docs.
- **pip / cargo / go** (no native cooldown yet): for each newly-adopted direct version, query the registry for its publish time (`PyPI upload_time_iso_8601`, `crates.io created_at`, Go proxy `.info` Time) and **block any version younger than 3 days.** If blocked, stop and ask the human — do not silently pin a younger version.

Prefer the native package-manager setting where it exists: it enforces deterministically and reaches transitive dependencies for free, which the per-version check above does not.

**Override:** if the human approves a fresh version (e.g. a same-day fix to an actively-exploited CVE — an approved override under ADR-0010), record version + date + reason in `docs/sbom/dependency-decisions.md` and proceed. "It's a security fix" is human-approved, never auto-detected — attackers disguise malware as urgent patches to skip cooldowns. The cooldown must never delay a real security patch.

---

## Step 3: Regenerate SBOM

Update `docs/sbom/sbom.md`:

1. **Direct Dependencies table**: List every direct/dev dependency with current pinned version, license, and purpose.
   - Get licenses via the package manager (e.g., `npm ls --json`, `pip-licenses`, `cargo license`).
   - If a license tool isn't installed, ask the human to install it rather than guessing.
2. **License Summary table**: Aggregate license counts.
3. **Total dependency count**: Direct + transitive.
4. **Known Vulnerabilities**: Run `npm audit --json`, `pip audit`, `cargo audit`, or equivalent. Populate any findings.

---

## Step 4: Update Dependency Decisions

Update `docs/sbom/dependency-decisions.md`:

1. **Top-level entries**: For any new direct dependency that doesn't have an entry, create one. Ask the implementing agent (usually Sato) or the human for the rationale if it's not obvious from context.
2. **Transitive Dependencies table**: Regenerate the full table from the dependency tree. For each transitive dep, trace which direct dependency pulls it in.
3. **License Flags**: Flag any transitive dependency with a copyleft or uncommon license.

---

## Step 5: Commit

Commit all changes (pinned files, lock files, SBOM, dependency decisions) as a single atomic commit:
```
chore(deps): pin versions and update SBOM
```

---

## When to Run This Command

- After Sato adds, removes, or upgrades any dependency.
- Before a release (as part of the pre-release checklist).
- When the human asks for version pinning.
- At sprint boundaries if dependencies changed during the sprint.
