import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyseDelimitedRows,
  applyColumnRenameMapping,
  buildDelimitedOutput,
  buildDelimitedOutputFileName,
  detectDelimiter,
  parseDelimitedText,
  parseColumnRenameMapping,
  processDelimitedData,
  rowsToMarkdownTable,
  rowsToObjects,
  serialiseDelimitedRows
} from '../../src/tools/csv-tsv-helper.js';

test('detects common delimiters from delimited text', () => {
  assert.equal(detectDelimiter('name,email\nAda,ada@example.test').key, 'comma');
  assert.equal(detectDelimiter('name;email\nAda;ada@example.test').key, 'semicolon');
  assert.equal(detectDelimiter('name\temail\nAda\tada@example.test').key, 'tab');
});

test('parses quoted cells, escaped quotes and multiline values', () => {
  const rows = parseDelimitedText('name,notes\n"Ada, L.","Line 1\nLine 2"\nGrace,"said ""hello"""', ',');

  assert.deepEqual(rows, [
    ['name', 'notes'],
    ['Ada, L.', 'Line 1\nLine 2'],
    ['Grace', 'said "hello"']
  ]);
});

test('reports unclosed quotes and unexpected text after closing quotes', () => {
  assert.throws(() => parseDelimitedText('name\n"Ada', ','), /unclosed quoted cell/);
  assert.throws(() => parseDelimitedText('"Ada"x,email', ','), /Unexpected character/);
});

test('analyses rows for counts, headers and warnings', () => {
  const rows = parseDelimitedText('name,name,\nAda,,extra\nGrace', ',');
  const analysis = analyseDelimitedRows(rows, { firstRowHeaders: true });

  assert.equal(analysis.totalRows, 3);
  assert.equal(analysis.dataRows, 2);
  assert.equal(analysis.columns, 3);
  assert.equal(analysis.emptyCellCount, 2);
  assert.deepEqual(analysis.headerAnalysis.emptyHeaders, [3]);
  assert.deepEqual(analysis.headerAnalysis.duplicateHeaders, ['name']);
  assert.deepEqual(analysis.headerAnalysis.safeHeaders, ['name', 'name_2', 'column_3']);
  assert.equal(analysis.inconsistentRows.length, 1);
  assert.match(analysis.warnings.join('\n'), /unexpected column count/);
  assert.match(analysis.warnings.join('\n'), /Duplicate headers/);
});

test('converts delimited rows to JSON objects with generated headers', () => {
  const rows = parseDelimitedText('Ada\tLovelace\nGrace\tHopper', '\t');

  assert.deepEqual(rowsToObjects(rows, { firstRowHeaders: false }), [
    { column_1: 'Ada', column_2: 'Lovelace' },
    { column_1: 'Grace', column_2: 'Hopper' }
  ]);
});

test('serialises CSV and TSV with correct escaping', () => {
  const rows = [
    ['name', 'notes'],
    ['Ada, L.', 'Line 1\nLine 2'],
    ['Grace', 'said "hello"']
  ];

  assert.equal(serialiseDelimitedRows(rows, ','), 'name,notes\n"Ada, L.","Line 1\nLine 2"\nGrace,"said ""hello"""');
  assert.equal(serialiseDelimitedRows(rows, '\t'), 'name\tnotes\nAda, L.\t"Line 1\nLine 2"\nGrace\t"said ""hello"""');
});

test('processes CSV to JSON output with statistics', () => {
  const result = processDelimitedData({
    input: 'name,email\nAda,ada@example.test\nGrace,grace@example.test',
    delimiter: 'auto',
    outputFormat: 'json',
    firstRowHeaders: true
  });

  assert.equal(result.delimiter.key, 'comma');
  assert.equal(result.outputType, 'JSON array');
  assert.equal(result.analysis.totalRows, 3);
  assert.equal(result.analysis.dataRows, 2);
  assert.match(result.output, /"name": "Ada"/);
  assert.equal(result.warnings.length, 0);
});

test('processes semicolon data to TSV output', () => {
  const result = processDelimitedData({
    input: 'name;email\nAda;ada@example.test',
    delimiter: 'semicolon',
    outputFormat: 'tsv'
  });

  assert.equal(result.output, 'name\temail\nAda\tada@example.test');
  assert.equal(result.outputType, 'TSV');
});

test('renames columns and exports Markdown tables', () => {
  const input = 'name,email,unused\nAda,ada@example.test,\nGrace,grace@example.test,';
  const result = processDelimitedData({
    input,
    outputFormat: 'markdown',
    columnRenameMapping: 'name=Full name\nemail=Email address'
  });

  assert.equal(result.outputType, 'Markdown table');
  assert.match(result.output, /\| Full name \| Email address \| unused \|/);
  assert.match(result.output, /\| Ada \| ada@example.test \|/);
  assert.match(result.warnings.join('\n'), /unused/);
  assert.deepEqual(applyColumnRenameMapping(['name', 'email'], parseColumnRenameMapping('name=Full name')), ['Full name', 'email']);
  assert.equal(rowsToMarkdownTable(parseDelimitedText(input, ','), {
    columnRenameMap: parseColumnRenameMapping('name=Full name\nemail=Email address')
  }), result.output);
  assert.equal(buildDelimitedOutputFileName('markdown', 'contacts.csv'), 'contacts.md');
});

test('applies column rename mapping to cleaned delimited output', () => {
  const result = processDelimitedData({
    input: 'name,email\nAda,ada@example.test',
    outputFormat: 'csv',
    columnRenameMapping: 'name=Full name'
  });

  assert.equal(result.output, 'Full name,email\nAda,ada@example.test');
  assert.throws(
    () => parseColumnRenameMapping('name'),
    /must use current=new/
  );
});

test('builds output file names safely', () => {
  assert.equal(buildDelimitedOutputFileName('json', 'contacts.csv'), 'contacts.json');
  assert.equal(buildDelimitedOutputFileName('tsv', 'bad:name?.txt'), 'bad_name_.tsv');
  assert.equal(buildDelimitedOutputFileName('csv', ''), 'delimited-output.csv');
});

test('requires useful input and supported options', () => {
  assert.throws(() => processDelimitedData({ input: '' }), /Enter CSV or TSV content/);
  assert.throws(() => processDelimitedData({ input: 'a|b', delimiter: 'pipe' }), /supported delimiter/);
  assert.equal(
    buildDelimitedOutput([['a', 'b']], { outputFormat: 'unknown', firstRowHeaders: false }),
    '[\n  {\n    "column_1": "a",\n    "column_2": "b"\n  }\n]'
  );
});
