import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  k8sDelete,
  ListPageBody,
  ListPageFilter,
  ListPageHeader,
  ResourceIcon,
  ResourceLink,
  RowFilter,
  RowProps,
  TableColumn,
  TableData,
  Timestamp,
  useAccessReview,
  useK8sWatchResource,
  useListPageFilter,
  VirtualizedTable,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  Content,
  ContentVariants,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  Icon,
  Label,
  MenuToggle,
} from '@patternfly/react-core';
import { CogIcon, EllipsisVIcon, SearchIcon } from '@patternfly/react-icons';
import RhUiInformationFillIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-information-fill-icon';

import {
  AgenticRunCondition,
  AgenticRunK8s,
  derivePhaseFromConditions,
  getPhaseDisplay,
  LightspeedAgenticRunGVK,
  LightspeedAgenticRunModel,
} from '../../models/agenticrun';
import { RUN_LABEL_SOURCE } from '../../constants';
import AgenticLayout from '../AgenticLayout';
import { ConfirmationModal } from '../ConfirmationModal';
import PreviewBadge from '../PreviewBadge';

const getTriggerDomain = (obj: AgenticRunK8s): string =>
  obj.metadata?.labels?.[RUN_LABEL_SOURCE] || '';

const phaseFilter: RowFilter<AgenticRunK8s> = {
  filter: (filterValue, obj) => {
    const selected = filterValue?.selected || [];
    const phase = derivePhaseFromConditions(obj?.status?.conditions as AgenticRunCondition[]);
    return !selected.length || selected.includes(phase);
  },
  filterGroupName: 'Phase',
  items: [
    { id: 'Pending', title: 'Pending' },
    { id: 'Analyzing', title: 'Analyzing' },
    { id: 'Proposed', title: 'Proposed' },
    { id: 'NoActionRequired', title: 'No action required' },
    { id: 'Executing', title: 'Executing' },
    { id: 'Verifying', title: 'Verifying' },
    { id: 'Escalating', title: 'Escalating' },
    { id: 'Completed', title: 'Completed' },
    { id: 'Failed', title: 'Failed' },
    { id: 'Denied', title: 'Denied' },
    { id: 'Escalated', title: 'Escalated' },
    { id: 'EmergencyStopped', title: 'Emergency Stopped' },
  ],
  reducer: (obj) => derivePhaseFromConditions(obj?.status?.conditions as AgenticRunCondition[]),
  type: 'run-phase',
};

const RunKebab: React.FC<{
  obj: AgenticRunK8s;
  canDelete: boolean;
  onDelete: (obj: AgenticRunK8s) => void;
}> = ({ obj, canDelete, onDelete }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ position: 'right' }}
      toggle={(toggleRef) => (
        <MenuToggle
          aria-label={t('Actions for {{name}}', { name: obj.metadata.name })}
          ref={toggleRef}
          isExpanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          variant="plain"
        >
          <EllipsisVIcon />
        </MenuToggle>
      )}
    >
      <DropdownList>
        <DropdownItem
          isDisabled={!canDelete}
          key="delete"
          onClick={() => {
            setIsOpen(false);
            onDelete(obj);
          }}
        >
          {t('Delete')}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

const NoRunsMsg: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <EmptyState headingLevel="h2" icon={SearchIcon} titleText={t('No runs')}>
      <EmptyStateBody>
        {t('Runs are created by adapters or by user request. No runs have been created yet.')}
      </EmptyStateBody>
    </EmptyState>
  );
};

const FilteredEmptyMsg: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <EmptyState headingLevel="h2" icon={SearchIcon} titleText={t('No results found')}>
      <EmptyStateBody>
        {t('No runs match the current filters. Try adjusting your filters.')}
      </EmptyStateBody>
    </EmptyState>
  );
};

