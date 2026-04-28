import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { getRiskColor, PermissionRule, VerificationStep } from '../../models/proposal';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  CodeBlock,
  CodeBlockCode,
  Label,
  Split,
  SplitItem,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { CheckCircleIcon, ExclamationCircleIcon, InfoCircleIcon } from '@patternfly/react-icons';
import {
  Chart,
  ChartArea,
  ChartAxis,
  ChartGroup,
  ChartLegend,
  ChartLine,
  ChartStack,
  ChartThemeColor,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import { k8sCreate, QueryBrowser } from '@openshift-console/dynamic-plugin-sdk';

interface DynamicComponentProps {
  type: string;
  props: Record<string, unknown>;
  onAction?: (_action: string, _data: Record<string, unknown>) => void;
}

// --- Shared utilities ---

type VisualizationUnits = 'bytes' | 'percent' | 'ms' | 'seconds';

function formatValue(v: number, units?: string): string {
  if (units === 'bytes') {
    if (v >= 1e12) {
      return `${(v / 1e12).toFixed(1)} TiB`;
    }
    if (v >= 1e9) {
      return `${(v / 1e9).toFixed(1)} GiB`;
    }
    if (v >= 1e6) {
      return `${(v / 1e6).toFixed(1)} MiB`;
    }
    if (v >= 1e3) {
      return `${(v / 1e3).toFixed(1)} KiB`;
    }
    return `${v} B`;
  }
  if (units === 'percent') {
    return `${v.toFixed(1)}%`;
  }
  if (units === 'ms') {
    return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v.toFixed(0)}ms`;
  }
  if (units === 'seconds') {
    if (v >= 86400) {
      return `${(v / 86400).toFixed(1)}d`;
    }
    if (v >= 3600) {
      return `${(v / 3600).toFixed(1)}h`;
    }
    if (v >= 60) {
      return `${(v / 60).toFixed(1)}m`;
    }
    return `${v.toFixed(1)}s`;
  }
  return v.toFixed(2);
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const TIMESPAN_PRESETS: Record<string, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '2d': 2 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

function resolveTimespan(value?: number | string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number') {
    return value;
  }
  return TIMESPAN_PRESETS[value] ?? undefined;
}

const CHART_COLORS = [
  'var(--pf-t--chart--color--blue--300, #06c)',
  'var(--pf-t--chart--color--red--300, #c9190b)',
  'var(--pf-t--chart--color--green--300, #3e8635)',
  'var(--pf-t--chart--color--gold--300, #f0ab00)',
  'var(--pf-t--chart--color--purple--300, #8561c5)',
  'var(--pf-t--chart--color--cyan--300, #009596)',
];

// --- DataTable (shared by visualization summary + evidence_table) ---

interface DataTableProps {
  columns: string[];
  rows: string[][];
  monoFirstColumn?: boolean;
}

const DataTable: React.FC<DataTableProps> = ({ columns, rows, monoFirstColumn }) => (
  <table className="ols-plugin__chat-evidence-table">
    <thead>
      <tr>
        {columns.map((col, i) => (
          <th key={i}>{col}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, ri) => (
        <tr key={ri}>
          {row.map((cell, ci) => (
            <td
              className={monoFirstColumn && ci === 0 ? 'ols-plugin__chat-evidence-mono' : undefined}
              key={ci}
            >
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

// --- Visualization ---

interface VisualizationProps {
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

const StaticChart: React.FC<{ data: VisualizationProps }> = ({ data }) => {
  const series = data.series!;
  const chartType = data.chartType ?? 'area';
  const isStack = data.isStack ?? false;

  const hasTimestamps = React.useMemo(
    () => series.some((s) => s.values.some((v) => v.timestamp !== undefined)),
    [series],
  );

  const { legendData, yDomain } = React.useMemo(() => {
    const allValues = series.flatMap((s) => s.values.map((v) => v.value));
    const maxVal = Math.max(...allValues, 1);
    const minVal = Math.min(...allValues, 0);
    return {
      legendData: series.map((s, i) => ({
        name: s.label,
        symbol: { fill: CHART_COLORS[i % CHART_COLORS.length] },
      })),
      yDomain: [Math.min(minVal, 0), maxVal * 1.1] as [number, number],
    };
  }, [series]);

  const xTickFormat = React.useCallback(
    (t: number) => {
      if (hasTimestamps) {
        return formatTime(t);
      }
      const labels = series[0]?.values.map((v) => v.label) || [];
      return labels[t - 1] || '';
    },
    [hasTimestamps, series],
  );

  const yTickFormat = React.useCallback((v: number) => formatValue(v, data.units), [data.units]);

  const tooltipLabel = React.useCallback(
    ({ datum }: { datum: { name: string; y: number } }) =>
      `${datum.name}: ${formatValue(datum.y, data.units)}`,
    [data.units],
  );

  const ChartComp = chartType === 'line' ? ChartLine : ChartArea;
  const GroupComp = isStack ? ChartStack : ChartGroup;

  return (
    <div className="ols-plugin__chat-chart-container">
      <Chart
        containerComponent={<ChartVoronoiContainer constrainToVisibleArea labels={tooltipLabel} />}
        domain={{ y: yDomain }}
        height={200}
        legendComponent={<ChartLegend gutter={20} orientation="horizontal" />}
        legendData={legendData}
        legendPosition="bottom"
        padding={{ top: 10, right: 20, bottom: 40, left: 60 }}
        scale={hasTimestamps ? { x: 'time', y: 'linear' } : undefined}
        themeColor={ChartThemeColor.multiUnordered}
      >
        <ChartAxis
          label={data.xLabel}
          style={{ tickLabels: { fontSize: 10, angle: hasTimestamps ? -30 : 0 } }}
          tickFormat={xTickFormat}
          tickValues={hasTimestamps ? undefined : series[0]?.values.map((_, i) => i + 1)}
        />
        <ChartAxis
          dependentAxis
          label={data.yLabel}
          showGrid
          style={{
            tickLabels: { fontSize: 10 },
            grid: {
              stroke: 'var(--pf-t--global--border--color--default, #d2d2d2)',
              strokeDasharray: '3,3',
            },
          }}
          tickFormat={yTickFormat}
        />
        <GroupComp>
          {series.map((s, si) => {
            const color = CHART_COLORS[si % CHART_COLORS.length];
            return (
              <ChartComp
                data={s.values.map((v, vi) => ({
                  x: hasTimestamps ? new Date(v.timestamp!) : vi + 1,
                  y: v.value,
                  name: s.label,
                }))}
                key={si}
                name={s.label}
                style={{
                  data:
                    chartType === 'area'
                      ? { fill: color, fillOpacity: 0.15, stroke: color, strokeWidth: 2 }
                      : { stroke: color, strokeWidth: 2 },
                }}
              />
            );
          })}
        </GroupComp>
      </Chart>
    </div>
  );
};

const Visualization: React.FC<{ data: VisualizationProps }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  if (data.queries && data.queries.length > 0) {
    const timespan = resolveTimespan(data.timespan);
    return (
      <>
        {data.summary && <DataTable columns={data.summary.columns} rows={data.summary.rows} />}
        <div className="ols-plugin__chat-chart-container">
          <QueryBrowser
            defaultTimespan={timespan ?? 30 * 60 * 1000}
            isStack={data.isStack}
            namespace={data.namespace}
            pollInterval={30000}
            queries={data.queries}
            showLegend={data.showLegend ?? true}
            units={data.units}
          />
        </div>
      </>
    );
  }

  if (!data.series?.length) {
    return <Alert isInline title={t('No queries or series data provided')} variant="warning" />;
  }

  return <StaticChart data={data} />;
};

// --- ResourceDiff ---

interface ResourceDiffProps {
  title: string;
  resourceKind?: string;
  resourceName?: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

const ResourceDiff: React.FC<{ data: ResourceDiffProps }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const beforeStr = JSON.stringify(data.before, null, 2);
  const afterStr = JSON.stringify(data.after, null, 2);

  return (
    <Card isCompact>
      <CardTitle>
        {data.title}
        {data.resourceKind && data.resourceName && (
          <Label className="ols-plugin__chat-diff-resource-label" color="blue" isCompact>
            {data.resourceKind}/{data.resourceName}
          </Label>
        )}
      </CardTitle>
      <CardBody>
        <Split hasGutter>
          <SplitItem isFilled>
            <div className="ols-plugin__chat-diff-label ols-plugin__chat-diff-label--before">
              {t('Before')}
            </div>
            <CodeBlock>
              <CodeBlockCode>{beforeStr}</CodeBlockCode>
            </CodeBlock>
          </SplitItem>
          <SplitItem isFilled>
            <div className="ols-plugin__chat-diff-label ols-plugin__chat-diff-label--after">
              {t('After')}
            </div>
            <CodeBlock>
              <CodeBlockCode>{afterStr}</CodeBlockCode>
            </CodeBlock>
          </SplitItem>
        </Split>
      </CardBody>
    </Card>
  );
};

// --- ActionPicker ---

interface ActionPickerOption {
  id: string;
  label: string;
  description: string;
  risk?: string;
}

interface ActionPickerProps {
  title: string;
  description?: string;
  options: ActionPickerOption[];
}

const ActionPicker: React.FC<{
  data: ActionPickerProps;
  onAction?: (_action: string, _data: Record<string, unknown>) => void;
}> = ({ data, onAction }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [selected, setSelected] = React.useState<string | null>(null);

  return (
    <Card isCompact>
      <CardTitle>{data.title}</CardTitle>
      <CardBody>
        {data.description && (
          <p className="ols-plugin__chat-action-description">{data.description}</p>
        )}
        <Stack hasGutter>
          {data.options.map((opt) => (
            <StackItem key={opt.id}>
              <div
                className={`ols-plugin__chat-action-option ${selected === opt.id ? 'ols-plugin__chat-action-option--selected' : ''}`}
                onClick={() => setSelected(opt.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelected(opt.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Split>
                  <SplitItem isFilled>
                    <strong>{opt.label}</strong>
                    <div className="ols-plugin__chat-action-option-desc">{opt.description}</div>
                  </SplitItem>
                  {opt.risk && (
                    <SplitItem>
                      <Label color={getRiskColor(opt.risk)} isCompact>
                        {t('{{risk}} risk', { risk: opt.risk })}
                      </Label>
                    </SplitItem>
                  )}
                </Split>
              </div>
            </StackItem>
          ))}
          {selected && onAction && (
            <StackItem>
              <Button
                onClick={() => {
                  const opt = data.options.find((o) => o.id === selected);
                  if (opt) {
                    onAction('action_selected', {
                      optionId: opt.id,
                      label: opt.label,
                      message: `I'd like to go with: ${opt.label} — ${opt.description}`,
                    });
                  }
                }}
                variant="primary"
              >
                {t('Select this approach')}
              </Button>
            </StackItem>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};

