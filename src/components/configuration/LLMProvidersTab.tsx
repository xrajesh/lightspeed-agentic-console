import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  k8sCreate,
  k8sDelete,
  Timestamp,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  Spinner,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';

import {
  LightspeedLLMProviderGVK,
  LightspeedLLMProviderModel,
  LLMProviderK8s,
} from '../../models/agenticrun';
import LLMProviderForm from './LLMProviderForm';

const LLMProvidersTab: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const [providers, loaded, loadError] = useK8sWatchResource<LLMProviderK8s[]>({
    groupVersionKind: LightspeedLLMProviderGVK,
    isList: true,
  });

  const [showForm, setShowForm] = React.useState(false);
  const [error, setError] = React.useState('');
  const [openKebab, setOpenKebab] = React.useState<string | null>(null);

  const handleCreate = async (name: string, spec: Record<string, unknown>) => {
    setError('');
    try {
      await k8sCreate({
        model: LightspeedLLMProviderModel,
        data: {
          apiVersion: 'agentic.openshift.io/v1alpha1',
          kind: 'LLMProvider',
          metadata: { name },
          spec,
        },
      });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (provider: LLMProviderK8s) => {
    setError('');
    setOpenKebab(null);
    try {
      await k8sDelete({ model: LightspeedLLMProviderModel, resource: provider });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!loaded) {
    return <Spinner size="lg" />;
  }

  return (
    <>
      {(error || loadError) && (
        <Alert variant="danger" isInline title={t('Error')}>
          {error || String(loadError)}
        </Alert>
      )}

      <div className="ols-plugin__config-table-actions">
        <Button variant="primary" onClick={() => setShowForm(true)} isDisabled={showForm}>
          {t('Create LLM Provider')}
        </Button>
      </div>

      <Table variant="compact">
        <Thead>
          <Tr>
            <Th>{t('Name')}</Th>
            <Th>{t('Type')}</Th>
            <Th>{t('Created')}</Th>
            <Th />
          </Tr>
        </Thead>
        <Tbody>
          {providers?.length ? (
            providers.map((p) => (
              <Tr key={p.metadata.name}>
                <Td>{p.metadata.name}</Td>
                <Td>{p.spec.type}</Td>
                <Td>
                  <Timestamp timestamp={p.metadata.creationTimestamp} />
                </Td>
                <Td isActionCell>
                  <Dropdown
                    isOpen={openKebab === p.metadata.name}
                    onOpenChange={(open) => setOpenKebab(open ? p.metadata.name : null)}
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        variant="plain"
                        onClick={() =>
                          setOpenKebab(openKebab === p.metadata.name ? null : p.metadata.name)
                        }
                        isExpanded={openKebab === p.metadata.name}
                      >
                        <EllipsisVIcon />
                      </MenuToggle>
                    )}
                    popperProps={{ position: 'right' }}
                  >
                    <DropdownList>
                      <DropdownItem key="delete" onClick={() => handleDelete(p)}>
                        {t('Delete')}
                      </DropdownItem>
                    </DropdownList>
                  </Dropdown>
                </Td>
              </Tr>
            ))
          ) : (
            <Tr>
              <Td colSpan={4}>{t('No LLM providers found.')}</Td>
            </Tr>
          )}
        </Tbody>
      </Table>

      {showForm && <LLMProviderForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />}
    </>
  );
};

export default LLMProvidersTab;
