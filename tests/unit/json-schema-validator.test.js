import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatJsonInstancePath,
  formatJsonSchemaPath,
  formatValidationReport,
  validateJsonAgainstSchema,
  validateValueAgainstSchema
} from '../../src/tools/json-schema-validator.js';

test('validates JSON with local refs and draft metadata', () => {
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['id', 'address'],
    properties: {
      id: { type: 'string', pattern: '^CUS-' },
      address: { $ref: '#/$defs/address' }
    },
    additionalProperties: false,
    $defs: {
      address: {
        type: 'object',
        required: ['town', 'postcode'],
        properties: {
          town: { type: 'string' },
          postcode: { type: 'string', minLength: 5 }
        },
        additionalProperties: false
      }
    }
  };

  const result = validateValueAgainstSchema({
    id: 'CUS-100',
    address: {
      town: 'London',
      postcode: 'SW1A 1AA'
    }
  }, schema);

  assert.equal(result.valid, true);
  assert.equal(result.schemaDraft, 'Draft 2020-12');
  assert.equal(result.summary.errorCount, 0);
  assert.equal(result.summary.warningCount, 0);
});

test('reports nested object and array errors with instance paths', () => {
  const result = validateValueAgainstSchema({
    age: '36',
    tags: ['dev', 'dev'],
    meta: {
      'x-code': 5,
      other: false
    },
    extra: true
  }, {
    type: 'object',
    required: ['id', 'age'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: '^USR-' },
      age: { type: 'integer', minimum: 18 },
      tags: {
        type: 'array',
        uniqueItems: true,
        items: { type: 'string', minLength: 2 }
      },
      meta: {
        type: 'object',
        patternProperties: {
          '^x-': { type: 'string' }
        },
        additionalProperties: false
      }
    }
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map(error => `${error.keyword}:${error.instancePath}`), [
    'required:$.id',
    'type:$.age',
    'uniqueItems:$.tags[1]',
    'type:$.meta["x-code"]',
    'additionalProperties:$.meta.other',
    'additionalProperties:$.extra'
  ]);
  assert.equal(result.errors[0].schemaPath, '#/required/0');
});

test('supports composition and conditional schema keywords', () => {
  const schema = {
    allOf: [
      { type: 'object' },
      { properties: { enabled: { type: 'boolean' } } }
    ],
    anyOf: [
      { required: ['email'] },
      { required: ['phone'] }
    ],
    oneOf: [
      { properties: { kind: { const: 'person' } } },
      { properties: { kind: { const: 'team' } } }
    ],
    not: { required: ['blocked'] },
    if: {
      required: ['kind'],
      properties: { kind: { const: 'person' } }
    },
    then: {
      required: ['email'],
      properties: { email: { type: 'string' } }
    }
  };

  assert.equal(validateValueAgainstSchema({
    kind: 'person',
    email: 'ada@example.test',
    enabled: true
  }, schema).valid, true);

  const invalid = validateValueAgainstSchema({
    kind: 'person',
    email: 5,
    enabled: 'yes',
    blocked: true
  }, schema);

  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.errors.map(error => `${error.keyword}:${error.instancePath}`), [
    'type:$.enabled',
    'not:$',
    'type:$.email'
  ]);
});

test('enforces value, numeric, string, array and property bounds', () => {
  const result = validateValueAgainstSchema({
    status: 'archived',
    fixed: 'wrong',
    amount: 10,
    ratio: 0.3,
    code: 'abc',
    items: [],
    small: { a: 1, b: 2 }
  }, {
    type: 'object',
    properties: {
      status: { enum: ['active', 'paused'] },
      fixed: { const: 'expected' },
      amount: { type: 'number', exclusiveMaximum: 10 },
      ratio: { type: 'number', multipleOf: 0.5 },
      code: { type: 'string', minLength: 4, maxLength: 6, pattern: '^[A-Z]+$' },
      items: { type: 'array', minItems: 1, maxItems: 2 },
      small: { type: 'object', maxProperties: 1 }
    }
  });

  assert.deepEqual(result.errors.map(error => error.keyword), [
    'enum',
    'const',
    'exclusiveMaximum',
    'multipleOf',
    'minLength',
    'pattern',
    'minItems',
    'maxProperties'
  ]);
});

test('reports remote refs, unsupported keywords and local ref cycles', () => {
  const remoteRef = validateValueAgainstSchema('ada@example.test', {
    $ref: 'https://example.test/schema.json',
    format: 'email',
    dependentRequired: {
      creditCard: ['billingAddress']
    }
  });

  assert.equal(remoteRef.valid, false);
  assert.match(remoteRef.errors[0].message, /Remote \$ref/);
  assert.deepEqual(remoteRef.warnings.map(warning => warning.keyword).sort(), ['$ref', 'dependentRequired', 'format']);

  const cycle = validateValueAgainstSchema({ name: 'Ada' }, {
    $ref: '#/$defs/a',
    $defs: {
      a: { $ref: '#/$defs/b' },
      b: { $ref: '#/$defs/a' }
    }
  });

  assert.equal(cycle.valid, false);
  assert.match(cycle.errors[0].message, /Circular local \$ref/);
});

test('validates parsed input and formats reports', () => {
  const result = validateJsonAgainstSchema(
    '{"name":5}',
    '{"type":"object","properties":{"name":{"type":"string"}}}',
    { outputFormat: 'json' }
  );
  const report = JSON.parse(result.output);

  assert.equal(result.outputType, 'JSON validation report');
  assert.equal(report.valid, false);
  assert.equal(report.errors[0].instancePath, '$.name');
  assert.match(formatValidationReport(result, 'markdown'), /### \$\.name/);
});

test('reports JSON and schema parsing errors by side', () => {
  assert.throws(
    () => validateJsonAgainstSchema('{bad json}', '{}'),
    /JSON input: JSON parse error/
  );
  assert.throws(
    () => validateJsonAgainstSchema('{"ok":true}', '{bad schema}'),
    /JSON Schema input: JSON parse error/
  );
  assert.throws(
    () => validateJsonAgainstSchema('{"ok":true}', '[]'),
    /JSON Schema input must be a JSON object or boolean schema/
  );
});

test('formats JSON instance and schema paths', () => {
  assert.equal(formatJsonInstancePath(['items', 0, 'display-name']), '$.items[0]["display-name"]');
  assert.equal(formatJsonSchemaPath(['properties', 'display/name', 'type']), '#/properties/display~1name/type');
});
