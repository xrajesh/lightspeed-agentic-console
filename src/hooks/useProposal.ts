import { useMemo, useCallback, useState } from 'react';
import {
  HttpError,
  K8sResourceCommon,
  k8sPatch,
  useAccessReview,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  AnalysisResultGVK,
  AnalysisResultK8s,
  ExecutionResultGVK,
  ExecutionResultK8s,
  LightspeedProposalApprovalGVK,
  LightspeedProposalApprovalModel,
  LightspeedProposalGVK,
  ProposalApprovalK8s,
  ProposalK8s,
  ProposalPhase,
  RemediationOption,
  ResultCondition,
  StepResultRef,
  VerificationResultGVK,
  VerificationResultK8s,
  derivePhaseFromConditions,
} from '../models/proposal';
import { buildApprovalPatch } from '../utils/approval';
import {
  ProposalView,
  RootCauseView,
  RemediationOptionView,
  ExecutionView,
  VerificationView,
  TimelineEvent,
  SandboxView,
} from '../models/proposal-views';
import { PROPOSAL_LABEL_SOURCE, PROPOSAL_NAMESPACE, RESULT_LABEL_PROPOSAL } from '../constants';

// Assumes the operator names the sandbox pod identically to the SandboxClaim CR.
// If the operator decouples these names, log streaming will need the actual pod name from the API.
const mapSandbox = (s?: { claimName?: string; namespace?: string }): SandboxView | undefined =>
  s?.claimName ? { podName: s.claimName, namespace: s.namespace || PROPOSAL_NAMESPACE } : undefined;

export const mapRootCause = (
  options: RemediationOption[] | undefined,
): RootCauseView | undefined => {
  const diagnosis = options?.[0]?.diagnosis;
  if (!diagnosis) return undefined;

  return {
    cause: diagnosis.rootCause,
    detail: diagnosis.summary,
    confidence: diagnosis.confidence,
  };
};

export const mapOption = (opt: RemediationOption, index: number): RemediationOptionView => {
  const rollback = opt.proposal?.rollbackPlan;
  return {
    index,
    title: opt.title,
    description: opt.proposal?.description ?? opt.summary ?? '',
    reversibility: opt.proposal?.reversible,
    risk: opt.proposal?.risk,
    estimatedImpact: opt.proposal?.estimatedImpact,
    actions: opt.proposal?.actions,
    rollbackDescription: rollback?.description,
    rollbackCommand: rollback?.command,
    verificationDescription: opt.verification?.description,
    verificationSteps: opt.verification?.steps,
  };
};

export const mapExecution = (
  options: RemediationOption[] | undefined,
  execution: ExecutionResultK8s | undefined,
  executionSandbox?: { claimName?: string; namespace?: string },
): ExecutionView | undefined => {
  if (!execution) return undefined;

  const actions = execution.status?.actionsTaken ?? [];
  const rootCause = options?.[0]?.diagnosis?.rootCause ?? '';
  const remediationDelta = actions.map((a) => a.description).join('; ');

  const completedCond = (execution.status?.conditions ?? []).find((c) => c.type === 'Completed');
  const conditionOutcome = execution.status?.verification?.conditionOutcome;

  let outcome: string;
  if (completedCond?.reason === 'Succeeded') {
    outcome = conditionOutcome ?? 'Succeeded';
  } else if (completedCond?.reason === 'Failed') {
    outcome = 'Failed';
  } else {
    outcome = 'Unknown';
  }

  return {
    originalRootCause: rootCause,
    remediationDelta,
    outcome,
    actions: actions.map((a) => ({
      type: a.type,
      description: a.description,
      outcome: a.outcome,
      output: a.output,
      error: a.error,
    })),
    executionSandbox: mapSandbox(executionSandbox),
    executionStartedAt: (execution.status?.conditions ?? []).find((c) => c.type === 'Started')
      ?.lastTransitionTime,
  };
};

