import type { FC, ReactNode } from 'react';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { ErrorState } from '@patternfly/react-component-groups';
import { HttpError } from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';

interface StatusGuardProps {
  data: unknown;
  loaded: boolean;
  loadError: Error | undefined;
  label: string;
  children: ReactNode;
}

const getErrorCode = (error: Error): number | undefined =>
  error instanceof HttpError ? error.code : undefined;

const StatusGuard: FC<StatusGuardProps> = ({ data, loaded, loadError, label, children }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  if (loadError) {
    const code = getErrorCode(loadError);
    if (code === 403) {
      return (
        <ErrorState
          titleText={t('Restricted access')}
          bodyText={t("You don't have permission to view this {{label}}.", { label })}
        />
      );
    }
    if (code === 404) {
      return <ErrorState status="none" titleText={t('{{label}} not found', { label })} />;
    }
    return (
      <ErrorState
        titleText={t('Unable to load {{label}}', { label })}
        bodyText={loadError.message}
      />
    );
  }

  if (!loaded) {
    return (
      <Bullseye>
        <Spinner aria-label={t('Loading {{label}}', { label })} />
      </Bullseye>
    );
  }

  if (!data) {
    return <ErrorState status="none" titleText={t('{{label}} not found', { label })} />;
  }

  return <>{children}</>;
};

export default StatusGuard;
