import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import {
  createCroppedWordOptimiserDocx,
  createNonShrinkingWordOptimiserDocx,
  createProcessingFailureWordOptimiserDocx,
  createTallRasterWordOptimiserDocx,
  createWordOptimiserDocx,
  dropFile
} from './support.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test.setTimeout(60_000);

test('navigates to Word Document Optimiser with local-only DOCX guidance', async ({ page }) => {
  await page.goto('/#word-document-optimiser');

  await expect(page).toHaveURL(/#word-document-optimiser$/);
  await expect(page.getByRole('heading', { name: 'Word Document Optimiser', exact: true })).toBeVisible();
  await expect(page.locator('[data-tool-id="word-document-optimiser"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#wordOptimiserDropZone')).toContainText('original file is never modified');
  await expect(page.locator('#wordOptimiserAnalysisSection')).toBeHidden();
  await expect(page.locator('#wordOptimiserPreset')).toHaveValue('documentation');
});

test('uploads and drops a realistic screenshot-heavy DOCX and reports analysis', async ({ page }) => {
  const buffer = createWordOptimiserDocx();
  await page.goto('/#word-document-optimiser');
  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Screenshots.docx',
    mimeType: DOCX_MIME,
    buffer
  });

  await expect(page.locator('#wordOptimiserStatus')).toContainText('Analysis ready');
  await expect(page.locator('#wordOptimiserAnalysisSection')).toBeVisible();
  await expect(page.locator('#wordOptimiserRasterCount')).toHaveText('5');
  await expect(page.locator('#wordOptimiserOversizedCount')).toHaveText('1');
  await expect(page.locator('#wordOptimiserPreservedCount')).toHaveText('2');
  await expect(page.locator('#wordOptimiserUnknownDisplayCount')).toHaveText('2');
  await expect(page.locator('#wordOptimiserImageShare')).toContainText('%');
  await expect(page.locator('#wordOptimiserEstimatedSize')).not.toHaveText('0 B');
  await expect(page.locator('#wordOptimiserEstimatedSaving')).toContainText('%');
  await expect(page.locator('.word-optimiser-card')).toHaveCount(6);
  await expect(page.locator('.word-optimiser-card.status-optimise').filter({ hasText: 'screenshot.png' })).toContainText('6 × 3.33 in');
  await expect(page.locator('.word-optimiser-card.status-optimise').filter({ hasText: 'screenshot.png' })).toContainText('300 PPI');
  await expect(page.locator('.word-optimiser-card.status-already-efficient').filter({ hasText: 'efficient.png' })).toContainText('Already efficient');
  await expect(page.locator('.word-optimiser-card.status-unsupported').filter({ hasText: 'diagram.svg' })).toContainText('Unsupported');

  await page.reload();
  await dropFile(page, '#wordOptimiserDropZone', {
    name: 'Dropped.docx',
    mimeType: DOCX_MIME,
    buffer
  });
  await expect(page.locator('#wordOptimiserStatus')).toContainText('Analysis ready');
});

test('changes presets deterministically and keeps individual overrides through filtering', async ({ page }) => {
  await page.goto('/#word-document-optimiser');
  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Presets.docx',
    mimeType: DOCX_MIME,
    buffer: createWordOptimiserDocx()
  });

  const screenshot = page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' });
  await expect(screenshot).toContainText('1,080 × 600 px');

  await page.locator('#wordOptimiserPreset').selectOption('high-fidelity');
  await expect(page.locator('#wordOptimiserPresetHint')).toContainText('220 PPI');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' })).toContainText('1,319 × 733 px');

  await page.locator('#wordOptimiserPreset').selectOption('smaller-file');
  await expect(page.locator('#wordOptimiserPresetHint')).toContainText('150 PPI');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' })).toContainText('900 × 500 px');

  await page.locator('#wordOptimiserPreset').selectOption('documentation');
  await page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' }).locator('[data-keep-original]').check();
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' })).toContainText('Keep original was selected');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' })).toHaveClass(/status-preserve/);

  await page.locator('#wordOptimiserReviewFilter').selectOption('optimise');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' })).toHaveCount(0);
  await page.locator('#wordOptimiserReviewFilter').selectOption('all');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' }).locator('[data-keep-original]')).toBeChecked();
});

