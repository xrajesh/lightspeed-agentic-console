import { K8sModel } from '@openshift-console/dynamic-plugin-sdk';

export const LightspeedProposalModel: K8sModel = {
  apiGroup: 'ols.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'LightspeedProposal',
  plural: 'lightspeedproposals',
  abbr: 'LSP',
  namespaced: true,
  label: 'Lightspeed Proposal',
  labelPlural: 'Lightspeed Proposals',
};

export const LightspeedProposalGVK = {
  group: LightspeedProposalModel.apiGroup,
  kind: LightspeedProposalModel.kind,
  version: LightspeedProposalModel.apiVersion,
};

export type EscalationTrigger =
  | 'platform_bug'
  | 'remediation_failed'
  | 'workaround_applied'
  | 'recurring_issue'
  | 'manual';

export type ProposalPhase =
  | 'Pending'
  | 'Analyzing'
  | 'Proposed'
  | 'Approved'
  | 'Denied'
  | 'Executing'
  | 'AwaitingSync'
  | 'Verifying'
  | 'Validating'
  | 'Completed'
  | 'Failed'
  | 'Escalated';

export type StepPhase = 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Skipped';

export type SandboxInfo = {
  claimName?: string;
  namespace?: string;
  startedAt?: string;
  completedAt?: string;
};

export type ProposalCondition = {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
};

export type PreviousAttempt = {
  attempt: number;
  failedPhase?: string;
  failureReason?: string;
};

export type WorkflowOverride = {
  analysis?: { skip?: boolean; agent?: string };
  execution?: { skip?: boolean; agent?: string };
  verification?: { skip?: boolean; agent?: string };
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
  options?: RemediationOption[];
  selectedOption?: number;
  sandbox?: SandboxInfo;
  conditions?: ProposalCondition[];
  components?: AdapterComponent[];
};

export type ExecutionActionTaken = {
  type: string;
  description: string;
  resource?: { apiVersion: string; kind: string; name: string; namespace?: string };
  success: boolean;
  output?: string;
  error?: string;
};

export type ExecutionVerification = {
  conditionImproved: boolean;
  summary: string;
};

export type ExecutionStepStatus = {
  phase?: StepPhase;
  success?: boolean;
  actionsTaken?: ExecutionActionTaken[];
  verification?: ExecutionVerification;
  sandbox?: SandboxInfo;
  components?: AdapterComponent[];
};

export type VerificationCheck = {
  name: string;
  source: string;
  value: string;
  passed: boolean;
};

export type VerificationStepStatus = {
  phase?: StepPhase;
  success?: boolean;
  checks?: VerificationCheck[];
  summary?: string;
  sandbox?: SandboxInfo;
  components?: AdapterComponent[];
};

export type StepsStatus = {
  analysis?: AnalysisStepStatus;
  execution?: ExecutionStepStatus;
  verification?: VerificationStepStatus;
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
    workflow: string;
    targetNamespaces?: string[];
    workflowOverride?: WorkflowOverride;
    parentRef?: string;
    maxAttempts?: number;
  };
  status?: {
    phase?: ProposalPhase;
    attempt?: number;
    steps?: StepsStatus;
    conditions?: ProposalCondition[];
    previousAttempts?: PreviousAttempt[];
  };
};

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
    case 'Approved':
      return { color: 'blue', label: 'Approved' };
    case 'Executing':
      return { color: 'purple', label: 'Executing' };
    case 'Validating':
      return { color: 'orange', label: 'Validating' };
    case 'Completed':
      return { color: 'green', label: 'Completed' };
    case 'Failed':
      return { color: 'red', label: 'Failed' };
    case 'Denied':
      return { color: 'red', label: 'Denied' };
    case 'AwaitingSync':
      return { color: 'teal', label: 'Awaiting Sync' };
    case 'Escalated':
      return { color: 'orangered', label: 'Escalated' };
    default:
      return { color: 'grey', label: phase || 'Unknown' };
  }
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
