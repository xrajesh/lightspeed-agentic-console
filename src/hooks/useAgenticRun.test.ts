import { describe, expect, test } from 'vitest';
import {
  AgenticRunCondition,
  derivePhaseFromConditions,
  ExecutionResultK8s,
  RemediationOption,
} from '../models/agenticrun';
import { filterLatest, mapExecution, mapOption, mapRootCause } from './useAgenticRun';

const makeCondition = (
  type: string,
  status: 'True' | 'False' | 'Unknown',
  reason?: string,
): AgenticRunCondition => ({ type, status, ...(reason ? { reason } : {}) });

const makeOption = (overrides?: Partial<RemediationOption>): RemediationOption => ({
  title: 'Restart pod',
  summary: 'Restart the failing pod',
  diagnosis: {
    summary: 'Pod OOMKilled',
    confidence: 'High',
    rootCause: 'Memory limit too low',
  },
  remediationPlan: {
    description: 'Increase memory limit',
    actions: [{ type: 'patch', description: 'Patch deployment' }],
    risk: 'Low',
    reversible: 'Reversible',
    estimatedImpact: 'Minimal downtime',
    rollbackPlan: {
      description: 'Revert memory limit',
      command: 'kubectl rollout undo',
    },
  },
  ...overrides,
});

describe('derivePhase', () => {
  test('returns Pending when conditions are undefined', () => {
    expect(derivePhaseFromConditions(undefined)).toBe('Pending');
  });

  test('returns Pending when conditions are empty', () => {
    expect(derivePhaseFromConditions([])).toBe('Pending');
  });

  test('returns EmergencyStopped when EmergencyStopped=True', () => {
    const conditions = [makeCondition('EmergencyStopped', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('EmergencyStopped');
  });

  test('returns Escalated when Escalated=True', () => {
    const conditions = [makeCondition('Escalated', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Escalated');
  });

  test('returns Denied when Denied=True', () => {
    const conditions = [makeCondition('Denied', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Denied');
  });

  test('EmergencyStopped takes priority over Escalated', () => {
    const conditions = [
      makeCondition('Escalated', 'True'),
      makeCondition('EmergencyStopped', 'True'),
    ];
    expect(derivePhaseFromConditions(conditions)).toBe('EmergencyStopped');
  });

  test('returns Escalating when Escalated=Unknown', () => {
    const conditions = [makeCondition('Escalated', 'Unknown')];
    expect(derivePhaseFromConditions(conditions)).toBe('Escalating');
  });

  test('returns Failed when Escalated=False', () => {
    const conditions = [makeCondition('Escalated', 'False')];
    expect(derivePhaseFromConditions(conditions)).toBe('Failed');
  });

  test('returns Completed when Verified=True', () => {
    const conditions = [makeCondition('Verified', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Completed');
  });

  test('returns Verifying when Verified=Unknown', () => {
    const conditions = [makeCondition('Verified', 'Unknown')];
    expect(derivePhaseFromConditions(conditions)).toBe('Verifying');
  });

  test('returns Executing when Verified=False and reason=RetryingExecution', () => {
    const conditions = [makeCondition('Verified', 'False', 'RetryingExecution')];
    expect(derivePhaseFromConditions(conditions)).toBe('Executing');
  });

  test('returns Failed when Verified=False without retry reason', () => {
    const conditions = [makeCondition('Verified', 'False')];
    expect(derivePhaseFromConditions(conditions)).toBe('Failed');
  });

  test('returns Verifying when Executed=True', () => {
    const conditions = [makeCondition('Executed', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Verifying');
  });

  test('returns Executing when Executed=Unknown', () => {
    const conditions = [makeCondition('Executed', 'Unknown')];
    expect(derivePhaseFromConditions(conditions)).toBe('Executing');
  });

  test('returns Failed when Executed=False', () => {
    const conditions = [makeCondition('Executed', 'False')];
    expect(derivePhaseFromConditions(conditions)).toBe('Failed');
  });

  test('returns Proposed when Analyzed=True', () => {
    const conditions = [makeCondition('Analyzed', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Proposed');
  });

  test('returns Analyzing when Analyzed=Unknown', () => {
    const conditions = [makeCondition('Analyzed', 'Unknown')];
    expect(derivePhaseFromConditions(conditions)).toBe('Analyzing');
  });

  test('returns Failed when Analyzed=False', () => {
    const conditions = [makeCondition('Analyzed', 'False')];
    expect(derivePhaseFromConditions(conditions)).toBe('Failed');
  });

  test('returns Pending when conditions exist but none match known types', () => {
    const conditions = [makeCondition('SomeOtherCondition', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Pending');
  });
});

describe('mapRootCause', () => {
  test('returns undefined when options are undefined', () => {
    expect(mapRootCause(undefined)).toBeUndefined();
  });

  test('returns undefined when options are empty', () => {
    expect(mapRootCause([])).toBeUndefined();
  });

  test('returns undefined when first option has no diagnosis', () => {
    const opt = makeOption({ diagnosis: undefined });
    expect(mapRootCause([opt])).toBeUndefined();
  });

  test('extracts root cause from the first option diagnosis', () => {
    const opt = makeOption();
    const result = mapRootCause([opt]);
    expect(result).toEqual({
      cause: 'Memory limit too low',
      detail: 'Pod OOMKilled',
    });
  });
});

describe('mapOption', () => {
  test('maps a full option to RemediationOptionView', () => {
    const opt = makeOption();
    const result = mapOption(opt, 0);
    expect(result).toEqual({
      index: 0,
      title: 'Restart pod',
      description: 'Increase memory limit',
      reversibility: 'Reversible',
      risk: 'Low',
      estimatedImpact: 'Minimal downtime',
      actions: [{ type: 'patch', description: 'Patch deployment' }],
      rollbackDescription: 'Revert memory limit',
      rollbackCommand: 'kubectl rollout undo',
    });
  });

  test('uses summary as description when remediationPlan is absent', () => {
    const opt = makeOption({ remediationPlan: undefined, summary: 'Just a summary' });
    const result = mapOption(opt, 2);
    expect(result.index).toBe(2);
    expect(result.description).toBe('Just a summary');
    expect(result.risk).toBeUndefined();
    expect(result.actions).toBeUndefined();
  });

  test('falls back to empty string when both remediationPlan and summary are absent', () => {
    const opt = makeOption({ remediationPlan: undefined, summary: undefined });
    const result = mapOption(opt, 0);
    expect(result.description).toBe('');
  });
});

describe('mapExecution', () => {
  test('returns undefined when execution is undefined', () => {
    expect(mapExecution(undefined, undefined)).toBeUndefined();
  });

  test('builds post-execution view from execution and verification', () => {
    const options: RemediationOption[] = [makeOption()];
    const execution: ExecutionResultK8s = {
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'ExecutionResult',
      metadata: { name: 'exec-1', namespace: 'default' },
      spec: { agenticRunName: 'p1' },
      status: {
        conditions: [
          {
            type: 'Executed',
            status: 'True',
            reason: 'Success',
            message: 'Actions completed',
            lastTransitionTime: '2025-01-01T00:00:00Z',
          },
        ],
        actionsTaken: [{ type: 'patch', description: 'Patched deployment', outcome: 'Succeeded' }],
      },
    };
    const result = mapExecution(options, execution);
    expect(result).toBeDefined();
    expect(result!.originalRootCause).toBe('Memory limit too low');
    expect(result!.outcome).toBe('Unknown');
  });

  test('handles execution without verification', () => {
    const options: RemediationOption[] = [makeOption()];
    const execution: ExecutionResultK8s = {
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'ExecutionResult',
      metadata: { name: 'exec-1', namespace: 'default' },
      spec: { agenticRunName: 'p1' },
      status: {
        actionsTaken: [{ type: 'patch', description: 'Patched', outcome: 'Succeeded' }],
      },
    };

    const result = mapExecution(options, execution);
    expect(result).toBeDefined();
    expect(result!.outcome).toBe('Unknown');
  });

  test('handles execution with no actionsTaken', () => {
    const execution: ExecutionResultK8s = {
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'ExecutionResult',
      metadata: { name: 'exec-1', namespace: 'default' },
      spec: { agenticRunName: 'p1' },
      status: {},
    };

    const result = mapExecution(undefined, execution);
    expect(result).toBeDefined();
    expect(result!.outcome).toBe('Unknown');
    expect(result!.remediationDelta).toBe('');
  });
});

describe('filterLatest', () => {
  test('returns undefined for undefined input', () => {
    expect(filterLatest(undefined)).toBeUndefined();
  });

  test('returns undefined for empty array', () => {
    expect(filterLatest([])).toBeUndefined();
  });

  test('returns the only item for single-element array', () => {
    const item = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'a', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    expect(filterLatest([item])).toBe(item);
  });

  test('returns the item with the latest creationTimestamp', () => {
    const older = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'old', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    const newer = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'new', creationTimestamp: '2025-06-15T12:00:00Z' },
    };
    expect(filterLatest([older, newer])).toBe(newer);
    expect(filterLatest([newer, older])).toBe(newer);
  });

  test('handles items missing creationTimestamp gracefully', () => {
    const withTs = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'has-ts', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    const withoutTs = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'no-ts' },
    };
    // Item with a timestamp should be preferred over one without
    expect(filterLatest([withoutTs, withTs])).toBe(withTs);
  });

  test('prefers StepResultRef match over latest timestamp', () => {
    const older = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'result-1', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    const newer = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'result-2', creationTimestamp: '2025-06-15T12:00:00Z' },
    };
    const refs = [
      { name: 'result-1', outcome: 'Succeeded' as const },
      { name: 'result-1', outcome: 'Succeeded' as const },
    ];
    // Should match by ref name (result-1) even though result-2 is newer
    expect(filterLatest([older, newer], refs)).toBe(older);
  });

  test('falls back to timestamp when ref name is not found', () => {
    const older = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'result-1', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    const newer = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'result-2', creationTimestamp: '2025-06-15T12:00:00Z' },
    };
    const refs = [{ name: 'result-missing', outcome: 'Succeeded' as const }];
    expect(filterLatest([older, newer], refs)).toBe(newer);
  });

  test('falls back to timestamp when refs are undefined', () => {
    const older = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'old', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    const newer = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'new', creationTimestamp: '2025-06-15T12:00:00Z' },
    };
    expect(filterLatest([older, newer], undefined)).toBe(newer);
  });
});
