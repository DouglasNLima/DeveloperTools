import { expect, test } from '@playwright/test';

import {
  APP_TITLE,
  SAMPLE_PNG,
  SAMPLE_SVG,
  createDependencySolutionZip,
  createFillablePdf,
  createGradientPng,
  createImportPreflightSolutionZip,
  createModelDrivenJavascriptSolutionZip,
  createOcrPng,
  createSolutionZip,
  dropFile,
  dropFiles,
  makeJwt,
  primeOfflineApp
} from './support.js';
test('encodes and decodes URL components', async ({ page }) => {
  await page.goto('/#url-codec');

  await expect(page.getByRole('heading', { name: 'URL & query string helper' })).toBeVisible();
  await page.getByLabel('Input').fill('hello world&x=1');
  await page.getByRole('button', { name: 'Process', exact: true }).click();

  await expect(page.locator('#urlOutput')).toHaveValue('hello%20world%26x%3D1');
  await expect(page.locator('#urlModeDetail')).toHaveText('Encode component');
  await expect(page.locator('#urlWarnings')).toHaveText('None');
  await expect(page.getByRole('status')).toContainText('Encoded component created successfully.');

  await page.getByLabel('Mode', { exact: true }).selectOption('decode-component');
  await page.getByLabel('Input').fill('hello%20world%26x%3D1');
  await page.getByRole('button', { name: 'Process', exact: true }).click();

  await expect(page.locator('#urlOutput')).toHaveValue('hello world&x=1');
  await expect(page.locator('#urlModeDetail')).toHaveText('Decode component');
});

test('generates text hashes and compares expected digests', async ({ page }) => {
  await page.goto('/#hash-checksums');

  await expect(page.getByRole('heading', { name: 'Hashes/checksums' })).toBeVisible();
  await page.getByLabel('Text input').fill('hello');
  await page.getByLabel('Expected digest').fill('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  await page.getByRole('button', { name: 'Generate hash', exact: true }).click();

  await expect(page.locator('#hashAlgorithmDetail')).toHaveText('SHA-256');
  await expect(page.locator('#hashInputDetail')).toHaveText('Text input');
  await expect(page.locator('#hashSizeDetail')).toHaveText('5 bytes');
  await expect(page.locator('#hashMatchDetail')).toHaveText('Match');
  await expect(page.locator('#hashWarningsDetail')).toHaveText('None');
  await expect(page.locator('#hashOutput')).toHaveValue(/2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824/);
  await expect(page.locator('#hashOutput')).toHaveValue(/LPJNul\+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=/);
  await expect(page.locator('#downloadHashButton')).toHaveAttribute('download', 'Text input.sha.txt');
  await expect(page.getByRole('status')).toContainText('Hash generated successfully.');
});

test('generates file hashes and reports warnings or validation errors', async ({ page }) => {
  await page.goto('/#hash-checksums');

  await page.getByLabel('Input type').selectOption('file');
  await page.setInputFiles('#hashFileInput', {
    name: 'hello.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello')
  });
  await page.getByLabel('Algorithm').selectOption('SHA-1');
  await page.getByLabel('Expected digest').fill('definitely-not-the-same');
  await page.getByRole('button', { name: 'Generate hash', exact: true }).click();

  await expect(page.locator('#hashAlgorithmDetail')).toHaveText('SHA-1');
  await expect(page.locator('#hashInputDetail')).toHaveText('hello.txt');
  await expect(page.locator('#hashMatchDetail')).toHaveText('Mismatch');
  await expect(page.locator('#hashWarningsDetail')).toHaveText('2 warnings');
  await expect(page.locator('#hashOutput')).toHaveValue(/aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d/);
  await expect(page.getByRole('status')).toContainText('SHA-1 is included for compatibility checks only');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Generate hash', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Enter text before generating a hash.');
});

