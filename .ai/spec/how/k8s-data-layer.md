# Kubernetes Data Layer

## Module Map

| File | Key Symbols | Responsibility |
|---|---|---|
| `src/models/proposal.ts` | `LightspeedProposalModel`, `LightspeedProposalGVK`, all `*Model`/`*GVK` constants | K8sModel definitions for the Console SDK's watch/patch/create/delete functions |
| `src/models/proposal.ts` | `LightspeedProposal`, `LightspeedProposalApproval`, `*ResultCR` types | TypeScript types for each CRD |
| `src/hooks/useStageApproval.ts` | `useStageApproval` | Encapsulates approval read state + patch write in a single hook |
| `src/utils/approval.ts` | `buildApprovalPatch` | Generates JSON Patch arrays for ProposalApproval mutations |
| `src/config.ts` | `getApiUrl` | Constructs backend proxy URLs |

## Data Flow

### Proposal Watching

```
useK8sWatchResource(ProposalGVK, {name, namespace})
  → WebSocket watch on /apis/agentic.openshift.io/v1alpha1/namespaces/{ns}/proposals/{name}
  → Console SDK manages cache invalidation and re-renders
```

### Result CR Correlation

Result CRs are not watched by name. Instead:

```
useK8sWatchResource(AnalysisResultGVK, {namespace, selector: {matchLabels: {agentic.openshift.io/proposal: name}}, isList: true})
  → Returns all AnalysisResults for this proposal
  → getLatestResult(results, proposal.status.steps.analysis.results)
    → Finds the result CR referenced by the last entry in the step's results array
```

This pattern repeats for ExecutionResult, VerificationResult, and EscalationResult. The `results[]` array on each step status contains `{name, outcome}` refs — the name matches the result CR's `metadata.name`.

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

### Approval State Machine

The `useStageApproval` hook combines:
- Read: `stageNeedsApproval()` + `getStageStatus()` → derived from ProposalApproval CR state
- Write: `approve()` + `deny()` → `k8sPatch` with generated patches
- UI state: `inProgress`, `error`, `clearError`

This hook is instantiated once per stage in ProposalDetailPage, giving each tab independent approval state.

## Integration Points

| Consumer | Provider | Mechanism |
|---|---|---|
| All components | Kubernetes API | Console SDK `useK8sWatchResource` (WebSocket) |
| Approval actions | Kubernetes API | Console SDK `k8sPatch` (HTTP PATCH) |
| Configuration CRUD | Kubernetes API | Console SDK `k8sCreate`/`k8sPatch`/`k8sDelete` |
| Log streaming | Kubernetes API | `consoleFetch` with ReadableStream |
| Backend proxy | Lightspeed service | `/api/proxy/plugin/.../ols` (via `getApiUrl`) |

## Implementation Notes

- The Console SDK's `useK8sWatchResource` returns `[data, loaded, error]` and handles WebSocket lifecycle internally. The plugin does not manage WebSocket connections directly except for log streaming.
- Watch configs are memoized with `React.useMemo` to prevent unnecessary re-subscriptions.
- Result CR watches use `isList: true` with label selectors rather than watching by name, because the result CR name is only known after the step creates it.
- The `consoleFetch` function is the Console SDK's authenticated fetch wrapper — it handles CSRF tokens and auth headers transparently.
