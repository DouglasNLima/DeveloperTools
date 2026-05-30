import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertSafeSvgText,
  buildEmbeddedRasterSvg,
  buildImageConversionWarnings,
  buildImageOutputFileName,
  calculateContainDimensions,
  detectImageFileType,
  determineConversionMode,
  normaliseBackgroundColour,
  normaliseImageFormat,
  normaliseRasterQuality,
  normaliseResizeOptions,
  validateImageFile
} from '../../src/tools/image-converter.js';

test('detects supported image files by MIME type and extension', () => {
  assert.equal(detectImageFileType({ name: 'icon.svg', type: '' }).value, 'svg');
  assert.equal(detectImageFileType({ name: 'photo', type: 'image/png' }).value, 'png');
  assert.equal(detectImageFileType({ name: 'portrait.jpeg', type: '' }).value, 'jpeg');
  assert.equal(detectImageFileType({ name: 'preview.webp', type: '' }).value, 'webp');
  assert.equal(detectImageFileType({ name: 'notes.txt', type: 'text/plain' }), null);
});

test('validates image files and target formats', () => {
  assert.equal(validateImageFile({ name: 'logo.svg', type: 'image/svg+xml' }).label, 'SVG');
  assert.equal(normaliseImageFormat('JPEG').mimeType, 'image/jpeg');
  assert.throws(() => validateImageFile({ name: 'archive.zip', type: 'application/zip' }), /Unsupported image type/);
  assert.throws(() => normaliseImageFormat('gif'), /supported target image format/);
});

test('chooses conversion modes for supported paths', () => {
  assert.equal(determineConversionMode('svg', 'svg'), 'svg-pass-through');
  assert.equal(determineConversionMode('svg', 'png'), 'svg-to-raster');
  assert.equal(determineConversionMode('png', 'svg'), 'raster-to-svg');
  assert.equal(determineConversionMode('webp', 'jpeg'), 'raster-to-raster');
});

test('normalises quality, resize and background controls', () => {
  assert.equal(normaliseRasterQuality('0.8', 'webp'), 0.8);
  assert.equal(normaliseRasterQuality('2', 'jpeg'), 1);
  assert.equal(normaliseRasterQuality('bad', 'jpeg'), 0.92);
  assert.equal(normaliseRasterQuality('0.5', 'png'), null);
  assert.deepEqual(normaliseResizeOptions({ maxWidth: '800', maxHeight: '' }), {
    maxWidth: 800,
    maxHeight: null,
    hasResize: true
  });
  assert.deepEqual(calculateContainDimensions(1600, 900, { maxWidth: 800, maxHeight: 800 }), {
    width: 800,
    height: 450,
    scale: 0.5
  });
  assert.equal(normaliseBackgroundColour('#abc'), '#aabbcc');
  assert.throws(() => normaliseResizeOptions({ maxWidth: '-1' }), /positive whole number/);
  assert.throws(() => normaliseBackgroundColour('white'), /valid background colour/);
});

test('builds safe output file names', () => {
  assert.equal(buildImageOutputFileName('logo.svg', 'png'), 'logo.png');
  assert.equal(buildImageOutputFileName('photo.final.jpeg', 'webp'), 'photo.final.webp');
  assert.equal(buildImageOutputFileName('bad:name?.png', 'svg'), 'bad_name_.svg');
  assert.equal(buildImageOutputFileName('', 'jpeg'), 'converted-image.jpg');
});

test('validates SVG text before browser conversion', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';

  assert.equal(assertSafeSvgText(svg), svg);
  assert.throws(() => assertSafeSvgText(''), /SVG input is empty/);
  assert.throws(() => assertSafeSvgText('<html></html>'), /does not contain an SVG document/);
  assert.throws(() => assertSafeSvgText('<svg><image href="https://example.test/a.png"/></svg>'), /external references/);
});

test('builds embedded raster SVG output and warnings', () => {
  const output = buildEmbeddedRasterSvg({
    dataUrl: 'data:image/png;base64,AAAA',
    width: 12,
    height: 8,
    title: 'pixel.png'
  });
  const warnings = buildImageConversionWarnings({
    sourceFormat: 'png',
    targetFormat: 'svg',
    resized: true
  });

  assert.match(output, /^<svg /);
  assert.match(output, /viewBox="0 0 12 8"/);
  assert.match(output, /href="data:image\/png;base64,AAAA"/);
  assert.match(warnings.join('\n'), /does not vectorise/);
  assert.match(warnings.join('\n'), /resized/);
  assert.throws(() => buildEmbeddedRasterSvg({ dataUrl: 'not-data', width: 1, height: 1 }), /Data URL/);
});
