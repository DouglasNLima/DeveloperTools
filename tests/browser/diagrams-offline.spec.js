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
test('renders Mermaid diagrams and exposes local exports', async ({ page }) => {
  await page.goto('/#mermaid-editor');

  await expect(page).toHaveURL(/#mermaid-studio$/);
  await expect(page.getByRole('heading', { name: 'Mermaid Studio' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Editor');
  await page.getByLabel('File name').fill('checkout-flow');
  await page.getByLabel('Mermaid source').fill([
    'flowchart TD',
    '  start([Start]) --> validate["Validate request"]',
    '  validate --> done([Done])'
  ].join('\n'));
  await page.getByRole('button', { name: 'Render diagram', exact: true }).click();

  await expect(page.locator('#mermaidPreview svg')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#mermaidTypeDetail')).toHaveText(/flowchart/i);
  await expect(page.locator('#downloadMermaidSourceButton')).toHaveAttribute('download', 'checkout-flow.mmd');
  await expect(page.locator('#downloadMermaidSvgButton')).toHaveAttribute('download', 'checkout-flow.svg');
  await expect(page.locator('#downloadMermaidPngButton')).toHaveAttribute('download', 'checkout-flow.png');
  await expect(page.getByRole('status')).toContainText('Mermaid diagram rendered successfully.');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Render diagram', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Enter Mermaid source before rendering.');
});

test('hands Mermaid template output to the editor and text diff', async ({ page }) => {
  await page.goto('/#mermaid-template-builder');

  await expect(page).toHaveURL(/#mermaid-studio\/templates$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Templates');
  await page.getByLabel('Template type').selectOption('sequence');
  await page.getByLabel('Title').fill('Checkout');
  await page.getByLabel('Primary item').fill('Browser');
  await page.getByLabel('Secondary item').fill('API');
  await page.getByRole('button', { name: 'Use template', exact: true }).click();

  await expect(page.locator('#mermaidTemplateOutput')).toHaveValue(/^sequenceDiagram/);
  await expect(page.locator('#downloadMermaidTemplateButton')).toHaveAttribute('download', 'Checkout.mmd');
  await expect(page.locator('#toolHandover')).toContainText('Continue with this Mermaid');
  await page.locator('#toolHandover').getByRole('button', { name: /Mermaid output: Preview and export/ }).click();

  await expect(page).toHaveURL(/#mermaid-studio$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Editor');
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/^sequenceDiagram/);
  await page.getByRole('button', { name: 'Render diagram', exact: true }).click();
  await expect(page.locator('#mermaidPreview svg')).toBeVisible({ timeout: 15000 });

  await page.locator('#toolHandover').getByRole('button', { name: /Mermaid source: Compare as left text/ }).click();
  await expect(page).toHaveURL(/#text-utilities-workbench\/diff$/);
  await expect(page.getByLabel('Left text')).toHaveValue(/^sequenceDiagram/);
});

test('converts JSON data and API requests into Mermaid workflows', async ({ page }) => {
  await page.goto('/#data-to-mermaid');

  await expect(page).toHaveURL(/#mermaid-studio\/data$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Data');
  await page.getByLabel('Diagram').selectOption('pie');
  await page.getByLabel('Label field').fill('status');
  await page.getByLabel('Value field').fill('count');
  await page.getByLabel('JSON, CSV or TSV input').fill('[{"status":"Active","count":12},{"status":"Paused","count":4}]');
  await page.getByRole('button', { name: 'Generate Mermaid', exact: true }).click();

  await expect(page.locator('#dataMermaidOutput')).toHaveValue(/^pie showData/);
  await expect(page.locator('#dataMermaidInputDetail')).toHaveText('JSON');
  await expect(page.locator('#dataMermaidWarningsDetail')).toHaveText('None');
  await page.locator('#toolHandover').getByRole('button', { name: /Mermaid output: Preview and export/ }).click();
  await expect(page).toHaveURL(/#mermaid-studio$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Editor');
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/^pie showData/);

  await page.goto('/#api-workflow-to-mermaid');
  await expect(page).toHaveURL(/#mermaid-studio\/api-workflow$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('API/workflow');
  await page.getByLabel('Request, endpoint note or step list').fill('curl -X POST https://api.example.test/orders -H "Content-Type: application/json" --data-raw "{\\"name\\":\\"Ada\\"}"');
  await page.getByRole('button', { name: 'Generate Mermaid', exact: true }).click();

  await expect(page.locator('#apiMermaidOutput')).toHaveValue(/^sequenceDiagram/);
  await expect(page.locator('#apiMermaidMethodDetail')).toHaveText('POST');
  await expect(page.locator('#downloadApiMermaidButton')).toHaveAttribute('download', 'api-workflow.mmd');
});

test('renders Mermaid from existing JSON and API handovers', async ({ page }) => {
  await page.goto('/#json-formatter');

  await page.getByLabel('JSON input').fill('{"account":{"name":"Contoso","active":true}}');
  await page.getByRole('button', { name: 'Format JSON', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Create Mermaid tree/ }).click();

  await expect(page).toHaveURL(/#mermaid-studio$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Editor');
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/^flowchart TD/);
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/account/);

  await page.goto('/#curl-fetch-converter');
  await page.getByLabel('Request input').fill('curl https://api.example.test/accounts');
  await page.getByRole('button', { name: 'Convert request', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Create request diagram/ }).click();

  await expect(page).toHaveURL(/#mermaid-studio$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Editor');
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/^sequenceDiagram/);
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/GET https:\/\/api.example.test\/accounts/);
});

test('loads the Mermaid renderer and chunks offline', async ({ page }) => {
  await primeOfflineApp(page);
  await page.context().setOffline(true);

  try {
    await page.goto('/#mermaid-editor');

    await expect(page).toHaveURL(/#mermaid-studio$/);
    await expect(page.getByRole('heading', { name: 'Mermaid Studio' })).toBeVisible();
    await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Editor');
    await page.getByLabel('Mermaid source').fill('flowchart TD\n  A --> B');
    await page.getByRole('button', { name: 'Render diagram', exact: true }).click();

    await expect(page.locator('#mermaidPreview svg')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('status')).toContainText('Mermaid diagram rendered successfully.');
  } finally {
    await page.context().setOffline(false);
  }
});

test('loads the Power Platform solution Mermaid generator offline', async ({ page }) => {
  await primeOfflineApp(page);
  await page.context().setOffline(true);

  try {
    await page.goto('/#power-platform-solution-mermaid');

    await expect(page).toHaveURL(/#solution-package-inspector$/);
    await expect(page.getByRole('heading', { name: 'Solution Package Inspector' })).toBeVisible();
    await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Diagrams');
    await page.setInputFiles('#solutionMermaidFileInput', {
      name: 'offline-solution.zip',
      mimeType: 'application/zip',
      buffer: createSolutionZip()
    });
    await page.getByRole('button', { name: 'Analyse solution', exact: true }).click();

    await expect(page.getByRole('status')).toContainText('Power Platform solution analysed successfully.');
    await expect(page.locator('#solutionMermaidOutput')).toHaveValue(/^flowchart LR|^stateDiagram-v2|^flowchart TD/);
  } finally {
    await page.context().setOffline(false);
  }
});

test('loads the Power Platform solution documentation generator offline', async ({ page }) => {
  await primeOfflineApp(page);
  await page.context().setOffline(true);

  try {
    await page.goto('/#power-platform-solution-docs');

    await expect(page).toHaveURL(/#solution-package-inspector\/documentation$/);
    await expect(page.getByRole('heading', { name: 'Solution Package Inspector' })).toBeVisible();
    await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Documentation');
    await page.setInputFiles('#solutionDocsFileInput', {
      name: 'offline-solution.zip',
      mimeType: 'application/zip',
      buffer: createSolutionZip()
    });
    await page.getByRole('button', { name: 'Analyse solution', exact: true }).click();

    await expect(page.getByRole('status')).toContainText('Power Platform solution documentation generated successfully.');
    await expect(page.locator('#solutionDocsOutput')).toHaveValue(/^# Power Platform solution documentation/);
  } finally {
    await page.context().setOffline(false);
  }
});

test('loads the Power Platform solution import preflight offline', async ({ page }) => {
  await primeOfflineApp(page);
  await page.context().setOffline(true);

  try {
    await page.goto('/#power-platform-solution-import-preflight');

    await expect(page).toHaveURL(/#solution-package-inspector\/preflight$/);
    await expect(page.getByRole('heading', { name: 'Solution Package Inspector' })).toBeVisible();
    await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Preflight');
    await page.setInputFiles('#solutionImportFileInput', {
      name: 'offline-solution.zip',
      mimeType: 'application/zip',
      buffer: createImportPreflightSolutionZip()
    });
    await page.getByRole('button', { name: 'Analyse solution', exact: true }).click();

    await expect(page.getByRole('status')).toContainText('Power Platform solution import preflight generated successfully.');
    await expect(page.locator('#solutionImportPreflightOutput')).toHaveValue(/^# Power Platform solution import preflight/);
  } finally {
    await page.context().setOffline(false);
  }
});

test('loads the Markdown preview inspector offline', async ({ page }) => {
  await primeOfflineApp(page);
  await page.context().setOffline(true);

  try {
    await page.goto('/#markdown-preview-inspector');

    await expect(page).toHaveURL(/#markdown-workbench$/);
    await expect(page.getByRole('heading', { name: 'Markdown Workbench' })).toBeVisible();
    await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Preview');
    await page.getByLabel('Markdown input').fill([
      '# Offline notes',
      '',
      '```mermaid',
      'flowchart TD',
      '  Cached --> Preview',
      '```'
    ].join('\n'));
    await page.getByRole('button', { name: 'Render Markdown', exact: true }).click();

    await expect(page.locator('#markdownPreview h1')).toHaveText('Offline notes');
    await expect(page.locator('#markdownPreview .markdown-mermaid-block svg')).toBeVisible();
  } finally {
    await page.context().setOffline(false);
  }
});

test('loads the Markdown table formatter offline', async ({ page }) => {
  await primeOfflineApp(page);
  await page.context().setOffline(true);

  try {
    await page.goto('/#markdown-table-formatter');

    await expect(page).toHaveURL(/#markdown-workbench\/tables$/);
    await expect(page.getByRole('heading', { name: 'Markdown Workbench' })).toBeVisible();
    await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Tables');
    await page.getByLabel('Markdown table input').fill([
      '| Name | Count |',
      '| --- | ---: |',
      '| Ada | 12 |'
    ].join('\n'));
    await page.getByRole('button', { name: 'Format table', exact: true }).click();

    await expect(page.locator('#markdownTableOutput')).toHaveValue(/Ada/);
    await expect(page.getByRole('status')).toContainText('Markdown table formatted successfully.');
  } finally {
    await page.context().setOffline(false);
  }
});

test('formats FetchXML and builds a Power Pages Liquid block', async ({ page }) => {
  await page.goto('/#fetchxml-liquid-builder');

  const fetchXml = '<fetch><entity name="account"><attribute name="name" /></entity></fetch>';

  await expect(page).toHaveURL(/#power-pages-workbench$/);
  await expect(page.getByRole('heading', { name: 'Power Pages Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('FetchXML');
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

test('hands formatted FetchXML to JSON & Data Workbench as XML', async ({ page }) => {
  await page.goto('/#fetchxml-liquid-builder');
  await expect(page).toHaveURL(/#power-pages-workbench$/);

  const fetchXml = '<fetch><entity name="account"><attribute name="name" /></entity></fetch>';

  await page.getByLabel('FetchXML input').fill(fetchXml);
  await page.getByRole('button', { name: 'Format FetchXML', exact: true }).click();

  await expect(page.locator('#toolHandover')).toContainText('Continue with this XML');
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Explore XML data/ }).click();

  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Explore');
  await expect(page.getByLabel('Input format')).toHaveValue('xml');
  await expect(page.getByLabel('JSON or XML input')).toHaveValue(/<entity name="account">/);

  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.locator('#dataExplorerFormatDetail')).toHaveText('XML');
  await expect(page.locator('#dataExplorerPathDetail')).toHaveText('/fetch');
  await expect(page.locator('#dataExplorerSourceDetail')).toHaveText('1');
  await expect(page.locator('#dataExplorerOutput')).toHaveValue(/"entity\.@name": "account"/);
});

test('extracts FetchXML from generated Liquid blocks for JSON & Data Workbench', async ({ page }) => {
  await page.goto('/#fetchxml-liquid-builder');
  await expect(page).toHaveURL(/#power-pages-workbench$/);

  await page.getByLabel('FetchXML input').fill('<fetch><entity name="account" /></fetch>');
  await page.getByRole('button', { name: 'Build Liquid', exact: true }).click();

  await expect(page.locator('#powerPagesOutputType')).toHaveText('Liquid');
  await expect(page.locator('#toolHandover')).toContainText('Continue with this XML');
  await page.locator('#toolHandover').getByRole('button', { name: /Output: Explore embedded FetchXML/ }).click();

  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Explore');
  await expect(page.getByLabel('Input format')).toHaveValue('xml');
  await expect(page.getByLabel('JSON or XML input')).toHaveValue([
    '<fetch>',
    '  <entity name="account"/>',
    '</fetch>'
  ].join('\n'));
  await expect(page.getByLabel('JSON or XML input')).not.toHaveValue(/{% fetchxml/);
});
