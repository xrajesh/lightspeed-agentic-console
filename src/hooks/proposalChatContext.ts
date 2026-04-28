import type { LightspeedProposal } from '../models/proposal';
import type { ChatConfig } from './useChat';

export function buildProposalChatConfig(proposal: LightspeedProposal): ChatConfig {
  const context: Record<string, unknown> = {
    remediation: {
      name: proposal.metadata.name,
      namespace: proposal.metadata.namespace,
      workflow: proposal.spec.workflow,
      request: proposal.spec.request,
    },
  };

  const analysis = proposal.status?.steps?.analysis;
  if (analysis?.options?.length) {
    context.options = analysis.options;
    if (analysis.selectedOption !== undefined) {
      context.selectedOption = analysis.selectedOption;
    }
  }

  const execution = proposal.status?.steps?.execution;
  if (execution?.actionsTaken) {
    context.execution = {
      success: execution.success,
      actionsTaken: execution.actionsTaken,
      verification: execution.verification,
      verificationPassed: proposal.status?.phase === 'Completed',
    };
  }

  if (proposal.status?.phase) {
    context.phase = proposal.status.phase;
  }

  if (proposal.status?.previousAttempts?.length) {
    context.previousAttempts = proposal.status.previousAttempts;
  }

  if (proposal.status?.attempt !== undefined) {
    context.attempt = proposal.status.attempt;
  }

  if (proposal.status?.conditions?.length) {
    context.conditions = proposal.status.conditions.map((c) => ({
      type: c.type,
      status: c.status,
      reason: c.reason,
      message: c.message,
    }));
  }

  if (proposal.spec.targetNamespaces?.length) {
    context.targetNamespaces = proposal.spec.targetNamespaces;
  }

  if (proposal.spec.parentRef) {
    context.parentRef = proposal.spec.parentRef;
  }

  const sandbox = analysis?.sandbox;
  return {
    sandboxPod: sandbox?.claimName,
    sandboxNamespace: sandbox?.namespace || 'openshift-lightspeed',
    context,
  };
}
