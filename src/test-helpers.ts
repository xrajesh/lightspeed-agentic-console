import { ApprovalStage, LightspeedAgenticRunApproval, AgenticRunCondition } from './models/agenticrun';

export function cond(
  type: string,
  status: 'True' | 'False' | 'Unknown',
  reason?: string,
): AgenticRunCondition {
  return { type, status, reason };
}

export function makeApproval(stages: ApprovalStage[] = []): LightspeedAgenticRunApproval {
  return {
    apiVersion: 'agentic.openshift.io/v1alpha1',
    kind: 'AgenticRunApproval',
    metadata: { name: 'test', namespace: 'default' },
    spec: { stages },
  };
}

export function makeApprovalNoSpec(): LightspeedAgenticRunApproval {
  return {
    apiVersion: 'agentic.openshift.io/v1alpha1',
    kind: 'AgenticRunApproval',
    metadata: { name: 'test', namespace: 'default' },
  };
}