test('accepts dropped files in every file-capable tool', async ({ page }) => {
  await page.goto('/#file-to-base64');
  await dropFile(page, '#dropZone', {
    name: 'hello.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello')
  });

  await expect(page.locator('#sourceFileName')).toHaveText('hello.txt');
  await expect(page.locator('#base64Output')).toHaveValue('aGVsbG8=');

  await page.goto('/#hash-checksums');
  await page.getByLabel('Input type').selectOption('file');
  await dropFile(page, '#hashFilePanel', {
    name: 'hello.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello')
  });
  await page.getByRole('button', { name: 'Generate hash', exact: true }).click();

  await expect(page.locator('#hashInputDetail')).toHaveText('hello.txt');
  await expect(page.locator('#hashOutput')).toHaveValue(/2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824/);

  await page.goto('/#csv-tsv-helper');
  await dropFile(page, '#csvFileDropZone', {
    name: 'contacts.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,email\nAda,ada@example.test')
  });

  await expect(page.getByRole('status')).toContainText('Loaded contacts.csv.');
  await expect(page.getByLabel('CSV/TSV input')).toHaveValue(/Ada,ada@example.test/);

  await page.goto('/#data-explorer');
  await dropFile(page, '#dataExplorerFileDropZone', {
    name: 'records.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"items":[{"name":"Ada"}]}')
  });

  await expect(page.getByRole('status')).toContainText('Loaded records.json.');
  await expect(page.getByLabel('Input format')).toHaveValue('json');
  await expect(page.getByLabel('JSON or XML input')).toHaveValue(/"name":"Ada"/);

  await page.goto('/#pdf-template-field-explorer');
  await dropFile(page, '#pdfTemplateDropZone', {
    name: 'template.pdf',
    mimeType: 'application/pdf',
    buffer: await createFillablePdf()
  });

  await expect(page.getByRole('status')).toContainText('PDF loaded successfully.');
  await expect(page.locator('#pdfFieldCount')).toHaveText('2');

  await page.goto('/#image-converter');
  await dropFiles(page, '#imageConverterDropZone', [
    {
      name: 'mark.svg',
      mimeType: 'image/svg+xml',
      buffer: SAMPLE_SVG
    },
    {
      name: 'pixel.png',
      mimeType: 'image/png',
      buffer: SAMPLE_PNG
    }
  ]);

  await expect(page.getByRole('status')).toContainText('2 image files selected.');
  await page.getByRole('button', { name: 'Convert images', exact: true }).click();
  await expect(page.locator('#imageConvertedCount')).toHaveText('2');

  await page.goto('/#image-resizer-compressor');
  await dropFile(page, '#imageResizerDropZone', {
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: SAMPLE_PNG
  });

  await expect(page.locator('#imageResizerStatus')).toContainText('1 image file selected.');
  await page.getByRole('button', { name: 'Resize images', exact: true }).click();
  await expect(page.locator('.image-result-card.success')).toHaveCount(1);
});

test('parses and builds query strings', async ({ page }) => {
  await page.goto('/#url-codec');

  await page.getByLabel('Mode', { exact: true }).selectOption('parse-query');
  await page.getByLabel('Input').fill('https://example.test/search?q=hello+world&tag=alpha&tag=beta&empty=');
  await page.getByRole('button', { name: 'Process', exact: true }).click();

  await expect(page.locator('#urlItemCount')).toHaveText('4');
  await expect(page.locator('#urlWarnings')).toHaveText('2 warnings');
  await expect(page.locator('#urlOutput')).toHaveValue(/"hello world"/);
  await expect(page.locator('#urlOutput')).toHaveValue(/"empty"/);

  await page.getByLabel('Mode', { exact: true }).selectOption('build-query');
  await page.getByLabel('Input').fill('z=last\nq=hello world\ntag=alpha');
  await page.getByLabel('Sort keys when building a query string').check();
  await page.getByLabel('Prefix built query strings with ?').check();
  await page.getByRole('button', { name: 'Process', exact: true }).click();

  await expect(page.locator('#urlOutput')).toHaveValue('?q=hello%20world&tag=alpha&z=last');
  await expect(page.locator('#urlModeDetail')).toHaveText('Build query string');
  await expect(page.locator('#downloadUrlButton')).toHaveAttribute('download', 'url-query-output.txt');
});

