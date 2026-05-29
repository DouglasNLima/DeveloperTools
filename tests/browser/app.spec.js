import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

async function primeOfflineApp(page) {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

test('renders the home overview and opens tools from catalogue cards', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('.statusbar')).toContainText('Static local workspace');
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('#activeToolTitle')).toHaveText('Developer Tools');
  await expect(page.locator('[data-view-id="home"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-home-tool-id="json-formatter"]')).toBeVisible();
  expect(await page.locator('#activeToolStatus').evaluate(element => getComputedStyle(element).color))
    .toMatch(/rgb\((2, 122, 72|101, 217, 159)\)/);
  expect(await page.locator('[data-home-tool-id="json-formatter"] .home-tool-status').evaluate(element => getComputedStyle(element).color))
    .toMatch(/rgb\((2, 122, 72|101, 217, 159)\)/);

  await page.locator('[data-home-tool-id="json-formatter"]').click();

  await expect(page).toHaveURL(/#json-formatter$/);
  await expect(page.getByRole('heading', { name: 'JSON formatter/validator' })).toBeVisible();
  await expect(page.locator('[data-tool-id="json-formatter"]')).toHaveAttribute('aria-current', 'page');
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
  await expect(page.locator('[data-tool-id="jwt-decoder"]')).toBeVisible();
  await expect(page.locator('[data-tool-id="jwt-decoder"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="jwt-decoder"] .tool-item-status')).toHaveText('Available');
  await page.locator('[data-tool-id="jwt-decoder"]').click();
  await expect(page.getByRole('heading', { name: 'JWT Decoder & Claims Inspector' })).toBeVisible();

  await page.getByLabel('Search tools').fill('file');
  await page.locator('[data-tool-id="file-to-base64"]').click();

  await expect(page.getByRole('heading', { name: 'File to Base64' })).toBeVisible();
  await expect(page.locator('[data-tool-id="file-to-base64"]')).toHaveAttribute('aria-current', 'page');
});

test('returns to home from the menu and keeps search available', async ({ page }) => {
  await page.goto('/#jwt-decoder');

  await page.locator('[data-view-id="home"]').click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#activeToolTitle')).toHaveText('Developer Tools');
  await expect(page.locator('[data-view-id="home"]')).toHaveAttribute('aria-current', 'page');

  await page.getByLabel('Search tools').fill('Power Platform');

  await expect(page.locator('[data-tool-id="fetchxml-liquid-builder"]')).toBeVisible();
  await expect(page.locator('[data-tool-id="power-pages-web-api-snippets"]')).toBeEnabled();
});

