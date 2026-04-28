import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, CardBody, CardTitle, CodeBlock, CodeBlockCode, Label, Split, SplitItem, Stack, StackItem } from '@patternfly/react-core';
import { k8sCreate } from '@openshift-console/dynamic-plugin-sdk';
import { getRiskColor } from '../../../models/proposal';
import type { CmoAlertDiagnosisProps, CmoMetricEvidenceProps, CmoRemediationStepProps, CmoTriggerProposalProps } from './types';
import { sanitizeK8sName, severityColor } from './utils';

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

const buildPrometheusRule = (data: CmoTriggerProposalProps) => ({
  apiVersion: 'monitoring.coreos.com/v1',
  kind: 'PrometheusRule',
  metadata: {
    name: sanitizeK8sName(data.alertName),
    namespace: data.namespace || 'openshift-monitoring',
    labels: { 'app.kubernetes.io/managed-by': 'lightspeed', 'ols.openshift.io/trigger': 'true' },
  },
  spec: {
    groups: [{
      name: `lightspeed-${sanitizeK8sName(data.alertName)}`,
      rules: [{
        alert: data.alertName,
        expr: data.expr,
        for: data.for,
        labels: { severity: data.severity },
        annotations: { description: data.description, ...(data.runbook ? { runbook: data.runbook } : {}) },
      }],
    }],
  },
});

export const CmoAlertDiagnosis: React.FC<{ data: CmoAlertDiagnosisProps }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <Card isCompact>
      <CardTitle>
        <Split hasGutter>
          <SplitItem isFilled>{t('Alert Diagnosis: {{name}}', { name: data.alertName })}</SplitItem>
          <SplitItem><Label color={severityColor(data.severity)} isCompact>{data.severity}</Label></SplitItem>
          <SplitItem><Label color="blue" isCompact>{data.component}</Label></SplitItem>
        </Split>
      </CardTitle>
      <CardBody>
        <Stack hasGutter>
          <StackItem><strong>{t('Root Cause')}</strong><p>{data.rootCause}</p></StackItem>
          {data.evidence && data.evidence.length > 0 && (
            <StackItem><strong>{t('Evidence')}</strong><ul>{data.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul></StackItem>
          )}
          {data.affectedResources && data.affectedResources.length > 0 && (
            <StackItem><strong>{t('Affected Resources')}</strong><ul>{data.affectedResources.map((r, i) => <li key={i}><code>{r}</code></li>)}</ul></StackItem>
          )}
          {data.impact && <StackItem><strong>{t('Impact')}</strong><p>{data.impact}</p></StackItem>}
        </Stack>
      </CardBody>
    </Card>
  );
};

const metricStatusVariant = (status: string): 'danger' | 'warning' | 'success' => {
  switch (status) {
    case 'critical': return 'danger';
    case 'warning': return 'warning';
    default: return 'success';
  }
};

export const CmoMetricEvidence: React.FC<{ data: CmoMetricEvidenceProps }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <Alert isInline title={data.description} variant={metricStatusVariant(data.status)}>
      <Split hasGutter>
        <SplitItem><strong>{t('Value:')}</strong> {data.value}</SplitItem>
        {data.threshold && <SplitItem><strong>{t('Expected:')}</strong> {data.threshold}</SplitItem>}
      </Split>
      <CodeBlock className="ols-plugin__chat-revised-code"><CodeBlockCode>{data.query}</CodeBlockCode></CodeBlock>
    </Alert>
  );
};

export const CmoRemediationStep: React.FC<{ data: CmoRemediationStepProps }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <Card isCompact>
      <CardTitle>
        <Split hasGutter>
          <SplitItem><Label color="blue" isCompact>{t('Step {{order}}', { order: data.order })}</Label></SplitItem>
          <SplitItem isFilled>{data.action}</SplitItem>
          <SplitItem><Label color={getRiskColor(data.risk)} isCompact>{t('{{risk}} risk', { risk: data.risk })}</Label></SplitItem>
        </Split>
      </CardTitle>
      {(data.command || data.verifyCommand) && (
        <CardBody>
          <Stack hasGutter>
            {data.command && <StackItem><CodeBlock><CodeBlockCode>{data.command}</CodeBlockCode></CodeBlock></StackItem>}
            {data.verifyCommand && <StackItem><strong>{t('Verify:')}</strong><CodeBlock><CodeBlockCode>{data.verifyCommand}</CodeBlockCode></CodeBlock></StackItem>}
          </Stack>
        </CardBody>
      )}
    </Card>
  );
};

export const CmoTriggerProposal: React.FC<{ data: CmoTriggerProposalProps }> = ({ data }) => {
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
            <SplitItem><Label color={data.severity === 'critical' ? 'red' : 'orange'} isCompact>{data.severity}</Label></SplitItem>
            <SplitItem><Label color="grey" isCompact>for: {data.for}</Label></SplitItem>
            <SplitItem><Label color={data.queryTested ? 'green' : 'red'} isCompact>{data.queryTested ? t('Query tested') : t('Query NOT tested')}</Label></SplitItem>
          </Split>
        </StackItem>
        <StackItem><strong>{t('PromQL')}</strong><CodeBlock><CodeBlockCode>{data.expr}</CodeBlockCode></CodeBlock></StackItem>
        <StackItem><Alert isInline title={t('Test Result')} variant={data.queryTested ? 'success' : 'danger'}>{data.queryTestResult}</Alert></StackItem>
        <StackItem>{data.description}</StackItem>
        <StackItem>
          {created ? (
            <Alert isInline title={t('Alert rule created successfully')} variant="success">
              <Button component="a" href={`/k8s/ns/${data.namespace || 'openshift-monitoring'}/monitoring.coreos.com~v1~PrometheusRule/${sanitizeK8sName(data.alertName)}`} variant="link">
                {t('View {{name}}', { name: data.alertName })}
              </Button>
            </Alert>
          ) : (
            <>
              {error && <Alert isInline title={t('Failed to create alert rule')} variant="danger">{error}</Alert>}
              <Button isDisabled={creating || !data.queryTested} isLoading={creating} onClick={handleCreate} variant="primary">{t('Create alert rule')}</Button>
            </>
          )}
        </StackItem>
      </Stack>
    </div>
  );
};
