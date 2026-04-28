import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  consoleFetch,
  k8sPatch,
  K8sResourceCommon,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  CodeBlock,
  CodeBlockCode,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Dropdown,
  DropdownItem,
  DropdownList,
  ExpandableSection,
  Flex,
  FlexItem,
  Label,
  PageSection,
  Stack,
  StackItem,
  Title,
} from '@patternfly/react-core';

import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExternalLinkAltIcon,
} from '@patternfly/react-icons';

import {
  AdapterComponent,
  ExecutionStepStatus,
  getPhaseDisplay,
  getRiskColor,
  LightspeedProposal,
  LightspeedProposalModel,
  PermissionRule,
  PreviousAttempt,
  RemediationOption,
  SandboxInfo,
} from '../../models/proposal';
import { MarkdownText } from './ChatMessage';
import DynamicComponent from './DynamicComponent';
import EscalateModal from './EscalateModal';
import PhaseIcon from './PhaseIcon';
import RefineChat from './RefineChat';
import SandboxLogViewer from './SandboxLogViewer';

import './proposal-detail.css';

const KNOWN_COMPONENT_TYPES = new Set([
  'lightspeed_prometheus_query',
  'lightspeed_metrics_chart',
  'lightspeed_resource_diff',
  'lightspeed_action_picker',
  'lightspeed_evidence_table',
  'lightspeed_status_timeline',
  'lightspeed_revised_proposal',
  'lightspeed_revised_verification',
  'lightspeed_revised_rbac',
  'cmo_alert_diagnosis',
  'cmo_metric_evidence',
  'cmo_remediation_step',
  'cmo_trigger_proposal',
]);

const AdapterComponents: React.FC<{ components?: AdapterComponent[] }> = ({ components }) => {
  if (!components?.length) {
    return null;
  }
  return (
    <Stack hasGutter>
      {components.map((comp, i) => (
        <StackItem key={i}>
          {KNOWN_COMPONENT_TYPES.has(comp.type) ? (
            <DynamicComponent props={comp} type={comp.type} />
          ) : (
            <Card isCompact>
              <CardBody>
                <CodeBlock>
                  <CodeBlockCode>{JSON.stringify(comp, null, 2)}</CodeBlockCode>
                </CodeBlock>
              </CardBody>
            </Card>
          )}
        </StackItem>
      ))}
    </Stack>
  );
};

/** Auto-collapse a log viewer section once data arrives for the first time. */
function useAutoCollapseLogs(hasData: boolean): [boolean, (_v: boolean) => void] {
  const [expanded, setExpanded] = React.useState(true);
  const prevRef = React.useRef(hasData);
  React.useEffect(() => {
    if (hasData && !prevRef.current) {
      setExpanded(false);
    }
    prevRef.current = hasData;
  }, [hasData]);
  return [expanded, setExpanded];
}

const CONFIRM_RESET_MS = 5000;
const MAX_RETRIES = 20;
const RETRY_OPTIONS = Array.from({ length: MAX_RETRIES }, (_, i) => i + 1);

