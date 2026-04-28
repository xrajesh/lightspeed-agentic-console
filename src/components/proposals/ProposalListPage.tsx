import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  K8sResourceCommon,
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
import { EmptyState, EmptyStateBody, Label } from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';

import {
  getPhaseDisplay,
  LightspeedProposal,
  LightspeedProposalGVK,
  ProposalPhase,
} from '../../models/proposal';

type ProposalResource = LightspeedProposal & K8sResourceCommon;

const columns: TableColumn<ProposalResource>[] = [
  { id: 'name', sort: 'metadata.name', title: 'Name' },
  { id: 'workflow', sort: 'spec.workflow', title: 'Workflow' },
  { id: 'phase', sort: 'status.phase', title: 'Phase' },
  { id: 'request', title: 'Request' },
  { id: 'namespace', sort: 'metadata.namespace', title: 'Namespace' },
  { id: 'age', sort: 'metadata.creationTimestamp', title: 'Age' },
];

const filters: RowFilter<ProposalResource>[] = [
  {
    filter: (filterValue, obj) => {
      const selected = filterValue?.selected || [];
      const phase = obj?.status?.phase || 'Pending';
      return !selected.length || selected.includes(phase);
    },
    filterGroupName: 'Phase',
    items: [
      { id: 'Pending', title: 'Pending' },
      { id: 'Analyzing', title: 'Analyzing' },
      { id: 'Proposed', title: 'Proposed' },
      { id: 'Executing', title: 'Executing' },
      { id: 'AwaitingSync', title: 'Awaiting Sync' },
      { id: 'Validating', title: 'Validating' },
      { id: 'Completed', title: 'Completed' },
      { id: 'Failed', title: 'Failed' },
      { id: 'Denied', title: 'Denied' },
      { id: 'Escalated', title: 'Escalated' },
    ],
    reducer: (obj) => (obj.status?.phase as ProposalPhase) || 'Pending',
    type: 'proposal-phase',
  },
];

const ProposalRow: React.FC<RowProps<ProposalResource>> = ({ activeColumnIDs, obj }) => {
  const phase = getPhaseDisplay(obj.status?.phase);
  const detailPath = `/lightspeed/proposals/${obj.metadata.namespace}/${obj.metadata.name}`;
  const requestPreview =
    obj.spec.request.length > 80 ? `${obj.spec.request.substring(0, 80)}...` : obj.spec.request;

  return (
    <>
      <TableData activeColumnIDs={activeColumnIDs} id="name">
        <Link to={detailPath}>
          <ResourceLink
            groupVersionKind={LightspeedProposalGVK}
            linkTo={false}
            name={obj.metadata.name}
            namespace={obj.metadata.namespace}
          />
        </Link>
      </TableData>
      <TableData activeColumnIDs={activeColumnIDs} id="workflow">
        <Label color="blue">{obj.spec.workflow}</Label>
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

const NoProposalsMsg: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <EmptyState headingLevel="h2" icon={SearchIcon} titleText={t('No proposals')}>
      <EmptyStateBody>
        {t(
          'Proposals are created by workflows or by user request. No proposals have been created yet.',
        )}
      </EmptyStateBody>
    </EmptyState>
  );
};

const FilteredEmptyMsg: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <EmptyState headingLevel="h2" icon={SearchIcon} titleText={t('No results found')}>
      <EmptyStateBody>
        {t('No proposals match the current filters. Try adjusting your filters.')}
      </EmptyStateBody>
    </EmptyState>
  );
};

const ProposalListPage: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const [proposals, loaded, loadError] = useK8sWatchResource<ProposalResource[]>({
    groupVersionKind: LightspeedProposalGVK,
    isList: true,
    namespaced: true,
  });

  const [data, filteredData, onFilterChange] = useListPageFilter(proposals, filters);

  return (
    <>
      <ListPageHeader title={t('AI Hub')} />
      <ListPageBody>
        <ListPageFilter
          data={data}
          loaded={loaded}
          onFilterChange={onFilterChange}
          rowFilters={filters}
        />
        <VirtualizedTable<ProposalResource>
          columns={columns}
          data={filteredData}
          EmptyMsg={FilteredEmptyMsg}
          loaded={loaded}
          loadError={loadError}
          NoDataEmptyMsg={NoProposalsMsg}
          Row={ProposalRow}
          unfilteredData={data}
        />
      </ListPageBody>
    </>
  );
};

export default ProposalListPage;
