# Project Structure

## Module Map

| File/Directory | Key Symbols | Responsibility |
|---|---|---|
| `src/models/proposal.ts` | All K8sModel definitions, GVK constants, CRD types, `derivePhaseFromConditions`, `getPhaseDisplay` | Central type definitions and phase logic |
| `src/config.ts` | `getApiUrl` | API proxy URL construction |
| `src/utils/approval.ts` | `findStage`, `getStageStatus`, `stageNeedsApproval`, `buildApprovalPatch` | Pure functions for approval logic |
| `src/utils/markdown.ts` | `renderMarkdown`, `renderMarkdownInline` | Sanitized markdown rendering for AI-generated text (marked + DOMPurify). `renderMarkdown` emits block HTML; `renderMarkdownInline` emits inline HTML. All links are hardened with `target="_blank" rel="noopener noreferrer"`. |
| `src/utils/proposal-utils.ts` | `buildPodLogUrl`, `getOutcomeStatus`, `getReversibilityColor` | Helpers for pod log URLs, outcome status mapping, reversibility colors |
| `src/components/proposals/ProposalListPage.tsx` | `ProposalListPage` | Proposal list with virtualized table and phase filters |
| `src/components/proposals/ProposalDetailPage.tsx` | `ProposalDetailsPage` | Section-based proposal detail page, delegates to `detail/` subcomponents |
| `src/components/proposals/detail/AnalysisSummary.tsx` | `AnalysisSummary` | Root cause display, analysis loading/streaming state |
| `src/components/proposals/detail/RemediationOptionCard.tsx` | `RemediationOptionCard` | Expandable remediation option card |
| `src/components/proposals/detail/ExecutionSummary.tsx` | `ExecutionSummary` | Post-execution actions and outcome display |
| `src/components/proposals/detail/VerificationSummary.tsx` | `VerificationSummary` | Verification checks and summary |
| `src/components/proposals/detail/ProposalPhaseLabel.tsx` | `ProposalPhaseLabel` | Phase label with status color |
| `src/components/proposals/detail/ProposalTimeline.tsx` | `ProposalTimeline` | Chronological event timeline |
| `src/components/proposals/detail/StageInProgress.tsx` | `StageInProgress` | In-progress stage card with embedded log viewer |
| `src/components/proposals/detail/SandboxLogViewer.tsx` | `SandboxLogViewer` | Expandable log viewer with streaming and search |
| `src/components/AgenticLayout.tsx` | `AgenticLayout` | Watches `AgenticOLSConfig` CR; renders a system-suspended danger banner above page content when `spec.suspended` is true |
| `src/components/ConfirmationModal.tsx` | `ConfirmationModal` | Reusable confirmation modal with confirm/cancel actions, loading state, and inline error display |
| `src/components/StatusGuard.tsx` | `StatusGuard` | Loading/error/empty gate using PatternFly `ErrorState`; replaces internal console `StatusBox` |
| `src/models/proposal-views.ts` | `ProposalView`, `RemediationOptionView`, `ExecutionView`, `VerificationView`, `SandboxView`, `TimelineEvent`, `TERMINAL_PHASES` | View-model types for the detail page (output of `useProposal` mapping layer) |
| `src/constants.ts` | `PROPOSAL_NAMESPACE`, `PROPOSAL_LABEL_SOURCE`, `RESULT_LABEL_PROPOSAL` | Shared constants for K8s label keys and namespace |
| `src/hooks/useProposal.ts` | `useProposal`, `mapRootCause`, `mapOption`, `mapExecution`, `mapVerification`, `mapTimeline`, `filterLatest` | Fetches proposal + result CRs, maps API types → view types |
| `src/hooks/useExecutionLogActions.ts` | `useExecutionLogActions` | Parses execution actions from sandbox pod logs |
| `src/hooks/useSandboxLogStream.ts` | `useSandboxLogStream` | Streams audit lines from sandbox pod logs |
| `src/components/configuration/ConfigurationPage.tsx` | `ConfigurationPage` | Configuration page with tabbed layout |
| `src/components/configuration/ApprovalPolicyTab.tsx` | `ApprovalPolicyTab` | Approval policy CRUD |
| `src/components/configuration/LLMProvidersTab.tsx` | `LLMProvidersTab` | LLM provider list and creation |
| `src/components/configuration/AgentsTab.tsx` | `AgentsTab` | Agent tier list and creation |
| `src/components/configuration/LLMProviderForm.tsx` | `LLMProviderForm` | Type-specific provider creation form |
| `src/components/configuration/AgentForm.tsx` | `AgentForm` | Agent creation form with provider selection |
| `console-extensions.json` | — | Plugin extension declarations (routes, nav items) |
| `webpack.config.ts` | — | Module federation and build configuration |
| `playwright.config.ts` | — | Playwright e2e test configuration |
| `integration-tests/support/fixtures.ts` | `test`, `oc`, `gatherClusterArtifacts` | Custom test fixture, cluster CLI helper, artifact collection |
| `integration-tests/support/global-setup.ts` | `globalSetup` | Operator readiness, browser login, storageState |
| `integration-tests/support/global-teardown.ts` | `globalTeardown` | Cluster cleanup and artifact gathering |
| `.tekton/lightspeed-agentic-console-pull-request.yaml` | — | Konflux PipelineRun for PR builds |
| `.tekton/lightspeed-agentic-console-push.yaml` | — | Konflux PipelineRun for push builds |
| `.tekton/integration-tests/lightspeed-agentic-console-pre-commit.yaml` | — | Konflux integration test Pipeline running lint, unit tests, and i18n checks |

## Key Entry Points

The plugin has no traditional `main` entry point. Webpack's `ConsoleRemotePlugin` generates entry points from `console-extensions.json`. The three exposed modules are:

1. `ProposalListPage` → `src/components/proposals/ProposalListPage.tsx`
2. `ProposalDetailPage` → `src/components/proposals/ProposalDetailPage.tsx`
3. `ConfigurationPage` → `src/components/configuration/ConfigurationPage.tsx`

## Naming Conventions

- Components: PascalCase `.tsx` files, one primary component per file, default export.
- CSS: co-located `.css` files alongside components. All classes prefixed `ols-plugin__`.
- Models: `proposal.ts` contains all CRD types and K8s intersection types. `proposal-views.ts` contains view-model types (`*View` suffix) for the detail page.
- Hooks: `use` prefix, one hook per file in `src/hooks/`.
- Detail subcomponents: each section of the detail page is a separate component in `src/components/proposals/detail/`, imported by `ProposalDetailPage.tsx`.
