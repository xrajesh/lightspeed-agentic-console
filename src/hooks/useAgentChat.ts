import * as React from 'react';
import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';

import { AGENT_CHAT_URL } from '../config';
import { parseSSELine, type SSELineState } from '../utils/streaming';
import type { ChatMessage, MessageSegment } from './useChat';

export type { MessageSegment, ChatMessage } from './useChat';

interface UseAgentChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (_text: string) => void;
  stopStreaming: () => void;
  clearMessages: () => void;
}

const FLUSH_INTERVAL = 60; // Ms — debounce state updates for streaming feel

const MAX_MESSAGES = 200;

export interface AgentChatOptions {
  url?: string;
  context?: Record<string, unknown>;
}

export const useAgentChat = (options?: AgentChatOptions): UseAgentChatResult => {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isStreaming, _setIsStreaming] = React.useState(false);
  const isStreamingRef = React.useRef(false);
  const setIsStreaming = React.useCallback((v: boolean) => {
    isStreamingRef.current = v;
    _setIsStreaming(v);
  }, []);
  const [error, setError] = React.useState<string | null>(null);
  const conversationIdRef = React.useRef<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const optionsRef = React.useRef(options);
  React.useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Accumulator: segments queue + flush timer (avoids per-chunk re-renders)
  const pendingRef = React.useRef<MessageSegment[]>([]);
  const flushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPending = React.useCallback(() => {
    flushTimerRef.current = null;
    const pending = pendingRef.current;
    if (pending.length === 0) {
      return;
    }
    pendingRef.current = [];

    setMessages((prev) => {
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      const segments = [...last.segments];

      for (const seg of pending) {
        // Concatenate consecutive text/thinking segments
        const lastSeg = segments[segments.length - 1];
        if (seg.type === 'text' && lastSeg?.type === 'text') {
          segments[segments.length - 1] = {
            ...lastSeg,
            content: lastSeg.content + seg.content,
          };
        } else if (seg.type === 'thinking' && lastSeg?.type === 'thinking') {
          segments[segments.length - 1] = {
            ...lastSeg,
            content: lastSeg.content + seg.content,
          };
        } else {
          segments.push(seg);
        }
      }

      last.segments = segments;
      updated[updated.length - 1] = last;
      return updated;
    });
  }, []);

  const schedulePending = React.useCallback(
    (seg: MessageSegment) => {
      pendingRef.current.push(seg);
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(flushPending, FLUSH_INTERVAL);
      }
    },
    [flushPending],
  );

  const stopStreaming = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // Flush any remaining segments
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    flushPending();
    setIsStreaming(false);
  }, [flushPending, setIsStreaming]);

  const clearMessages = React.useCallback(() => {
    setMessages([]);
    conversationIdRef.current = null;
    setError(null);
    pendingRef.current = [];
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const sendMessage = React.useCallback(
    (text: string) => {
      if (!text.trim() || isStreamingRef.current) {
        return;
      }

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        segments: [{ type: 'text', content: text }],
        timestamp: Date.now(),
      };

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        segments: [],
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages((prev) => {
        const next = [...prev, userMsg, assistantMsg];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
      setIsStreaming(true);
      setError(null);
      pendingRef.current = [];

      const controller = new AbortController();
      abortRef.current = controller;

      const streamChat = async () => {
        try {
          const chatUrl = optionsRef.current?.url ?? AGENT_CHAT_URL;
          const chatContext = optionsRef.current?.context ?? {
            remediation: { name: 'chat', namespace: 'default' },
            alert: { name: 'user-query', status: 'none', severity: 'none' },
          };
          const response = await consoleFetch(
            chatUrl,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: text,
                conversationId: conversationIdRef.current ?? undefined,
                context: chatContext,
              }),
              signal: controller.signal,
            },
            180000,
          );

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();
          let buffer = '';
          const sseState: SSELineState = { eventType: '' };

          let done = false;
          while (!done) {
            const result = await reader.read();
            done = result.done;
            if (done) {
              break;
            }
            const { value } = result;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const event = parseSSELine(line, sseState);
              if (!event) {
                continue;
              }

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const parsed = event.data as any;
              try {
                  switch (event.type) {
                    case 'text':
                      schedulePending({ type: 'text', content: parsed.content });
                      break;
                    case 'thinking':
                      schedulePending({ type: 'thinking', content: parsed.content });
                      break;
                    case 'tool_call':
                      schedulePending({
                        type: 'tool_call',
                        name: parsed.name,
                        input: parsed.input,
                      });
                      break;
                    case 'tool_result':
                      schedulePending({ type: 'tool_result', output: parsed.output });
                      break;
                    case 'ui_component':
                      schedulePending({
                        type: 'ui_component',
                        componentType: parsed.type,
                        props: parsed.props,
                      });
                      break;
                    case 'done':
                      if (parsed.conversationId) {
                        conversationIdRef.current = parsed.conversationId;
                      }
                      break;
                    case 'error':
                      flushPending();
                      setError(parsed.message);
                      break;
                    default:
                      break;
                  }
                } catch {
                  // Skip unparseable event data
                }
            }
          }
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            setError((err as Error).message || 'Failed to connect to agent');
          }
        } finally {
          // Final flush
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          flushPending();
          setIsStreaming(false);
          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0) {
              const last = { ...updated[updated.length - 1] };
              last.isStreaming = false;
              updated[updated.length - 1] = last;
            }
            return updated;
          });
        }
      };

      streamChat();
    },
    [schedulePending, flushPending, setIsStreaming],
  );

  React.useEffect(
    () => () => {
      abortRef.current?.abort();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    },
    [],
  );

  return { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages };
};
