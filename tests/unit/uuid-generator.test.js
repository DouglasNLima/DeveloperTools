import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyseUuidValue,
  analyseUuidValues,
  formatUuidValidationReport,
  generateUuidBatch,
  generateUuidFromBytes,
  normaliseUuid,
  restoreUuidHyphens,
  splitUuidInput,
  validateUuidInput
} from '../../src/tools/uuid-generator.js';

const SAMPLE_BYTES = Uint8Array.from([
  0x00, 0x01, 0x02, 0x03,
  0x04, 0x05,
  0x06, 0x07,
  0x08, 0x09,
  0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f
]);

test('generates UUID v4 values from random bytes', () => {
  assert.equal(
    generateUuidFromBytes(SAMPLE_BYTES),
    '00010203-0405-4607-8809-0a0b0c0d0e0f'
  );
  assert.equal(
    generateUuidFromBytes(SAMPLE_BYTES, { uppercase: true, braces: true }),
    '{00010203-0405-4607-8809-0A0B0C0D0E0F}'
  );
});

test('generates batches and reports duplicate generated values', () => {
  const result = generateUuidBatch({
    count: 2,
    randomBytes: () => SAMPLE_BYTES
  });

  assert.deepEqual(result.uuids, [
    '00010203-0405-4607-8809-0a0b0c0d0e0f',
    '00010203-0405-4607-8809-0a0b0c0d0e0f'
  ]);
  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.valid, 2);
  assert.equal(result.summary.version4, 2);
  assert.equal(result.summary.duplicates, 1);
  assert.deepEqual(result.warnings, [
    'Generated UUIDs included duplicate values. Generate again before using them as identifiers.'
  ]);
});

test('validates canonical UUIDs with version and variant metadata', () => {
  const record = analyseUuidValue('f47ac10b-58cc-4372-a567-0e02b2c3d479');

  assert.equal(record.valid, true);
  assert.equal(record.version, 4);
  assert.equal(record.variant, 'RFC 4122');
  assert.equal(record.rfc4122, true);
  assert.equal(record.nil, false);
  assert.equal(record.format, 'Canonical');
});

test('normalises braced and hyphenless UUIDs', () => {
  assert.deepEqual(normaliseUuid('{F47AC10B-58CC-4372-A567-0E02B2C3D479}'), {
    valid: true,
    value: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    format: 'Braced canonical'
  });
  assert.deepEqual(normaliseUuid('f47ac10b58cc4372a5670e02b2c3d479'), {
    valid: true,
    value: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    format: 'Hyphenless'
  });
});

test('restores hyphens for a hyphenless UUID', () => {
  const result = restoreUuidHyphens('f47ac10b58cc4372a5670e02b2c3d479');

  assert.equal(result.mode, 'Restored UUIDs');
  assert.equal(result.output, 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
  assert.deepEqual(result.uuids, ['f47ac10b-58cc-4372-a567-0e02b2c3d479']);
  assert.equal(result.summary.total, 1);
  assert.equal(result.summary.valid, 1);
  assert.equal(result.records[0].displayValue, 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
});

test('restores mixed UUID inputs to a clean output list', () => {
  const result = restoreUuidHyphens([
    'f47ac10b58cc4372a5670e02b2c3d479',
    '{00000000-0000-0000-0000-000000000000}',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  ].join('\n'));

  assert.equal(result.output, [
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    '00000000-0000-0000-0000-000000000000',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  ].join('\n'));
  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.nil, 1);
  assert.deepEqual(result.records.map(record => record.format), [
    'Hyphenless',
    'Braced canonical',
    'Canonical'
  ]);
});

test('restores UUIDs with uppercase and braces options', () => {
  const result = restoreUuidHyphens('f47ac10b58cc4372a5670e02b2c3d479', {
    uppercase: true,
    braces: true
  });

  assert.equal(result.output, '{F47AC10B-58CC-4372-A567-0E02B2C3D479}');
  assert.equal(result.records[0].displayValue, '{F47AC10B-58CC-4372-A567-0E02B2C3D479}');
});

test('blocks UUID restoration when input is empty or invalid', () => {
  assert.throws(
    () => restoreUuidHyphens(''),
    /Enter one or more UUIDs to restore/
  );
  assert.throws(
    () => restoreUuidHyphens('f47ac10b58cc4372a5670e02b2c3d479\nnot-a-uuid'),
    /Entry 2 is not a valid UUID: Invalid UUID format/
  );
});

test('validates mixed UUID input and emits useful warnings', () => {
  const result = validateUuidInput([
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    '00000000-0000-0000-0000-000000000000',
    'f47ac10b58cc4372a5670e02b2c3d479',
    'not-a-uuid',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  ].join('\n'));

  assert.equal(result.summary.total, 5);
  assert.equal(result.summary.valid, 4);
  assert.equal(result.summary.invalid, 1);
  assert.equal(result.summary.nil, 1);
  assert.equal(result.summary.duplicates, 2);
  assert.deepEqual(result.warnings, [
    'Some entries are not valid UUIDs.',
    'Nil UUIDs are placeholders and should not be used as unique identifiers.',
    'Duplicate UUID values were found.',
    'Non-canonical UUID formats were normalised in the report.'
  ]);
  assert.match(result.output, /Status: Needs attention/);
  assert.match(result.output, /Invalid UUID format/);
});

test('reports valid UUIDs with non-RFC variants', () => {
  const analysis = analyseUuidValues(['f47ac10b-58cc-4372-c567-0e02b2c3d479']);

  assert.equal(analysis.records[0].valid, true);
  assert.equal(analysis.records[0].variant, 'Microsoft compatibility');
  assert.deepEqual(analysis.warnings, ['Some valid UUIDs use a non-RFC 4122 variant.']);
});

test('splits UUID input across whitespace, commas and semicolons', () => {
  assert.deepEqual(splitUuidInput('a,b; c\n d'), ['a', 'b', 'c', 'd']);
});

test('rejects empty validation input, bad counts and bad byte lengths', () => {
  assert.throws(
    () => validateUuidInput(''),
    /Enter one or more UUIDs/
  );
  assert.throws(
    () => generateUuidBatch({ count: 101, randomBytes: () => SAMPLE_BYTES }),
    /between 1 and 100/
  );
  assert.throws(
    () => generateUuidFromBytes([1, 2, 3]),
    /exactly 16 random bytes/
  );
});

test('formats validation reports directly', () => {
  const analysis = analyseUuidValues(['f47ac10b-58cc-4372-a567-0e02b2c3d479']);
  const report = formatUuidValidationReport(analysis);

  assert.match(report, /# UUID validation report/);
  assert.match(report, /Status: Valid/);
  assert.match(report, /Version: 4/);
});
