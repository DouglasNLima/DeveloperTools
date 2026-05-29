import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHtml,
  processHtmlContent
} from '../../src/tools/html-cleaner.js';

test('removes tags and decodes entities into readable plain text', () => {
  const result = processHtmlContent({
    input: '<h1>Terms &amp; conditions</h1><p>Use &lt;strong&gt; tags carefully&nbsp;today.</p>'
  });

  assert.equal(result.outputFormat, 'plain-text');
  assert.equal(result.outputType, 'Plain text');
  assert.equal(result.output, 'Terms & conditions\n\nUse <strong> tags carefully today.');
  assert.equal(result.elementCount, 2);
  assert.equal(result.referenceCount, 0);
  assert.deepEqual(result.warnings, []);
});

test('removes script, style, template and comment content', () => {
  const result = processHtmlContent({
    input: [
      '<style>.secret { display: none; }</style>',
      '<script>alert("no");</script>',
      '<template><p>Draft</p></template>',
      '<!-- hidden note -->',
      '<p>Visible</p>'
    ].join('')
  });

  assert.equal(result.output, 'Visible');
  assert.equal(result.elementCount, 4);
  assert.deepEqual(result.warnings, []);
});

test('keeps readable plain text structure for paragraphs, lists and tables', () => {
  const result = processHtmlContent({
    input: [
      '<p>Intro</p>',
      '<ul><li>Alpha</li><li>Beta<br>second line</li></ul>',
      '<table>',
      '<tr><th>Name</th><th>Role</th></tr>',
      '<tr><td>Ada</td><td>Admin</td></tr>',
      '</table>'
    ].join('')
  });

  assert.equal(result.output, [
    'Intro',
    '',
    '- Alpha',
    '- Beta',
    'second line',
    '',
    'Name\tRole',
    'Ada\tAdmin'
  ].join('\n'));
});

test('converts common HTML structures to Markdown', () => {
  const result = processHtmlContent({
    outputFormat: 'markdown',
    input: [
      '<article>',
      '<h2>Release notes</h2>',
      '<p>Read the <a href="https://example.test/guide">guide</a> and review <strong>breaking</strong> changes.</p>',
      '<p><img src="/assets/diagram.png" alt="Architecture diagram"></p>',
      '<blockquote><p>Ship small changes.</p></blockquote>',
      '<ul><li>One</li><li>Two<ol><li>Nested</li></ol></li></ul>',
      '<pre><code class="language-js">const ok = true;</code></pre>',
      '<table><tr><th>Name</th><th>Status</th></tr><tr><td>Ada</td><td>Ready</td></tr></table>',
      '</article>'
    ].join('')
  });

  assert.equal(result.outputType, 'Markdown');
  assert.equal(result.referenceCount, 2);
  assert.match(result.output, /^## Release notes/);
  assert.match(result.output, /Read the \[guide\]\(https:\/\/example.test\/guide\) and review \*\*breaking\*\* changes\./);
  assert.match(result.output, /!\[Architecture diagram\]\(\/assets\/diagram.png\)/);
  assert.match(result.output, /> Ship small changes\./);
  assert.match(result.output, /- Two\n  1\. Nested/);
  assert.match(result.output, /```js\nconst ok = true;\n```/);
  assert.match(result.output, /\| Name \| Status \|/);
  assert.match(result.output, /\| Ada \| Ready \|/);
});

test('handles malformed HTML best-effort and reports warnings', () => {
  const result = processHtmlContent({
    outputFormat: 'markdown',
    input: '<div><p>Open <strong>tags</div><span>still here'
  });

  assert.match(result.output, /Open \*\*tags\*\*/);
  assert.match(result.output, /still here/);
  assert.ok(result.warnings.length > 0);
  assert.match(result.warnings.join('\n'), /closed automatically|Unclosed tags/);
});

test('reports unmatched closing tags and unfinished raw text elements', () => {
  const unmatched = parseHtml('<p>Text</section>');
  const raw = processHtmlContent({ input: '<script>alert(1)' });

  assert.match(unmatched.warnings.join('\n'), /did not match/);
  assert.deepEqual(raw.warnings, [
    'The <script> element was not closed; its content was removed.',
    'Output is empty after removing non-visible HTML content.'
  ]);
  assert.equal(raw.output, '');
});

test('requires HTML input and defaults unknown output formats to plain text', () => {
  assert.throws(() => processHtmlContent({ input: '' }), /Enter HTML input/);

  const result = processHtmlContent({
    input: '<p>Hello</p>',
    outputFormat: 'not-real'
  });

  assert.equal(result.outputFormat, 'plain-text');
  assert.equal(result.output, 'Hello');
});
