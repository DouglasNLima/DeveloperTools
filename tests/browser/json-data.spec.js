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
test('finds the JSON formatter and processes formatted and minified output', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('JSON');
  await expect(page.locator('[data-tool-id="json-data-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="json-formatter"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="json-diff"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-id="json-schema-validator"]')).toHaveCount(0);
  await page.locator('[data-tool-id="json-data-workbench"]').click();

  await expect(page).toHaveURL(/#json-data-workbench$/);
  await expect(page.getByRole('heading', { name: 'JSON & Data Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Format');
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

test('generates JSON shape and schema output from the JSON formatter', async ({ page }) => {
  await page.goto('/#json-formatter');
  await expect(page).toHaveURL(/#json-data-workbench$/);

  await page.getByLabel('JSON input', { exact: true }).fill(JSON.stringify({
    items: [
      { id: 1, name: 'Alpha', active: true },
      { id: 2, name: 'Beta', tags: ['new'] }
    ]
  }));
  await page.getByRole('button', { name: 'Generate shape/schema', exact: true }).click();

  await expect(page.locator('#jsonOutput')).toHaveValue(/## JSON Shape Contract/);
  await expect(page.locator('#jsonOutput')).toHaveValue(/\$\.items\[\]\.id/);
  await expect(page.locator('#jsonOutput')).toHaveValue(/active, tags/);
  await expect(page.locator('#downloadJsonButton')).toHaveAttribute('download', 'json-shape-contract.md');
  await expect(page.getByRole('status')).toContainText('Markdown contract generated successfully.');

  await page.getByLabel('Shape/schema output').selectOption('schema');
  await page.getByRole('button', { name: 'Generate shape/schema', exact: true }).click();

  await expect(page.locator('#jsonOutput')).toHaveValue(/"\$schema": "https:\/\/json-schema.org\/draft\/2020-12\/schema"/);
  await expect(page.locator('#jsonOutput')).toHaveValue(/"required": \[/);
  await expect(page.locator('#downloadJsonButton')).toHaveAttribute('download', 'json-schema.json');
});

test('searches JSON paths from the JSON formatter', async ({ page }) => {
  await page.goto('/#json-formatter');
  await expect(page).toHaveURL(/#json-data-workbench$/);

  await page.getByLabel('JSON input', { exact: true }).fill(JSON.stringify({
    items: [
      { id: 1, status: 'Active' },
      { id: 2, status: 'Inactive' }
    ],
    meta: {
      statusCode: 200
    }
  }));
  await page.getByLabel('Path search').fill('status');
  await page.getByRole('button', { name: 'Search paths', exact: true }).click();

  await expect(page.locator('#jsonStatusDetail')).toHaveText('Valid');
  await expect(page.locator('#jsonOutput')).toHaveValue(/# JSON path search/);
  await expect(page.locator('#jsonOutput')).toHaveValue(/\$\.items\[0\]\.status/);
  await expect(page.locator('#jsonOutput')).toHaveValue(/\$\.meta\.statusCode/);
  await expect(page.locator('#downloadJsonButton')).toHaveAttribute('download', 'json-path-search.md');
  await expect(page.getByRole('status')).toContainText('3 matches found.');
});

test('syntax highlights structured text areas without changing textarea values', async ({ page }) => {
  await page.goto('/#json-formatter');
  await expect(page).toHaveURL(/#json-data-workbench$/);

  await page.getByLabel('JSON input').fill('{"name":"Ada","active":true}');
  await expect(page.locator('[data-syntax-editor-for="jsonInput"] .syntax-token--key').first()).toHaveText('"name"');
  await expect(page.locator('[data-syntax-editor-for="jsonInput"] .syntax-token--literal').first()).toHaveText('true');
  await page.getByRole('button', { name: 'Format JSON', exact: true }).click();
  await expect(page.locator('[data-syntax-editor-for="jsonOutput"] .syntax-token--key').first()).toHaveText('"name"');
  await expect(page.locator('#jsonOutput')).toHaveValue(/"active": true/);

  await page.goto('/#fetchxml-liquid-builder');
  await expect(page).toHaveURL(/#power-pages-workbench$/);
  await page.getByLabel('FetchXML input').fill('<fetch><entity name="account" /></fetch>');
  await expect(page.locator('[data-syntax-editor-for="fetchXmlInput"] .syntax-token--tag').first()).toHaveText('fetch');
  await expect(page.locator('[data-syntax-editor-for="fetchXmlInput"] .syntax-token--attribute').first()).toHaveText('name');

  await page.goto('/#power-automate-expression-formatter');
  await page.getByLabel('Expression input').fill("@{concat(variables('name'), ' ok')}");
  await expect(page.locator('[data-syntax-editor-for="flowExpressionInput"] .syntax-token--function').first()).toHaveText('concat');
  await expect(page.locator('#flowExpressionInput')).toHaveValue("@{concat(variables('name'), ' ok')}");
});

test('reports JSON formatter validation errors with context', async ({ page }) => {
  await page.goto('/#json-formatter');
  await expect(page).toHaveURL(/#json-data-workbench$/);

  await page.getByRole('button', { name: 'Format JSON', exact: true }).click();

  await expect(page.locator('#jsonStatusDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Enter JSON input.');

  await page.getByLabel('JSON input').fill('{"ok": true,}');
  await page.getByRole('button', { name: 'Format JSON', exact: true }).click();

  await expect(page.locator('#jsonStatusDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('JSON parse error at line');
  await expect(page.locator('#jsonOutput')).toHaveValue(/\^/);
});

test('shows JSON handovers only after compatible output is populated', async ({ page }) => {
  await page.goto('/#json-formatter');
  await expect(page).toHaveURL(/#json-data-workbench$/);

  await expect(page.locator('#toolHandover')).toBeHidden();

  await page.getByLabel('JSON input').fill('{"ok": true,}');
  await page.getByRole('button', { name: 'Format JSON', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('JSON parse error');
  await expect(page.locator('#toolHandover')).toBeHidden();

  await page.getByLabel('JSON input').fill('{"ok":true}');
  await page.getByRole('button', { name: 'Format JSON', exact: true }).click();

  await expect(page.locator('#toolHandover')).toBeVisible();
  await expect(page.locator('#toolHandover')).toContainText('Continue with this JSON');
  await expect(page.locator('#toolHandover').getByRole('button', { name: /Explore JSON records/ })).toBeVisible();
});

test('hands JSON formatter output to the explore mode and restores the breadcrumb state', async ({ page }) => {
  await page.goto('/#json-formatter');
  await expect(page).toHaveURL(/#json-data-workbench$/);

  const records = [
    { name: 'Ada Lovelace', status: 'active' },
    { name: 'Grace Hopper', status: 'active' }
  ];
  const inputJson = JSON.stringify(records);

  await page.getByLabel('JSON input').fill(inputJson);
  await page.getByRole('button', { name: 'Format JSON', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Explore JSON records/ }).click();

  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Explore');
  await expect(page.getByLabel('Input format')).toHaveValue('json');
  await expect(page.getByLabel('JSON or XML input')).toHaveValue(JSON.stringify(records, null, 2));

  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.locator('#dataExplorerSourceDetail')).toHaveText('2');

  await expect(page.locator('#handoverTrail')).toContainText('JSON & Data Workbench');
  await page.locator('#handoverTrail').getByRole('button', { name: 'JSON & Data Workbench' }).click();

  await expect(page).toHaveURL(/#json-data-workbench$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Format');
  await expect(page.getByLabel('JSON input')).toHaveValue(inputJson);
  await expect(page.locator('#jsonOutput')).toHaveValue(JSON.stringify(records, null, 2));
});

test('hands generated JSON Schema to the schema validator input', async ({ page }) => {
  await page.goto('/#json-formatter');
  await expect(page).toHaveURL(/#json-data-workbench$/);

  await page.getByLabel('JSON input').fill('{"name":"Ada","active":true}');
  await page.getByLabel('Shape/schema output').selectOption('schema');
  await page.getByRole('button', { name: 'Generate shape/schema', exact: true }).click();

  await expect(page.locator('#toolHandover').getByRole('button', { name: /Use as JSON Schema/ })).toBeVisible();
  await page.locator('#toolHandover').getByRole('button', { name: /Use as JSON Schema/ }).click();

  await expect(page).toHaveURL(/#json-data-workbench\/schema$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Schema');
  await expect(page.getByLabel('JSON Schema input')).toHaveValue(/"\$schema": "https:\/\/json-schema.org\/draft\/2020-12\/schema"/);
  await expect(page.getByLabel('JSON Schema input')).toHaveValue(/"required": \[/);
  await expect(page.getByLabel('JSON input', { exact: true })).toHaveValue('');
});

test('hands CSV JSON output to JSON & Data Workbench explore mode', async ({ page }) => {
  await page.goto('/#csv-tsv-helper');

  await page.getByLabel('CSV/TSV input').fill('name,email\nAda Lovelace,ada@example.test\nGrace Hopper,grace@example.test');
  await page.getByRole('button', { name: 'Process data', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Explore JSON records/ }).click();

  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Explore');
  await expect(page.getByLabel('Input format')).toHaveValue('json');
  await expect(page.getByLabel('JSON or XML input')).toHaveValue(/"name": "Ada Lovelace"/);

  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.locator('#dataExplorerSourceDetail')).toHaveText('2');
});

test('hands decoded JWT payload to JSON & Data Workbench format mode', async ({ page }) => {
  await page.goto('/#jwt-decoder');

  await page.getByLabel('JWT input').fill(makeJwt({
    sub: 'user-123',
    roles: ['admin'],
    active: true
  }));
  await page.getByRole('button', { name: 'Decode JWT', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Decoded payload: Format JSON/ }).click();

  await expect(page).toHaveURL(/#json-data-workbench$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Format');
  await expect(page.getByLabel('JSON input')).toHaveValue(/"sub": "user-123"/);
  await expect(page.getByLabel('JSON input')).toHaveValue(/"roles": \[/);
});

test('hands decoded JWT header to JSON & Data Workbench format mode', async ({ page }) => {
  await page.goto('/#jwt-decoder');

  await page.getByLabel('JWT input').fill(makeJwt({
    sub: 'user-123'
  }, {
    alg: 'RS256',
    typ: 'JWT',
    kid: 'key-1'
  }));
  await page.getByRole('button', { name: 'Decode JWT', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /Decoded header: Format JSON/ }).click();

  await expect(page).toHaveURL(/#json-data-workbench$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Format');
  await expect(page.getByLabel('JSON input')).toHaveValue(/"alg": "RS256"/);
  await expect(page.getByLabel('JSON input')).toHaveValue(/"kid": "key-1"/);
  await expect(page.getByLabel('JSON input')).not.toHaveValue(/"sub": "user-123"/);
});

test('generates JSON structural diff reports', async ({ page }) => {
  await page.goto('/#json-diff');

  await expect(page).toHaveURL(/#json-data-workbench\/diff$/);
  await expect(page.getByRole('heading', { name: 'JSON & Data Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Compare');
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
  await expect(page).toHaveURL(/#json-data-workbench\/diff$/);

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

test('validates JSON against a JSON Schema with path-level errors', async ({ page }) => {
  await page.goto('/#json-schema-validator');

  await expect(page).toHaveURL(/#json-data-workbench\/schema$/);
  await expect(page.getByRole('heading', { name: 'JSON & Data Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Schema');
  await page.getByLabel('JSON input', { exact: true }).fill(JSON.stringify({
    items: [
      {
        id: 1,
        active: 'yes',
        extra: true
      }
    ]
  }));
  await page.getByLabel('JSON Schema input').fill(JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'active'],
          additionalProperties: false,
          properties: {
            id: { type: 'integer' },
            active: { type: 'boolean' }
          }
        }
      }
    }
  }));
  await page.getByRole('button', { name: 'Validate JSON', exact: true }).click();

  await expect(page.locator('#jsonSchemaValidationStatusDetail')).toHaveText('Invalid');
  await expect(page.locator('#jsonSchemaErrorCountDetail')).toHaveText('2');
  await expect(page.locator('#jsonSchemaWarningCountDetail')).toHaveText('0');
  await expect(page.locator('#jsonSchemaDraftDetail')).toHaveText('Draft 2020-12');
  await expect(page.locator('#jsonSchemaValidatorOutput')).toHaveValue(/### \$\.items\[0\]\.active/);
  await expect(page.locator('#jsonSchemaValidatorOutput')).toHaveValue(/Additional property "extra" is not allowed/);
  await expect(page.getByRole('status')).toContainText('JSON does not match the schema.');
  await expect(page.locator('#downloadJsonSchemaReportButton')).toHaveAttribute('download', 'json-schema-validation.md');

  await page.getByLabel('Output format').selectOption('json');
  await page.getByRole('button', { name: 'Validate JSON', exact: true }).click();

  await expect(page.locator('#jsonSchemaValidatorOutput')).toHaveValue(/"instancePath": "\$\.items\[0\]\.active"/);
  await expect(page.locator('#downloadJsonSchemaReportButton')).toHaveAttribute('download', 'json-schema-validation.json');

  await page.getByLabel('JSON input').fill(JSON.stringify({
    items: [
      {
        id: 1,
        active: true
      }
    ]
  }));
  await page.getByRole('button', { name: 'Validate JSON', exact: true }).click();

  await expect(page.locator('#jsonSchemaValidationStatusDetail')).toHaveText('Valid');
  await expect(page.locator('#jsonSchemaErrorCountDetail')).toHaveText('0');
  await expect(page.getByRole('status')).toContainText('JSON matches the schema.');
});

test('reports JSON Schema validator parsing errors and schema warnings', async ({ page }) => {
  await page.goto('/#json-schema-validator');
  await expect(page).toHaveURL(/#json-data-workbench\/schema$/);

  await page.getByRole('button', { name: 'Validate JSON', exact: true }).click();

  await expect(page.locator('#jsonSchemaValidationStatusDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('JSON input: Enter JSON input.');

  await page.getByLabel('JSON input', { exact: true }).fill('"ada@example.test"');
  await page.getByLabel('JSON Schema input').fill('{"$ref":"https://example.test/schema.json","format":"email"}');
  await page.getByRole('button', { name: 'Validate JSON', exact: true }).click();

  await expect(page.locator('#jsonSchemaValidationStatusDetail')).toHaveText('Invalid');
  await expect(page.locator('#jsonSchemaErrorCountDetail')).toHaveText('1');
  await expect(page.locator('#jsonSchemaWarningCountDetail')).toHaveText('2');
  await expect(page.locator('#jsonSchemaValidatorOutput')).toHaveValue(/Remote \$ref values are not supported/);

  await page.getByLabel('JSON Schema input').fill('{bad schema}');
  await page.getByRole('button', { name: 'Validate JSON', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('JSON Schema input: JSON parse error');
  await expect(page.locator('#jsonSchemaValidatorOutput')).toHaveValue(/\^/);
});

test('finds JSON & Data Workbench explore mode and queries JSON records', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('data explorer');
  await expect(page.locator('[data-tool-id="json-data-workbench"]')).toBeEnabled();
  await expect(page.locator('[data-tool-id="data-explorer"]')).toHaveCount(0);
  await page.locator('[data-tool-id="json-data-workbench"]').click();
  await page.locator('.tool-workbench-tab').filter({ hasText: 'Explore' }).click();

  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);
  await expect(page.getByRole('heading', { name: 'JSON & Data Workbench' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Explore');
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
  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);

  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Enter JSON or XML input before exploring data.');

  await page.getByLabel('Input format').selectOption('json');
  await page.getByLabel('JSON or XML input').fill('{bad json}');
  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('JSON parse error');

  await page.getByLabel('JSON or XML input').fill('{"name":"Ada"}');
  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No JSON record array was found automatically');

  await page.getByLabel('Input format').selectOption('xml');
  await page.getByLabel('Record path').fill('/contacts/account');
  await page.getByLabel('JSON or XML input').fill('<contacts><contact /></contacts>');
  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('XML record path /contacts/account did not match any elements');
});

test('filters XML data into a grid and JSON export', async ({ page }) => {
  await page.goto('/#data-explorer');
  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);

  await page.getByLabel('Input format').selectOption('xml');
  await page.getByLabel('Record path').fill('/contacts/contact');
  await page.getByLabel('JSON or XML input').fill([
    '<contacts>',
    '  <contact id="1"><name>Ada Lovelace</name><status>active</status><age>36</age><address><city>London</city></address></contact>',
    '  <contact id="2"><name>Grace Hopper</name><status>active</status><age>85</age><address><city>Arlington</city></address></contact>',
    '  <contact id="3"><name>Katherine Johnson</name><status>retired</status><age>101</age><address><city>Hampton</city></address></contact>',
    '</contacts>'
  ].join('\n'));
  await page.getByLabel('Filter field').fill('status');
  await page.getByLabel('Filter operator').selectOption('equals');
  await page.getByLabel('Filter value').fill('active');
  await page.getByLabel('Sort field').fill('age');
  await page.getByLabel('Sort direction').selectOption('desc');
  await page.getByLabel('Result limit').fill('1');
  await page.getByLabel('Grid columns').fill('@id, name, address.city');
  await page.getByRole('button', { name: 'Explore data', exact: true }).click();

  await expect(page.locator('#dataExplorerFormatDetail')).toHaveText('XML');
  await expect(page.locator('#dataExplorerPathDetail')).toHaveText('/contacts/contact');
  await expect(page.locator('#dataExplorerSourceDetail')).toHaveText('3');
  await expect(page.locator('#dataExplorerResultsDetail')).toHaveText('1');
  await expect(page.locator('#dataExplorerWarningsDetail')).toHaveText('1 warning');
  await expect(page.locator('#dataExplorerQueryModeDetail')).toHaveText('XML filters');
  await expect(page.locator('.data-grid-table thead')).toContainText('@id');
  await expect(page.locator('.data-grid-table thead')).toContainText('address.city');
  await expect(page.locator('.data-grid-table tbody')).toContainText('Grace Hopper');
  await expect(page.locator('.data-grid-table tbody')).not.toContainText('Ada Lovelace');
  await expect(page.locator('#dataExplorerOutput')).toHaveValue(/"@id": "2"/);
  await expect(page.locator('#dataExplorerOutput')).toHaveValue(/"address.city": "Arlington"/);
  await expect(page.locator('#dataExplorerOutput')).not.toHaveValue(/Katherine Johnson/);
  await expect(page.locator('#downloadDataExplorerButton')).toHaveAttribute('download', 'data-explorer-output.json');
  await expect(page.getByRole('status')).toContainText('XML data explored successfully. Result limit applied');
});

test('hands JSON & Data Workbench explorer output to text diff', async ({ page }) => {
  await page.goto('/#data-explorer');
  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);

  await page.getByLabel('Input format').selectOption('xml');
  await page.getByLabel('JSON or XML input').fill([
    '<contacts>',
    '  <contact id="1"><name>Ada Lovelace</name></contact>',
    '  <contact id="2"><name>Grace Hopper</name></contact>',
    '</contacts>'
  ].join('\n'));
  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /JSON output: Compare as left text/ }).click();

  await expect(page).toHaveURL(/#text-utilities-workbench\/diff$/);
  await expect(page.getByLabel('Left text')).toHaveValue(/"@id": "1"/);
  await expect(page.getByLabel('Left text')).toHaveValue(/"name": "Ada Lovelace"/);
  await expect(page.getByLabel('Right text')).toHaveValue('');
});

test('hands JSON & Data Workbench explorer output to the CSV helper', async ({ page }) => {
  await page.goto('/#data-explorer');
  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);

  await page.getByLabel('Input format').selectOption('json');
  await page.getByLabel('JSON or XML input').fill(JSON.stringify([
    { name: 'Ada Lovelace', status: 'active' },
    { name: 'Grace Hopper', status: 'active' }
  ]));
  await page.getByRole('button', { name: 'Explore data', exact: true }).click();
  await page.locator('#toolHandover').getByRole('button', { name: /JSON output: Convert to CSV/ }).click();

  await expect(page).toHaveURL(/#csv-tsv-helper$/);
  await expect(page.getByLabel('Delimiter')).toHaveValue('comma');
  await expect(page.getByLabel('Output format')).toHaveValue('csv');
  await expect(page.getByLabel('First row contains headers')).toBeChecked();
  await expect(page.getByLabel('CSV/TSV input')).toHaveValue([
    'name,status',
    'Ada Lovelace,active',
    'Grace Hopper,active'
  ].join('\n'));

  await page.getByRole('button', { name: 'Process data', exact: true }).click();
  await expect(page.locator('#csvOutputTypeDetail')).toHaveText('CSV');
  await expect(page.locator('#csvOutput')).toHaveValue(/name,status/);
  await expect(page.locator('#csvOutput')).toHaveValue(/Grace Hopper,active/);
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
  await expect(page.locator('#csvFileDropZone .drop-zone-label span')).toHaveText('contacts.csv');
  await expect(page.locator('#csvFileDropZone .drop-zone-label small')).toContainText('Loaded successfully');
  await expect(page.getByRole('status')).toContainText('Loaded contacts.csv.');

  await page.getByLabel('Output format').selectOption('tsv');
  await page.getByRole('button', { name: 'Process data', exact: true }).click();

  await expect(page.locator('#csvDelimiterDetail')).toHaveText('Comma (,) detected');
  await expect(page.locator('#csvEmptyCellsDetail')).toHaveText('2');
  await expect(page.locator('#csvInconsistentRowsDetail')).toHaveText('1');
  await expect(page.locator('#csvWarningsDetail')).toHaveText('4 warnings');
  await expect(page.locator('#csvIssueList')).toContainText('unexpected column count');
  await expect(page.locator('#csvIssueList')).toContainText('Duplicate headers found: name.');
  await expect(page.locator('#csvIssueList')).toContainText('name_2');
  await expect(page.locator('#csvOutputTypeDetail')).toHaveText('TSV');
  await expect(page.locator('#csvOutput')).toHaveValue(/name\tname\t/);
  await expect(page.locator('#downloadCsvButton')).toHaveAttribute('download', 'contacts.tsv');
});
