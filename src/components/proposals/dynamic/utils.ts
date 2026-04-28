import * as React from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, InfoCircleIcon } from '@patternfly/react-icons';

export const TIMESPAN_PRESETS: Record<string, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '2d': 2 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

export const CHART_COLORS = [
  'var(--pf-t--chart--color--blue--300, #06c)',
  'var(--pf-t--chart--color--red--300, #c9190b)',
  'var(--pf-t--chart--color--green--300, #3e8635)',
  'var(--pf-t--chart--color--gold--300, #f0ab00)',
  'var(--pf-t--chart--color--purple--300, #8561c5)',
  'var(--pf-t--chart--color--cyan--300, #009596)',
];

export function formatValue(v: number, units?: string): string {
  if (units === 'bytes') {
    if (v >= 1e12) return `${(v / 1e12).toFixed(1)} TiB`;
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)} GiB`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)} MiB`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)} KiB`;
    return `${v} B`;
  }
  if (units === 'percent') return `${v.toFixed(1)}%`;
  if (units === 'ms') return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v.toFixed(0)}ms`;
  if (units === 'seconds') {
    if (v >= 86400) return `${(v / 86400).toFixed(1)}d`;
    if (v >= 3600) return `${(v / 3600).toFixed(1)}h`;
    if (v >= 60) return `${(v / 60).toFixed(1)}m`;
    return `${v.toFixed(1)}s`;
  }
  return v.toFixed(2);
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function resolveTimespan(value?: number | string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  return TIMESPAN_PRESETS[value] ?? undefined;
}

export const statusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return React.createElement(CheckCircleIcon, { className: 'ols-plugin__chat-icon--success' });
    case 'danger':
      return React.createElement(ExclamationCircleIcon, { className: 'ols-plugin__chat-icon--danger' });
    default:
      return React.createElement(InfoCircleIcon, { className: 'ols-plugin__chat-icon--info' });
  }
};

export const severityColor = (severity: string): 'red' | 'orange' | 'blue' => {
  switch (severity) {
    case 'blocker': return 'red';
    case 'warning': return 'orange';
    default: return 'blue';
  }
};

export const sanitizeK8sName = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/-+$/, '');
