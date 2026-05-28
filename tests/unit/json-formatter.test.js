import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyseJsonValue,
  formatByteSize,
  getJsonParseErrorDetails,
  parseJsonInput,
  processJson,
  sortJsonKeys
} from '../../src/tools/json-formatter.js';

test('formats nested JSON predictably', () => {
  const result = processJson('{"b":2,"a":{"d":4,"c":[1,true,null]}}', {
    mode: 'format',
    sortKeys: true,
    indent: 2
  });

  assert.equal(result.output, [
    '{',
    '  "a": {',
    '    "c": [',
    '      1,',
    '      true,',
    '      null',
    '    ],',
    '    "d": 4',
    '  },',
    '  "b": 2',
    '}'
  ].join('\n'));
  assert.equal(result.outputType, 'Formatted JSON');
  assert.equal(result.stats.depth, 4);
  assert.equal(result.stats.objectCount, 2);
  assert.equal(result.stats.arrayCount, 1);
});

test('minifies JSON output', () => {
  const result = processJson('{\n  "ok": true,\n  "items": [1, 2]\n}', {
    mode: 'minify'
  });

  assert.equal(result.output, '{"ok":true,"items":[1,2]}');
  assert.equal(result.outputType, 'Minified JSON');
});

test('sorts object keys recursively while preserving array order', () => {
  const sorted = sortJsonKeys({
    z: 1,
    a: {
      d: 4,
      b: [{ y: 2, x: 1 }]
    }
  });

  assert.deepEqual(Object.keys(sorted), ['a', 'z']);
  assert.deepEqual(Object.keys(sorted.a), ['b', 'd']);
  assert.deepEqual(Object.keys(sorted.a.b[0]), ['x', 'y']);
});

test('analyses JSON values with root type and counts', () => {
  const stats = analyseJsonValue({
    account: {
      names: ['Contoso', 'Fabrikam']
    },
    active: true
  });

  assert.equal(stats.rootType, 'Object');
  assert.equal(stats.depth, 4);
  assert.equal(stats.objectCount, 2);
  assert.equal(stats.arrayCount, 1);
  assert.equal(stats.keyCount, 3);
  assert.equal(stats.primitiveCount, 3);
});

test('reports empty input and JSON parse errors with location details', () => {
  assert.throws(() => parseJsonInput('   '), /Enter JSON input/);

  try {
    parseJsonInput('{"ok": true,}');
    assert.fail('Expected invalid JSON to throw.');
  } catch (error) {
    assert.match(error.message, /JSON parse error/);
    assert.equal(typeof error.details.line, 'number');
    assert.equal(typeof error.details.column, 'number');
    assert.match(error.details.snippet, /\^/);
  }
});

test('builds deterministic parse error details from parser messages', () => {
  const details = getJsonParseErrorDetails('{\n  "ok": true,\n}', new SyntaxError('Unexpected token } in JSON at position 16'));

  assert.equal(details.line, 3);
  assert.equal(details.column, 1);
  assert.equal(details.snippet, '}\n^');
});

test('formats byte sizes with British numeric expectations', () => {
  assert.equal(formatByteSize(12), '12 B');
  assert.equal(formatByteSize(1536), '1.5 KB');
});
