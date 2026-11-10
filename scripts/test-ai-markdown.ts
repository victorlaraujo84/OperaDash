import assert from 'node:assert/strict';
import { renderAiMarkdown } from '../src/lib/ai-markdown';
assert.match(renderAiMarkdown('# Relatório\n\n**Impacto**'), /<strong>Impacto<\/strong>/);
assert.doesNotMatch(renderAiMarkdown('<img src=x onerror=alert(1)>'), /<img|onerror/);
assert.doesNotMatch(renderAiMarkdown('[clique](javascript:alert(1))'), /href=/);
assert.doesNotMatch(renderAiMarkdown('![imagem](https://example.com/tracker.png)'), /<img/);
assert.match(renderAiMarkdown('[documentação](https://example.com/docs)'), /rel="noopener noreferrer"/);
console.log('AI Markdown: formatting preserved, raw HTML, remote images and unsafe links excluded');
