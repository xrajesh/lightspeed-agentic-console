import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Label, Spinner } from '@patternfly/react-core';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { ChatMessage as ChatMessageType, MessageSegment } from '../../hooks/useChat';
import DynamicComponent from './DynamicComponent';

marked.setOptions({
  breaks: true,
  gfm: true,
});

interface ChatMessageProps {
  message: ChatMessageType;
  onAction?: (_action: string, _data: Record<string, unknown>) => void;
}

export const MarkdownText: React.FC<{ content: string }> = ({ content }) => {
  const html = React.useMemo(() => DOMPurify.sanitize(marked.parse(content) as string), [content]);
  return <div className="ols-plugin__chat-text" dangerouslySetInnerHTML={{ __html: html }} />;
};

const ToolCallSegment: React.FC<{ name: string; input: string }> = ({ name, input }) => (
  <div className="ols-plugin__chat-tool-call">
    <Label color="purple" isCompact>
      tool
    </Label>{' '}
    <span className="ols-plugin__chat-tool-name">{name}</span>
    <pre className="ols-plugin__chat-tool-input">{input}</pre>
  </div>
);

const ToolResultSegment: React.FC<{ output: string }> = ({ output }) => (
  <div className="ols-plugin__chat-tool-result">
    <pre className="ols-plugin__chat-tool-output">{output}</pre>
  </div>
);

const ThinkingSegment: React.FC<{ content: string }> = ({ content }) => (
  <div className="ols-plugin__chat-thinking">
    <Label color="grey" isCompact>
      thinking
    </Label>
    <span className="ols-plugin__chat-thinking-text">{content}</span>
  </div>
);

const renderSegment = (
  segment: MessageSegment,
  index: number,
  isUser: boolean,
  onAction?: (_action: string, _data: Record<string, unknown>) => void,
): React.ReactNode => {
  switch (segment.type) {
    case 'text':
      if (isUser) {
        return (
          <div className="ols-plugin__chat-text" key={index}>
            {segment.content}
          </div>
        );
      }
      return <MarkdownText content={segment.content} key={index} />;
    case 'ui_component':
      return (
        <div className="ols-plugin__chat-component" key={index}>
          <DynamicComponent
            onAction={onAction}
            props={segment.props}
            type={segment.componentType}
          />
        </div>
      );
    case 'tool_call':
      return <ToolCallSegment input={segment.input} key={index} name={segment.name} />;
    case 'tool_result':
      return <ToolResultSegment key={index} output={segment.output} />;
    case 'thinking':
      return <ThinkingSegment content={segment.content} key={index} />;
    default:
      return null;
  }
};

const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message, onAction }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const isUser = message.role === 'user';

  return (
    <div className={`ols-plugin__chat-message ols-plugin__chat-message--${message.role}`}>
      <div className="ols-plugin__chat-message-avatar">{isUser ? t('You') : t('AI')}</div>
      <div className="ols-plugin__chat-message-content">
        {message.segments.map((segment, i) => renderSegment(segment, i, isUser, onAction))}
        {message.isStreaming && message.segments.length === 0 && (
          <div className="ols-plugin__chat-message-loading">
            <Spinner size="sm" /> {t('Analyzing...')}
          </div>
        )}
        {message.isStreaming && message.segments.length > 0 && (
          <Spinner className="ols-plugin__chat-streaming-spinner" size="sm" />
        )}
      </div>
    </div>
  );
};

export default ChatMessageComponent;
