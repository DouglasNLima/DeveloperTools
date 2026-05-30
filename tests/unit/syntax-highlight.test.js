import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSyntaxLanguage, escapeHtml, highlightSyntax } from '../../src/tools/syntax-highlight.js';

test('highlights JSON keys, strings, numbers and literals', () => {
  const html = highlightSyntax('{"name":"Ada","active":true,"score":42}', 'json');

  assert.match(html, /syntax-token--key">&quot;name&quot;<\/span>/);
  assert.match(html, /syntax-token--string">&quot;Ada&quot;<\/span>/);
  assert.match(html, /syntax-token--literal">true<\/span>/);
  assert.match(html, /syntax-token--number">42<\/span>/);
});

test('highlights XML tags, attributes, strings and comments', () => {
  const html = highlightSyntax('<!-- note --><fetch><entity name="account" /></fetch>', 'xml');

  assert.match(html, /syntax-token--comment">&lt;!-- note --&gt;<\/span>/);
  assert.match(html, /syntax-token--tag">fetch<\/span>/);
  assert.match(html, /syntax-token--attribute">name<\/span>/);
  assert.match(html, /syntax-token--string">&quot;account&quot;<\/span>/);
});

test('highlights expression functions, variables and strings', () => {
  const html = highlightSyntax("concat(triggerOutputs()?['body/name'], ' - ')", 'expression');

  assert.match(html, /syntax-token--function">concat<\/span>/);
  assert.match(html, /syntax-token--function">triggerOutputs<\/span>/);
  assert.match(html, /syntax-token--string">&#039;body\/name&#039;<\/span>/);
  assert.match(html, /syntax-token--string">&#039; - &#039;<\/span>/);
});

test('highlights SQL keywords, strings and comments', () => {
  const html = highlightSyntax("select name from users where note = 'safe -- text' -- comment", 'sql');

  assert.match(html, /syntax-token--key">select<\/span>/);
  assert.match(html, /syntax-token--key">from<\/span>/);
  assert.match(html, /syntax-token--string">&#039;safe -- text&#039;<\/span>/);
  assert.match(html, /syntax-token--comment">-- comment<\/span>/);
});

test('auto-detects JSON and XML input', () => {
  assert.equal(detectSyntaxLanguage('  {"ok": true}'), 'json');
  assert.equal(detectSyntaxLanguage('\n<fetch></fetch>'), 'xml');
  assert.equal(detectSyntaxLanguage('select id from users'), 'sql');
  assert.equal(detectSyntaxLanguage('plain text'), 'plain');
});

test('escapes unsafe HTML before emitting highlighted markup', () => {
  assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
  assert.doesNotMatch(highlightSyntax('<script>alert(1)</script>', 'plain'), /<script>/);
});
