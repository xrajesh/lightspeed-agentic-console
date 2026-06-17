import { describe, expect, it } from 'vitest';

import { ApprovalStage, derivePhaseFromConditions, ProposalCondition } from '../models/proposal';
import { buildApprovalPatch, findStage, getStageStatus, stageNeedsApproval } from './approval';
import { cond, makeApproval, makeApprovalNoSpec } from '../test-helpers';

function phase(conditions?: ProposalCondition[]) {
  return derivePhaseFromConditions(conditions);
}

describe('findStage', () => {
  it('returns undefined when approval is undefined', () => {
    expect(findStage(undefined, 'Analysis')).toBeUndefined();
  });

  it('returns undefined when stages array is empty', () => {
    expect(findStage(makeApproval([]), 'Analysis')).toBeUndefined();
  });

  it('returns undefined when stage type not found', () => {
    const approval = makeApproval([{ type: 'Analysis', analysis: {} }]);
    expect(findStage(approval, 'Execution')).toBeUndefined();
  });

  it('returns the matching stage', () => {
    const stage: ApprovalStage = { type: 'Execution', execution: { option: 1 } };
    const approval = makeApproval([{ type: 'Analysis', analysis: {} }, stage]);
    expect(findStage(approval, 'Execution')).toEqual(stage);
  });
});

describe('getStageStatus', () => {
  it('returns pending when approval is undefined', () => {
    expect(getStageStatus(undefined, 'Analysis')).toBe('pending');
  });

  it('returns pending when stage not in approval', () => {
    expect(getStageStatus(makeApproval([]), 'Analysis')).toBe('pending');
  });

  it('returns approved when stage exists and not denied', () => {
    const approval = makeApproval([{ type: 'Analysis', analysis: {} }]);
    expect(getStageStatus(approval, 'Analysis')).toBe('approved');
  });

  it('returns denied when stage has denied=true', () => {
    const approval = makeApproval([{ type: 'Analysis', decision: 'Denied', analysis: {} }]);
    expect(getStageStatus(approval, 'Analysis')).toBe('denied');
  });
});

describe('stageNeedsApproval', () => {
  it('returns false when stage already approved', () => {
    const approval = makeApproval([{ type: 'Analysis', analysis: {} }]);
    expect(stageNeedsApproval(approval, 'Analysis', undefined, phase())).toBe(false);
  });

  it('returns false when stage is denied', () => {
    const approval = makeApproval([{ type: 'Analysis', decision: 'Denied', analysis: {} }]);
    expect(stageNeedsApproval(approval, 'Analysis', undefined, phase())).toBe(false);
  });

  it('returns false for terminal phase Completed', () => {
    const conditions = [cond('Verified', 'True')];
    expect(stageNeedsApproval(makeApproval(), 'Analysis', conditions, phase(conditions))).toBe(
      false,
    );
  });

  it('returns false for terminal phase Failed', () => {
    const conditions = [cond('Analyzed', 'False', 'Error')];
    expect(stageNeedsApproval(makeApproval(), 'Analysis', conditions, phase(conditions))).toBe(
      false,
    );
  });

  it('returns false for terminal phase Denied', () => {
    const conditions = [cond('Denied', 'True')];
    expect(stageNeedsApproval(makeApproval(), 'Analysis', conditions, phase(conditions))).toBe(
      false,
    );
  });

  it('returns false for terminal phase Escalated', () => {
    const conditions = [cond('Escalated', 'True')];
    expect(stageNeedsApproval(makeApproval(), 'Analysis', conditions, phase(conditions))).toBe(
      false,
    );
  });

  describe('Analysis stage', () => {
    it('returns true when phase is Pending (no conditions)', () => {
      expect(stageNeedsApproval(makeApproval(), 'Analysis', undefined, 'Pending')).toBe(true);
    });

    it('returns true when phase is Pending (empty conditions)', () => {
      expect(stageNeedsApproval(makeApproval(), 'Analysis', [], 'Pending')).toBe(true);
    });

    it('returns false when analysis is already complete', () => {
      const conditions = [cond('Analyzed', 'True')];
      expect(stageNeedsApproval(makeApproval(), 'Analysis', conditions, phase(conditions))).toBe(
        false,
      );
    });
  });

  describe('Execution stage', () => {
    it('returns true when Analyzed=True and no Executed condition', () => {
      const conditions = [cond('Analyzed', 'True')];
      expect(stageNeedsApproval(makeApproval(), 'Execution', conditions, phase(conditions))).toBe(
        true,
      );
    });

    it('returns false when Analyzed is not True', () => {
      const conditions = [cond('Analyzed', 'Unknown')];
      expect(stageNeedsApproval(makeApproval(), 'Execution', conditions, phase(conditions))).toBe(
        false,
      );
    });

    it('returns false when Executed condition exists', () => {
      const conditions = [cond('Analyzed', 'True'), cond('Executed', 'Unknown')];
      expect(stageNeedsApproval(makeApproval(), 'Execution', conditions, phase(conditions))).toBe(
        false,
      );
    });
  });

  describe('Verification stage', () => {
    it('returns true when Executed=True and no Verified condition', () => {
      const conditions = [cond('Analyzed', 'True'), cond('Executed', 'True')];
      expect(
        stageNeedsApproval(makeApproval(), 'Verification', conditions, phase(conditions)),
      ).toBe(true);
    });

    it('returns false when Executed is not True', () => {
      const conditions = [cond('Analyzed', 'True'), cond('Executed', 'Unknown')];
      expect(
        stageNeedsApproval(makeApproval(), 'Verification', conditions, phase(conditions)),
      ).toBe(false);
    });

    it('returns false when Verified condition exists', () => {
      const conditions = [
        cond('Analyzed', 'True'),
        cond('Executed', 'True'),
        cond('Verified', 'Unknown'),
      ];
      expect(
        stageNeedsApproval(makeApproval(), 'Verification', conditions, phase(conditions)),
      ).toBe(false);
    });
  });

  it('returns false when approval is undefined', () => {
    expect(stageNeedsApproval(undefined, 'Analysis', undefined, 'Pending')).toBe(false);
  });
});

