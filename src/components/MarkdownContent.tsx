import { Content } from '@patternfly/react-core';
import type { ElementType, FC } from 'react';
import { renderMarkdown, renderMarkdownInline } from '../utils/markdown';

interface MarkdownContentProps {
  text: string;
  component?: ElementType;
  inline?: boolean;
}

export const MarkdownContent: FC<MarkdownContentProps> = ({
  text,
  component = Content,
  inline = false,
}) => {
  const html = inline ? renderMarkdownInline(text) : renderMarkdown(text);
  const Component = inline ? 'span' : component;
  return <Component dangerouslySetInnerHTML={{ __html: html }} />;
};
