import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import {
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
