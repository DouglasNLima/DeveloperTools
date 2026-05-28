import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base64ToBytes,
  bytesToBase64,
  cleanBase64,
  decodeBase64Input,
  detectFileType,
  formatBytes,
  normaliseFileName,
  normaliseTextFileName,
  parseBase64Input
} from '../../src/tools/base64.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

test('parses Data URL Base64 input and MIME type', () => {
  const parsed = parseBase64Input('data:application/pdf;base64,JVBERi0xLjQK');

  assert.deepEqual(parsed, {
    base64: 'JVBERi0xLjQK',
    mimeType: 'application/pdf'
  });
});

test('normalises URL-safe Base64 and missing padding', () => {
  assert.equal(cleanBase64('SGVsbG8'), 'SGVsbG8=');
  assert.equal(cleanBase64('SGVsbG8_'), 'SGVsbG8/');
});

test('rejects invalid Base64 characters', () => {
  assert.throws(() => cleanBase64('not valid !'), /not valid Base64/);
});

test('encodes and decodes bytes without changing content', () => {
  const source = textEncoder.encode('Hello from the local tool suite');
  const encoded = bytesToBase64(source);
  const decoded = base64ToBytes(encoded);

  assert.equal(textDecoder.decode(decoded), 'Hello from the local tool suite');
});

test('detects common binary file signatures', () => {
  assert.equal(detectFileType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), null).extension, 'pdf');
  assert.equal(detectFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), null).extension, 'png');
});

test('detects JSON content when no MIME type is supplied', () => {
  const encoded = bytesToBase64(textEncoder.encode('{"ok":true}'));
  const result = decodeBase64Input(encoded);

  assert.equal(result.fileInfo.mimeType, 'application/json');
  assert.equal(result.fileInfo.extension, 'json');
  assert.equal(result.fileInfo.label, 'JSON document');
});

test('honours Data URL MIME type when recognised', () => {
  const result = decodeBase64Input('data:text/plain;base64,SGVsbG8=');

  assert.equal(result.fileInfo.mimeType, 'text/plain');
  assert.equal(result.fileInfo.extension, 'txt');
  assert.equal(result.fileInfo.label, 'text/plain');
});

test('normalises unsafe file names and extensions', () => {
  assert.equal(normaliseFileName('report:name', 'pdf'), 'report_name.pdf');
  assert.equal(normaliseFileName('report.pdf', 'pdf'), 'report.pdf');
  assert.equal(normaliseTextFileName('', 'sample.json'), 'sample.json.base64.txt');
});

test('formats byte counts with British numeric locale expectations', () => {
  assert.equal(formatBytes(0), '0 bytes');
  assert.equal(formatBytes(1024), '1.00 KB');
  assert.equal(formatBytes(1536), '1.50 KB');
});
