import * as React from 'react';
import { k8sPatch, useAccessReview } from '@openshift-console/dynamic-plugin-sdk';

import {
  ApprovalStageType,
  derivePhaseFromConditions,
  LightspeedProposal,
  LightspeedProposalApproval,
  LightspeedProposalApprovalModel,
  ProposalCondition,
  ProposalPhase,
} from '../models/proposal';
import { buildApprovalPatch, getStageStatus, stageNeedsApproval } from '../utils/approval';

export type StageApprovalResult = {
  needsApproval: boolean;
  stageStatus: 'approved' | 'denied' | 'pending';
  approve: (options?: { maxAttempts?: number; option?: number; agent?: string }) => Promise<void>;
  deny: () => Promise<void>;
  inProgress: boolean;
  error: string | null;
  clearError: () => void;
  canApprove: boolean;
  canApproveLoading: boolean;
};

export function useStageApproval(
  proposal: LightspeedProposal | undefined,
  approval: LightspeedProposalApproval | undefined,
  stageType: ApprovalStageType,
  phase?: ProposalPhase,
): StageApprovalResult {
  const [inProgress, setInProgress] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [canApprove, canApproveLoading] = useAccessReview({
    group: 'agentic.openshift.io',
    resource: 'proposalapprovals',
    verb: 'patch',
    namespace: approval?.metadata?.namespace ?? proposal?.metadata?.namespace,
  });

  const effectivePhase =
    phase ?? derivePhaseFromConditions(proposal?.status?.conditions as ProposalCondition[]);
  const needs = stageNeedsApproval(approval, stageType, proposal?.status?.conditions, effectivePhase);
  const status = getStageStatus(approval, stageType);

  const approve = React.useCallback(
    async (options?: { maxAttempts?: number; option?: number; agent?: string }) => {
      if (!proposal || !approval || !canApprove) return;
      setInProgress(true);
      setError(null);
      try {
        const patches = buildApprovalPatch(approval, stageType, false, options);
        await k8sPatch({
          data: patches,
          model: LightspeedProposalApprovalModel,
          resource: approval,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve stage');
      } finally {
        setInProgress(false);
      }
    },
    [proposal, approval, stageType, canApprove],
  );

  const deny = React.useCallback(async () => {
    if (!approval || !canApprove) return;
    setInProgress(true);
    setError(null);
    try {
      const patches = buildApprovalPatch(approval, stageType, true);
      await k8sPatch({
        data: patches,
        model: LightspeedProposalApprovalModel,
        resource: approval,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deny stage');
    } finally {
      setInProgress(false);
    }
  }, [approval, stageType, canApprove]);

  const clearError = React.useCallback(() => setError(null), []);

  return { needsApproval: needs, stageStatus: status, approve, deny, inProgress, error, clearError, canApprove, canApproveLoading };
}
