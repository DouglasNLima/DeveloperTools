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
test('renders the home overview and opens tools from catalogue cards', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(APP_TITLE);
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('.statusbar')).toContainText('Static local workspace');
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('#activeToolTitle')).toHaveText('Developer Tools');
  await expect(page.locator('#activeToolStatus')).toHaveText('23 tools');
  await expect(page.locator('[data-view-id="home"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-home-tool-id]')).toHaveCount(23);
  await expect(page.locator('[data-home-tool-id="json-data-workbench"]')).toBeVisible();
  await expect(page.locator('[data-home-tool-id="json-formatter"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="web-api-workbench"]')).toBeVisible();
  await expect(page.locator('[data-home-tool-id="jwt-decoder"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="cron-rrule-builder"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="curl-fetch-converter"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="text-utilities-workbench"]')).toBeVisible();
  await expect(page.locator('[data-home-tool-id="regex-tester"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="sql-query-formatter"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="support-pack-sanitiser"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="text-diff"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="case-converter"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="uuid-generator"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="base64-file-converter"]')).toBeVisible();
  await expect(page.locator('[data-home-tool-id="file-to-base64"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="mermaid-studio"]')).toBeVisible();
  await expect(page.locator('[data-home-tool-id="mermaid-editor"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="power-platform-script-hub"]')).toBeVisible();
  await expect(page.locator('[data-home-tool-id="power-pages-workbench"]')).toBeVisible();
  await expect(page.locator('[data-home-tool-id="fetchxml-liquid-builder"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="power-pages-web-api-snippets"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="solution-package-inspector"]')).toBeVisible();
  await expect(page.locator('[data-home-tool-id="power-platform-solution-mermaid"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="power-automate-email-template-builder"]')).toBeVisible();
  await expect(page.locator('[data-home-tool-id="model-driven-javascript-workbench"]')).toBeVisible();
  await expect(page.locator('[data-home-tool-id="model-driven-javascript-reviewer"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="client-api-migration-helper"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="form-event-handler-builder"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="xrm-webapi-snippet-builder"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="form-notification-validation-builder"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="command-bar-javascript-builder"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="model-driven-solution-inspector"]')).toBeVisible();
  await expect(page.locator('[data-home-tool-id="solution-javascript-event-inspector"]')).toHaveCount(0);
  await expect(page.locator('[data-home-tool-id="web-resource-dependency-mapper"]')).toHaveCount(0);
  const transparency = page.locator('.home-transparency');
  await expect(transparency.getByRole('heading', { name: 'Local-first by design' })).toBeVisible();
  await expect(transparency).toContainText('The published app is plain HTML, CSS and JavaScript');
  await expect(transparency).toContainText('All other tools use first-party code and built-in browser APIs.');
  const pdfJsLink = transparency.getByRole('link', { name: 'PDF.js' });
  await expect(pdfJsLink).toHaveAttribute('href', 'https://mozilla.github.io/pdf.js/');
  await expect(pdfJsLink).toHaveAttribute('target', '_blank');
  await expect(pdfJsLink).toHaveAttribute('rel', /noopener noreferrer/);
  await expect(transparency.locator('[data-library-name="PDF.js"]')).toContainText('PDF Template Field Explorer');
  await expect(transparency.locator('[data-library-name="Tesseract.js"]')).toContainText('Image OCR');
  await expect(transparency.locator('.home-library-card').filter({ hasText: 'Not loaded by published app' })).toHaveCount(3);
  expect(await page.locator('#activeToolStatus').evaluate(element => getComputedStyle(element).color))
    .toMatch(/rgb\((2, 122, 72|101, 217, 159)\)/);
  expect(await page.locator('[data-home-tool-id="json-data-workbench"] .home-tool-status').evaluate(element => getComputedStyle(element).color))
    .toMatch(/rgb\((2, 122, 72|101, 217, 159)\)/);

  await page.locator('[data-home-tool-id="json-data-workbench"]').click();

  await expect(page).toHaveURL(/#json-data-workbench$/);
  await expect(page.getByRole('heading', { name: 'JSON & Data Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Format');
  await expect(page.locator('[data-tool-id="json-data-workbench"]')).toHaveAttribute('aria-current', 'page');
});

test('preserves direct tool links and falls back to home for unknown hashes', async ({ page }) => {
  await page.goto('/#url-codec');

  await expect(page.getByRole('heading', { name: 'URL & query string helper' })).toBeVisible();
  await expect(page.locator('[data-tool-id="url-codec"]')).toHaveAttribute('aria-current', 'page');

  await page.goto('/#missing-tool');

  await expect(page.locator('#activeToolTitle')).toHaveText('Developer Tools');
  await expect(page.locator('[data-view-id="home"]')).toHaveAttribute('aria-current', 'page');
});

test('searches the sidebar and switches between available tools', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#activeToolTitle')).toHaveText('Developer Tools');
  await expect(page.locator('#toolNav').getByRole('heading', { name: 'Power Platform' })).toBeVisible();

  await page.getByLabel('Search tools').fill('jwt');
  await expect(page.locator('[data-tool-id="web-api-workbench"]')).toBeVisible();
  await expect(page.locator('[data-tool-id="web-api-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="web-api-workbench"] .tool-item-status')).toHaveText('Available');
  await expect(page.locator('[data-tool-id="jwt-decoder"]')).toHaveCount(0);
  await page.locator('[data-tool-id="web-api-workbench"]').click();
  await expect(page).toHaveURL(/#web-api-workbench$/);
  await expect(page.getByRole('heading', { name: 'Web/API Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('JWT');

  await page.getByLabel('Search tools').fill('file');
  await page.locator('[data-tool-id="base64-file-converter"]').click();

  await expect(page.getByRole('heading', { name: 'Base64 & File Converter' })).toBeVisible();
  await expect(page.locator('[data-tool-id="base64-file-converter"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Base64 to file');
});

test('finds the support sanitiser and schedule builder from search', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('support');
  await expect(page.locator('[data-tool-id="text-utilities-workbench"]')).toBeVisible();
  await expect(page.locator('[data-tool-id="text-utilities-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="support-pack-sanitiser"]')).toHaveCount(0);

  await page.getByLabel('Search tools').fill('rrule');
  await expect(page.locator('[data-tool-id="web-api-workbench"]')).toBeVisible();
  await expect(page.locator('[data-tool-id="web-api-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="cron-rrule-builder"]')).toHaveCount(0);
});

test('returns to home from the menu and keeps search available', async ({ page }) => {
  await page.goto('/#jwt-decoder');

  await page.locator('[data-view-id="home"]').click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#activeToolTitle')).toHaveText('Developer Tools');
  await expect(page.locator('[data-view-id="home"]')).toHaveAttribute('aria-current', 'page');

  await page.getByLabel('Search tools').fill('Power Platform');

  await expect(page.locator('[data-tool-id="power-pages-workbench"]')).toBeVisible();
  await expect(page.locator('[data-tool-id="power-pages-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="fetchxml-liquid-builder"]')).toHaveCount(0);
});

test('returns to home from the Developer Tools title link', async ({ page }) => {
  await page.goto('/#json-formatter');

  await expect(page).toHaveURL(/#json-data-workbench$/);
  await expect(page.getByRole('heading', { name: 'JSON & Data Workbench' })).toBeVisible();
  await page.locator('.sidebar .brand-home-link').click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#activeToolTitle')).toHaveText('Developer Tools');
  await expect(page.locator('[data-view-id="home"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.home-transparency')).toContainText('Library transparency');
});

test('collapses the desktop tool menu and persists compact navigation', async ({ page }) => {
  await page.goto('/#json-formatter');

  const sidebar = page.locator('#toolSidebar');
  const collapseButton = sidebar.getByRole('button', { name: 'Collapse tool menu' });

  await expect(page.locator('html')).not.toHaveClass(/nav-collapsed/);
  await expect(collapseButton).toBeVisible();
  await expect(collapseButton).toHaveAttribute('title', 'Collapse tool menu');
  await expect(page.locator('.topbar-actions').getByRole('button', { name: /tool menu/i })).toHaveCount(0);
  await collapseButton.click();

  await expect(page.locator('html')).toHaveClass(/nav-collapsed/);
  await expect(sidebar.getByRole('button', { name: 'Expand tool menu' })).toHaveAttribute('aria-pressed', 'true');
  await expect(sidebar.getByRole('button', { name: 'Expand tool menu' })).toHaveAttribute('title', 'Expand tool menu');
  await expect(page.locator('#toolSidebar .search-field')).toBeHidden();
  await expect(page.locator('[data-tool-id="json-data-workbench"] .tool-item-title')).toBeHidden();
  await expect(page.locator('[data-tool-id="json-data-workbench"] .tool-item-summary')).toBeHidden();
  await expect(page.locator('[data-tool-id="json-data-workbench"] .tool-item-status')).toBeHidden();

  const compactItemBox = await page.locator('[data-tool-id="json-data-workbench"]').boundingBox();
  expect(compactItemBox).not.toBeNull();
  expect(Math.abs(compactItemBox.width - compactItemBox.height)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => window.localStorage.getItem('developer-tools-sidebar-collapsed'))).toBe('true');

  await page.reload();

  await expect(page.locator('html')).toHaveClass(/nav-collapsed/);
  await page.locator('[data-tool-id="url-codec"]').click();

  await expect(page.getByRole('heading', { name: 'URL & query string helper' })).toBeVisible();
  await expect(page.locator('[data-tool-id="url-codec"]')).toHaveAttribute('aria-current', 'page');
});

test('uses the system theme until the theme toggle stores a manual choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'system');

  const themeButton = page.locator('#themeToggle');
  await expect(themeButton).toHaveAttribute('aria-label', 'Use light theme');
  await expect(themeButton).toHaveAttribute('title', 'Use light theme');
  await expect(themeButton).toHaveAttribute('data-next-theme', 'light');
  await expect(themeButton).toHaveClass(/theme-toggle-button/);
  await expect(themeButton.locator('.theme-toggle-icon')).toBeVisible();
  await expect(themeButton.locator('.theme-toggle-icon')).not.toHaveText('Aa');
  await expect(themeButton.locator('.theme-icon-sun')).toBeVisible();
  await expect(themeButton.locator('.theme-icon-moon')).toBeHidden();
  await expect(themeButton.locator('.sidebar-action-text')).toHaveClass(/visually-hidden/);

  const themeButtonBox = await themeButton.boundingBox();
  expect(themeButtonBox).not.toBeNull();
  expect(themeButtonBox.width).toBeLessThanOrEqual(48);
  expect(themeButtonBox.height).toBeLessThanOrEqual(48);

  await page.getByRole('button', { name: 'Use light theme' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'manual');
  await expect(themeButton).toHaveAttribute('data-next-theme', 'dark');
  await expect(themeButton.locator('.theme-icon-moon')).toBeVisible();
  await expect(themeButton.locator('.theme-icon-sun')).toBeHidden();
  expect(await page.evaluate(() => window.localStorage.getItem('developer-tools-theme'))).toBe('light');

  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Use dark theme' })).toBeVisible();
  await expect(page.locator('#themeToggle')).toHaveAttribute('title', 'Use dark theme');
});

test('exposes the app version and build in static document titles', async ({ page, request }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(APP_TITLE);

  const legacyRedirectResponse = await request.get('/devtools.html');
  expect(legacyRedirectResponse.ok()).toBe(true);
  expect(await legacyRedirectResponse.text()).toContain(`<title>${APP_TITLE}</title>`);
});

test('exposes installable web app manifest metadata and local icons', async ({ page, request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');

  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('Developer Tools');
  expect(manifest.short_name).toBe('Dev Tools');
  expect(manifest.lang).toBe('en-GB');
  expect(manifest.id).toBe('./');
  expect(manifest.start_url).toBe('./');
  expect(manifest.scope).toBe('./');
  expect(manifest.display).toBe('standalone');
  expect(manifest.background_color).toBe('#111318');
  expect(manifest.theme_color).toBe('#111318');
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({
      src: './assets/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png'
    }),
    expect.objectContaining({
      src: './assets/icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png'
    })
  ]));

  for (const icon of manifest.icons) {
    const iconResponse = await request.get(icon.src.replace('./', '/'));
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
  }

  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest.webmanifest');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111318');
});

test('serves the app shell and hash routes offline after service worker installation', async ({ page }) => {
  await primeOfflineApp(page);
  await page.context().setOffline(true);

  try {
    await page.goto('/');

    await expect(page.locator('#activeToolTitle')).toHaveText('Developer Tools');
    await expect(page.locator('[data-home-tool-id="json-data-workbench"]')).toBeVisible();

    await page.goto('/#url-codec');

    await expect(page.getByRole('heading', { name: 'URL & query string helper' })).toBeVisible();
    await expect(page.locator('[data-tool-id="url-codec"]')).toHaveAttribute('aria-current', 'page');
  } finally {
    await page.context().setOffline(false);
  }
});

test('loads the deferred PDF tool and vendored PDF.js assets offline', async ({ page }) => {
  await primeOfflineApp(page);
  await page.context().setOffline(true);

  try {
    await page.goto('/#pdf-template-field-explorer');

    await expect(page.getByRole('heading', { name: 'PDF Template Field Explorer' })).toBeVisible();
    await page.setInputFiles('#pdfTemplateFileInput', {
      name: 'offline-form.pdf',
      mimeType: 'application/pdf',
      buffer: await createFillablePdf()
    });

    await expect(page.locator('#pdfTemplateStatus')).toContainText('PDF loaded successfully.');
    await expect(page.locator('#pdfFieldCount')).toHaveText('2');
  } finally {
    await page.context().setOffline(false);
  }
});

test('finds Power Platform tools in the sidebar', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('Power Platform');

  await expect(page.locator('[data-tool-id="power-pages-workbench"]')).toBeVisible();
  await expect(page.locator('[data-tool-id="power-pages-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="fetchxml-liquid-builder"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="power-pages-web-api-snippets"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="power-pages-site-settings"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="power-pages-table-permissions"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="dataverse-odata-query-builder"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="power-platform-cli-command-builder"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="solution-package-inspector"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="power-platform-solution-import-preflight"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="power-platform-solution-mermaid"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="power-platform-solution-docs"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="power-automate-expression-formatter"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="power-automate-email-template-builder"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="power-fx-snippet-formatter"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="model-driven-javascript-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="model-driven-solution-inspector"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="solution-javascript-event-inspector"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="web-resource-dependency-mapper"]')).toHaveCount(0);
});
