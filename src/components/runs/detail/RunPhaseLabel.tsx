import { Label } from '@patternfly/react-core';
import type { FC } from 'react';
import { getPhaseDisplay } from '../../../models/agenticrun';
import { AgenticRunPhase } from '../../../models/agenticrun-views';

export const RunPhaseLabel: FC<{ phase: AgenticRunPhase }> = ({ phase }) => {
  const display = getPhaseDisplay(phase);
  return <Label color={display.color}>{display.label}</Label>;
};
