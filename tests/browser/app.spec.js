import { expect, test } from '@playwright/test';

test('searches the sidebar and switches between available tools', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Base64 to file' })).toBeVisible();
  await expect(page.locator('[data-tool-id="base64-to-file"]')).toHaveAttribute('aria-current', 'page');

  await page.getByLabel('Search tools').fill('jwt');
  await expect(page.locator('[data-tool-id="jwt-decoder"]')).toBeVisible();
  await expect(page.locator('[data-tool-id="jwt-decoder"]')).toBeDisabled();
  await expect(page.locator('[data-tool-id="jwt-decoder"] .tool-item-status')).toHaveText('Planned');

  await page.getByLabel('Search tools').fill('file');
  await page.locator('[data-tool-id="file-to-base64"]').click();

  await expect(page.getByRole('heading', { name: 'File to Base64' })).toBeVisible();
  await expect(page.locator('[data-tool-id="file-to-base64"]')).toHaveAttribute('aria-current', 'page');
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

  await page.locator('[data-tool-id="file-to-base64"]').click();
  await expect(page.getByRole('heading', { name: 'File to Base64' })).toBeVisible();
  await expect(page.locator('#toolSidebar')).not.toBeVisible();
});

test('creates a downloadable file from Base64 and reports validation errors', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Base64 content').fill('data:application/json;base64,eyJvayI6dHJ1ZX0=');
  await page.getByLabel('File name override').fill('sample');
  await page.getByRole('button', { name: 'Create file' }).click();

  await expect(page.getByRole('status')).toContainText('File created successfully as application/json.');
  await expect(page.locator('#recognisedType')).toHaveText('application/json');
  await expect(page.locator('#recognisedExtension')).toHaveText('.json');
  await expect(page.locator('#downloadButton')).toHaveAttribute('download', 'sample.json');

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

  await page.getByLabel('Output format').selectOption('dataUrl');
  await expect(page.locator('#base64Output')).toHaveValue('data:text/plain;base64,aGVsbG8=');
});
