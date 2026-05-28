import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyseFetchXml,
  buildLiquidFetchXml,
  formatFetchXml,
  normaliseLiquidVariableName
} from '../../src/tools/power-pages.js';

test('formats nested FetchXML predictably', () => {
  const source = '<fetch><entity name="account"><attribute name="name"></attribute><filter><condition attribute="statecode" operator="eq" value="0"></condition></filter></entity></fetch>';
  const result = formatFetchXml(source);

  assert.equal(result.formatted, [
    '<fetch>',
    '  <entity name="account">',
    '    <attribute name="name">',
    '    </attribute>',
    '    <filter>',
    '      <condition attribute="statecode" operator="eq" value="0">',
    '      </condition>',
    '    </filter>',
    '  </entity>',
    '</fetch>'
  ].join('\n'));
  assert.equal(result.analysis.rootName, 'fetch');
  assert.equal(result.analysis.tagCount, 5);
});

test('builds a Liquid wrapper with a safe variable name', () => {
  const result = buildLiquidFetchXml('<fetch><entity name="account"></entity></fetch>', '123 account results!');

  assert.equal(result.variableName, 'fetchxml_123_account_results');
  assert.equal(result.liquid, [
    '{% fetchxml fetchxml_123_account_results %}',
    '<fetch>',
    '  <entity name="account">',
    '  </entity>',
    '</fetch>',
    '{% endfetchxml %}'
  ].join('\n'));
});

test('normalises empty and unsafe Liquid variable names', () => {
  assert.equal(normaliseLiquidVariableName(''), 'powerPagesResults');
  assert.equal(normaliseLiquidVariableName('account results'), 'account_results');
  assert.equal(normaliseLiquidVariableName('99-latest'), 'fetchxml_99_latest');
});

test('reports empty input', () => {
  assert.throws(() => analyseFetchXml('   '), /Enter FetchXML/);
});

test('reports missing fetch root', () => {
  assert.throws(() => analyseFetchXml('<entity name="account"></entity>'), /<fetch> as the root/);
});

test('reports unbalanced tags', () => {
  assert.throws(() => analyseFetchXml('<fetch><entity name="account"></fetch>'), /Unbalanced FetchXML tags/);
});

test('warns on self-closing FetchXML tags', () => {
  const result = analyseFetchXml('<fetch><entity name="account"><attribute name="name" /></entity></fetch>');

  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Self-closing <attribute \/> tag found/);
});
