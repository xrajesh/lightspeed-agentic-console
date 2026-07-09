import type { FC } from 'react';
import {
  Alert,
  Button,
  Content,
  ContentVariants,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  body: string;
  actionLabel: string;
  actionVariant: 'primary' | 'danger';
  onAction: () => void | Promise<void>;
  isLoading: boolean;
  error?: string;
}

export const ConfirmationModal: FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  title,
  body,
  actionLabel,
  actionVariant,
  onAction,
  isLoading,
  error,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="small" aria-label={title}>
      <ModalHeader title={title} />
      <ModalBody>
        <Content component={ContentVariants.p}>{body}</Content>
        {error && <Alert variant="danger" isInline title={error} />}
      </ModalBody>
      <ModalFooter>
        <Button
          variant={actionVariant}
          onClick={onAction}
          isLoading={isLoading}
          isDisabled={isLoading}
        >
          {actionLabel}
        </Button>
        <Button variant="link" onClick={onClose} isDisabled={isLoading}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
