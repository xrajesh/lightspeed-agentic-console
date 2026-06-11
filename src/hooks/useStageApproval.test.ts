import { renderHook, act } from '@testing-library/react-hooks';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { k8sPatch, useAccessReview } from '@openshift-console/dynamic-plugin-sdk';

import {
  LightspeedProposal,
  LightspeedProposalApprovalModel,
} from '../models/proposal';
import { useStageApproval } from './useStageApproval';
import { makeApproval } from '../test-helpers';

const mockK8sPatch = k8sPatch as ReturnType<typeof vi.fn>;
const mockUseAccessReview = useAccessReview as ReturnType<typeof vi.fn>;

function makeProposal(overrides?: Partial<LightspeedProposal>): LightspeedProposal {
  return {
    apiVersion: 'agentic.openshift.io/v1alpha1',
    kind: 'Proposal',
    metadata: { name: 'test', namespace: 'default' },
    spec: { request: 'fix something' },
    ...overrides,
  };
}

beforeEach(() => {
  mockK8sPatch.mockReset();
  mockK8sPatch.mockResolvedValue({});
});

describe('useStageApproval', () => {
  it('returns needsApproval=false when approval is undefined', () => {
    const { result } = renderHook(() => useStageApproval(makeProposal(), undefined, 'Analysis'));
    expect(result.current.needsApproval).toBe(false);
    expect(result.current.stageStatus).toBe('pending');
  });

  it('returns needsApproval=true for Analysis when pending', () => {
    const { result } = renderHook(() =>
      useStageApproval(makeProposal(), makeApproval(), 'Analysis'),
    );
    expect(result.current.needsApproval).toBe(true);
    expect(result.current.stageStatus).toBe('pending');
  });

  it('returns needsApproval=false when stage already approved', () => {
    const approval = makeApproval([{ type: 'Analysis', analysis: {} }]);
    const { result } = renderHook(() => useStageApproval(makeProposal(), approval, 'Analysis'));
    expect(result.current.needsApproval).toBe(false);
    expect(result.current.stageStatus).toBe('approved');
  });

  it('approve calls k8sPatch on ProposalApproval', async () => {
    const proposal = makeProposal();
    const approval = makeApproval();
    const { result } = renderHook(() => useStageApproval(proposal, approval, 'Analysis'));

    await act(async () => {
      await result.current.approve();
    });

    expect(mockK8sPatch).toHaveBeenCalledWith({
      data: [{ op: 'add', path: '/spec/stages', value: [{ type: 'Analysis', analysis: {} }] }],
      model: LightspeedProposalApprovalModel,
      resource: approval,
    });
  });

  it('approve with maxAttempts includes it in ExecutionApproval patch', async () => {
    const proposal = makeProposal();
    const approval = makeApproval();
    const { result } = renderHook(() => useStageApproval(proposal, approval, 'Execution'));

    await act(async () => {
      await result.current.approve({ maxAttempts: 3, option: 0 });
    });

    expect(mockK8sPatch).toHaveBeenCalledTimes(1);
    expect(mockK8sPatch).toHaveBeenCalledWith({
      data: [
        {
          op: 'add',
          path: '/spec/stages',
          value: [{ type: 'Execution', execution: { option: 0, maxAttempts: 3 } }],
        },
      ],
      model: LightspeedProposalApprovalModel,
      resource: approval,
    });
  });

  it('deny calls k8sPatch with decision=Denied', async () => {
    const approval = makeApproval();
    const { result } = renderHook(() => useStageApproval(makeProposal(), approval, 'Analysis'));

    await act(async () => {
      await result.current.deny();
    });

    expect(mockK8sPatch).toHaveBeenCalledWith({
      data: [
        {
          op: 'add',
          path: '/spec/stages',
          value: [{ type: 'Analysis', decision: 'Denied', analysis: {} }],
        },
      ],
      model: LightspeedProposalApprovalModel,
      resource: approval,
    });
  });

  it('sets error on patch failure', async () => {
    mockK8sPatch.mockRejectedValueOnce(new Error('Forbidden'));
    const { result } = renderHook(() =>
      useStageApproval(makeProposal(), makeApproval(), 'Analysis'),
    );

    await act(async () => {
      await result.current.approve();
    });

    expect(result.current.error).toBe('Forbidden');
  });

  it('clearError resets error state', async () => {
    mockK8sPatch.mockRejectedValueOnce(new Error('Forbidden'));
    const { result } = renderHook(() =>
      useStageApproval(makeProposal(), makeApproval(), 'Analysis'),
    );

    await act(async () => {
      await result.current.approve();
    });
    expect(result.current.error).toBe('Forbidden');

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it('returns canApprove=true when user has patch permission', () => {
    mockUseAccessReview.mockReturnValue([true, false]);
    const { result } = renderHook(() =>
      useStageApproval(makeProposal(), makeApproval(), 'Analysis'),
    );
    expect(result.current.canApprove).toBe(true);
    expect(result.current.canApproveLoading).toBe(false);
  });

  it('returns canApprove=false when user lacks patch permission', () => {
    mockUseAccessReview.mockReturnValue([false, false]);
    const { result } = renderHook(() =>
      useStageApproval(makeProposal(), makeApproval(), 'Analysis'),
    );
    expect(result.current.canApprove).toBe(false);
    expect(result.current.canApproveLoading).toBe(false);
  });

  it('returns canApproveLoading=true while access review is in flight', () => {
    mockUseAccessReview.mockReturnValue([false, true]);
    const { result } = renderHook(() =>
      useStageApproval(makeProposal(), makeApproval(), 'Analysis'),
    );
    expect(result.current.canApproveLoading).toBe(true);
  });

  it('passes approval namespace to useAccessReview', () => {
    const approval = makeApproval();
    renderHook(() => useStageApproval(makeProposal(), approval, 'Analysis'));
    expect(mockUseAccessReview).toHaveBeenCalledWith({
      group: 'agentic.openshift.io',
      resource: 'proposalapprovals',
      verb: 'patch',
      namespace: approval.metadata.namespace,
    });
  });

  it('falls back to proposal namespace when approval is undefined', () => {
    const proposal = makeProposal({ metadata: { name: 'test', namespace: 'my-ns' } });
    renderHook(() => useStageApproval(proposal, undefined, 'Analysis'));
    expect(mockUseAccessReview).toHaveBeenCalledWith({
      group: 'agentic.openshift.io',
      resource: 'proposalapprovals',
      verb: 'patch',
      namespace: 'my-ns',
    });
  });
});
