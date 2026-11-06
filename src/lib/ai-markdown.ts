import { Marked, Renderer } from 'marked';
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const renderer = new Renderer();
renderer.html = () => '';
renderer.image = ({ text }) => escape(text);
renderer.link = function ({ href, tokens }) {
  const content = this.parser.parseInline(tokens);
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return content;
    return `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${content}</a>`;
  } catch { return content; }
};
const markdown = new Marked({ renderer, gfm: true, breaks: true });
export function renderAiMarkdown(answer: string): string { return String(markdown.parse(answer, { async: false })); }
