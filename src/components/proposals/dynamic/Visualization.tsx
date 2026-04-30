import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@patternfly/react-core';
import {
  Chart,
  ChartArea,
  ChartAxis,
  ChartGroup,
  ChartLegend,
  ChartLine,
  ChartStack,
  ChartThemeColor,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import { QueryBrowser } from '@openshift-console/dynamic-plugin-sdk';

import type { VisualizationProps } from './types';
import { DataTable } from './DataTable';
import { CHART_COLORS, formatTime, formatValue, resolveTimespan } from './utils';

const StaticChart: React.FC<{ data: VisualizationProps }> = ({ data }) => {
  const series = data.series!;
  const chartType = data.chartType ?? 'area';
  const isStack = data.isStack ?? false;

  const hasTimestamps = React.useMemo(
    () => series.some((s) => s.values.some((v) => v.timestamp !== undefined)),
    [series],
  );

  const { legendData, yDomain } = React.useMemo(() => {
    const allValues = series.flatMap((s) => s.values.map((v) => v.value));
    const maxVal = Math.max(...allValues, 1);
    const minVal = Math.min(...allValues, 0);
    return {
      legendData: series.map((s, i) => ({
        name: s.label,
        symbol: { fill: CHART_COLORS[i % CHART_COLORS.length] },
      })),
      yDomain: [Math.min(minVal, 0), maxVal * 1.1] as [number, number],
    };
  }, [series]);

  const xTickFormat = React.useCallback(
    (t: number) => {
      if (hasTimestamps) return formatTime(t);
      const labels = series[0]?.values.map((v) => v.label) || [];
      return labels[t - 1] || '';
    },
    [hasTimestamps, series],
  );

  const yTickFormat = React.useCallback((v: number) => formatValue(v, data.units), [data.units]);
  const tooltipLabel = React.useCallback(
    ({ datum }: { datum: { name: string; y: number } }) =>
      `${datum.name}: ${formatValue(datum.y, data.units)}`,
    [data.units],
  );

  const ChartComp = chartType === 'line' ? ChartLine : ChartArea;
  const GroupComp = isStack ? ChartStack : ChartGroup;

  return (
    <div className="ols-plugin__chat-chart-container">
      <Chart
        containerComponent={<ChartVoronoiContainer constrainToVisibleArea labels={tooltipLabel} />}
        domain={{ y: yDomain }}
        height={200}
        legendComponent={<ChartLegend gutter={20} orientation="horizontal" />}
        legendData={legendData}
        legendPosition="bottom"
        padding={{ top: 10, right: 20, bottom: 40, left: 60 }}
        scale={hasTimestamps ? { x: 'time', y: 'linear' } : undefined}
        themeColor={ChartThemeColor.multiUnordered}
      >
        <ChartAxis
          label={data.xLabel}
          style={{ tickLabels: { fontSize: 10, angle: hasTimestamps ? -30 : 0 } }}
          tickFormat={xTickFormat}
          tickValues={hasTimestamps ? undefined : series[0]?.values.map((_, i) => i + 1)}
        />
        <ChartAxis
          dependentAxis
          label={data.yLabel}
          showGrid
          style={{
            tickLabels: { fontSize: 10 },
            grid: {
              stroke: 'var(--pf-t--global--border--color--default, #d2d2d2)',
              strokeDasharray: '3,3',
            },
          }}
          tickFormat={yTickFormat}
        />
        <GroupComp>
          {series.map((s, si) => {
            const color = CHART_COLORS[si % CHART_COLORS.length];
            return (
              <ChartComp
                data={s.values.map((v, vi) => ({
                  x: hasTimestamps ? new Date(v.timestamp!) : vi + 1,
                  y: v.value,
                  name: s.label,
                }))}
                key={si}
                name={s.label}
                style={{
                  data:
                    chartType === 'area'
                      ? { fill: color, fillOpacity: 0.15, stroke: color, strokeWidth: 2 }
                      : { stroke: color, strokeWidth: 2 },
                }}
              />
            );
          })}
        </GroupComp>
      </Chart>
    </div>
  );
};

export const Visualization: React.FC<{ data: VisualizationProps }> = ({ data }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  if (data.queries && data.queries.length > 0) {
    const timespan = resolveTimespan(data.timespan);
    return (
      <>
        {data.summary && <DataTable columns={data.summary.columns} rows={data.summary.rows} />}
        <div className="ols-plugin__chat-chart-container">
          <QueryBrowser
            defaultTimespan={timespan ?? 30 * 60 * 1000}
            isStack={data.isStack}
            namespace={data.namespace}
            pollInterval={30000}
            queries={data.queries}
            showLegend={data.showLegend ?? true}
            units={data.units}
          />
        </div>
      </>
    );
  }

  if (!data.series?.length) {
    return <Alert isInline title={t('No queries or series data provided')} variant="warning" />;
  }

  return <StaticChart data={data} />;
};
