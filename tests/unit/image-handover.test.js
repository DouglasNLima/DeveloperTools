import assert from 'node:assert/strict';
import test from 'node:test';

import {
  consumeImageHandover,
  storeImageHandover
} from '../../src/tools/image-handover.js';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
}

test('stores and consumes local image handovers only for their intended target tool', () => {
  const storage = createStorage();
  const bytes = new Uint8Array([0, 1, 2, 255]);

  storeImageHandover({
    targetToolId: 'image-ocr',
    fileName: 'diagram.png',
    mimeType: 'image/png',
    bytes
  }, storage);

  assert.equal(consumeImageHandover('image-converter-optimiser', storage), null);
  const payload = consumeImageHandover('image-ocr', storage);
  assert.equal(payload.fileName, 'diagram.png');
  assert.equal(payload.mimeType, 'image/png');
  assert.deepEqual(payload.bytes, bytes);
  assert.equal(consumeImageHandover('image-ocr', storage), null);
});

test('rejects incomplete image handover payloads', () => {
  const storage = createStorage();
  assert.throws(
    () => storeImageHandover({ targetToolId: 'image-ocr', fileName: 'x.png', bytes: [1] }, storage),
    /image bytes are required/
  );
});
