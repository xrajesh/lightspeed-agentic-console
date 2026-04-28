import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertActionCloseButton } from '@patternfly/react-core';

import { buildChatUrl } from '../../config';
import { useAgentChat } from '../../hooks/useAgentChat';
import { buildProposalChatConfig, useProposalActions } from '../../hooks/useProposalActions';
import { LightspeedProposal } from '../../models/proposal';
import ChatMessage from '../chat/ChatMessage';
import ChatInput from '../chat/ChatInput';
import { PROPOSAL_COMMANDS } from './proposalCommands';

import '../chat/chat-page.css';
import './refine-chat.css';

const RefineChat: React.FC<{ proposal: LightspeedProposal; children?: React.ReactNode }> = ({
  proposal,
  children,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const chatConfig = React.useMemo(() => buildProposalChatConfig(proposal), [proposal]);

  const agentOptions = React.useMemo(() => {
    if (!chatConfig.sandboxPod) {
      return undefined;
    }
    return {
      url: buildChatUrl(chatConfig.sandboxPod, chatConfig.sandboxNamespace),
      context: chatConfig.context,
    };
  }, [chatConfig]);

  const { messages, isStreaming, error, sendMessage, stopStreaming } = useAgentChat(agentOptions);
  const { actionError, clearActionError, handleAction } = useProposalActions(proposal, sendMessage);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (messages.length > 0 && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  const hasSandbox = !!chatConfig.sandboxPod;

  return (
    <div className="ols-plugin__refine-chat">
      <div className="ols-plugin__refine-chat-messages" ref={messagesContainerRef}>
        {children && <div className="ols-plugin__refine-chat-proposal">{children}</div>}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onAction={handleAction}
            onSendMessage={isStreaming ? undefined : sendMessage}
          />
        ))}
        {error && <div className="ols-plugin__chat-error">{error}</div>}
        {actionError && (
          <Alert
            actionClose={<AlertActionCloseButton onClose={clearActionError} />}
            className="ols-plugin__chat-error"
            isInline
            title={actionError}
            variant="danger"
          />
        )}
      </div>
      {hasSandbox ? (
        <ChatInput
          commands={PROPOSAL_COMMANDS}
          isStreaming={isStreaming}
          onSend={sendMessage}
          onStop={stopStreaming}
        />
      ) : (
        <div className="ols-plugin__refine-chat-no-sandbox">
          {t('Chat available when a sandbox is provisioned.')}
        </div>
      )}
    </div>
  );
};

export default RefineChat;