test('returns to home from the Developer Tools title link', async ({ page }) => {
  await page.goto('/#json-formatter');

  await expect(page.getByRole('heading', { name: 'JSON formatter/validator' })).toBeVisible();
  await page.locator('.sidebar .brand-home-link').click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#activeToolTitle')).toHaveText('Developer Tools');
  await expect(page.locator('[data-view-id="home"]')).toHaveAttribute('aria-current', 'page');
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
  await expect(page.locator('[data-tool-id="json-formatter"] .tool-item-title')).toBeHidden();
  await expect(page.locator('[data-tool-id="json-formatter"] .tool-item-summary')).toBeHidden();
  await expect(page.locator('[data-tool-id="json-formatter"] .tool-item-status')).toBeHidden();

  const compactItemBox = await page.locator('[data-tool-id="json-formatter"]').boundingBox();
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
  await expect(themeButton).toHaveClass(/theme-toggle-button/);
  await expect(themeButton.locator('.theme-toggle-icon')).toBeVisible();
  await expect(themeButton.locator('.sidebar-action-text')).toHaveClass(/visually-hidden/);

  const themeButtonBox = await themeButton.boundingBox();
  expect(themeButtonBox).not.toBeNull();
  expect(themeButtonBox.width).toBeLessThanOrEqual(48);
  expect(themeButtonBox.height).toBeLessThanOrEqual(48);

  await page.getByRole('button', { name: 'Use light theme' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'manual');
  expect(await page.evaluate(() => window.localStorage.getItem('developer-tools-theme'))).toBe('light');

  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Use dark theme' })).toBeVisible();
  await expect(page.locator('#themeToggle')).toHaveAttribute('title', 'Use dark theme');
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
    await expect(page.locator('[data-home-tool-id="json-formatter"]')).toBeVisible();

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

  await expect(page.locator('[data-tool-id="fetchxml-liquid-builder"]')).toBeVisible();
  await expect(page.locator('[data-tool-id="power-pages-web-api-snippets"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="power-pages-site-settings"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="power-pages-table-permissions"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="dataverse-odata-query-builder"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="power-platform-cli-command-builder"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="power-automate-expression-formatter"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="power-fx-snippet-formatter"]')).toBeEnabled();
});

test('encodes and decodes URL components', async ({ page }) => {
  await page.goto('/#url-codec');

  await expect(page.getByRole('heading', { name: 'URL & query string helper' })).toBeVisible();
  await page.getByLabel('Input').fill('hello world&x=1');
  await page.getByRole('button', { name: 'Process', exact: true }).click();

  await expect(page.locator('#urlOutput')).toHaveValue('hello%20world%26x%3D1');
  await expect(page.locator('#urlModeDetail')).toHaveText('Encode component');
  await expect(page.locator('#urlWarnings')).toHaveText('None');
  await expect(page.getByRole('status')).toContainText('Encoded component created successfully.');

  await page.getByLabel('Mode').selectOption('decode-component');
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

test('parses and builds query strings', async ({ page }) => {
  await page.goto('/#url-codec');

  await page.getByLabel('Mode').selectOption('parse-query');
  await page.getByLabel('Input').fill('https://example.test/search?q=hello+world&tag=alpha&tag=beta&empty=');
  await page.getByRole('button', { name: 'Process', exact: true }).click();

  await expect(page.locator('#urlItemCount')).toHaveText('4');
  await expect(page.locator('#urlWarnings')).toHaveText('2 warnings');
  await expect(page.locator('#urlOutput')).toHaveValue(/"hello world"/);
  await expect(page.locator('#urlOutput')).toHaveValue(/"empty"/);

  await page.getByLabel('Mode').selectOption('build-query');
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

  await page.getByLabel('Mode').selectOption('decode-component');
  await page.getByLabel('Input').fill('hello%ZZ');
  await page.getByRole('button', { name: 'Process', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Invalid percent-encoding');

  await page.getByLabel('Mode').selectOption('build-query');
  await page.getByLabel('Input').fill('not a row');
  await page.getByRole('button', { name: 'Process', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('must use key=value format');
});

test('finds the JSON formatter and processes formatted and minified output', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('JSON');
  await expect(page.locator('[data-tool-id="json-formatter"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="json-diff"]')).toBeEnabled();
  await page.locator('[data-tool-id="json-formatter"]').click();

  await expect(page.getByRole('heading', { name: 'JSON formatter/validator' })).toBeVisible();
  await page.getByLabel('JSON input').fill('{"b":2,"a":{"d":4,"c":[1,true,null]}}');
  await page.getByLabel('Sort object keys').check();
  await page.getByRole('button', { name: 'Format JSON', exact: true }).click();

  await expect(page.locator('#jsonOutput')).toHaveValue([
    '{',
    '  "a": {',
    '    "c": [',
    '      1,',
    '      true,',
    '      null',
    '    ],',
    '    "d": 4',
    '  },',
    '  "b": 2',
    '}'
  ].join('\n'));
  await expect(page.locator('#jsonStatusDetail')).toHaveText('Valid');
  await expect(page.locator('#jsonDepthDetail')).toHaveText('4');
  await expect(page.locator('#jsonStructureDetail')).toHaveText('2 / 1');
  await expect(page.locator('#downloadJsonButton')).toHaveAttribute('download', 'formatted-json.json');
  await expect(page.getByRole('status')).toContainText('Formatted JSON created successfully.');

  await page.getByRole('button', { name: 'Minify JSON', exact: true }).click();

  await expect(page.locator('#jsonOutput')).toHaveValue('{"a":{"c":[1,true,null],"d":4},"b":2}');
  await expect(page.locator('#downloadJsonButton')).toHaveAttribute('download', 'minified-json.json');
  await expect(page.getByRole('status')).toContainText('Minified JSON created successfully.');
});

test('reports JSON formatter validation errors with context', async ({ page }) => {
  await page.goto('/#json-formatter');

  await page.getByRole('button', { name: 'Format JSON', exact: true }).click();

  await expect(page.locator('#jsonStatusDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Enter JSON input.');

  await page.getByLabel('JSON input').fill('{"ok": true,}');
  await page.getByRole('button', { name: 'Format JSON', exact: true }).click();

  await expect(page.locator('#jsonStatusDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('JSON parse error at line');
  await expect(page.locator('#jsonOutput')).toHaveValue(/\^/);
});

test('generates JSON structural diff reports', async ({ page }) => {
  await page.goto('/#json-diff');

  await expect(page.getByRole('heading', { name: 'JSON diff' })).toBeVisible();
  await page.getByLabel('Left JSON').fill('{"name":"Contoso","tags":["a"],"legacy":1}');
  await page.getByLabel('Right JSON').fill('{"name":"Fabrikam","tags":["a","b"],"rating":5}');
  await page.getByRole('button', { name: 'Compare JSON', exact: true }).click();

  await expect(page.locator('#jsonDiffStatusDetail')).toHaveText('Different');
  await expect(page.locator('#jsonDiffChangesDetail')).toHaveText('4');
  await expect(page.locator('#jsonDiffAddedRemovedDetail')).toHaveText('2 / 1');
  await expect(page.locator('#jsonDiffChangedUnchangedDetail')).toHaveText('1 / 1');
  await expect(page.locator('#jsonDiffOutput')).toHaveValue(/### Changed \$\.name/);
  await expect(page.locator('#jsonDiffOutput')).toHaveValue(/### Added \$\.rating/);
  await expect(page.locator('#downloadJsonDiffButton')).toHaveAttribute('download', 'json-diff.md');
  await expect(page.getByRole('status')).toContainText('JSON diff report created successfully.');

  await page.getByLabel('Output format').selectOption('json');
  await page.getByRole('button', { name: 'Compare JSON', exact: true }).click();

  await expect(page.locator('#jsonDiffOutput')).toHaveValue(/"totalChanges": 4/);
  await expect(page.locator('#downloadJsonDiffButton')).toHaveAttribute('download', 'json-diff.json');
});

test('reports JSON diff validation errors by side', async ({ page }) => {
  await page.goto('/#json-diff');

  await page.getByRole('button', { name: 'Compare JSON', exact: true }).click();

  await expect(page.locator('#jsonDiffStatusDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Left JSON: Enter JSON input.');

  await page.getByLabel('Left JSON').fill('{"ok":true}');
  await page.getByLabel('Right JSON').fill('{"ok":true,}');
  await page.getByRole('button', { name: 'Compare JSON', exact: true }).click();

  await expect(page.locator('#jsonDiffStatusDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Right JSON: JSON parse error');
  await expect(page.locator('#jsonDiffOutput')).toHaveValue(/\^/);
});

test('finds the data explorer and queries JSON records', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('data explorer');
  await expect(page.locator('[data-tool-id="data-explorer"]')).toBeEnabled();
  await page.locator('[data-tool-id="data-explorer"]').click();

  await expect(page.getByRole('heading', { name: 'JSON/XML data explorer' })).toBeVisible();
  await page.getByLabel('JSON or XML input').fill(JSON.stringify({
    data: {
      records: [
        {
          name: 'Ada Lovelace',
          status: 'active',
          age: 36,
          address: { city: 'London' },
          hidden: 'kept'
        },
        {
          name: 'Grace Hopper',
          status: 'active',
          age: 85,
          address: { city: 'Arlington' }
        },
        {
          name: 'Katherine Johnson',
          status: 'retired',
          age: 101,
          address: { city: 'Hampton' }
        }
      ]
    }
  }));
  await page.getByLabel('Filter field').fill('status');
  await page.getByLabel('Filter operator').selectOption('equals');
  await page.getByLabel('Filter value').fill('active');
  await page.getByLabel('Sort field').fill('age');
  await page.getByLabel('Sort direction').selectOption('desc');
  await page.getByLabel('Grid columns').fill('name, address.city');
  await page.getByRole('button', { name: 'Explore data', exact: true }).click();

  await expect(page.locator('#dataExplorerFormatDetail')).toHaveText('JSON');
  await expect(page.locator('#dataExplorerPathDetail')).toHaveText('$.data.records');
  await expect(page.locator('#dataExplorerSourceDetail')).toHaveText('3');
  await expect(page.locator('#dataExplorerResultsDetail')).toHaveText('2');
  await expect(page.locator('#dataExplorerColumnsDetail')).toHaveText('2');
  await expect(page.locator('#dataExplorerWarningsDetail')).toHaveText('1 warning');
  await expect(page.locator('.data-grid-table tbody tr').first()).toContainText('Grace Hopper');
  await expect(page.locator('.data-grid-table tbody tr').first()).toContainText('Arlington');
  await expect(page.locator('#dataExplorerOutput')).toHaveValue(/"hidden": "kept"/);
  await expect(page.locator('#dataExplorerOutput')).not.toHaveValue(/Katherine Johnson/);
  await expect(page.locator('#downloadDataExplorerButton')).toHaveAttribute('download', 'data-explorer-output.json');
  await expect(page.getByRole('status')).toContainText('JSON data explored successfully.');
});

test('reports data explorer validation errors', async ({ page }) => {
  await page.goto('/#data-explorer');

  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Enter JSON or XML input before exploring data.');

  await page.getByLabel('Input format').selectOption('json');
  await page.getByLabel('JSON or XML input').fill('{bad json}');
  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('JSON parse error');

  await page.getByLabel('JSON or XML input').fill('{"name":"Ada"}');
  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No JSON record array was found automatically');
});

test('flattens XML data into a grid and JSON export', async ({ page }) => {
  await page.goto('/#data-explorer');

  await page.getByLabel('Input format').selectOption('xml');
  await page.getByLabel('JSON or XML input').fill([
    '<contacts>',
    '  <contact id="1"><name>Ada Lovelace</name><address><city>London</city></address></contact>',
    '  <contact id="2"><name>Grace Hopper</name><address><city>Arlington</city></address></contact>',
    '</contacts>'
  ].join('\n'));
  await page.getByRole('button', { name: 'Explore data', exact: true }).click();

  await expect(page.locator('#dataExplorerFormatDetail')).toHaveText('XML');
  await expect(page.locator('#dataExplorerPathDetail')).toHaveText('/contacts/contact');
  await expect(page.locator('#dataExplorerSourceDetail')).toHaveText('2');
  await expect(page.locator('#dataExplorerResultsDetail')).toHaveText('2');
  await expect(page.locator('#dataExplorerQueryModeDetail')).toHaveText('XML grid');
  await expect(page.locator('.data-grid-table thead')).toContainText('@id');
  await expect(page.locator('.data-grid-table thead')).toContainText('address.city');
  await expect(page.locator('.data-grid-table tbody')).toContainText('Grace Hopper');
  await expect(page.locator('#dataExplorerOutput')).toHaveValue(/"@id": "2"/);
  await expect(page.locator('#dataExplorerOutput')).toHaveValue(/"address.city": "Arlington"/);
  await expect(page.locator('#downloadDataExplorerButton')).toHaveAttribute('download', 'data-explorer-output.json');
  await expect(page.getByRole('status')).toContainText('XML data explored successfully.');
});

test('converts CSV input to JSON array output', async ({ page }) => {
  await page.goto('/#csv-tsv-helper');

  await expect(page.getByRole('heading', { name: 'CSV/TSV helper' })).toBeVisible();
  await page.getByLabel('CSV/TSV input').fill('name,email\nAda Lovelace,ada@example.test\nGrace Hopper,grace@example.test');
  await page.getByRole('button', { name: 'Process data', exact: true }).click();

  await expect(page.locator('#csvDelimiterDetail')).toHaveText('Comma (,) detected');
  await expect(page.locator('#csvRowsDetail')).toHaveText('3 total / 2 data');
  await expect(page.locator('#csvColumnsDetail')).toHaveText('2');
  await expect(page.locator('#csvWarningsDetail')).toHaveText('None');
  await expect(page.locator('#csvOutputTypeDetail')).toHaveText('JSON array');
  await expect(page.locator('#csvOutput')).toHaveValue(/"name": "Ada Lovelace"/);
  await expect(page.locator('#csvOutput')).toHaveValue(/"email": "grace@example.test"/);
  await expect(page.locator('#downloadCsvButton')).toHaveAttribute('download', 'delimited-output.json');
  await expect(page.getByRole('status')).toContainText('Delimited data processed successfully.');
});

test('loads a delimited file and reports header and row issues', async ({ page }) => {
  await page.goto('/#csv-tsv-helper');

  await page.setInputFiles('#csvFileInput', {
    name: 'contacts.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,name,\nAda,,extra\nGrace')
  });
  await expect(page.getByRole('status')).toContainText('Loaded contacts.csv.');

  await page.getByLabel('Output format').selectOption('tsv');
  await page.getByRole('button', { name: 'Process data', exact: true }).click();

  await expect(page.locator('#csvDelimiterDetail')).toHaveText('Comma (,) detected');
  await expect(page.locator('#csvEmptyCellsDetail')).toHaveText('2');
  await expect(page.locator('#csvInconsistentRowsDetail')).toHaveText('1');
  await expect(page.locator('#csvWarningsDetail')).toHaveText('3 warnings');
  await expect(page.locator('#csvIssueList')).toContainText('unexpected column count');
  await expect(page.locator('#csvIssueList')).toContainText('Duplicate headers found: name.');
  await expect(page.locator('#csvOutputTypeDetail')).toHaveText('TSV');
  await expect(page.locator('#csvOutput')).toHaveValue(/name\tname\t/);
  await expect(page.locator('#downloadCsvButton')).toHaveAttribute('download', 'contacts.tsv');
});

test('runs regex matches with numbered and named groups', async ({ page }) => {
  await page.goto('/#regex-tester');

  await expect(page.getByRole('heading', { name: 'Regex Tester' })).toBeVisible();
  await page.getByLabel('Pattern').fill('(?<name>[A-Z][a-z]+)\\s+(?<email>[^\\s]+@[^\\s]+)');
  await page.getByLabel('Flags').fill('g');
  await page.getByLabel('Test text').fill('Ada ada@example.test\nGrace grace@example.test');
  await page.getByRole('button', { name: 'Run test', exact: true }).click();

  await expect(page.locator('#regexStatusDetail')).toHaveText('Valid');
  await expect(page.locator('#regexFlagsDetail')).toHaveText('g');
  await expect(page.locator('#regexMatchCountDetail')).toHaveText('2');
  await expect(page.locator('#regexGroupCountDetail')).toHaveText('4');
  await expect(page.locator('#regexNamedGroupCountDetail')).toHaveText('4');
  await expect(page.locator('#regexWarningsDetail')).toHaveText('None');
  await expect(page.locator('.regex-highlight')).toHaveCount(2);
  await expect(page.locator('#regexMatchList')).toContainText('Named: name: Ada');
  await expect(page.locator('#regexOutput')).toHaveValue(/"matchCount": 2/);
  await expect(page.locator('#regexOutput')).toHaveValue(/"name": "Ada"/);
  await expect(page.locator('#downloadRegexButton')).toHaveAttribute('download', 'regex-report.json');
  await expect(page.getByRole('status')).toContainText('Regex test completed successfully.');
});

test('reports regex warnings and invalid patterns', async ({ page }) => {
  await page.goto('/#regex-tester');

  await page.getByLabel('Pattern').fill('z+');
  await page.getByLabel('Flags').fill('ggi');
  await page.getByLabel('Output format').selectOption('markdown');
  await page.getByLabel('Test text').fill('abc');
  await page.getByRole('button', { name: 'Run test', exact: true }).click();

  await expect(page.locator('#regexMatchCountDetail')).toHaveText('0');
  await expect(page.locator('#regexWarningsDetail')).toHaveText('2 warnings');
  await expect(page.locator('#regexOutputTypeDetail')).toHaveText('Markdown report');
  await expect(page.locator('#regexOutput')).toHaveValue(/No matches found/);
  await expect(page.locator('#downloadRegexButton')).toHaveAttribute('download', 'regex-report.md');
  await expect(page.getByRole('status')).toContainText('Duplicate flags removed');

  await page.getByLabel('Pattern').fill('(');
  await page.getByRole('button', { name: 'Run test', exact: true }).click();

  await expect(page.locator('#regexStatusDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Invalid regular expression');
});

test('generates line-level text diffs', async ({ page }) => {
  await page.goto('/#text-diff');

  await expect(page.getByRole('heading', { name: 'Text diff' })).toBeVisible();
  await page.getByLabel('Left text').fill('one\ntwo\nthree');
  await page.getByLabel('Right text').fill('one\nTWO\nthree\nfour');
  await page.getByRole('button', { name: 'Compare text', exact: true }).click();

  await expect(page.locator('#textDiffStatusDetail')).toHaveText('Different');
  await expect(page.locator('#textDiffChangesDetail')).toHaveText('2');
  await expect(page.locator('#textDiffAddedRemovedDetail')).toHaveText('1 / 0');
  await expect(page.locator('#textDiffChangedUnchangedDetail')).toHaveText('1 / 2');
  await expect(page.locator('#textDiffLinesDetail')).toHaveText('3 / 4');
  await expect(page.locator('#textDiffWarningsDetail')).toHaveText('None');
  await expect(page.locator('.text-diff-row.changed')).toHaveCount(1);
  await expect(page.locator('.text-diff-row.added')).toHaveCount(1);
  await expect(page.locator('#textDiffOutput')).toHaveValue(/-two/);
  await expect(page.locator('#textDiffOutput')).toHaveValue(/\+TWO/);
  await expect(page.locator('#downloadTextDiffButton')).toHaveAttribute('download', 'text-diff.diff');
  await expect(page.getByRole('status')).toContainText('Text diff report created successfully.');
});

test('finds text diff and honours comparison options', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('Text utilities');
  await expect(page.locator('[data-tool-id="text-diff"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="case-converter"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="uuid-generator"]')).toBeEnabled();
  await page.locator('[data-tool-id="text-diff"]').click();

  await page.getByLabel('Output format').selectOption('json');
  await page.getByLabel('Ignore whitespace changes').check();
  await page.getByLabel('Ignore case').check();
  await page.getByLabel('Left text').fill('Hello   WORLD');
  await page.getByLabel('Right text').fill('hello world');
  await page.getByRole('button', { name: 'Compare text', exact: true }).click();

  await expect(page.locator('#textDiffStatusDetail')).toHaveText('Identical');
  await expect(page.locator('#textDiffChangesDetail')).toHaveText('0');
  await expect(page.locator('#textDiffOptionsDetail')).toHaveText('Ignoring Whitespace + Case');
  await expect(page.locator('#textDiffWarningsDetail')).toHaveText('2 warnings');
  await expect(page.locator('#textDiffOutputTypeDetail')).toHaveText('JSON report');
  await expect(page.locator('#textDiffOutput')).toHaveValue(/"equal": true/);
  await expect(page.locator('#downloadTextDiffButton')).toHaveAttribute('download', 'text-diff.json');
  await expect(page.getByRole('status')).toContainText('Whitespace differences were ignored.');
});

test('converts text into common code casing styles', async ({ page }) => {
  await page.goto('/#case-converter');

  await expect(page.getByRole('heading', { name: 'Case converter' })).toBeVisible();
  await page.getByLabel('Text input').fill('customer account ID');
  await page.getByRole('button', { name: 'Convert case', exact: true }).click();

  await expect(page.locator('#caseStatusDetail')).toHaveText('Converted');
  await expect(page.locator('#caseModeDetail')).toHaveText('Whole input');
  await expect(page.locator('#caseLinesDetail')).toHaveText('1');
  await expect(page.locator('#caseWordsDetail')).toHaveText('3');
  await expect(page.locator('#caseOutputTypeDetail')).toHaveText('All common cases');
  await expect(page.locator('#caseWarningsDetail')).toHaveText('None');
  await expect(page.locator('.case-result-card')).toHaveCount(9);
  await expect(page.locator('#casePreview')).toContainText('customerAccountId');
  await expect(page.locator('#casePreview')).toContainText('CUSTOMER_ACCOUNT_ID');
  await expect(page.locator('#caseOutput')).toHaveValue(/camelCase: `customerAccountId`/);
  await expect(page.locator('#downloadCaseButton')).toHaveAttribute('download', 'case-converter.md');
  await expect(page.getByRole('status')).toContainText('Case conversion completed successfully.');
});

test('finds case converter and converts each line separately', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('Text utilities');
  await expect(page.locator('[data-tool-id="case-converter"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="uuid-generator"]')).toBeEnabled();
  await page.locator('[data-tool-id="case-converter"]').click();

  await page.getByLabel('Output format').selectOption('kebab');
  await page.getByLabel('Convert each line separately').check();
  await page.getByLabel('Text input').fill('First name\n\nLast name');
  await page.getByRole('button', { name: 'Convert case', exact: true }).click();

  await expect(page.locator('#caseModeDetail')).toHaveText('Each line');
  await expect(page.locator('#caseOutputTypeDetail')).toHaveText('kebab-case');
  await expect(page.locator('#caseWarningsDetail')).toHaveText('1 warning');
  await expect(page.locator('#caseOutput')).toHaveValue('first-name\n\nlast-name');
  await expect(page.locator('#downloadCaseButton')).toHaveAttribute('download', 'case-converter.txt');
  await expect(page.getByRole('status')).toContainText('Empty lines were preserved.');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Convert case', exact: true }).click();
  await expect(page.locator('#caseStatusDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Enter text to convert.');
});

test('generates UUID v4 values in the browser', async ({ page }) => {
  await page.goto('/#uuid-generator');

  await expect(page.getByRole('heading', { name: 'UUID generator' })).toBeVisible();
  await page.getByLabel('UUID count').fill('2');
  await page.getByRole('button', { name: 'Generate UUIDs', exact: true }).click();

  await expect(page.locator('#uuidModeDetail')).toHaveText('Generated UUIDs');
  await expect(page.locator('#uuidTotalDetail')).toHaveText('2');
  await expect(page.locator('#uuidValidInvalidDetail')).toHaveText('2 / 0');
  await expect(page.locator('#uuidVersion4Detail')).toHaveText('2');
  await expect(page.locator('#uuidOutputTypeDetail')).toHaveText('UUID list');
  await expect(page.locator('#uuidWarningsDetail')).toHaveText('None');
  await expect(page.locator('.uuid-result-card.valid')).toHaveCount(2);
  await expect(page.locator('#uuidOutput')).toHaveValue(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/);
  await expect(page.locator('#downloadUuidButton')).toHaveAttribute('download', 'uuid-list.txt');
  await expect(page.getByRole('status')).toContainText('UUIDs generated successfully.');
});

test('restores hyphens for hyphenless UUID input', async ({ page }) => {
  await page.goto('/#uuid-generator');

  await page.getByLabel('UUID input').fill('f47ac10b58cc4372a5670e02b2c3d479');
  await page.getByRole('button', { name: 'Restore hyphens', exact: true }).click();

  await expect(page.locator('#uuidModeDetail')).toHaveText('Restored UUIDs');
  await expect(page.locator('#uuidTotalDetail')).toHaveText('1');
  await expect(page.locator('#uuidValidInvalidDetail')).toHaveText('1 / 0');
  await expect(page.locator('#uuidOutputTypeDetail')).toHaveText('UUID list');
  await expect(page.locator('#uuidWarningsDetail')).toHaveText('None');
  await expect(page.locator('.uuid-result-card.valid')).toContainText('f47ac10b-58cc-4372-a567-0e02b2c3d479');
  await expect(page.locator('#uuidOutput')).toHaveValue('f47ac10b-58cc-4372-a567-0e02b2c3d479');
  await expect(page.locator('#downloadUuidButton')).toHaveAttribute('download', 'uuid-restored-list.txt');
  await expect(page.getByRole('status')).toContainText('UUID hyphens restored successfully.');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByLabel('UUID input').fill('not-a-uuid');
  await page.getByRole('button', { name: 'Restore hyphens', exact: true }).click();
  await expect(page.locator('#uuidModeDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Entry 1 is not a valid UUID: Invalid UUID format.');
});

test('validates UUID input and reports invalid values', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('uuid');
  await expect(page.locator('[data-tool-id="uuid-generator"]')).toBeEnabled();
  await page.locator('[data-tool-id="uuid-generator"]').click();

  await page.getByLabel('UUID input').fill([
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    '00000000-0000-0000-0000-000000000000',
    'f47ac10b58cc4372a5670e02b2c3d479',
    'not-a-uuid',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  ].join('\n'));
  await page.getByRole('button', { name: 'Validate UUIDs', exact: true }).click();

  await expect(page.locator('#uuidModeDetail')).toHaveText('Validation report');
  await expect(page.locator('#uuidTotalDetail')).toHaveText('5');
  await expect(page.locator('#uuidValidInvalidDetail')).toHaveText('4 / 1');
  await expect(page.locator('#uuidNilDetail')).toHaveText('1');
  await expect(page.locator('#uuidDuplicatesDetail')).toHaveText('2');
  await expect(page.locator('#uuidWarningsDetail')).toHaveText('4 warnings');
  await expect(page.locator('.uuid-result-card.invalid')).toHaveCount(1);
  await expect(page.locator('#uuidOutput')).toHaveValue(/Status: Needs attention/);
  await expect(page.locator('#uuidOutput')).toHaveValue(/Invalid UUID format/);
  await expect(page.locator('#downloadUuidButton')).toHaveAttribute('download', 'uuid-validation-report.md');
  await expect(page.getByRole('status')).toContainText('Some entries are not valid UUIDs.');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Validate UUIDs', exact: true }).click();
  await expect(page.locator('#uuidModeDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Enter one or more UUIDs to validate.');
});

test('loads a fillable PDF template and exports field mappings', async ({ page }) => {
  await page.goto('/#pdf-template-field-explorer');

  await expect(page.getByRole('heading', { name: 'PDF Template Field Explorer' })).toBeVisible();
  await page.setInputFiles('#pdfTemplateFileInput', {
    name: 'template.pdf',
    mimeType: 'application/pdf',
    buffer: await createFillablePdf()
  });

  await expect(page.getByRole('status')).toContainText('PDF loaded successfully.');
  await expect(page.locator('#pdfPageCount')).toHaveText('1');
  await expect(page.locator('#pdfFieldCount')).toHaveText('2');
  await expect(page.locator('#pdfFieldList').getByText('customer_name')).toBeVisible();
  await expect(page.locator('#pdfFieldList').getByText('newsletter_opt_in')).toBeVisible();

  await page.getByLabel('Search fields').fill('newsletter');
  await expect(page.locator('#pdfFieldList').getByText('customer_name')).not.toBeVisible();
  await expect(page.locator('#pdfFieldList').getByText('newsletter_opt_in')).toBeVisible();

  await page.locator('#pdfFieldList').getByText('newsletter_opt_in').click();
  await expect(page.locator('#pdfSelectedFieldTitle')).toHaveText('newsletter_opt_in');
  await expect(page.locator('#pdfSelectedFieldDetail')).toHaveText('newsletter_opt_in');
  await expect(page.locator('#copyPdfSelectedJsonButton')).toBeEnabled();
  await expect(page.locator('#exportPdfFieldsJsonButton')).toBeEnabled();
});

test('decodes JWT claims and reports local verification warnings', async ({ page }) => {
  await page.goto('/#jwt-decoder');

  const token = makeJwt({
    iss: 'https://issuer.example',
    sub: 'user-123',
    aud: 'api://primary',
    exp: 1893456000,
    scp: 'read write',
    roles: ['Admin']
  });

  await expect(page.getByRole('heading', { name: 'JWT Decoder & Claims Inspector' })).toBeVisible();
  await page.getByLabel('JWT input').fill(token);
  await page.getByRole('button', { name: 'Decode JWT', exact: true }).click();

  await expect(page.locator('#jwtStatusDetail')).toHaveText('Valid by time claims');
  await expect(page.locator('#jwtAlgorithmDetail')).toHaveText('HS256');
  await expect(page.locator('#jwtSubjectDetail')).toHaveText('user-123');
  await expect(page.locator('#jwtAudienceDetail')).toHaveText('api://primary');
  await expect(page.locator('#jwtAccessDetail')).toHaveText('read, write / Admin');
  await expect(page.locator('#jwtWarningsDetail')).toHaveText('1 warning');
  await expect(page.locator('#jwtPayloadOutput')).toHaveValue(/"sub": "user-123"/);
  await expect(page.locator('#jwtWarningList')).toContainText('signature verification is not performed locally');
  await expect(page.locator('#downloadJwtButton')).toHaveAttribute('download', 'decoded-jwt.json');
  await expect(page.getByRole('status')).toContainText('JWT decoded successfully.');
});

test('reports JWT expiry and invalid token errors', async ({ page }) => {
  await page.goto('/#jwt-decoder');

  await page.getByLabel('JWT input').fill(makeJwt({ exp: 1704067200 }));
  await page.getByRole('button', { name: 'Decode JWT', exact: true }).click();

  await expect(page.locator('#jwtStatusDetail')).toHaveText('Expired');
  await expect(page.locator('#jwtWarningsDetail')).toHaveText('2 warnings');
  await expect(page.getByRole('status')).toContainText('The token is expired.');

  await page.getByLabel('JWT input').fill(`${encodeJwtPart({ alg: 'HS256' })}.x.sig`);
  await page.getByRole('button', { name: 'Decode JWT', exact: true }).click();

  await expect(page.locator('#jwtStatusDetail')).toHaveText('-');
  await expect(page.getByRole('status')).toContainText('JWT payload is not valid Base64URL.');
});

test('converts cURL requests to fetch snippets', async ({ page }) => {
  await page.goto('/#curl-fetch-converter');

  await expect(page.getByRole('heading', { name: 'cURL/fetch converter' })).toBeVisible();
  await page.getByLabel('Request input').fill("curl -X POST https://api.example.test/items -H 'Content-Type: application/json' --data-raw '{\"name\":\"Contoso\"}'");
  await page.getByRole('button', { name: 'Convert request', exact: true }).click();

  await expect(page.locator('#curlFetchModeDetail')).toHaveText('cURL to fetch');
  await expect(page.locator('#curlFetchMethodDetail')).toHaveText('POST');
  await expect(page.locator('#curlFetchUrlDetail')).toHaveText('https://api.example.test/items');
  await expect(page.locator('#curlFetchHeadersDetail')).toHaveText('1');
  await expect(page.locator('#curlFetchBodyDetail')).toHaveText('Present');
  await expect(page.locator('#curlFetchWarningsDetail')).toHaveText('None');
  await expect(page.locator('#curlFetchOutputTypeDetail')).toHaveText('JavaScript fetch snippet');
  await expect(page.locator('#curlFetchPreview')).toContainText('Content-Type: application/json');
  await expect(page.locator('#curlFetchOutput')).toHaveValue(/await fetch/);
  await expect(page.locator('#curlFetchOutput')).toHaveValue(/JSON\.stringify/);
  await expect(page.locator('#downloadCurlFetchButton')).toHaveAttribute('download', 'request.fetch.js');
  await expect(page.getByRole('status')).toContainText('Request converted successfully.');
});

test('converts fetch snippets to cURL and reports converter errors', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('curl');
  await expect(page.locator('[data-tool-id="curl-fetch-converter"]')).toBeEnabled();
  await page.locator('[data-tool-id="curl-fetch-converter"]').click();

  await page.getByLabel('Conversion mode').selectOption('fetch-to-curl');
  await page.getByLabel('Request input').fill([
    'fetch("https://api.example.test/items", {',
    '  method: "PATCH",',
    '  headers: { "Content-Type": "application/json" },',
    '  body: JSON.stringify({"name":"Updated"})',
    '});'
  ].join('\n'));
  await page.getByRole('button', { name: 'Convert request', exact: true }).click();

  await expect(page.locator('#curlFetchModeDetail')).toHaveText('fetch to cURL');
  await expect(page.locator('#curlFetchMethodDetail')).toHaveText('PATCH');
  await expect(page.locator('#curlFetchHeadersDetail')).toHaveText('1');
  await expect(page.locator('#curlFetchOutputTypeDetail')).toHaveText('cURL command');
  await expect(page.locator('#curlFetchOutput')).toHaveValue(/curl/);
  await expect(page.locator('#curlFetchOutput')).toHaveValue(/-X 'PATCH'/);
  await expect(page.locator('#downloadCurlFetchButton')).toHaveAttribute('download', 'request.curl.sh');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Convert request', exact: true }).click();
  await expect(page.locator('#curlFetchModeDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Enter cURL or fetch input to convert.');
});

test('generates a Power Pages Web API GET snippet', async ({ page }) => {
  await page.goto('/#power-pages-web-api-snippets');

  await expect(page.getByRole('heading', { name: 'Power Pages Web API Snippet Generator' })).toBeVisible();
  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Logical table name').fill('account');
  await page.getByLabel('Columns / Web API fields').fill('name, accountnumber');
  await page.getByLabel('$filter', { exact: true }).fill('statecode eq 0');
  await page.getByLabel('$top').fill('5');
  await page.getByRole('button', { name: 'Generate snippet', exact: true }).click();

  await expect(page.locator('#webApiMethod')).toHaveText('GET');
  await expect(page.locator('#webApiEndpoint')).toHaveText('/_api/accounts?$select=name,accountnumber&$filter=statecode%20eq%200&$top=5');
  await expect(page.locator('#webApiSiteSettingsCount')).toHaveText('3');
  await expect(page.locator('#webApiSnippetOutput')).toHaveValue(/webapi\.safeAjax/);
  await expect(page.locator('#webApiSnippetOutput')).toHaveValue(/Webapi\/account\/enabled = true/);
  await expect(page.getByRole('status')).toContainText('Power Pages Web API snippet generated successfully.');
});

test('generates Power Pages Web API POST and PATCH payload snippets', async ({ page }) => {
  await page.goto('/#power-pages-web-api-snippets');

  await page.getByLabel('Operation').selectOption('create');
  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Logical table name').fill('account');
  await page.getByLabel('Payload JSON').fill('{"name":"Contoso"}');
  await page.getByRole('button', { name: 'Generate snippet', exact: true }).click();

  await expect(page.locator('#webApiMethod')).toHaveText('POST');
  await expect(page.locator('#webApiSnippetOutput')).toHaveValue(/contentType: "application\/json"/);
  await expect(page.locator('#webApiSnippetOutput')).toHaveValue(/"name": "Contoso"/);

  await page.getByLabel('Operation').selectOption('update');
  await page.getByLabel('Record ID').fill('00000000-0000-0000-0000-000000000001');
  await page.getByLabel('Payload JSON').fill('{"name":"Updated"}');
  await page.getByRole('button', { name: 'Generate snippet', exact: true }).click();

  await expect(page.locator('#webApiMethod')).toHaveText('PATCH');
  await expect(page.locator('#webApiEndpoint')).toHaveText('/_api/accounts(00000000-0000-0000-0000-000000000001)');
  await expect(page.locator('#webApiSnippetOutput')).toHaveValue(/"name": "Updated"/);
});

test('reports Power Pages Web API validation errors', async ({ page }) => {
  await page.goto('/#power-pages-web-api-snippets');

  await page.getByLabel('Operation').selectOption('retrieve');
  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Logical table name').fill('account');
  await page.getByRole('button', { name: 'Generate snippet', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Enter a record ID');

  await page.getByLabel('Operation').selectOption('create');
  await page.getByLabel('Payload JSON').fill('{bad json}');
  await page.getByRole('button', { name: 'Generate snippet', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Payload must be valid JSON.');
});

test('generates Power Pages Web API site settings checklist', async ({ page }) => {
  await page.goto('/#power-pages-site-settings');

  await expect(page.getByRole('heading', { name: 'Site Settings Helper' })).toBeVisible();
  await page.getByLabel('Logical table name').fill('account');
  await page.getByLabel('Fields').fill('name, accountnumber');
  await page.getByLabel('Include Web API inner error while debugging').check();
  await page.getByRole('button', { name: 'Generate checklist', exact: true }).click();

  await expect(page.locator('#siteSettingsFeatureDetail')).toHaveText('Web API table access');
  await expect(page.locator('#siteSettingsCount')).toHaveText('3');
  await expect(page.locator('#siteSettingsWarnings')).toHaveText('1 warning');
  await expect(page.locator('#siteSettingsOutput')).toHaveValue(/Webapi\/account\/enabled = true/);
  await expect(page.locator('#siteSettingsOutput')).toHaveValue(/Webapi\/account\/fields = name,accountnumber/);
  await expect(page.getByRole('status')).toContainText('Power Pages site settings checklist generated successfully.');
});

test('generates registration and Liquid safety site settings', async ({ page }) => {
  await page.goto('/#power-pages-site-settings');

  await page.getByLabel('Feature area').selectOption('registration');
  await page.getByLabel('Require invitations for registration').check();
  await page.getByRole('button', { name: 'Generate checklist', exact: true }).click();

  await expect(page.locator('#siteSettingsOutput')).toHaveValue(/Authentication\/Registration\/RequiresConfirmation = true/);
  await expect(page.locator('#siteSettingsOutput')).toHaveValue(/Authentication\/Registration\/RequiresInvitation = true/);

  await page.getByLabel('Feature area').selectOption('liquid-safety');
  await page.getByLabel('Keep default HTML encoding enabled').uncheck();
  await page.getByRole('button', { name: 'Generate checklist', exact: true }).click();

  await expect(page.locator('#siteSettingsOutput')).toHaveValue(/Site\/EnableDefaultHtmlEncoding = false/);
  await expect(page.locator('#siteSettingsWarnings')).toHaveText('1 warning');
});

test('reports Site Settings Helper validation errors', async ({ page }) => {
  await page.goto('/#power-pages-site-settings');

  await page.getByRole('button', { name: 'Generate checklist', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Enter the logical table name');
});

test('generates a Power Pages table permissions checklist', async ({ page }) => {
  await page.goto('/#power-pages-table-permissions');

  await expect(page.getByRole('heading', { name: 'Table Permissions Checklist' })).toBeVisible();
  await page.getByLabel('Logical table name').fill('account');
  await page.getByLabel('Write').check();
  await page.getByLabel('Custom web roles').fill('Portal Managers');
  await page.getByLabel('Review this permission for Web API use').check();
  await page.getByRole('button', { name: 'Generate checklist', exact: true }).click();

  await expect(page.locator('#tablePermissionRisk')).toHaveText('High');
  await expect(page.locator('#tablePermissionOperations')).toHaveText('Read, Write');
  await expect(page.locator('#tablePermissionScopeDetail')).toHaveText('Global');
  await expect(page.locator('#tablePermissionWarnings')).toHaveText('4 warnings');
  await expect(page.locator('#tablePermissionOutput')).toHaveValue(/Webapi\/account\/enabled/);
  await expect(page.locator('#tablePermissionOutput')).toHaveValue(/Authenticated Users, Portal Managers/);
  await expect(page.getByRole('status')).toContainText('Power Pages table permissions checklist generated successfully.');
});

test('reports table permissions validation and anonymous access warnings', async ({ page }) => {
  await page.goto('/#power-pages-table-permissions');

  await page.getByRole('button', { name: 'Generate checklist', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Enter the logical table name');

  await page.getByLabel('Logical table name').fill('contact');
  await page.getByLabel('Include Anonymous Users web role').check();
  await page.getByRole('button', { name: 'Generate checklist', exact: true }).click();

  await expect(page.locator('#tablePermissionRisk')).toHaveText('Critical');
  await expect(page.locator('#tablePermissionOutput')).toHaveValue(/Anonymous Users/);
  await expect(page.locator('#tablePermissionOutput')).toHaveValue(/Global read/);
});

test('builds Dataverse OData queries and reports validation errors', async ({ page }) => {
  await page.goto('/#dataverse-odata-query-builder');

  await expect(page.getByRole('heading', { name: 'Dataverse OData Query Builder' })).toBeVisible();
  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Columns / $select').fill('name, accountnumber');
  await page.getByLabel('$filter', { exact: true }).fill('statecode eq 0');
  await page.getByLabel('$top').fill('5');
  await page.getByLabel('Include formatted values').check();
  await page.getByRole('button', { name: 'Build query', exact: true }).click();

  await expect(page.locator('#odataModeDetail')).toHaveText('Dataverse Web API');
  await expect(page.locator('#odataEndpointDetail')).toHaveText('/api/data/v9.2/accounts?$select=name,accountnumber&$filter=statecode%20eq%200&$top=5');
  await expect(page.locator('#odataHeadersDetail')).toHaveText('4');
  await expect(page.locator('#odataWarningsDetail')).toHaveText('None');
  await expect(page.locator('#odataOutput')).toHaveValue(/await fetch/);
  await expect(page.getByRole('status')).toContainText('Dataverse OData query built successfully.');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Build query', exact: true }).click();
  await expect(page.locator('#odataModeDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Enter the Dataverse EntitySetName.');
});

test('uses Dataverse OData presets, guided expands and advanced warnings', async ({ page }) => {
  await page.goto('/#dataverse-odata-query-builder');

  await page.getByLabel('Endpoint preset').selectOption('power-pages-active-accounts');
  await expect(page.getByLabel('Endpoint mode')).toHaveValue('power-pages');
  await expect(page.getByLabel('EntitySetName')).toHaveValue('accounts');
  await expect(page.getByRole('status')).toContainText('Power Pages Web API: active accounts preset applied.');

  await page.getByRole('button', { name: 'Build query', exact: true }).click();
  await expect(page.locator('#odataModeDetail')).toHaveText('Power Pages Web API');
  await expect(page.locator('#odataEndpointDetail')).toHaveText('/_api/accounts?$select=name,accountnumber&$filter=statecode%20eq%200&$orderby=name%20asc&$top=50');
  await expect(page.locator('#odataOutput')).toHaveValue(/Preset: Power Pages Web API: active accounts/);

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Columns / $select').fill('name');
  await page.getByLabel('Guided $expand relationship').fill('primarycontactid');
  await page.getByLabel('Nested $select').fill('fullname, emailaddress1');
  await page.getByLabel('Nested $filter').fill('statecode eq 0');
  await page.getByLabel('Nested $orderby').fill('fullname asc');
  await page.getByRole('button', { name: 'Add guided $expand', exact: true }).click();
  await expect(page.getByLabel('Relationships / $expand')).toHaveValue('primarycontactid($select=fullname,emailaddress1;$filter=statecode eq 0;$orderby=fullname asc)');
  await expect(page.getByRole('status')).toContainText('Guided $expand added to the query.');

  await page.getByRole('button', { name: 'Build query', exact: true }).click();
  await expect(page.locator('#odataEndpointDetail')).toHaveText('/api/data/v9.2/accounts?$select=name&$expand=primarycontactid($select=fullname,emailaddress1;$filter=statecode%20eq%200;$orderby=fullname%20asc)');

  await page.getByLabel('Relationships / $expand').fill('primarycontactid($filter=statecode eq 0), ownerid, createdby($select=fullname)');
  await page.getByLabel('Include $count').check();
  await page.getByRole('button', { name: 'Build query', exact: true }).click();
  await expect(page.locator('#odataWarningsDetail')).toHaveText('5 warnings');
  await expect(page.locator('#odataOutput')).toHaveValue(/Review broad \$expand usage/);
  await expect(page.locator('#downloadOdataButton')).toHaveAttribute('download', 'dataverse-odata-query.md');
});

test('builds Power Platform CLI commands and reports validation errors', async ({ page }) => {
  await page.goto('/#power-platform-cli-command-builder');

  await expect(page.getByRole('heading', { name: 'Power Platform CLI Command Builder' })).toBeVisible();
  await page.getByLabel('Command', { exact: true }).selectOption('solution-export');
  await page.getByLabel('Solution name').fill('Core Solution');
  await page.getByLabel('Zip or file path').fill('dist/core solution.zip');
  await page.getByLabel('Export as managed').check();
  await page.getByRole('button', { name: 'Build command', exact: true }).click();

  await expect(page.locator('#pacGroupDetail')).toHaveText('Solutions');
  await expect(page.locator('#pacCommandDetail')).toHaveText('Export solution');
  await expect(page.locator('#pacWarningsDetail')).toHaveText('1 warning');
  await expect(page.locator('#pacOutput')).toHaveValue(/pac solution export --name "Core Solution" --path "dist\/core solution\.zip" --managed true/);
  await expect(page.getByRole('status')).toContainText('Power Platform CLI command built successfully.');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Build command', exact: true }).click();
  await expect(page.locator('#pacCommandDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Enter an environment URL');
});

test('formats Power Automate expressions and reports syntax errors', async ({ page }) => {
  await page.goto('/#power-automate-expression-formatter');

  await expect(page.getByRole('heading', { name: 'Power Automate Expression Formatter' })).toBeVisible();
  await page.getByLabel('Expression input').fill("@{concat(triggerOutputs()?['body/name'], ' - ', variables('suffix'))}");
  await page.getByRole('button', { name: 'Format expression', exact: true }).click();

  await expect(page.locator('#flowExpressionWrapperDetail')).toHaveText('@{ } interpolation');
  await expect(page.locator('#flowExpressionFunctionsDetail')).toHaveText('3');
  await expect(page.locator('#flowExpressionReferencesDetail')).toHaveText('1');
  await expect(page.locator('#flowExpressionWarningsDetail')).toHaveText('1 warning');
  await expect(page.locator('#flowExpressionOutput')).toHaveValue(/concat\(\n  triggerOutputs\(\)\?\['body\/name'\],\n  ' - ',\n  variables\('suffix'\)\n\)/);
  await expect(page.getByRole('status')).toContainText('Power Automate expression formatted successfully.');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByLabel('Expression input').fill("concat('a'");
  await page.getByRole('button', { name: 'Format expression', exact: true }).click();
  await expect(page.locator('#flowExpressionWrapperDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Expression has an unclosed');
});

test('formats Power Fx snippets and reports syntax errors', async ({ page }) => {
  await page.goto('/#power-fx-snippet-formatter');

  await expect(page.getByRole('heading', { name: 'Power Fx Snippet Formatter' })).toBeVisible();
  await page.getByLabel('Formula input').fill('If(IsBlank(TextInput1.Text), Notify("Missing"), Patch(Accounts, Defaults(Accounts), { Name: TextInput1.Text }))');
  await page.getByRole('button', { name: 'Format formula', exact: true }).click();

  await expect(page.locator('#powerFxFunctionsDetail')).toHaveText('5');
  await expect(page.locator('#powerFxUnknownDetail')).toHaveText('0');
  await expect(page.locator('#powerFxWarningsDetail')).toHaveText('None');
  await expect(page.locator('#powerFxOutput')).toHaveValue(/Patch\(\n    Accounts,\n    Defaults/);
  await expect(page.getByRole('status')).toContainText('Power Fx formula formatted successfully.');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByLabel('Formula input').fill('If(IsBlank(TextInput1.Text)');
  await page.getByRole('button', { name: 'Format formula', exact: true }).click();
  await expect(page.locator('#powerFxOutputTypeDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Formula has an unclosed');
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
  await page.goto('/#base64-to-file');

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

test('formats FetchXML and builds a Power Pages Liquid block', async ({ page }) => {
  await page.goto('/#fetchxml-liquid-builder');

  const fetchXml = '<fetch><entity name="account"><attribute name="name" /></entity></fetch>';

  await expect(page.getByRole('heading', { name: 'FetchXML Formatter & Liquid Builder' })).toBeVisible();
  await page.getByLabel('FetchXML input').fill(fetchXml);
  await page.getByRole('button', { name: 'Format FetchXML', exact: true }).click();

  await expect(page.locator('#powerPagesOutput')).toHaveValue([
    '<fetch>',
    '  <entity name="account">',
    '    <attribute name="name"/>',
    '  </entity>',
    '</fetch>'
  ].join('\n'));
  await expect(page.locator('#fetchXmlRootStatus')).toHaveText('Valid <fetch> root');
  await expect(page.locator('#fetchXmlWarnings')).toHaveText('1 warning');
  await expect(page.getByRole('status')).toContainText('FetchXML formatted successfully.');

  await page.getByLabel('Liquid variable name').fill('123 account results!');
  await page.getByRole('button', { name: 'Build Liquid', exact: true }).click();

  await expect(page.locator('#powerPagesOutput')).toHaveValue([
    '{% fetchxml fetchxml_123_account_results %}',
    '<fetch>',
    '  <entity name="account">',
    '    <attribute name="name"/>',
    '  </entity>',
    '</fetch>',
    '{% endfetchxml %}'
  ].join('\n'));
  await expect(page.locator('#powerPagesOutputType')).toHaveText('Liquid');
  await expect(page.locator('#downloadPowerPagesOutputButton')).toHaveAttribute('download', 'power-pages-fetchxml.liquid');
});

async function createFillablePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([420, 260]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const form = pdfDoc.getForm();

  page.drawText('Customer name', { x: 40, y: 206, size: 11, font });
  const nameField = form.createTextField('customer_name');
  nameField.setText('Contoso');
  nameField.addToPage(page, { x: 40, y: 178, width: 220, height: 24 });

  page.drawText('Newsletter opt in', { x: 40, y: 136, size: 11, font });
  const checkBox = form.createCheckBox('newsletter_opt_in');
  checkBox.check();
  checkBox.addToPage(page, { x: 40, y: 108, width: 18, height: 18 });

  form.updateFieldAppearances(font);
  return Buffer.from(await pdfDoc.save());
}

function makeJwt(payload, header = { alg: 'HS256', typ: 'JWT' }, signature = 'signature') {
  return `${encodeJwtPart(header)}.${encodeJwtPart(payload)}.${encodeJwtPart(signature)}`;
}

function encodeJwtPart(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return Buffer.from(text, 'utf8').toString('base64url');
}
