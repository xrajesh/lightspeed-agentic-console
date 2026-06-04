# Configuration

The Configuration page (`/lightspeed/configuration`) provides cluster-wide settings for the agentic system, accessible via a gear icon on the proposal list page.

## Behavioral Rules

### Navigation

1. The Configuration page MUST be reachable from the proposal list page via a gear icon button.
2. A breadcrumb MUST link back to the AI Hub (proposal list).

### Approval Policy Tab

3. The ApprovalPolicy CR is cluster-scoped with a singleton name `cluster`.
4. Each of the four stages (Analysis, Execution, Verification, Escalation) can be set to `Manual` or `Automatic` via toggle groups.
5. Max retry attempts are configurable between 1 and 3 via a number input.
6. If the ApprovalPolicy CR does not exist, saving creates it with `maxConcurrentProposals: 5` as the default.
7. If the CR exists, saving patches `spec.stages` and `spec.maxAttempts` via replace operations.

### LLM Providers Tab

8. LLMProvider CRs are cluster-scoped.
9. The tab lists all providers in a compact table showing name, type, and age.
10. Supported provider types: Anthropic, GoogleCloudVertex, OpenAI, AzureOpenAI, AWSBedrock.
11. Creating a provider requires a name, type selection, and type-specific configuration fields (credentials secret, region, endpoint, etc.).
12. Providers can be deleted via a kebab menu action.

### Agents Tab

13. Agent CRs are cluster-scoped.
14. The tab lists all agents showing name, LLM provider, model, max turns, and age.
15. Creating an agent requires a name, LLM provider selection (from existing providers), model name, and optional max turns and timeout values.
16. Agents can be deleted via a kebab menu action.

## Constraints

- All configuration CRDs use the same `agentic.openshift.io/v1alpha1` API group/version as proposals.
- The ApprovalPolicy singleton pattern means only one policy governs the entire cluster.
