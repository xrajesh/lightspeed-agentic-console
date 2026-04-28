import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function stripUiFences(text: string): string {
  let clean = text.replace(/```ui:\w+\n[\s\S]*?```/g, '');
  const partial = clean.match(/```ui:\w[\s\S]*$/);
  if (partial) {
    clean = clean.substring(0, clean.length - partial[0].length);
  }
  return clean.trim();
}

export function renderMarkdown(text: string): string {
  const clean = stripUiFences(text);
  return clean ? DOMPurify.sanitize(marked.parse(clean) as string) : '';
}