export const mapVerification = (
  verificationResult: VerificationResultK8s | undefined,
  verificationSandbox?: { claimName?: string; namespace?: string },
): VerificationView | undefined => {
  if (!verificationResult) return undefined;

  return {
    summary: verificationResult.status?.summary,
    checks: (verificationResult.status?.checks ?? []).map((c) => ({
      name: c.name,
      result: c.result,
      source: c.source,
      value: c.value,
    })),
    failureReason: verificationResult.status?.failureReason,
    verificationSandbox: mapSandbox(verificationSandbox),
    verificationStartedAt: (verificationResult.status?.conditions ?? []).find(
      (c) => c.type === 'Started',
    )?.lastTransitionTime,
  };
};

const condVariant = (reason?: string): TimelineEvent['variant'] => {
  if (reason === 'Succeeded' || reason === 'Complete') return 'success';
  if (reason === 'Failed') return 'danger';
  if (reason === 'StepStarted') return 'info';
  return 'default';
};

export const mapTimeline = (
  proposal: ProposalK8s,
  phase: ProposalPhase,
  analysis?: AnalysisResultK8s,
  execution?: ExecutionResultK8s,
  verification?: VerificationResultK8s,
  approval?: ProposalApprovalK8s,
): TimelineEvent[] => {
  const events: TimelineEvent[] = [];

  if (proposal.metadata?.creationTimestamp) {
    events.push({
      label: 'Proposal created',
      timestamp: proposal.metadata.creationTimestamp,
      variant: 'success',
    });
  }

  const conditionSources: {
    conditions: ResultCondition[] | undefined;
    label: string;
    currentPhase: ProposalPhase;
    failureReason?: string;
  }[] = [
    { conditions: analysis?.status?.conditions, label: 'Analysis', currentPhase: 'Analyzing' },
    {
      conditions: execution?.status?.conditions,
      label: 'Execution',
      currentPhase: 'Executing',
      failureReason: execution?.status?.failureReason,
    },
    {
      conditions: verification?.status?.conditions,
      label: 'Verification',
      currentPhase: 'Verifying',
      failureReason: verification?.status?.failureReason,
    },
  ];

  for (const { conditions, label, currentPhase, failureReason } of conditionSources) {
    for (const cond of conditions ?? []) {
      if (cond.type === 'Completed' && cond.status !== 'True') continue;
      events.push({
        label: `${label} ${cond.type === 'Started' ? 'started' : cond.type === 'Completed' ? 'completed' : cond.type.toLowerCase()}`,
        description: cond.message || failureReason || undefined,
        timestamp: cond.lastTransitionTime,
        variant: condVariant(cond.reason),
        isCurrent: phase === currentPhase && cond.type === 'Started',
      });
    }
  }

  const execStage = (approval?.spec?.stages ?? []).find((s) => s.type === 'Execution');
  const execStartedCond = (execution?.status?.conditions ?? []).find((c) => c.type === 'Started');
  const approvalTimestamp =
    approval?.spec?.approver?.approvedAt ?? execStartedCond?.lastTransitionTime;
  if (execStage?.decision === 'Denied') {
    events.push({
      label: 'Execution denied',
      timestamp: approvalTimestamp,
      variant: 'danger',
    });
  } else if (execStage && execStartedCond) {
    events.push({
      label: 'Execution approved',
      description:
        execStage.execution?.option !== undefined
          ? `Option ${(execStage.execution.option ?? 0) + 1}`
          : undefined,
      timestamp: approvalTimestamp,
      variant: 'success',
    });
  }

  for (const cond of proposal.status?.conditions ?? []) {
    if (cond.type === 'Denied' && cond.status === 'True') {
      events.push({
        label: 'Proposal denied',
        description: cond.message || undefined,
        timestamp: cond.lastTransitionTime,
        variant: 'danger',
      });
    }
    if (cond.type === 'EmergencyStopped' && cond.status === 'True') {
      events.push({
        label: 'Emergency stopped',
        description: cond.message || undefined,
        timestamp: cond.lastTransitionTime,
        variant: 'danger',
      });
    }
  }

  events.sort((a, b) => {
    const tsA = a.timestamp ?? '';
    const tsB = b.timestamp ?? '';
    if (!tsA && tsB) return 1;
    if (tsA && !tsB) return -1;
    return tsA.localeCompare(tsB);
  });
  return events;
};

