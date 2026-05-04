import { K8sModel } from '@openshift-console/dynamic-plugin-sdk';

export const LightspeedProposalModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'Proposal',
  plural: 'proposals',
  abbr: 'LSP',
  namespaced: true,
  label: 'Proposal',
  labelPlural: 'Proposals',
};

export const LightspeedProposalGVK = {
  group: LightspeedProposalModel.apiGroup,
  kind: LightspeedProposalModel.kind,
  version: LightspeedProposalModel.apiVersion,
};

export const LightspeedAgentModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'Agent',
  plural: 'agents',
  abbr: 'LSA',
  namespaced: false,
  label: 'Agent',
  labelPlural: 'Agents',
};

export const LightspeedProposalApprovalModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'ProposalApproval',
  plural: 'proposalapprovals',
  abbr: 'LSPA',
  namespaced: true,
  label: 'ProposalApproval',
  labelPlural: 'ProposalApprovals',
};

export const LightspeedProposalApprovalGVK = {
  group: LightspeedProposalApprovalModel.apiGroup,
  kind: LightspeedProposalApprovalModel.kind,
  version: LightspeedProposalApprovalModel.apiVersion,
};

export const AnalysisResultModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'AnalysisResult',
  plural: 'analysisresults',
  abbr: 'AR',
  namespaced: true,
  label: 'AnalysisResult',
  labelPlural: 'AnalysisResults',
};

export const AnalysisResultGVK = {
  group: AnalysisResultModel.apiGroup,
  kind: AnalysisResultModel.kind,
  version: AnalysisResultModel.apiVersion,
};

export const ExecutionResultModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'ExecutionResult',
  plural: 'executionresults',
  abbr: 'ER',
  namespaced: true,
  label: 'ExecutionResult',
  labelPlural: 'ExecutionResults',
};

export const ExecutionResultGVK = {
  group: ExecutionResultModel.apiGroup,
  kind: ExecutionResultModel.kind,
  version: ExecutionResultModel.apiVersion,
};

export const VerificationResultModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'VerificationResult',
  plural: 'verificationresults',
  abbr: 'VR',
  namespaced: true,
  label: 'VerificationResult',
  labelPlural: 'VerificationResults',
};

export const VerificationResultGVK = {
  group: VerificationResultModel.apiGroup,
  kind: VerificationResultModel.kind,
  version: VerificationResultModel.apiVersion,
};

export const EscalationResultModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'EscalationResult',
  plural: 'escalationresults',
  abbr: 'ESR',
  namespaced: true,
  label: 'EscalationResult',
  labelPlural: 'EscalationResults',
};

export const EscalationResultGVK = {
  group: EscalationResultModel.apiGroup,
  kind: EscalationResultModel.kind,
  version: EscalationResultModel.apiVersion,
};

// ProposalApproval types

export type ApprovalStageType = 'Analysis' | 'Execution' | 'Verification' | 'Escalation';

export type AnalysisApproval = {
  agent?: string;
};

export type ExecutionApproval = {
  agent?: string;
  option?: number;
};

export type VerificationApproval = {
  agent?: string;
};

export type EscalationApproval = {
  agent?: string;
};

export type ApprovalStage = {
  type: ApprovalStageType;
  denied?: boolean;
  analysis?: AnalysisApproval;
  execution?: ExecutionApproval;
  verification?: VerificationApproval;
  escalation?: EscalationApproval;
};

export type ApprovalStageStatus = {
  name: string;
  conditions?: ProposalCondition[];
};

export type ProposalApprovalSpec = {
  stages?: ApprovalStage[];
};

export type ProposalApprovalStatus = {
  stages?: ApprovalStageStatus[];
};

export type LightspeedProposalApproval = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    uid?: string;
    ownerReferences?: Array<{
      apiVersion: string;
      kind: string;
      name: string;
      uid: string;
    }>;
  };
  spec?: ProposalApprovalSpec;
  status?: ProposalApprovalStatus;
};

export type ProposalPhase =
  | 'Pending'
  | 'Analyzing'
  | 'Proposed'
  | 'Executing'
  | 'Verifying'
  | 'Escalating'
  | 'Completed'
  | 'Failed'
  | 'Denied'
  | 'Escalated';

export type StepPhase = 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Skipped';

export type SandboxInfo = {
  claimName?: string;
  namespace?: string;
};

export type ProposalCondition = {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
};

