import type { FC, ReactNode } from 'react';
import { Button, Tooltip } from '@patternfly/react-core';
import type { ButtonProps } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

interface ApprovalGatedButtonProps {
  canApprove: boolean;
  canApproveLoading?: boolean;
  mutationInProgress?: boolean;
  onClick: () => void;
  variant?: ButtonProps['variant'];
  isDanger?: boolean;
  children: ReactNode;
}

export const ApprovalGatedButton: FC<ApprovalGatedButtonProps> = ({
  canApprove,
  canApproveLoading,
  mutationInProgress,
  onClick,
  variant = 'primary',
  isDanger,
  children,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <Tooltip
      content={t("You don't have permission to approve or deny runs.")}
      trigger={!canApprove && !canApproveLoading && !mutationInProgress ? undefined : 'manual'}
    >
      <Button
        variant={variant}
        isDanger={isDanger}
        onClick={onClick}
        isLoading={canApproveLoading || mutationInProgress}
        isAriaDisabled={!canApprove || mutationInProgress}
      >
        {children}
      </Button>
    </Tooltip>
  );
};
