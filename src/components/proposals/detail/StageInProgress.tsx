import { Card, CardBody, CardHeader, Flex, FlexItem, Spinner, Title } from '@patternfly/react-core';
import type { FC } from 'react';
import { SandboxView } from '../../../models/proposal-views';
import { SandboxLogViewer } from './SandboxLogViewer';

interface StageInProgressProps {
  title: string;
  sandbox: SandboxView;
  sinceTime?: string;
}

export const StageInProgress: FC<StageInProgressProps> = ({ title, sandbox, sinceTime }) => (
  <Card>
    <CardHeader>
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <Spinner size="md" />
        </FlexItem>
        <FlexItem>
          <Title headingLevel="h4">{title}</Title>
        </FlexItem>
      </Flex>
    </CardHeader>
    <CardBody>
      <SandboxLogViewer title={title} sandbox={sandbox} sinceTime={sinceTime} streaming />
    </CardBody>
  </Card>
);