test('optimises a controlled screenshot, validates the rebuilt DOCX and downloads it', async ({ page }) => {
  await page.goto('/#word-document-optimiser');
  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Readable Screenshots.docx',
    mimeType: DOCX_MIME,
    buffer: createWordOptimiserDocx()
  });
  await expect(page.locator('#wordOptimiserButton')).toBeEnabled();
  await page.getByRole('button', { name: 'Optimise document', exact: true }).click();

  await expect(page.locator('#wordOptimiserStatus')).toContainText('completed and validated', { timeout: 30_000 });
  await expect(page.locator('#wordOptimiserResultSection')).toBeVisible();
  await expect(page.locator('#wordOptimiserResultChanged')).toHaveText('1');
  await expect(page.locator('#wordOptimiserResultSaved')).not.toHaveText('0 B');
  await expect(page.locator('#wordOptimiserResultStatus')).toContainText('reopened and validated locally');
  await expect(page.locator('#wordOptimiserDownload')).toBeVisible();

  const screenshot = page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' });
  await expect(screenshot.locator('.word-optimiser-preview-figure')).toHaveCount(2);
  await expect(screenshot.locator('.word-optimiser-preview-figure').nth(0)).toContainText('Original');
  await expect(screenshot.locator('.word-optimiser-preview-figure').nth(1)).toContainText('Optimised');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#wordOptimiserDownload').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Readable Screenshots-optimised.docx');
  const outputBuffer = await readFile(await download.path());
  expect(outputBuffer.length).toBeGreaterThan(0);

  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Readable Screenshots-optimised.docx',
    mimeType: DOCX_MIME,
    buffer: outputBuffer
  });
  await expect(page.locator('#wordOptimiserStatus')).toContainText('Analysis ready');
  await expect(page.locator('#wordOptimiserAnalysisSection')).toBeVisible();
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' })).toContainText('1,080 × 600 px');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' })).toContainText('Already efficient');
});

test('optimises a browser-decodable tall raster above the former axis boundary', async ({ page }) => {
  const buffer = createTallRasterWordOptimiserDocx();
  await page.goto('/#word-document-optimiser');
  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Tall Diagram.docx',
    mimeType: DOCX_MIME,
    buffer
  });

  const diagram = page.locator('.word-optimiser-card').filter({ hasText: 'tall-diagram.png' });
  await expect(diagram).toContainText('1,238 × 12,921 px');
  await expect(diagram).toContainText('Approximately 180 PPI');
  await expect(diagram).toHaveClass(/status-already-efficient/);

  await page.locator('#wordOptimiserPreset').selectOption('smaller-file');
  await expect(diagram).toContainText('Approximately 150 PPI');
  await expect(diagram).toContainText('1,000 × 10,434 px');
  await expect(diagram).toHaveClass(/status-optimise/);

  await page.getByRole('button', { name: 'Optimise document', exact: true }).click();
  await expect(page.locator('#wordOptimiserStatus')).toContainText('completed and validated', { timeout: 60_000 });
  await expect(page.locator('#wordOptimiserResultSection')).toBeVisible();
  await expect(page.locator('#wordOptimiserResultChanged')).toHaveText('1');
  await expect(page.locator('#wordOptimiserResultSaved')).not.toHaveText('0 B');
  await expect(diagram).toHaveClass(/status-optimise/);
  await expect(diagram.locator('.word-optimiser-preview-figure')).toHaveCount(2);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#wordOptimiserDownload').click();
  const download = await downloadPromise;
  const outputBuffer = await readFile(await download.path());
  expect(outputBuffer.length).toBeLessThan(buffer.length);

  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Tall Diagram-optimised.docx',
    mimeType: DOCX_MIME,
    buffer: outputBuffer
  });
  await expect(page.locator('#wordOptimiserStatus')).toContainText('Analysis ready');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'tall-diagram.png' })).toContainText('1,000 × 10,434 px');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'tall-diagram.png' })).toHaveClass(/status-already-efficient/);
});

