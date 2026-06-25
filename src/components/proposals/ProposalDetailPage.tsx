import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import {
  K8sResourceCommon,
  k8sPatch,
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
  MenuToggle,
  MenuToggleAction,
  Label,
  PageSection,
  Stack,
  StackItem,
  TextArea,
  Title,
  Tooltip,
} from '@patternfly/react-core';

import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExternalLinkAltIcon,
} from '@patternfly/react-icons';

import {
  AdapterComponent,
  AnalysisResultCR,
  AnalysisResultGVK,
  derivePhaseFromConditions,
  EscalationResultCR,
  EscalationResultGVK,
  ExecutionResultCR,
  ExecutionResultGVK,
  getPhaseDisplay,
  getRiskColor,
  LightspeedAgentModel,
  LightspeedProposal,
  LightspeedProposalApproval,
  LightspeedProposalApprovalModel,
  LightspeedProposalModel,
  PermissionRule,
  ProposalCondition,
  RemediationOption,
  resultOutcome,
  SandboxInfo,
  StepResultRef,
  VerificationResultCR,
  VerificationResultGVK,
} from '../../models/proposal';
import { type StageApprovalResult, useStageApproval } from '../../hooks/useStageApproval';
import { MarkdownText } from './MarkdownText';
import DynamicComponent from './DynamicComponent';
import EscalateModal from './EscalateModal';
import AgenticLayout from '../AgenticLayout';
import PhaseIcon from './PhaseIcon';
import SandboxLogViewer from './SandboxLogViewer';

import './proposal-detail.css';

const KNOWN_COMPONENT_TYPES = new Set([
  'lightspeed_prometheus_query',
  'lightspeed_metrics_chart',
  'lightspeed_resource_diff',
  'lightspeed_action_picker',
  'lightspeed_evidence_table',
  'lightspeed_status_timeline',
  'cmo_alert_diagnosis',
  'cmo_metric_evidence',
  'cmo_remediation_step',
  'cmo_trigger_proposal',
]);

