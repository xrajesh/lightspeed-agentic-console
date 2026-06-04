# System Overview

The OpenShift Lightspeed Agentic Console Plugin is a dynamic plugin that loads into the OpenShift Console at runtime via webpack module federation. It provides the "AI Hub" — a UI for cluster administrators to view, approve, and monitor AI-driven proposals that diagnose and remediate cluster issues. The plugin is read-only with respect to cluster workloads; it only reads Proposal CRs and patches ProposalApproval CRs to express human decisions.

## Behavioral Rules

### System Role

1. The plugin MUST load into OpenShift Console via the ConsolePlugin CRD and webpack module federation. It does not run standalone.
2. The plugin MUST register three routes: `/lightspeed/proposals` (list), `/lightspeed/proposals/:ns/:name` (detail), and `/lightspeed/configuration` (settings).
3. The plugin MUST add a navigation item labeled "AI Hub" under the Administration section of the admin perspective.
4. All user-facing strings MUST use the `plugin__lightspeed-agentic-console-plugin` i18n namespace.
5. All CSS classes MUST be prefixed with `ols-plugin__` to avoid style conflicts with the host console.

### API Contract

6. All custom resources use API group `agentic.openshift.io` version `v1alpha1`.
7. The plugin communicates with the cluster exclusively through the OpenShift Console SDK's `useK8sWatchResource` (reads) and `k8sPatch`/`k8sCreate`/`k8sDelete` (writes).
8. The plugin proxies API requests to the lightspeed backend through `/api/proxy/plugin/lightspeed-agentic-console-plugin/ols`.
9. Pod logs are streamed via the Kubernetes API at `/api/kubernetes/api/v1/namespaces/{ns}/pods/{pod}/log` using `consoleFetch`.

### CRD Inventory

10. The plugin operates on these CRDs: Proposal (namespaced), ProposalApproval (namespaced), Agent (cluster-scoped), LLMProvider (cluster-scoped), ApprovalPolicy (cluster-scoped), AnalysisResult (namespaced), ExecutionResult (namespaced), VerificationResult (namespaced), EscalationResult (namespaced).
11. Result CRs (AnalysisResult, ExecutionResult, VerificationResult, EscalationResult) are discovered via label selector `agentic.openshift.io/proposal: <proposal-name>` and correlated to their parent Proposal via `status.steps.<stage>.results[]` references.

## Configuration Surface

| Field/Flag | Type | Default | Description |
|---|---|---|---|
| `consolePlugin.name` | string | `lightspeed-agentic-console-plugin` | Plugin name registered with console |
| `plugin.image` | Helm value | — | Container image location for deployment |

## Constraints

- React 17 (matches console's React version) — do not upgrade to React 18.
- PatternFly 6 — use PF components and CSS variables exclusively. No hex colors.
- No naked element selectors or `.pf-`/`.co-` prefixed classes in CSS.
- TypeScript strict mode is off (`strict: false`) but `noUnusedLocals` is enforced.
- `exposedModules` in package.json MUST match `$codeRef` values in console-extensions.json exactly.

## Planned Changes

| Ticket | Summary |
|---|---|
| — | Auto-generate CRD types from OpenAPI schema (noted as TODO in `src/models/proposal.ts`) |
