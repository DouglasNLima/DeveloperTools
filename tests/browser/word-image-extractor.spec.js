import { expect, test } from '@playwright/test';

import {
  createWordImageDocx,
  createWordImageFormatsDocx,
  dropFile
} from './support.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test('navigates to Word Image Extractor and exposes local DOCX controls', async ({ page }) => {
  await page.goto('/#word-image-extractor');

  await expect(page).toHaveURL(/#word-image-extractor$/);
  await expect(page.getByRole('heading', { name: 'Word Image Extractor', exact: true })).toBeVisible();
  await expect(page.locator('[data-tool-id="word-image-extractor"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByLabel('Drop a Word document here or browse')).toBeVisible();
  await expect(page.locator('#wordImageReviewSection')).toBeHidden();
  await expect(page.locator('#wordImageOutputMode')).toHaveValue('zip');
});

test('uploads and drops a DOCX, inventories embedded and linked images, and shows metadata', async ({ page }) => {
  await page.goto('/#word-image-extractor');
  const buffer = createWordImageDocx();

  await page.setInputFiles('#wordImageFileInput', {
    name: 'Screenshots.docx',
    mimeType: DOCX_MIME,
    buffer
  });

  await expect(page.locator('#wordImageStatus')).toContainText('inventory ready');
  await expect(page.locator('#wordImageEmbeddedCount')).toHaveText('2');
  await expect(page.locator('#wordImageExternalCount')).toHaveText('1');
  await expect(page.locator('#wordImageDuplicateCount')).toHaveText('2');
  await expect(page.locator('#wordImageReviewSection')).toBeVisible();
  await expect(page.locator('[data-asset-id]')).toHaveCount(3);
  await expect(page.locator('.word-image-asset-card').filter({ hasText: 'first.png' })).toContainText('Screenshot alt text');
  await expect(page.locator('.word-image-asset-card').filter({ hasText: 'https://example.test/remote.png' })).toContainText('External / not embedded');

  await page.reload();
  await dropFile(page, '#wordImageDropZone', {
    name: 'Dropped.docx',
    mimeType: DOCX_MIME,
    buffer
  });
  await expect(page.locator('#wordImageStatus')).toContainText('inventory ready');
});

test('filters and selects assets, then downloads a ZIP with a manifest', async ({ page }) => {
  await page.goto('/#word-image-extractor');
  await page.setInputFiles('#wordImageFileInput', {
    name: 'Screenshots.docx',
    mimeType: DOCX_MIME,
    buffer: createWordImageDocx()
  });
  await expect(page.locator('#wordImageStatus')).toContainText('inventory ready');

  await page.locator('#wordImageFormat').selectOption('png');
  await page.getByRole('button', { name: 'Select filtered', exact: true }).click();
  await expect(page.locator('#wordImageSelectedCount')).toHaveText('2');
  await expect(page.locator('#wordImageExtractButton')).toBeEnabled();

  await page.locator('#wordImageIncludeManifest').check();
  await page.locator('#wordImageManifestFormat').selectOption('json');
  await page.getByRole('button', { name: 'Extract selected images', exact: true }).click();
  await expect(page.locator('#wordImageExtractionStatus')).toContainText('prepared with original bytes');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#wordImageZipDownload').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Screenshots-images.zip');
  await expect(page.locator('#wordImageZipDownload')).toBeVisible();
  await expect(page.locator('#wordImageManifestDownload')).toBeVisible();
});

test('reports folder capability and falls back to ZIP when directory access is unavailable', async ({ page }) => {
  await page.goto('/#word-image-extractor');
  await page.evaluate(() => {
    try {
      delete window.showDirectoryPicker;
    } catch {
      window.showDirectoryPicker = undefined;
    }
  });
  await page.setInputFiles('#wordImageFileInput', {
    name: 'Fallback.docx',
    mimeType: DOCX_MIME,
    buffer: createWordImageDocx()
  });
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.locator('#wordImageOutputMode').selectOption('directory');

  await expect(page.locator('#wordImageDirectoryCapability')).toHaveAttribute('data-supported', 'false');
  await expect(page.locator('#wordImageDirectoryCapability')).toContainText('fall back to a ZIP download');
  await page.getByRole('button', { name: 'Extract images as ZIP', exact: true }).click();
  await expect(page.locator('#wordImageExtractionStatus')).toContainText('ZIP download is ready');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#wordImageZipDownload').click();
  expect((await downloadPromise).suggestedFilename()).toBe('Fallback-images.zip');
});

test('uses a supported directory picker when the browser exposes one', async ({ page }) => {
  await page.goto('/#word-image-extractor');
  await page.evaluate(() => {
    window.__wordImageWrites = [];
    window.showDirectoryPicker = async () => ({
      entries: async function* () {},
      getFileHandle: async name => ({
        createWritable: async () => ({
          write: async bytes => window.__wordImageWrites.push({ name, size: bytes.byteLength }),
          close: async () => {}
        })
      })
    });
  });
  await page.setInputFiles('#wordImageFileInput', {
    name: 'Folder.docx',
    mimeType: DOCX_MIME,
    buffer: createWordImageDocx()
  });
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.locator('#wordImageOutputMode').selectOption('directory');
  await expect(page.locator('#wordImageDirectoryCapability')).toHaveAttribute('data-supported', 'true');
  await page.getByRole('button', { name: 'Choose folder & extract images', exact: true }).click();
  await expect(page.locator('#wordImageExtractionStatus')).toContainText('written to the selected folder');
  await expect.poll(() => page.evaluate(() => window.__wordImageWrites.map(item => item.name))).toEqual(['first.png', 'second.png']);
});

test('renames directory outputs around existing image and manifest collisions', async ({ page }) => {
  await page.goto('/#word-image-extractor');
  await page.evaluate(() => {
    window.__wordImageWrites = [];
    window.showDirectoryPicker = async () => ({
      entries: async function* () {
        yield ['first.png', {}];
        yield ['first (2).png', {}];
        yield ['manifest.json', {}];
        yield ['manifest (2).json', {}];
      },
      getFileHandle: async name => ({
        createWritable: async () => ({
          write: async bytes => window.__wordImageWrites.push({ name, size: bytes.byteLength }),
          close: async () => {}
        })
      })
    });
  });
  await page.setInputFiles('#wordImageFileInput', {
    name: 'Collisions.docx',
    mimeType: DOCX_MIME,
    buffer: createWordImageDocx()
  });
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.locator('#wordImageIncludeManifest').check();
  await page.locator('#wordImageOutputMode').selectOption('directory');
  await page.getByRole('button', { name: 'Choose folder & extract images', exact: true }).click();

  await expect(page.locator('#wordImageExtractionStatus')).toContainText('manifest (3).json');
  await expect.poll(() => page.evaluate(() => window.__wordImageWrites.map(item => item.name))).toEqual([
    'first (3).png',
    'second.png',
    'manifest (3).json'
  ]);
});

test('only exposes converter handovers for its supported formats while retaining OCR compatibility', async ({ page }) => {
  await page.goto('/#word-image-extractor');
  await page.setInputFiles('#wordImageFileInput', {
    name: 'Formats.docx',
    mimeType: DOCX_MIME,
    buffer: createWordImageFormatsDocx()
  });

  for (const name of ['image.png', 'image.jpg', 'image.webp', 'image.svg']) {
    const card = page.locator('.word-image-asset-card').filter({ hasText: name });
    await expect(card.getByRole('button', { name: 'Open in Image Converter & Optimiser', exact: true })).toHaveCount(1);
  }

  for (const name of ['image.emf', 'image.tiff']) {
    const card = page.locator('.word-image-asset-card').filter({ hasText: name });
    await expect(card.getByRole('button', { name: 'Open in Image Converter & Optimiser', exact: true })).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Open in Image OCR', exact: true })).toHaveCount(0);
  }

  for (const name of ['image.png', 'image.jpg', 'image.webp']) {
    const card = page.locator('.word-image-asset-card').filter({ hasText: name });
    await expect(card.getByRole('button', { name: 'Open in Image OCR', exact: true })).toHaveCount(1);
  }
  await expect(page.locator('.word-image-asset-card').filter({ hasText: 'image.svg' }).getByRole('button', { name: 'Open in Image OCR', exact: true })).toHaveCount(0);
});

test('rejects legacy .doc input with save-as guidance', async ({ page }) => {
  await page.goto('/#word-image-extractor');
  await page.setInputFiles('#wordImageFileInput', {
    name: 'Legacy.doc',
    mimeType: 'application/msword',
    buffer: Buffer.from([1, 2, 3])
  });

  await expect(page.locator('#wordImageValidation')).toBeVisible();
  await expect(page.locator('#wordImageValidation')).toContainText('Legacy .doc files are not supported');
  await expect(page.locator('#wordImageValidation')).toContainText('Save the document as .docx');
  await expect(page.locator('#wordImageReviewSection')).toBeHidden();
});

test('hands selected compatible image bytes to the existing converter and OCR tools', async ({ page }) => {
  await page.goto('/#word-image-extractor');
  await page.setInputFiles('#wordImageFileInput', {
    name: 'Handovers.docx',
    mimeType: DOCX_MIME,
    buffer: createWordImageDocx()
  });

  const firstCard = page.locator('.word-image-asset-card').filter({ hasText: 'first.png' });
  await firstCard.getByRole('button', { name: 'Open in Image Converter & Optimiser', exact: true }).click();
  await expect(page).toHaveURL(/#image-converter-optimiser$/);
  await expect(page.locator('#imageSelectedCount')).toHaveText('1');
  await expect(page.locator('#imageConversionResults')).toContainText('first.png');

  await page.goto('/#word-image-extractor');
  await page.setInputFiles('#wordImageFileInput', {
    name: 'Handovers.docx',
    mimeType: DOCX_MIME,
    buffer: createWordImageDocx()
  });
  await page.locator('.word-image-asset-card').filter({ hasText: 'first.png' }).getByRole('button', { name: 'Open in Image OCR', exact: true }).click();
  await expect(page).toHaveURL(/#image-ocr$/);
  await expect(page.locator('#imageOcrSelectedFile')).toHaveText('first.png');
});
