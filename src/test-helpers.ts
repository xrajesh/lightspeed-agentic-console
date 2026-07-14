import {
  AgenticRunCondition,
  ApprovalStage,
  LightspeedAgenticRunApproval,
} from './models/agenticrun';

export const cond = (
  type: string,
  status: 'True' | 'False' | 'Unknown',
  reason?: string,
): AgenticRunCondition => ({ type, status, reason });

export const makeApproval = (stages: ApprovalStage[] = []): LightspeedAgenticRunApproval => ({
  apiVersion: 'agentic.openshift.io/v1alpha1',
  kind: 'AgenticRunApproval',
  metadata: { name: 'test', namespace: 'default' },
  spec: { stages },
});

export const makeApprovalNoSpec = (): LightspeedAgenticRunApproval => ({
  apiVersion: 'agentic.openshift.io/v1alpha1',
  kind: 'AgenticRunApproval',
  metadata: { name: 'test', namespace: 'default' },
});
