import { useCallback, useMemo, useState } from 'react';
import {
  HttpError,
  k8sPatch,
  K8sResourceCommon,
  useAccessReview,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  AgenticRunApprovalK8s,
  AgenticRunK8s,
  AgenticRunPhase,
  AnalysisResultGVK,
  AnalysisResultK8s,
  derivePhaseFromConditions,
  ExecutionResultGVK,
  ExecutionResultK8s,
  LightspeedAgenticRunApprovalGVK,
  LightspeedAgenticRunApprovalModel,
  LightspeedAgenticRunGVK,
  RemediationOption,
  ResultCondition,
  StepResultRef,
  VerificationResultGVK,
  VerificationResultK8s,
} from '../models/agenticrun';
import { buildApprovalPatch } from '../utils/approval';
import {
  AgenticRunView,
  ExecutionView,
  RemediationOptionView,
  RootCauseView,
  SandboxView,
  TimelineEvent,
  VerificationView,
} from '../models/agenticrun-views';
import { RESULT_LABEL_RUN, RUN_LABEL_SOURCE, RUN_NAMESPACE } from '../constants';

// Assumes the operator names the sandbox pod identically to the SandboxClaim CR.
// If the operator decouples these names, log streaming will need the actual pod name from the API.
const mapSandbox = (s?: { claimName?: string; namespace?: string }): SandboxView | undefined =>
  s?.claimName ? { podName: s.claimName, namespace: s.namespace || RUN_NAMESPACE } : undefined;

