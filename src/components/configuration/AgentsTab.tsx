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
  AgentK8s,
  LightspeedAgentGVK,
  LightspeedAgentModel,
  LightspeedLLMProviderGVK,
  LLMProviderK8s,
} from '../../models/agenticrun';
import AgentForm from './AgentForm';

const AgentsTab: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const [agents, agentsLoaded, agentsError] = useK8sWatchResource<AgentK8s[]>({
    groupVersionKind: LightspeedAgentGVK,
    isList: true,
  });

  const [providers, providersLoaded] = useK8sWatchResource<LLMProviderK8s[]>({
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
        model: LightspeedAgentModel,
        data: {
          apiVersion: 'agentic.openshift.io/v1alpha1',
          kind: 'Agent',
          metadata: { name },
          spec,
        },
      });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (agent: AgentK8s) => {
    setError('');
    setOpenKebab(null);
    try {
      await k8sDelete({ model: LightspeedAgentModel, resource: agent });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!agentsLoaded || !providersLoaded) {
    return <Spinner size="lg" />;
  }

  return (
    <>
      {(error || agentsError) && (
        <Alert variant="danger" isInline title={t('Error')}>
          {error || String(agentsError)}
        </Alert>
      )}

      <div className="ols-plugin__config-table-actions">
        <Button variant="primary" onClick={() => setShowForm(true)} isDisabled={showForm}>
          {t('Create Agent')}
        </Button>
      </div>

      <Table variant="compact">
        <Thead>
          <Tr>
            <Th>{t('Name')}</Th>
            <Th>{t('LLM Provider')}</Th>
            <Th>{t('Model')}</Th>
            <Th>{t('Max Turns')}</Th>
            <Th>{t('Age')}</Th>
            <Th />
          </Tr>
        </Thead>
        <Tbody>
          {agents?.length ? (
            agents.map((a) => (
              <Tr key={a.metadata.name}>
                <Td>{a.metadata.name}</Td>
                <Td>{a.spec.llmProvider?.name}</Td>
                <Td>{a.spec.model}</Td>
                <Td>{a.spec.maxTurns ?? '-'}</Td>
                <Td>
                  <Timestamp timestamp={a.metadata.creationTimestamp} />
                </Td>
                <Td isActionCell>
                  <Dropdown
                    isOpen={openKebab === a.metadata.name}
                    onOpenChange={(open) => setOpenKebab(open ? a.metadata.name : null)}
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        variant="plain"
                        onClick={() =>
                          setOpenKebab(openKebab === a.metadata.name ? null : a.metadata.name)
                        }
                        isExpanded={openKebab === a.metadata.name}
                      >
                        <EllipsisVIcon />
                      </MenuToggle>
                    )}
                    popperProps={{ position: 'right' }}
                  >
                    <DropdownList>
                      <DropdownItem key="delete" onClick={() => handleDelete(a)}>
                        {t('Delete')}
                      </DropdownItem>
                    </DropdownList>
                  </Dropdown>
                </Td>
              </Tr>
            ))
          ) : (
            <Tr>
              <Td colSpan={6}>{t('No agents found.')}</Td>
            </Tr>
          )}
        </Tbody>
      </Table>

      {showForm && (
        <AgentForm
          providers={providers || []}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}
    </>
  );
};

export default AgentsTab;
