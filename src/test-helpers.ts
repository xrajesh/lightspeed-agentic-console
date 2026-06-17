import { ApprovalStage, LightspeedProposalApproval, ProposalCondition } from './models/proposal';

export function cond(type: string, status: string, reason?: string): ProposalCondition {
  return { type, status, reason };
}

export function makeApproval(stages: ApprovalStage[] = []): LightspeedProposalApproval {
  return {
    apiVersion: 'agentic.openshift.io/v1alpha1',
    kind: 'ProposalApproval',
    metadata: { name: 'test', namespace: 'default' },
    spec: { stages },
  };
}

export function makeApprovalNoSpec(): LightspeedProposalApproval {
  return {
    apiVersion: 'agentic.openshift.io/v1alpha1',
    kind: 'ProposalApproval',
    metadata: { name: 'test', namespace: 'default' },
  };
}