describe('buildApprovalPatch', () => {
  it('creates array when no existing stages', () => {
    const patches = buildApprovalPatch(makeApproval(), 'Analysis', false);
    expect(patches).toEqual([
      { op: 'add', path: '/spec/stages', value: [{ type: 'Analysis', analysis: {} }] },
    ]);
  });

  it('appends to existing stages array', () => {
    const approval = makeApproval([{ type: 'Analysis', analysis: {} }]);
    const patches = buildApprovalPatch(approval, 'Execution', false, { option: 2 });
    expect(patches).toEqual([
      { op: 'add', path: '/spec/stages/-', value: { type: 'Execution', execution: { option: 2 } } },
    ]);
  });

  it('sets decision=Denied for denial', () => {
    const patches = buildApprovalPatch(makeApproval(), 'Analysis', true);
    expect(patches[0].value).toEqual(
      expect.arrayContaining([expect.objectContaining({ decision: 'Denied' })]),
    );
  });

  it('includes agent override', () => {
    const patches = buildApprovalPatch(makeApproval(), 'Execution', false, {
      option: 0,
      agent: 'fast',
    });
    const stage = (patches[0].value as ApprovalStage[])?.[0] ?? patches[0].value;
    expect(stage).toEqual(expect.objectContaining({ execution: { option: 0, agent: 'fast' } }));
  });

  it('builds verification stage correctly', () => {
    const patches = buildApprovalPatch(makeApproval(), 'Verification', false);
    expect(patches).toEqual([
      { op: 'add', path: '/spec/stages', value: [{ type: 'Verification', verification: {} }] },
    ]);
  });

  it('patches /spec/stages when spec exists but stages is undefined', () => {
    const approval = { ...makeApprovalNoSpec(), spec: {} };
    const patches = buildApprovalPatch(approval, 'Analysis', false);
    expect(patches).toEqual([
      { op: 'add', path: '/spec/stages', value: [{ type: 'Analysis', analysis: {} }] },
    ]);
  });

  it('patches /spec when spec is undefined', () => {
    const patches = buildApprovalPatch(makeApprovalNoSpec(), 'Analysis', false);
    expect(patches).toEqual([
      { op: 'add', path: '/spec', value: { stages: [{ type: 'Analysis', analysis: {} }] } },
    ]);
  });
});
