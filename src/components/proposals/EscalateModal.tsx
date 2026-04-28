import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { k8sCreate } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core';

import {
  EscalationTrigger,
  LightspeedProposal,
  LightspeedProposalModel,
} from '../../models/proposal';

const EscalateModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  proposal: LightspeedProposal;
}> = ({ isOpen, onClose, proposal }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [trigger, setTrigger] = React.useState<EscalationTrigger>('remediation_failed');
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onCreate = React.useCallback(async () => {
    setCreating(true);
    setError(null);
    const suffix = Date.now().toString(36);
    try {
      await k8sCreate({
        data: {
          apiVersion: `${LightspeedProposalModel.apiGroup}/${LightspeedProposalModel.apiVersion}`,
          kind: LightspeedProposalModel.kind,
          metadata: {
            labels: {
              'ols.openshift.io/escalation-trigger': trigger,
              'ols.openshift.io/parent': proposal.metadata.name,
            },
            name: `${proposal.metadata.name}-esc-${suffix}`,
            namespace: proposal.metadata.namespace,
          },
          spec: {
            parentRef: proposal.metadata.name,
            request: `Escalate proposal ${proposal.metadata.name}: ${proposal.spec.request}`,
            targetNamespaces: proposal.spec.targetNamespaces,
            workflow: proposal.spec.workflow,
          },
        },
        model: LightspeedProposalModel,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }, [onClose, proposal, trigger]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant={ModalVariant.small}>
      <ModalHeader title={t('Escalate Proposal')} />
      <ModalBody>
        <p>
          {t(
            'Create an escalation proposal. The agent will research the issue, draft a support case, and file it.',
          )}
        </p>
        <br />
        <FormGroup fieldId="trigger" isRequired label={t('Trigger')}>
          <FormSelect
            id="trigger"
            onChange={(_e, val) => setTrigger(val as EscalationTrigger)}
            value={trigger}
          >
            <FormSelectOption label={t('Platform Bug')} value="platform_bug" />
            <FormSelectOption label={t('Remediation Failed')} value="remediation_failed" />
            <FormSelectOption label={t('Workaround Applied')} value="workaround_applied" />
            <FormSelectOption label={t('Recurring Issue')} value="recurring_issue" />
            <FormSelectOption label={t('Manual')} value="manual" />
          </FormSelect>
        </FormGroup>
        {error && (
          <Alert isInline title={t('Failed to create escalation')} variant="danger">
            {error}
          </Alert>
        )}
      </ModalBody>
      <ModalFooter>
        <Button isDisabled={creating} isLoading={creating} onClick={onCreate} variant="primary">
          {t('Escalate')}
        </Button>
        <Button isDisabled={creating} onClick={onClose} variant="link">
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default EscalateModal;