export const filterLatest = <T extends K8sResourceCommon>(
  results: T[] | undefined,
  refs?: StepResultRef[],
): T | undefined => {
  if (!results || results.length === 0) return undefined;
  if (results.length === 1) return results[0];

  if (refs?.length) {
    const latestRef = refs[refs.length - 1];
    const match = results.find((r) => r.metadata?.name === latestRef.name);
    if (match) return match;
  }

  return results.reduce((latest, item) => {
    const latestTs = latest.metadata?.creationTimestamp ?? '';
    const itemTs = item.metadata?.creationTimestamp ?? '';
    return itemTs > latestTs ? item : latest;
  });
};

const mapToProposalView = (
  proposal: ProposalK8s | undefined,
  analysis: AnalysisResultK8s | undefined,
  execution: ExecutionResultK8s | undefined,
  verification: VerificationResultK8s | undefined,
  approval: ProposalApprovalK8s | undefined,
): ProposalView | undefined => {
  if (!proposal?.metadata?.name) return undefined;

  const phase = derivePhaseFromConditions(proposal.status?.conditions);
  const options = analysis?.status?.options;
  const failureReason =
    analysis?.status?.failureReason ??
    execution?.status?.failureReason ??
    verification?.status?.failureReason;

  return {
    phase,
    request: proposal.spec?.request ?? '',
    source: proposal.metadata?.labels?.[PROPOSAL_LABEL_SOURCE],
    advisory: !proposal.spec?.execution,
    targetNamespaces: proposal.spec?.targetNamespaces,
    failureReason,
    rootCause: mapRootCause(options),
    analysisCreatedAt: analysis?.metadata?.creationTimestamp,
    analysisStartedAt: (analysis?.status?.conditions ?? []).find((c) => c.type === 'Started')
      ?.lastTransitionTime,
    analysisSandbox: mapSandbox(proposal.status?.steps?.analysis?.sandbox),
    executionStartedAt: (execution?.status?.conditions ?? []).find((c) => c.type === 'Started')
      ?.lastTransitionTime,
    executionSandbox: mapSandbox(proposal.status?.steps?.execution?.sandbox),
    verificationStartedAt: (verification?.status?.conditions ?? []).find(
      (c) => c.type === 'Started',
    )?.lastTransitionTime,
    verificationSandbox: mapSandbox(proposal.status?.steps?.verification?.sandbox),
    executedOptionIndex: (approval?.spec?.stages ?? []).find((s) => s.type === 'Execution')
      ?.execution?.option,
    options: (options ?? []).map((opt, i) => mapOption(opt, i)),
    execution: mapExecution(options, execution, proposal.status?.steps?.execution?.sandbox),
    verification: mapVerification(verification, proposal.status?.steps?.verification?.sandbox),
    timeline: mapTimeline(proposal, phase, analysis, execution, verification, approval),
  };
};

export interface UseProposalReturn {
  proposal: K8sResourceCommon | undefined;
  view: ProposalView | undefined;
  proposalLoaded: boolean;
  proposalError: Error | undefined;
  resultsLoaded: boolean;
  resultsError: Error | undefined;
  canApprove: boolean;
  canApproveLoading: boolean;
  approveExecution: (selectedOption: number) => Promise<boolean>;
  denyExecution: () => Promise<boolean>;
  mutationInProgress: boolean;
  mutationError: string | undefined;
  clearMutationError: () => void;
}

