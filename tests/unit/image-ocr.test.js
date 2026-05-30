import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IMAGE_OCR_LANGUAGE,
  buildOcrOutputFileName,
  buildOcrResult,
  buildTesseractWorkerOptions,
  countOcrWords,
  createOcrTextBlob,
  detectOcrImageFileType,
  formatOcrConfidence,
  normaliseOcrProgressStatus,
  normaliseOcrText,
  recogniseImageFile,
  validateOcrImageFile
} from '../../src/tools/image-ocr.js';

test('detects supported OCR image files by MIME type and extension', () => {
  assert.equal(detectOcrImageFileType({ name: 'screenshot.png', type: '' }).value, 'png');
  assert.equal(detectOcrImageFileType({ name: 'scan', type: 'image/jpeg' }).value, 'jpeg');
  assert.equal(detectOcrImageFileType({ name: 'diagram.webp', type: '' }).value, 'webp');
  assert.equal(detectOcrImageFileType({ name: 'form.bmp', type: '' }).value, 'bmp');
  assert.equal(detectOcrImageFileType({ name: 'capture.gif', type: '' }).value, 'gif');
  assert.equal(detectOcrImageFileType({ name: 'notes.txt', type: 'text/plain' }), null);
});

test('validates OCR image inputs and builds safe output names', () => {
  assert.equal(validateOcrImageFile({ name: 'receipt.PNG', type: '' }).label, 'PNG');
  assert.throws(() => validateOcrImageFile(null), /Select an image/);
  assert.throws(() => validateOcrImageFile({ name: 'archive.zip', type: 'application/zip' }), /Unsupported image type/);

  assert.equal(buildOcrOutputFileName('receipt.png'), 'receipt.ocr.txt');
  assert.equal(buildOcrOutputFileName('receipt.ocr.txt'), 'receipt.ocr.txt');
  assert.equal(buildOcrOutputFileName('bad:name?.jpg'), 'bad_name_.ocr.txt');
  assert.equal(buildOcrOutputFileName(''), 'image.ocr.txt');
});

test('normalises OCR text, confidence and result summaries', async () => {
  assert.equal(normaliseOcrText('  Hello\r\nOCR  '), 'Hello\nOCR');
  assert.equal(countOcrWords('Hello OCR\nagain'), 3);
  assert.equal(countOcrWords(''), 0);
  assert.equal(formatOcrConfidence(88.234), '88.2%');
  assert.equal(formatOcrConfidence('bad'), 'Unknown');

  const result = buildOcrResult({
    text: ' Hello OCR ',
    confidence: 91.25
  }, {
    name: 'sample.png'
  }, {
    label: 'PNG'
  });

  assert.equal(result.text, 'Hello OCR');
  assert.equal(result.displayText, 'Hello OCR');
  assert.equal(result.confidenceLabel, '91.3%');
  assert.equal(result.wordCount, 2);
  assert.equal(result.outputName, 'sample.ocr.txt');

  const emptyResult = buildOcrResult({ text: '' }, { name: 'blank.png' });
  assert.equal(emptyResult.displayText, 'No text was detected.');

  const blob = createOcrTextBlob('');
  assert.equal(blob.type, 'text/plain;charset=utf-8');
  assert.equal(await blob.text(), 'No text was detected.');
});

test('builds local Tesseract paths and progress labels', () => {
  const options = buildTesseractWorkerOptions(() => {});

  assert.ok(options.workerPath.endsWith('/src/vendor/tesseract/worker.min.js') || options.workerPath.endsWith('\\src\\vendor\\tesseract\\worker.min.js'));
  assert.ok(options.corePath.includes('/src/vendor/tesseract/core') || options.corePath.includes('\\src\\vendor\\tesseract\\core'));
  assert.ok(options.langPath.includes('/src/vendor/tesseract/lang') || options.langPath.includes('\\src\\vendor\\tesseract\\lang'));
  assert.equal(options.workerBlobURL, false);
  assert.equal(options.cacheMethod, 'write');
  assert.equal(options.gzip, true);
  assert.doesNotMatch(options.workerPath, /cdn|jsdelivr/i);
  assert.doesNotMatch(options.corePath, /cdn|jsdelivr/i);
  assert.doesNotMatch(options.langPath, /cdn|jsdelivr/i);

  assert.equal(normaliseOcrProgressStatus({ status: 'recognizing text', progress: 0.42 }), 'Recognising text (42%)');
  assert.equal(normaliseOcrProgressStatus({ status: 'initializing api', progress: 1 }), 'Initialising OCR engine (100%)');
  assert.equal(normaliseOcrProgressStatus({ status: 'unknown' }), 'Running OCR');
});

test('recognises an image through an injected Tesseract runtime', async () => {
  const calls = {
    terminated: false
  };
  const tesseract = {
    OEM: {
      LSTM_ONLY: 1
    },
    async createWorker(language, oem, options) {
      calls.language = language;
      calls.oem = oem;
      calls.options = options;

      return {
        async recognize(file) {
          calls.file = file;
          return {
            data: {
              text: 'HELLO OCR\n',
              confidence: 87
            }
          };
        },
        async terminate() {
          calls.terminated = true;
        }
      };
    }
  };
  const file = { name: 'sample.png', type: 'image/png' };
  const result = await recogniseImageFile(file, {
    tesseract,
    onProgress: () => {}
  });

  assert.equal(calls.language, IMAGE_OCR_LANGUAGE.code);
  assert.equal(calls.oem, 1);
  assert.equal(typeof calls.options.logger, 'function');
  assert.equal(calls.file, file);
  assert.equal(calls.terminated, true);
  assert.equal(result.text, 'HELLO OCR');
  assert.equal(result.confidenceLabel, '87%');
});