export type StepResultRef = {
  name: string;
  outcome: 'Succeeded' | 'Failed';
};

export type SkillsSource = {
  image: string;
  paths?: string[];
};

export type SecretMountSpec = {
  type: 'EnvVar' | 'FilePath';
  envVar?: { name: string };
  filePath?: { path: string };
};

export type SecretRequirement = {
  name: string;
  description?: string;
  mountAs: SecretMountSpec;
};

export type ToolsSpec = {
  skills?: SkillsSource[];
  requiredSecrets?: SecretRequirement[];
  outputSchema?: unknown;
};

export type ProposalStep = {
  agent?: string;
  tools?: ToolsSpec;
};

// Agent structured response types (used by step status and StructuredProposal component)

export type AgentDiagnosis = {
  summary: string;
  confidence: string;
  rootCause: string;
};

export type AgentAction = {
  type: string;
  description: string;
};

export type AgentProposal = {
  description: string;
  actions: AgentAction[];
  risk: string;
  reversible: boolean;
  estimatedImpact?: string;
};

export type VerificationStep = {
  name: string;
  command: string;
  expected: string;
  type: string;
};

export type AgentRollbackPlan = {
  description: string;
  command: string;
};

export type AgentVerification = {
  description: string;
  steps: VerificationStep[];
  rollbackPlan: AgentRollbackPlan | string;
};

export type PermissionRule = {
  namespace?: string;
  apiGroups: string[];
  resources: string[];
  resourceNames?: string[];
  verbs: string[];
  justification: string;
};

export type AgentRbac = {
  namespaceScoped: PermissionRule[];
  clusterScoped: PermissionRule[];
};

// RemediationOption bundles a single remediation approach with its own
// diagnosis, proposal, RBAC, and verification plan.
// AdapterComponent is an adapter-defined structured data entry.
// The operator passes these through; the console renders known types.
export type AdapterComponent = {
  type: string;
  [key: string]: unknown;
};

export type RemediationOption = {
  title: string;
  summary?: string;
  diagnosis: AgentDiagnosis;
  proposal: AgentProposal;
  verification?: AgentVerification;
  rbac?: AgentRbac;
  components?: AdapterComponent[];
};

// Step status types — typed fields on status.steps

export type AnalysisStepStatus = {
  phase?: StepPhase;
  selectedOption?: number;
  observedRevision?: number;
  sandbox?: SandboxInfo;
  conditions?: ProposalCondition[];
  results?: StepResultRef[];
};

export type ExecutionActionTaken = {
  type: string;
  description: string;
  resource?: { apiVersion: string; kind: string; name: string; namespace?: string };
  outcome?: 'Succeeded' | 'Failed';
  output?: string;
  error?: string;
};

export type ExecutionVerification = {
  conditionOutcome: 'Improved' | 'Unchanged' | 'Degraded';
  summary: string;
};

export type ExecutionStepStatus = {
  phase?: StepPhase;
  retryCount?: number;
  sandbox?: SandboxInfo;
  conditions?: ProposalCondition[];
  results?: StepResultRef[];
};

export type VerificationCheck = {
  name: string;
  source: string;
  value: string;
  result: 'Passed' | 'Failed';
};

export type VerificationStepStatus = {
  phase?: StepPhase;
  sandbox?: SandboxInfo;
  conditions?: ProposalCondition[];
  results?: StepResultRef[];
};

export type ProposalStatus = {
  attempts?: number;
  steps?: StepsStatus;
  conditions?: ProposalCondition[];
};

export type EscalationStepStatus = {
  sandbox?: SandboxInfo;
  conditions?: ProposalCondition[];
  results?: StepResultRef[];
};

export type StepsStatus = {
  analysis?: AnalysisStepStatus;
  execution?: ExecutionStepStatus;
  verification?: VerificationStepStatus;
  escalation?: EscalationStepStatus;
};

// Main CRD type

export type LightspeedProposal = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    uid?: string;
  };
  spec: {
    request: string;
    targetNamespaces?: string[];
    tools?: ToolsSpec;
    analysis?: ProposalStep;
    execution?: ProposalStep;
    verification?: ProposalStep;
    maxAttempts?: number;
    revision?: number;
    revisionFeedback?: string;
  };
  status?: ProposalStatus;
};

// Result CR types — separate CRDs that hold step output data

export type ResultCondition = {
  type: 'Started' | 'Completed';
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime: string;
  reason?: string;
  message?: string;
};

