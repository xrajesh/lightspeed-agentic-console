# Verification Report: lightspeed-agentic-console Spec
Verified: 2026-07-23
Spec root: /Users/xavi/street/github.com/AI/ols/lightspeed-agentic-console/.ai/spec/

## Summary
- 2 broken or inaccurate internal references
- 3 internal inconsistencies
- 4 completeness gaps
- 2 cross-repo alignment issues

## Reference Issues

**R1. `audit-logging.md` cross-reference uses stale rule numbers.**
Line 26 says "run-lifecycle.md — approval flow UI (rules 15-18)". The approval flow now spans rules 15, 15a, 15b, 16, 17, 18, 19. Should say "(rules 15-19)" or "(rules 15-18, 19)".

**R2. `k8s-data-layer.md` uses stale RBAC resource name.**
Line 71 says `useAccessReview` checks the `proposalapprovals` resource. Should be `agenticrunapprovals` — the rename (OLS-3295) updated CRD names, and `run-lifecycle.md` rule 15a correctly uses `agenticrunapprovals`. The how/ spec was not updated.

## Internal Inconsistencies

**I1. Phase list in `run-lifecycle.md` omits `NoActionRequired`.**
Rule 5 lists 11 valid phases but does not include `NoActionRequired`. The parent spec (`agentic-runs.md` rule 13) defines it: when `actionRequired=false`, the run transitions to `NoActionRequired`. Rule 2's phase derivation also doesn't mention the `NoActionRequired` reason on the `Analyzed` condition.

**I2. Terminal phase list disagrees with parent spec.**
Rule 6 says terminal phases are: Completed, Failed, Denied, Escalated, EmergencyStopped. The parent spec (`agentic-runs.md` rule 29) says: Completed, Failed, Denied, Escalated, NoActionRequired. `EmergencyStopped` is in the console spec but not the parent; `NoActionRequired` is in the parent but not the console spec.

**I3. Route count vs exposed modules mismatch.**
`system-overview.md` rule 2 declares four routes including `/lightspeed/audit`. But `project-structure.md` lists only three exposed modules (ProposalListPage, ProposalDetailPage, ConfigurationPage) — no AuditPage. Either the audit route exists but the how/ spec is out of date, or it was added to the what/ spec prematurely without `[PLANNED]`.

## Completeness Gaps

**G1. No spec content for the Audit & Logs page.**
`system-overview.md` rule 2 registers `/lightspeed/audit` and rule 3 adds it as a nav item. No what/ file describes what this page renders. `audit-logging.md` explicitly states the console does NOT emit audit events — it only describes approval field population and display.

**G2. Missing rule numbers in `run-lifecycle.md`.**
Rule 14 is missing (jumps from 13 to 15). Rules 29-30 are missing (jumps from 28 to 31). These gaps suggest rules were deleted without renumbering.

**G3. `EmergencyStopped` phase has no behavioral description.**
Listed as highest-priority phase (rule 2), valid phase (rule 5), and terminal phase (rule 6), but no rule describes how a run enters this state or what the console should display.

**G4. No spec for how `NoActionRequired` phase renders in the console.**
The parent spec defines this phase (analysis determines no action is needed). The console would need to display it appropriately — no approve/deny buttons, just diagnosis. No what/ spec describes this rendering.

## Cross-Repo Alignment Issues

**A1. Terminal phase sets diverge between console and parent spec.**
Console includes `EmergencyStopped` but not `NoActionRequired`; parent includes `NoActionRequired` but not `EmergencyStopped`. The `derivePhaseFromConditions` function is a behavioral contract between console and operator, so this divergence is a real alignment risk.

**A2. Phase derivation rule omits `NoActionRequired` sub-case.**
The parent spec specifies: `Analyzed` condition with reason `NoActionRequired` → `NoActionRequired` phase. `run-lifecycle.md` rule 2 states the derivation priority order but does not document this sub-case, risking misclassification of `NoActionRequired` runs as `Proposed`.

## Files Checked

### what/
- audit-logging.md, configuration.md, run-lifecycle.md, system-overview.md

### how/
- console-plugin-system.md, e2e-testing.md, k8s-data-layer.md, project-structure.md

### Other
- README.md, decisions/README.md (empty), no constraints.md or glossary.md

### Cross-repo
- /Users/xavi/street/github.com/AI/ols/.ai/spec/what/agentic-runs.md
