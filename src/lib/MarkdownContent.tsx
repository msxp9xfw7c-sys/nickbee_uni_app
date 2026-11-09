import React from 'react';
import Markdown from 'react-markdown';
import { prepareMarkdown, remarkMath, safeKatex } from './markdown';

interface MarkdownContentProps {
  children: string;
}

export default function MarkdownContent({ children }: MarkdownContentProps) {
  return (
    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[safeKatex]}>
      {prepareMarkdown(children)}
    </Markdown>
  );
}
