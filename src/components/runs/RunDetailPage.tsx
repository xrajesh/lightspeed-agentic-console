import { useCallback, useEffect, useState } from 'react';

import { DocumentTitle, ResourceIcon, Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Breadcrumb,
  BreadcrumbItem,
  Card,
  CardBody,
  Content,
  ContentVariants,
  Divider,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Label,
  PageGroup,
  PageSection,
  Skeleton,
  Title,
} from '@patternfly/react-core';
import { InfoCircleIcon } from '@patternfly/react-icons';
import type { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useAgenticRun } from '../../hooks/useAgenticRun';
import { LightspeedAgenticRunGVK } from '../../models/agenticrun';
import type { AgenticRunView } from '../../models/agenticrun-views';
import { TERMINAL_PHASES } from '../../models/agenticrun-views';
import { getReversibilityDescription, getReversibilityText } from '../../utils/agenticrun-utils';
import AgenticLayout from '../AgenticLayout';
import { ApprovalGatedButton } from '../ApprovalGatedButton';
import { ConfirmationModal } from '../ConfirmationModal';
import { MarkdownContent } from '../MarkdownContent';
import PreviewBadge from '../PreviewBadge';
import StatusGuard from '../StatusGuard';
import { AnalysisSummary } from './detail/AnalysisSummary';
import { ExecutionSummary } from './detail/ExecutionSummary';
import { RemediationOptionCard } from './detail/RemediationOptionCard';
import { RunPhaseLabel } from './detail/RunPhaseLabel';
import { RunTimeline } from './detail/RunTimeline';
import { StageInProgress } from './detail/StageInProgress';
import { VerificationSummary } from './detail/VerificationSummary';

