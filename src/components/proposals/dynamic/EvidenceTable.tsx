import * as React from 'react';
import { Card, CardBody, CardTitle } from '@patternfly/react-core';
import type { EvidenceTableProps } from './types';
import { DataTable } from './DataTable';

export const EvidenceTable: React.FC<{ data: EvidenceTableProps }> = ({ data }) => (
  <Card isCompact>
    <CardTitle>{data.title}</CardTitle>
    <CardBody className="ols-plugin__chat-evidence-body">
      <DataTable columns={data.columns} monoFirstColumn rows={data.rows} />
    </CardBody>
  </Card>
);