test('preserves one image processing failure and continues with other images', async ({ page }) => {
  await page.goto('/#word-document-optimiser');
  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Per-image failures.docx',
    mimeType: DOCX_MIME,
    buffer: createProcessingFailureWordOptimiserDocx()
  });

  await page.evaluate(() => {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    let callCount = 0;
    HTMLCanvasElement.prototype.toBlob = function patchedToBlob(callback, type, quality) {
      callCount += 1;
      if (callCount === 1) {
        callback(null);
        return;
      }
      originalToBlob.call(this, callback, type, quality);
    };
  });

  await page.getByRole('button', { name: 'Optimise document', exact: true }).click();
  await expect(page.locator('#wordOptimiserStatus')).toContainText('completed and validated', { timeout: 60_000 });
  await expect(page.locator('#wordOptimiserResultSection')).toBeVisible();
  await expect(page.locator('#wordOptimiserResultChanged')).toHaveText('1');
  await expect(page.locator('#wordOptimiserResultProcessingFailures')).toHaveText('1');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'first.png' })).toHaveClass(/status-preserve/);
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'first.png' })).toContainText('could not be resized safely');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'second.png' })).toHaveClass(/status-optimise/);
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'second.png' }).locator('.word-optimiser-preview-figure')).toHaveCount(2);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#wordOptimiserDownload').click();
  const download = await downloadPromise;
  const outputBuffer = await readFile(await download.path());
  expect(outputBuffer.length).toBeLessThan(createProcessingFailureWordOptimiserDocx().length);

  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Per-image failures-optimised.docx',
    mimeType: DOCX_MIME,
    buffer: outputBuffer
  });
  await expect(page.locator('#wordOptimiserStatus')).toContainText('Analysis ready');
});

test('lossless clean-up preserves the source image bytes and still produces a validated copy', async ({ page }) => {
  await page.goto('/#word-document-optimiser');
  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Lossless.docx',
    mimeType: DOCX_MIME,
    buffer: createWordOptimiserDocx()
  });
  await page.locator('#wordOptimiserPreset').selectOption('lossless');
  await expect(page.locator('#wordOptimiserOversizedCount')).toHaveText('0');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'screenshot.png' })).toContainText('Lossless clean-up');
  await page.getByRole('button', { name: 'Optimise document', exact: true }).click();
  await expect(page.locator('#wordOptimiserStatus')).toContainText('No replacement was smaller', { timeout: 30_000 });
  await expect(page.locator('#wordOptimiserResultChanged')).toHaveText('0');
});

test('protects a cropped screenshot and leaves it unchanged in the validated DOCX', async ({ page }) => {
  const buffer = createCroppedWordOptimiserDocx();
  await page.goto('/#word-document-optimiser');
  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Cropped Screenshot.docx',
    mimeType: DOCX_MIME,
    buffer
  });

  const screenshot = page.locator('.word-optimiser-card').filter({ hasText: 'cropped-screenshot.png' });
  await expect(screenshot).toHaveClass(/status-preserve/);
  await expect(screenshot).toContainText('This image uses Word cropping');
  await expect(page.locator('#wordOptimiserOversizedCount')).toHaveText('0');

  await page.getByRole('button', { name: 'Optimise document', exact: true }).click();
  await expect(page.locator('#wordOptimiserStatus')).toContainText('beneficial optimisation was produced', { timeout: 30_000 });
  await expect(page.locator('#wordOptimiserResultChanged')).toHaveText('0');
  await expect(page.locator('#wordOptimiserResultSaved')).toHaveText('0 B');
  await expect(page.locator('#wordOptimiserResultReduction')).toHaveText('0%');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#wordOptimiserDownload').click();
  const download = await downloadPromise;
  const outputBuffer = await readFile(await download.path());
  expect(outputBuffer.equals(buffer)).toBe(true);

  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Cropped Screenshot-optimised.docx',
    mimeType: DOCX_MIME,
    buffer: outputBuffer
  });
  await expect(page.locator('#wordOptimiserStatus')).toContainText('Analysis ready');
  await expect(page.locator('.word-optimiser-card').filter({ hasText: 'cropped-screenshot.png' })).toHaveClass(/status-preserve/);
});