const RunDetailPage: FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const navigate = useNavigate();
  const params = useParams<{ ns: string; name: string }>();
  const name = params.name ?? '';
  const namespace = params.ns;

  const {
    run,
    view,
    runLoaded,
    runError,
    resultsLoaded,
    resultsError,
    canApprove,
    canApproveLoading,
    approveExecution,
    denyExecution,
    mutationInProgress,
    mutationError,
    clearMutationError,
  } = useAgenticRun(name, namespace);

  const phaseKey = view?.phase ?? 'unknown';
  const [selectedOption, setSelectedOption] = useState(0);
  const [expandedOption, setExpandedOption] = useState(0);

  const executedOptionIndex = view?.executedOptionIndex;
  useEffect(() => {
    const idx = executedOptionIndex ?? 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedOption(idx);

    setExpandedOption(idx);
  }, [phaseKey, executedOptionIndex]);

  const selectOption = useCallback((idx: number) => {
    setSelectedOption(idx);
    setExpandedOption((prev) => (prev === idx ? -1 : idx));
  }, []);

  const [executeOptionIndex, setExecuteOptionIndex] = useState<number | null>(null);
  const [isDenyModalOpen, setIsDenyModalOpen] = useState(false);

  const openExecuteModal = useCallback(() => {
    setExecuteOptionIndex(selectedOption);
  }, [selectedOption]);

  const handleApproveExecution = useCallback(async () => {
    if (executeOptionIndex === null) return;
    const success = await approveExecution(executeOptionIndex);
    if (success) setExecuteOptionIndex(null);
  }, [approveExecution, executeOptionIndex]);

  const handleDenyExecution = useCallback(async () => {
    const success = await denyExecution();
    if (success) setIsDenyModalOpen(false);
  }, [denyExecution]);

  const optionData =
    executeOptionIndex !== null ? (view?.options[executeOptionIndex] ?? undefined) : undefined;

  const renderRemediationHub = (v: AgenticRunView): ReactNode => {
    switch (v.phase) {
      case 'Pending':
      case 'Analyzing':
        return (
          <Card>
            <CardBody>
              <Flex direction={{ default: 'column' }}>
                <FlexItem>
                  <Content component={ContentVariants.small}>
                    <em>{t('Remediation options will appear once analysis is complete.')}</em>
                  </Content>
                </FlexItem>
                <FlexItem>
                  <Skeleton screenreaderText={t('Loading remediation options')} width="70%" />
                </FlexItem>
                <FlexItem>
                  <Skeleton width="30%" />
                </FlexItem>
                <FlexItem>
                  <Skeleton width="50%" />
                </FlexItem>
              </Flex>
            </CardBody>
          </Card>
        );

      case 'NoActionRequired':
        return (
          <Alert variant="info" isInline title={t('No remediation needed')}>
            {t('Analysis determined that no action is required for this run.')}
          </Alert>
        );

      case 'Proposed':
        return (
          <>
            {v.options.length > 0 ? (
              <>
                {v.advisory && (
                  <Alert
                    variant="info"
                    isInline
                    title={t(
                      'This is an advisory-only run. Review the recommendations below and apply changes externally.',
                    )}
                  />
                )}
                {v.options.map((option) => (
                  <RemediationOptionCard
                    key={option.index}
                    option={option}
                    isExpanded={expandedOption === option.index}
                    isSelected={selectedOption === option.index}
                    onSelect={() => selectOption(option.index)}
                    onToggleExpand={() => selectOption(option.index)}
                    onExecute={v.advisory ? undefined : openExecuteModal}
                    canApprove={canApprove}
                    canApproveLoading={canApproveLoading}
                    mutationInProgress={mutationInProgress}
                  />
                ))}
              </>
            ) : (
              <EmptyState>
                <EmptyStateBody>
                  {t('No remediation options were generated by the analysis.')}
                </EmptyStateBody>
              </EmptyState>
            )}
            {!v.advisory && (
              <Flex>
                <FlexItem>
                  <ApprovalGatedButton
                    canApprove={canApprove}
                    canApproveLoading={canApproveLoading}
                    mutationInProgress={mutationInProgress}
                    onClick={() => setIsDenyModalOpen(true)}
                    variant="secondary"
                  >
                    {t('Deny Run')}
                  </ApprovalGatedButton>
                </FlexItem>
              </Flex>
            )}
          </>
        );

      case 'Executing':
        return (
          <>
            {renderOptionCards({ showSpinner: true })}
            {v.executionSandbox && (
              <StageInProgress
                title={t('Execution')}
                sandbox={v.executionSandbox}
                sinceTime={v.executionStartedAt}
              />
            )}
          </>
        );

      case 'Verifying':
        return (
          <>
            {renderOptionCards({})}
            {v.execution && <ExecutionSummary execution={v.execution} />}
            {v.verificationSandbox && (
              <StageInProgress
                title={t('Verification')}
                sandbox={v.verificationSandbox}
                sinceTime={v.verificationStartedAt}
              />
            )}
          </>
        );

      case 'Escalating':
      default:
        if (v.phase === 'Escalating' || TERMINAL_PHASES.includes(v.phase)) {
          return (
            <>
              {v.options.length > 0 && renderOptionCards({})}
              {v.execution && <ExecutionSummary execution={v.execution} />}
              {v.verification && <VerificationSummary verification={v.verification} />}
            </>
          );
        }
        return null;
    }
  };

  const renderOptionCards = (opts: { showSpinner?: boolean }) => {
    if (!view) return null;
    if (view.executedOptionIndex !== undefined && view.executedOptionIndex < view.options.length) {
      const executedOption = view.options[view.executedOptionIndex];
      if (executedOption) {
        return (
          <RemediationOptionCard
            option={executedOption}
            isExpanded={expandedOption === executedOption.index}
            isSelected
            onSelect={() => selectOption(executedOption.index)}
            onToggleExpand={() => selectOption(executedOption.index)}
            readOnly
            showSpinner={opts.showSpinner}
          />
        );
      }
    }
    return view.options.map((option) => (
      <RemediationOptionCard
        key={option.index}
        option={option}
        isExpanded={expandedOption === option.index}
        isSelected={selectedOption === option.index}
        onSelect={() => selectOption(option.index)}
        onToggleExpand={() => selectOption(option.index)}
        readOnly
        showSpinner={opts.showSpinner && selectedOption === option.index}
      />
    ));
  };

  return (
    <AgenticLayout>
      <DocumentTitle>
        {t('{{name}} details', { name: run?.metadata?.name || t('Run') })}
      </DocumentTitle>
      <StatusGuard
        data={run?.metadata?.name ? run : undefined}
        label={t('Run')}
        loaded={runLoaded}
        loadError={runError}
      >
        <PageGroup>
          <PageSection type="breadcrumb" hasBodyWrapper={false}>
            <Breadcrumb>
              <BreadcrumbItem
                to="#"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/lightspeed/runs');
                }}
              >
                {t('Agentic runs')}
              </BreadcrumbItem>
              <BreadcrumbItem isActive>{run?.metadata?.name ?? name}</BreadcrumbItem>
            </Breadcrumb>
          </PageSection>
          <PageSection hasBodyWrapper={false}>
            <Content>
              <Flex direction={{ default: 'column' }} gap={{ default: 'gapSm' }}>
                <Flex
                  spaceItems={{ default: 'spaceItemsSm' }}
                  alignItems={{ default: 'alignItemsCenter' }}
                >
                  <FlexItem>
                    <ResourceIcon groupVersionKind={LightspeedAgenticRunGVK} />
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h1">{run?.metadata?.name}</Title>
                  </FlexItem>
                  <FlexItem>
                    <PreviewBadge />
                  </FlexItem>
                </Flex>
                {view && (
                  <FlexItem>
                    <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                      <FlexItem>
                        <RunPhaseLabel phase={view.phase} />
                      </FlexItem>
                      {view.source && (
                        <FlexItem>
                          <Label variant="outline">{`${t('Trigger domain')}: ${view.source}`}</Label>
                        </FlexItem>
                      )}
                      {view.targetNamespaces?.map((ns) => (
                        <FlexItem key={ns}>
                          <Label variant="outline" color="blue">
                            {`${t('Namespace')}: ${ns}`}
                          </Label>
                        </FlexItem>
                      ))}
                    </Flex>
                  </FlexItem>
                )}
                <FlexItem>
                  <Content component={ContentVariants.small}>
                    {t('Created')} <Timestamp simple timestamp={run?.metadata?.creationTimestamp} />
                  </Content>
                </FlexItem>
                {view?.request && (
                  <FlexItem>
                    <Content component={ContentVariants.p}>{view.request}</Content>
                  </FlexItem>
                )}
              </Flex>
            </Content>

            {view?.failureReason && <Alert variant="danger" isInline title={view.failureReason} />}

            {resultsError && (
              <Alert variant="warning" isInline title={t('Unable to load analysis results.')} />
            )}
          </PageSection>

          <Divider />

          <PageSection hasBodyWrapper={false}>
            <Title headingLevel="h3">{t('Agentic run details')}</Title>

            <small>
              <Flex spaceItems={{ default: 'spaceItemsXs' }}>
                <FlexItem>
                  <InfoCircleIcon color="var(--pf-t--global--icon--color--status--info--default)" />
                </FlexItem>
                <FlexItem>
                  {t(
                    'The autonomous features of OpenShift Lightspeed use AI technology to generate output.',
                  )}
                  {t('Always review AI-generated content prior to use.')}
                </FlexItem>
              </Flex>
            </small>

            <Title headingLevel="h4">{t('Root cause analysis (RCA)')}</Title>
            {!resultsLoaded ? (
              <Skeleton screenreaderText={t('Loading root cause analysis')} />
            ) : view ? (
              <AnalysisSummary
                rootCause={view.rootCause}
                phase={view.phase}
                analysisSandbox={view.analysisSandbox}
                analysisStartedAt={view.analysisStartedAt}
              />
            ) : null}

            <Flex
              spaceItems={{ default: 'spaceItemsXs' }}
              direction={{ default: 'column' }}
              gap={{ default: 'gapXs' }}
            >
              <Flex>
                <FlexItem>
                  <Title headingLevel="h4">{t('Remediation hub')}</Title>
                </FlexItem>
                {resultsLoaded && view && view.phase === 'Proposed' && view.options.length > 0 && (
                  <FlexItem>
                    <Label variant="outline">
                      {t('{{count}} remediation options', { count: view.options.length })}
                    </Label>
                  </FlexItem>
                )}
              </Flex>
              {resultsLoaded && view?.analysisCreatedAt && (
                <FlexItem>
                  <Content component={ContentVariants.small}>
                    {t('Created')} <Timestamp simple timestamp={view.analysisCreatedAt} />
                  </Content>
                </FlexItem>
              )}
            </Flex>

            {!resultsLoaded ? (
              <Skeleton screenreaderText={t('Loading remediation options')} />
            ) : view ? (
              renderRemediationHub(view)
            ) : null}

            {resultsLoaded && view && view.timeline.length > 0 && (
              <>
                <Title headingLevel="h4">{t('Timeline')}</Title>
                <RunTimeline events={view.timeline} />
              </>
            )}
          </PageSection>
        </PageGroup>
      </StatusGuard>

      <ConfirmationModal
        isOpen={executeOptionIndex !== null}
        onClose={() => {
          setExecuteOptionIndex(null);
          clearMutationError();
        }}
        title={t('Execute remediation?')}
        body={
          <Flex direction={{ default: 'column' }}>
            <FlexItem>
              {t("You're about to run the automated script for Option {{ selectedOptionIndex }}", {
                selectedOptionIndex: executeOptionIndex !== null ? executeOptionIndex + 1 : 0,
              })}
              :{' '}
              <strong>
                <MarkdownContent inline text={optionData?.title ?? ''} />
              </strong>
            </FlexItem>
            {optionData?.reversibility && optionData.reversibility !== 'Reversible' && (
              <FlexItem>
                <Alert
                  variant="warning"
                  title={t('This action is {{ reversibility }}', {
                    reversibility: getReversibilityText(optionData?.reversibility ?? '', t),
                  })}
                >
                  <p>{getReversibilityDescription(optionData?.reversibility ?? '', t)}</p>
                </Alert>
              </FlexItem>
            )}
            <FlexItem>
              <Content component={ContentVariants.small}>
                {t(
                  'OpenShift Lightspeed uses AI technology to help generate this remediation plan.',
                )}
              </Content>
            </FlexItem>
            <FlexItem>
              <Content component={ContentVariants.small}>
                <Flex spaceItems={{ default: 'spaceItemsXs' }}>
                  <FlexItem>
                    <InfoCircleIcon color="var(--pf-t--global--icon--color--status--info--default)" />
                  </FlexItem>
                  <FlexItem>{t('Always review AI-generated content prior to use.')}</FlexItem>
                </Flex>
              </Content>
            </FlexItem>
          </Flex>
        }
        actionLabel={t('Execute remediation')}
        actionVariant="danger"
        onAction={handleApproveExecution}
        isLoading={mutationInProgress}
        error={mutationError}
      />

      <ConfirmationModal
        isOpen={isDenyModalOpen}
        onClose={() => {
          setIsDenyModalOpen(false);
          clearMutationError();
        }}
        title={t('Confirm remediation denial')}
        body={t(
          'Denying this run will cancel all proposed automated actions. The associated alerts must then be investigated and resolved manually.',
        )}
        actionLabel={t('Deny Run')}
        actionVariant="danger"
        onAction={handleDenyExecution}
        isLoading={mutationInProgress}
        error={mutationError}
      />
    </AgenticLayout>
  );
};

export default RunDetailPage;
