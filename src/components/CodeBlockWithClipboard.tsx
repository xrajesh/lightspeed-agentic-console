import {
  ClipboardCopyButton,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  ExpandableSection,
  ExpandableSectionToggle,
} from '@patternfly/react-core';
import { useId, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';

interface CodeBlockWithClipboardProps {
  code: string;
  maxLines?: number;
}

const DEFAULT_MAX_LINES = 20;

export const CodeBlockWithClipboard: FC<CodeBlockWithClipboardProps> = ({
  code,
  maxLines = DEFAULT_MAX_LINES,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);
  const id = useId();
  const toggleId = `code-block-toggle-${id}`;
  const contentId = `code-block-expand-${id}`;

  const lines = code.split('\n');
  const isExpandable = lines.length > maxLines;
  const displayCode = isExpandable ? lines.slice(0, maxLines).join('\n') : code;
  const expandedCode = isExpandable ? lines.slice(maxLines).join('\n') : '';

  const actions = (
    <CodeBlockAction>
      <ClipboardCopyButton
        id={`copy-code-button-${id}`}
        onClick={() => {
          if (!navigator.clipboard) {
            setCopyStatus('error');
            return;
          }
          navigator.clipboard.writeText(code).then(
            () => setCopyStatus('success'),
            () => setCopyStatus('error'),
          );
        }}
        exitDelay={copyStatus !== 'idle' ? 1500 : 600}
        variant="plain"
        onTooltipHidden={() => setCopyStatus('idle')}
      >
        {copyStatus === 'success' && t('Successfully copied to clipboard!')}
        {copyStatus === 'error' && t('Failed to copy to clipboard')}
        {copyStatus === 'idle' && t('Copy to clipboard')}
      </ClipboardCopyButton>
    </CodeBlockAction>
  );

  return (
    <CodeBlock actions={actions}>
      <CodeBlockCode aria-label={t('Copyable code')}>
        {displayCode}

        {isExpandable && (
          <ExpandableSection
            isExpanded={isExpanded}
            isDetached
            contentId={contentId}
            toggleId={toggleId}
          >
            {expandedCode}
          </ExpandableSection>
        )}
      </CodeBlockCode>
      {isExpandable && (
        <ExpandableSectionToggle
          isExpanded={isExpanded}
          onToggle={(isExpanded) => setIsExpanded(isExpanded)}
          contentId={contentId}
          direction="up"
          toggleId={toggleId}
        >
          {isExpanded ? t('Show less') : t('Show more')}
        </ExpandableSectionToggle>
      )}
    </CodeBlock>
  );
};
