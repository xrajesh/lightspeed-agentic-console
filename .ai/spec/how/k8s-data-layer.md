# Kubernetes Data Layer

## Module Map

| File | Key Symbols | Responsibility |
|---|---|---|
| `src/models/proposal.ts` | `LightspeedProposalModel`, `LightspeedProposalGVK`, all `*Model`/`*GVK` constants | K8sModel definitions for the Console SDK's watch/patch/create/delete functions |
| `src/models/proposal.ts` | `LightspeedProposal`, `LightspeedProposalApproval`, `*ResultCR` types | TypeScript types for each CRD |
| `src/models/proposal.ts` | `ProposalK8s`, `AnalysisResultK8s`, `ExecutionResultK8s`, `VerificationResultK8s`, `ProposalApprovalK8s` | K8s intersection types (`CRDType & K8sResourceCommon`) for `useK8sWatchResource` generics |
| `src/models/proposal-views.ts` | `ProposalView`, `RemediationOptionView`, `ExecutionView`, `VerificationView` | View-model types — output of the API→view mapping layer |
| `src/hooks/useProposal.ts` | `useProposal`, `mapToProposalView` | Fetches all proposal-related CRs and maps to a single `ProposalView` |
| `src/utils/approval.ts` | `buildApprovalPatch` | Generates JSON Patch arrays for `AgenticRunApproval` mutations |

## Data Flow

### AgenticRun Watching

```
useK8sWatchResource(ProposalGVK, {name, namespace})
  → WebSocket watch on /apis/agentic.openshift.io/v1alpha1/namespaces/{ns}/agenticruns/{name}
  → Console SDK manages cache invalidation and re-renders
```

### Result CR Correlation

Result CRs are not watched by name. Instead:

```
useK8sWatchResource(AnalysisResultGVK, {namespace, selector: {matchLabels: {agentic.openshift.io/run: name}}, isList: true})
  → Returns all AnalysisResults for this run
  → getLatestResult(results, proposal.status.steps.analysis.results)
    → Finds the result CR referenced by the last entry in the step's results array
```

This pattern repeats for ExecutionResult, VerificationResult, and EscalationResult. The `results[]` array on each step status contains `{name, outcome}` refs — the name matches the result CR's `metadata.name`.

The `useProposal` hook wraps all five watches (Proposal, AnalysisResult, ExecutionResult, VerificationResult, ProposalApproval) and uses `filterLatest` to select the most recent result CR by `creationTimestamp`. The mapped `ProposalView` is recomputed via `useMemo` whenever any watched resource changes.

### Approval Patch Generation

`buildApprovalPatch` handles three structural cases:
1. **Stages array exists** (`spec.stages` is non-empty): appends via `add` to `/spec/stages/-`
2. **Spec exists but no stages**: creates the array via `add` to `/spec/stages`
3. **No spec at all**: creates the entire spec via `add` to `/spec`

### Log Streaming

```
consoleFetch(/api/kubernetes/.../pods/{pod}/log?container=agent&follow=true&timestamps=true)
  → ReadableStream reader
  → Chunks buffered in logChunksRef, flushed every 200ms via setTimeout
  → On stream end: non-follow fetch to capture remaining buffered output
  → On error: exponential backoff reconnect (1s → 15s max)
```

## Key Abstractions

### K8sModel Pattern

Every CRD has a paired `K8sModel` (used by Console SDK functions) and a `GVK` object (used by `useK8sWatchResource`). The `K8sModel` includes `apiGroup`, `apiVersion`, `kind`, `plural`, `namespaced`, and display labels. These are defined once in `proposal.ts` and imported everywhere.

### Type Union Strategy

CRD types are hand-written, not generated. A TODO exists to auto-generate from OpenAPI. The types closely mirror the CRD status structure — changes in the operator's CRD require manual synchronization here.

K8s intersection types (e.g., `ProposalK8s = LightspeedProposal & K8sResourceCommon`) are defined at the bottom of `proposal.ts` for use with `useK8sWatchResource` generics. A separate view-model layer in `proposal-views.ts` defines UI-optimized types (`ProposalView`, `RemediationOptionView`, etc.) with `*View` suffix. The `useProposal` hook in `src/hooks/useProposal.ts` contains pure mapping functions (`mapRootCause`, `mapOption`, `mapExecution`, `mapVerification`, `mapTimeline`) that transform API types into view types. Phase derivation is centralized in `derivePhaseFromConditions` (defined in `proposal.ts`, used by both list and detail pages).

### Approval Logic

Approval logic is embedded in the `useProposal` hook — a single hook instance per detail page. It exposes:
- Read: `canApprove` / `canApproveLoading` → derived from `useAccessReview` on `proposalapprovals`
- Write: `approveExecution(optionIndex, maxRetries)` / `denyExecution()` → `k8sPatch` with patches from `buildApprovalPatch`
- State helpers: `stageNeedsApproval()` and `getStageStatus()` from `src/utils/approval.ts` are used internally

There is no per-tab instantiation — the detail page uses a single-page sectioned layout.

## Integration Points

| Consumer | Provider | Mechanism |
|---|---|---|
| All components | Kubernetes API | Console SDK `useK8sWatchResource` (WebSocket) |
| Approval actions | Kubernetes API | Console SDK `k8sPatch` (HTTP PATCH) |
| Configuration CRUD | Kubernetes API | Console SDK `k8sCreate`/`k8sPatch`/`k8sDelete` |
| Log streaming | Kubernetes API | `consoleFetch` with ReadableStream |
| Backend proxy | Lightspeed service | `/api/proxy/plugin/.../ols` (defined in `src/config.ts` but currently unused) |

## Implementation Notes

- The Console SDK's `useK8sWatchResource` returns `[data, loaded, error]` and handles WebSocket lifecycle internally. The plugin does not manage WebSocket connections directly except for log streaming.
- Watch configs are memoized with `React.useMemo` to prevent unnecessary re-subscriptions.
- Result CR watches use `isList: true` with label selectors rather than watching by name, because the result CR name is only known after the step creates it.
- The `consoleFetch` function is the Console SDK's authenticated fetch wrapper — it handles CSRF tokens and auth headers transparently.