test('reports URL helper validation errors', async ({ page }) => {
  await page.goto('/#url-codec');

  await page.getByLabel('Mode', { exact: true }).selectOption('decode-component');
  await page.getByLabel('Input').fill('hello%ZZ');
  await page.getByRole('button', { name: 'Process', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Invalid percent-encoding');

  await page.getByLabel('Mode', { exact: true }).selectOption('build-query');
  await page.getByLabel('Input').fill('not a row');
  await page.getByRole('button', { name: 'Process', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('must use key=value format');
});

test('hands parsed URL query JSON to JSON & Data Workbench explore mode', async ({ page }) => {
  await page.goto('/#url-codec');

  await page.getByLabel('Mode', { exact: true }).selectOption('parse-query');
  await page.getByLabel('Input').fill('https://example.test/search?q=hello+world&tag=alpha');
  await page.getByRole('button', { name: 'Process', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Explore JSON records/ }).click();

  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);
  await expect(page.getByRole('heading', { name: 'JSON & Data Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Explore');
  await expect(page.getByLabel('Input format')).toHaveValue('json');
  await expect(page.getByLabel('JSON or XML input')).toHaveValue(/"key": "q"/);

  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.locator('#dataExplorerSourceDetail')).toHaveText('2');
});

test('opens and closes the mobile tool menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const toggle = page.getByRole('button', { name: 'Open tool menu' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#toolSidebar')).not.toBeVisible();

  await toggle.click();
  await expect(page.getByRole('button', { name: 'Close tool menu' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#toolSidebar')).toBeVisible();

  await page.locator('[data-tool-id="base64-file-converter"]').click();
  await expect(page.getByRole('heading', { name: 'Base64 & File Converter' })).toBeVisible();
  await expect(page.locator('#toolSidebar')).not.toBeVisible();
});

test('creates a downloadable file from Base64 and reports validation errors', async ({ page }) => {
  await page.goto('/#base64-to-file');

  await page.getByLabel('Base64 content').fill('data:application/json;base64,eyJvayI6dHJ1ZX0=');
  await page.getByLabel('File name override').fill('sample');
  await page.getByRole('button', { name: 'Create file' }).click();

  await expect(page.getByRole('status')).toContainText('File created successfully as application/json.');
  await expect(page.locator('#recognisedType')).toHaveText('application/json');
  await expect(page.locator('#recognisedExtension')).toHaveText('.json');
  await expect(page.locator('#downloadButton')).toHaveAttribute('download', 'sample.json');
  await expect(page.getByRole('button', { name: 'Preview file' })).toBeVisible();

  await page.getByRole('button', { name: 'Preview file' }).click();
  const previewDialog = page.getByRole('dialog', { name: 'sample.json' });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.locator('.file-preview-text')).toContainText('"ok": true');
  await page.getByRole('button', { name: 'Close preview' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByLabel('Base64 content').fill('not valid !');
  await page.getByRole('button', { name: 'Create file' }).click();

  await expect(page.getByRole('status')).toContainText('not valid Base64');
});

test('converts a selected file to raw Base64 and Data URL output', async ({ page }) => {
  await page.goto('/#file-to-base64');

  await page.setInputFiles('#fileInput', {
    name: 'hello.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello')
  });

  await expect(page.locator('#base64Output')).toHaveValue('aGVsbG8=');
  await expect(page.locator('#sourceFileName')).toHaveText('hello.txt');
  await expect(page.locator('#downloadBase64Button')).toHaveAttribute('download', 'hello.txt.base64.txt');
  await expect(page.getByRole('status')).toContainText('File converted to Base64 successfully.');
  await expect(page.getByRole('button', { name: 'Preview file' })).toBeVisible();

  await page.getByRole('button', { name: 'Preview file' }).click();
  const previewDialog = page.getByRole('dialog', { name: 'hello.txt' });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.locator('.file-preview-text')).toContainText('hello');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByLabel('Output format').selectOption('dataUrl');
  await expect(page.locator('#base64Output')).toHaveValue('data:text/plain;base64,aGVsbG8=');
});

test('shows an unsupported Base64 preview fallback and clears it on navigation', async ({ page }) => {
  await page.goto('/#base64-to-file');

  await page.getByLabel('Base64 content').fill(`data:application/zip;base64,${Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]).toString('base64')}`);
  await page.getByLabel('File name override').fill('archive');
  await page.getByRole('button', { name: 'Create file' }).click();

  await expect(page.locator('#downloadButton')).toHaveAttribute('download', 'archive.zip');
  await page.getByRole('button', { name: 'Preview file' }).click();

  const previewDialog = page.getByRole('dialog', { name: 'archive.zip' });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog).toContainText('Preview unavailable');
  await expect(previewDialog.getByRole('link', { name: 'Download file' })).toHaveAttribute('download', 'archive.zip');

  await page.evaluate(() => {
    window.location.hash = '#file-to-base64';
  });

  await expect(page).toHaveURL(/#base64-file-converter\/file-to-base64$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('hands Base64 file output to the file creator', async ({ page }) => {
  await page.goto('/#file-to-base64');

  await page.setInputFiles('#fileInput', {
    name: 'hello.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello')
  });

  await expect(page.locator('#toolHandover')).toContainText('Continue with this Base64');
  await page.locator('#toolHandover').getByRole('button', { name: /Base64 output: Create file/ }).click();

  await expect(page).toHaveURL(/#base64-file-converter$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Base64 to file');
  await expect(page.getByLabel('Base64 content')).toHaveValue('aGVsbG8=');

  await page.getByRole('button', { name: 'Create file' }).click();
  await expect(page.locator('#recognisedType')).toHaveText('text/plain');
  await expect(page.locator('#downloadButton')).toHaveAttribute('download', 'converted.txt');
});

test('converts multiple local images to PNG outputs', async ({ page }) => {
  await page.goto('/#image-converter');

  await expect(page).toHaveURL(/#image-converter-optimiser$/);
  await expect(page.getByRole('heading', { name: 'Image Converter & Optimiser' })).toBeVisible();
  await expect(page.locator('[data-tool-id="image-converter-optimiser"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Convert');
  await page.setInputFiles('#imageConverterFileInput', [
    {
      name: 'mark.svg',
      mimeType: 'image/svg+xml',
      buffer: SAMPLE_SVG
    },
    {
      name: 'pixel.png',
      mimeType: 'image/png',
      buffer: SAMPLE_PNG
    }
  ]);

  await expect(page.locator('#imageSelectedCount')).toHaveText('2');
  await expect(page.getByRole('status')).toContainText('2 image files selected.');
  await page.getByRole('button', { name: 'Convert images', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Image conversion completed successfully.');
  await expect(page.locator('#imageConvertedCount')).toHaveText('2');
  await expect(page.locator('#imageFailedCount')).toHaveText('0');
  await expect(page.locator('.image-result-card.success')).toHaveCount(2);
  await expect(page.locator('.image-download-link[download="mark.png"]')).toBeVisible();
  await expect(page.locator('.image-download-link[download="pixel.png"]')).toBeVisible();

  await page.locator('.image-result-card.success').filter({ hasText: 'mark.png' }).getByRole('button', { name: 'Preview image' }).click();
  const previewDialog = page.getByRole('dialog', { name: 'mark.png' });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.locator('.file-preview-media')).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: 'Close preview' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('wraps raster images in SVG output with a clear warning', async ({ page }) => {
  await page.goto('/#image-converter');

  await page.getByLabel('Target format').selectOption('svg');
  await page.setInputFiles('#imageConverterFileInput', {
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: SAMPLE_PNG
  });
  await page.getByRole('button', { name: 'Convert images', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Image conversion completed successfully.');
  await expect(page.locator('#imageWarningsDetail')).toHaveText('1 warning');
  await expect(page.locator('.image-result-card.has-warning')).toBeVisible();
  await expect(page.locator('.image-warning-list')).toContainText('does not vectorise');
  await expect(page.locator('.image-download-link[download="pixel.svg"]')).toBeVisible();
});

test('reports Image converter validation errors', async ({ page }) => {
  await page.goto('/#image-converter');

  await page.getByRole('button', { name: 'Convert images', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Select one or more image files before converting.');

  await page.setInputFiles('#imageConverterFileInput', {
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image')
  });
  await page.getByRole('button', { name: 'Convert images', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Unsupported image type');
  await expect(page.locator('#imageFailedCount')).toHaveText('1');
  await expect(page.locator('.image-result-card.error')).toContainText('Choose SVG, PNG, JPEG or WebP');
});

test('opens Image resizer & compressor from the catalogue and previews percentage resizing', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('resizer');
  await page.locator('[data-tool-id="image-converter-optimiser"]').click();
  await page.getByRole('link', { name: 'Optimise' }).click();

  await expect(page).toHaveURL(/#image-converter-optimiser\/optimise$/);
  await expect(page.getByRole('heading', { name: 'Image Converter & Optimiser' })).toBeVisible();
  await expect(page.locator('[data-tool-id="image-converter-optimiser"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Optimise');

  await page.setInputFiles('#imageResizerFileInput', {
    name: 'banner.png',
    mimeType: 'image/png',
    buffer: await createGradientPng(page, 400, 300)
  });

  await expect(page.getByRole('status')).toContainText('1 image file selected.');
  await expect(page.locator('#imageResizerOutputSizeDetail')).toHaveText(/(?:bytes|KB|MB)$/);
  await expect(page.locator('#imageResizerDimensionsDetail')).toHaveText('200 x 150 px');

  await page.locator('#imageResizeScaleRange').fill('25');

  await expect(page.locator('#imageResizeScaleInput')).toHaveValue('25');
  await expect(page.locator('#imageResizerDimensionsDetail')).toHaveText('100 x 75 px');
  await page.getByRole('button', { name: 'Resize images', exact: true }).click();

  await expect(page.locator('#imageResizerStatus')).toContainText('Image resizing completed successfully.');
  await expect(page.locator('.image-result-card.success')).toHaveCount(1);
  await expect(page.locator('.image-download-link[download="banner.resized.jpg"]')).toBeVisible();
  await expect(page.locator('.image-result-card.success')).toHaveAttribute('data-output-width', '100');
  await expect(page.locator('.image-result-card.success')).toHaveAttribute('data-output-height', '75');
});

test('resizes images by maximum dimensions while preserving aspect ratio', async ({ page }) => {
  await page.goto('/#image-resizer-compressor');

  await page.getByLabel('Mode', { exact: true }).selectOption('dimensions');
  await page.getByLabel('Max width (px)').fill('120');
  await page.getByLabel('Max height (px)').fill('120');
  await page.setInputFiles('#imageResizerFileInput', {
    name: 'landscape.png',
    mimeType: 'image/png',
    buffer: await createGradientPng(page, 400, 300)
  });
  await page.getByRole('button', { name: 'Resize images', exact: true }).click();

  const resultCard = page.locator('.image-result-card.success');
  await expect(page.locator('#imageResizerStatus')).toContainText('Image resizing completed successfully.');
  await expect(resultCard).toHaveAttribute('data-output-width', '120');
  await expect(resultCard).toHaveAttribute('data-output-height', '90');
  await expect(resultCard).toContainText('120 x 90 px');
});

test('compresses images towards a target file size', async ({ page }) => {
  await page.goto('/#image-resizer-compressor');

  await page.getByLabel('Mode', { exact: true }).selectOption('target-size');
  await page.getByLabel('Output format', { exact: true }).selectOption('jpeg');
  await page.getByLabel('Target size').fill('12');
  await page.setInputFiles('#imageResizerFileInput', {
    name: 'pattern.png',
    mimeType: 'image/png',
    buffer: await createGradientPng(page, 1000, 700)
  });

  await expect(page.locator('#imageResizerTargetDetail')).toHaveText('12.00 KB');
  await page.getByRole('button', { name: 'Resize images', exact: true }).click();

  const resultCard = page.locator('.image-result-card.success');
  await expect(page.locator('#imageResizerStatus')).toContainText('Image resizing completed successfully.');
  await expect(resultCard).toHaveCount(1);

  const outputBytes = Number(await resultCard.getAttribute('data-output-bytes'));
  expect(outputBytes).toBeLessThanOrEqual(12 * 1024);
});

test('reports Image resizer validation errors', async ({ page }) => {
  await page.goto('/#image-resizer-compressor');

  await page.getByRole('button', { name: 'Resize images', exact: true }).click();
  await expect(page.locator('#imageResizerStatus')).toContainText('Select one or more image files before resizing.');

  await page.getByLabel('Mode', { exact: true }).selectOption('target-size');
  await page.getByLabel('Target size').fill('0.5');
  await page.setInputFiles('#imageResizerFileInput', {
    name: 'banner.png',
    mimeType: 'image/png',
    buffer: await createGradientPng(page, 400, 300)
  });
  await page.getByRole('button', { name: 'Resize images', exact: true }).click();

  await expect(page.locator('#imageResizerStatus')).toContainText('Target file size must be between 1 KB and 100 MB.');
});

test('extracts text from a local image with browser OCR', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/#image-ocr');

  await expect(page.getByRole('heading', { name: 'Image OCR' })).toBeVisible();
  await expect(page.locator('[data-tool-id="image-ocr"]')).toHaveAttribute('aria-current', 'page');
  await page.setInputFiles('#imageOcrFileInput', {
    name: 'hello-ocr.png',
    mimeType: 'image/png',
    buffer: await createOcrPng(page, 'HELLO OCR')
  });

  await expect(page.locator('#imageOcrSelectedFile')).toHaveText('hello-ocr.png');
  await expect(page.locator('#imageOcrTypeDetail')).toHaveText('PNG');
  await page.getByRole('button', { name: 'Run OCR', exact: true }).click();

  await expect(page.getByRole('status')).toContainText(/OCR completed/, { timeout: 90000 });
  await expect(page.locator('#imageOcrOutput')).toHaveValue(/HELLO\s+OCR/i);
  await expect(page.locator('#imageOcrOutputDetail')).toHaveText('Text extracted');
  await expect(page.locator('#imageOcrWordsDetail')).toHaveText(/[1-9]/);
  await expect(page.locator('#downloadImageOcrButton')).toHaveAttribute('download', 'hello-ocr.ocr.txt');
  await expect(page.locator('#toolHandover')).toContainText('Continue with this text');
});

test('reports Image OCR validation errors', async ({ page }) => {
  await page.goto('/#image-ocr');

  await page.getByRole('button', { name: 'Run OCR', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Select an image before running OCR.');

  await page.setInputFiles('#imageOcrFileInput', {
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('HELLO OCR')
  });
  await page.getByRole('button', { name: 'Run OCR', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Unsupported image type');
  await expect(page.locator('.image-result-card.error')).toContainText('Choose PNG, JPEG, WebP, BMP or non-animated GIF');
});

test('loads Image OCR assets offline after first OCR use', async ({ page }) => {
  test.setTimeout(180000);
  await primeOfflineApp(page);
  await page.goto('/#image-ocr');
  await page.setInputFiles('#imageOcrFileInput', {
    name: 'online-ocr.png',
    mimeType: 'image/png',
    buffer: await createOcrPng(page, 'ONLINE OCR')
  });
  await page.getByRole('button', { name: 'Run OCR', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(/OCR completed/, { timeout: 90000 });

  await page.context().setOffline(true);

  try {
    await page.goto('/#image-ocr');
    await page.setInputFiles('#imageOcrFileInput', {
      name: 'offline-ocr.png',
      mimeType: 'image/png',
      buffer: await createOcrPng(page, 'OFFLINE OCR')
    });
    await page.getByRole('button', { name: 'Run OCR', exact: true }).click();

    await expect(page.getByRole('status')).toContainText(/OCR completed/, { timeout: 90000 });
    await expect(page.locator('#imageOcrOutput')).toHaveValue(/OFFLINE\s+OCR/i);
  } finally {
    await page.context().setOffline(false);
  }
});
