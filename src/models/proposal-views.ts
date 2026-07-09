import { ProposalPhase } from './proposal';

export type { ProposalPhase } from './proposal';

export const TERMINAL_PHASES: ProposalPhase[] = [
  'Completed',
  'Failed',
  'Denied',
  'EmergencyStopped',
  'Escalated',
];

export interface RootCauseView {
  cause: string;
  detail: string;
  confidence?: string;
}

export interface VerificationStepView {
  name: string;
  command?: string;
  expected?: string;
  type?: string;
}

export interface RemediationOptionView {
  index: number;
  title: string;
  description: string;
  reversibility?: string;
  risk?: string;
  estimatedImpact?: string;
  actions?: { type: string; description: string }[];
  rollbackDescription?: string;
  rollbackCommand?: string;
  verificationDescription?: string;
  verificationSteps?: VerificationStepView[];
}

export interface TimelineEvent {
  label: string;
  description?: string;
  timestamp?: string;
  variant: 'success' | 'info' | 'pending' | 'warning' | 'danger' | 'default';
  isCurrent?: boolean;
}

export interface ExecutionActionView {
  type: string;
  description: string;
  outcome: string;
  output?: string;
  error?: string;
}

export interface SandboxView {
  podName: string;
  namespace: string;
}

export interface VerificationCheckView {
  name: string;
  result: string;
  source: string;
  value: string;
}

export interface VerificationView {
  summary?: string;
  checks: VerificationCheckView[];
  failureReason?: string;
  verificationSandbox?: SandboxView;
  verificationStartedAt?: string;
}

export interface ExecutionView {
  originalRootCause: string;
  remediationDelta: string;
  outcome: string;
  actions: ExecutionActionView[];
  executionSandbox?: SandboxView;
  executionStartedAt?: string;
}

export interface ProposalView {
  phase: ProposalPhase;
  request: string;
  source?: string;
  advisory?: boolean;
  targetNamespaces?: string[];
  failureReason?: string;
  rootCause?: RootCauseView;
  analysisCreatedAt?: string;
  analysisStartedAt?: string;
  analysisSandbox?: SandboxView;
  executionStartedAt?: string;
  executionSandbox?: SandboxView;
  verificationStartedAt?: string;
  verificationSandbox?: SandboxView;
  executedOptionIndex?: number;
  options: RemediationOptionView[];
  execution?: ExecutionView;
  verification?: VerificationView;
  timeline: TimelineEvent[];
}
