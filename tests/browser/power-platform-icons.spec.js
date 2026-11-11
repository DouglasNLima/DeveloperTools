import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ICONS } from '../../src/tools/power-platform-icons.data.js';
import { readZipArchive } from '../../src/tools/power-platform-solution.js';
import { primeOfflineApp } from './support.js';

const route = '/#power-platform-icon-library';

async function downloadBytes(page, button) {
  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const download = await downloadPromise;
  return { filename: download.suggestedFilename(), bytes: await readFile(await download.path()) };
}

test('discovers the library in navigation and searches combined category and collection filters', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search tools').fill('icons');
  await page.locator('[data-tool-id="power-platform-icon-library"]').click();
  await expect(page).toHaveURL(/#power-platform-icon-library$/);
  await expect(page.locator('[data-tool-id="power-platform-icon-library"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Power Platform Icon Library', exact: true })).toBeVisible();
  await expect(page.locator('#ppIconResults')).toHaveText('301 of 301 icons');
  await expect(page.locator('#ppIconCategory option')).toHaveCount(27);
  await page.getByLabel('Collection', { exact: true }).selectOption('original');
  await expect(page.locator('#ppIconResults')).toHaveText('49 of 301 icons');
  await page.getByLabel('Collection', { exact: true }).selectOption('new');
  await expect(page.locator('#ppIconResults')).toHaveText('252 of 301 icons');
  await page.locator('#ppIconCategory').selectOption('Finance and billing');
  await page.getByLabel('Search icons').fill('ÍNVOICE');
  await expect(page.locator('[data-icon-id="invoice"]')).toBeVisible();
  await page.getByLabel('Search icons').fill('invoice no-such-term');
  await expect(page.locator('#ppIconEmpty')).toBeVisible();
  await expect(page.locator('[data-icon-id]:visible')).toHaveCount(0);
  await page.locator('#ppIconHex').fill('#abcdef');
  await page.locator('#ppIconEmpty').getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.locator('#ppIconResults')).toHaveText('301 of 301 icons');
  await expect(page.locator('#ppIconHex')).toHaveValue('#abcdef');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Power Platform Icon Library', exact: true })).toBeVisible();
});

test('shares customisation between the catalogue and inspector and downloads customised and original SVGs', async ({ page }) => {
  await page.goto(route);
  await page.locator('#ppIconHex').fill('#123456');
  await page.locator('#ppIconExportSize').selectOption('128');
  await page.locator('#ppIconStroke').fill('3.5');
  await page.locator('#ppIconOpacity').fill('65');
  await page.locator('#ppIconRotation').selectOption('270');
  await expect(page.locator('#ppIconColourMode')).toHaveValue('fixed');
  const preview = page.locator('[data-icon-id="workflow"] svg');
  await expect(preview).toHaveAttribute('stroke', '#123456');
  await expect(preview).toHaveAttribute('viewBox', '-0.75 -0.75 33.5 33.5');
  await expect(preview).toHaveCSS('width', '32px');
  await page.locator('#ppIconPreviewSize').selectOption('48');
  await expect(preview).toHaveCSS('width', '48px');
  await page.getByRole('button', { name: 'Dark canvas', exact: true }).click();
  await expect(page.locator('#ppIconCanvas')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-icon-id="workflow"]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Workflow', exact: true })).toBeVisible();
  await expect(page.locator('#ppIconSamples svg')).toHaveCount(8);
  await dialog.getByText('Adjust customisation', { exact: true }).click();
  await expect(page.locator('#ppIconDetailHex')).toHaveValue('#123456');
  await expect(page.locator('#ppIconDetailExportSize')).toHaveValue('128');
  await page.locator('#ppIconDetailExportSize').selectOption('64');
  await expect(page.locator('#ppIconExportSize')).toHaveValue('64');
  const custom = await downloadBytes(page, dialog.getByRole('button', { name: 'Download customised SVG', exact: true }));
  expect(custom.filename).toBe('workflow-custom.svg');
  const svg = custom.bytes.toString('utf8');
  expect(svg).toContain('width="64" height="64"');
  expect(svg).toContain('stroke="#123456"');
  expect(svg).toContain('stroke-width="3.5"');
  expect(svg).toContain('opacity="0.65"');
  expect(svg).toContain('rotate(270 16 16)');
  expect(svg).not.toContain('aria-hidden');
  const original = await downloadBytes(page, dialog.getByRole('button', { name: 'Download original', exact: true }));
  expect(original.filename).toBe('workflow.svg');
  expect(original.bytes.toString('utf8')).toBe(ICONS.find(icon => icon.id === 'workflow').svg);
  await dialog.getByRole('button', { name: 'Reset customisation', exact: true }).click();
  await expect(page.locator('#ppIconSettingsSummary')).toHaveText('Original style');
  await expect(page.locator('#ppIconSource')).toHaveValue(ICONS.find(icon => icon.id === 'workflow').svg);
  await expect(dialog.getByRole('button', { name: 'Download original', exact: true })).toBeHidden();
});

