import { marked } from 'marked';
import DOMPurify from 'dompurify';

const purify = DOMPurify();

purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export const renderMarkdown = (text: string): string => {
  return purify.sanitize(marked.parseInline(text ?? '', { async: false }));
};
