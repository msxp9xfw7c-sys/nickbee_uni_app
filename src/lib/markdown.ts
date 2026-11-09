import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export { remarkMath };
export const safeKatex = () => rehypeKatex({ errorColor: '#fca5a5' });

export function prepareMarkdown(text: string): string {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula: string) => `$$${formula}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula: string) => `$${formula}$`);
}