const AdapterComponents: React.FC<{ components?: unknown }> = ({ components }) => {
  if (!components) {
    return null;
  }
  const items: AdapterComponent[] = Array.isArray(components)
    ? components
    : [components as AdapterComponent];
  return (
    <Stack hasGutter>
      {items.map((comp, i) => (
        <StackItem key={i}>
          {typeof comp === 'object' &&
          comp !== null &&
          'type' in comp &&
          KNOWN_COMPONENT_TYPES.has((comp as AdapterComponent).type) ? (
            <DynamicComponent
              props={comp as AdapterComponent}
              type={(comp as AdapterComponent).type}
            />
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
const MAX_RETRIES = 3;
const RETRY_OPTIONS = Array.from({ length: MAX_RETRIES }, (_, i) => i + 1);

const AgentDropdown: React.FC<{
  agentNames: string[];
  defaultAgent?: string;
  selected: string;
  onSelect: (_name: string) => void;
}> = ({ agentNames, defaultAgent, selected, onSelect }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [isOpen, setIsOpen] = React.useState(false);
  let displayLabel: string;
  if (!selected) {
    displayLabel = t('Select agent');
  } else if (selected === defaultAgent) {
    displayLabel = `${selected} (${t('default')})`;
  } else {
    displayLabel = selected;
  }

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onSelect={(_e, value) => {
        onSelect(value as string);
        setIsOpen(false);
      }}
      toggle={(toggleRef) => (
        <MenuToggle onClick={() => setIsOpen((o) => !o)} ref={toggleRef} variant="secondary">
          {displayLabel}
        </MenuToggle>
      )}
    >
      <DropdownList>
        {agentNames.map((name) => (
          <DropdownItem isSelected={name === selected} key={name} value={name}>
            {name === defaultAgent ? `${name} (${t('default')})` : name}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

const ApprovalCard: React.FC<{
  approval: StageApprovalResult;
  approveLabel: string;
  message: string;
  defaultAgent?: string;
  agentNames: string[];
}> = ({ approval, approveLabel, message, defaultAgent, agentNames }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [selectedAgent, setSelectedAgent] = React.useState(defaultAgent ?? '');

  return (
    <Stack className="ols-plugin__proposal-tab-content" hasGutter>
      <StackItem>
        <Card>
          <CardTitle>{t('Approval Required')}</CardTitle>
          <CardBody>
            <Stack hasGutter>
              <StackItem>{message}</StackItem>
              <StackItem>
                <Flex
                  alignItems={{ default: 'alignItemsCenter' }}
                  spaceItems={{ default: 'spaceItemsSm' }}
                >
                  {agentNames.length > 0 && (
                    <FlexItem>
                      <AgentDropdown
                        agentNames={agentNames}
                        defaultAgent={defaultAgent}
                        onSelect={setSelectedAgent}
                        selected={selectedAgent}
                      />
                    </FlexItem>
                  )}
                  <FlexItem>
                    <Tooltip
                      content={t(
                        'You must be a member of system:cluster-admins to approve or deny proposals.',
                      )}
                      trigger={
                        !approval.canApprove && !approval.canApproveLoading ? undefined : 'manual'
                      }
                    >
                      <Button
                        isAriaDisabled={!approval.canApprove || approval.inProgress}
                        isLoading={approval.inProgress}
                        onClick={() => approval.approve({ agent: selectedAgent || undefined })}
                        variant="primary"
                      >
                        {approveLabel}
                      </Button>
                    </Tooltip>
                  </FlexItem>
                  <FlexItem>
                    <Tooltip
                      content={t(
                        'You must be a member of system:cluster-admins to approve or deny proposals.',
                      )}
                      trigger={
                        !approval.canApprove && !approval.canApproveLoading ? undefined : 'manual'
                      }
                    >
                      <Button
                        isAriaDisabled={!approval.canApprove || approval.inProgress}
                        onClick={() => approval.deny()}
                        variant="secondary"
                      >
                        {t('Deny')}
                      </Button>
                    </Tooltip>
                  </FlexItem>
                </Flex>
              </StackItem>
              {approval.error && (
                <StackItem>
                  <Alert isInline title={t('Action failed')} variant="danger">
                    {approval.error}
                  </Alert>
                </StackItem>
              )}
            </Stack>
          </CardBody>
        </Card>
      </StackItem>
    </Stack>
  );
};

const SandboxDisplay: React.FC<{ label: string; sandbox?: SandboxInfo }> = ({ label, sandbox }) => {
  if (!sandbox?.claimName) {
    return null;
  }
  return (
    <DescriptionListGroup>
      <DescriptionListTerm>{label}</DescriptionListTerm>
      <DescriptionListDescription>
        {sandbox.claimName}
        {sandbox.namespace && ` (${sandbox.namespace})`}
      </DescriptionListDescription>
    </DescriptionListGroup>
  );
};

const OverviewTab: React.FC<{
  proposal: LightspeedProposal;
  approval?: LightspeedProposalApproval;
  latestExecutionResult?: ExecutionResultCR;
  latestVerificationResult?: VerificationResultCR;
}> = ({ proposal, approval, latestExecutionResult, latestVerificationResult }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const phase = getPhaseDisplay(
    derivePhaseFromConditions(proposal.status?.conditions as ProposalCondition[]),
  );
  const sourceUrl = proposal.metadata.annotations?.['ols.openshift.io/source-url'];
  const sourceName = proposal.metadata.annotations?.['ols.openshift.io/source-name'] || t('Source');
  const execFailed = resultOutcome(latestExecutionResult) === 'Failed';
  const verifyFailed = resultOutcome(latestVerificationResult) === 'Failed';

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
                      <PhaseIcon
                        phase={derivePhaseFromConditions(
                          proposal.status?.conditions as ProposalCondition[],
                        )}
                        executionFailed={execFailed}
                        verificationFailed={verifyFailed}
                      />
                    </FlexItem>
                    <FlexItem>
                      <Label color={phase.color}>{phase.label}</Label>
                    </FlexItem>
                  </Flex>
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
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Created')}</DescriptionListTerm>
                <DescriptionListDescription>
                  {proposal.metadata.creationTimestamp
                    ? new Date(proposal.metadata.creationTimestamp).toLocaleString()
                    : '-'}
                </DescriptionListDescription>
              </DescriptionListGroup>
              {approval?.spec?.approver?.username && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Approved By')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {approval.spec.approver.username}
                    {approval.spec.approver.approvedAt &&
                      ` (${new Date(approval.spec.approver.approvedAt).toLocaleString()})`}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
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
                {proposal?.rollbackPlan && (
                  <StackItem>
                    <Title headingLevel="h4">{t('Rollback Plan')}</Title>
                    {typeof proposal.rollbackPlan === 'object' ? (
                      <Stack hasGutter>
                        <StackItem>
                          <MarkdownText content={proposal.rollbackPlan.description} />
                        </StackItem>
                        <StackItem>
                          <CodeBlock>
                            <CodeBlockCode>{proposal.rollbackPlan.command}</CodeBlockCode>
                          </CodeBlock>
                        </StackItem>
                      </Stack>
                    ) : (
                      <CodeBlock>
                        <CodeBlockCode>{proposal.rollbackPlan}</CodeBlockCode>
                      </CodeBlock>
                    )}
                  </StackItem>
                )}
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
  actionButtons?: React.ReactNode;
}> = ({ options, selectedIndex, onSelect, actionButtons }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  if (options.length === 1) {
    return (
      <Card>
        <RemediationOptionCard option={options[0]} />
        {actionButtons && <div className="ols-plugin__option-actions">{actionButtons}</div>}
      </Card>
    );
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
                    {opt.proposal && (
                      <FlexItem>
                        <Label color={getRiskColor(opt.proposal.risk)}>
                          {t('Risk: {{risk}}', { risk: opt.proposal.risk })}
                        </Label>
                      </FlexItem>
                    )}
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
                    className="ols-plugin__option-select-btn"
                    onClick={() => onSelect(i)}
                    variant="primary"
                  >
                    {t('Select this option')}
                  </Button>
                )}
                {isSelected && actionButtons && (
                  <div className="ols-plugin__option-select-btn">{actionButtons}</div>
                )}
              </ExpandableSection>
            </Card>
          </StackItem>
        );
      })}
    </Stack>
  );
};

const StructuredResult: React.FC<{ data: ExecutionResultCR }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const executionOutcome = resultOutcome(data);

  return (
    <Stack hasGutter>
      <StackItem>
        <Card>
          <CardTitle>
            <Flex alignItems={{ default: 'alignItemsCenter' }}>
              <FlexItem>
                {executionOutcome === 'Succeeded' ? (
                  <CheckCircleIcon color="var(--pf-t--color--green--default)" />
                ) : (
                  <ExclamationCircleIcon color="var(--pf-t--color--red--default)" />
                )}
              </FlexItem>
              <FlexItem>
                {executionOutcome === 'Succeeded'
                  ? t('Execution Succeeded')
                  : t('Execution Failed')}
              </FlexItem>
            </Flex>
          </CardTitle>
        </Card>
      </StackItem>

      {(data.status?.actionsTaken?.length ?? 0) > 0 && (
        <StackItem>
          <Card>
            <CardTitle>{t('Actions Taken')}</CardTitle>
            <CardBody>
              <Stack hasGutter>
                {data.status?.actionsTaken!.map((action, i) => (
                  <StackItem key={i}>
                    <Card isCompact isPlain>
                      <CardBody>
                        <Stack hasGutter>
                          <StackItem>
                            <Flex alignItems={{ default: 'alignItemsCenter' }}>
                              <FlexItem>
                                {action.outcome === 'Succeeded' ? (
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

      {data.status?.verification && (
        <StackItem>
          <Card>
            <CardTitle>
              <Flex alignItems={{ default: 'alignItemsCenter' }}>
                <FlexItem>
                  {data.status?.verification.conditionOutcome === 'Improved' ? (
                    <CheckCircleIcon color="var(--pf-t--color--green--default)" />
                  ) : data.status?.verification.conditionOutcome === 'Degraded' ? (
                    <ExclamationCircleIcon color="var(--pf-t--color--red--default)" />
                  ) : (
                    <ExclamationCircleIcon color="var(--pf-t--color--yellow--default)" />
                  )}
                </FlexItem>
                <FlexItem>
                  {data.status?.verification.conditionOutcome === 'Improved'
                    ? t('Condition Improved')
                    : data.status?.verification.conditionOutcome === 'Degraded'
                      ? t('Condition Degraded')
                      : t('Condition Unchanged')}
                </FlexItem>
              </Flex>
            </CardTitle>
            <CardBody>
              <MarkdownText content={data.status?.verification.summary} />
            </CardBody>
          </Card>
        </StackItem>
      )}
    </Stack>
  );
};

interface ProposalTabProps {
  proposal: LightspeedProposal;
  analysisApproval: StageApprovalResult;
  executionApproval: StageApprovalResult;
  agentNames: string[];
  latestAnalysisResult?: AnalysisResultCR;
}

const ProposalTab: React.FC<ProposalTabProps> = ({
  proposal,
  analysisApproval,
  executionApproval,
  agentNames,
  latestAnalysisResult,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const analysis = proposal.status?.steps?.analysis;
  const options = latestAnalysisResult?.status?.options ?? [];
  const hasAnalysis = options.length > 0;
  const phase = derivePhaseFromConditions(proposal.status?.conditions as ProposalCondition[]);
  const showExecutionApproval = executionApproval.needsApproval && hasAnalysis;
  const [confirmRetries, setConfirmRetries] = React.useState<number | null>(null);
  const [retryDropdownOpen, setRetryDropdownOpen] = React.useState(false);
  const [localSelectedOption, setLocalSelectedOption] = React.useState<number | undefined>(
    options.length === 1 ? 0 : undefined,
  );
  React.useEffect(() => {
    if (options.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalSelectedOption(0);
    }
  }, [options.length]);
  const optionSelected = localSelectedOption !== undefined;

  React.useEffect(() => {
    if (confirmRetries === null) {
      return;
    }
    const timer = setTimeout(() => setConfirmRetries(null), CONFIRM_RESET_MS);
    return () => clearTimeout(timer);
  }, [confirmRetries]);

  const [execAgent, setExecAgent] = React.useState(proposal.spec.execution?.agent ?? '');
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExecAgent(proposal.spec.execution?.agent ?? '');
  }, [proposal.spec.execution?.agent]);

  const sandboxPod = analysis?.sandbox?.claimName;
  const sandboxNs = analysis?.sandbox?.namespace || 'openshift-lightspeed';
  const isAnalyzing = phase === 'Analyzing' || phase === 'Pending';
  const generation = proposal.metadata?.generation ?? 0;
  const analyzedCondition = proposal.status?.conditions?.find(
    (c: ProposalCondition) => c.type === 'Analyzed',
  );
  const revisionPending =
    !!proposal.spec.revisionFeedback && generation > (analyzedCondition?.observedGeneration ?? 0);

  const [logsExpanded, setLogsExpanded] = useAutoCollapseLogs(hasAnalysis && !revisionPending);

  const isAdvisory = !proposal.spec.execution;

  const [refineOpen, setRefineOpen] = React.useState(false);
  const [refineFeedback, setRefineFeedback] = React.useState('');
  const [refineInProgress, setRefineInProgress] = React.useState(false);
  const [refineError, setRefineError] = React.useState<string | null>(null);

  const submitRefine = React.useCallback(async () => {
    if (!refineFeedback.trim()) return;
    setRefineInProgress(true);
    setRefineError(null);
    try {
      await k8sPatch({
        data: [
          {
            op: proposal.spec.revisionFeedback === undefined ? 'add' : 'replace',
            path: '/spec/revisionFeedback',
            value: refineFeedback.trim(),
          },
        ],
        model: LightspeedProposalModel,
        resource: proposal,
      });
      setRefineOpen(false);
      setRefineFeedback('');
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : 'Failed to submit revision');
    } finally {
      setRefineInProgress(false);
    }
  }, [proposal, refineFeedback]);

  if (revisionPending) {
    return (
      <Stack className="ols-plugin__proposal-tab-content" hasGutter>
        <StackItem>
          <Card>
            <CardTitle>{t('Re-analyzing with feedback...')}</CardTitle>
            <CardBody>
              {proposal.spec.revisionFeedback && (
                <Alert isInline title={t('Your feedback')} variant="info">
                  {proposal.spec.revisionFeedback}
                </Alert>
              )}
              {sandboxPod && <SandboxLogViewer podName={sandboxPod} podNamespace={sandboxNs} />}
            </CardBody>
          </Card>
        </StackItem>
      </Stack>
    );
  }

  if (!hasAnalysis) {
    if (analysisApproval.needsApproval && !sandboxPod) {
      return (
        <ApprovalCard
          agentNames={agentNames}
          approval={analysisApproval}
          approveLabel={t('Approve Analysis')}
          defaultAgent={proposal.spec.analysis?.agent}
          message={t('This proposal requires approval before analysis can begin.')}
        />
      );
    }

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
    const isTerminal = phase === 'Escalated' || phase === 'Failed' || phase === 'Denied';
    const message = isTerminal
      ? t('Analysis did not complete — no proposal was generated.')
      : t('No proposal generated yet.');
    return (
      <Card className="ols-plugin__proposal-tab-content">
        <CardBody>{message}</CardBody>
      </Card>
    );
  }

  const busy = executionApproval.inProgress || refineInProgress;

  const actionButtons =
    showExecutionApproval && optionSelected ? (
      <Stack hasGutter>
        {isAdvisory && (
          <StackItem>
            <Alert isInline title={t('Execution is skipped for this proposal')} variant="info">
              {t(
                'Review the advisory below and apply changes externally (e.g., via GitOps). No direct cluster execution will occur.',
              )}
            </Alert>
          </StackItem>
        )}
        <StackItem>
          <Flex
            alignItems={{ default: 'alignItemsCenter' }}
            spaceItems={{ default: 'spaceItemsSm' }}
          >
            {confirmRetries === null ? (
              <>
                {agentNames.length > 0 && (
                  <FlexItem>
                    <AgentDropdown
                      agentNames={agentNames}
                      defaultAgent={proposal.spec.execution?.agent}
                      onSelect={setExecAgent}
                      selected={execAgent}
                    />
                  </FlexItem>
                )}
                <FlexItem className="ols-plugin__approve-danger">
                  <Tooltip
                    content={t(
                      'You must be a member of system:cluster-admins to approve or deny proposals.',
                    )}
                    trigger={
                      !executionApproval.canApprove && !executionApproval.canApproveLoading
                        ? undefined
                        : 'manual'
                    }
                  >
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
                        <MenuToggle
                          isDisabled={!executionApproval.canApprove || busy}
                          onClick={() => setRetryDropdownOpen((o) => !o)}
                          ref={toggleRef}
                          splitButtonItems={[
                            <MenuToggleAction key="approve" onClick={() => setConfirmRetries(0)}>
                              {t('Approve')}
                            </MenuToggleAction>,
                          ]}
                          variant="primary"
                        />
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
                  </Tooltip>
                </FlexItem>
                <FlexItem>
                  <Tooltip
                    content={t(
                      'You must be a member of system:cluster-admins to approve or deny proposals.',
                    )}
                    trigger={
                      !executionApproval.canApprove && !executionApproval.canApproveLoading
                        ? undefined
                        : 'manual'
                    }
                  >
                    <Button
                      isAriaDisabled={!executionApproval.canApprove || executionApproval.inProgress}
                      isLoading={executionApproval.inProgress}
                      onClick={() => executionApproval.deny()}
                      variant="secondary"
                    >
                      {t('Deny')}
                    </Button>
                  </Tooltip>
                </FlexItem>
                <FlexItem>
                  <Button
                    isDisabled={executionApproval.inProgress}
                    onClick={() => setRefineOpen((o) => !o)}
                    variant="secondary"
                  >
                    {t('Refine')}
                  </Button>
                </FlexItem>
              </>
            ) : (
              <>
                <FlexItem>
                  <Tooltip
                    content={t(
                      'You must be a member of system:cluster-admins to approve or deny proposals.',
                    )}
                    trigger={
                      !executionApproval.canApprove && !executionApproval.canApproveLoading
                        ? undefined
                        : 'manual'
                    }
                  >
                    <Button
                      className="ols-plugin__confirm-sweep"
                      isAriaDisabled={!executionApproval.canApprove || executionApproval.inProgress}
                      isLoading={executionApproval.inProgress}
                      onClick={() =>
                        executionApproval.approve({
                          maxAttempts: confirmRetries,
                          option: localSelectedOption,
                          agent: execAgent || undefined,
                        })
                      }
                      variant="danger"
                    >
                      {confirmRetries > 0
                        ? t('Confirm Approve ({{num}} retries)', { num: confirmRetries })
                        : t('Confirm Approve')}
                    </Button>
                  </Tooltip>
                </FlexItem>
                <FlexItem>
                  <Button
                    isDisabled={executionApproval.inProgress}
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
        {refineOpen && (
          <StackItem>
            <TextArea
              aria-label={t('Revision feedback')}
              onChange={(_e, value) => setRefineFeedback(value)}
              placeholder={t('Describe what you want changed about this analysis...')}
              resizeOrientation="vertical"
              rows={3}
              value={refineFeedback}
            />
            <Flex className="ols-plugin__refine-actions" spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <Button
                  isDisabled={!refineFeedback.trim() || refineInProgress}
                  isLoading={refineInProgress}
                  onClick={submitRefine}
                  variant="primary"
                >
                  {t('Submit')}
                </Button>
              </FlexItem>
              <FlexItem>
                <Button
                  isDisabled={refineInProgress}
                  onClick={() => {
                    setRefineOpen(false);
                    setRefineError(null);
                  }}
                  variant="link"
                >
                  {t('Cancel')}
                </Button>
              </FlexItem>
            </Flex>
          </StackItem>
        )}
        {executionApproval.error && (
          <StackItem>
            <Alert isInline title={t('Action failed')} variant="danger">
              {executionApproval.error}
            </Alert>
          </StackItem>
        )}
        {refineError && (
          <StackItem>
            <Alert isInline title={t('Refine failed')} variant="danger">
              {refineError}
            </Alert>
          </StackItem>
        )}
      </Stack>
    ) : undefined;

  const proposalContent = (
    <StackItem>
      <RemediationOptionsView
        actionButtons={actionButtons}
        onSelect={showExecutionApproval ? setLocalSelectedOption : undefined}
        options={options}
        selectedIndex={localSelectedOption}
      />
    </StackItem>
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
      <StackItem>{proposalContent}</StackItem>
    </Stack>
  );
};

const ResultTab: React.FC<{
  proposal: LightspeedProposal;
  latestExecutionResult?: ExecutionResultCR;
}> = ({ proposal, latestExecutionResult }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const execution = proposal.status?.steps?.execution;
  const hasResult = !!latestExecutionResult;
  const phase = derivePhaseFromConditions(proposal.status?.conditions as ProposalCondition[]);
  const sandboxPod = execution?.sandbox?.claimName;
  const sandboxNs = execution?.sandbox?.namespace || 'openshift-lightspeed';
  const isExecuting = phase === 'Executing';

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
      {hasResult && latestExecutionResult && (
        <StackItem>
          <StructuredResult data={latestExecutionResult} />
        </StackItem>
      )}
    </Stack>
  );
};

const VerificationTab: React.FC<{
  proposal: LightspeedProposal;
  onEscalate?: () => void;
  verificationApproval: StageApprovalResult;
  agentNames: string[];
  latestVerificationResult?: VerificationResultCR;
}> = ({ proposal, onEscalate, verificationApproval, agentNames, latestVerificationResult }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const phase = derivePhaseFromConditions(proposal.status?.conditions as ProposalCondition[]);
  const verification = proposal.status?.steps?.verification;
  const hasResult = !!latestVerificationResult;
  const verificationOutcome = resultOutcome(latestVerificationResult);
  const sandboxPod = verification?.sandbox?.claimName;
  const sandboxNs = verification?.sandbox?.namespace || 'openshift-lightspeed';
  const isVerifying = phase === 'Verifying';

  const [logsExpanded, setLogsExpanded] = useAutoCollapseLogs(hasResult);

  if (!hasResult && !sandboxPod) {
    if (verificationApproval.needsApproval) {
      return (
        <ApprovalCard
          agentNames={agentNames}
          approval={verificationApproval}
          approveLabel={t('Approve Verification')}
          defaultAgent={proposal.spec.verification?.agent}
          message={t('Verification requires approval before it can proceed.')}
        />
      );
    }

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
      {hasResult && latestVerificationResult && (
        <StackItem>
          <Card>
            <CardTitle>
              <Flex
                alignItems={{ default: 'alignItemsCenter' }}
                spaceItems={{ default: 'spaceItemsSm' }}
              >
                <FlexItem>{t('Verification Result')}</FlexItem>
                <FlexItem>
                  <Label color={verificationOutcome === 'Succeeded' ? 'green' : 'red'}>
                    {verificationOutcome === 'Succeeded' ? t('Passed') : t('Failed')}
                  </Label>
                </FlexItem>
              </Flex>
            </CardTitle>
            <CardBody>
              <Stack hasGutter>
                {latestVerificationResult.status?.summary && (
                  <StackItem>
                    <MarkdownText content={latestVerificationResult.status?.summary} />
                  </StackItem>
                )}
                {latestVerificationResult.status?.checks &&
                  latestVerificationResult.status?.checks.length > 0 && (
                    <StackItem>
                      <Stack hasGutter>
                        {latestVerificationResult.status?.checks.map((check, i) => (
                          <StackItem key={i}>
                            <Card isCompact isPlain>
                              <CardBody>
                                <Stack hasGutter>
                                  <StackItem>
                                    <Flex alignItems={{ default: 'alignItemsCenter' }}>
                                      <FlexItem>
                                        {check.result === 'Passed' ? (
                                          <CheckCircleIcon color="var(--pf-t--color--green--default)" />
                                        ) : (
                                          <ExclamationCircleIcon color="var(--pf-t--color--red--default)" />
                                        )}
                                      </FlexItem>
                                      <FlexItem>
                                        <strong>{check.name}</strong>
                                      </FlexItem>
                                      <FlexItem>
                                        <Label
                                          color={check.result === 'Passed' ? 'green' : 'red'}
                                          isCompact
                                        >
                                          {check.result === 'Passed' ? t('Pass') : t('Fail')}
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
                {verificationOutcome === 'Failed' && onEscalate && (
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
    </Stack>
  );
};

const EscalationTab: React.FC<{
  proposal: LightspeedProposal;
  escalationApproval: StageApprovalResult;
  agentNames: string[];
  latestEscalationResult?: EscalationResultCR;
}> = ({ proposal, escalationApproval, agentNames, latestEscalationResult }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const phase = derivePhaseFromConditions(proposal.status?.conditions as ProposalCondition[]);
  const escalation = proposal.status?.steps?.escalation;
  const hasResult = !!latestEscalationResult;
  const escalationOutcome = resultOutcome(latestEscalationResult);
  const sandboxPod = escalation?.sandbox?.claimName;
  const sandboxNs = escalation?.sandbox?.namespace || 'openshift-lightspeed';
  const isEscalating = phase === 'Escalating';

  const [logsExpanded, setLogsExpanded] = useAutoCollapseLogs(hasResult);

  if (!hasResult && !sandboxPod) {
    if (escalationApproval.needsApproval) {
      return (
        <ApprovalCard
          agentNames={agentNames}
          approval={escalationApproval}
          approveLabel={t('Approve Escalation')}
          defaultAgent={proposal.spec.analysis?.agent}
          message={t(
            'Escalation requires approval before it can proceed. The agent will research the issue and draft a support case.',
          )}
        />
      );
    }

    const message = isEscalating
      ? t('Waiting for escalation sandbox...')
      : t('No escalation result yet.');
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
              toggleText={logsExpanded ? t('Hide escalation logs') : t('Show escalation logs')}
            >
              <SandboxLogViewer podName={sandboxPod} podNamespace={sandboxNs} />
            </ExpandableSection>
          ) : (
            <Card>
              <CardTitle>{t('Escalating...')}</CardTitle>
              <CardBody>
                <SandboxLogViewer podName={sandboxPod} podNamespace={sandboxNs} />
              </CardBody>
            </Card>
          )}
        </StackItem>
      )}
      {latestEscalationResult && (
        <StackItem>
          <Card>
            <CardTitle>
              <Flex
                alignItems={{ default: 'alignItemsCenter' }}
                spaceItems={{ default: 'spaceItemsSm' }}
              >
                <FlexItem>{t('Escalation Result')}</FlexItem>
                <FlexItem>
                  <Label color={escalationOutcome === 'Succeeded' ? 'green' : 'red'}>
                    {escalationOutcome === 'Succeeded' ? t('Completed') : t('Failed')}
                  </Label>
                </FlexItem>
              </Flex>
            </CardTitle>
            <CardBody>
              <Stack hasGutter>
                {latestEscalationResult.status?.summary && (
                  <StackItem>
                    <MarkdownText content={latestEscalationResult.status?.summary} />
                  </StackItem>
                )}
                {latestEscalationResult.status?.content && (
                  <StackItem>
                    <ExpandableSection toggleText={t('Full escalation content')}>
                      <MarkdownText content={latestEscalationResult.status?.content} />
                    </ExpandableSection>
                  </StackItem>
                )}
                {latestEscalationResult.status?.failureReason && (
                  <StackItem>
                    <Alert isInline title={t('Failure reason')} variant="danger">
                      {latestEscalationResult.status?.failureReason}
                    </Alert>
                  </StackItem>
                )}
              </Stack>
            </CardBody>
          </Card>
        </StackItem>
      )}
    </Stack>
  );
};

type TabKey = 'overview' | 'proposal' | 'result' | 'verification' | 'escalation';

const TAB_IDS: TabKey[] = ['overview', 'proposal', 'result', 'verification', 'escalation'];

const TriggerOptionsView: React.FC<{ options: RemediationOption[] }> = ({ options }) => {
  if (options.length === 1 && options[0].components) {
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

  const approvalWatchConfig = React.useMemo(
    () => ({
      groupVersionKind: {
        group: LightspeedProposalApprovalModel.apiGroup,
        kind: LightspeedProposalApprovalModel.kind,
        version: LightspeedProposalApprovalModel.apiVersion,
      },
      name,
      namespace: ns,
    }),
    [name, ns],
  );

  const [approval, , approvalError] = useK8sWatchResource<
    LightspeedProposalApproval & K8sResourceCommon
  >(approvalWatchConfig);

  const agentListConfig = React.useMemo(
    () => ({
      groupVersionKind: {
        group: LightspeedAgentModel.apiGroup,
        kind: LightspeedAgentModel.kind,
        version: LightspeedAgentModel.apiVersion,
      },
      isList: true,
    }),
    [],
  );

  const [agentList] = useK8sWatchResource<K8sResourceCommon[]>(agentListConfig);
  const agentNames = React.useMemo(
    () =>
      Array.isArray(agentList) ? agentList.map((a) => a.metadata?.name ?? '').filter(Boolean) : [],
    [agentList],
  );

  // Watch result CRs filtered by proposal label
  const resultLabelSelector = React.useMemo(
    () => (name ? { matchLabels: { 'agentic.openshift.io/proposal': name } } : undefined),
    [name],
  );

  const analysisResultsConfig = React.useMemo(
    () =>
      name
        ? {
            groupVersionKind: AnalysisResultGVK,
            namespace: ns,
            selector: resultLabelSelector,
            isList: true,
          }
        : null,
    [name, ns, resultLabelSelector],
  );
  const [analysisResults] = useK8sWatchResource<AnalysisResultCR[]>(analysisResultsConfig);

  const executionResultsConfig = React.useMemo(
    () =>
      name
        ? {
            groupVersionKind: ExecutionResultGVK,
            namespace: ns,
            selector: resultLabelSelector,
            isList: true,
          }
        : null,
    [name, ns, resultLabelSelector],
  );
  const [executionResults] = useK8sWatchResource<ExecutionResultCR[]>(executionResultsConfig);

  const verificationResultsConfig = React.useMemo(
    () =>
      name
        ? {
            groupVersionKind: VerificationResultGVK,
            namespace: ns,
            selector: resultLabelSelector,
            isList: true,
          }
        : null,
    [name, ns, resultLabelSelector],
  );
  const [verificationResults] =
    useK8sWatchResource<VerificationResultCR[]>(verificationResultsConfig);

  const escalationResultsConfig = React.useMemo(
    () =>
      name
        ? {
            groupVersionKind: EscalationResultGVK,
            namespace: ns,
            selector: resultLabelSelector,
            isList: true,
          }
        : null,
    [name, ns, resultLabelSelector],
  );
  const [escalationResults] = useK8sWatchResource<EscalationResultCR[]>(escalationResultsConfig);

  // Helper: find the result CR referenced by the latest StepResultRef
  const getLatestResult = React.useCallback(
    <T extends { metadata: { name: string } }>(
      results: T[] | undefined,
      refs: StepResultRef[] | undefined,
    ): T | undefined => {
      if (!refs?.length || !results?.length) return undefined;
      const latestRef = refs[refs.length - 1];
      return results.find((r) => r.metadata.name === latestRef.name);
    },
    [],
  );

  const latestAnalysisResult = React.useMemo(
    () =>
      getLatestResult(
        Array.isArray(analysisResults) ? analysisResults : undefined,
        proposal?.status?.steps?.analysis?.results,
      ),
    [analysisResults, proposal?.status?.steps?.analysis?.results, getLatestResult],
  );

  const latestExecutionResult = React.useMemo(
    () =>
      getLatestResult(
        Array.isArray(executionResults) ? executionResults : undefined,
        proposal?.status?.steps?.execution?.results,
      ),
    [executionResults, proposal?.status?.steps?.execution?.results, getLatestResult],
  );

  const latestVerificationResult = React.useMemo(
    () =>
      getLatestResult(
        Array.isArray(verificationResults) ? verificationResults : undefined,
        proposal?.status?.steps?.verification?.results,
      ),
    [verificationResults, proposal?.status?.steps?.verification?.results, getLatestResult],
  );

  const latestEscalationResult = React.useMemo(
    () =>
      getLatestResult(
        Array.isArray(escalationResults) ? escalationResults : undefined,
        proposal?.status?.steps?.escalation?.results,
      ),
    [escalationResults, proposal?.status?.steps?.escalation?.results, getLatestResult],
  );

  const executionFailed = resultOutcome(latestExecutionResult) === 'Failed';
  const verificationFailed = resultOutcome(latestVerificationResult) === 'Failed';
  const currentPhase = derivePhaseFromConditions(
    proposal?.status?.conditions as ProposalCondition[],
  );

  const activePhaseTab: TabKey | null = React.useMemo(() => {
    switch (currentPhase) {
      case 'Pending':
      case 'Analyzing':
        return 'proposal';
      case 'Executing':
        return 'result';
      case 'Verifying':
        return 'verification';
      case 'Escalating':
        return 'escalation';
      default:
        return null;
    }
  }, [currentPhase]);

  const analysisApproval = useStageApproval(proposal, approval, 'Analysis', currentPhase);
  const executionApproval = useStageApproval(proposal, approval, 'Execution', currentPhase);
  const verificationApproval = useStageApproval(proposal, approval, 'Verification', currentPhase);
  const escalationApproval = useStageApproval(proposal, approval, 'Escalation', currentPhase);
  const actionError =
    approvalError?.message ||
    analysisApproval.error ||
    executionApproval.error ||
    verificationApproval.error ||
    escalationApproval.error;

  /* eslint-disable react-hooks/exhaustive-deps */
  const clearError = React.useCallback(() => {
    analysisApproval.clearError();
    executionApproval.clearError();
    verificationApproval.clearError();
    escalationApproval.clearError();
  }, [
    analysisApproval.clearError,
    executionApproval.clearError,
    verificationApproval.clearError,
    escalationApproval.clearError,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const [escalateOpen, setEscalateOpen] = React.useState(false);

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

  const phase = getPhaseDisplay(currentPhase);
  const isCmoSource =
    proposal.metadata?.labels?.['ols.openshift.io/source'] === 'cluster-monitoring-operator';
  const isTriggerBootstrap =
    proposal.metadata?.labels?.['ols.openshift.io/proposal-type'] === 'trigger-bootstrap';

  if (isTriggerBootstrap) {
    const triggerName =
      proposal.metadata?.labels?.['ols.openshift.io/trigger-name'] || proposal.metadata.name;
    const analysis = proposal.status?.steps?.analysis;
    const triggerOptions = latestAnalysisResult?.status?.options ?? [];
    const sandboxPod = analysis?.sandbox?.claimName;
    const sandboxNs = analysis?.sandbox?.namespace || 'openshift-lightspeed';
    const isAnalyzing = currentPhase === 'Analyzing' || currentPhase === 'Pending';
    const hasOptions = triggerOptions.length > 0;

    return (
      <AgenticLayout>
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
                  <PhaseIcon
                    phase={currentPhase}
                    executionFailed={executionFailed}
                    verificationFailed={verificationFailed}
                  />
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
            {hasOptions && <TriggerOptionsView options={triggerOptions} />}
            {!hasOptions && !isAnalyzing && (
              <StackItem>
                <Alert isInline title={t('No options proposed')} variant="warning">
                  {t('The agent did not return any trigger proposals.')}
                </Alert>
              </StackItem>
            )}
          </Stack>
        </PageSection>
      </AgenticLayout>
    );
  }

  const isCmoAlert = isCmoSource && !isTriggerBootstrap;
  const hasEscalation = proposal?.status?.conditions?.some(
    (c: ProposalCondition) => c.type === 'Escalated',
  );
  const visibleTabs = TAB_IDS.filter((id) => {
    if (id === 'overview' && isCmoAlert) return false;
    if (id === 'escalation' && !hasEscalation) return false;
    return true;
  });
  const effectiveTab = isCmoAlert && activeTab === 'overview' ? 'proposal' : activeTab;

  const tabLabels: Record<TabKey, string> = {
    overview: t('Overview'),
    proposal: t('Proposal'),
    result: t('Execution'),
    verification: t('Verification'),
    escalation: t('Escalation'),
  };

  const tabNeedsApproval: Record<TabKey, boolean> = {
    overview: false,
    proposal: analysisApproval.needsApproval || executionApproval.needsApproval,
    result: false,
    verification: verificationApproval.needsApproval,
    escalation: escalationApproval.needsApproval,
  };

  return (
    <AgenticLayout>
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
                <PhaseIcon
                  phase={currentPhase}
                  executionFailed={executionFailed}
                  verificationFailed={verificationFailed}
                />
              </FlexItem>
              <FlexItem>
                <Title headingLevel="h1">{proposal.metadata.name}</Title>
              </FlexItem>
            </Flex>
          </FlexItem>
          <FlexItem>
            <Label color={phase.color}>{phase.label}</Label>
          </FlexItem>
        </Flex>

        {escalateOpen && (
          <EscalateModal
            approval={approval}
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
              {tabNeedsApproval[id] && (
                <Label className="ols-plugin__chevron-tab-iteration" color="blue" isCompact>
                  {t('Needs approval')}
                </Label>
              )}
              {activePhaseTab === id && effectiveTab !== id && !tabNeedsApproval[id] && (
                <span className="ols-plugin__tab-active-dot" />
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
          {effectiveTab === 'overview' && (
            <OverviewTab
              approval={approval}
              latestExecutionResult={latestExecutionResult}
              latestVerificationResult={latestVerificationResult}
              proposal={proposal}
            />
          )}
          {effectiveTab === 'proposal' && (
            <ProposalTab
              agentNames={agentNames}
              analysisApproval={analysisApproval}
              executionApproval={executionApproval}
              latestAnalysisResult={latestAnalysisResult}
              proposal={proposal}
            />
          )}
          {effectiveTab === 'result' && (
            <ResultTab proposal={proposal} latestExecutionResult={latestExecutionResult} />
          )}
          {effectiveTab === 'verification' && (
            <VerificationTab
              agentNames={agentNames}
              latestVerificationResult={latestVerificationResult}
              onEscalate={() => setEscalateOpen(true)}
              proposal={proposal}
              verificationApproval={verificationApproval}
            />
          )}
          {effectiveTab === 'escalation' && (
            <EscalationTab
              agentNames={agentNames}
              escalationApproval={escalationApproval}
              latestEscalationResult={latestEscalationResult}
              proposal={proposal}
            />
          )}
        </div>
      </PageSection>
    </AgenticLayout>
  );
};

export default ProposalDetailPage;