const useApprovalActions = (proposal?: LightspeedProposal) => {
  const [inProgress, setInProgress] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleApproval = React.useCallback(
    async (approved: boolean, maxAttempts?: number, optionIndex?: number) => {
      if (!proposal) {
        return;
      }
      setInProgress(true);
      setError(null);
      try {
        // Patch spec (maxAttempts) via the main resource endpoint
        if (approved && maxAttempts !== undefined && maxAttempts > 0) {
          await k8sPatch({
            data: [
              {
                op: proposal.spec.maxAttempts === undefined ? 'add' : 'replace',
                path: '/spec/maxAttempts',
                value: maxAttempts,
              },
            ],
            model: LightspeedProposalModel,
            resource: proposal,
          });
        }

        // Patch status via the status subresource
        const now = new Date().toISOString();
        const conditionValue = {
          lastTransitionTime: now,
          message: approved
            ? 'Proposal approved by user via console'
            : 'Proposal denied by user via console',
          reason: approved ? 'ApprovedViaConsole' : 'DeniedViaConsole',
          status: approved ? 'True' : 'False',
          type: 'Approved',
        };
        const statusPatches: Array<{ op: string; path: string; value: unknown }> = [
          { op: 'replace', path: '/status/phase', value: approved ? 'Approved' : 'Denied' },
          proposal.status?.conditions?.length
            ? { op: 'add', path: '/status/conditions/-', value: conditionValue }
            : { op: 'add', path: '/status/conditions', value: [conditionValue] },
        ];
        if (approved && optionIndex !== undefined) {
          statusPatches.push({
            op: proposal.status?.steps?.analysis?.selectedOption === undefined ? 'add' : 'replace',
            path: '/status/steps/analysis/selectedOption',
            value: optionIndex,
          });
        }

        const { name, namespace } = proposal.metadata;
        const statusUrl = `/api/kubernetes/apis/${LightspeedProposalModel.apiGroup}/${LightspeedProposalModel.apiVersion}/namespaces/${namespace}/${LightspeedProposalModel.plural}/${name}/status`;
        const response = await consoleFetch(statusUrl, {
          body: JSON.stringify(statusPatches),
          headers: { 'Content-Type': 'application/json-patch+json' },
          method: 'PATCH',
        });
        if (!(response as Response).ok) {
          throw new Error(`Status update failed: ${(response as Response).statusText}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update proposal');
      } finally {
        setInProgress(false);
      }
    },
    [proposal],
  );

  return {
    approve: React.useCallback(
      (maxAttempts?: number, optionIndex?: number) =>
        handleApproval(true, maxAttempts, optionIndex),
      [handleApproval],
    ),
    clearError: React.useCallback(() => setError(null), []),
    deny: React.useCallback(() => handleApproval(false), [handleApproval]),
    error,
    inProgress,
  };
};

const SandboxDisplay: React.FC<{ label: string; sandbox?: SandboxInfo }> = ({ label, sandbox }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  if (!sandbox?.claimName) {
    return null;
  }
  return (
    <DescriptionListGroup>
      <DescriptionListTerm>{label}</DescriptionListTerm>
      <DescriptionListDescription>
        {sandbox.claimName}
        {sandbox.namespace && ` (${sandbox.namespace})`}
        {sandbox.startedAt && (
          <div className="ols-plugin__proposal-sandbox-info">
            {t('Started')}: {new Date(sandbox.startedAt).toLocaleString()}
          </div>
        )}
        {sandbox.completedAt && (
          <div>
            {t('Completed')}: {new Date(sandbox.completedAt).toLocaleString()}
          </div>
        )}
      </DescriptionListDescription>
    </DescriptionListGroup>
  );
};

const PreviousAttemptsSection: React.FC<{ attempts: PreviousAttempt[] }> = ({ attempts }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <Stack hasGutter>
      {attempts.map((a) => (
        <StackItem key={a.attempt}>
          <ExpandableSection
            toggleText={`${t('Attempt')} ${a.attempt}${a.failedPhase ? ` — ${t('failed at')} ${a.failedPhase}` : ''}`}
          >
            <div className="ols-plugin__proposal-attempt">
              <DescriptionList isCompact isHorizontal>
                {a.failureReason && (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Failure Reason')}</DescriptionListTerm>
                    <DescriptionListDescription>{a.failureReason}</DescriptionListDescription>
                  </DescriptionListGroup>
                )}
              </DescriptionList>
            </div>
          </ExpandableSection>
        </StackItem>
      ))}
    </Stack>
  );
};

const OverviewTab: React.FC<{ proposal: LightspeedProposal }> = ({ proposal }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const phase = getPhaseDisplay(proposal.status?.phase);
  const attempts = proposal.status?.previousAttempts;
  const workflowOverride = proposal.spec.workflowOverride;
  const sourceUrl = proposal.metadata.annotations?.['ols.openshift.io/source-url'];
  const sourceName = proposal.metadata.annotations?.['ols.openshift.io/source-name'] || t('Source');

  return (
    <Stack className="ols-plugin__proposal-tab-content" hasGutter>
      <StackItem>
        <Card>
          <CardTitle>{t('Details')}</CardTitle>
          <CardBody>
            <DescriptionList isHorizontal>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Phase')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <Flex
                    alignItems={{ default: 'alignItemsCenter' }}
                    spaceItems={{ default: 'spaceItemsSm' }}
                  >
                    <FlexItem>
                      <PhaseIcon phase={proposal.status?.phase} />
                    </FlexItem>
                    <FlexItem>
                      <Label color={phase.color}>{phase.label}</Label>
                    </FlexItem>
                  </Flex>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Workflow')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <Label color="blue">{proposal.spec.workflow}</Label>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Request')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <MarkdownText content={proposal.spec.request} />
                </DescriptionListDescription>
              </DescriptionListGroup>
              {sourceUrl && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Source')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Button
                      component="a"
                      href={sourceUrl}
                      icon={<ExternalLinkAltIcon />}
                      iconPosition="end"
                      isInline
                      rel="noopener noreferrer"
                      target="_blank"
                      variant="link"
                    >
                      {sourceName}
                    </Button>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {proposal.spec.targetNamespaces && proposal.spec.targetNamespaces.length > 0 && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Target Namespaces')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {proposal.spec.targetNamespaces.join(', ')}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {proposal.spec.parentRef && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Parent Proposal')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Link
                      to={`/lightspeed/proposals/${proposal.metadata.namespace}/${proposal.spec.parentRef}`}
                    >
                      {proposal.spec.parentRef}
                    </Link>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {(proposal.status?.attempt ?? 0) > 1 && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Attempt')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {proposal.status?.attempt}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {workflowOverride && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Workflow Override')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {workflowOverride.analysis?.skip && (
                      <Label color="teal" isCompact>
                        {t('Skip Analysis')}
                      </Label>
                    )}{' '}
                    {workflowOverride.execution?.skip && (
                      <Label color="teal" isCompact>
                        {t('Skip Execution')}
                      </Label>
                    )}{' '}
                    {workflowOverride.verification?.skip && (
                      <Label color="teal" isCompact>
                        {t('Skip Verification')}
                      </Label>
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Created')}</DescriptionListTerm>
                <DescriptionListDescription>
                  {proposal.metadata.creationTimestamp
                    ? new Date(proposal.metadata.creationTimestamp).toLocaleString()
                    : '-'}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <SandboxDisplay
                label={t('Analysis Sandbox')}
                sandbox={proposal.status?.steps?.analysis?.sandbox}
              />
              <SandboxDisplay
                label={t('Execution Sandbox')}
                sandbox={proposal.status?.steps?.execution?.sandbox}
              />
              <SandboxDisplay
                label={t('Verification Sandbox')}
                sandbox={proposal.status?.steps?.verification?.sandbox}
              />
            </DescriptionList>
          </CardBody>
        </Card>
      </StackItem>
      {attempts && attempts.length > 0 && (
        <StackItem>
          <Card>
            <CardTitle>{t('Previous Attempts')}</CardTitle>
            <CardBody>
              <PreviousAttemptsSection attempts={attempts} />
            </CardBody>
          </Card>
        </StackItem>
      )}
    </Stack>
  );
};

const confidenceColor = (c: string): 'green' | 'orange' | 'red' | 'grey' => {
  switch (c) {
    case 'high':
      return 'green';
    case 'medium':
      return 'orange';
    case 'low':
      return 'red';
    default:
      return 'grey';
  }
};

const stepTypeLabel = (type: string): string => {
  switch (type) {
    case 'command':
      return 'CLI';
    case 'metric':
      return 'Metric';
    case 'resource_check':
      return 'Resource';
    case 'log_check':
      return 'Log';
    case 'api_call':
      return 'API';
    default:
      return type;
  }
};

const PermissionRulesTable: React.FC<{ rules: PermissionRule[] }> = ({ rules }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  if (!rules || rules.length === 0) {
    return null;
  }
  return (
    <Stack hasGutter>
      {rules.map((rule, i) => (
        <StackItem key={i}>
          <Card isCompact isPlain>
            <CardBody>
              <DescriptionList isCompact isHorizontal>
                {rule.namespace && (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Namespace')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Label color="purple" isCompact>
                        {rule.namespace}
                      </Label>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                )}
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('API Groups')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {rule.apiGroups.map((g) => (
                      <Label className="ols-plugin__rbac-label" isCompact key={g}>
                        {g || '(core)'}
                      </Label>
                    ))}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Resources')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {rule.resources.map((r) => (
                      <Label className="ols-plugin__rbac-label" color="blue" isCompact key={r}>
                        {r}
                      </Label>
                    ))}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                {rule.resourceNames && rule.resourceNames.length > 0 && (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Resource Names')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {rule.resourceNames.map((n) => (
                        <Label className="ols-plugin__rbac-label" color="orange" isCompact key={n}>
                          {n}
                        </Label>
                      ))}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                )}
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Verbs')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {rule.verbs.map((v) => (
                      <Label className="ols-plugin__rbac-label" color="teal" isCompact key={v}>
                        {v}
                      </Label>
                    ))}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Justification')}</DescriptionListTerm>
                  <DescriptionListDescription>{rule.justification}</DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </CardBody>
          </Card>
        </StackItem>
      ))}
    </Stack>
  );
};

const RemediationOptionCard: React.FC<{ option: RemediationOption }> = ({ option }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const { diagnosis, proposal, rbac, verification } = option;
  const [highlight, setHighlight] = React.useState(false);
  const serialized = JSON.stringify(option);
  const prevRef = React.useRef(serialized);

  React.useEffect(() => {
    if (prevRef.current === serialized) {
      return;
    }
    prevRef.current = serialized;
    setHighlight(true);
    const timer = setTimeout(() => setHighlight(false), 1500);
    return () => clearTimeout(timer);
  }, [serialized]);

  return (
    <Stack className={highlight ? 'ols-plugin__proposal-updated' : undefined} hasGutter>
      {diagnosis && (
        <StackItem>
          <Card>
            <CardTitle>{t('Diagnosis')}</CardTitle>
            <CardBody>
              <DescriptionList isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Root Cause')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <MarkdownText content={diagnosis.rootCause} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Summary')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <MarkdownText content={diagnosis.summary} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Confidence')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Label color={confidenceColor(diagnosis.confidence)}>
                      {diagnosis.confidence}
                    </Label>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </CardBody>
          </Card>
        </StackItem>
      )}

      {proposal && (
        <StackItem>
          <Card>
            <CardTitle>
              <Flex>
                <FlexItem>{t('Proposed Remediation')}</FlexItem>
                <FlexItem>
                  <Label color={getRiskColor(proposal.risk)}>
                    {t('Risk: {{risk}}', { risk: proposal.risk })}
                  </Label>
                </FlexItem>
                <FlexItem>
                  <Label color={proposal.reversible ? 'green' : 'orange'}>
                    {proposal.reversible ? t('Reversible') : t('Not reversible')}
                  </Label>
                </FlexItem>
              </Flex>
            </CardTitle>
            <CardBody>
              <Stack hasGutter>
                <StackItem>
                  <Alert isInline isPlain title={t('Estimated plan')} variant="info">
                    <em>
                      {t(
                        "These actions reflect the agent's planned approach based on its analysis. During execution, the agent may follow this plan exactly or choose a more optimal path. The RBAC permissions below are locked at approval time and enforced by the Lightspeed operator on every execution attempt. The agent cannot escalate its own privileges.",
                      )}
                    </em>
                  </Alert>
                </StackItem>
                <StackItem>
                  <MarkdownText content={proposal.description} />
                </StackItem>
                {proposal.actions?.length > 0 && (
                  <StackItem>
                    <Title headingLevel="h4">{t('Actions')}</Title>
                    <Stack hasGutter>
                      {proposal.actions.map((action, i) => (
                        <StackItem key={i}>
                          <Card isCompact isPlain>
                            <CardBody>
                              <Flex>
                                <FlexItem>
                                  <Label isCompact>{action.type}</Label>
                                </FlexItem>
                                <FlexItem flex={{ default: 'flex_1' }}>
                                  {action.description}
                                </FlexItem>
                              </Flex>
                            </CardBody>
                          </Card>
                        </StackItem>
                      ))}
                    </Stack>
                  </StackItem>
                )}
              </Stack>
            </CardBody>
          </Card>
        </StackItem>
      )}

      {rbac && (rbac.namespaceScoped?.length > 0 || rbac.clusterScoped?.length > 0) && (
        <StackItem>
          <Card className="ols-plugin__rbac-card">
            <CardTitle>{t('Required RBAC Permissions')}</CardTitle>
            <CardBody>
              <Stack hasGutter>
                <StackItem>
                  <Alert isInline isPlain title={t('Review before approving')} variant="danger">
                    <em>
                      {t(
                        "Review these permissions carefully before approving. This is the exact set of permissions the Lightspeed operator will grant to the agent's execution sandbox. These permissions are enforced on every iteration, including retries, and cannot be altered by the agent during execution.",
                      )}
                    </em>
                  </Alert>
                </StackItem>
                {rbac.namespaceScoped?.length > 0 && (
                  <StackItem>
                    <Title headingLevel="h4">{t('Namespace Scoped')}</Title>
                    <PermissionRulesTable rules={rbac.namespaceScoped} />
                  </StackItem>
                )}
                {rbac.clusterScoped?.length > 0 && (
                  <StackItem>
                    <Title headingLevel="h4">{t('Cluster Scoped')}</Title>
                    <PermissionRulesTable rules={rbac.clusterScoped} />
                  </StackItem>
                )}
              </Stack>
            </CardBody>
          </Card>
        </StackItem>
      )}

      {verification && verification.steps?.length > 0 && (
        <StackItem>
          <Card>
            <CardTitle>{t('Verification Plan')}</CardTitle>
            <CardBody>
              <Stack hasGutter>
                <StackItem>
                  <Alert isInline isPlain title={t('Independent verification')} variant="info">
                    <em>
                      {t(
                        "After execution, a separate verification agent with read-only cluster access independently checks whether the fix worked. It inspects actual cluster state, not the execution agent's self-reported results. The checks shown below are the analysis agent's recommendations. The verification agent uses its own judgment based on what it observes, and every check it runs is reported transparently in the Verification tab. If verification fails, and retries were selected at approval, the Lightspeed operator will automatically retry execution with the failure reasons included as context for the execution agent.",
                      )}
                    </em>
                  </Alert>
                </StackItem>
                <StackItem>
                  <MarkdownText content={verification.description} />
                </StackItem>
                <StackItem>
                  <Title headingLevel="h4">{t('Verification Steps')}</Title>
                  <Stack hasGutter>
                    {verification.steps.map((step, i) => (
                      <StackItem key={i}>
                        <Card isCompact isPlain>
                          <CardBody>
                            <Stack hasGutter>
                              <StackItem>
                                <Flex alignItems={{ default: 'alignItemsCenter' }}>
                                  <FlexItem>
                                    <Label color="blue" isCompact>
                                      {stepTypeLabel(step.type)}
                                    </Label>
                                  </FlexItem>
                                  <FlexItem>
                                    <strong>{step.name}</strong>
                                  </FlexItem>
                                </Flex>
                              </StackItem>
                              <StackItem>
                                <CodeBlock>
                                  <CodeBlockCode>{step.command}</CodeBlockCode>
                                </CodeBlock>
                              </StackItem>
                              <StackItem>
                                <DescriptionList isCompact isHorizontal>
                                  <DescriptionListGroup>
                                    <DescriptionListTerm>{t('Expected')}</DescriptionListTerm>
                                    <DescriptionListDescription>
                                      {step.expected}
                                    </DescriptionListDescription>
                                  </DescriptionListGroup>
                                </DescriptionList>
                              </StackItem>
                            </Stack>
                          </CardBody>
                        </Card>
                      </StackItem>
                    ))}
                  </Stack>
                </StackItem>
                <StackItem>
                  <Title headingLevel="h4">{t('Rollback Plan')}</Title>
                  {typeof verification.rollbackPlan === 'object' ? (
                    <Stack hasGutter>
                      <StackItem>
                        <MarkdownText content={verification.rollbackPlan.description} />
                      </StackItem>
                      <StackItem>
                        <CodeBlock>
                          <CodeBlockCode>{verification.rollbackPlan.command}</CodeBlockCode>
                        </CodeBlock>
                      </StackItem>
                    </Stack>
                  ) : (
                    <CodeBlock>
                      <CodeBlockCode>{verification.rollbackPlan}</CodeBlockCode>
                    </CodeBlock>
                  )}
                </StackItem>
              </Stack>
            </CardBody>
          </Card>
        </StackItem>
      )}

      <AdapterComponents components={option.components} />
    </Stack>
  );
};

const RemediationOptionsView: React.FC<{
  options: RemediationOption[];
  selectedIndex?: number;
  onSelect?: (_index: number) => void;
}> = ({ options, selectedIndex, onSelect }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  if (options.length === 1) {
    return <RemediationOptionCard option={options[0]} />;
  }

  return (
    <Stack className="ols-plugin__proposal-tab-content" hasGutter>
      {options.map((opt, i) => {
        const isSelected = selectedIndex === i;
        return (
          <StackItem key={i}>
            <Card className={isSelected ? 'ols-plugin__option-selected' : undefined}>
              <ExpandableSection
                toggleContent={
                  <Flex
                    alignItems={{ default: 'alignItemsCenter' }}
                    spaceItems={{ default: 'spaceItemsSm' }}
                  >
                    <FlexItem>
                      <strong>{opt.title}</strong>
                    </FlexItem>
                    <FlexItem>
                      <Label color={getRiskColor(opt.proposal.risk)}>
                        {t('Risk: {{risk}}', { risk: opt.proposal.risk })}
                      </Label>
                    </FlexItem>
                    {opt.summary && <FlexItem>{opt.summary}</FlexItem>}
                    {isSelected && (
                      <FlexItem>
                        <Label color="green">{t('Selected')}</Label>
                      </FlexItem>
                    )}
                  </Flex>
                }
              >
                <RemediationOptionCard option={opt} />
                {onSelect && !isSelected && (
                  <Button
                    onClick={() => onSelect(i)}
                    style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}
                    variant="primary"
                  >
                    {t('Select this option')}
                  </Button>
                )}
              </ExpandableSection>
            </Card>
          </StackItem>
        );
      })}
    </Stack>
  );
};

const StructuredResult: React.FC<{ data: ExecutionStepStatus }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  return (
    <Stack hasGutter>
      <StackItem>
        <Card>
          <CardTitle>
            <Flex alignItems={{ default: 'alignItemsCenter' }}>
              <FlexItem>
                {data.success ? (
                  <CheckCircleIcon color="var(--pf-t--color--green--default)" />
                ) : (
                  <ExclamationCircleIcon color="var(--pf-t--color--red--default)" />
                )}
              </FlexItem>
              <FlexItem>{data.success ? t('Execution Succeeded') : t('Execution Failed')}</FlexItem>
            </Flex>
          </CardTitle>
        </Card>
      </StackItem>

      {(data.actionsTaken?.length ?? 0) > 0 && (
        <StackItem>
          <Card>
            <CardTitle>{t('Actions Taken')}</CardTitle>
            <CardBody>
              <Stack hasGutter>
                {data.actionsTaken!.map((action, i) => (
                  <StackItem key={i}>
                    <Card isCompact isPlain>
                      <CardBody>
                        <Stack hasGutter>
                          <StackItem>
                            <Flex alignItems={{ default: 'alignItemsCenter' }}>
                              <FlexItem>
                                {action.success ? (
                                  <CheckCircleIcon color="var(--pf-t--color--green--default)" />
                                ) : (
                                  <ExclamationCircleIcon color="var(--pf-t--color--red--default)" />
                                )}
                              </FlexItem>
                              <FlexItem>
                                <Label isCompact>{action.type}</Label>
                              </FlexItem>
                              <FlexItem flex={{ default: 'flex_1' }}>{action.description}</FlexItem>
                            </Flex>
                          </StackItem>
                          {action.resource && (
                            <StackItem>
                              <DescriptionList isCompact isHorizontal>
                                <DescriptionListGroup>
                                  <DescriptionListTerm>{t('Resource')}</DescriptionListTerm>
                                  <DescriptionListDescription>
                                    {action.resource.kind}
                                    {action.resource.namespace
                                      ? ` ${action.resource.namespace}/`
                                      : ' '}
                                    {action.resource.name}
                                  </DescriptionListDescription>
                                </DescriptionListGroup>
                              </DescriptionList>
                            </StackItem>
                          )}
                          {action.output && (
                            <StackItem>
                              <CodeBlock>
                                <CodeBlockCode>{action.output}</CodeBlockCode>
                              </CodeBlock>
                            </StackItem>
                          )}
                          {action.error && (
                            <StackItem>
                              <Alert isInline isPlain title={t('Error')} variant="danger">
                                {action.error}
                              </Alert>
                            </StackItem>
                          )}
                        </Stack>
                      </CardBody>
                    </Card>
                  </StackItem>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </StackItem>
      )}

      {data.verification && (
        <StackItem>
          <Card>
            <CardTitle>
              <Flex alignItems={{ default: 'alignItemsCenter' }}>
                <FlexItem>
                  {data.verification.conditionImproved ? (
                    <CheckCircleIcon color="var(--pf-t--color--green--default)" />
                  ) : (
                    <ExclamationCircleIcon color="var(--pf-t--color--red--default)" />
                  )}
                </FlexItem>
                <FlexItem>
                  {data.verification.conditionImproved
                    ? t('Condition Improved')
                    : t('Condition Not Improved')}
                </FlexItem>
              </Flex>
            </CardTitle>
            <CardBody>
              <MarkdownText content={data.verification.summary} />
            </CardBody>
          </Card>
        </StackItem>
      )}

      <AdapterComponents components={data.components} />
    </Stack>
  );
};

interface ProposalTabProps {
  proposal: LightspeedProposal;
  approve?: (_maxAttempts?: number, _optionIndex?: number) => void;
  deny?: () => void;
  inProgress?: boolean;
}

const ProposalTab: React.FC<ProposalTabProps> = ({ proposal, approve, deny, inProgress }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const analysis = proposal.status?.steps?.analysis;
  const options = analysis?.options ?? [];
  const hasAnalysis = options.length > 0;
  const phase = proposal.status?.phase;
  const showApproval = phase === 'Proposed';
  const [confirmRetries, setConfirmRetries] = React.useState<number | null>(null);
  const [retryDropdownOpen, setRetryDropdownOpen] = React.useState(false);
  const [localSelectedOption, setLocalSelectedOption] = React.useState<number | undefined>(
    analysis?.selectedOption ?? (options.length === 1 ? 0 : undefined),
  );
  React.useEffect(() => {
    const serverSelected = analysis?.selectedOption ?? (options.length === 1 ? 0 : undefined);
    setLocalSelectedOption((prev) => (prev === serverSelected ? prev : serverSelected));
  }, [analysis?.selectedOption, options.length]);
  const optionSelected = localSelectedOption !== undefined;

  React.useEffect(() => {
    if (confirmRetries === null) {
      return;
    }
    const timer = setTimeout(() => setConfirmRetries(null), CONFIRM_RESET_MS);
    return () => clearTimeout(timer);
  }, [confirmRetries]);

  const sandboxPod = analysis?.sandbox?.claimName;
  const sandboxNs = analysis?.sandbox?.namespace || 'openshift-lightspeed';
  const isAnalyzing = phase === 'Analyzing' || phase === 'Pending';

  // Auto-collapse the log viewer once analysis data arrives
  const [logsExpanded, setLogsExpanded] = useAutoCollapseLogs(hasAnalysis);

  const skipExecution = proposal.spec.workflowOverride?.execution?.skip;

  if (!hasAnalysis) {
    // Show live sandbox logs while analyzing
    if (isAnalyzing && sandboxPod) {
      return (
        <Stack className="ols-plugin__proposal-tab-content" hasGutter>
          <StackItem>
            <Card>
              <CardTitle>{t('Analyzing...')}</CardTitle>
              <CardBody>
                <SandboxLogViewer podName={sandboxPod} podNamespace={sandboxNs} />
              </CardBody>
            </Card>
          </StackItem>
        </Stack>
      );
    }
    const isTerminal = phase === 'Escalated' || phase === 'Failed';
    const message = isTerminal
      ? t('Analysis did not complete — no proposal was generated.')
      : t('No proposal generated yet.');
    return (
      <Card className="ols-plugin__proposal-tab-content">
        <CardBody>{message}</CardBody>
      </Card>
    );
  }

  const proposalContent = (
    <>
      <StackItem>
        <RemediationOptionsView
          onSelect={showApproval ? setLocalSelectedOption : undefined}
          options={options}
          selectedIndex={localSelectedOption}
        />
      </StackItem>
      {showApproval && skipExecution && (
        <StackItem>
          <Alert isInline title={t('Execution is skipped for this proposal')} variant="info">
            {t(
              'Review the advisory below and apply changes externally (e.g., via GitOps). No direct cluster execution will occur.',
            )}
          </Alert>
        </StackItem>
      )}
      {showApproval && optionSelected && approve && deny && (
        <StackItem>
          <Flex
            alignItems={{ default: 'alignItemsCenter' }}
            spaceItems={{ default: 'spaceItemsSm' }}
          >
            {confirmRetries === null ? (
              <>
                <FlexItem className="ols-plugin__approve-split">
                  <Button
                    className="ols-plugin__approve-split-main"
                    isDisabled={inProgress}
                    onClick={() => setConfirmRetries(0)}
                    variant="danger"
                  >
                    {skipExecution ? t('Acknowledge') : t('Approve')}
                  </Button>
                  <Dropdown
                    isOpen={retryDropdownOpen}
                    isScrollable
                    maxMenuHeight="200px"
                    onOpenChange={setRetryDropdownOpen}
                    onSelect={(_e, value) => {
                      setRetryDropdownOpen(false);
                      setConfirmRetries(value as number);
                    }}
                    toggle={(toggleRef) => (
                      <Button
                        aria-label={t('Approve with retries')}
                        className="ols-plugin__approve-split-toggle"
                        isDisabled={inProgress}
                        onClick={() => setRetryDropdownOpen((o) => !o)}
                        ref={toggleRef}
                        variant="danger"
                      >
                        &#9660;
                      </Button>
                    )}
                  >
                    <DropdownList>
                      {RETRY_OPTIONS.map((n) => (
                        <DropdownItem key={n} value={n}>
                          {t('Approve with {{num}} retries', { num: n })}
                        </DropdownItem>
                      ))}
                    </DropdownList>
                  </Dropdown>
                </FlexItem>
                <FlexItem>
                  <Button
                    isDisabled={inProgress}
                    isLoading={inProgress}
                    onClick={deny}
                    variant="secondary"
                  >
                    {t('Deny')}
                  </Button>
                </FlexItem>
              </>
            ) : (
              <>
                <FlexItem>
                  <Button
                    className="ols-plugin__confirm-sweep"
                    isDisabled={inProgress}
                    isLoading={inProgress}
                    onClick={() => approve(confirmRetries, localSelectedOption)}
                    variant="danger"
                  >
                    {confirmRetries > 0
                      ? t('Confirm Approve ({{num}} retries)', { num: confirmRetries })
                      : t('Confirm Approve')}
                  </Button>
                </FlexItem>
                <FlexItem>
                  <Button
                    isDisabled={inProgress}
                    onClick={() => setConfirmRetries(null)}
                    variant="link"
                  >
                    {t('Cancel')}
                  </Button>
                </FlexItem>
              </>
            )}
          </Flex>
        </StackItem>
      )}
    </>
  );

  return (
    <Stack className="ols-plugin__proposal-tab-content" hasGutter>
      {sandboxPod && (
        <StackItem>
          <ExpandableSection
            isExpanded={logsExpanded}
            onToggle={(_e, expanded) => setLogsExpanded(expanded)}
            toggleText={logsExpanded ? t('Hide analysis logs') : t('Show analysis logs')}
          >
            <SandboxLogViewer podName={sandboxPod} podNamespace={sandboxNs} />
          </ExpandableSection>
        </StackItem>
      )}
      <StackItem>
        {showApproval ? (
          <RefineChat proposal={proposal}>{proposalContent}</RefineChat>
        ) : (
          proposalContent
        )}
      </StackItem>
    </Stack>
  );
};

const ResultTab: React.FC<{ proposal: LightspeedProposal }> = ({ proposal }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const execution = proposal.status?.steps?.execution;
  const hasResult = !!(execution?.actionsTaken || execution?.success !== undefined);
  const phase = proposal.status?.phase;
  const sandboxPod = execution?.sandbox?.claimName;
  const sandboxNs = execution?.sandbox?.namespace || 'openshift-lightspeed';
  const isExecuting = phase === 'Approved' || phase === 'Executing';

  // Auto-collapse logs once the result arrives
  const [logsExpanded, setLogsExpanded] = useAutoCollapseLogs(hasResult);

  if (!hasResult && !sandboxPod) {
    const message = isExecuting
      ? t('Waiting for execution sandbox...')
      : t('No execution result yet.');
    return (
      <Card className="ols-plugin__proposal-tab-content">
        <CardBody>{message}</CardBody>
      </Card>
    );
  }

  return (
    <Stack className="ols-plugin__proposal-tab-content" hasGutter>
      {sandboxPod && (
        <StackItem>
          {hasResult ? (
            <ExpandableSection
              isExpanded={logsExpanded}
              onToggle={(_e, expanded) => setLogsExpanded(expanded)}
              toggleText={logsExpanded ? t('Hide execution logs') : t('Show execution logs')}
            >
              <SandboxLogViewer podName={sandboxPod} podNamespace={sandboxNs} />
            </ExpandableSection>
          ) : (
            <Card>
              <CardTitle>{t('Executing...')}</CardTitle>
              <CardBody>
                <SandboxLogViewer podName={sandboxPod} podNamespace={sandboxNs} />
              </CardBody>
            </Card>
          )}
        </StackItem>
      )}
      {hasResult && execution && (
        <StackItem>
          <StructuredResult data={execution} />
        </StackItem>
      )}
    </Stack>
  );
};

const VerificationTab: React.FC<{ proposal: LightspeedProposal; onEscalate?: () => void }> = ({
  proposal,
  onEscalate,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const phase = proposal.status?.phase;
  const verification = proposal.status?.steps?.verification;
  const hasResult = !!(
    verification?.checks ||
    verification?.summary ||
    verification?.success !== undefined
  );
  const sandboxPod = verification?.sandbox?.claimName;
  const sandboxNs = verification?.sandbox?.namespace || 'openshift-lightspeed';
  const isVerifying = phase === 'Verifying';

  const [logsExpanded, setLogsExpanded] = useAutoCollapseLogs(hasResult);

  if (!hasResult && !sandboxPod) {
    const message = isVerifying
      ? t('Waiting for verification sandbox...')
      : t('No verification result yet.');
    return (
      <Card className="ols-plugin__proposal-tab-content">
        <CardBody>{message}</CardBody>
      </Card>
    );
  }

  return (
    <Stack className="ols-plugin__proposal-tab-content" hasGutter>
      {sandboxPod && (
        <StackItem>
          {hasResult ? (
            <ExpandableSection
              isExpanded={logsExpanded}
              onToggle={(_e, expanded) => setLogsExpanded(expanded)}
              toggleText={logsExpanded ? t('Hide verification logs') : t('Show verification logs')}
            >
              <SandboxLogViewer podName={sandboxPod} podNamespace={sandboxNs} />
            </ExpandableSection>
          ) : (
            <Card>
              <CardTitle>{t('Verifying...')}</CardTitle>
              <CardBody>
                <SandboxLogViewer podName={sandboxPod} podNamespace={sandboxNs} />
              </CardBody>
            </Card>
          )}
        </StackItem>
      )}
      {hasResult && verification && (
        <StackItem>
          <Card>
            <CardTitle>
              <Flex
                alignItems={{ default: 'alignItemsCenter' }}
                spaceItems={{ default: 'spaceItemsSm' }}
              >
                <FlexItem>{t('Verification Result')}</FlexItem>
                <FlexItem>
                  <Label color={verification.success ? 'green' : 'red'}>
                    {verification.success ? t('Passed') : t('Failed')}
                  </Label>
                </FlexItem>
              </Flex>
            </CardTitle>
            <CardBody>
              <Stack hasGutter>
                {verification.summary && (
                  <StackItem>
                    <MarkdownText content={verification.summary} />
                  </StackItem>
                )}
                {verification.checks && verification.checks.length > 0 && (
                  <StackItem>
                    <Stack hasGutter>
                      {verification.checks.map((check, i) => (
                        <StackItem key={i}>
                          <Card isCompact isPlain>
                            <CardBody>
                              <Stack hasGutter>
                                <StackItem>
                                  <Flex alignItems={{ default: 'alignItemsCenter' }}>
                                    <FlexItem>
                                      {check.passed ? (
                                        <CheckCircleIcon color="var(--pf-t--color--green--default)" />
                                      ) : (
                                        <ExclamationCircleIcon color="var(--pf-t--color--red--default)" />
                                      )}
                                    </FlexItem>
                                    <FlexItem>
                                      <strong>{check.name}</strong>
                                    </FlexItem>
                                    <FlexItem>
                                      <Label color={check.passed ? 'green' : 'red'} isCompact>
                                        {check.passed ? t('Pass') : t('Fail')}
                                      </Label>
                                    </FlexItem>
                                  </Flex>
                                </StackItem>
                                <StackItem>
                                  <CodeBlock>
                                    <CodeBlockCode>{`$ ${check.source}\n${check.value}`}</CodeBlockCode>
                                  </CodeBlock>
                                </StackItem>
                              </Stack>
                            </CardBody>
                          </Card>
                        </StackItem>
                      ))}
                    </Stack>
                  </StackItem>
                )}
                {!verification.success && onEscalate && (
                  <StackItem>
                    <Button onClick={onEscalate} variant="danger">
                      {t('Escalate')}
                    </Button>
                  </StackItem>
                )}
              </Stack>
            </CardBody>
          </Card>
        </StackItem>
      )}

      <AdapterComponents components={verification?.components} />
    </Stack>
  );
};

type TabKey = 'overview' | 'proposal' | 'result' | 'verification';

const TAB_IDS: TabKey[] = ['overview', 'proposal', 'result', 'verification'];

const TriggerOptionsView: React.FC<{ options: RemediationOption[] }> = ({ options }) => {
  if (options.length === 1 && options[0].components?.length) {
    return <AdapterComponents components={options[0].components} />;
  }
  return (
    <Stack className="ols-plugin__proposal-tab-content" hasGutter>
      {options.map((opt, i) => (
        <StackItem key={i}>
          <Card>
            <ExpandableSection
              toggleContent={
                <Flex
                  alignItems={{ default: 'alignItemsCenter' }}
                  spaceItems={{ default: 'spaceItemsSm' }}
                >
                  <FlexItem>
                    <strong>{opt.title}</strong>
                  </FlexItem>
                  {opt.summary && <FlexItem>{opt.summary}</FlexItem>}
                </Flex>
              }
            >
              <CardBody>
                <AdapterComponents components={opt.components} />
              </CardBody>
            </ExpandableSection>
          </Card>
        </StackItem>
      ))}
    </Stack>
  );
};

const ProposalDetailPage: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const params = useParams<{ ns: string; name: string }>();
  const [ns, name] = React.useMemo(() => {
    if (params.ns && params.name) {
      return [params.ns, params.name];
    }
    const parts = window.location.pathname.split('/');
    const idx = parts.indexOf('proposals');
    if (idx >= 0 && parts.length > idx + 2) {
      return [parts[idx + 1], parts[idx + 2]];
    }
    return [params.ns || '', params.name || ''];
  }, [params.ns, params.name]);
  const [activeTab, setActiveTab] = React.useState<TabKey>('overview');

  const watchConfig = React.useMemo(
    () => ({
      groupVersionKind: {
        group: LightspeedProposalModel.apiGroup,
        kind: LightspeedProposalModel.kind,
        version: LightspeedProposalModel.apiVersion,
      },
      name,
      namespace: ns,
    }),
    [name, ns],
  );

  const [proposal, loaded, loadError] = useK8sWatchResource<LightspeedProposal & K8sResourceCommon>(
    watchConfig,
  );

  // Determine which tab has an active agent working in it.
  const activePhaseTab: TabKey | null = React.useMemo(() => {
    const phase = proposal?.status?.phase;
    switch (phase) {
      case 'Pending':
      case 'Analyzing':
        return 'proposal';
      case 'Approved':
      case 'Executing':
      case 'AwaitingSync':
        return 'result';
      case 'Verifying':
        return 'verification';
      default:
        return null;
    }
  }, [proposal?.status?.phase]);

  const {
    approve,
    clearError,
    deny,
    error: actionError,
    inProgress,
  } = useApprovalActions(proposal);
  const [escalateOpen, setEscalateOpen] = React.useState(false);
  const handleVerifyNow = React.useCallback(async () => {
    try {
      const url = `/api/kubernetes/apis/${LightspeedProposalModel.apiGroup}/${LightspeedProposalModel.apiVersion}/namespaces/${ns}/lightspeedproposals/${name}/status`;
      await consoleFetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/merge-patch+json' },
        body: JSON.stringify({
          status: { phase: 'Verifying' },
        }),
      });
    } catch (e) {
      console.error('Failed to trigger verification:', e);
    }
  }, [ns, name]);

  if (!loaded) {
    return (
      <PageSection>
        <Title headingLevel="h1">{t('Loading...')}</Title>
      </PageSection>
    );
  }

  if (loadError || !proposal) {
    return (
      <PageSection>
        <Alert title={t('Error loading proposal')} variant="danger">
          {loadError?.message || t('Proposal not found')}
        </Alert>
      </PageSection>
    );
  }

  const phase = getPhaseDisplay(proposal.status?.phase);
  const attempt = proposal.status?.attempt ?? 0;

  const isCmoSource =
    proposal.metadata?.labels?.['ols.openshift.io/source'] === 'cluster-monitoring-operator';
  const isTriggerBootstrap =
    proposal.metadata?.labels?.['ols.openshift.io/proposal-type'] === 'trigger-bootstrap';

  if (isTriggerBootstrap) {
    const triggerName =
      proposal.metadata?.labels?.['ols.openshift.io/trigger-name'] || proposal.metadata.name;
    const analysis = proposal.status?.steps?.analysis;
    const options = analysis?.options ?? [];
    const sandboxPod = analysis?.sandbox?.claimName;
    const sandboxNs = analysis?.sandbox?.namespace || 'openshift-lightspeed';
    const isAnalyzing =
      proposal.status?.phase === 'Analyzing' || proposal.status?.phase === 'Pending';
    const hasOptions = options.length > 0;

    return (
      <PageSection>
        <Flex
          alignItems={{ default: 'alignItemsCenter' }}
          className="ols-plugin__proposal-header"
          spaceItems={{ default: 'spaceItemsMd' }}
        >
          <FlexItem>
            <Flex
              alignItems={{ default: 'alignItemsCenter' }}
              spaceItems={{ default: 'spaceItemsSm' }}
            >
              <FlexItem>
                <PhaseIcon phase={proposal.status?.phase} />
              </FlexItem>
              <FlexItem>
                <Title headingLevel="h1">{triggerName}</Title>
              </FlexItem>
            </Flex>
          </FlexItem>
          <FlexItem>
            <Label color={phase.color}>{phase.label}</Label>
          </FlexItem>
        </Flex>
        <Stack hasGutter>
          {isAnalyzing && sandboxPod && (
            <StackItem>
              <Card>
                <CardTitle>{t('Discovering metrics and testing queries...')}</CardTitle>
                <CardBody>
                  <SandboxLogViewer podName={sandboxPod} podNamespace={sandboxNs} />
                </CardBody>
              </Card>
            </StackItem>
          )}
          {hasOptions && <TriggerOptionsView options={options} />}
          {!hasOptions && !isAnalyzing && (
            <StackItem>
              <Alert isInline title={t('No options proposed')} variant="warning">
                {t('The agent did not return any trigger proposals.')}
              </Alert>
            </StackItem>
          )}
        </Stack>
      </PageSection>
    );
  }

  const isCmoAlert = isCmoSource && !isTriggerBootstrap;
  const visibleTabs = isCmoAlert ? TAB_IDS.filter((id) => id !== 'overview') : TAB_IDS;
  const effectiveTab = isCmoAlert && activeTab === 'overview' ? 'proposal' : activeTab;

  const tabLabels: Record<TabKey, string> = {
    overview: t('Overview'),
    proposal: t('Proposal'),
    result: t('Execution'),
    verification: t('Verification'),
  };

  return (
    <PageSection>
      <Flex
        alignItems={{ default: 'alignItemsCenter' }}
        className="ols-plugin__proposal-header"
        spaceItems={{ default: 'spaceItemsMd' }}
      >
        <FlexItem>
          <Flex
            alignItems={{ default: 'alignItemsCenter' }}
            spaceItems={{ default: 'spaceItemsSm' }}
          >
            <FlexItem>
              <PhaseIcon phase={proposal.status?.phase} />
            </FlexItem>
            <FlexItem>
              <Title headingLevel="h1">{proposal.metadata.name}</Title>
            </FlexItem>
          </Flex>
        </FlexItem>
        <FlexItem>
          <Label color="blue">{proposal.spec.workflow}</Label>
        </FlexItem>
        <FlexItem>
          <Label color={phase.color}>{phase.label}</Label>
        </FlexItem>
      </Flex>

      {escalateOpen && (
        <EscalateModal
          isOpen={escalateOpen}
          onClose={() => setEscalateOpen(false)}
          proposal={proposal}
        />
      )}

      {actionError && (
        <Alert
          actionClose={
            <Button onClick={clearError} variant="plain">
              {t('Close')}
            </Button>
          }
          isInline
          title={t('Action failed')}
          variant="danger"
        >
          {actionError}
        </Alert>
      )}

      <div className="ols-plugin__chevron-tabs" role="tablist">
        {visibleTabs.map((id) => (
          <button
            aria-controls={`ols-tabpanel-${id}`}
            aria-selected={effectiveTab === id}
            className={`ols-plugin__chevron-tab${effectiveTab === id ? ' ols-plugin__chevron-tab--active' : ''}`}
            id={`ols-tab-${id}`}
            key={id}
            onClick={() => setActiveTab(id)}
            role="tab"
            type="button"
          >
            {tabLabels[id]}
            {activePhaseTab === id && effectiveTab !== id && (
              <span className="ols-plugin__tab-active-dot" />
            )}
            {attempt > 1 && id === 'overview' && (
              <Label className="ols-plugin__chevron-tab-iteration" isCompact>
                {`×${attempt}`}
              </Label>
            )}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`ols-tab-${effectiveTab}`}
        className="ols-plugin__chevron-tab-panel"
        id={`ols-tabpanel-${effectiveTab}`}
        role="tabpanel"
      >
        {effectiveTab === 'overview' && <OverviewTab proposal={proposal} />}
        {effectiveTab === 'proposal' && (
          <ProposalTab approve={approve} deny={deny} inProgress={inProgress} proposal={proposal} />
        )}
        {effectiveTab === 'result' && (
          <>
            {proposal.status?.phase === 'AwaitingSync' && (
              <Alert
                isInline
                style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}
                title={t('Awaiting external sync')}
                variant="info"
              >
                <p>
                  {t('Apply the proposed changes externally, then click Verify Now when ready.')}
                </p>
                <Button
                  onClick={() => handleVerifyNow()}
                  style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}
                  variant="primary"
                >
                  {t('Verify Now')}
                </Button>
              </Alert>
            )}
            <ResultTab proposal={proposal} />
          </>
        )}
        {effectiveTab === 'verification' && (
          <VerificationTab onEscalate={() => setEscalateOpen(true)} proposal={proposal} />
        )}
      </div>
    </PageSection>
  );
};

export default ProposalDetailPage;
