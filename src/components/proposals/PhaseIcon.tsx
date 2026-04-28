import * as React from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  HourglassStartIcon,
  InProgressIcon,
  SearchIcon,
  SyncAltIcon,
  TimesCircleIcon,
} from '@patternfly/react-icons';

import { ProposalPhase } from '../../models/proposal';

const PhaseIcon: React.FC<{ phase?: ProposalPhase | string }> = ({ phase }) => {
  switch (phase) {
    case 'Pending':
      return <HourglassStartIcon />;
    case 'Analyzing':
    case 'Validating':
      return <SearchIcon />;
    case 'Proposed':
    case 'Approved':
      return (
        <ExclamationTriangleIcon color="var(--pf-t--global--icon--color--severity--warning--default)" />
      );
    case 'Executing':
      return <InProgressIcon />;
    case 'AwaitingSync':
      return <SyncAltIcon color="var(--pf-t--global--icon--color--severity--info--default)" />;
    case 'Completed':
      return (
        <CheckCircleIcon color="var(--pf-t--global--icon--color--severity--success--default)" />
      );
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
    default:
      return <HourglassStartIcon />;
  }
};

export default PhaseIcon;
