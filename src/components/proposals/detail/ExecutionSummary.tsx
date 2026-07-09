import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  ClipboardCopy,
  Content,
  ContentVariants,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Label,
  Skeleton,
  Title,
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from '@patternfly/react-icons';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useExecutionLogActions } from '../../../hooks/useExecutionLogActions';
import { ExecutionView } from '../../../models/proposal-views';
import { getOutcomeStatus } from '../../../utils/proposal-utils';
import { SandboxLogViewer } from './SandboxLogViewer';

interface ExecutionSummaryProps {
  execution: ExecutionView;
}

export const ExecutionSummary: FC<ExecutionSummaryProps> = ({ execution }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const hasActions = execution.actions.length > 0;
  const { actions: logActions, loading: logsLoading } = useExecutionLogActions(
    execution.executionSandbox,
    hasActions,
    execution.executionStartedAt,
  );

  const displayActions = hasActions ? execution.actions : logActions;

  return (
    <Card>
      <CardHeader>
        <Flex alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            {
              {
                success: (
                  <CheckCircleIcon color="var(--pf-t--global--icon--color--status--success--default)" />
                ),
                danger: (
                  <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />
                ),
                warning: (
                  <ExclamationTriangleIcon color="var(--pf-t--global--icon--color--status--warning--default)" />
                ),
              }[getOutcomeStatus(execution.outcome)]
            }
          </FlexItem>
          <FlexItem>
            <Title headingLevel="h4">{t('Execution')}</Title>
          </FlexItem>
        </Flex>
      </CardHeader>
      <CardBody>
        <Flex direction={{ default: 'column' }} gap={{ default: 'gapLg' }}>
          {execution.originalRootCause && (
            <FlexItem>
              <Content component={ContentVariants.small}>{t('CONTEXTUAL EVIDENCE')}</Content>
              <DescriptionList>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Original root cause')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {execution.originalRootCause}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                {execution.remediationDelta && (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Remediation delta')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {execution.remediationDelta}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                )}
              </DescriptionList>
            </FlexItem>
          )}

          {logsLoading && (
            <FlexItem>
              <Skeleton screenreaderText={t('Loading execution details')} />
            </FlexItem>
          )}

          {displayActions.length > 0 && (
            <FlexItem>
              <Flex direction={{ default: 'column' }} gap={{ default: 'gapSm' }}>
                <FlexItem>
                  <Title headingLevel="h5">{t('Actions taken')}</Title>
                </FlexItem>
                {displayActions.map((action, i) => (
                  <FlexItem key={i}>
                    <Card isCompact>
                      <CardBody>
                        <Flex gap={{ default: 'gapSm' }} direction={{ default: 'column' }}>
                          <FlexItem>
                            <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                              <FlexItem>
                                <Label isCompact variant="outline">
                                  {action.type}
                                </Label>
                              </FlexItem>
                              <FlexItem>
                                <Label
                                  isCompact
                                  status={action.outcome === 'Failed' ? 'danger' : 'success'}
                                >
                                  {action.outcome}
                                </Label>
                              </FlexItem>
                            </Flex>
                          </FlexItem>
                          <FlexItem>
                            <Content component={ContentVariants.p}>{action.description}</Content>
                          </FlexItem>
                          {action.error && (
                            <FlexItem>
                              <Alert variant="danger" isInline isPlain title={action.error} />
                            </FlexItem>
                          )}
                          {action.output && (
                            <FlexItem>
                              <ClipboardCopy isReadOnly isCode isBlock>
                                {action.output}
                              </ClipboardCopy>
                            </FlexItem>
                          )}
                        </Flex>
                      </CardBody>
                    </Card>
                  </FlexItem>
                ))}
              </Flex>
            </FlexItem>
          )}

          {execution.executionSandbox && (
            <FlexItem>
              <SandboxLogViewer
                title={t('Execution')}
                sandbox={execution.executionSandbox}
                sinceTime={execution.executionStartedAt}
              />
            </FlexItem>
          )}
        </Flex>
      </CardBody>
    </Card>
  );
};