test('retains the original when attempted replacements do not make the final DOCX smaller', async ({ page }) => {
  const buffer = createNonShrinkingWordOptimiserDocx();
  await page.goto('/#word-document-optimiser');
  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'No Smaller Output.docx',
    mimeType: DOCX_MIME,
    buffer
  });
  await page.evaluate(() => {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function patchedToBlob(callback, type, quality) {
      originalToBlob.call(this, blob => {
        blob.arrayBuffer().then(bytes => callback(new Blob([bytes, new Uint8Array(400_000)], { type })));
      }, type, quality);
    };
  });

  await expect(page.locator('#wordOptimiserButton')).toBeEnabled();
  await page.getByRole('button', { name: 'Optimise document', exact: true }).click();
  await expect(page.locator('#wordOptimiserStatus')).toContainText('not smaller than the original', { timeout: 30_000 });
  await expect(page.locator('#wordOptimiserResultChanged')).toHaveText('0');
  await expect(page.locator('#wordOptimiserResultSaved')).toHaveText('0 B');
  await expect(page.locator('#wordOptimiserResultReduction')).toHaveText('0%');
  await expect(page.locator('#wordOptimiserResultStatus')).toContainText('original package was retained');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#wordOptimiserDownload').click();
  const download = await downloadPromise;
  const outputBuffer = await readFile(await download.path());
  expect(outputBuffer.equals(buffer)).toBe(true);

  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'No Smaller Output-optimised.docx',
    mimeType: DOCX_MIME,
    buffer: outputBuffer
  });
  await expect(page.locator('#wordOptimiserStatus')).toContainText('Analysis ready');
  await expect(page.locator('#wordOptimiserAnalysisSection')).toBeVisible();
});

test('keeps the validated output section hidden and shows one error when output presentation fails', async ({ page }) => {
  await page.goto('/#word-document-optimiser');
  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Output failure.docx',
    mimeType: DOCX_MIME,
    buffer: createWordOptimiserDocx()
  });
  await page.evaluate(docxMime => {
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      if (blob?.type === docxMime) throw new Error('Forced output presentation failure');
      return originalCreateObjectURL(blob);
    };
  }, DOCX_MIME);

  await page.getByRole('button', { name: 'Optimise document', exact: true }).click();
  await expect(page.locator('#wordOptimiserStatus')).toContainText('Forced output presentation failure', { timeout: 30_000 });
  await expect(page.locator('#wordOptimiserResultSection')).toBeHidden();
  await expect(page.locator('#wordOptimiserResultStatus')).toHaveText('');
  await expect(page.locator('#wordOptimiserDownload')).toBeHidden();
  await expect(page.locator('#wordOptimiserValidation')).toBeHidden();

  const visibleErrors = await page.locator('.status-message.error').evaluateAll(elements => elements
    .filter(element => !element.hidden)
    .map(element => element.textContent.trim())
    .filter(Boolean));
  expect(visibleErrors).toEqual(['Forced output presentation failure']);
});

test('rejects legacy .doc input with the existing save-as guidance', async ({ page }) => {
  await page.goto('/#word-document-optimiser');
  await page.setInputFiles('#wordOptimiserFileInput', {
    name: 'Legacy.doc',
    mimeType: 'application/msword',
    buffer: Buffer.from([1, 2, 3])
  });

  await expect(page.locator('#wordOptimiserValidation')).toBeVisible();
  await expect(page.locator('#wordOptimiserValidation')).toContainText('Legacy .doc files are not supported');
  await expect(page.locator('#wordOptimiserValidation')).toContainText('Save the document as .docx');
  await expect(page.locator('#wordOptimiserAnalysisSection')).toBeHidden();
});
