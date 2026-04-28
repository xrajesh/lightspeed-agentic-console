export type VisualizationUnits = 'bytes' | 'percent' | 'ms' | 'seconds';

export interface DynamicComponentProps {
  type: string;
  props: Record<string, unknown>;
  onAction?: (_action: string, _data: Record<string, unknown>) => void;
}

export interface DataTableProps {
  columns: string[];
  rows: string[][];
  monoFirstColumn?: boolean;
}

export interface VisualizationProps {
  title: string;
  queries?: string[];
  timespan?: number | string;
  units?: VisualizationUnits | string;
  showLegend?: boolean;
  isStack?: boolean;
  namespace?: string;
  summary?: { columns: string[]; rows: string[][] };
  series?: Array<{
    label: string;
    values: Array<{ label?: string; timestamp?: number; value: number }>;
  }>;
  chartType?: 'line' | 'area';
  xLabel?: string;
  yLabel?: string;
}

export interface ResourceDiffProps {
  title: string;
  resourceKind?: string;
  resourceName?: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface ActionPickerOption {
  id: string;
  label: string;
  description: string;
  risk?: string;
}

export interface ActionPickerProps {
  title: string;
  description?: string;
  options: ActionPickerOption[];
}

export interface EvidenceTableProps {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface TimelineEvent {
  time: string;
  label: string;
  status: 'success' | 'danger' | 'warning' | 'info';
}

export interface StatusTimelineProps {
  title: string;
  events: TimelineEvent[];
}

export interface RevisedProposalAction {
  type: string;
  description: string;
  resource?: {
    apiVersion: string;
    kind: string;
    name: string;
    namespace?: string;
  };
  patch?: string;
}

export interface RevisedProposalProps {
  description: string;
  actions: RevisedProposalAction[];
  risk: string;
  reversible: boolean;
  estimatedImpact?: string;
}

export interface RevisedVerificationProps {
  description: string;
  steps: import('../../../models/proposal').VerificationStep[];
  rollbackPlan: { description: string; command: string } | string;
}

export interface RevisedRbacProps {
  namespaceScoped: import('../../../models/proposal').PermissionRule[];
  clusterScoped: import('../../../models/proposal').PermissionRule[];
}

export interface CmoAlertDiagnosisProps {
  alertName: string;
  severity: string;
  component: string;
  rootCause: string;
  evidence?: string[];
  affectedResources?: string[];
  impact?: string;
}

export interface CmoMetricEvidenceProps {
  query: string;
  description: string;
  value: string;
  threshold?: string;
  status: string;
}

export interface CmoRemediationStepProps {
  order: number;
  action: string;
  command?: string;
  verifyCommand?: string;
  risk: string;
}

export interface CmoTriggerProposalProps {
  title: string;
  alertName: string;
  expr: string;
  queryTested: boolean;
  queryTestResult: string;
  severity: string;
  for: string;
  description: string;
  runbook?: string;
  namespace?: string;
  summary: string;
}