export type ResultStatus = {
  conditions?: ResultCondition[];
};

export type AnalysisResultCR = {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  proposalName: string;
  attempt: number;
  options?: RemediationOption[];
  components?: AdapterComponent[];
  sandbox?: SandboxInfo;
  failureReason?: string;
  status?: ResultStatus;
};

export type ExecutionResultCR = {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  proposalName: string;
  attempt: number;
  retryIndex: number;
  actionsTaken?: ExecutionActionTaken[];
  verification?: ExecutionVerification;
  components?: AdapterComponent[];
  sandbox?: SandboxInfo;
  failureReason?: string;
  status?: ResultStatus;
};

export type VerificationResultCR = {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  proposalName: string;
  attempt: number;
  retryIndex: number;
  checks?: VerificationCheck[];
  summary?: string;
  components?: AdapterComponent[];
  sandbox?: SandboxInfo;
  failureReason?: string;
  status?: ResultStatus;
};

export type EscalationResultCR = {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  proposalName: string;
  attempt: number;
  summary?: string;
  content?: string;
  sandbox?: SandboxInfo;
  failureReason?: string;
  status?: ResultStatus;
};

type AnyResultCR = AnalysisResultCR | ExecutionResultCR | VerificationResultCR | EscalationResultCR;

export function resultOutcome(cr: AnyResultCR | undefined): 'Succeeded' | 'Failed' | undefined {
  const reason = cr?.status?.conditions?.find((c) => c.type === 'Completed')?.reason;
  if (reason === 'Succeeded' || reason === 'Failed') {
    return reason;
  }
  return undefined;
}

// Display helpers

export type PhaseDisplay = {
  color: 'grey' | 'blue' | 'teal' | 'orange' | 'purple' | 'green' | 'red' | 'orangered';
  label: string;
};

export const getPhaseDisplay = (phase?: ProposalPhase | string): PhaseDisplay => {
  switch (phase) {
    case 'Pending':
      return { color: 'grey', label: 'Pending' };
    case 'Analyzing':
      return { color: 'blue', label: 'Analyzing' };
    case 'Proposed':
      return { color: 'teal', label: 'Proposed' };
    case 'Executing':
      return { color: 'purple', label: 'Executing' };
    case 'Verifying':
      return { color: 'orange', label: 'Verifying' };
    case 'Escalating':
      return { color: 'orange', label: 'Escalating' };
    case 'Completed':
      return { color: 'green', label: 'Completed' };
    case 'Failed':
      return { color: 'red', label: 'Failed' };
    case 'Denied':
      return { color: 'red', label: 'Denied' };
    case 'Escalated':
      return { color: 'orangered', label: 'Escalated' };
    default:
      return { color: 'grey', label: phase || 'Unknown' };
  }
};

// SYNC: must match DerivePhase in lightspeed-agentic-operator/api/v1alpha1/proposal_types.go
export const derivePhaseFromConditions = (
  conditions?: ProposalCondition[],
): ProposalPhase => {
  if (!conditions?.length) return 'Pending';

  const get = (type: string) => conditions.find((c) => c.type === type);

  const escalated = get('Escalated');
  if (escalated?.status === 'True') return 'Escalated';

  const denied = get('Denied');
  if (denied?.status === 'True') return 'Denied';

  if (escalated) {
    if (escalated.status === 'Unknown') return 'Escalating';
    return 'Failed';
  }

  const verified = get('Verified');
  if (verified) {
    if (verified.status === 'True') return 'Completed';
    if (verified.status === 'Unknown') return 'Verifying';
    switch (verified.reason) {
      case 'RetryingExecution':
        return 'Executing';
      default:
        return 'Failed';
    }
  }

  const executed = get('Executed');
  if (executed) {
    if (executed.status === 'True') return 'Verifying';
    if (executed.status === 'Unknown') return 'Executing';
    return 'Failed';
  }

  const analyzed = get('Analyzed');
  if (analyzed) {
    if (analyzed.status === 'True') return 'Proposed';
    if (analyzed.status === 'Unknown') return 'Analyzing';
    return 'Failed';
  }

  return 'Pending';
};

export const getRiskColor = (risk?: string): 'green' | 'orange' | 'red' | 'grey' => {
  switch (risk) {
    case 'low':
      return 'green';
    case 'medium':
      return 'orange';
    case 'high':
    case 'critical':
      return 'red';
    default:
      return 'grey';
  }
};
