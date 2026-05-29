import test from 'node:test';
import assert from 'node:assert/strict';
import { isAcceptedFile } from '../../src/tools/file-drop-zone.js';

test('accepts files by extension, MIME type and wildcard rules', () => {
  assert.equal(isAcceptedFile({ name: 'contacts.csv', type: '' }, [
    { kind: 'extension', value: '.csv' }
  ]), true);
  assert.equal(isAcceptedFile({ name: 'payload.bin', type: 'application/json' }, [
    { kind: 'mime', value: 'application/json' }
  ]), true);
  assert.equal(isAcceptedFile({ name: 'photo.png', type: 'image/png' }, [
    { kind: 'wildcard', value: 'image/' }
  ]), true);
});

test('rejects unsupported file types when accept rules are present', () => {
  assert.equal(isAcceptedFile({ name: 'payload.exe', type: 'application/octet-stream' }, [
    { kind: 'extension', value: '.json' },
    { kind: 'mime', value: 'application/json' }
  ]), false);
});

test('accepts any file when no accept rules are provided', () => {
  assert.equal(isAcceptedFile({ name: 'anything.bin', type: 'application/octet-stream' }, []), true);
});
