import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildImageResizeWarnings,
  buildImageResizerOutputFileName,
  calculateDimensionScale,
  calculateMaxResizeDimensions,
  calculateScaleDimensions,
  normaliseMaxResizeDimensions,
  normaliseOutputImageFormat,
  normaliseQualityPercent,
  normaliseResizeMode,
  normaliseScalePercent,
  normaliseTargetFileSize,
  summariseImageSizeChange
} from '../../src/tools/image-resizer.js';
import { normaliseImageFormat } from '../../src/tools/image-converter.js';

test('normalises output formats and resize modes', () => {
  assert.equal(normaliseOutputImageFormat('JPEG').mimeType, 'image/jpeg');
  assert.equal(normaliseOutputImageFormat('webp').extension, 'webp');
  assert.equal(normaliseResizeMode('target-size'), 'target-size');
  assert.throws(() => normaliseOutputImageFormat('svg'), /PNG, JPEG or WebP/);
  assert.throws(() => normaliseResizeMode('crop'), /supported resize mode/);
});

test('validates scale percentage and quality controls', () => {
  assert.equal(normaliseScalePercent('50'), 50);
  assert.equal(normaliseScalePercent(99.6), 100);
  assert.equal(normaliseQualityPercent('', 'jpeg'), 82);
  assert.equal(normaliseQualityPercent('75', 'webp'), 75);
  assert.equal(normaliseQualityPercent('75', 'png'), null);
  assert.throws(() => normaliseScalePercent('0'), /between 1% and 100%/);
  assert.throws(() => normaliseScalePercent('bad'), /number between 1% and 100%/);
  assert.throws(() => normaliseQualityPercent('9', 'jpeg'), /between 10% and 100%/);
});

test('calculates percentage and maximum dimensions without upscaling', () => {
  assert.deepEqual(calculateScaleDimensions(1600, 900, 50), {
    width: 800,
    height: 450,
    scale: 0.5
  });
  assert.deepEqual(calculateMaxResizeDimensions(1600, 900, { maxWidth: 800, maxHeight: 800 }), {
    width: 800,
    height: 450,
    scale: 0.5
  });
  assert.deepEqual(calculateMaxResizeDimensions(640, 480, { maxWidth: 1200 }), {
    width: 640,
    height: 480,
    scale: 1
  });
  assert.deepEqual(calculateDimensionScale(1600, 900, 0.25), {
    width: 400,
    height: 225,
    scale: 0.25
  });
});

test('validates maximum dimension and target size inputs', () => {
  assert.deepEqual(normaliseMaxResizeDimensions({ maxWidth: '1024', maxHeight: '' }), {
    maxWidth: 1024,
    maxHeight: null
  });
  assert.equal(normaliseTargetFileSize('25', 'KB'), 25 * 1024);
  assert.equal(normaliseTargetFileSize('1.5', 'MB'), Math.round(1.5 * 1024 * 1024));
  assert.throws(() => normaliseMaxResizeDimensions({}), /maximum width/);
  assert.throws(() => normaliseMaxResizeDimensions({ maxWidth: '-1' }), /positive whole number/);
  assert.throws(() => normaliseTargetFileSize('0.5', 'KB'), /between 1 KB and 100 MB/);
  assert.throws(() => normaliseTargetFileSize('10', 'GB'), /Choose KB or MB/);
  assert.throws(() => normaliseTargetFileSize('bad', 'KB'), /positive number/);
});

test('builds safe output file names', () => {
  assert.equal(buildImageResizerOutputFileName('photo.jpeg', 'webp'), 'photo.resized.webp');
  assert.equal(buildImageResizerOutputFileName('icon.final.png', 'jpeg'), 'icon.final.resized.jpg');
  assert.equal(buildImageResizerOutputFileName('bad:name?.svg', 'png'), 'bad_name_.resized.png');
  assert.equal(buildImageResizerOutputFileName('', 'png'), 'image.resized.png');
});

test('builds warnings for rasterisation, no-op reductions and unreachable targets', () => {
  const warnings = buildImageResizeWarnings({
    sourceFormat: normaliseImageFormat('svg'),
    targetFormat: normaliseOutputImageFormat('jpeg'),
    mode: 'dimensions',
    dimensions: { width: 640, height: 480, scale: 1 },
    sourceBytes: 1200,
    outputBytes: 1400
  });

  assert.match(warnings.join('\n'), /rasterised/);
  assert.match(warnings.join('\n'), /white background/);
  assert.match(warnings.join('\n'), /original size/);
  assert.match(warnings.join('\n'), /not smaller/);

  const targetWarnings = buildImageResizeWarnings({
    targetFormat: normaliseOutputImageFormat('png'),
    mode: 'target-size',
    targetBytes: 1024,
    outputBytes: 2048
  });

  assert.match(targetWarnings.join('\n'), /PNG output/);
  assert.match(targetWarnings.join('\n'), /could not be reached/);
});

test('summarises image size changes', () => {
  assert.deepEqual(summariseImageSizeChange(1000, 250), {
    sourceBytes: 1000,
    outputBytes: 250,
    savedBytes: 750,
    savedPercent: 75
  });
  assert.deepEqual(summariseImageSizeChange(1000, 1200), {
    sourceBytes: 1000,
    outputBytes: 1200,
    savedBytes: -200,
    savedPercent: -20
  });
});
