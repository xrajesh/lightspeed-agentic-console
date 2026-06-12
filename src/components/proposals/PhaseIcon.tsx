import * as React from 'react';
import {
  BanIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  HourglassStartIcon,
  InProgressIcon,
  SearchIcon,
  TimesCircleIcon,
} from '@patternfly/react-icons';

import { ProposalPhase } from '../../models/proposal';

const PhaseIcon: React.FC<{
  phase?: ProposalPhase | string;
  executionFailed?: boolean;
  verificationFailed?: boolean;
}> = ({ phase, executionFailed, verificationFailed }) => {
  switch (phase) {
    case 'Pending':
      return <HourglassStartIcon />;
    case 'Analyzing':
      return <SearchIcon />;
    case 'Executing':
      return <InProgressIcon />;
    case 'Completed': {
      if (executionFailed || verificationFailed) {
        return (
          <ExclamationTriangleIcon color="var(--pf-t--global--icon--color--severity--warning--default)" />
        );
      }
      return (
        <CheckCircleIcon color="var(--pf-t--global--icon--color--severity--success--default)" />
      );
    }
    case 'Failed':
      return (
        <TimesCircleIcon color="var(--pf-t--global--icon--color--severity--danger--default)" />
      );
    case 'Denied':
      return (
        <TimesCircleIcon color="var(--pf-t--global--icon--color--severity--danger--default)" />
      );
    case 'Escalated':
      return (
        <ExclamationCircleIcon color="var(--pf-t--global--icon--color--severity--warning--default)" />
      );
    case 'Escalating':
      return (
        <InProgressIcon color="var(--pf-t--global--icon--color--severity--warning--default)" />
      );
    case 'EmergencyStopped':
      return <BanIcon color="var(--pf-t--global--icon--color--severity--custom--default)" />;
    default:
      return <HourglassStartIcon />;
  }
};

export default PhaseIcon;
