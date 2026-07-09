import {
  ApprovalStage,
  ApprovalStageType,
  LightspeedAgenticRunApproval,
  AgenticRunCondition,
  AgenticRunPhase,
} from '../models/agenticrun';
import { TERMINAL_PHASES } from '../models/agenticrun-views';

export function findStage(
  approval: LightspeedAgenticRunApproval | undefined,
  stageType: ApprovalStageType,
): ApprovalStage | undefined {
  return approval?.spec?.stages?.find((s) => s.type === stageType);
}

export function getStageStatus(
  approval: LightspeedAgenticRunApproval | undefined,
  stageType: ApprovalStageType,
): 'approved' | 'denied' | 'pending' {
  const stage = findStage(approval, stageType);
  if (!stage) return 'pending';
  return stage.decision === 'Denied' ? 'denied' : 'approved';
}

export function stageNeedsApproval(
  approval: LightspeedAgenticRunApproval | undefined,
  stageType: ApprovalStageType,
  conditions: AgenticRunCondition[] | undefined,
  phase: AgenticRunPhase,
): boolean {
  if (!approval) return false;
  if (findStage(approval, stageType)) return false;
  if (TERMINAL_PHASES.includes(phase)) return false;

  const get = (type: string) => conditions?.find((c) => c.type === type);

  switch (stageType) {
    case 'Analysis': {
      const analyzed = get('Analyzed');
      return !analyzed || analyzed.status !== 'True';
    }
    case 'Execution':
      return get('Analyzed')?.status === 'True' && !get('Executed');
    case 'Verification':
      return get('Executed')?.status === 'True' && !get('Verified');
    case 'Escalation':
      return get('Escalated')?.status === 'Unknown' && !findStage(approval, 'Escalation');
    default:
      return false;
  }
}

type PatchOp = { op: 'add' | 'replace'; path: string; value: unknown };

export function buildApprovalPatch(
  approval: LightspeedAgenticRunApproval | undefined,
  stageType: ApprovalStageType,
  denied: boolean,
  options?: { maxAttempts?: number; option?: number; agent?: string },
): PatchOp[] {
  const stage: ApprovalStage = { type: stageType };
  if (denied) stage.decision = 'Denied';

  switch (stageType) {
    case 'Analysis':
      stage.analysis = options?.agent ? { agent: options.agent } : {};
      break;
    case 'Execution':
      stage.execution = {
        ...(options?.option !== undefined && { option: options.option }),
        ...(options?.agent && { agent: options.agent }),
        ...(options?.maxAttempts !== undefined &&
          options.maxAttempts > 0 && { maxAttempts: options.maxAttempts }),
      };
      break;
    case 'Verification':
      stage.verification = options?.agent ? { agent: options.agent } : {};
      break;
    case 'Escalation':
      stage.escalation = options?.agent ? { agent: options.agent } : {};
      break;
  }

  if (approval?.spec?.stages?.length) {
    return [{ op: 'add', path: '/spec/stages/-', value: stage }];
  }
  if (approval?.spec) {
    return [{ op: 'add', path: '/spec/stages', value: [stage] }];
  }
  return [{ op: 'add', path: '/spec', value: { stages: [stage] } }];
}
