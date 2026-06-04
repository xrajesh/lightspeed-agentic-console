# Project Structure

## Module Map

| File/Directory | Key Symbols | Responsibility |
|---|---|---|
| `src/models/proposal.ts` | All K8sModel definitions, GVK constants, CRD types, `derivePhaseFromConditions`, `getPhaseDisplay`, `resultOutcome` | Central type definitions and phase logic |
| `src/config.ts` | `getApiUrl` | API proxy URL construction |
| `src/utils/approval.ts` | `findStage`, `getStageStatus`, `stageNeedsApproval`, `buildApprovalPatch` | Pure functions for approval logic |
| `src/hooks/useStageApproval.ts` | `useStageApproval` | React hook wrapping approval state and K8s patch operations |
| `src/utils/markdown.ts` | — | Markdown rendering utilities |
| `src/components/proposals/ProposalListPage.tsx` | `ProposalListPage` | Proposal list with virtualized table and phase filters |
| `src/components/proposals/ProposalDetailPage.tsx` | `ProposalDetailPage`, `OverviewTab`, `ProposalTab`, `ResultTab`, `VerificationTab`, `EscalationTab` | Multi-tab proposal detail with approval flows |
| `src/components/proposals/SandboxLogViewer.tsx` | `SandboxLogViewer` | Real-time pod log streaming with reconnection |
| `src/components/proposals/EscalateModal.tsx` | `EscalateModal` | Escalation confirmation modal |
| `src/components/proposals/MarkdownText.tsx` | `MarkdownText` | Sanitized markdown-to-HTML rendering |
| `src/components/proposals/PhaseIcon.tsx` | `PhaseIcon` | Phase status icon with failure indicators |
| `src/components/proposals/DynamicComponent.tsx` | `DynamicComponent` | Component registry dispatch for adapter components |
| `src/components/proposals/dynamic/` | `ResourceDiff`, `Visualization`, `DataTable`, `ActionPicker`, `EvidenceTable`, `StatusTimeline`, `CmoComponents` | Individual dynamic component renderers |
| `src/components/configuration/ConfigurationPage.tsx` | `ConfigurationPage` | Configuration page with tabbed layout |
| `src/components/configuration/ApprovalPolicyTab.tsx` | `ApprovalPolicyTab` | Approval policy CRUD |
| `src/components/configuration/LLMProvidersTab.tsx` | `LLMProvidersTab` | LLM provider list and creation |
| `src/components/configuration/AgentsTab.tsx` | `AgentsTab` | Agent tier list and creation |
| `src/components/configuration/LLMProviderForm.tsx` | `LLMProviderForm` | Type-specific provider creation form |
| `src/components/configuration/AgentForm.tsx` | `AgentForm` | Agent creation form with provider selection |
| `console-extensions.json` | — | Plugin extension declarations (routes, nav items) |
| `webpack.config.ts` | — | Module federation and build configuration |

## Key Entry Points

The plugin has no traditional `main` entry point. Webpack's `ConsoleRemotePlugin` generates entry points from `console-extensions.json`. The three exposed modules are:

1. `ProposalListPage` → `src/components/proposals/ProposalListPage.tsx`
2. `ProposalDetailPage` → `src/components/proposals/ProposalDetailPage.tsx`
3. `ConfigurationPage` → `src/components/configuration/ConfigurationPage.tsx`

## Naming Conventions

- Components: PascalCase `.tsx` files, one primary component per file, default export.
- CSS: co-located `.css` files alongside components. All classes prefixed `ols-plugin__`.
- Models: singular `proposal.ts` contains all CRD types (not split by CRD).
- Hooks: `use` prefix, one hook per file in `src/hooks/`.
- Dynamic components: each renderer in `src/components/proposals/dynamic/`, re-exported via `index.tsx`.
