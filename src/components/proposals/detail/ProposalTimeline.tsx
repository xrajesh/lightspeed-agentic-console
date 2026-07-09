import { Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { ProgressStep, ProgressStepper } from '@patternfly/react-core';
import type { FC } from 'react';
import { TimelineEvent } from '../../../models/proposal-views';

interface ProposalTimelineProps {
  events: TimelineEvent[];
}

export const ProposalTimeline: FC<ProposalTimelineProps> = ({ events }) => (
  <ProgressStepper isVertical>
    {events.map((event, i) => (
      <ProgressStep
        key={i}
        id={`timeline-step-${i}`}
        titleId={`timeline-step-title-${i}`}
        variant={event.variant}
        isCurrent={event.isCurrent}
        description={
          <>
            {event.timestamp && <Timestamp simple timestamp={event.timestamp} />}
            {event.description && <> — {event.description}</>}
          </>
        }
      >
        {event.label}
      </ProgressStep>
    ))}
  </ProgressStepper>
);
