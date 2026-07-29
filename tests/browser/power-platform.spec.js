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
  encodeJwtPart,
  makeJwt,
  primeOfflineApp
} from './support.js';
test('loads a fillable PDF template and exports field mappings', async ({ page }) => {
  await page.goto('/#pdf-template-field-explorer');

  await expect(page.getByRole('heading', { name: 'PDF Template Field Explorer' })).toBeVisible();
  await expect(page.locator('#toolHandover')).toBeHidden();
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
  await expect(page.locator('#exportPdfFieldsReportButton')).toBeEnabled();
  await expect(page.locator('#toolHandover').getByRole('button', { name: /Field mapping JSON: Explore JSON records/ })).toBeVisible();
});

test('tags PDF fields and exports a handover report', async ({ page }) => {
  await page.goto('/#pdf-template-field-explorer');

  await page.setInputFiles('#pdfTemplateFileInput', {
    name: 'template.pdf',
    mimeType: 'application/pdf',
    buffer: await createFillablePdf()
  });
  await expect(page.getByRole('status')).toContainText('PDF loaded successfully.');

  await page.locator('#pdfFieldList').getByText('customer_name').click();
  await page.getByLabel('Review tag').selectOption('required');
  await page.getByLabel('Review notes').fill('Maps to the Dataverse contact name.');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('template-pdf-field-handover.md');
  await expect(page.getByRole('status')).toContainText('Field handover report exported as Markdown.');
});

test('hands PDF field mappings to JSON & Data Workbench explore mode', async ({ page }) => {
  await page.goto('/#pdf-template-field-explorer');

  await page.setInputFiles('#pdfTemplateFileInput', {
    name: 'template.pdf',
    mimeType: 'application/pdf',
    buffer: await createFillablePdf()
  });
  await expect(page.getByRole('status')).toContainText('PDF loaded successfully.');
  await page.locator('#toolHandover').getByRole('button', { name: /Field mapping JSON: Explore JSON records/ }).click();

  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Explore');
  await expect(page.getByLabel('Input format')).toHaveValue('json');
  await expect(page.getByLabel('Record path')).toHaveValue('fields');
  await expect(page.getByLabel('JSON or XML input')).toHaveValue(/"fieldCount": 2/);
  await expect(page.getByLabel('JSON or XML input')).toHaveValue(/"name": "customer_name"/);

  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.locator('#dataExplorerPathDetail')).toHaveText('$.fields');
  await expect(page.locator('#dataExplorerResultsDetail')).toHaveText('2');
  await expect(page.locator('#dataExplorerOutput')).toHaveValue(/"name": "customer_name"/);
});