const RunListPage: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const navigate = useNavigate();

  const [runs, loaded, loadError] = useK8sWatchResource<AgenticRunK8s[]>({
    groupVersionKind: LightspeedAgenticRunGVK,
    isList: true,
    namespaced: true,
  });

  const [canDelete] = useAccessReview({
    group: LightspeedAgenticRunModel.apiGroup,
    resource: LightspeedAgenticRunModel.plural,
    verb: 'delete',
  });

  const [deleteTarget, setDeleteTarget] = React.useState<AgenticRunK8s | null>(null);
  const [deleteError, setDeleteError] = React.useState('');
  const [deleteInProgress, setDeleteInProgress] = React.useState(false);

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteInProgress(true);
    setDeleteError('');
    try {
      await k8sDelete({ model: LightspeedAgenticRunModel, resource: deleteTarget });
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteInProgress(false);
    }
  }, [deleteTarget]);

  const columns: TableColumn<AgenticRunK8s>[] = React.useMemo(
    () => [
      { id: 'name', sort: 'metadata.name', title: t('Name') },
      { id: 'namespace', sort: 'metadata.namespace', title: t('Namespace') },
      {
        id: 'trigger-domain',
        sort: (data, direction) =>
          [...data].sort((a, b) => {
            const cmp = getTriggerDomain(a).localeCompare(getTriggerDomain(b));
            return direction === 'desc' ? -cmp : cmp;
          }),
        title: t('Trigger domain'),
      },
      {
        id: 'phase',
        sort: (data, direction) =>
          [...data].sort((a, b) => {
            const pa = derivePhaseFromConditions(a.status?.conditions as AgenticRunCondition[]);
            const pb = derivePhaseFromConditions(b.status?.conditions as AgenticRunCondition[]);
            const cmp = pa.localeCompare(pb);
            return direction === 'desc' ? -cmp : cmp;
          }),
        title: t('Status'),
      },
      { id: 'tokens', sort: 'status.usage.totalTokens', title: t('Tokens consumed') },
      { id: 'age', sort: 'metadata.creationTimestamp', title: t('Created') },
      { id: '', props: { className: 'pf-v6-c-table__action' }, title: '' },
    ],
    [t],
  );

  const RunRow = React.useCallback<React.FC<RowProps<AgenticRunK8s>>>(
    ({ activeColumnIDs, obj }) => {
      const phase = getPhaseDisplay(
        derivePhaseFromConditions(obj.status?.conditions as AgenticRunCondition[]),
      );
      const detailPath = `/lightspeed/runs/${obj.metadata.namespace}/${obj.metadata.name}`;
      return (
        <>
          <TableData activeColumnIDs={activeColumnIDs} id="name">
            <ResourceIcon groupVersionKind={LightspeedAgenticRunGVK} />{' '}
            <Link to={detailPath}>{obj.metadata.name}</Link>
          </TableData>
          <TableData activeColumnIDs={activeColumnIDs} id="namespace">
            <ResourceLink kind="Namespace" name={obj.metadata.namespace} />
          </TableData>
          <TableData activeColumnIDs={activeColumnIDs} id="trigger-domain">
            {getTriggerDomain(obj) || '-'}
          </TableData>
          <TableData activeColumnIDs={activeColumnIDs} id="phase">
            <Label color={phase.color}>{phase.label}</Label>
          </TableData>
          <TableData activeColumnIDs={activeColumnIDs} id="tokens">
            {obj.status?.usage?.totalTokens?.toLocaleString() ?? '-'}
          </TableData>
          <TableData activeColumnIDs={activeColumnIDs} id="age">
            <Timestamp timestamp={obj.metadata.creationTimestamp} />
          </TableData>
          <TableData activeColumnIDs={activeColumnIDs} className="pf-v6-c-table__action" id="">
            <RunKebab canDelete={canDelete} obj={obj} onDelete={setDeleteTarget} />
          </TableData>
        </>
      );
    },
    [canDelete],
  );

  const filters: RowFilter<AgenticRunK8s>[] = React.useMemo(() => {
    const domainItems = Array.from(new Set((runs || []).map(getTriggerDomain).filter(Boolean)))
      .sort()
      .map((domain) => ({ id: domain, title: domain }));

    const triggerDomainFilter: RowFilter<AgenticRunK8s> = {
      filter: (filterValue, obj) => {
        const selected = filterValue?.selected || [];
        return !selected.length || selected.includes(getTriggerDomain(obj));
      },
      filterGroupName: t('Trigger domain'),
      items: domainItems,
      reducer: getTriggerDomain,
      type: 'trigger-domain',
    };

    return [phaseFilter, triggerDomainFilter];
  }, [runs, t]);

  const [data, filteredData, onFilterChange] = useListPageFilter(runs, filters);

  return (
    <AgenticLayout>
      <ListPageHeader
        badge={<PreviewBadge />}
        helpText={
          <Content component={ContentVariants.small}>
            <Icon status="info">
              <RhUiInformationFillIcon />
            </Icon>{' '}
            {t(
              'The autonomous features of OpenShift Lightspeed use AI technology to generate output. Always review AI-generated content prior to use.',
            )}
          </Content>
        }
        title={t('Agentic runs')}
      >
        <Button
          aria-label={t('Configuration')}
          onClick={() => navigate('/lightspeed/configuration')}
          variant="plain"
        >
          <CogIcon />
        </Button>
      </ListPageHeader>
      <ListPageBody>
        <ListPageFilter
          data={data}
          loaded={loaded}
          onFilterChange={onFilterChange}
          rowFilters={filters}
        />
        <VirtualizedTable<AgenticRunK8s>
          columns={columns}
          data={filteredData}
          EmptyMsg={FilteredEmptyMsg}
          loaded={loaded}
          loadError={loadError}
          NoDataEmptyMsg={NoRunsMsg}
          Row={RunRow}
          unfilteredData={data}
        />
      </ListPageBody>

      <ConfirmationModal
        actionLabel={t('Delete')}
        actionVariant="danger"
        body={t('Are you sure you want to delete this agentic run? This action cannot be undone.')}
        error={deleteError}
        isLoading={deleteInProgress}
        isOpen={deleteTarget !== null}
        onAction={handleDelete}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        title={t('Delete agentic run')}
      />
    </AgenticLayout>
  );
};

export default RunListPage;
