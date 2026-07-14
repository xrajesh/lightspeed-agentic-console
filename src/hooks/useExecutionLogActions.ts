import { useCallback, useEffect, useRef, useState } from 'react';
import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { ExecutionActionView, SandboxView } from '../models/agenticrun-views';
import { buildPodLogUrl } from '../utils/agenticrun-utils';

interface ExecutionLogActionsResult {
  actions: ExecutionActionView[];
  loading: boolean;
  error?: string;
}

export const useExecutionLogActions = (
  sandbox?: SandboxView,
  skip?: boolean,
  sinceTime?: string,
): ExecutionLogActionsResult => {
  const [actions, setActions] = useState<ExecutionActionView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  const podName = sandbox?.podName;
  const namespace = sandbox?.namespace;

  const doFetch = useCallback(
    (signal: { cancelled: boolean }, ac: AbortController) => {
      if (!podName || !namespace) return;

      const urlParams: Record<string, string> = sinceTime ? { sinceTime } : { tailLines: '500' };
      const url = buildPodLogUrl(namespace, podName, urlParams);

      consoleFetch(url, { signal: ac.signal })
        .then(async (response) => response.text())
        .then((logText: string) => {
          if (signal.cancelled) return;
          let lastActions: ExecutionActionView[] | undefined;
          for (const line of logText.split('\n')) {
            try {
              const entry = JSON.parse(line);
              if (entry.event === 'audit.agent.text' && entry.phase === 'execution' && entry.text) {
                const result = JSON.parse(entry.text);
                if (result.actionsTaken) {
                  lastActions = result.actionsTaken;
                }
              }
            } catch {
              /* skip non-JSON lines */
            }
          }
          if (lastActions) setActions(lastActions);
        })
        .catch((err) => {
          if (signal.cancelled) return;
          const msg = (err as Error)?.message;
          if (msg === 'The user aborted a request.') return;
          setError(msg || 'Failed to load logs');
        })
        .finally(() => {
          if (!signal.cancelled) setLoading(false);
        });
    },
    [podName, namespace, sinceTime],
  );

  useEffect(() => {
    if (skip || !podName || !namespace) return;

    const signal = { cancelled: false };
    const ac = new AbortController();
    abortRef.current = ac;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(undefined);
    setActions([]);
    doFetch(signal, ac);

    return () => {
      signal.cancelled = true;
      ac.abort();
    };
  }, [skip, podName, namespace, doFetch]);

  return { actions, loading, error };
};
