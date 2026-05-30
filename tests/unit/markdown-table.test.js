import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMarkdownTableOutputFileName,
  extractMarkdownTables,
  processMarkdownTables,
  splitMarkdownTableRow
} from '../../src/tools/markdown-table.js';

test('normalises Markdown tables while preserving surrounding document text', () => {
  const input = [
    '# Report',
    '',
    '| Name|Count|',
    '| :--- | ---: |',
    '| Ada | 12 |',
    '| Grace | 4 |'
  ].join('\n');

  const result = processMarkdownTables({
    input,
    outputFormat: 'markdown',
    alignment: 'preserve'
  });

  assert.equal(result.tableCount, 1);
  assert.equal(result.totalRows, 3);
  assert.equal(result.totalDataRows, 2);
  assert.equal(result.maxColumns, 2);
  assert.equal(result.outputType, 'Markdown table');
  assert.equal(result.output, [
    '# Report',
    '',
    '| Name  | Count |',
    '| :---- | ----: |',
    '| Ada   |    12 |',
    '| Grace |     4 |'
  ].join('\n'));
  assert.deepEqual(result.warnings, []);
});

test('converts Markdown tables to CSV and handles escaped pipes', () => {
  const result = processMarkdownTables({
    input: [
      '| Name | Note |',
      '| --- | --- |',
      '| Ada | Uses \\| safely |',
      '| Grace | `A|B` |'
    ].join('\n'),
    outputFormat: 'csv'
  });

  assert.equal(result.output, [
    'Name,Note',
    'Ada,Uses | safely',
    'Grace,`A|B`'
  ].join('\n'));
  assert.equal(buildMarkdownTableOutputFileName('csv'), 'markdown-table.csv');
});

test('reports inconsistent rows and pads missing cells', () => {
  const result = processMarkdownTables({
    input: [
      '| Name | Count |',
      '| --- | --- |',
      '| Ada | 12 | extra |',
      '| Grace |'
    ].join('\n')
  });

  assert.deepEqual(result.warnings, [
    'Table 1 has 2 rows with an unexpected column count: line 3, 4.',
    'Table 1 has empty header cells in column 3.'
  ]);
  assert.equal(result.output, [
    '| Name  | Count |       |',
    '| ----- | ----- | ----- |',
    '| Ada   | 12    | extra |',
    '| Grace |       |       |'
  ].join('\n'));
});

test('extracts multiple tables and ignores fenced table examples', () => {
  const input = [
    '```md',
    '| Ignored | Table |',
    '| --- | --- |',
    '| A | B |',
    '```',
    '',
    '| First | Value |',
    '| --- | --- |',
    '| A | 1 |',
    '',
    '| Second | Value |',
    '| --- | --- |',
    '| B | 2 |'
  ].join('\n');
  const tables = extractMarkdownTables(input);
  const result = processMarkdownTables({
    input,
    outputFormat: 'tsv'
  });

  assert.equal(tables.length, 2);
  assert.equal(result.output, [
    'First\tValue',
    'A\t1',
    '',
    'Second\tValue',
    'B\t2'
  ].join('\n'));
  assert.deepEqual(result.warnings, ['Multiple tables are separated by a blank line in the delimited output.']);
});

test('validates empty input and missing table input', () => {
  assert.throws(
    () => processMarkdownTables({ input: '' }),
    /Enter Markdown table input before formatting\./
  );
  assert.throws(
    () => processMarkdownTables({ input: '# No table' }),
    /Enter at least one Markdown table before formatting\./
  );
  assert.deepEqual(splitMarkdownTableRow('| A \\| B | `C|D` |'), ['A | B', '`C|D`']);
});