test('exports every customised icon in the ZIP even while filters hide the collection', async ({ page }) => {
  await page.goto(route);
  await page.locator('#ppIconColour').fill('#aabbcc');
  await page.locator('#ppIconExportSize').selectOption('48');
  await page.locator('#ppIconRotation').selectOption('90');
  await page.getByLabel('Search icons').fill('no-matching-icons');
  const result = await downloadBytes(page, page.locator('#ppIconDownloadAll'));
  expect(result.filename).toBe('consulting-icons-customised.zip');
  const archive = await readZipArchive(result.bytes);
  expect(archive.entries).toHaveLength(303);
  for (const icon of ICONS) {
    const svg = await archive.readText(`library/${icon.id}.svg`);
    expect(svg).toContain('width="48" height="48"');
    expect(svg).toContain('stroke="#aabbcc"');
    expect(svg).toContain('rotate(90 16 16)');
    expect(svg).not.toContain('currentColor');
  }
  const manifest = JSON.parse(await archive.readText('customisation.json'));
  expect(manifest.iconCount).toBe(301);
  expect(manifest.settings.colour).toBe('#aabbcc');
  expect(manifest.settings.exportSize).toBe(48);
  expect(manifest.scope).toContain('filters do not restrict');
  await expect(page.locator('#ppIconDownloadStatus')).toContainText('all 301 icons');
});

test('rejects invalid colours, blocks exports and keeps the last valid preview until corrected or reset', async ({ page }) => {
  await page.goto(route);
  await page.locator('#ppIconHex').fill('invalid');
  await expect(page.locator('#ppIconHex')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#ppIconValidation')).toContainText('hexadecimal colour');
  await expect(page.locator('#ppIconDownloadAll')).toBeDisabled();
  await page.locator('[data-icon-id="workflow"]').click();
  await expect(page.locator('#ppIconDetailValidation')).toContainText('hexadecimal colour');
  await expect(page.locator('#ppIconDownload')).toBeDisabled();
  await expect(page.locator('#ppIconCopySvg')).toBeDisabled();
  await expect(page.locator('#ppIconSource')).toHaveValue(ICONS.find(icon => icon.id === 'workflow').svg);
  await page.getByRole('dialog').getByText('Adjust customisation', { exact: true }).click();
  await page.locator('#ppIconDetailHex').fill('ABC');
  await expect(page.locator('#ppIconDownload')).toBeEnabled();
  await expect(page.locator('#ppIconHex')).toHaveValue('#aabbcc');
  await expect(page.locator('#ppIconDetailValidation')).toBeHidden();
  await page.locator('#ppIconDetailHex').fill('#12');
  await page.getByRole('dialog').getByRole('button', { name: 'Reset customisation', exact: true }).click();
  await expect(page.locator('#ppIconDownload')).toBeEnabled();
  await expect(page.locator('#ppIconDetailHex')).toHaveValue('#096d68');
});

test('copies the exported SVG and filename with visible success feedback', async ({ page }) => {
  await page.addInitScript(() => {
    window.iconCopies = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => window.iconCopies.push(value) } });
  });
  await page.goto(route);
  await page.locator('#ppIconHex').fill('#abcdef');
  await page.locator('[data-icon-id="workflow"]').click();
  await page.locator('#ppIconCopySvg').click();
  await expect(page.locator('#ppIconCopySvg')).toHaveText('Copied');
  await expect(page.locator('#ppIconDetailStatus')).toHaveText('SVG copied.');
  await page.locator('#ppIconCopyName').click();
  const copies = await page.evaluate(() => window.iconCopies);
  expect(copies[0]).toContain('stroke="#abcdef"');
  expect(copies[0]).not.toContain('aria-hidden');
  expect(copies[1]).toBe('workflow-custom.svg');
});

test('offers manual SVG copying when both clipboard methods fail', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied'); } } });
    document.execCommand = () => false;
  });
  await page.goto(route);
  await page.locator('[data-icon-id="workflow"]').click();
  await page.locator('#ppIconCopySvg').click();
  await expect(page.locator('#ppIconDetailStatus')).toHaveText('Select and copy the SVG source below.');
  await expect(page.getByLabel('SVG source', { exact: true })).toBeVisible();
  await expect(page.getByLabel('SVG source', { exact: true })).toBeFocused();
});

test('supports keyboard inspection, returns focus and cleans up when navigating away', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(route);
  await page.locator('#ppIconCanvas').focus();
  await page.keyboard.press('/');
  await expect(page.getByLabel('Search icons')).toBeFocused();
  const card = page.locator('[data-icon-id="workflow"]');
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(card).toBeFocused();
  await card.click();
  await page.evaluate(() => { location.hash = '#base64-file-converter'; });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Base64 & File Converter', exact: true })).toBeVisible();
  await page.keyboard.press('/');
  await page.goBack();
  await expect(page.locator('#ppIconResults')).toHaveText('301 of 301 icons');
  expect(errors).toEqual([]);
});

test('keeps the library and inspector usable on a narrow mobile viewport in both app themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#themeToggle').click();
  await page.locator('[data-icon-id="workflow"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole('dialog').getByText('Adjust customisation', { exact: true }).click();
  await page.locator('#ppIconDetailExportSize').selectOption('16');
  const result = await downloadBytes(page, page.locator('#ppIconDownload'));
  expect(result.bytes.toString('utf8')).toContain('width="16" height="16"');
  await page.getByRole('button', { name: 'Close icon details' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('opens for the first time offline and exports all original bytes without external requests', async ({ page, context }) => {
  const externalRequests = [];
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') externalRequests.push(request.url());
  });
  await primeOfflineApp(page);
  await context.setOffline(true);
  try {
    await page.goto(route);
    await expect(page.locator('#ppIconResults')).toHaveText('301 of 301 icons');
    const result = await downloadBytes(page, page.locator('#ppIconDownloadAll'));
    expect(result.filename).toBe('consulting-icons-original.zip');
    const archive = await readZipArchive(result.bytes);
    expect(archive.entries).toHaveLength(303);
    for (const icon of ICONS) {
      expect(createHash('sha256').update(await archive.readBytes(`library/${icon.id}.svg`)).digest('hex')).toBe(icon.sha256);
    }
    expect(externalRequests).toEqual([]);
  } finally {
    await context.setOffline(false);
  }
});
