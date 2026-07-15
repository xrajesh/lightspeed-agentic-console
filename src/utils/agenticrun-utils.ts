export const buildPodLogUrl = (
  namespace: string,
  podName: string,
  params: Record<string, string>,
): string => {
  const qs = new URLSearchParams(params);
  return (
    `/api/kubernetes/api/v1/namespaces/${encodeURIComponent(namespace)}` +
    `/pods/${encodeURIComponent(podName)}/log?${qs.toString()}`
  );
};

export const getOutcomeStatus = (outcome: string): 'success' | 'danger' | 'warning' => {
  switch (outcome) {
    case 'Succeeded':
    case 'Improved':
    case 'Unchanged':
      return 'success';
    case 'Failed':
    case 'Degraded':
      return 'danger';
    default:
      return 'warning';
  }
};

export const getReversibilityColor = (
  reversibility: string,
): 'green' | 'orange' | 'yellow' | 'grey' => {
  switch (reversibility) {
    case 'Reversible':
      return 'green';
    case 'Irreversible':
      return 'orange';
    case 'Partial':
      return 'yellow';
    default:
      return 'grey';
  }
};