// --- EvidenceTable ---

interface EvidenceTableProps {
  title: string;
  columns: string[];
  rows: string[][];
}

const EvidenceTable: React.FC<{ data: EvidenceTableProps }> = ({ data }) => (
  <Card isCompact>
    <CardTitle>{data.title}</CardTitle>
    <CardBody className="ols-plugin__chat-evidence-body">
      <DataTable columns={data.columns} monoFirstColumn rows={data.rows} />
    </CardBody>
  </Card>
);

// --- StatusTimeline ---

interface TimelineEvent {
  time: string;
  label: string;
  status: 'success' | 'danger' | 'warning' | 'info';
}

interface StatusTimelineProps {
  title: string;
  events: TimelineEvent[];
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircleIcon className="ols-plugin__chat-icon--success" />;
    case 'danger':
      return <ExclamationCircleIcon className="ols-plugin__chat-icon--danger" />;
    default:
      return <InfoCircleIcon className="ols-plugin__chat-icon--info" />;
  }
};

const StatusTimeline: React.FC<{ data: StatusTimelineProps }> = ({ data }) => (
  <Card isCompact>
    <CardTitle>{data.title}</CardTitle>
    <CardBody>
      {data.events.map((event, i) => (
        <div className="ols-plugin__chat-timeline-event" key={i}>
          <div className="ols-plugin__chat-timeline-icon">{statusIcon(event.status)}</div>
          <div>
            <span className="ols-plugin__chat-timeline-time">{event.time}</span>
            <span className="ols-plugin__chat-timeline-label">{event.label}</span>
          </div>
        </div>
      ))}
    </CardBody>
  </Card>
);

