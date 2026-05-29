import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLineOperations,
  buildTextDiff,
  combineChangeRows,
  formatTextDiffOutput,
  normaliseLineForCompare,
  splitTextLines
} from '../../src/tools/text-diff.js';

test('builds line-level text diffs with changed and added rows', () => {
  const result = buildTextDiff({
    leftText: 'alpha\nbeta\ngamma',
    rightText: 'alpha\nbeta updated\ndelta\ngamma'
  });

  assert.equal(result.equal, false);
  assert.deepEqual(result.summary, {
    added: 1,
    removed: 0,
    changed: 1,
    unchanged: 2,
    totalChanges: 2
  });
  assert.deepEqual(result.rows.map(row => row.type), ['unchanged', 'changed', 'added', 'unchanged']);
  assert.match(result.output, /-beta/);
  assert.match(result.output, /\+beta updated/);
  assert.match(result.output, /\+delta/);
});

test('reports removals without pairing them as changes', () => {
  const result = buildTextDiff({
    leftText: 'one\ntwo\nthree',
    rightText: 'one\nthree'
  });

  assert.equal(result.summary.removed, 1);
  assert.equal(result.summary.changed, 0);
  assert.equal(result.rows[1].type, 'removed');
  assert.equal(result.rows[1].leftLineNumber, 2);
  assert.equal(result.rows[1].leftText, 'two');
});

test('normalises whitespace and case when options are enabled', () => {
  const result = buildTextDiff({
    leftText: 'Hello   WORLD',
    rightText: 'hello world',
    ignoreWhitespace: true,
    ignoreCase: true,
    outputFormat: 'json'
  });
  const report = JSON.parse(result.output);

  assert.equal(result.equal, true);
  assert.equal(result.summary.totalChanges, 0);
  assert.deepEqual(result.warnings, [
    'Whitespace differences were ignored.',
    'Case differences were ignored.'
  ]);
  assert.equal(report.options.ignoreWhitespace, true);
  assert.equal(report.options.ignoreCase, true);
});

test('formats markdown output for identical text', () => {
  const result = buildTextDiff({
    leftText: 'same\ntext',
    rightText: 'same\ntext',
    outputFormat: 'markdown'
  });

  assert.equal(result.outputType, 'Markdown report');
  assert.match(result.output, /Status: Identical/);
  assert.match(result.output, /No line-level differences found/);
});

test('warns for empty inputs and normalised line endings', () => {
  const empty = buildTextDiff({ leftText: '', rightText: '' });
  const lineEndings = buildTextDiff({ leftText: 'a\r\nb', rightText: 'a\nb' });

  assert.equal(empty.equal, true);
  assert.deepEqual(empty.warnings, ['Both inputs are empty.']);
  assert.equal(empty.output, ['--- Left', '+++ Right', '@@ -1,0 +1,0 @@', '# Both inputs are empty.'].join('\n'));
  assert.equal(lineEndings.equal, true);
  assert.deepEqual(lineEndings.warnings, ['Line endings were normalised before comparison.']);
});

test('splits text lines without inventing a line for empty input', () => {
  assert.deepEqual(splitTextLines(''), []);
  assert.deepEqual(splitTextLines('a\r\nb\rc'), ['a', 'b', 'c']);
  assert.deepEqual(splitTextLines('a\n'), ['a', '']);
});

test('combines adjacent remove and add operations as changed rows', () => {
  const operations = buildLineOperations(
    ['first', 'second', 'third'],
    ['first', 'updated', 'third']
  );
  const rows = combineChangeRows(operations);

  assert.deepEqual(rows.map(row => row.type), ['unchanged', 'changed', 'unchanged']);
  assert.equal(rows[1].leftLineNumber, 2);
  assert.equal(rows[1].rightLineNumber, 2);
  assert.equal(rows[1].leftText, 'second');
  assert.equal(rows[1].rightText, 'updated');
});

test('normalises comparison lines and defaults unknown output format to unified diff', () => {
  assert.equal(normaliseLineForCompare('  Hello\tWORLD  ', {
    ignoreWhitespace: true,
    ignoreCase: true
  }), 'hello world');

  const result = buildTextDiff({
    leftText: 'a',
    rightText: 'b',
    outputFormat: 'not-real'
  });

  assert.equal(result.outputFormat, 'unified');
  assert.equal(result.outputType, 'Unified diff');
});

test('formats JSON output directly from a report', () => {
  const result = buildTextDiff({
    leftText: 'a',
    rightText: 'b'
  });
  const output = formatTextDiffOutput(result, 'json');
  const parsed = JSON.parse(output);

  assert.equal(parsed.summary.changed, 1);
  assert.equal(parsed.rows[0].leftText, 'a');
  assert.equal(parsed.rows[0].rightText, 'b');
});
