import * as React from 'react';
import { useTranslation } from 'react-i18next';
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
import { getRiskColor } from '../../../models/proposal';
import type { RevisedProposalProps, RevisedVerificationProps, RevisedRbacProps } from './types';
import type { PermissionRule } from '../../../models/proposal';

export const RevisedProposal: React.FC<{
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

export const RevisedVerification: React.FC<{
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

export const RevisedRbac: React.FC<{
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
