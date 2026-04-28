import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { renderMarkdown } from '../../utils/markdown';
import DynamicComponent from '../proposals/DynamicComponent';
import type { ChatMessage as ChatMessageType, MessageSegment } from '../../hooks/useChat';

interface ChatMessageProps {
  message: ChatMessageType;
  onFork?: (_messageId: string) => void;
  onSendMessage?: (_text: string) => void;
  onAction?: (_action: string, _data: Record<string, unknown>) => void;
}

function linkifyResourceNames(container: HTMLElement): void {
  container.querySelectorAll('table').forEach((table) => {
    const headerCells = table.querySelectorAll('th');
    if (headerCells.length === 0) {
      return;
    }
    const headers = Array.from(headerCells).map((th) => th.textContent?.toLowerCase().trim() || '');

    const nameColIdx = headers.findIndex(
      (h) => h === 'name' || h === 'node' || h === 'namespace' || h === 'pod',
    );
    if (nameColIdx === -1) {
      return;
    }

    table.querySelectorAll('tbody tr').forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length <= nameColIdx) {
        return;
      }
      const cell = cells[nameColIdx];
      if (cell.querySelector('.ols-plugin__chat-resource-link')) {
        return;
      }

      const name = cell.textContent?.trim();
      if (!name) {
        return;
      }

      const span = document.createElement('span');
      span.className = 'ols-plugin__chat-resource-link';
      span.setAttribute('data-resource', name);
      span.setAttribute('data-header', headers[nameColIdx]);
      span.textContent = name;
      cell.textContent = '';
      cell.appendChild(span);
    });
  });
}

const StreamingText: React.FC<{
  content: string;
  isStreaming?: boolean;
  onSendMessage?: (_text: string) => void;
}> = ({ content, isStreaming, onSendMessage }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRef = React.useRef('');
  const onSendRef = React.useRef(onSendMessage);
  React.useEffect(() => {
    onSendRef.current = onSendMessage;
  }, [onSendMessage]);

  // Click on a resource name → send follow-up message to the model
  React.useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const handler = (e: MouseEvent) => {
      const span = (e.target as HTMLElement).closest('.ols-plugin__chat-resource-link');
      if (span && onSendRef.current) {
        const resource = span.getAttribute('data-resource');
        const header = span.getAttribute('data-header');
        if (resource) {
          onSendRef.current(`tell me more about ${header || 'resource'} ${resource}`);
        }
      }
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, []);

  React.useEffect(() => {
    const contentChanged = content !== lastRef.current;
    lastRef.current = content;

    if (isStreaming) {
      if (contentChanged) {
        if (timerRef.current) {
          return;
        }
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (ref.current) {
            ref.current.innerHTML = renderMarkdown(lastRef.current);
            linkifyResourceNames(ref.current);
          }
        }, 80);
      }
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = null;
      if (ref.current) {
        if (contentChanged) {
          ref.current.innerHTML = renderMarkdown(content);
        }
        linkifyResourceNames(ref.current);
      }
    }
  }, [content, isStreaming]);

  React.useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return <div className="ols-plugin__chat-text" ref={ref} />;
};

const renderSegment = (
  segment: MessageSegment,
  index: number,
  isStreaming?: boolean,
  onSendMessage?: (_text: string) => void,
  onAction?: (_action: string, _data: Record<string, unknown>) => void,
): React.ReactNode => {
  switch (segment.type) {
    case 'text':
      return (
        <StreamingText
          content={segment.content}
          isStreaming={isStreaming}
          key={index}
          onSendMessage={onSendMessage}
        />
      );
    case 'thinking':
      return (
        <div className="ols-plugin__chat-thinking" key={index}>
          <span className="ols-plugin__chat-thinking-label">Thinking</span>
          <span className="ols-plugin__chat-thinking-content">{segment.content}</span>
        </div>
      );
    case 'tool_call':
      return (
        <div className="ols-plugin__chat-tool-call" key={index}>
          <span className="ols-plugin__chat-tool-icon">&#9881;</span>
          <span className="ols-plugin__chat-tool-name">{segment.name}</span>
          {segment.input && <span className="ols-plugin__chat-tool-input">{segment.input}</span>}
        </div>
      );
    case 'tool_result':
      return (
        <details className="ols-plugin__chat-tool-result" key={index}>
          <summary>Tool result</summary>
          <pre>{segment.output}</pre>
        </details>
      );
    case 'ui_component':
      return (
        <div className="ols-plugin__chat-ui-component" key={index}>
          <DynamicComponent
            onAction={onAction}
            props={segment.props}
            type={segment.componentType}
          />
        </div>
      );
    default:
      return null;
  }
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onFork, onSendMessage, onAction }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const isUser = message.role === 'user';

  return (
    <div className={`ols-plugin__chat-message ols-plugin__chat-message--${message.role}`}>
      <div className="ols-plugin__chat-message-header">
        <span className="ols-plugin__chat-message-role">
          {isUser ? t('You') : t('Lightspeed')}
          {!isUser && message.isStreaming && <span className="ols-plugin__chat-live-dot" />}
        </span>
        {!isUser && onFork && (
          <div className="ols-plugin__chat-message-actions">
            <button
              className="ols-plugin__chat-action-btn"
              onClick={() => onFork(message.id)}
              title={t('Fork into new chat')}
            >
              &#9095;
            </button>
          </div>
        )}
      </div>
      <div className="ols-plugin__chat-message-body">
        {message.segments.map((seg, i) =>
          renderSegment(seg, i, message.isStreaming, onSendMessage, onAction),
        )}
        {message.isStreaming && message.segments.length === 0 && (
          <div className="ols-plugin__chat-streaming-indicator">
            <span className="ols-plugin__chat-dot" />
            <span className="ols-plugin__chat-dot" />
            <span className="ols-plugin__chat-dot" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
