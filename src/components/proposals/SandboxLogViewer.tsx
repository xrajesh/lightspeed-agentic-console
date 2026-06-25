import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { consoleFetch, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { Label, Switch } from '@patternfly/react-core';

import './sandbox-log-viewer.css';

type LogStatus = 'searching' | 'waiting' | 'streaming' | 'ended' | 'error' | 'reconnecting';

type Pod = {
  metadata?: { name?: string };
  status?: { phase?: string };
};

const AGENT_CONTAINER = 'agent';
const TAIL_LINES = 1000;
const MAX_LOG_LENGTH = 512 * 1024;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const RFC3339_TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/;

const statusLabel = (status: LogStatus, t: (_s: string) => string) => {
  switch (status) {
    case 'searching':
      return { color: 'grey' as const, text: t('Searching for pod') };
    case 'waiting':
      return { color: 'blue' as const, text: t('Pod starting') };
    case 'streaming':
      return { color: 'green' as const, text: t('Live') };
    case 'ended':
      return { color: 'grey' as const, text: t('Stream ended') };
    case 'reconnecting':
      return { color: 'orange' as const, text: t('Reconnecting...') };
    case 'error':
      return { color: 'red' as const, text: t('Connection error') };
    default:
      return { color: 'grey' as const, text: t('Unknown') };
  }
};

const SandboxLogViewer: React.FC<{
  podName: string;
  podNamespace: string;
}> = ({ podName, podNamespace }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [logs, setLogs] = React.useState('');
  const [status, setStatus] = React.useState<LogStatus>('searching');
  const [autoScroll, setAutoScroll] = React.useState(true);
  const preRef = React.useRef<HTMLPreElement>(null);
  const logChunksRef = React.useRef<string[]>([]);
  const flushTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  const flushLogChunks = React.useCallback(() => {
    const chunks = logChunksRef.current;
    if (chunks.length === 0) return;
    logChunksRef.current = [];
    const joined = chunks.join('');
    setLogs((prev) => {
      const updated = prev + joined;
      if (updated.length > MAX_LOG_LENGTH) {
        const trimAt = updated.indexOf('\n', updated.length - MAX_LOG_LENGTH);
        return trimAt > 0 ? updated.slice(trimAt + 1) : updated.slice(-MAX_LOG_LENGTH);
      }
      return updated;
    });
  }, []);

  const podWatch = React.useMemo(
    () => ({
      groupVersionKind: { group: '', kind: 'Pod', version: 'v1' },
      name: podName,
      namespace: podNamespace,
    }),
    [podName, podNamespace],
  );

  const [pod, podLoaded] = useK8sWatchResource<Pod>(podWatch);
  const podPhase = pod?.status?.phase;
  const podExists = podLoaded && !!pod?.metadata?.name;

  React.useEffect(() => {
    if (!podExists) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus((prev) => (prev === 'streaming' || prev === 'ended' ? 'ended' : 'searching'));
    } else if (podPhase === 'Pending') {
      setStatus('waiting');
    }
  }, [podExists, podPhase]);

  React.useEffect(() => {
    if (!podExists || podPhase !== 'Running') {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('streaming');
    setLogs('');
    const abortController = new AbortController();
    const state = { lastTimestamp: '' };

    const streamOnce = async () => {
      const params = new URLSearchParams({
        container: AGENT_CONTAINER,
        follow: 'true',
        timestamps: 'true',
      });
      if (state.lastTimestamp) {
        params.set('sinceTime', state.lastTimestamp);
      } else {
        params.set('tailLines', String(TAIL_LINES));
      }
      const url =
        `/api/kubernetes/api/v1/namespaces/${encodeURIComponent(podNamespace)}` +
        `/pods/${encodeURIComponent(podName)}` +
        `/log?${params.toString()}`;

      const response = await consoleFetch(url, {
        signal: abortController.signal,
      });

      const reader = (response as Response).body?.getReader();
      if (!reader) {
        const text = await (response as Response).text();
        setLogs((prev) => prev + text);
        return false; // No streaming support, don't reconnect
      }

      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        // Extract the last RFC3339 timestamp for reconnection
        const lines = chunk.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          const tsMatch = lines[i].match(RFC3339_TIMESTAMP_RE);
          if (tsMatch) {
            state.lastTimestamp = tsMatch[1];
            break;
          }
        }
        logChunksRef.current.push(chunk);
        if (!flushTimerRef.current) {
          flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = undefined;
            flushLogChunks();
          }, 200);
        }
      }
      flushLogChunks();
      return true; // Stream ended gracefully, may reconnect
    };

    // Final non-follow fetch to capture any remaining buffered output
    // that wasn't flushed before the follow stream ended.
    const fetchRemainingLogs = async () => {
      if (abortController.signal.aborted) {
        return;
      }
      try {
        const params = new URLSearchParams({
          container: AGENT_CONTAINER,
          follow: 'false',
          timestamps: 'true',
          tailLines: String(TAIL_LINES),
        });
        const url =
          `/api/kubernetes/api/v1/namespaces/${encodeURIComponent(podNamespace)}` +
          `/pods/${encodeURIComponent(podName)}` +
          `/log?${params.toString()}`;
        const response = await consoleFetch(url, {
          signal: abortController.signal,
        });
        const text = await (response as Response).text();
        if (text) {
          setLogs(text); // Replace with complete logs
        }
      } catch {
        // Pod may already be gone — that's fine
      }
    };

    const streamWithReconnect = async () => {
      let delay = RECONNECT_BASE_MS;
      for (;;) {
        try {
          setStatus('streaming');
          const canReconnect = await streamOnce();
          if (abortController.signal.aborted || !canReconnect) {
            await fetchRemainingLogs();
            setStatus('ended');
            return;
          }
          // Graceful stream end (server closed) — fetch remaining then reconnect
          await fetchRemainingLogs();
          delay = RECONNECT_BASE_MS;
        } catch {
          if (abortController.signal.aborted) {
            return;
          }
          // Stream error — try to fetch remaining before reconnecting
          await fetchRemainingLogs();
          setStatus('reconnecting');
        }
        // Wait before reconnecting
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay);
          abortController.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
        if (abortController.signal.aborted) {
          return;
        }
        delay = Math.min(delay * 2, RECONNECT_MAX_MS);
      }
    };

    streamWithReconnect();

    return () => {
      abortController.abort();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = undefined;
      }
      flushLogChunks();
    };
  }, [podExists, podName, podNamespace, podPhase, flushLogChunks]);

  React.useEffect(() => {
    if (autoScroll && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [autoScroll, logs]);

  const badge = statusLabel(status, t);

  return (
    <div className="ols-plugin__sandbox-log-container">
      <div className="ols-plugin__sandbox-log-header">
        <Label color={badge.color}>{badge.text}</Label>
        <Switch
          id="auto-scroll"
          isChecked={autoScroll}
          label={t('Auto-scroll')}
          onChange={(_, checked) => setAutoScroll(checked)}
        />
      </div>
      <pre className="ols-plugin__sandbox-log-pre" ref={preRef}>
        {logs || (status === 'searching' ? t('Waiting for sandbox pod...') : '')}
      </pre>
    </div>
  );
};

export default SandboxLogViewer;
