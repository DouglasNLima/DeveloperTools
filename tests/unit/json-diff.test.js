import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJsonDiff,
  compareJsonValues,
  formatPath,
  formatValuePreview
} from '../../src/tools/json-diff.js';

test('builds structural diffs for nested objects and arrays', () => {
  const result = buildJsonDiff(
    '{"name":"Contoso","active":true,"tags":["a"],"legacy":1}',
    '{"name":"Fabrikam","active":true,"tags":["a","b"],"rating":5}',
    { outputFormat: 'markdown', sortKeys: true }
  );

  assert.equal(result.equal, false);
  assert.equal(result.summary.added, 2);
  assert.equal(result.summary.removed, 1);
  assert.equal(result.summary.changed, 1);
  assert.equal(result.summary.unchanged, 2);
  assert.deepEqual(result.changes.map(change => `${change.type}:${change.path}`), [
    'removed:$.legacy',
    'changed:$.name',
    'added:$.rating',
    'added:$.tags[1]'
  ]);
  assert.match(result.output, /### Changed \$\.name/);
  assert.match(result.output, /"Fabrikam"/);
});

test('returns an identical report when JSON structures match', () => {
  const result = buildJsonDiff(
    '{"b":2,"a":1}',
    '{"a":1,"b":2}',
    { sortKeys: true }
  );

  assert.equal(result.equal, true);
  assert.equal(result.summary.totalChanges, 0);
  assert.match(result.output, /Status: Identical/);
  assert.match(result.output, /No structural differences found/);
});

test('generates JSON report output', () => {
  const result = buildJsonDiff('{"ok":true}', '{"ok":false}', {
    outputFormat: 'json'
  });
  const report = JSON.parse(result.output);

  assert.equal(result.outputType, 'JSON report');
  assert.equal(report.summary.changed, 1);
  assert.equal(report.changes[0].path, '$.ok');
  assert.equal(report.changes[0].rightValue, false);
});

test('compares type changes, removals and additions directly', () => {
  const { changes, summary } = compareJsonValues(
    { value: 1, same: [], nested: { old: true } },
    { value: '1', same: [], nested: { new: true } }
  );

  assert.equal(summary.changed, 1);
  assert.equal(summary.added, 1);
  assert.equal(summary.removed, 1);
  assert.equal(summary.unchanged, 1);
  assert.deepEqual(changes.map(change => change.path), ['$.nested.new', '$.nested.old', '$.value']);
  assert.match(changes[2].message, /Type changed/);
});

test('formats object paths safely', () => {
  assert.equal(formatPath('$', 'account'), '$.account');
  assert.equal(formatPath('$', 'account-name'), '$["account-name"]');
});

test('truncates long value previews', () => {
  const preview = formatValuePreview({ value: 'x'.repeat(300) });

  assert.equal(preview.length, 220);
  assert.match(preview, /\.\.\.$/);
});

test('prefixes parse errors with the failed side', () => {
  assert.throws(
    () => buildJsonDiff('', '{"ok":true}'),
    /Left JSON: Enter JSON input/
  );
  assert.throws(
    () => buildJsonDiff('{"ok":true}', '{"ok":true,}'),
    /Right JSON: JSON parse error/
  );
});
