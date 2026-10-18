---
description: "Multi-lens cloud deployment-readiness review (architecture, cost, enterprise) for AWS, Azure, or GCP."
---
<!-- agent-notes: { ctx: "multi-lens cloud deployment readiness review for any platform", deps: [.claude/agents/cloud.md], state: active, last: "claude@2026-07-07" } -->
Run a multi-lens review of cloud deployment readiness: $ARGUMENTS

This invokes the Cloud agent to review the current project's cloud setup through three lenses — architecture, cost, and enterprise readiness. Adapts to AWS, Azure, or GCP based on what's in the repo.

Reference `docs/methodology/personas.md` for the broader team context. The Cloud agent extends Ines (DevOps) and Archie (architecture) with deep cloud knowledge.

---

## Step 1: Detect Target Cloud

Determine the target cloud platform:

- Check existing IaC files: Bicep/ARM = Azure, CDK/CloudFormation = AWS, Terraform providers = check which.
- Check `CLAUDE.md` and `docs/adrs/` for documented cloud decisions.
- If present, check `docs/research/{aws,azure,gcp}-landscape.md` for which is populated.
- If `$ARGUMENTS` specifies a cloud, use that.
- If ambiguous or no landscape files exist, ask the user.

Summarize: what cloud resources are defined or planned?

---

## Step 2: Architecture Lens

Review the solution design through the target cloud's Well-Architected Framework:

- **Service selection.** Right services for the workload? Simpler or more cost-effective alternatives?
- **Networking.** Topology sound? Private connectivity where needed? DNS configured correctly?
- **Identity.** Managed identities over keys? Least-privilege IAM? No hardcoded credentials?
- **Resilience.** What happens when a component fails? Multi-AZ/region where appropriate?
- **IaC quality.** Well-structured, parameterized, tagged/labeled?

---

## Step 3: Cost Lens

Review for cost efficiency:

- **Resource sizing.** Right-sized for the workload? Dev vs. prod differentiation?
- **Hidden costs.** NAT/data transfer charges, logging ingestion, idle resources, premium SKUs.
- **Optimization opportunities.** Reserved capacity, auto-scaling, storage tiering, scale-to-zero.
- **Monitoring.** Budget alerts, cost anomaly detection, billing exports configured?

Produce a cost estimate table for dev and production environments.

---

## Step 4: Enterprise Readiness Lens

If deploying into a customer or enterprise environment, assess deployment readiness:

- **Network constraints.** VPC/VNet requirements, subnet capacity, peering, forced tunneling.
- **DNS.** Private zones, forwarding rules, custom DNS servers.
- **Security controls.** Firewall rules, network policies, security groups/NSGs.
- **Platform policies.** SCPs (AWS), Azure Policy, Organization Policies (GCP) that may block actions.
- **IAM/RBAC.** Deployment identity permissions, permission boundaries, domain restrictions.

Produce a Deployment Readiness Report with Ready/Blocked/Unknown status per area.

If this is a personal or non-enterprise deployment, this lens can be lighter.

---

## Step 5: Synthesis

Combine findings from all three lenses into a single prioritized report:

### Critical
Must resolve before deploying. Blocked networking, missing security controls, broken IaC, policy violations.

### Important
Should resolve. Cost overspend risks, missing monitoring, IAM gaps.

### Recommendations
Improvements for the next iteration. Architecture optimizations, reserved capacity, additional resilience.

---

## Step 6: Action Plan

For every finding, provide a concrete next step:
- **Architecture issues** → The Cloud agent can fix the IaC.
- **Cost issues** → The Cloud agent can set up monitoring and budget alerts.
- **Network/security issues** → List exactly what to ask the customer's cloud team, or what diagnostic commands to run.

Confirm the action plan with the user before proceeding with fixes.
