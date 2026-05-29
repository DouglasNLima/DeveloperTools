import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCaseConversions,
  convertCase,
  formatCaseReport,
  formatSpecificOutput,
  normaliseIdentifierText,
  tokeniseWords
} from '../../src/tools/case-converter.js';

test('tokenises common code identifiers into words', () => {
  assert.deepEqual(tokeniseWords('customerAccountID2'), ['customer', 'account', 'id', '2']);
  assert.deepEqual(tokeniseWords('PowerPages_site-setting'), ['power', 'pages', 'site', 'setting']);
  assert.deepEqual(tokeniseWords('URLValueParser'), ['url', 'value', 'parser']);
});

test('builds common case conversions from words', () => {
  const conversions = buildCaseConversions(['customer', 'account', 'id']);

  assert.equal(conversions.camel, 'customerAccountId');
  assert.equal(conversions.pascal, 'CustomerAccountId');
  assert.equal(conversions.snake, 'customer_account_id');
  assert.equal(conversions.constant, 'CUSTOMER_ACCOUNT_ID');
  assert.equal(conversions.kebab, 'customer-account-id');
  assert.equal(conversions.train, 'Customer-Account-Id');
  assert.equal(conversions.dot, 'customer.account.id');
  assert.equal(conversions.lowerWords, 'customer account id');
  assert.equal(conversions.titleWords, 'Customer Account Id');
});

test('converts whole input into an all-formats Markdown report', () => {
  const result = convertCase({
    input: 'customer account ID',
    outputFormat: 'all'
  });

  assert.equal(result.mode, 'Whole input');
  assert.equal(result.wordCount, 3);
  assert.equal(result.outputType, 'All common cases');
  assert.equal(result.previewItems.length, 9);
  assert.match(result.output, /# Case converter report/);
  assert.match(result.output, /camelCase: `customerAccountId`/);
  assert.match(result.output, /SCREAMING_SNAKE_CASE: `CUSTOMER_ACCOUNT_ID`/);
});

test('converts to one requested format', () => {
  const result = convertCase({
    input: 'Power Pages Web API',
    outputFormat: 'kebab'
  });

  assert.equal(result.output, 'power-pages-web-api');
  assert.equal(result.outputType, 'kebab-case');
  assert.deepEqual(result.previewItems, [{
    label: 'Whole input',
    format: 'kebab-case',
    value: 'power-pages-web-api'
  }]);
});

test('converts each line separately and preserves empty lines', () => {
  const result = convertCase({
    input: 'first name\n\nlast name',
    outputFormat: 'snake',
    convertEachLine: true
  });

  assert.equal(result.mode, 'Each line');
  assert.equal(result.inputLineCount, 3);
  assert.equal(result.wordCount, 4);
  assert.equal(result.output, 'first_name\n\nlast_name');
  assert.deepEqual(result.warnings, ['Empty lines were preserved.']);
});

test('warns when symbols, accents and numeric starts need attention', () => {
  const result = convertCase({
    input: '123 café total! value',
    outputFormat: 'camel'
  });

  assert.equal(result.output, '123CafeTotalValue');
  assert.deepEqual(result.warnings, [
    'Unsupported symbols were treated as separators.',
    'Accented characters were normalised for code-friendly output.',
    'Some outputs start with a number and may not be valid identifiers in every language.'
  ]);
});

test('rejects empty input and input without detected words', () => {
  assert.throws(
    () => convertCase({ input: '' }),
    /Enter text to convert/
  );
  assert.throws(
    () => convertCase({ input: '--- ///' }),
    /No words were detected/
  );
});

test('normalises identifier text and defaults unknown output formats', () => {
  assert.equal(normaliseIdentifierText('RésuméXMLValue2'), 'Resume XML Value 2');

  const result = convertCase({
    input: 'account name',
    outputFormat: 'not-real'
  });

  assert.equal(result.outputFormat, 'all');
  assert.equal(result.outputType, 'All common cases');
});

test('formats direct report and specific output helpers', () => {
  const records = [{
    label: 'Whole input',
    words: ['alpha', 'beta'],
    conversions: buildCaseConversions(['alpha', 'beta'])
  }];

  assert.equal(formatSpecificOutput(records, 'pascal'), 'AlphaBeta');
  assert.match(formatCaseReport({
    records,
    warnings: ['Example warning.'],
    convertEachLine: false
  }), /Example warning/);
});
