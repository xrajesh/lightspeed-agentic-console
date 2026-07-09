import { Label } from '@patternfly/react-core';
import type { FC } from 'react';
import { ProposalPhase } from '../../../models/proposal-views';
import { getPhaseDisplay } from '../../../models/proposal';

export const ProposalPhaseLabel: FC<{ phase: ProposalPhase }> = ({ phase }) => {
  const display = getPhaseDisplay(phase);
  return <Label color={display.color}>{display.label}</Label>;
};
