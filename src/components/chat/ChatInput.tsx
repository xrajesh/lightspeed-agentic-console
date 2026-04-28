import * as React from 'react';
import { useTranslation } from 'react-i18next';

const PROMPT_RE = /^\/(\S+)\s+([\s\S]+)/;

export interface Command {
  id: string;
  label: string;
  desc: string;
  category: string;
  action: string;
  /** If set, selecting the command populates the input with `/<id> ` and
   *  sends this template with `{input}` replaced by what the user typed. */
  prompt?: string;
}

export const GENERAL_COMMANDS: Command[] = [
  {
    id: 'health-check',
    label: 'Health Check',
    desc: 'Check cluster health',
    category: 'Cluster',
    action: 'Check the overall health of this OpenShift cluster',
  },
  {
    id: 'pod-status',
    label: 'Pod Status',
    desc: 'Check pod status in a namespace',
    category: 'Cluster',
    action: 'Show the status of all pods across namespaces, highlighting any issues',
  },
  {
    id: 'node-resources',
    label: 'Node Resources',
    desc: 'Show node resource usage',
    category: 'Cluster',
    action: 'Show CPU and memory usage across all nodes',
  },
  {
    id: 'recent-events',
    label: 'Recent Events',
    desc: 'Show recent cluster events',
    category: 'Cluster',
    action: 'Show recent warning and error events across the cluster',
  },
  {
    id: 'failing-pods',
    label: 'Failing Pods',
    desc: 'Find failing or crash-looping pods',
    category: 'Troubleshoot',
    action: 'Find all pods that are in CrashLoopBackOff, Error, or not Ready across all namespaces',
  },
  {
    id: 'certificate-expiry',
    label: 'Certificate Expiry',
    desc: 'Check certificate expiration',
    category: 'Troubleshoot',
    action: 'Check for any certificates that are expiring soon or have already expired',
  },
  {
    id: 'storage-usage',
    label: 'Storage Usage',
    desc: 'Check PVC usage',
    category: 'Troubleshoot',
    action: 'Show PVC usage and any volumes that are near capacity',
  },
  {
    id: 'operator-status',
    label: 'Operator Status',
    desc: 'Check ClusterOperator health',
    category: 'Operators',
    action:
      'Show the status of all ClusterOperators, highlighting any that are degraded or not available',
  },
  {
    id: 'explain',
    label: 'Explain',
    desc: 'Explain a Kubernetes concept',
    category: 'Learn',
    action: '',
    prompt: 'Explain {input}',
  },
];

interface ChatInputProps {
  onSend: (_message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  commands?: Command[];
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  isStreaming,
  disabled,
  commands = GENERAL_COMMANDS,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [value, setValue] = React.useState('');
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    if (!value.startsWith('/')) {
      return [];
    }
    const query = value.slice(1).toLowerCase().trim();
    return query
      ? commands.filter(
          (c) =>
            c.id.includes(query) ||
            c.label.toLowerCase().includes(query) ||
            c.desc.toLowerCase().includes(query) ||
            c.category.toLowerCase().includes(query),
        )
      : commands;
  }, [value, commands]);

  const showCommands = filtered.length > 0;

  React.useEffect(() => {
    setSelectedIdx(0);
  }, [value]);

  const resolvePrompt = React.useCallback(
    (text: string): string => {
      const match = text.match(PROMPT_RE);
      if (match) {
        const cmd = commands.find((c) => c.id === match[1] && c.prompt);
        if (cmd) {
          return cmd.prompt!.replace('{input}', match[2].trim());
        }
      }
      return text;
    },
    [commands],
  );

  const executeCommand = React.useCallback(
    (cmd: Command) => {
      if (cmd.prompt) {
        setValue(`/${cmd.id} `);
        inputRef.current?.focus();
      } else {
        setValue('');
        onSend(cmd.action);
      }
    },
    [onSend],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (showCommands) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filtered[selectedIdx]) {
            executeCommand(filtered[selectedIdx]);
          }
        } else if (e.key === 'Escape') {
          setValue('');
        }
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !isStreaming) {
          onSend(resolvePrompt(value.trim()));
          setValue('');
        }
      }
    },
    [
      showCommands,
      filtered,
      selectedIdx,
      executeCommand,
      value,
      isStreaming,
      onSend,
      resolvePrompt,
    ],
  );

  // Auto-resize textarea
  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Scroll selected command into view
  React.useEffect(() => {
    if (showCommands && dropdownRef.current) {
      const selected = dropdownRef.current.querySelector('.ols-plugin__cmd-selected');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIdx, showCommands]);

  // Group commands by category
  const grouped = React.useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filtered) {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filtered]);

  let flatIdx = 0;

  return (
    <div className="ols-plugin__chat-input-container">
      {showCommands && (
        <div className="ols-plugin__chat-command-palette" ref={dropdownRef}>
          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category}>
              <div className="ols-plugin__cmd-category">{category}</div>
              {cmds.map((cmd) => {
                const idx = flatIdx++;
                return (
                  <div
                    className={`ols-plugin__cmd-item${idx === selectedIdx ? ' ols-plugin__cmd-selected' : ''}`}
                    key={cmd.id}
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    <span className="ols-plugin__cmd-label">/{cmd.id}</span>
                    <span className="ols-plugin__cmd-desc">{cmd.desc}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <div className="ols-plugin__chat-input-row">
        <textarea
          className="ols-plugin__chat-textarea"
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('Send a message... (type / for commands)')}
          ref={inputRef}
          rows={1}
          value={value}
        />
        {isStreaming ? (
          <button className="ols-plugin__chat-stop-btn" onClick={onStop}>
            {t('Stop')}
          </button>
        ) : (
          <button
            className="ols-plugin__chat-send-btn"
            disabled={!value.trim() || disabled}
            onClick={() => {
              if (value.trim()) {
                onSend(resolvePrompt(value.trim()));
                setValue('');
              }
            }}
          >
            {t('Send')}
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
