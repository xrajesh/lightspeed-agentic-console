# Architecture

The OpenShift Lightspeed Agentic Console Plugin is a React-based dynamic plugin that extends the OpenShift Console with a UI for managing AI-driven cluster operation proposals.

## System Context

The plugin runs inside the OpenShift Console via webpack module federation. It does not have its own backend — it communicates directly with the Kubernetes API (for CRD operations) and proxies requests to the Lightspeed service through the console's plugin proxy mechanism.

```mermaid
graph TB
    User[Cluster Administrator]
    Console[OpenShift Console]
    Plugin[Agentic Console Plugin]
    K8sAPI[Kubernetes API Server]
    Operator[Lightspeed Agentic Operator]
    Sandbox[Agentic Sandbox Pods]
    LLM[LLM Providers]

    User --> Console
    Console --> Plugin
    Plugin -->|Watch CRDs, Patch Approvals| K8sAPI
    Plugin -->|Stream Pod Logs| K8sAPI
    K8sAPI --> Operator
    Operator -->|Creates/Manages| Sandbox
    Sandbox -->|Calls| LLM
    Operator -->|Reconciles| K8sAPI
```

## Proposal Workflow

A proposal moves through a multi-stage lifecycle. The plugin renders each stage and gates progression on human approval decisions.

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Analyzing: Analysis approved
    Analyzing --> Proposed: Analysis complete
    Proposed --> Executing: Execution approved
    Executing --> Verifying: Execution complete
    Verifying --> Completed: Verification passed
    Verifying --> Executing: Verification failed (retry)
    Verifying --> Escalating: User escalates
    Escalating --> Escalated: Escalation complete
    Analyzing --> Failed: Analysis failed
    Executing --> Failed: Execution failed
    Proposed --> Denied: User denies
    Pending --> Denied: User denies
```

## CRD Relationships

The plugin operates on a set of CRDs in the `agentic.openshift.io/v1alpha1` API group. Each proposal has a companion ProposalApproval CR and is linked to Result CRs by label selectors.

```mermaid
erDiagram
    Proposal ||--|| ProposalApproval : "same name/namespace"
    Proposal ||--o{ AnalysisResult : "label selector"
    Proposal ||--o{ ExecutionResult : "label selector"
    Proposal ||--o{ VerificationResult : "label selector"
    Proposal ||--o{ EscalationResult : "label selector"
    ApprovalPolicy ||--|| Cluster : "singleton 'cluster'"
    Agent }o--|| LLMProvider : "references by name"
```

## Plugin Architecture

The plugin is structured around three exposed modules, each a top-level page component. Shared logic lives in models, hooks, and utility modules.

```mermaid
graph LR
    subgraph "Exposed Modules"
        PLP[ProposalListPage]
        PDP[ProposalDetailPage]
        CP[ConfigurationPage]
    end

    subgraph "Shared"
        Models[models/proposal.ts<br/>Types + Phase Logic]
        Hooks[hooks/useStageApproval<br/>Approval State]
        Utils[utils/approval.ts<br/>Patch Generation]
    end

    subgraph "Detail Tabs"
        OT[OverviewTab]
        PT[ProposalTab]
        RT[ResultTab]
        VT[VerificationTab]
        ET[EscalationTab]
    end

    subgraph "Dynamic Components"
        DC[DynamicComponent Registry]
        VIZ[Visualization]
        RD[ResourceDiff]
        CMO[CMO Components]
    end

    PDP --> OT & PT & RT & VT & ET
    PT --> DC
    PDP --> Hooks
    Hooks --> Utils
    Hooks --> Models
    PLP --> Models
    CP --> Models
```

## Key Architectural Decisions

**Hand-written CRD types** — Types in `models/proposal.ts` are manually maintained rather than auto-generated from the CRD OpenAPI schema. This was a pragmatic choice for early development velocity but creates a synchronization burden with the operator. A TODO exists to migrate to auto-generation.

**Phase derived from conditions** — The proposal phase is not stored as a field; it's derived from `status.conditions[]` using the same algorithm as the operator. This ensures the console and operator always agree on phase, but the derivation function (`derivePhaseFromConditions`) must be kept in sync.

**Result CRs as separate resources** — Step outputs (analysis options, execution actions, verification checks) live in their own CRDs rather than inline on the Proposal status. This keeps the Proposal CR lightweight and allows independent lifecycle management. The plugin discovers them via label selectors and correlates via `status.steps.<stage>.results[]` references.

**Dynamic component registry** — Adapter-defined UI components use a type-dispatch pattern rather than a plugin-within-a-plugin system. The set of known types is hardcoded; adding a new component type requires code changes in the console plugin.
