import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHashChecksum,
  buildHashOutputFileName,
  compareExpectedDigest,
  hashBytes,
  normaliseAlgorithm,
  normaliseExpectedDigest,
  textToBytes
} from '../../src/tools/hash-checksums.js';

test('generates SHA-256 hex and Base64 for text', async () => {
  const result = await buildHashChecksum({
    inputType: 'text',
    text: 'hello',
    algorithm: 'SHA-256'
  });

  assert.equal(result.hex, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  assert.equal(result.base64, 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=');
  assert.equal(result.inputSizeLabel, '5 bytes');
  assert.equal(result.match.status, 'not-provided');
  assert.match(result.output, /Algorithm: SHA-256/);
});

test('generates SHA-1 warning for compatibility-only checks', async () => {
  const result = await buildHashChecksum({
    inputType: 'text',
    text: 'hello',
    algorithm: 'sha-1'
  });

  assert.equal(result.algorithm, 'SHA-1');
  assert.equal(result.hex, 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  assert.match(result.warnings.join('\n'), /compatibility checks only/);
});

test('hashes file bytes and compares expected hex digest', async () => {
  const result = await buildHashChecksum({
    inputType: 'file',
    fileName: 'sample.txt',
    fileBytes: new TextEncoder().encode('hello'),
    algorithm: 'SHA-256',
    expectedDigest: '2c:f2:4d:ba:5f:b0:a3:0e:26:e8:3b:2a:c5:b9:e2:9e:1b:16:1e:5c:1f:a7:42:5e:73:04:33:62:93:8b:98:24'
  });

  assert.equal(result.inputName, 'sample.txt');
  assert.equal(result.match.status, 'match');
  assert.equal(result.match.label, 'Match');
});

test('compares expected Base64 digest and reports mismatches', async () => {
  const matching = await buildHashChecksum({
    inputType: 'text',
    text: 'hello',
    algorithm: 'SHA-256',
    expectedDigest: 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='
  });
  const mismatching = await buildHashChecksum({
    inputType: 'text',
    text: 'hello',
    algorithm: 'SHA-256',
    expectedDigest: 'not-the-same'
  });

  assert.equal(matching.match.status, 'match');
  assert.equal(mismatching.match.status, 'mismatch');
  assert.match(mismatching.warnings.join('\n'), /does not match/);
});

test('normalises expected digests and algorithms', () => {
  assert.deepEqual(normaliseExpectedDigest('AA:BB cc'), { format: 'hex', value: 'aabbcc' });
  assert.deepEqual(normaliseExpectedDigest('LPJNul+wow4='), { format: 'base64', value: 'LPJNul+wow4=' });
  assert.equal(normaliseExpectedDigest(''), null);
  assert.equal(normaliseAlgorithm('sha-512'), 'SHA-512');
  assert.throws(() => normaliseAlgorithm('MD5'), /supported SHA algorithm/);
});

test('reports missing input and empty files', async () => {
  assert.throws(() => textToBytes(''), /Enter text/);
  await assert.rejects(() => hashBytes(new Uint8Array(), 'SHA-256'), /Enter text or select a file/);
  await assert.rejects(() => buildHashChecksum({ inputType: 'file', fileBytes: new Uint8Array() }), /Select a file/);
});

test('builds safe output file names', () => {
  assert.equal(buildHashOutputFileName('sample.txt'), 'sample.txt.sha.txt');
  assert.equal(buildHashOutputFileName('bad:name?.pdf'), 'bad_name_.pdf.sha.txt');
  assert.equal(buildHashOutputFileName(''), 'hash-checksum.sha.txt');
});

test('compares expected digest helper directly', () => {
  const digest = {
    hex: 'abc123',
    base64: 'q8Ej'
  };

  assert.equal(compareExpectedDigest(null, digest).status, 'not-provided');
  assert.equal(compareExpectedDigest({ format: 'hex', value: 'abc123' }, digest).status, 'match');
  assert.equal(compareExpectedDigest({ format: 'base64', value: 'nope' }, digest).status, 'mismatch');
});
