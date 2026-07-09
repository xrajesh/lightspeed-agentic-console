# Run Lifecycle

The core domain of the plugin: displaying and managing runs through a multi-stage workflow.

## Behavioral Rules

### Phase Derivation

1. The plugin MUST derive the run phase from `status.conditions[]`, not from a stored phase field. The function `derivePhaseFromConditions` implements this logic and MUST match the operator's `DerivePhase` in `lightspeed-agentic-operator/api/v1alpha1/proposal_types.go`.
2. Phase derivation follows condition priority: EmergencyStopped > Escalated > Denied > Verified > Executed > Analyzed > Pending.
3. Within each condition, `status: True` means the stage completed successfully, `status: Unknown` means the stage is in progress, and `status: False` means the stage failed (unless a specific `reason` indicates retry).
4. The `Verified` condition with reason `RetryingExecution` maps to the `Executing` phase (not `Failed`).

### Run Phases

5. Valid phases are: Pending, Analyzing, Proposed, Executing, Verifying, Escalating, Completed, Failed, Denied, Escalated, EmergencyStopped.
6. Terminal phases are: Completed, Failed, Denied, Escalated, EmergencyStopped. No approval actions are shown for terminal runs.

### Run List

7. The list page MUST watch all `AgenticRun` CRs across namespaces and display them in a virtualized table.
8. The list MUST support filtering by phase and text search.
9. Each row MUST show: name (linked to detail), phase label, request preview (truncated to 80 chars), namespace, and age.

### Run Detail — Layout

10. The detail page MUST gate its content behind a loading/error guard (`StatusGuard`): show a spinner while loading, an error state on failure (403 → restricted access, 404 → not found, other → error message with detail), and the page content when data is ready.
11. The detail page uses a single-page section layout (not tabs). Sections are rendered conditionally based on the current phase: Analysis summary, Remediation options, Execution summary, Verification summary, and Timeline.
12. During in-progress stages (Analyzing, Executing, Verifying), the page MUST show a `StageInProgress` card with embedded live log streaming from the sandbox pod.
13. The page MUST be wrapped in `AgenticLayout` to display the system-suspended banner when the agentic config has `suspended: true`.

### Approval Flow

15. Each stage (Analysis, Execution, Verification, Escalation) can independently require approval based on the `AgenticRunApproval` CR.
15a. **Authorization gate.** Before rendering Approve/Deny buttons, the plugin MUST perform a `useAccessReview` check for `patch` verb on `agenticrunapprovals` resource in API group `agentic.openshift.io`. The namespace MUST fall back from `approval.metadata.namespace` to the run's `metadata.namespace` when the approval CR has not loaded yet. If the user lacks the permission, the buttons MUST be disabled (using `isAriaDisabled` so hover/focus events remain active for the tooltip) with a tooltip stating "You must be a member of system:cluster-admins to approve or deny runs." This check is performed in the `useProposal` hook and exposed as `canApprove`/`canApproveLoading` on the returned view model. The `RemediationOptionCard` component receives `canApprove` as a prop to gate its Execute/Deny buttons, and `ConfirmationModal` is used for execution confirmation. The `approveExecution()` and `denyExecution()` callbacks in `useProposal` MUST also guard against `!canApprove` as defense-in-depth. This prevents confusing 403 errors — the API server enforces the real gate.
16. Approval decisions are written as JSON patches to the `AgenticRunApproval` CR, not to the `AgenticRun` CR.
17. When approving execution, the user can select a specific remediation option (by index) and specify retry count (0-3). Each option's remediation plan contains concrete bash commands (kubectl/oc) visible in the approval view.
18. Execution approval uses a `ConfirmationModal` — the user clicks Execute on a remediation option card, which opens a modal dialog for confirmation with loading state and inline error display.
19. The user can select which Agent to use for each approval stage. The available agents are fetched from the cluster-scoped Agent CRD list.

### Remediation Options

20. Analysis produces one or more `RemediationOption` objects, each containing diagnosis, proposed remediation (a concrete script of ordered bash commands using kubectl/oc), RBAC requirements derived from those commands, and a verification plan. Each action in the remediation plan includes `command` (exact bash command), `type` (phase category: pre-check, mutation, wait, post-check), and `description`. [OLS-3441]
21. When multiple options exist, they are rendered as expandable cards with a "Select this option" button.
22. RBAC permissions shown in the run are derived from the concrete bash commands in the remediation script and locked at approval time — the UI shows a danger-level alert stating the agent cannot escalate its own privileges. [OLS-3441]

### Refine Flow [PLANNED]

23. [PLANNED] After analysis completes, the user can submit revision feedback via a "Refine" button. The `revisionFeedback` field exists in the CRD type definition but no UI component currently renders the Refine button.
24. [PLANNED] Refinement writes `spec.revisionFeedback` to the `AgenticRun` CR via patch. If the value already exists, it uses `replace`; otherwise `add`.
25. [PLANNED] A revision is considered pending when `spec.revisionFeedback` is set AND `metadata.generation` exceeds the `observedGeneration` on the `Analyzed` condition.

### Sandbox Log Streaming

26. While a stage is in progress, the plugin streams logs from the sandbox pod's `agent` container.
27. Log streaming uses `follow: true` with automatic reconnection on stream end or error (exponential backoff from 1s to 15s).
28. When the streaming result data arrives, the log viewer auto-collapses to an expandable section.
29. Logs are capped at 20,000 lines.

### Escalation

31. Verification failure enables an "Escalate" button that opens a confirmation modal.
32. Escalation approval creates an Escalation stage in the `AgenticRunApproval` CR.
33. Escalation results display a summary and optionally the full escalation content in an expandable section.

## Constraints

- The `derivePhaseFromConditions` function is a behavioral contract with the operator. Changes require synchronization.
- The approval patch structure depends on whether `spec`, `spec.stages`, or individual stages already exist — three patch variants are generated accordingly.
