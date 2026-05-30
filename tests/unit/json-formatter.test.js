import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyseJsonValue,
  buildJsonSchema,
  formatByteSize,
  generateJsonShape,
  getJsonParseErrorDetails,
  parseJsonInput,
  processJson,
  searchJsonPaths,
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

test('generates JSON shape Markdown with required and optional fields', () => {
  const result = generateJsonShape(JSON.stringify({
    items: [
      {
        id: 1,
        name: 'Alpha',
        active: true,
        nickname: null
      },
      {
        id: 2,
        name: 'Beta',
        tags: ['new'],
        nickname: 'B'
      }
    ],
    meta: {
      count: 2
    }
  }));
  const itemPresence = result.shape.fieldPresence.find(field => field.path === '$.items[]');

  assert.equal(result.outputType, 'Markdown contract');
  assert.match(result.output, /## JSON Shape Contract/);
  assert.match(result.output, /\$\.items\[\]\.id/);
  assert.deepEqual(itemPresence.required, ['id', 'name', 'nickname']);
  assert.deepEqual(itemPresence.probablyOptional, ['active', 'tags']);
  assert.deepEqual(result.schema.properties.items.items.required, ['id', 'name', 'nickname']);
  assert.deepEqual(result.schema.properties.items.items.properties.nickname.type, ['string', 'null']);
  assert.equal(result.schema.properties.items.items.additionalProperties, true);
});

test('generates schema-only output and validates input', () => {
  const result = generateJsonShape('{"id":1,"name":"Contoso"}', {
    outputFormat: 'schema'
  });
  const schema = JSON.parse(result.output);

  assert.equal(result.outputType, 'JSON Schema');
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.deepEqual(schema.required, ['id', 'name']);
  assert.doesNotMatch(result.output, /JSON Shape Contract/);
  assert.throws(() => generateJsonShape('{bad json}'), /JSON parse error/);
});

test('builds permissive JSON schema without inferred enums or constants', () => {
  const schema = buildJsonSchema({
    status: 'Active',
    child: {
      id: 1
    }
  });

  assert.equal(schema.additionalProperties, true);
  assert.equal(schema.properties.child.additionalProperties, true);
  assert.equal(schema.properties.status.enum, undefined);
  assert.equal(schema.properties.status.const, undefined);
  assert.deepEqual(schema.required, ['child', 'status']);
});

test('searches JSON paths by keys and primitive values', () => {
  const result = searchJsonPaths(JSON.stringify({
    items: [
      { id: 1, status: 'Active' },
      { id: 2, status: 'Inactive' }
    ],
    meta: {
      statusCode: 200
    }
  }), {
    query: 'status'
  });

  assert.equal(result.outputType, 'JSON path search');
  assert.equal(result.matches.length, 3);
  assert.deepEqual(result.matches.map(match => match.path), ['$.items[0].status', '$.items[1].status', '$.meta.statusCode']);
  assert.match(result.output, /JSON path search/);
  assert.match(result.output, /\$\.meta\.statusCode/);
});

test('searches JSON values only and reports empty search terms', () => {
  const result = searchJsonPaths('{"name":"Ada","active":true}', {
    query: 'ada',
    target: 'values'
  });

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].matchType, 'value');
  assert.throws(
    () => searchJsonPaths('{"name":"Ada"}', { query: '' }),
    /Enter a key or value search term/
  );
});
