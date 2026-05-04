import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core';

import {
  LightspeedProposal,
  LightspeedProposalApproval,
} from '../../models/proposal';
import { useStageApproval } from '../../hooks/useStageApproval';

const EscalateModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  proposal: LightspeedProposal;
  approval?: LightspeedProposalApproval;
}> = ({ isOpen, onClose, proposal, approval }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const escalation = useStageApproval(proposal, approval, 'Escalation');

  const onApprove = React.useCallback(async () => {
    await escalation.approve();
    if (!escalation.error) {
      onClose();
    }
  }, [escalation, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant={ModalVariant.small}>
      <ModalHeader title={t('Escalate Proposal')} />
      <ModalBody>
        <p>
          {t(
            'Approve the escalation step for proposal {{name}}. The agent will research the issue, draft a support case, and file it.',
            { name: proposal.metadata.name },
          )}
        </p>
        {escalation.error && (
          <>
            <br />
            <Alert isInline title={t('Failed to approve escalation')} variant="danger">
              {escalation.error}
            </Alert>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          isDisabled={escalation.inProgress || !approval}
          isLoading={escalation.inProgress}
          onClick={onApprove}
          variant="primary"
        >
          {t('Escalate')}
        </Button>
        <Button isDisabled={escalation.inProgress} onClick={onClose} variant="link">
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default EscalateModal;