export const mapRootCause = (
  analysis: AnalysisResultK8s | undefined,
): RootCauseView | undefined => {
  const diagnosis = analysis?.status?.diagnosis ?? analysis?.status?.options?.[0]?.diagnosis;
  if (!diagnosis) return undefined;

  return {
    cause: diagnosis.rootCause,
    detail: diagnosis.summary,
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
  run: AgenticRunK8s,
  phase: AgenticRunPhase,
  t: TFunction,
  analysis?: AnalysisResultK8s,
  execution?: ExecutionResultK8s,
  verification?: VerificationResultK8s,
  approval?: AgenticRunApprovalK8s,
): TimelineEvent[] => {
  const events: TimelineEvent[] = [];

  if (run.metadata?.creationTimestamp) {
    events.push({
      label: t('Run created'),
      timestamp: run.metadata.creationTimestamp,
      variant: 'success',
    });
  }

  const conditionSources: {
    conditions: ResultCondition[] | undefined;
    label: string;
    currentPhase: AgenticRunPhase;
    failureReason?: string;
  }[] = [
    { conditions: analysis?.status?.conditions, label: t('Analysis'), currentPhase: 'Analyzing' },
    {
      conditions: execution?.status?.conditions,
      label: t('Execution'),
      currentPhase: 'Executing',
      failureReason: execution?.status?.failureReason,
    },
    {
      conditions: verification?.status?.conditions,
      label: t('Verification'),
      currentPhase: 'Verifying',
      failureReason: verification?.status?.failureReason,
    },
  ];

  for (const { conditions, label, currentPhase, failureReason } of conditionSources) {
    for (const cond of conditions ?? []) {
      if (cond.type === 'Completed' && cond.status !== 'True') continue;
      if (
        cond.type === 'Completed' &&
        cond.status === 'True' &&
        cond.reason === 'NoActionRequired'
      ) {
        events.push({
          label: t('No action required'),
          description: cond.message || undefined,
          timestamp: cond.lastTransitionTime,
          variant: 'success',
        });
        continue;
      }
      events.push({
        label: `${label} ${cond.type === 'Started' ? t('started') : cond.type === 'Completed' ? t('completed') : cond.type.toLowerCase()}`,
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
      label: approval?.spec?.approver?.username
        ? t('Execution denied by {{username}}', { username: approval.spec.approver.username })
        : t('Execution denied'),
      timestamp: approvalTimestamp,
      variant: 'danger',
    });
  } else if (execStage && execStartedCond) {
    events.push({
      label: t('Execution approved'),
      description:
        execStage.execution?.option !== undefined
          ? t('Option {{number}}', { number: (execStage.execution.option ?? 0) + 1 })
          : undefined,
      timestamp: approvalTimestamp,
      variant: 'success',
    });
  }

  for (const cond of run.status?.conditions ?? []) {
    if (cond.type === 'Denied' && cond.status === 'True') {
      events.push({
        label: t('Run denied'),
        description: cond.message || undefined,
        timestamp: cond.lastTransitionTime,
        variant: 'danger',
      });
    }
    if (cond.type === 'EmergencyStopped' && cond.status === 'True') {
      events.push({
        label: t('Emergency stopped'),
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

const mapToAgenticRunView = (
  run: AgenticRunK8s | undefined,
  analysis: AnalysisResultK8s | undefined,
  execution: ExecutionResultK8s | undefined,
  verification: VerificationResultK8s | undefined,
  approval: AgenticRunApprovalK8s | undefined,
  t: TFunction,
): AgenticRunView | undefined => {
  if (!run?.metadata?.name) return undefined;

  const phase = derivePhaseFromConditions(run.status?.conditions);
  const options = analysis?.status?.options;
  const failureReason =
    analysis?.status?.failureReason ??
    execution?.status?.failureReason ??
    verification?.status?.failureReason;

  return {
    phase,
    request: run.spec?.request ?? '',
    source: run.metadata?.labels?.[RUN_LABEL_SOURCE],
    advisory: !run.spec?.execution,
    targetNamespaces: run.spec?.targetNamespaces,
    failureReason,
    rootCause: mapRootCause(analysis),
    analysisCreatedAt: analysis?.metadata?.creationTimestamp,
    analysisStartedAt: (analysis?.status?.conditions ?? []).find((c) => c.type === 'Started')
      ?.lastTransitionTime,
    analysisSandbox: mapSandbox(run.status?.steps?.analysis?.sandbox),
    executionStartedAt: (execution?.status?.conditions ?? []).find((c) => c.type === 'Started')
      ?.lastTransitionTime,
    executionSandbox: mapSandbox(run.status?.steps?.execution?.sandbox),
    verificationStartedAt: (verification?.status?.conditions ?? []).find(
      (c) => c.type === 'Started',
    )?.lastTransitionTime,
    verificationSandbox: mapSandbox(run.status?.steps?.verification?.sandbox),
    executedOptionIndex: (approval?.spec?.stages ?? []).find((s) => s.type === 'Execution')
      ?.execution?.option,
    options: (options ?? []).map((opt, i) => mapOption(opt, i)),
    execution: mapExecution(options, execution, run.status?.steps?.execution?.sandbox),
    verification: mapVerification(verification, run.status?.steps?.verification?.sandbox),
    timeline: mapTimeline(run, phase, t, analysis, execution, verification, approval),
  };
};

export interface UseAgenticRunReturn {
  run: K8sResourceCommon | undefined;
  view: AgenticRunView | undefined;
  runLoaded: boolean;
  runError: Error | undefined;
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

export const useAgenticRun = (
  name: string,
  namespace: string = RUN_NAMESPACE,
): UseAgenticRunReturn => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const watchEnabled = !!name;

  const [run, runLoaded, runError] = useK8sWatchResource<AgenticRunK8s>(
    watchEnabled ? { groupVersionKind: LightspeedAgenticRunGVK, name, namespace } : null,
  );

  const [analysisResults, analysisLoaded, analysisError] = useK8sWatchResource<AnalysisResultK8s[]>(
    watchEnabled
      ? {
          groupVersionKind: AnalysisResultGVK,
          namespace,
          isList: true,
          selector: { matchLabels: { [RESULT_LABEL_RUN]: name } },
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
          selector: { matchLabels: { [RESULT_LABEL_RUN]: name } },
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
          selector: { matchLabels: { [RESULT_LABEL_RUN]: name } },
        }
      : null,
  );

  const [approval, approvalLoaded, approvalError] = useK8sWatchResource<AgenticRunApprovalK8s>(
    watchEnabled
      ? {
          groupVersionKind: LightspeedAgenticRunApprovalGVK,
          name,
          namespace,
        }
      : null,
  );

  const analysisRefs = run?.status?.steps?.analysis?.results;
  const executionRefs = run?.status?.steps?.execution?.results;
  const verificationRefs = run?.status?.steps?.verification?.results;

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
    () => mapToAgenticRunView(run, analysis, execution, verification, approval, t),
    [run, analysis, execution, verification, approval, t],
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
    resource: 'agenticrunapprovals',
    verb: 'patch',
    namespace: approval?.metadata?.namespace ?? namespace,
  });

  const [mutationInProgress, setMutationInProgress] = useState(false);
  const [mutationError, setMutationError] = useState<string>();
  const clearMutationError = useCallback(() => setMutationError(undefined), []);
  const runApprovalMutation = useCallback(
    async (
      patchData: ReturnType<typeof buildApprovalPatch>,
      fallbackError: string,
    ): Promise<boolean> => {
      if (!canApprove) {
        setMutationError(t("You don't have permission to approve or deny runs."));
        return false;
      }
      if (!run || !approval) {
        setMutationError(t('Approval resource is not available yet.'));
        return false;
      }
      setMutationInProgress(true);
      setMutationError(undefined);
      try {
        await k8sPatch({
          model: LightspeedAgenticRunApprovalModel,
          resource: {
            metadata: {
              name: run.metadata?.name,
              namespace,
            },
          },
          data: patchData,
        });
        return true;
      } catch (err) {
        setMutationError((err as Error)?.message || fallbackError);
        return false;
      } finally {
        setMutationInProgress(false);
      }
    },
    [run, approval, namespace, canApprove, t],
  );

  const approveExecution = useCallback(
    async (selectedOption: number): Promise<boolean> =>
      runApprovalMutation(
        buildApprovalPatch(approval, 'Execution', false, {
          option: selectedOption,
          maxAttempts: 1,
        }),
        t('Failed to approve execution.'),
      ),
    [approval, runApprovalMutation, t],
  );

  const denyExecution = useCallback(
    async (): Promise<boolean> =>
      runApprovalMutation(
        buildApprovalPatch(approval, 'Execution', true),
        t('Failed to deny execution.'),
      ),
    [approval, runApprovalMutation, t],
  );

  return {
    run: run as K8sResourceCommon | undefined,
    view,
    runLoaded,
    runError: runError as Error | undefined,
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
