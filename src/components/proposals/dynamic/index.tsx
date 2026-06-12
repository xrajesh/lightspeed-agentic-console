import * as React from 'react';
import { Alert, Card, CardBody, CodeBlock, CodeBlockCode } from '@patternfly/react-core';

import './dynamic-components.css';

import type {
  ActionPickerProps,
  CmoAlertDiagnosisProps,
  CmoMetricEvidenceProps,
  CmoRemediationStepProps,
  CmoTriggerProposalProps,
  DynamicComponentProps,
  EvidenceTableProps,
  ResourceDiffProps,
  StatusTimelineProps,
  VisualizationProps,
} from './types';

import { Visualization } from './Visualization';
import { ResourceDiff } from './ResourceDiff';
import { ActionPicker } from './ActionPicker';
import { EvidenceTable } from './EvidenceTable';
import { StatusTimeline } from './StatusTimeline';
import {
  CmoAlertDiagnosis,
  CmoMetricEvidence,
  CmoRemediationStep,
  CmoTriggerProposal,
} from './CmoComponents';

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
