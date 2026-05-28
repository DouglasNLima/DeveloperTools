import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQueryString,
  decodeComponent,
  decodeFullUrl,
  encodeComponent,
  encodeFullUrl,
  extractQueryString,
  formatEntriesAsMarkdown,
  parseKeyValueRows,
  parseQueryString,
  processUrlTool
} from '../../src/tools/url-codec.js';

test('encodes and decodes URL components', () => {
  const encoded = encodeComponent('hello world&x=1');

  assert.equal(encoded, 'hello%20world%26x%3D1');
  assert.equal(encodeComponent(' hello '), '%20hello%20');
  assert.equal(decodeComponent(encoded), 'hello world&x=1');
});

test('encodes and decodes full URLs', () => {
  const encoded = encodeFullUrl('https://example.test/a path?q=hello world#top');

  assert.equal(encoded, 'https://example.test/a%20path?q=hello%20world#top');
  assert.equal(decodeFullUrl(encoded), 'https://example.test/a path?q=hello world#top');
});

test('reports invalid percent-encoding while decoding', () => {
  assert.throws(() => decodeComponent('hello%ZZ'), /Invalid percent-encoding/);
  assert.throws(() => decodeFullUrl('https://example.test/%E0%A4'), /Unable to decode/);
});

test('extracts and parses query strings from full URLs and raw input', () => {
  assert.equal(extractQueryString('https://example.test/search?q=hello+world&tag=alpha#results'), 'q=hello+world&tag=alpha');

  const entries = parseQueryString('?q=hello+world&tag=alpha&tag=beta&empty=');

  assert.deepEqual(entries, [
    { key: 'q', value: 'hello world' },
    { key: 'tag', value: 'alpha' },
    { key: 'tag', value: 'beta' },
    { key: 'empty', value: '' }
  ]);
});

test('builds sorted query strings from key value rows', () => {
  const entries = parseKeyValueRows('z=last\nq=hello world\ntag=alpha');
  const query = buildQueryString(entries, {
    includeQuestionMark: true,
    sortKeys: true
  });

  assert.equal(query, '?q=hello%20world&tag=alpha&z=last');
});

test('formats query entries as Markdown', () => {
  const markdown = formatEntriesAsMarkdown([
    { key: 'name', value: 'A|B' },
    { key: 'notes', value: 'line 1\nline 2' }
  ]);

  assert.match(markdown, /A\\\|B/);
  assert.match(markdown, /line 1<br>line 2/);
});

test('processes parse and build modes with warnings', () => {
  const parsed = processUrlTool({
    mode: 'parse-query',
    input: 'tag=a&tag=b&empty=',
    outputFormat: 'json'
  });
  const built = processUrlTool({
    mode: 'build-query',
    input: 'tag=b\ntag=a',
    sortKeys: true
  });

  assert.equal(parsed.itemCount, 3);
  assert.match(parsed.warnings.join('\n'), /Duplicate keys/);
  assert.match(parsed.warnings.join('\n'), /empty value/);
  assert.match(parsed.output, /"tag"/);
  assert.equal(built.output, 'tag=a&tag=b');
  assert.match(built.warnings.join('\n'), /Duplicate keys/);
});

test('requires useful input for each mode', () => {
  assert.throws(() => processUrlTool({ mode: 'encode-component', input: '' }), /Enter text to encode/);
  assert.throws(() => parseKeyValueRows('bad row'), /key=value/);
  assert.throws(() => parseKeyValueRows('=missing'), /needs a key/);
});
