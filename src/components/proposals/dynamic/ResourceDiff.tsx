import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardBody, CardTitle, CodeBlock, CodeBlockCode, Label, Split, SplitItem } from '@patternfly/react-core';
import type { ResourceDiffProps } from './types';

export const ResourceDiff: React.FC<{ data: ResourceDiffProps }> = ({ data }) => {
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
            <div className="ols-plugin__chat-diff-label ols-plugin__chat-diff-label--before">{t('Before')}</div>
            <CodeBlock><CodeBlockCode>{beforeStr}</CodeBlockCode></CodeBlock>
          </SplitItem>
          <SplitItem isFilled>
            <div className="ols-plugin__chat-diff-label ols-plugin__chat-diff-label--after">{t('After')}</div>
            <CodeBlock><CodeBlockCode>{afterStr}</CodeBlockCode></CodeBlock>
          </SplitItem>
        </Split>
      </CardBody>
    </Card>
  );
};
