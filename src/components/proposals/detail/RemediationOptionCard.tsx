import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
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
  Spinner,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { AngleDownIcon, AngleRightIcon, DownloadIcon } from '@patternfly/react-icons';
import type { FC } from 'react';
import * as React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RemediationOptionView } from '../../../models/proposal-views';
import { getRiskColor } from '../../../models/proposal';
import { getReversibilityColor } from '../../../utils/proposal-utils';
import './detail.css';

interface RemediationOptionCardProps {
  option: RemediationOptionView;
  isExpanded: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onExecute?: () => void;
  onDeny?: () => void;
  canApprove?: boolean;
  canApproveLoading?: boolean;
  readOnly?: boolean;
  showSpinner?: boolean;
  mutationInProgress?: boolean;
}

export const RemediationOptionCard: FC<RemediationOptionCardProps> = ({
  option,
  isExpanded,
  isSelected,
  onSelect,
  onToggleExpand,
  onExecute,
  onDeny,
  canApprove = true,
  canApproveLoading,
  readOnly,
  showSpinner,
  mutationInProgress,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const handleDownloadPlan = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const blob = new Blob([JSON.stringify(option, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `remediation-option-${option.index + 1}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    [option],
  );

  return (
    <Card isSelectable={!readOnly} isSelected={isSelected}>
      <CardHeader
        selectableActions={
          readOnly
            ? undefined
            : {
                selectableActionId: `option-${option.index}`,
                selectableActionAriaLabel: t('Option {{number}}', { number: option.index + 1 }),
                name: 'remediation-option',
                variant: 'single',
                isHidden: true,
                onChange: () => onSelect(),
              }
        }
        onClick={() => {
          if (readOnly) onToggleExpand();
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (readOnly && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        role={readOnly ? 'button' : undefined}
        tabIndex={readOnly ? 0 : undefined}
        className="ols-plugin__remediation-card-header--clickable"
      >
        <Flex alignItems={{ default: 'alignItemsCenter' }}>
          {showSpinner ? (
            <FlexItem align={{ default: 'alignLeft' }}>
              <Spinner size="md" />
            </FlexItem>
          ) : (
            <FlexItem>{isExpanded ? <AngleDownIcon /> : <AngleRightIcon />}</FlexItem>
          )}
          <FlexItem>
            <CardTitle>
              {readOnly
                ? t('Selected option')
                : t('Option {{number}}', { number: option.index + 1 })}
            </CardTitle>
          </FlexItem>
          {option.risk && (
            <FlexItem>
              <Label variant="outline" color={getRiskColor(option.risk)}>
                {t('Risk')}: {option.risk}
              </Label>
            </FlexItem>
          )}
          {option.reversibility && (
            <FlexItem>
              <Label variant="outline" color={getReversibilityColor(option.reversibility)}>
                {t(
                  option.reversibility === 'Partial'
                    ? 'Partially reversible'
                    : option.reversibility,
                )}
              </Label>
            </FlexItem>
          )}
          <FlexItem>
            <Content component={ContentVariants.p}>
              <strong>{option.title}</strong>
            </Content>
          </FlexItem>
        </Flex>
      </CardHeader>
      {isExpanded && (
        <CardBody>
          <Content component={ContentVariants.p}>{option.description}</Content>

          <Flex gap={{ default: 'gapLg' }} direction={{ default: 'column' }}>
            {option.estimatedImpact && (
              <FlexItem>
                <Title headingLevel="h5">{t('Estimated impact')}</Title>
                <Content component={ContentVariants.p}>{option.estimatedImpact}</Content>
              </FlexItem>
            )}

            {option.actions && option.actions.length > 0 && (
              <FlexItem>
                <Title headingLevel="h5">{t('Proposed actions')}</Title>
                <Content component="ol">
                  {option.actions.map((action, i) => (
                    <Content component="li" key={i}>
                      <Label variant="outline" isCompact>
                        {action.type}
                      </Label>{' '}
                      {action.description}
                    </Content>
                  ))}
                </Content>
              </FlexItem>
            )}

            {(option.rollbackDescription || option.rollbackCommand) && (
              <FlexItem>
                <Title headingLevel="h5">{t('Rollback plan')}</Title>
                {option.rollbackDescription && (
                  <Content component={ContentVariants.p}>{option.rollbackDescription}</Content>
                )}
                {option.rollbackCommand && (
                  <ClipboardCopy isReadOnly isBlock>
                    {option.rollbackCommand}
                  </ClipboardCopy>
                )}
              </FlexItem>
            )}

            {option.verificationSteps && option.verificationSteps.length > 0 && (
              <FlexItem>
                <Title headingLevel="h5">{t('Verification steps')}</Title>
                {option.verificationDescription && (
                  <Content component={ContentVariants.p}>{option.verificationDescription}</Content>
                )}
                <DescriptionList>
                  {option.verificationSteps.map((step, i) => (
                    <DescriptionListGroup key={i}>
                      <DescriptionListTerm>{step.name}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {step.command && (
                          <ClipboardCopy isReadOnly isCode isBlock>
                            {step.command}
                          </ClipboardCopy>
                        )}
                        {step.expected && (
                          <Content component={ContentVariants.small}>
                            {t('Expected')}: {step.expected}
                          </Content>
                        )}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  ))}
                </DescriptionList>
              </FlexItem>
            )}

            <FlexItem>
              <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                {onExecute && (
                  <FlexItem>
                    <Tooltip
                      content={t(
                        'You must be a member of system:cluster-admins to approve or deny proposals.',
                      )}
                      trigger={!canApprove && !mutationInProgress ? undefined : 'manual'}
                    >
                      <Button
                        variant="primary"
                        onClick={onExecute}
                        isLoading={canApproveLoading || mutationInProgress}
                        isAriaDisabled={!canApprove || mutationInProgress}
                      >
                        {t('Execute remediation')}
                      </Button>
                    </Tooltip>
                  </FlexItem>
                )}
                {onDeny && (
                  <FlexItem>
                    <Tooltip
                      content={t(
                        'You must be a member of system:cluster-admins to approve or deny proposals.',
                      )}
                      trigger={!canApprove && !mutationInProgress ? undefined : 'manual'}
                    >
                      <Button
                        variant="secondary"
                        isDanger
                        onClick={onDeny}
                        isLoading={canApproveLoading}
                        isAriaDisabled={!canApprove || mutationInProgress}
                      >
                        {t('Deny')}
                      </Button>
                    </Tooltip>
                  </FlexItem>
                )}
                <FlexItem>
                  <Button variant="secondary" icon={<DownloadIcon />} onClick={handleDownloadPlan}>
                    {t('Download plan')}
                  </Button>
                </FlexItem>
              </Flex>
            </FlexItem>
          </Flex>
        </CardBody>
      )}
    </Card>
  );
};
