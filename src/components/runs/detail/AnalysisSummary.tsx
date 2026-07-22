import {
  Card,
  CardBody,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Skeleton,
} from '@patternfly/react-core';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AgenticRunPhase,
  RootCauseView,
  SandboxView,
  TERMINAL_PHASES,
} from '../../../models/agenticrun-views';
import { MarkdownContent } from '../../MarkdownContent';
import { SandboxLogViewer } from './SandboxLogViewer';

interface AnalysisSummaryProps {
  rootCause?: RootCauseView;
  phase: AgenticRunPhase;
  analysisSandbox?: SandboxView;
  analysisStartedAt?: string;
}

export const AnalysisSummary: FC<AnalysisSummaryProps> = ({
  rootCause,
  phase,
  analysisSandbox,
  analysisStartedAt,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  if (phase === 'Pending' || phase === 'Analyzing') {
    const isPending = phase === 'Pending';
    return (
      <>
        <Card>
          <CardBody>
            <Flex direction={{ default: 'column' }}>
              <FlexItem>
                <Content component={ContentVariants.small}>
                  <em>{isPending ? t('Waiting for analysis to start...') : t('Analyzing...')}</em>
                </Content>
              </FlexItem>
              <FlexItem>
                <Skeleton
                  screenreaderText={
                    isPending ? t('Waiting for analysis to start...') : t('Loading root cause')
                  }
                  width="70%"
                />
              </FlexItem>
              <FlexItem>
                <Skeleton width="40%" />
              </FlexItem>
              <FlexItem>
                <Skeleton width="50%" />
              </FlexItem>
              {!isPending && analysisSandbox && (
                <FlexItem>
                  <SandboxLogViewer
                    title={t('Analysis')}
                    sandbox={analysisSandbox}
                    sinceTime={analysisStartedAt}
                    streaming
                  />
                </FlexItem>
              )}
            </Flex>
          </CardBody>
        </Card>
      </>
    );
  }

  if (rootCause) {
    return (
      <Card>
        <CardBody>
          <Content component={ContentVariants.small}>
            <Flex>
              <FlexItem>{t('DETECTED ROOT CAUSE')}</FlexItem>
            </Flex>
          </Content>
          <MarkdownContent text={rootCause.cause} />
          <MarkdownContent text={rootCause.detail} />

          {analysisSandbox && (
            <SandboxLogViewer
              title={t('Analysis')}
              sandbox={analysisSandbox}
              sinceTime={analysisStartedAt}
            />
          )}
        </CardBody>
      </Card>
    );
  }

  if (TERMINAL_PHASES.includes(phase)) {
    return (
      <Card>
        <CardBody>
          <EmptyState>
            <EmptyStateBody>{t('Root cause analysis was not completed.')}</EmptyStateBody>
          </EmptyState>
          {analysisSandbox && (
            <SandboxLogViewer
              title={t('Analysis')}
              sandbox={analysisSandbox}
              sinceTime={analysisStartedAt}
            />
          )}
        </CardBody>
      </Card>
    );
  }

  return null;
};
