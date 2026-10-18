<!-- agent-notes: { ctx: "reviewer lens: security and compliance", deps: [team/roles/reviewer/SKILL.md], state: draft, last: "claude@2026-09-09" } -->

## Lens: Security

Guiding question: if an attacker saw this diff, what would they try?

- Injection: SQL, command, template, XSS, SSRF, path traversal.
- Auth and authorisation: are permissions checked, completely and in the right place? Any privilege escalation or bypass?
- Secrets in code, config, logs, or error messages.
- Data handling: PII exposure, missing encryption, sensitive values in logs, audit trails that a change silently stops writing.
- Input at trust boundaries: malformed, oversized, or unexpected input.
- Sessions: expiry, fixation, CSRF.
- New dependencies: known vulnerabilities, license compatibility, transitive copyleft, maintainer health, release age.
- New attack surface with no corresponding control: an endpoint, a file read driven by an argument, a subprocess.
- Regulatory exposure: consent, retention, cross-border data, audit requirements.
- Harm to the owner by the team's own tools: credential leakage, destructive commands, unbounded autonomy.

This lens carries a veto on security and compliance grounds: a merge or release can be blocked. A veto names the exposure, the evidence, and what lifts it, and is escalated to the human.

Verify by running where you can. A finding you reasoned your way to is weaker than one you reproduced.