test('hands PDF field mappings to the CSV helper', async ({ page }) => {
  await page.goto('/#pdf-template-field-explorer');

  await page.setInputFiles('#pdfTemplateFileInput', {
    name: 'template.pdf',
    mimeType: 'application/pdf',
    buffer: await createFillablePdf()
  });
  await expect(page.getByRole('status')).toContainText('PDF loaded successfully.');
  await page.locator('#toolHandover').getByRole('button', { name: /Field mapping JSON: Convert fields to CSV/ }).click();

  await expect(page).toHaveURL(/#csv-tsv-helper$/);
  await expect(page.getByLabel('Delimiter')).toHaveValue('comma');
  await expect(page.getByLabel('Output format')).toHaveValue('csv');
  await expect(page.getByLabel('First row contains headers')).toBeChecked();
  await expect(page.getByLabel('CSV/TSV input')).toHaveValue(/^Page,Name,Type,Value/);
  await expect(page.getByLabel('CSV/TSV input')).toHaveValue(/customer_name/);
  await expect(page.getByLabel('CSV/TSV input')).toHaveValue(/newsletter_opt_in/);

  await page.getByRole('button', { name: 'Process data', exact: true }).click();
  await expect(page.locator('#csvRowsDetail')).toHaveText('3 total / 2 data');
  await expect(page.locator('#csvOutputTypeDetail')).toHaveText('CSV');
  await expect(page.locator('#csvOutput')).toHaveValue(/customer_name/);
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

  await expect(page).toHaveURL(/#web-api-workbench$/);
  await expect(page.getByRole('heading', { name: 'Web/API Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('JWT');
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

test('builds cron and RRULE schedules with warnings and validation', async ({ page }) => {
  await page.goto('/#cron-rrule-builder');

  await expect(page).toHaveURL(/#web-api-workbench\/schedule$/);
  await expect(page.getByRole('heading', { name: 'Web/API Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Schedules');
  await page.getByLabel('Schedule type').selectOption('weekly');
  await page.getByLabel('Interval').fill('1');
  await page.getByLabel('Hour').fill('9');
  await page.getByLabel('Minute').fill('30');
  await page.getByLabel('Timezone').fill('Europe/Dublin');
  await page.getByLabel('Start date').fill('2026-05-29');
  await page.locator('#scheduleWeekdayWE').check();
  await page.getByRole('button', { name: 'Build schedule', exact: true }).click();

  await expect(page.locator('#scheduleFrequencyDetail')).toHaveText('Weekly');
  await expect(page.locator('#scheduleCronDetail')).toHaveText('30 9 * * 1,3');
  await expect(page.locator('#scheduleWarningsDetail')).toHaveText('2 warnings');
  await expect(page.locator('#scheduleOutput')).toHaveValue(/DTSTART;TZID=Europe\/Dublin:20260529T093000/);
  await expect(page.locator('#scheduleOutput')).toHaveValue(/RRULE:FREQ=WEEKLY;INTERVAL=1;BYMINUTE=30;BYHOUR=9;BYDAY=MO,WE/);
  await expect(page.locator('#downloadScheduleButton')).toHaveAttribute('download', 'cron-rrule-schedule.md');
  await expect(page.getByRole('status')).toContainText('Cron and RRULE schedule built successfully.');

  await page.getByLabel('Schedule type').selectOption('monthly');
  await page.getByLabel('Month day').fill('31');
  await page.getByRole('button', { name: 'Build schedule', exact: true }).click();

  await expect(page.locator('#scheduleCronDetail')).toHaveText('30 9 31 * *');
  await expect(page.locator('#scheduleOutput')).toHaveValue(/does not exist in every month/);

  await page.getByLabel('Minute').fill('60');
  await page.getByRole('button', { name: 'Build schedule', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Minute must be a whole number');
});

test('converts cURL requests to fetch snippets', async ({ page }) => {
  await page.goto('/#curl-fetch-converter');

  await expect(page).toHaveURL(/#web-api-workbench\/request$/);
  await expect(page.getByRole('heading', { name: 'Web/API Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Requests');
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
  await expect(page.locator('[data-tool-id="web-api-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="curl-fetch-converter"]')).toHaveCount(0);
  await page.locator('[data-tool-id="web-api-workbench"]').click();
  await page.locator('.tool-workbench-tab').filter({ hasText: 'Requests' }).click();
  await expect(page).toHaveURL(/#web-api-workbench\/request$/);

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

test('hands converted request output to the support sanitiser', async ({ page }) => {
  await page.goto('/#curl-fetch-converter');

  await page.getByLabel('Request input').fill("curl https://api.internal.local/items -H 'x-api-key: secretToken12345'");
  await page.getByRole('button', { name: 'Convert request', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Sanitise request/ }).click();

  await expect(page).toHaveURL(/#text-utilities-workbench\/sanitise$/);
  await expect(page.getByLabel('Support pack input')).toHaveValue(/api\.internal\.local/);
  await expect(page.getByLabel('Support pack input')).toHaveValue(/secretToken12345/);

  await page.getByRole('button', { name: 'Sanitise support pack', exact: true }).click();
  await expect(page.locator('#supportPackOutput')).toHaveValue(/\[TOKEN_1\]/);
});

test('generates a Power Pages Web API GET snippet', async ({ page }) => {
  await page.goto('/#power-pages-web-api-snippets');

  await expect(page).toHaveURL(/#power-pages-workbench\/web-api$/);
  await expect(page.getByRole('heading', { name: 'Power Pages Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Web API');
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

test('hands Power Pages Web API snippets to the support sanitiser', async ({ page }) => {
  await page.goto('/#power-pages-web-api-snippets');
  await expect(page).toHaveURL(/#power-pages-workbench\/web-api$/);

  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Logical table name').fill('account');
  await page.getByLabel('Columns / Web API fields').fill('name');
  await page.getByRole('button', { name: 'Generate snippet', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Sanitise snippet/ }).click();

  await expect(page).toHaveURL(/#text-utilities-workbench\/sanitise$/);
  await expect(page.getByLabel('Support pack input')).toHaveValue(/webapi\.safeAjax/);
  await expect(page.getByLabel('Support pack input')).toHaveValue(/Webapi\/account\/enabled/);
});

test('hands Power Pages Web API snippets to the cURL/fetch converter', async ({ page }) => {
  await page.goto('/#power-pages-web-api-snippets');
  await expect(page).toHaveURL(/#power-pages-workbench\/web-api$/);

  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Logical table name').fill('account');
  await page.getByLabel('Columns / Web API fields').fill('name, accountnumber');
  await page.getByLabel('$filter', { exact: true }).fill('statecode eq 0');
  await page.getByLabel('$top').fill('5');
  await page.getByRole('button', { name: 'Generate snippet', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Convert safeAjax to cURL/ }).click();

  await expect(page).toHaveURL(/#web-api-workbench\/request$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Requests');
  await expect(page.getByLabel('Conversion mode')).toHaveValue('fetch-to-curl');
  await expect(page.getByLabel('Request input')).toHaveValue(/^const response = await fetch/);
  await expect(page.getByLabel('Request input')).toHaveValue(/\/_api\/accounts/);
  await expect(page.getByLabel('Request input')).not.toHaveValue(/webapi\.safeAjax/);

  await page.getByRole('button', { name: 'Convert request', exact: true }).click();
  await expect(page.locator('#curlFetchOutput')).toHaveValue(/curl/);
  await expect(page.locator('#curlFetchOutput')).toHaveValue(/\/_api\/accounts/);
  await expect(page.locator('#curlFetchOutputTypeDetail')).toHaveText('cURL command');
});

test('hands Power Pages Web API endpoints to the URL helper', async ({ page }) => {
  await page.goto('/#power-pages-web-api-snippets');
  await expect(page).toHaveURL(/#power-pages-workbench\/web-api$/);

  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Logical table name').fill('account');
  await page.getByLabel('Columns / Web API fields').fill('name, accountnumber');
  await page.getByLabel('$filter', { exact: true }).fill('statecode eq 0');
  await page.getByLabel('$top').fill('5');
  await page.getByRole('button', { name: 'Generate snippet', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Inspect Web API endpoint/ }).click();

  await expect(page).toHaveURL(/#url-codec$/);
  await expect(page.getByLabel('Mode', { exact: true })).toHaveValue('parse-query');
  await expect(page.getByLabel('Query parse output')).toHaveValue('json');
  await expect(page.getByLabel('Input')).toHaveValue('/_api/accounts?$select=name,accountnumber&$filter=statecode%20eq%200&$top=5');

  await page.getByRole('button', { name: 'Process', exact: true }).click();
  await expect(page.locator('#urlOutput')).toHaveValue(/"\$select"/);
  await expect(page.locator('#urlOutput')).toHaveValue(/"name,accountnumber"/);
  await expect(page.locator('#urlOutput')).toHaveValue(/"\$top"/);
});

test('generates Power Pages Web API POST and PATCH payload snippets', async ({ page }) => {
  await page.goto('/#power-pages-web-api-snippets');
  await expect(page).toHaveURL(/#power-pages-workbench\/web-api$/);

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
  await expect(page).toHaveURL(/#power-pages-workbench\/web-api$/);

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

  await expect(page).toHaveURL(/#power-pages-workbench\/site-settings$/);
  await expect(page.getByRole('heading', { name: 'Power Pages Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Site settings');
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
  await expect(page).toHaveURL(/#power-pages-workbench\/site-settings$/);

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
  await expect(page).toHaveURL(/#power-pages-workbench\/site-settings$/);

  await page.getByRole('button', { name: 'Generate checklist', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Enter the logical table name');
});

test('generates a Power Pages table permissions checklist', async ({ page }) => {
  await page.goto('/#power-pages-table-permissions');

  await expect(page).toHaveURL(/#power-pages-workbench\/table-permissions$/);
  await expect(page.getByRole('heading', { name: 'Power Pages Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Table permissions');
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
  await expect(page).toHaveURL(/#power-pages-workbench\/table-permissions$/);

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

test('hands Dataverse OData reports to the support sanitiser', async ({ page }) => {
  await page.goto('/#dataverse-odata-query-builder');

  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Columns / $select').fill('name, accountnumber');
  await page.getByLabel('$filter', { exact: true }).fill('statecode eq 0');
  await page.getByRole('button', { name: 'Build query', exact: true }).click();

  await expect(page.locator('#toolHandover')).toContainText('Continue with this text');
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Sanitise query/ }).click();

  await expect(page).toHaveURL(/#text-utilities-workbench\/sanitise$/);
  await expect(page.getByLabel('Support pack input')).toHaveValue(/Dataverse OData/);
  await expect(page.getByLabel('Support pack input')).toHaveValue(/\/api\/data\/v9\.2\/accounts/);
});

test('extracts Dataverse OData fetch snippets into the cURL/fetch converter', async ({ page }) => {
  await page.goto('/#dataverse-odata-query-builder');

  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Columns / $select').fill('name');
  await page.getByLabel('$filter', { exact: true }).fill('statecode eq 0');
  await page.getByRole('button', { name: 'Build query', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Convert fetch to cURL/ }).click();

  await expect(page).toHaveURL(/#web-api-workbench\/request$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Requests');
  await expect(page.getByLabel('Conversion mode')).toHaveValue('fetch-to-curl');
  await expect(page.getByLabel('Request input')).toHaveValue(/^const response = await fetch/);
  await expect(page.getByLabel('Request input')).not.toHaveValue(/# Dataverse OData query/);

  await page.getByRole('button', { name: 'Convert request', exact: true }).click();
  await expect(page.locator('#curlFetchOutput')).toHaveValue(/curl/);
  await expect(page.locator('#curlFetchOutput')).toHaveValue(/\/api\/data\/v9\.2\/accounts/);
  await expect(page.locator('#curlFetchOutputTypeDetail')).toHaveText('cURL command');
});

test('hands Dataverse OData endpoints to the URL helper', async ({ page }) => {
  await page.goto('/#dataverse-odata-query-builder');

  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Columns / $select').fill('name, accountnumber');
  await page.getByLabel('$filter', { exact: true }).fill('statecode eq 0');
  await page.getByLabel('$top').fill('5');
  await page.getByRole('button', { name: 'Build query', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Inspect endpoint query/ }).click();

  await expect(page).toHaveURL(/#url-codec$/);
  await expect(page.getByLabel('Mode', { exact: true })).toHaveValue('parse-query');
  await expect(page.getByLabel('Query parse output')).toHaveValue('json');
  await expect(page.getByLabel('Input')).toHaveValue('/api/data/v9.2/accounts?$select=name,accountnumber&$filter=statecode%20eq%200&$top=5');

  await page.getByRole('button', { name: 'Process', exact: true }).click();
  await expect(page.locator('#urlOutput')).toHaveValue(/"\$select"/);
  await expect(page.locator('#urlOutput')).toHaveValue(/"name,accountnumber"/);
  await expect(page.locator('#urlOutput')).toHaveValue(/"\$top"/);
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

test('hands Power Platform CLI output to text diff', async ({ page }) => {
  await page.goto('/#power-platform-cli-command-builder');

  await page.getByLabel('Command', { exact: true }).selectOption('solution-export');
  await page.getByLabel('Solution name').fill('Core Solution');
  await page.getByLabel('Zip or file path').fill('dist/core.zip');
  await page.getByRole('button', { name: 'Build command', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Compare as left text/ }).click();

  await expect(page).toHaveURL(/#text-utilities-workbench\/diff$/);
  await expect(page.getByLabel('Left text')).toHaveValue(/pac solution export/);
  await expect(page.getByLabel('Left text')).toHaveValue(/Core Solution/);
  await expect(page.getByLabel('Right text')).toHaveValue('');
});

test('generates Mermaid diagrams from an exported Power Platform solution ZIP', async ({ page }) => {
  await page.goto('/#power-platform-solution-mermaid');

  await expect(page).toHaveURL(/#solution-package-inspector$/);
  await expect(page.getByRole('heading', { name: 'Solution Package Inspector' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Diagrams');
  await page.setInputFiles('#solutionMermaidFileInput', {
    name: 'ops-toolkit.zip',
    mimeType: 'application/zip',
    buffer: createDependencySolutionZip({ guidLabels: true })
  });
  await expect(page.locator('#solutionMermaidDropZone .drop-zone-label span')).toHaveText('ops-toolkit.zip');
  await expect(page.locator('#solutionMermaidDropZone .drop-zone-label small')).toContainText('ZIP selected');
  await expect(page.getByRole('status')).toContainText('ops-toolkit.zip selected.');
  await page.getByRole('button', { name: 'Analyse solution', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Power Platform solution analysed successfully.');
  await expect(page.locator('#solutionMermaidDropZone .drop-zone-label small')).toContainText('Loaded successfully · 5 components found');
  await expect(page.locator('#solutionMermaidPreview svg')).toBeVisible();
  const solutionZoom = page.locator('#solutionMermaidPreview [data-mermaid-zoom-level]');
  const initialSolutionZoom = await solutionZoom.textContent();
  await page.locator('#solutionMermaidPreview [data-mermaid-zoom-out]').click();
  await expect(solutionZoom).not.toHaveText(initialSolutionZoom);
  const solutionViewport = page.locator('#solutionMermaidPreview [data-mermaid-viewport]');
  const solutionCanvas = page.locator('#solutionMermaidPreview [data-mermaid-canvas]');
  const initialSolutionTransform = await solutionCanvas.getAttribute('style');
  await solutionViewport.focus();
  await solutionViewport.press('ArrowRight');
  await expect(solutionCanvas).not.toHaveAttribute('style', initialSolutionTransform);
  await expect(page.locator('#solutionMermaidNameDetail')).toHaveText('Operations Toolkit');
  await expect(page.locator('#solutionMermaidVersionDetail')).toHaveText('1.2.3.4');
  await expect(page.locator('#solutionMermaidComponentsDetail')).toHaveText('5');
  const componentCards = page.locator('#solutionMermaidComponentList .solution-component-card');
  await expect(componentCards).toHaveCount(5);
  const firstComponentCard = componentCards.nth(0);
  await expect(firstComponentCard).toHaveCSS('justify-content', 'stretch');
  await expect(firstComponentCard).toHaveCSS('justify-items', 'start');
  const componentTextOffsets = await Promise.all([
    firstComponentCard.locator('strong').boundingBox(),
    firstComponentCard.locator('span').boundingBox(),
    firstComponentCard.locator('small').boundingBox()
  ]);
  const componentTextLeftEdges = componentTextOffsets.map(box => box?.x ?? 0);
  expect(Math.max(...componentTextLeftEdges) - Math.min(...componentTextLeftEdges)).toBeLessThan(1);
  await expect(page.locator('#solutionMermaidComponentList')).toContainText('Parent account updater');
  await expect(page.locator('#solutionMermaidComponentList')).not.toContainText('643ea8ee-9c35-4fd7-909c-facf7fb68428');
  await expect(page.locator('#solutionMermaidOutput')).toHaveValue(/^flowchart LR/);
  await expect(page.locator('#solutionMermaidOutput')).not.toHaveValue(/643ea8ee-9c35-4fd7-909c-facf7fb68428/i);
  await expect(page.locator('#solutionMermaidOutput')).toHaveValue(/Parent account updater/);
  await expect(page.locator('#solutionMermaidOutput')).toHaveValue(/calls child flow/);
  await expect(page.locator('#solutionMermaidOutput')).toHaveValue(/Account post update/);
  await expect(page.locator('#downloadSolutionMermaidButton')).toHaveAttribute('download', 'Operations Toolkit-automation-map.mmd');

  await page.getByLabel('Component filter').selectOption('cloud-flow');
  await page.getByLabel('Search components').fill('Parent account');
  await expect(page.locator('#solutionMermaidFilteredDetail')).toHaveText('1 shown');
  await expect(page.locator('#solutionMermaidComponentList')).toContainText('Parent account updater');
  await expect(page.locator('#solutionMermaidOutput')).toHaveValue(/^flowchart TD/);
  await expect(page.locator('#solutionMermaidOutput')).toHaveValue(/Update account - OpenApiConnection - UpdateRecord/);
  await expect(page.locator('#downloadSolutionMermaidButton')).toHaveAttribute('download', 'Cloud flow-Parent account updater.mmd');
  await expect(page.locator('#downloadSolutionMermaidInventoryButton')).toHaveAttribute('download', 'Operations Toolkit-inventory.md');
  await page.getByRole('button', { name: 'Show dependency map', exact: true }).click();
  await expect(page.locator('#solutionMermaidOutput')).toHaveValue(/^flowchart LR/);
  await expect(page.locator('#toolHandover')).toContainText('Selected Mermaid: Preview and export');
  await page.locator('#toolHandover').getByRole('button', { name: /Selected Mermaid: Preview and export/ }).click();

  await expect(page).toHaveURL(/#mermaid-studio$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Editor');
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/^flowchart LR/);
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/Parent account updater/);
});

test('reports Power Platform solution Mermaid validation errors', async ({ page }) => {
  await page.goto('/#power-platform-solution-mermaid');
  await expect(page).toHaveURL(/#solution-package-inspector$/);

  await page.getByRole('button', { name: 'Analyse solution', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Choose an exported solution ZIP file before analysing the solution.');

  await page.setInputFiles('#solutionMermaidFileInput', {
    name: 'not-a-solution.zip',
    mimeType: 'application/zip',
    buffer: Buffer.alloc(32)
  });
  await page.getByRole('button', { name: 'Analyse solution', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('The ZIP central directory could not be found.');
});

test('generates Markdown documentation from an exported Power Platform solution ZIP', async ({ page }) => {
  await page.goto('/#power-platform-solution-docs');

  await expect(page).toHaveURL(/#solution-package-inspector\/documentation$/);
  await expect(page.getByRole('heading', { name: 'Solution Package Inspector' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Documentation');
  await page.setInputFiles('#solutionDocsFileInput', {
    name: 'ops-toolkit.zip',
    mimeType: 'application/zip',
    buffer: createSolutionZip()
  });
  await expect(page.locator('#solutionDocsDropZone .drop-zone-label small')).toContainText('ZIP selected');
  await expect(page.getByRole('status')).toContainText('ops-toolkit.zip selected.');
  await page.getByRole('button', { name: 'Analyse solution', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Power Platform solution documentation generated successfully.');
  await expect(page.locator('#solutionDocsDropZone .drop-zone-label small')).toContainText('Loaded successfully');
  await expect(page.locator('#solutionDocsNameDetail')).toHaveText('Operations Toolkit');
  await expect(page.locator('#solutionDocsVersionDetail')).toHaveText('1.2.3.4');
  await expect(page.locator('#solutionDocsProcessesDetail')).toHaveText('2');
  await expect(page.locator('#solutionDocsVariablesDetail')).toHaveText('1');
  await expect(page.locator('#solutionDocsConnectionsDetail')).toHaveText('1');
  await expect(page.locator('#solutionDocsOutput')).toHaveValue(/^# Power Platform solution documentation/);
  await expect(page.locator('#solutionDocsOutput')).toHaveValue(/Account approval/);
  await expect(page.locator('#solutionDocsOutput')).toHaveValue(/Environment variables/);
  await expect(page.locator('#solutionDocsOutput')).toHaveValue(/Current and default included/);
  await expect(page.locator('#solutionDocsOutput')).not.toHaveValue(/https:\/\/api\.example\.test\/current/);
  await expect(page.locator('#downloadSolutionDocsButton')).toHaveAttribute('download', 'Operations-Toolkit-documentation.md');
  await expect(page.locator('#toolHandover')).toContainText('Documentation Markdown: Preview documentation');
  await page.locator('#toolHandover').getByRole('button', { name: /Documentation Markdown: Preview documentation/ }).click();

  await expect(page).toHaveURL(/#markdown-workbench$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Preview');
  await expect(page.getByLabel('Markdown input')).toHaveValue(/^# Power Platform solution documentation/);
  await expect(page.getByLabel('Markdown input')).toHaveValue(/Connection references/);
});

test('reports Power Platform solution documentation validation errors', async ({ page }) => {
  await page.goto('/#power-platform-solution-docs');
  await expect(page).toHaveURL(/#solution-package-inspector\/documentation$/);

  await page.getByRole('button', { name: 'Analyse solution', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Choose an exported solution ZIP file before analysing the solution.');

  await page.setInputFiles('#solutionDocsFileInput', {
    name: 'not-a-solution.zip',
    mimeType: 'application/zip',
    buffer: Buffer.alloc(32)
  });
  await page.getByRole('button', { name: 'Analyse solution', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('The ZIP central directory could not be found.');
});

test('generates an import preflight report from an exported Power Platform solution ZIP', async ({ page }) => {
  await page.goto('/#power-platform-solution-import-preflight');

  await expect(page).toHaveURL(/#solution-package-inspector\/preflight$/);
  await expect(page.getByRole('heading', { name: 'Solution Package Inspector' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Preflight');
  await page.getByRole('button', { name: 'Analyse solution', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Choose an exported solution ZIP file before analysing the solution.');

  await page.setInputFiles('#solutionImportFileInput', {
    name: 'ops-toolkit.zip',
    mimeType: 'application/zip',
    buffer: createImportPreflightSolutionZip()
  });
  await expect(page.locator('#solutionImportDropZone .drop-zone-label small')).toContainText('ZIP selected');
  await expect(page.getByRole('status')).toContainText('ops-toolkit.zip selected.');
  await page.getByLabel('Suggested ZIP path').fill('dist/ops toolkit.zip');
  await page.getByLabel('Target environment note').fill('Test environment before production');
  await page.getByLabel('Run asynchronously').check();
  await page.getByLabel('Force overwrite on import').check();
  await page.getByRole('button', { name: 'Analyse solution', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Power Platform solution import preflight generated successfully.');
  await expect(page.locator('#solutionImportDropZone .drop-zone-label small')).toContainText('Loaded successfully');
  await expect(page.locator('#solutionImportNameDetail')).toHaveText('Operations Toolkit');
  await expect(page.locator('#solutionImportPackageDetail')).toHaveText('Unmanaged');
  await expect(page.locator('#solutionImportComponentsDetail')).toHaveText('4');
  await expect(page.locator('#solutionImportDependenciesDetail')).toHaveText('1');
  await expect(page.locator('#solutionImportVariablesDetail')).toHaveText('1');
  await expect(page.locator('#solutionImportConnectionsDetail')).toHaveText('1');
  await expect(page.locator('#solutionImportWarningsDetail')).toHaveText('4 warnings');
  await expect(page.locator('#solutionImportPreflightOutput')).toHaveValue(/^# Power Platform solution import preflight/);
  await expect(page.locator('#solutionImportPreflightOutput')).toHaveValue(/pac solution import --path "dist\/ops toolkit\.zip" --async --force-overwrite/);
  await expect(page.locator('#solutionImportPreflightOutput')).toHaveValue(/Exported missing dependencies/);
  await expect(page.locator('#solutionImportPreflightOutput')).toHaveValue(/exported solution metadata only/);
  await expect(page.locator('#solutionImportPreflightOutput')).not.toHaveValue(/https:\/\/api\.example\.test\/current/);
  await expect(page.locator('#copySolutionImportButton')).toBeEnabled();
  await expect(page.locator('#downloadSolutionImportButton')).toHaveAttribute('download', 'Operations-Toolkit-import-preflight.md');
  await expect(page.locator('#toolHandover')).toContainText('Preflight Markdown: Preview preflight report');
});

test('formats Power Automate expressions and reports syntax errors', async ({ page }) => {
  await page.goto('/#power-automate-expression-formatter');

  await expect(page.getByRole('heading', { name: 'Power Automate Expression Formatter' })).toBeVisible();
  await page.getByLabel('Expression input').fill("@{concat(triggerOutputs()?['body/name'], ' - ', variables('suffix'))}");
  await page.getByRole('button', { name: 'Format expression', exact: true }).click();

  await expect(page.locator('#flowExpressionWrapperDetail')).toHaveText('@{ } interpolation');
  await expect(page.locator('#flowExpressionFunctionsDetail')).toHaveText('3');
  await expect(page.locator('#flowExpressionReferencesDetail')).toHaveText('2');
  await expect(page.locator('#flowExpressionWarningsDetail')).toHaveText('1 warning');
  await expect(page.locator('#flowExpressionOutput')).toHaveValue(/concat\(\n  triggerOutputs\(\)\?\['body\/name'\],\n  ' - ',\n  variables\('suffix'\)\n\)/);
  await expect(page.getByRole('status')).toContainText('Power Automate expression formatted successfully.');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByLabel('Template', { exact: true }).selectOption('trigger-field-default');
  await page.getByLabel('Field path').fill('customer/name');
  await page.getByLabel('Default value').fill('Unknown');
  await page.getByLabel('Output wrapper').selectOption('interpolation');
  await page.getByRole('button', { name: 'Use template', exact: true }).click();
  await expect(page.getByLabel('Expression input')).toHaveValue("coalesce(triggerOutputs()?['body/customer/name'], 'Unknown')");
  await page.getByRole('button', { name: 'Format expression', exact: true }).click();
  await expect(page.locator('#flowExpressionOutputWrapperDetail')).toHaveText('@{ } interpolation');
  await expect(page.locator('#flowExpressionReferencesDetail')).toHaveText('1');
  await expect(page.locator('#flowExpressionOutput')).toHaveValue("@{coalesce(triggerOutputs()?['body/customer/name'], 'Unknown')}");

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByLabel('Template', { exact: true }).selectOption('action-body-field');
  await page.getByLabel('Action name').fill('Get contact');
  await page.getByRole('button', { name: 'Use template', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Enter a field path');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByLabel('Expression input').fill("concat('a'");
  await page.getByRole('button', { name: 'Format expression', exact: true }).click();
  await expect(page.locator('#flowExpressionWrapperDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Expression has an unclosed');
});

test('hands Power Automate expression output to text diff', async ({ page }) => {
  await page.goto('/#power-automate-expression-formatter');

  await page.getByLabel('Expression input').fill("@{concat(triggerOutputs()?['body/name'], ' ok')}");
  await page.getByRole('button', { name: 'Format expression', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Compare as right text/ }).click();

  await expect(page).toHaveURL(/#text-utilities-workbench\/diff$/);
  await expect(page.getByLabel('Left text')).toHaveValue('');
  await expect(page.getByLabel('Right text')).toHaveValue(/concat\(/);
  await expect(page.getByLabel('Right text')).toHaveValue(/triggerOutputs/);
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

test('builds Power Fx review reports with delegation warnings', async ({ page }) => {
  await page.goto('/#power-fx-snippet-formatter');

  await page.getByLabel('Output mode').selectOption('review');
  await page.getByLabel('Formula input').fill('ClearCollect(colAccounts, Filter(Accounts, "A" in Name))');
  await page.getByRole('button', { name: 'Format formula', exact: true }).click();

  await expect(page.locator('#powerFxOutputTypeDetail')).toHaveText('Review report');
  await expect(page.locator('#powerFxDelegationDetail')).toHaveText('2');
  await expect(page.locator('#powerFxWarningsDetail')).toHaveText('1 warning');
  await expect(page.locator('#powerFxOutput')).toHaveValue(/## Delegation Checklist/);
  await expect(page.locator('#powerFxOutput')).toHaveValue(/Collections are loaded client-side/);
  await expect(page.locator('#downloadPowerFxButton')).toHaveAttribute('download', 'power-fx-review.md');
});

test('hands Power Fx output to text diff', async ({ page }) => {
  await page.goto('/#power-fx-snippet-formatter');

  await page.getByLabel('Formula input').fill('If(IsBlank(TextInput1.Text), Notify("Missing"), Patch(Accounts, Defaults(Accounts), { Name: TextInput1.Text }))');
  await page.getByRole('button', { name: 'Format formula', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Compare as left text/ }).click();

  await expect(page).toHaveURL(/#text-utilities-workbench\/diff$/);
  await expect(page.getByLabel('Left text')).toHaveValue(/Patch\(/);
  await expect(page.getByLabel('Left text')).toHaveValue(/Accounts/);
  await expect(page.getByLabel('Right text')).toHaveValue('');
});

test('reviews model-driven JavaScript and builds migration reports', async ({ page }) => {
  await page.goto('/#model-driven-javascript-reviewer');

  await expect(page).toHaveURL(/#model-driven-javascript-workbench$/);
  await expect(page.getByRole('heading', { name: 'Model-driven JavaScript Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Review');
  await page.getByLabel('JavaScript input').fill([
    'function onLoad() {',
    '  var name = Xrm.Page.getAttribute("name").getValue();',
    '  Xrm.WebApi.retrieveRecord("account", "11111111-1111-4111-8111-111111111111");',
    '}'
  ].join('\n'));
  await page.getByRole('button', { name: 'Analyse JavaScript' }).click();

  await expect(page.locator('#modelDrivenJsReviewHighDetail')).toHaveText('2');
  await expect(page.locator('#modelDrivenJsReviewOutput')).toHaveValue(/Deprecated Xrm.Page usage/);
  await expect(page.locator('#toolHandover')).toContainText('Review report: Preview review');

  await page.getByLabel('Output mode').selectOption('rule-summary-json');
  await page.getByRole('button', { name: 'Analyse JavaScript' }).click();

  await expect(page.locator('#modelDrivenJsReviewOutput')).toHaveValue(/"rules"/);
  await expect(page.locator('#modelDrivenJsReviewRulesDetail')).toHaveText(/\d+/);
  await expect(page.locator('#toolHandover')).toContainText('Rule summary JSON: Format JSON');
  await page.locator('#toolHandover').getByRole('button', { name: /Rule summary JSON: Format JSON/ }).click();
  await expect(page).toHaveURL(/#json-data-workbench$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Format');
  await expect(page.getByLabel('JSON input')).toHaveValue(/deprecated-xrm-page/);

  await page.goto('/#client-api-migration-helper');
  await expect(page).toHaveURL(/#model-driven-javascript-workbench\/migration$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Migration');
  await page.getByLabel('Legacy JavaScript input').fill('function onLoad(){ var name = Xrm.Page.getAttribute("name").getValue(); }');
  await page.getByRole('button', { name: 'Build migration report' }).click();

  await expect(page.locator('#clientApiMigrationReplacementsDetail')).toHaveText('1');
  await expect(page.locator('#clientApiMigrationOutput')).toHaveValue(/formContext.getAttribute\("name"\)/);
  await expect(page.getByRole('status')).toContainText('Client API migration report built successfully.');
});

test('builds model-driven JavaScript snippets', async ({ page }) => {
  await page.goto('/#form-event-handler-builder');

  await expect(page).toHaveURL(/#model-driven-javascript-workbench\/form-events$/);
  await expect(page.getByRole('heading', { name: 'Model-driven JavaScript Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Form events');
  await page.getByLabel('Event type').selectOption('onchange');
  await page.getByLabel('Namespace').fill('Contoso.Account');
  await page.getByLabel('Function name').fill('onNameChange');
  await page.getByLabel('Field logical name').fill('name');
  await page.getByRole('button', { name: 'Generate handler' }).click();

  await expect(page.locator('#formEventOutputTypeDetail')).toHaveText('OnChange handler');
  await expect(page.locator('#formEventHandlerOutput')).toHaveValue(/Contoso.Account.onNameChange/);

  await page.goto('/#xrm-webapi-snippet-builder');
  await expect(page).toHaveURL(/#model-driven-javascript-workbench\/web-api$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Web API');
  await page.getByLabel('Operation').selectOption('retrieveMultipleRecords');
  await page.getByLabel('Table logical name').fill('account');
  await page.getByLabel('Function name').fill('retrieveAccounts');
  await page.getByLabel('$select columns').fill('name,accountnumber');
  await page.getByLabel('$filter').fill('statecode eq 0');
  await page.getByRole('button', { name: 'Generate Web API snippet' }).click();

  await expect(page.locator('#xrmWebApiSnippetOutput')).toHaveValue(/Xrm.WebApi.retrieveMultipleRecords/);
  await expect(page.getByRole('status')).toContainText('Xrm.WebApi snippet generated successfully.');

  await page.goto('/#form-notification-validation-builder');
  await expect(page).toHaveURL(/#model-driven-javascript-workbench\/validation$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Validation');
  await page.getByLabel('Validation rule').selectOption('maxLength');
  await page.getByLabel('Field logical name').fill('name');
  await page.getByLabel('Maximum length').fill('50');
  await page.getByRole('button', { name: 'Generate validation snippet' }).click();

  await expect(page.locator('#formValidationOutput')).toHaveValue(/setNotification/);
  await expect(page.locator('#formValidationOutput')).toHaveValue(/preventDefault/);

  await page.goto('/#command-bar-javascript-builder');
  await expect(page).toHaveURL(/#model-driven-javascript-workbench\/command-bar$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Command bar');
  await page.getByLabel('Command context').selectOption('grid');
  await page.getByLabel('Table logical name').fill('account');
  await page.getByRole('button', { name: 'Generate command handler' }).click();

  await expect(page.locator('#commandBarJavascriptOutput')).toHaveValue(/SelectedControl/);
  await expect(page.locator('#commandBarJavascriptOutput')).toHaveValue(/Promise.all/);
});

test('inspects solution JavaScript events and maps web resource dependencies', async ({ page }) => {
  await page.goto('/#solution-javascript-event-inspector');

  await expect(page).toHaveURL(/#model-driven-solution-inspector$/);
  await expect(page.getByRole('heading', { name: 'Model-driven Solution Inspector' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Events');
  await page.setInputFiles('#solutionJavascriptEventsFileInput', {
    name: 'model-driven.zip',
    mimeType: 'application/zip',
    buffer: createModelDrivenJavascriptSolutionZip({ guidLabels: true })
  });
  await expect(page.locator('#solutionJavascriptEventsDropZone .drop-zone-label small')).toContainText('ZIP selected');
  await page.getByRole('button', { name: 'Analyse JavaScript events' }).click();

  await expect(page.locator('#solutionJavascriptEventsDropZone .drop-zone-label small')).toContainText('Loaded successfully');
  await expect(page.locator('#solutionJavascriptEventsWebresourcesDetail')).toHaveText('1');
  await expect(page.locator('#solutionJavascriptEventsLibrariesDetail')).toHaveText('1');
  await expect(page.locator('#solutionJavascriptEventsHandlersDetail')).toHaveText('2');
  await expect(page.locator('#solutionJavascriptEventsSourcefilesDetail')).toHaveText('2');
  await expect(page.locator('#solutionJavascriptEventsFindingsDetail')).toHaveText(/\d+/);
  await expect(page.locator('#solutionJavascriptEventsOutput')).toHaveValue(/Model-driven JavaScript event inspection/);
  await expect(page.locator('#solutionJavascriptEventsOutput')).toHaveValue(/Library inventory/);
  await expect(page.locator('#solutionJavascriptEventsOutput')).toHaveValue(/Per-library review findings/);
  await expect(page.locator('#solutionJavascriptEventsOutput')).toHaveValue(/Contoso.Account.onLoad/);
  await expect(page.locator('#solutionJavascriptEventsOutput')).not.toHaveValue(/643ea8ee-9c35-4fd7-909c-facf7fb68428/i);

  await page.goto('/#web-resource-dependency-mapper');
  await expect(page).toHaveURL(/#model-driven-solution-inspector\/dependencies$/);
  await expect(page.getByRole('heading', { name: 'Model-driven Solution Inspector' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Dependencies');
  await page.setInputFiles('#webResourceDependencyFileInput', {
    name: 'model-driven.zip',
    mimeType: 'application/zip',
    buffer: createModelDrivenJavascriptSolutionZip({ guidLabels: true })
  });
  await expect(page.locator('#webResourceDependencyDropZone .drop-zone-label small')).toContainText('ZIP selected');
  await page.getByRole('button', { name: 'Build dependency map' }).click();

  await expect(page.locator('#webResourceDependencyDropZone .drop-zone-label small')).toContainText('Loaded successfully');
  await expect(page.locator('#webResourceDependencyMapOutput')).toHaveValue(/Web resource dependency map/);
  await expect(page.locator('#webResourceDependencyMapOutput')).toHaveValue(/Source file references/);
  await expect(page.locator('#webResourceDependencyMermaidOutput')).toHaveValue(/flowchart LR/);
  await expect(page.locator('#webResourceDependencyMermaidOutput')).toHaveValue(/HTML script/);
  await expect(page.locator('#webResourceDependencyMermaidOutput')).toHaveValue(/Account script/);
  await expect(page.locator('#webResourceDependencyMermaidOutput')).not.toHaveValue(/643ea8ee-9c35-4fd7-909c-facf7fb68428/i);
  await expect(page.locator('#webResourceDependencyMermaidPreview svg')).toBeVisible();
  const dependencyZoom = page.locator('#webResourceDependencyMermaidPreview [data-mermaid-zoom-level]');
  const initialDependencyZoom = await dependencyZoom.textContent();
  await page.locator('#webResourceDependencyMermaidPreview [data-mermaid-zoom-in]').click();
  await expect(dependencyZoom).not.toHaveText(initialDependencyZoom);
  await expect(page.locator('#toolHandover')).toContainText('Mermaid diagram: Preview and export');
});
