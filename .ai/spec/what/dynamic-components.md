# Dynamic Components

The plugin renders adapter-defined structured data from analysis results using a component registry pattern. Adapters (like the cluster-monitoring-operator adapter) can return typed component payloads that the console renders as rich UI elements.

## Behavioral Rules

### Component Registry

1. The plugin recognizes these component types: `lightspeed_prometheus_query`, `lightspeed_metrics_chart`, `lightspeed_resource_diff`, `lightspeed_action_picker`, `lightspeed_evidence_table`, `lightspeed_status_timeline`, `cmo_alert_diagnosis`, `cmo_metric_evidence`, `cmo_remediation_step`, `cmo_trigger_run`.
2. Known component types are rendered by their corresponding React component. Unknown types fall back to a JSON code block display.
3. Components are passed as `AdapterComponent` objects — a type field plus arbitrary key-value data.

### Visualization Components

4. `lightspeed_metrics_chart` renders as a line or area chart using Victory, with configurable units (bytes, percent, ms, seconds), time span, and legend.
5. `lightspeed_prometheus_query` renders Prometheus query results as metric cards or charts, fetching live data from the cluster's Prometheus via the console proxy.
6. `lightspeed_resource_diff` shows a side-by-side before/after comparison of Kubernetes resource fields.
7. `lightspeed_action_picker` presents remediation options as selectable cards with risk indicators.
8. `lightspeed_evidence_table` renders tabular evidence data with column headers.
9. `lightspeed_status_timeline` shows a vertical timeline of events with status-colored indicators.

### CMO-Specific Components

10. `cmo_alert_diagnosis` renders alert diagnosis details including alert name, severity, root cause, evidence list, and affected resources.
11. `cmo_metric_evidence` renders a single metric data point with query, value, threshold, and status.
12. `cmo_remediation_step` renders an ordered remediation step with action, commands, and risk level.
13. `cmo_trigger_run` renders a PrometheusRule run showing the PromQL expression, tested status, severity, duration, and description.

## Constraints

- New component types require adding to both the `KNOWN_COMPONENT_TYPES` set in `ProposalDetailPage.tsx` and implementing the renderer in `src/components/proposals/dynamic/`.
- The `components` field on `RemediationOption` is typed as `unknown` to allow pass-through from the operator without coupling to specific adapter schemas.
