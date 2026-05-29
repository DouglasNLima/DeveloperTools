import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

test('searches the sidebar and switches between available tools', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Base64 to file' })).toBeVisible();
  await expect(page.locator('[data-tool-id="base64-to-file"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Power Platform' })).toBeVisible();

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

test('finds Power Pages tools in the sidebar', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('Power Pages');

  await expect(page.locator('[data-tool-id="fetchxml-liquid-builder"]')).toBeVisible();
  await expect(page.locator('[data-tool-id="power-pages-web-api-snippets"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="power-pages-site-settings"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="power-pages-table-permissions"]')).toBeEnabled();
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
  await expect(page.locator('[data-tool-id="uuid-generator"]')).toHaveAttribute('aria-disabled', 'true');
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
  await expect(page.locator('[data-tool-id="uuid-generator"]')).toHaveAttribute('aria-disabled', 'true');
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

test('generates a Power Pages Web API GET snippet', async ({ page }) => {
  await page.goto('/#power-pages-web-api-snippets');

  await expect(page.getByRole('heading', { name: 'Power Pages Web API Snippet Generator' })).toBeVisible();
  await page.getByLabel('EntitySetName').fill('accounts');
  await page.getByLabel('Logical table name').fill('account');
  await page.getByLabel('Columns / Web API fields').fill('name, accountnumber');
  await page.getByLabel('$filter').fill('statecode eq 0');
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
