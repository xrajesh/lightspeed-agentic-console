import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  ListPageBody,
  ListPageFilter,
  ListPageHeader,
  ResourceLink,
  RowFilter,
  RowProps,
  TableColumn,
  TableData,
  Timestamp,
  useK8sWatchResource,
  useListPageFilter,
  VirtualizedTable,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateBody,
  Icon,
  Label,
} from '@patternfly/react-core';
import { CogIcon, SearchIcon } from '@patternfly/react-icons';
import RhUiInformationFillIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-information-fill-icon';

import {
  AgenticRunCondition,
  AgenticRunK8s,
  derivePhaseFromConditions,
  getPhaseDisplay,
  LightspeedAgenticRunGVK,
} from '../../models/agenticrun';
import AgenticLayout from '../AgenticLayout';
import PreviewBadge from '../PreviewBadge';

const columns: TableColumn<AgenticRunK8s>[] = [
  { id: 'name', sort: 'metadata.name', title: 'Name' },
  { id: 'phase', title: 'Phase' },
  { id: 'request', title: 'Request' },
  { id: 'namespace', sort: 'metadata.namespace', title: 'Namespace' },
  { id: 'age', sort: 'metadata.creationTimestamp', title: 'Age' },
];

const filters: RowFilter<AgenticRunK8s>[] = [
  {
    filter: (filterValue, obj) => {
      const selected = filterValue?.selected || [];
      const phase = derivePhaseFromConditions(obj?.status?.conditions as AgenticRunCondition[]);
      return !selected.length || selected.includes(phase);
    },
    filterGroupName: 'Phase',
    items: [
      { id: 'Pending', title: 'Pending' },
      { id: 'Analyzing', title: 'Analyzing' },
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
  },
];

const RunRow: React.FC<RowProps<AgenticRunK8s>> = ({ activeColumnIDs, obj }) => {
  const phase = getPhaseDisplay(
    derivePhaseFromConditions(obj.status?.conditions as AgenticRunCondition[]),
  );
  const detailPath = `/lightspeed/runs/${obj.metadata.namespace}/${obj.metadata.name}`;
  const requestPreview =
    obj.spec.request.length > 80 ? `${obj.spec.request.substring(0, 80)}...` : obj.spec.request;

  return (
    <>
      <TableData activeColumnIDs={activeColumnIDs} id="name">
        <Link to={detailPath}>
          <ResourceLink
            groupVersionKind={LightspeedAgenticRunGVK}
            linkTo={false}
            name={obj.metadata.name}
            namespace={obj.metadata.namespace}
          />
        </Link>
      </TableData>
      <TableData activeColumnIDs={activeColumnIDs} id="phase">
        <Label color={phase.color}>{phase.label}</Label>
      </TableData>
      <TableData activeColumnIDs={activeColumnIDs} id="request">
        {requestPreview}
      </TableData>
      <TableData activeColumnIDs={activeColumnIDs} id="namespace">
        <ResourceLink kind="Namespace" name={obj.metadata.namespace} />
      </TableData>
      <TableData activeColumnIDs={activeColumnIDs} id="age">
        <Timestamp timestamp={obj.metadata.creationTimestamp} />
      </TableData>
    </>
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

  const [data, filteredData, onFilterChange] = useListPageFilter(runs, filters);

  return (
    <AgenticLayout>
      <ListPageHeader
        badge={<PreviewBadge />}
        helpText={
          <>
            <Content component={ContentVariants.p}>
              {t(
                'Speed up incident response with automated investigations, evidence collection, and remediation.',
              )}
            </Content>
            <Content component={ContentVariants.small}>
              <Icon status="info">
                <RhUiInformationFillIcon />
              </Icon>{' '}
              {t('Always review AI-generated content prior to use.')}
            </Content>
          </>
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
    </AgenticLayout>
  );
};

export default RunListPage;
