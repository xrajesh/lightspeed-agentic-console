import * as React from 'react';
import { Card, CardBody, CardTitle } from '@patternfly/react-core';
import type { StatusTimelineProps } from './types';
import { statusIcon } from './utils';

export const StatusTimeline: React.FC<{ data: StatusTimelineProps }> = ({ data }) => (
  <Card isCompact>
    <CardTitle>{data.title}</CardTitle>
    <CardBody>
      {data.events.map((event, i) => (
        <div className="ols-plugin__chat-timeline-event" key={i}>
          <div className="ols-plugin__chat-timeline-icon">{statusIcon(event.status)}</div>
          <div>
            <span className="ols-plugin__chat-timeline-time">{event.time}</span>
            <span className="ols-plugin__chat-timeline-label">{event.label}</span>
          </div>
        </div>
      ))}
    </CardBody>
  </Card>
);