// --- RevisedProposal ---

interface RevisedProposalAction {
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

interface RevisedProposalProps {
  description: string;
  actions: RevisedProposalAction[];
  risk: string;
  reversible: boolean;
  estimatedImpact?: string;
}

const RevisedProposal: React.FC<{
  data: RevisedProposalProps;
  onAction?: (_action: string, _data: Record<string, unknown>) => void;
}> = ({ data, onAction }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <Card isCompact>
      <CardTitle>
        <Split>
          <SplitItem isFilled>{t('Revised Proposal')}</SplitItem>
          <SplitItem>
            <Label color={getRiskColor(data.risk)} isCompact>
              {t('{{risk}} risk', { risk: data.risk })}
            </Label>
          </SplitItem>
        </Split>
      </CardTitle>
      <CardBody>
        <Stack hasGutter>
          <StackItem>{data.description}</StackItem>
          <StackItem>
            <strong className="ols-plugin__chat-revised-heading">{t('Actions:')}</strong>
            {data.actions.map((action, i) => (
              <div className="ols-plugin__chat-revised-action" key={i}>
                <Label color="blue" isCompact>
                  {action.type}
                </Label>{' '}
                {action.description}
                {action.resource && (
                  <div className="ols-plugin__chat-revised-resource">
                    {action.resource.kind}/
                    {action.resource.namespace ? `${action.resource.namespace}/` : ''}
                    {action.resource.name}
                  </div>
                )}
              </div>
            ))}
          </StackItem>
          <StackItem>
            <Split hasGutter>
              <SplitItem>
                <span className="ols-plugin__chat-revised-meta">
                  {t('Reversible:')} <strong>{data.reversible ? t('Yes') : t('No')}</strong>
                </span>
              </SplitItem>
              {data.estimatedImpact && (
                <SplitItem>
                  <span className="ols-plugin__chat-revised-meta">
                    {t('Impact:')} <strong>{data.estimatedImpact}</strong>
                  </span>
                </SplitItem>
              )}
            </Split>
          </StackItem>
          {onAction && (
            <StackItem>
              <Alert
                isInline
                isPlain
                title={t('This will replace the current proposal.')}
                variant="info"
              />
              <Button
                className="ols-plugin__chat-apply-button"
                onClick={() => onAction('apply_proposal', { proposal: data })}
                variant="primary"
              >
                {t('Apply as Proposal')}
              </Button>
            </StackItem>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};

// --- RevisedVerification ---

interface RevisedVerificationProps {
  description: string;
  steps: VerificationStep[];
  rollbackPlan: { description: string; command: string } | string;
}

const RevisedVerification: React.FC<{
  data: RevisedVerificationProps;
  onAction?: (_action: string, _data: Record<string, unknown>) => void;
}> = ({ data, onAction }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <Card isCompact>
      <CardTitle>{t('Revised Verification Plan')}</CardTitle>
      <CardBody>
        <Stack hasGutter>
          <StackItem>{data.description}</StackItem>
          <StackItem>
            <strong className="ols-plugin__chat-revised-heading">{t('Steps:')}</strong>
            {data.steps.map((step, i) => (
              <div className="ols-plugin__chat-revised-action" key={i}>
                <Label color="blue" isCompact>
                  {step.name}
                </Label>
                <CodeBlock className="ols-plugin__chat-revised-code">
                  <CodeBlockCode>{step.command}</CodeBlockCode>
                </CodeBlock>
                <span className="ols-plugin__chat-revised-meta">
                  {t('Expected:')} <strong>{step.expected}</strong>
                </span>
              </div>
            ))}
          </StackItem>
          <StackItem>
            <strong className="ols-plugin__chat-revised-heading">{t('Rollback:')}</strong>
            {typeof data.rollbackPlan === 'string' ? (
              <p>{data.rollbackPlan}</p>
            ) : (
              <>
                <p>{data.rollbackPlan.description}</p>
                <CodeBlock className="ols-plugin__chat-revised-code">
                  <CodeBlockCode>{data.rollbackPlan.command}</CodeBlockCode>
                </CodeBlock>
              </>
            )}
          </StackItem>
          {onAction && (
            <StackItem>
              <Alert
                isInline
                isPlain
                title={t('This will update the verification plan on the proposal.')}
                variant="info"
              />
              <Button
                className="ols-plugin__chat-apply-button"
                onClick={() => onAction('apply_verification', { verification: data })}
                variant="primary"
              >
                {t('Apply Verification Plan')}
              </Button>
            </StackItem>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};

// --- RevisedRbac ---

interface RevisedRbacProps {
  namespaceScoped: PermissionRule[];
  clusterScoped: PermissionRule[];
}

const RevisedRbac: React.FC<{
  data: RevisedRbacProps;
  onAction?: (_action: string, _data: Record<string, unknown>) => void;
}> = ({ data, onAction }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const renderRules = (rules: PermissionRule[], scoped: boolean) =>
    rules.map((rule, i) => (
      <div className="ols-plugin__chat-revised-action" key={i}>
        <Split hasGutter>
          <SplitItem>
            <Label color="blue" isCompact>
              {scoped ? rule.namespace || '*' : t('cluster')}
            </Label>
          </SplitItem>
          <SplitItem isFilled>
            <strong>{rule.resources.join(', ')}</strong>
            <span className="ols-plugin__chat-revised-meta"> ({rule.verbs.join(', ')})</span>
          </SplitItem>
        </Split>
        <div className="ols-plugin__chat-revised-meta">{rule.justification}</div>
      </div>
    ));

  return (
    <Card isCompact>
      <CardTitle>{t('Revised RBAC Permissions')}</CardTitle>
      <CardBody>
        <Stack hasGutter>
          {data.namespaceScoped.length > 0 && (
            <StackItem>
              <strong className="ols-plugin__chat-revised-heading">{t('Namespace-scoped:')}</strong>
              {renderRules(data.namespaceScoped, true)}
            </StackItem>
          )}
          {data.clusterScoped.length > 0 && (
            <StackItem>
              <strong className="ols-plugin__chat-revised-heading">{t('Cluster-scoped:')}</strong>
              {renderRules(data.clusterScoped, false)}
            </StackItem>
          )}
          {onAction && (
            <StackItem>
              <Alert
                isInline
                isPlain
                title={t('This will update the RBAC permissions on the proposal.')}
                variant="info"
              />
              <Button
                className="ols-plugin__chat-apply-button"
                onClick={() => onAction('apply_rbac', { rbac: data })}
                variant="primary"
              >
                {t('Apply RBAC Permissions')}
              </Button>
            </StackItem>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};

// --- CMO Alert Diagnosis ---

interface CmoAlertDiagnosisProps {
  alertName: string;
  severity: string;
  component: string;
  rootCause: string;
  evidence?: string[];
  affectedResources?: string[];
  impact?: string;
}

const severityColor = (severity: string): 'red' | 'orange' | 'blue' => {
  switch (severity) {
    case 'blocker':
      return 'red';
    case 'warning':
      return 'orange';
    default:
      return 'blue';
  }
};

const CmoAlertDiagnosis: React.FC<{ data: CmoAlertDiagnosisProps }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <Card isCompact>
      <CardTitle>
        <Split hasGutter>
          <SplitItem isFilled>{t('Alert Diagnosis: {{name}}', { name: data.alertName })}</SplitItem>
          <SplitItem>
            <Label color={severityColor(data.severity)} isCompact>
              {data.severity}
            </Label>
          </SplitItem>
          <SplitItem>
            <Label color="blue" isCompact>
              {data.component}
            </Label>
          </SplitItem>
        </Split>
      </CardTitle>
      <CardBody>
        <Stack hasGutter>
          <StackItem>
            <strong>{t('Root Cause')}</strong>
            <p>{data.rootCause}</p>
          </StackItem>
          {data.evidence && data.evidence.length > 0 && (
            <StackItem>
              <strong>{t('Evidence')}</strong>
              <ul>
                {data.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </StackItem>
          )}
          {data.affectedResources && data.affectedResources.length > 0 && (
            <StackItem>
              <strong>{t('Affected Resources')}</strong>
              <ul>
                {data.affectedResources.map((r, i) => (
                  <li key={i}>
                    <code>{r}</code>
                  </li>
                ))}
              </ul>
            </StackItem>
          )}
          {data.impact && (
            <StackItem>
              <strong>{t('Impact')}</strong>
              <p>{data.impact}</p>
            </StackItem>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};

// --- CMO Metric Evidence ---

interface CmoMetricEvidenceProps {
  query: string;
  description: string;
  value: string;
  threshold?: string;
  status: string;
}

const metricStatusVariant = (status: string): 'danger' | 'warning' | 'success' => {
  switch (status) {
    case 'critical':
      return 'danger';
    case 'warning':
      return 'warning';
    default:
      return 'success';
  }
};

const CmoMetricEvidence: React.FC<{ data: CmoMetricEvidenceProps }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <Alert isInline title={data.description} variant={metricStatusVariant(data.status)}>
      <Split hasGutter>
        <SplitItem>
          <strong>{t('Value:')}</strong> {data.value}
        </SplitItem>
        {data.threshold && (
          <SplitItem>
            <strong>{t('Expected:')}</strong> {data.threshold}
          </SplitItem>
        )}
      </Split>
      <CodeBlock className="ols-plugin__chat-revised-code">
        <CodeBlockCode>{data.query}</CodeBlockCode>
      </CodeBlock>
    </Alert>
  );
};

// --- CMO Remediation Step ---

interface CmoRemediationStepProps {
  order: number;
  action: string;
  command?: string;
  verifyCommand?: string;
  risk: string;
}

const CmoRemediationStep: React.FC<{ data: CmoRemediationStepProps }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <Card isCompact>
      <CardTitle>
        <Split hasGutter>
          <SplitItem>
            <Label color="blue" isCompact>
              {t('Step {{order}}', { order: data.order })}
            </Label>
          </SplitItem>
          <SplitItem isFilled>{data.action}</SplitItem>
          <SplitItem>
            <Label color={getRiskColor(data.risk)} isCompact>
              {t('{{risk}} risk', { risk: data.risk })}
            </Label>
          </SplitItem>
        </Split>
      </CardTitle>
      {(data.command || data.verifyCommand) && (
        <CardBody>
          <Stack hasGutter>
            {data.command && (
              <StackItem>
                <CodeBlock>
                  <CodeBlockCode>{data.command}</CodeBlockCode>
                </CodeBlock>
              </StackItem>
            )}
            {data.verifyCommand && (
              <StackItem>
                <strong>{t('Verify:')}</strong>
                <CodeBlock>
                  <CodeBlockCode>{data.verifyCommand}</CodeBlockCode>
                </CodeBlock>
              </StackItem>
            )}
          </Stack>
        </CardBody>
      )}
    </Card>
  );
};

// --- CMO Trigger Proposal ---

interface CmoTriggerProposalProps {
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

const PrometheusRuleModel = {
  apiGroup: 'monitoring.coreos.com',
  apiVersion: 'v1',
  kind: 'PrometheusRule',
  plural: 'prometheusrules',
  namespaced: true,
  abbr: 'PR',
  label: 'PrometheusRule',
  labelPlural: 'PrometheusRules',
};

const sanitizeK8sName = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/-+$/, '');

const buildPrometheusRule = (data: CmoTriggerProposalProps) => ({
  apiVersion: 'monitoring.coreos.com/v1',
  kind: 'PrometheusRule',
  metadata: {
    name: sanitizeK8sName(data.alertName),
    namespace: data.namespace || 'openshift-monitoring',
    labels: {
      'app.kubernetes.io/managed-by': 'lightspeed',
      'ols.openshift.io/trigger': 'true',
    },
  },
  spec: {
    groups: [
      {
        name: `lightspeed-${sanitizeK8sName(data.alertName)}`,
        rules: [
          {
            alert: data.alertName,
            expr: data.expr,
            for: data.for,
            labels: { severity: data.severity },
            annotations: {
              description: data.description,
              ...(data.runbook ? { runbook: data.runbook } : {}),
            },
          },
        ],
      },
    ],
  },
});

const CmoTriggerProposal: React.FC<{ data: CmoTriggerProposalProps }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [creating, setCreating] = React.useState(false);
  const [created, setCreated] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      await k8sCreate({ model: PrometheusRuleModel, data: buildPrometheusRule(data) });
      setCreated(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="ols-plugin__trigger-option">
      <Stack hasGutter>
        <StackItem>{data.summary}</StackItem>
        <StackItem>
          <Split hasGutter>
            <SplitItem>
              <Label color={data.severity === 'critical' ? 'red' : 'orange'} isCompact>
                {data.severity}
              </Label>
            </SplitItem>
            <SplitItem>
              <Label color="grey" isCompact>
                for: {data.for}
              </Label>
            </SplitItem>
            <SplitItem>
              <Label color={data.queryTested ? 'green' : 'red'} isCompact>
                {data.queryTested ? t('Query tested') : t('Query NOT tested')}
              </Label>
            </SplitItem>
          </Split>
        </StackItem>
        <StackItem>
          <strong>{t('PromQL')}</strong>
          <CodeBlock>
            <CodeBlockCode>{data.expr}</CodeBlockCode>
          </CodeBlock>
        </StackItem>
        <StackItem>
          <Alert
            isInline
            title={t('Test Result')}
            variant={data.queryTested ? 'success' : 'danger'}
          >
            {data.queryTestResult}
          </Alert>
        </StackItem>
        <StackItem>{data.description}</StackItem>
        <StackItem>
          {created ? (
            <Alert isInline title={t('Alert rule created successfully')} variant="success">
              <Button
                component="a"
                href={`/k8s/ns/${data.namespace || 'openshift-monitoring'}/monitoring.coreos.com~v1~PrometheusRule/${sanitizeK8sName(data.alertName)}`}
                variant="link"
              >
                {t('View {{name}}', { name: data.alertName })}
              </Button>
            </Alert>
          ) : (
            <>
              {error && (
                <Alert isInline title={t('Failed to create alert rule')} variant="danger">
                  {error}
                </Alert>
              )}
              <Button
                isDisabled={creating || !data.queryTested}
                isLoading={creating}
                onClick={handleCreate}
                variant="primary"
              >
                {t('Create alert rule')}
              </Button>
            </>
          )}
        </StackItem>
      </Stack>
    </div>
  );
};

// --- Component Registry ---

const DynamicComponent: React.FC<DynamicComponentProps> = ({ type, props, onAction }) => {
  switch (type) {
    case 'visualization':
    case 'prometheus_query':
    case 'metrics_chart':
    case 'lightspeed_prometheus_query':
    case 'lightspeed_metrics_chart':
      return <Visualization data={props as unknown as VisualizationProps} />;
    case 'resource_diff':
    case 'lightspeed_resource_diff':
      return <ResourceDiff data={props as unknown as ResourceDiffProps} />;
    case 'action_picker':
    case 'lightspeed_action_picker':
      return <ActionPicker data={props as unknown as ActionPickerProps} onAction={onAction} />;
    case 'evidence_table':
    case 'lightspeed_evidence_table':
      return <EvidenceTable data={props as unknown as EvidenceTableProps} />;
    case 'status_timeline':
    case 'lightspeed_status_timeline':
      return <StatusTimeline data={props as unknown as StatusTimelineProps} />;
    case 'revised_proposal':
    case 'lightspeed_revised_proposal':
      return (
        <RevisedProposal data={props as unknown as RevisedProposalProps} onAction={onAction} />
      );
    case 'revised_verification':
    case 'lightspeed_revised_verification':
      return (
        <RevisedVerification
          data={props as unknown as RevisedVerificationProps}
          onAction={onAction}
        />
      );
    case 'revised_rbac':
    case 'lightspeed_revised_rbac':
      return <RevisedRbac data={props as unknown as RevisedRbacProps} onAction={onAction} />;
    case 'cmo_alert_diagnosis':
      return <CmoAlertDiagnosis data={props as unknown as CmoAlertDiagnosisProps} />;
    case 'cmo_metric_evidence':
      return <CmoMetricEvidence data={props as unknown as CmoMetricEvidenceProps} />;
    case 'cmo_remediation_step':
      return <CmoRemediationStep data={props as unknown as CmoRemediationStepProps} />;
    case 'cmo_trigger_proposal':
      return <CmoTriggerProposal data={props as unknown as CmoTriggerProposalProps} />;
    default:
      return (
        <Card isCompact>
          <CardBody>
            <Alert isInline title={`Unknown component: ${type}`} variant="warning" />
            <CodeBlock>
              <CodeBlockCode>{JSON.stringify(props, null, 2)}</CodeBlockCode>
            </CodeBlock>
          </CardBody>
        </Card>
      );
  }
};

export default DynamicComponent;
