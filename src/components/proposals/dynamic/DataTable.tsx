import * as React from 'react';
import type { DataTableProps } from './types';

export const DataTable: React.FC<DataTableProps> = ({ columns, rows, monoFirstColumn }) => (
  <table className="ols-plugin__chat-evidence-table">
    <thead>
      <tr>
        {columns.map((col, i) => (
          <th key={i}>{col}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, ri) => (
        <tr key={ri}>
          {row.map((cell, ci) => (
            <td
              className={monoFirstColumn && ci === 0 ? 'ols-plugin__chat-evidence-mono' : undefined}
              key={ci}
            >
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);
