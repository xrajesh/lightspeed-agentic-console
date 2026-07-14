import {
  Card,
  CardBody,
  CardHeader,
  Content,
  ContentVariants,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Label,
  Title,
} from '@patternfly/react-core';
import { CheckCircleIcon, ExclamationCircleIcon } from '@patternfly/react-icons';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { VerificationView } from '../../../models/agenticrun-views';
import { renderMarkdown } from '../../../utils/markdown';
import { SandboxLogViewer } from './SandboxLogViewer';

interface VerificationSummaryProps {
  verification: VerificationView;
}

export const VerificationSummary: FC<VerificationSummaryProps> = ({ verification }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const allPassed =
    verification.checks.length > 0 && verification.checks.every((c) => c.result === 'Passed');
  const anyFailed = verification.checks.some((c) => c.result === 'Failed');

  return (
    <Card>
      <CardHeader>
        <Flex alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            {anyFailed ? (
              <ExclamationCircleIcon
                aria-label={t('Failed')}
                color="var(--pf-t--global--icon--color--status--danger--default)"
              />
            ) : allPassed ? (
              <CheckCircleIcon
                aria-label={t('Passed')}
                color="var(--pf-t--global--icon--color--status--success--default)"
              />
            ) : (
              <CheckCircleIcon
                aria-label={t('In progress')}
                color="var(--pf-t--global--icon--color--status--info--default)"
              />
            )}
          </FlexItem>
          <FlexItem>
            <Title headingLevel="h4">{t('Verification summary')}</Title>
          </FlexItem>
        </Flex>
      </CardHeader>
      <CardBody>
        <Flex direction={{ default: 'column' }} gap={{ default: 'gapLg' }}>
          {verification.summary && (
            <FlexItem>
              <Content
                component={ContentVariants.p}
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(verification.summary),
                }}
              />
            </FlexItem>
          )}

          {verification.checks.length > 0 && (
            <FlexItem>
              <Title headingLevel="h5">{t('Verification checks')}</Title>
              <DescriptionList>
                {verification.checks.map((check, i) => (
                  <DescriptionListGroup key={i}>
                    <DescriptionListTerm>
                      <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                        <FlexItem>{check.name}</FlexItem>
                        <FlexItem>
                          <Label
                            isCompact
                            status={
                              check.result === 'Passed'
                                ? 'success'
                                : check.result === 'Failed'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {check.result}
                          </Label>
                        </FlexItem>
                        <FlexItem>
                          <Label isCompact variant="outline">
                            {check.source}
                          </Label>
                        </FlexItem>
                      </Flex>
                    </DescriptionListTerm>
                    <DescriptionListDescription>
                      <span dangerouslySetInnerHTML={{ __html: renderMarkdown(check.value) }} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                ))}
              </DescriptionList>
            </FlexItem>
          )}

          {verification.failureReason && (
            <FlexItem>
              <Content component={ContentVariants.p}>
                <strong>{t('Failure reason')}:</strong>{' '}
                <span
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(verification.failureReason),
                  }}
                />
              </Content>
            </FlexItem>
          )}

          {verification.verificationSandbox && (
            <FlexItem>
              <SandboxLogViewer
                title={t('Verification')}
                sandbox={verification.verificationSandbox}
                sinceTime={verification.verificationStartedAt}
              />
            </FlexItem>
          )}
        </Flex>
      </CardBody>
    </Card>
  );
};
