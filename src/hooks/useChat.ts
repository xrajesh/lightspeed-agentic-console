import * as React from 'react';
import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';

import { buildChatUrl } from '../config';

export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'ui_component'; componentType: string; props: Record<string, unknown> }
  | { type: 'tool_call'; name: string; input: string }
  | { type: 'tool_result'; output: string }
  | { type: 'thinking'; content: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  segments: MessageSegment[];
  timestamp: number;
  isStreaming?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (_text: string) => void;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export interface ChatConfig {
  sandboxPod?: string;
  sandboxNamespace: string;
  context: Record<string, unknown>;
}

const STREAM_TIMEOUT_MS = 180000;

export function useChat(config: ChatConfig): UseChatReturn {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const conversationIdRef = React.useRef<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const sendMessage = React.useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) {
        return;
      }

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        segments: [{ type: 'text', content: text }],
        timestamp: Date.now(),
      };

      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        segments: [],
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);
      setError(null);

      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      const streamChat = async () => {
        try {
          const body = {
            message: text,
            conversationId: conversationIdRef.current ?? undefined,
            context: config.context,
          };

          const sandboxPod = config.sandboxPod;
          const sandboxNs = config.sandboxNamespace;
          if (!sandboxPod) {
            throw new Error('No sandbox available for chat');
          }

          const response = await consoleFetch(
            buildChatUrl(sandboxPod, sandboxNs),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              signal: abortController.signal,
            },
            STREAM_TIMEOUT_MS,
          );

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response stream available');
          }

          const decoder = new TextDecoder();
          let buffer = '';

          for (;;) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';

            for (const part of parts) {
              if (!part.trim() || part.startsWith(':')) {
                continue;
              }

              const eventMatch = part.match(/^event:\s*(.+)$/m);
              const dataMatch = part.match(/^data:\s*(.+)$/m);
              if (!eventMatch || !dataMatch) {
                continue;
              }

              const eventType = eventMatch[1].trim();
              let data: Record<string, unknown>;
              try {
                data = JSON.parse(dataMatch[1].trim());
              } catch {
                continue;
              }

              let segment: MessageSegment | null = null;
              let streamDone = false;

              switch (eventType) {
                case 'text':
                  segment = { type: 'text', content: data.content as string };
                  break;
                case 'ui_component':
                  segment = {
                    type: 'ui_component',
                    componentType: data.type as string,
                    props: data.props as Record<string, unknown>,
                  };
                  break;
                case 'tool_call':
                  segment = {
                    type: 'tool_call',
                    name: data.name as string,
                    input: data.input as string,
                  };
                  break;
                case 'tool_result':
                  segment = { type: 'tool_result', output: data.output as string };
                  break;
                case 'thinking':
                  segment = { type: 'thinking', content: data.content as string };
                  break;
                case 'done':
                  if (data.conversationId) {
                    conversationIdRef.current = data.conversationId as string;
                  }
                  streamDone = true;
                  break;
                case 'error':
                  setError(data.message as string);
                  streamDone = true;
                  break;
                default:
                  break;
              }

              if (segment || streamDone) {
                setMessages((prev) => {
                  const lastIdx = prev.length - 1;
                  if (lastIdx < 0 || prev[lastIdx].id !== assistantId) {
                    return prev;
                  }
                  const target = prev[lastIdx];
                  const updated: ChatMessage = {
                    ...target,
                    segments: segment ? [...target.segments, segment] : target.segments,
                    isStreaming: !streamDone,
                  };
                  const next = prev.slice();
                  next[lastIdx] = updated;
                  return next;
                });
              }
            }
          }

          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            if (lastIdx < 0 || prev[lastIdx].id !== assistantId || !prev[lastIdx].isStreaming) {
              return prev;
            }
            const next = prev.slice();
            next[lastIdx] = { ...prev[lastIdx], isStreaming: false };
            return next;
          });
        } catch (err) {
          if (abortController.signal.aborted) {
            return;
          }
          const errMsg = err instanceof Error ? err.message : String(err);
          setError(errMsg);
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            if (lastIdx < 0 || prev[lastIdx].id !== assistantId) {
              return prev;
            }
            const next = prev.slice();
            next[lastIdx] = { ...prev[lastIdx], isStreaming: false };
            return next;
          });
        } finally {
          setIsLoading(false);
        }
      };

      streamChat();
    },
    [isLoading, config],
  );

  React.useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const clearError = React.useCallback(() => setError(null), []);

  return { messages, sendMessage, isLoading, error, clearError };
}