export const useProposal = (
  name: string,
  namespace: string = PROPOSAL_NAMESPACE,
): UseProposalReturn => {
  const watchEnabled = !!name;

  const [proposal, proposalLoaded, proposalError] = useK8sWatchResource<ProposalK8s>(
    watchEnabled ? { groupVersionKind: LightspeedProposalGVK, name, namespace } : null,
  );

  const [analysisResults, analysisLoaded, analysisError] = useK8sWatchResource<AnalysisResultK8s[]>(
    watchEnabled
      ? {
          groupVersionKind: AnalysisResultGVK,
          namespace,
          isList: true,
          selector: { matchLabels: { [RESULT_LABEL_PROPOSAL]: name } },
        }
      : null,
  );

  const [executionResults, executionLoaded, executionError] = useK8sWatchResource<
    ExecutionResultK8s[]
  >(
    watchEnabled
      ? {
          groupVersionKind: ExecutionResultGVK,
          namespace,
          isList: true,
          selector: { matchLabels: { [RESULT_LABEL_PROPOSAL]: name } },
        }
      : null,
  );

  const [verificationResults, verificationLoaded, verificationError] = useK8sWatchResource<
    VerificationResultK8s[]
  >(
    watchEnabled
      ? {
          groupVersionKind: VerificationResultGVK,
          namespace,
          isList: true,
          selector: { matchLabels: { [RESULT_LABEL_PROPOSAL]: name } },
        }
      : null,
  );

  const [approval, approvalLoaded, approvalError] = useK8sWatchResource<ProposalApprovalK8s>(
    watchEnabled
      ? {
          groupVersionKind: LightspeedProposalApprovalGVK,
          name,
          namespace,
        }
      : null,
  );

  const analysisRefs = proposal?.status?.steps?.analysis?.results;
  const executionRefs = proposal?.status?.steps?.execution?.results;
  const verificationRefs = proposal?.status?.steps?.verification?.results;

  const analysis = useMemo(
    () => filterLatest(analysisResults, analysisRefs),
    [analysisResults, analysisRefs],
  );
  const execution = useMemo(
    () => filterLatest(executionResults, executionRefs),
    [executionResults, executionRefs],
  );
  const verification = useMemo(
    () => filterLatest(verificationResults, verificationRefs),
    [verificationResults, verificationRefs],
  );

  const view = useMemo(
    () => mapToProposalView(proposal, analysis, execution, verification, approval),
    [proposal, analysis, execution, verification, approval],
  );

  const resultsLoaded = analysisLoaded && executionLoaded && verificationLoaded && approvalLoaded;
  const approvalNotFound = approvalError instanceof HttpError && approvalError.code === 404;
  const resultsError =
    analysisError ??
    executionError ??
    verificationError ??
    (approvalNotFound ? undefined : approvalError);

  const [canApprove, canApproveLoading] = useAccessReview({
    group: 'agentic.openshift.io',
    resource: 'proposalapprovals',
    verb: 'patch',
    namespace: approval?.metadata?.namespace ?? namespace,
  });

  const [mutationInProgress, setMutationInProgress] = useState(false);
  const [mutationError, setMutationError] = useState<string>();
  const clearMutationError = useCallback(() => setMutationError(undefined), []);

  const approveExecution = useCallback(
    async (selectedOption: number): Promise<boolean> => {
      if (!canApprove) return false;
      if (!proposal || !approval) {
        setMutationError('Approval resource is not available yet');
        return false;
      }
      setMutationInProgress(true);
      setMutationError(undefined);
      try {
        await k8sPatch({
          model: LightspeedProposalApprovalModel,
          resource: {
            metadata: {
              name: proposal.metadata?.name,
              namespace,
            },
          },
          data: buildApprovalPatch(approval, 'Execution', false, {
            option: selectedOption,
            maxAttempts: 1,
          }),
        });
        return true;
      } catch (err) {
        setMutationError((err as Error)?.message || 'Failed to approve execution');
        return false;
      } finally {
        setMutationInProgress(false);
      }
    },
    [proposal, approval, namespace, canApprove],
  );

  const denyExecution = useCallback(async (): Promise<boolean> => {
    if (!canApprove) return false;
    if (!proposal || !approval) {
      setMutationError('Approval resource is not available yet');
      return false;
    }
    setMutationInProgress(true);
    setMutationError(undefined);
    try {
      await k8sPatch({
        model: LightspeedProposalApprovalModel,
        resource: {
          metadata: {
            name: proposal.metadata?.name,
            namespace,
          },
        },
        data: buildApprovalPatch(approval, 'Execution', true),
      });
      return true;
    } catch (err) {
      setMutationError((err as Error)?.message || 'Failed to deny execution');
      return false;
    } finally {
      setMutationInProgress(false);
    }
  }, [proposal, approval, namespace, canApprove]);

  return {
    proposal: proposal as K8sResourceCommon | undefined,
    view,
    proposalLoaded,
    proposalError: proposalError as Error | undefined,
    resultsLoaded,
    resultsError: resultsError as Error | undefined,
    canApprove,
    canApproveLoading,
    approveExecution,
    denyExecution,
    mutationInProgress,
    mutationError,
    clearMutationError,
  };
};
