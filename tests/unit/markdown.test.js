import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyseMarkdown,
  extractMarkdownMermaidBlocks,
  normaliseMarkdownSource,
  renderMarkdownPreview
} from '../../src/tools/markdown.js';

test('renders Markdown preview HTML and extracts document structure', () => {
  const markdown = [
    '# Release notes',
    '',
    'See the [deployment guide](docs/deploy.md) and ![Architecture](./architecture.svg).',
    '',
    '## Status',
    '',
    '| Name | State |',
    '| --- | --- |',
    '| Portal | Ready |',
    '',
    '```mermaid',
    'flowchart TD',
    '  Draft --> Review',
    '```'
  ].join('\n');

  const result = renderMarkdownPreview({ input: markdown });

  assert.equal(result.outline.length, 2);
  assert.deepEqual(result.outline.map(item => item.text), ['Release notes', 'Status']);
  assert.equal(result.links[0].url, 'docs/deploy.md');
  assert.equal(result.images[0].url, './architecture.svg');
  assert.equal(result.tableCount, 1);
  assert.equal(result.codeFences.length, 1);
  assert.equal(result.mermaidBlocks.length, 1);
  assert.match(result.html, /<h1 id="release-notes">Release notes<\/h1>/);
  assert.match(result.html, /href="docs\/deploy\.md"/);
  assert.match(result.html, /<table>/);
  assert.match(result.html, /data-mermaid-index="0"/);
  assert.deepEqual(result.warnings, []);
});

test('escapes raw HTML and unsafe URLs in previews', () => {
  const result = renderMarkdownPreview({
    input: [
      '# Notes',
      '',
      '<script>alert("x")</script>',
      '',
      '[Bad link](javascript:alert)'
    ].join('\n')
  });

  assert.match(result.html, /&lt;script&gt;alert\("x"\)&lt;\/script&gt;/);
  assert.match(result.html, /href="#"/);
  assert.deepEqual(result.warnings, ['Raw HTML is escaped in the preview.']);
});

test('reports empty input and unclosed code fences', () => {
  assert.throws(
    () => renderMarkdownPreview({ input: '   ' }),
    /Enter Markdown input before rendering\./
  );

  const result = renderMarkdownPreview({
    input: [
      '# Draft',
      '',
      '```js',
      'console.log("draft");'
    ].join('\n')
  });

  assert.equal(result.codeFences.length, 1);
  assert.deepEqual(result.warnings, ['A code fence appears to be unclosed.']);
});

test('normalises line endings and extracts Mermaid fences', () => {
  assert.equal(normaliseMarkdownSource('\r\n# Title\r\n'), '# Title');

  const blocks = extractMarkdownMermaidBlocks([
    '```mmd',
    'sequenceDiagram',
    '  User->>App: Open',
    '```',
    '',
    '```js',
    'console.log("skip");',
    '```'
  ].join('\n'));

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].language, 'mmd');
  assert.equal(blocks[0].source, 'sequenceDiagram\n  User->>App: Open');

  const analysis = analyseMarkdown('# One\n\n## Two');
  assert.equal(analysis.wordCount, 2);
  assert.equal(analysis.inputSizeLabel, '13 bytes');
});
