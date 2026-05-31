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
test('exports CSV data as a renamed Markdown table', async ({ page }) => {
  await page.goto('/#csv-tsv-helper');

  await page.getByLabel('Output format').selectOption('markdown');
  await page.getByLabel('Column rename mapping').fill('name=Full name\nemail=Email address');
  await page.getByLabel('CSV/TSV input').fill('name,email,unused\nAda,ada@example.test,\nGrace,grace@example.test,');
  await page.getByRole('button', { name: 'Process data', exact: true }).click();

  await expect(page.locator('#csvOutputTypeDetail')).toHaveText('Markdown table');
  await expect(page.locator('#csvWarningsDetail')).toHaveText('1 warning');
  await expect(page.locator('#csvIssueList')).toContainText('unused');
  await expect(page.locator('#csvOutput')).toHaveValue(/\| Full name \| Email address \| unused \|/);
  await expect(page.locator('#downloadCsvButton')).toHaveAttribute('download', 'delimited-output.md');
});

test('runs regex matches with numbered and named groups', async ({ page }) => {
  await page.goto('/#regex-tester');

  await expect(page).toHaveURL(/#text-utilities-workbench$/);
  await expect(page.getByRole('heading', { name: 'Text Utilities Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Regex');
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

test('loads regex examples and previews replacements', async ({ page }) => {
  await page.goto('/#regex-tester');

  await page.getByLabel('Local example').selectOption('email-contacts');
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(page.getByLabel('Pattern')).toHaveValue('(?<name>[A-Z][a-z]+)\\s+(?<email>[^\\s]+@[^\\s]+)');
  await expect(page.getByLabel('Replacement preview')).toHaveValue('$<email>');
  await expect(page.getByRole('status')).toContainText('Email contacts example loaded.');

  await page.getByRole('button', { name: 'Preview replacement', exact: true }).click();
  await expect(page.locator('#regexOutputTypeDetail')).toHaveText('Replacement preview');
  await expect(page.locator('#regexMatchCountDetail')).toHaveText('2');
  await expect(page.locator('#regexPreview')).toContainText('ada@example.test');
  await expect(page.locator('#regexOutput')).toHaveValue(/Regex replacement preview/);
  await expect(page.locator('#downloadRegexButton')).toHaveAttribute('download', 'regex-replacement-preview.md');
});

test('hands regex JSON reports to JSON & Data Workbench explore mode', async ({ page }) => {
  await page.goto('/#regex-tester');

  await page.getByLabel('Pattern').fill('(?<name>[A-Z][a-z]+)\\s+(?<email>[^\\s]+@[^\\s]+)');
  await page.getByLabel('Flags').fill('g');
  await page.getByLabel('Test text').fill('Ada ada@example.test\nGrace grace@example.test');
  await page.getByRole('button', { name: 'Run test', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Explore JSON records/ }).click();

  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Explore');
  await expect(page.getByLabel('Input format')).toHaveValue('json');
  await expect(page.getByLabel('JSON or XML input')).toHaveValue(/"matches": \[/);

  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.locator('#dataExplorerPathDetail')).toHaveText('$.matches');
  await expect(page.locator('#dataExplorerSourceDetail')).toHaveText('2');
});

test('formats and linearises SQL queries', async ({ page }) => {
  await page.goto('/#sql-query-formatter');

  await expect(page).toHaveURL(/#text-utilities-workbench\/sql$/);
  await expect(page.getByRole('heading', { name: 'Text Utilities Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('SQL');
  await expect(page.locator('[data-tool-id="text-utilities-workbench"]')).toHaveAttribute('aria-current', 'page');
  await page.getByLabel('SQL input').fill("select id,name from users where active=1 and note='x -- y' order by name");
  await page.getByRole('button', { name: 'Format SQL', exact: true }).click();

  await expect(page.locator('#sqlStatusDetail')).toHaveText('Ready');
  await expect(page.locator('#sqlModeDetail')).toHaveText('Format');
  await expect(page.locator('#sqlLinesDetail')).toHaveText('8');
  await expect(page.locator('#sqlOutput')).toHaveValue(/select\n  id,\n  name\nfrom users\nwhere\n  active = 1/);
  await expect(page.locator('#sqlOutput')).toHaveValue(/note = 'x -- y'/);
  await expect(page.locator('#downloadSqlButton')).toHaveAttribute('download', 'formatted-sql.sql');
  await expect(page.getByRole('status')).toContainText('Formatted SQL created successfully.');

  await page.getByRole('button', { name: 'Linearise SQL', exact: true }).click();

  await expect(page.locator('#sqlModeDetail')).toHaveText('Linearise');
  await expect(page.locator('#sqlLinesDetail')).toHaveText('1');
  await expect(page.locator('#sqlOutput')).toHaveValue("select id, name from users where active = 1 and note = 'x -- y' order by name");
  await expect(page.locator('#copySqlButton')).toBeEnabled();
  await expect(page.locator('#downloadSqlButton')).toHaveAttribute('download', 'linearised-sql.sql');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Format SQL', exact: true }).click();

  await expect(page.locator('#sqlStatusDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Enter a SQL query to format.');
});

test('sanitises support packs and reports validation errors', async ({ page }) => {
  await page.goto('/#support-pack-sanitiser');

  await expect(page).toHaveURL(/#text-utilities-workbench\/sanitise$/);
  await expect(page.getByRole('heading', { name: 'Text Utilities Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Sanitise');
  await page.getByLabel('Support pack input').fill([
    'User admin@example.com called https://api.internal.local/private',
    'token=secretToken12345',
    'Path C:\\Users\\dougl\\trace.log'
  ].join('\n'));
  await page.getByRole('button', { name: 'Sanitise support pack', exact: true }).click();

  await expect(page.locator('#supportPackStatusDetail')).toHaveText('Sanitised');
  await expect(page.locator('#supportPackSensitiveDetail')).toHaveText('4');
  await expect(page.locator('#supportPackOutput')).toHaveValue(/## Sanitised Support Pack/);
  await expect(page.locator('#supportPackOutput')).toHaveValue(/\[EMAIL_1\]/);
  await expect(page.locator('#supportPackOutput')).toHaveValue(/\[INTERNAL_URL_1\]/);
  await expect(page.locator('#supportPackOutput')).toHaveValue(/\[TOKEN_1\]/);
  await expect(page.locator('#supportPackOutput')).not.toHaveValue(/admin@example\.com/);
  await expect(page.locator('#copySupportPackButton')).toBeEnabled();
  await expect(page.locator('#downloadSupportPackButton')).toHaveAttribute('download', 'sanitised-support-pack.md');
  await expect(page.getByRole('status')).toContainText('Support pack sanitised successfully.');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Sanitise support pack', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Enter support pack content to sanitise.');
});

test('hands sanitised support text to the regex tester', async ({ page }) => {
  await page.goto('/#support-pack-sanitiser');

  await page.getByLabel('Support pack input').fill([
    'User admin@example.com',
    'token=secretToken12345'
  ].join('\n'));
  await page.getByRole('button', { name: 'Sanitise support pack', exact: true }).click();

  await expect(page.locator('#toolHandover')).toContainText('Continue with this text');
  await page.locator('#toolHandover').getByRole('button', { name: /Sanitised output: Test with regex/ }).click();

  await expect(page).toHaveURL(/#text-utilities-workbench$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Regex');
  await expect(page.getByLabel('Test text')).toHaveValue(/\[EMAIL_1\]/);
  await expect(page.getByLabel('Test text')).not.toHaveValue(/admin@example\.com/);

  await page.getByLabel('Pattern').fill('\\[EMAIL_1\\]');
  await page.getByRole('button', { name: 'Run test', exact: true }).click();
  await expect(page.locator('#regexMatchCountDetail')).toHaveText('1');
});

test('generates line-level text diffs', async ({ page }) => {
  await page.goto('/#text-diff');

  await expect(page).toHaveURL(/#text-utilities-workbench\/diff$/);
  await expect(page.getByRole('heading', { name: 'Text Utilities Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Diff');
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
  await expect(page.locator('[data-tool-id="text-utilities-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="html-cleaner-converter"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="markdown-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="regex-tester"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="sql-query-formatter"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="support-pack-sanitiser"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="text-diff"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="case-converter"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="uuid-generator"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="markdown-preview-inspector"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="markdown-table-formatter"]')).toHaveCount(0);
  await page.locator('[data-tool-id="text-utilities-workbench"]').click();
  await page.locator('.tool-workbench-tab').filter({ hasText: 'Diff' }).click();
  await expect(page).toHaveURL(/#text-utilities-workbench\/diff$/);

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

test('hands text diff JSON reports to JSON & Data Workbench explore mode', async ({ page }) => {
  await page.goto('/#text-diff');

  await page.getByLabel('Output format').selectOption('json');
  await page.getByLabel('Left text').fill('one\ntwo');
  await page.getByLabel('Right text').fill('one\ntwo updated\nthree');
  await page.getByRole('button', { name: 'Compare text', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Explore JSON records/ }).click();

  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Explore');
  await expect(page.getByLabel('Input format')).toHaveValue('json');
  await expect(page.getByLabel('JSON or XML input')).toHaveValue(/"rows": \[/);

  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.locator('#dataExplorerPathDetail')).toHaveText('$.rows');
  await expect(page.locator('#dataExplorerSourceDetail')).toHaveText('3');
});

test('converts HTML to readable text and Markdown', async ({ page }) => {
  await page.goto('/#html-cleaner-converter');

  const html = [
    '<article>',
    '<h1>Release notes</h1>',
    '<p>Read the <a href="https://example.test/guide">guide</a>.</p>',
    '<ul><li>Alpha</li><li>Beta</li></ul>',
    '<table><tr><th>Name</th><th>Status</th></tr><tr><td>Ada</td><td>Ready</td></tr></table>',
    '</article>'
  ].join('');

  await expect(page.getByRole('heading', { name: 'HTML cleaner/converter' })).toBeVisible();
  await page.getByLabel('HTML input').fill(html);
  await page.getByRole('button', { name: 'Convert HTML', exact: true }).click();

  await expect(page.locator('#htmlOutputTypeDetail')).toHaveText('Plain text');
  await expect(page.locator('#htmlElementCountDetail')).toHaveText('14');
  await expect(page.locator('#htmlReferenceCountDetail')).toHaveText('1');
  await expect(page.locator('#htmlWarningsDetail')).toHaveText('None');
  await expect(page.locator('#htmlCleanerOutput')).toHaveValue(/Release notes/);
  await expect(page.locator('#htmlCleanerOutput')).toHaveValue(/Read the guide\./);
  await expect(page.locator('#htmlCleanerOutput')).toHaveValue(/- Alpha/);
  await expect(page.locator('#htmlCleanerOutput')).toHaveValue(/Name\tStatus/);
  await expect(page.locator('#copyHtmlButton')).toBeEnabled();
  await expect(page.locator('#downloadHtmlButton')).toHaveAttribute('download', 'html-cleaner.txt');
  await expect(page.getByRole('status')).toContainText('Plain text created successfully.');

  await page.getByLabel('Output format').selectOption('markdown');
  await page.getByRole('button', { name: 'Convert HTML', exact: true }).click();

  await expect(page.locator('#htmlOutputTypeDetail')).toHaveText('Markdown');
  await expect(page.locator('#htmlCleanerOutput')).toHaveValue(/^# Release notes/);
  await expect(page.locator('#htmlCleanerOutput')).toHaveValue(/\[guide\]\(https:\/\/example.test\/guide\)/);
  await expect(page.locator('#htmlCleanerOutput')).toHaveValue(/\| Name \| Status \|/);
  await expect(page.locator('#downloadHtmlButton')).toHaveAttribute('download', 'html-cleaner.md');
  await expect(page.getByRole('status')).toContainText('Markdown created successfully.');
});

test('hands cleaned HTML output to a text diff input', async ({ page }) => {
  await page.goto('/#html-cleaner-converter');

  await page.getByLabel('HTML input').fill('<article><h1>Release notes</h1><p>Alpha</p></article>');
  await page.getByRole('button', { name: 'Convert HTML', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Compare as left text/ }).click();

  await expect(page).toHaveURL(/#text-utilities-workbench\/diff$/);
  await expect(page.getByLabel('Left text')).toHaveValue(/Release notes/);
  await expect(page.getByLabel('Left text')).toHaveValue(/Alpha/);
  await expect(page.getByLabel('Right text')).toHaveValue('');
});

test('previews Markdown with inspection details and Mermaid handover', async ({ page }) => {
  await page.goto('/#markdown-preview-inspector');

  await expect(page).toHaveURL(/#markdown-workbench$/);
  await expect(page.getByRole('heading', { name: 'Markdown Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Preview');
  await page.getByLabel('Markdown input').fill([
    '# Release notes',
    '',
    'Read the [deployment guide](docs/deploy.md).',
    '',
    '## Diagram',
    '',
    '| Step | Owner |',
    '| --- | --- |',
    '| Review | Ada |',
    '',
    '```mermaid',
    'flowchart TD',
    '  Draft --> Review',
    '```'
  ].join('\n'));
  await page.getByRole('button', { name: 'Render Markdown', exact: true }).click();

  await expect(page.locator('#markdownPreview h1')).toHaveText('Release notes');
  await expect(page.locator('#markdownPreview h2')).toHaveText('Diagram');
  await expect(page.locator('#markdownPreview table')).toContainText('Review');
  await expect(page.locator('#markdownPreview .markdown-mermaid-block svg')).toBeVisible();
  await expect(page.locator('#markdownHeadingDetail')).toHaveText('2');
  await expect(page.locator('#markdownLinkDetail')).toHaveText('1');
  await expect(page.locator('#markdownFenceDetail')).toHaveText('1');
  await expect(page.locator('#markdownMermaidDetail')).toHaveText('1');
  await expect(page.locator('#markdownOutline')).toContainText('Release notes');
  await expect(page.locator('#markdownReferences')).toContainText('docs/deploy.md');
  await expect(page.locator('#downloadMarkdownButton')).toHaveAttribute('download', 'markdown-preview.md');
  await expect(page.getByRole('status')).toContainText('Markdown rendered with 2 headings.');

  await page.locator('#toolHandover').getByRole('button', { name: /First Mermaid block: Preview Mermaid block/ }).click();

  await expect(page).toHaveURL(/#mermaid-studio$/);
  await expect(page.getByRole('heading', { name: 'Mermaid Studio' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Editor');
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/^flowchart TD/);
});

test('hands HTML Markdown output into the Markdown Workbench preview mode', async ({ page }) => {
  await page.goto('/#markdown-preview-inspector');

  await expect(page).toHaveURL(/#markdown-workbench$/);
  await page.getByRole('button', { name: 'Render Markdown', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Enter Markdown input before rendering.');

  await page.goto('/#html-cleaner-converter');
  await page.getByLabel('Output format').selectOption('markdown');
  await page.getByLabel('HTML input').fill('<article><h1>Guide</h1><p>Read <a href="./setup.md">setup</a>.</p></article>');
  await page.getByRole('button', { name: 'Convert HTML', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Preview Markdown/ }).click();

  await expect(page).toHaveURL(/#markdown-workbench$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Preview');
  await expect(page.getByLabel('Markdown input')).toHaveValue(/^# Guide/);
  await page.getByRole('button', { name: 'Render Markdown', exact: true }).click();
  await expect(page.locator('#markdownPreview h1')).toHaveText('Guide');
  await expect(page.locator('#markdownReferences')).toContainText('./setup.md');
});

test('formats Markdown tables and hands output to the Markdown preview', async ({ page }) => {
  await page.goto('/#markdown-table-formatter');

  await expect(page).toHaveURL(/#markdown-workbench\/tables$/);
  await expect(page.getByRole('heading', { name: 'Markdown Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Tables');
  await page.getByLabel('Markdown table input').fill([
    '# Report',
    '',
    '| Name|Count|',
    '| :--- | ---: |',
    '| Ada | 12 |',
    '| Grace | 4 |'
  ].join('\n'));
  await page.getByRole('button', { name: 'Format table', exact: true }).click();

  await expect(page.locator('#markdownTableCountDetail')).toHaveText('1');
  await expect(page.locator('#markdownTableRowsDetail')).toHaveText('3 total / 2 data');
  await expect(page.locator('#markdownTableColumnsDetail')).toHaveText('2');
  await expect(page.locator('#markdownTableWarningsDetail')).toHaveText('None');
  await expect(page.locator('#markdownTableOutput')).toHaveValue([
    '# Report',
    '',
    '| Name  | Count |',
    '| :---- | ----: |',
    '| Ada   |    12 |',
    '| Grace |     4 |'
  ].join('\n'));
  await expect(page.locator('#downloadMarkdownTableButton')).toHaveAttribute('download', 'markdown-table.md');
  await expect(page.getByRole('status')).toContainText('Markdown table formatted successfully.');

  await page.locator('#toolHandover').getByRole('button', { name: /Output: Preview Markdown/ }).click();

  await expect(page).toHaveURL(/#markdown-workbench$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Preview');
  await expect(page.getByLabel('Markdown input')).toHaveValue(/# Report/);
  await page.getByRole('button', { name: 'Render Markdown', exact: true }).click();
  await expect(page.locator('#markdownPreview table')).toContainText('Grace');
});

test('converts Markdown tables to CSV and hands output to the CSV helper', async ({ page }) => {
  await page.goto('/#markdown-table-formatter');

  await expect(page).toHaveURL(/#markdown-workbench\/tables$/);
  await page.getByRole('button', { name: 'Format table', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Enter Markdown table input before formatting.');

  await page.getByLabel('Output format').selectOption('csv');
  await page.getByLabel('Markdown table input').fill([
    '| Name | Note |',
    '| --- | --- |',
    '| Ada | Uses \\| safely |',
    '| Grace | `A|B` |'
  ].join('\n'));
  await page.getByRole('button', { name: 'Format table', exact: true }).click();

  await expect(page.locator('#markdownTableOutputTypeDetail')).toHaveText('CSV');
  await expect(page.locator('#markdownTableOutput')).toHaveValue([
    'Name,Note',
    'Ada,Uses | safely',
    'Grace,`A|B`'
  ].join('\n'));
  await expect(page.locator('#downloadMarkdownTableButton')).toHaveAttribute('download', 'markdown-table.csv');
  await expect(page.getByRole('status')).toContainText('Markdown table converted successfully.');

  await page.locator('#toolHandover').getByRole('button', { name: /Output: Inspect as delimited data/ }).click();

  await expect(page).toHaveURL(/#csv-tsv-helper$/);
  await expect(page.getByLabel('CSV/TSV input')).toHaveValue(/Name,Note/);
  await expect(page.getByLabel('Delimiter')).toHaveValue('auto');
  await expect(page.getByLabel('Output format')).toHaveValue('csv');
});

test('finds the HTML cleaner from sidebar search', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('HTML');
  await expect(page.locator('[data-tool-id="html-cleaner-converter"]')).toBeEnabled();
  await page.locator('[data-tool-id="html-cleaner-converter"]').click();

  await expect(page).toHaveURL(/#html-cleaner-converter$/);
  await expect(page.getByRole('heading', { name: 'HTML cleaner/converter' })).toBeVisible();
  await expect(page.locator('[data-tool-id="html-cleaner-converter"]')).toHaveAttribute('aria-current', 'page');
});

test('converts text into common code casing styles', async ({ page }) => {
  await page.goto('/#case-converter');

  await expect(page).toHaveURL(/#text-utilities-workbench\/case$/);
  await expect(page.getByRole('heading', { name: 'Text Utilities Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Case');
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

test('hands converted case output to a text diff input', async ({ page }) => {
  await page.goto('/#case-converter');

  await page.getByLabel('Output format').selectOption('snake');
  await page.getByLabel('Text input').fill('Customer Account ID');
  await page.getByRole('button', { name: 'Convert case', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Compare as right text/ }).click();

  await expect(page).toHaveURL(/#text-utilities-workbench\/diff$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Diff');
  await expect(page.getByLabel('Left text')).toHaveValue('');
  await expect(page.getByLabel('Right text')).toHaveValue('customer_account_id');
});

test('finds case converter and converts each line separately', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('Text utilities');
  await expect(page.locator('[data-tool-id="text-utilities-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="case-converter"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="uuid-generator"]')).toHaveCount(0);
  await page.locator('[data-tool-id="text-utilities-workbench"]').click();
  await page.locator('.tool-workbench-tab').filter({ hasText: 'Case' }).click();
  await expect(page).toHaveURL(/#text-utilities-workbench\/case$/);

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

  await expect(page).toHaveURL(/#text-utilities-workbench\/uuid$/);
  await expect(page.getByRole('heading', { name: 'Text Utilities Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('UUID');
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
  await expect(page.locator('[data-tool-id="text-utilities-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="uuid-generator"]')).toHaveCount(0);
  await page.locator('[data-tool-id="text-utilities-workbench"]').click();
  await page.locator('.tool-workbench-tab').filter({ hasText: 'UUID' }).click();
  await expect(page).toHaveURL(/#text-utilities-workbench\/uuid$/);

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
