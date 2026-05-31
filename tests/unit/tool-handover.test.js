import test from 'node:test';
import assert from 'node:assert/strict';

import { TOOL_CATALOGUE } from '../../src/tools/catalog.js';
import {
  TOOL_HANDOVER_ROUTES,
  TOOL_INTEGRATION_CONTRACTS
} from '../../src/tools/integration-contracts.js';
import {
  analyseHandoverValue,
  analyseJsonHandoverValue,
  applyHandoverPayload,
  resolveHandoverSuggestions,
  restoreToolState,
  serialiseToolState,
  transformHandoverValue,
  validateIntegrationContracts
} from '../../src/tools/tool-handover.js';

test('validates handover contracts against the tool catalogue', () => {
  const result = validateIntegrationContracts({
    toolIds: TOOL_CATALOGUE.map(tool => tool.id)
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'json-data-workbench'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'json-formatter'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'url-codec'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'regex-tester'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'text-diff'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'support-pack-sanitiser'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'image-ocr'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'base64-file-converter'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'file-to-base64'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'web-api-workbench'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'curl-fetch-converter'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'dataverse-odata-query-builder'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'csv-tsv-helper'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-pages-workbench'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-pages-web-api-snippets'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'fetchxml-liquid-builder'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'pdf-template-field-explorer'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-platform-cli-command-builder'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'solution-package-inspector'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-platform-solution-mermaid'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-platform-solution-import-preflight'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-platform-solution-docs'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-automate-expression-formatter'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-fx-snippet-formatter'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'model-driven-javascript-workbench'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'model-driven-solution-inspector'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'mermaid-studio'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'mermaid-editor'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'mermaid-template-builder'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'data-to-mermaid'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'api-workflow-to-mermaid'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'markdown-workbench'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'markdown-preview-inspector'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'markdown-table-formatter'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'text-utilities-workbench'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetInputId === 'schema'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'jwt-decoder' && route.sourceOutputId === 'header'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'web-api-workbench' && route.sourceOutputId === 'jwt-header'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'support-pack-sanitiser' && route.targetToolId === 'regex-tester'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'text-utilities-workbench' && route.sourceOutputId === 'sanitised-output' && route.targetToolId === 'text-utilities-workbench' && route.targetMode === 'regex'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'text-utilities-workbench' && route.sourceOutputId === 'case-output' && route.targetToolId === 'text-utilities-workbench' && route.targetMode === 'diff'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'image-ocr' && route.targetToolId === 'text-utilities-workbench' && route.targetMode === 'regex'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'image-ocr' && route.targetToolId === 'text-utilities-workbench' && route.targetMode === 'sanitise'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'image-ocr' && route.targetToolId === 'text-utilities-workbench' && route.targetMode === 'diff'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'image-ocr' && route.targetToolId === 'support-pack-sanitiser'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'base64-file-converter' && route.targetToolId === 'base64-file-converter' && route.targetMode === 'base64-to-file'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'file-to-base64' && route.targetToolId === 'base64-to-file'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'curl-fetch-converter' && route.targetToolId === 'support-pack-sanitiser'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'web-api-workbench' && route.sourceOutputId === 'request-output' && route.targetToolId === 'support-pack-sanitiser'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'web-api-workbench' && route.sourceOutputId === 'request-output' && route.targetToolId === 'mermaid-studio' && route.targetMode === 'api-workflow'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'dataverse-odata-query-builder' && route.targetToolId === 'web-api-workbench' && route.targetMode === 'request' && route.transform === 'extract-fenced-fetch'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'dataverse-odata-query-builder' && route.targetToolId === 'curl-fetch-converter' && route.transform === 'extract-fenced-fetch'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'dataverse-odata-query-builder' && route.targetToolId === 'url-codec' && route.transform === 'extract-odata-endpoint'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'dataverse-odata-query-builder' && route.targetToolId === 'support-pack-sanitiser'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-pages-workbench' && route.sourceOutputId === 'web-api-output' && route.targetToolId === 'curl-fetch-converter' && route.transform === 'safeajax-to-fetch'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-pages-workbench' && route.sourceOutputId === 'web-api-output' && route.targetToolId === 'web-api-workbench' && route.targetMode === 'request' && route.transform === 'safeajax-to-fetch'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-pages-workbench' && route.sourceOutputId === 'web-api-output' && route.targetToolId === 'url-codec' && route.transform === 'extract-webapi-endpoint'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-pages-web-api-snippets' && route.targetToolId === 'curl-fetch-converter' && route.transform === 'safeajax-to-fetch'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-pages-web-api-snippets' && route.targetToolId === 'web-api-workbench' && route.targetMode === 'request' && route.transform === 'safeajax-to-fetch'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-pages-web-api-snippets' && route.targetToolId === 'url-codec' && route.transform === 'extract-webapi-endpoint'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'data-explorer' && route.targetToolId === 'csv-tsv-helper' && route.transform === 'json-records-to-csv'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'pdf-template-field-explorer' && route.targetToolId === 'csv-tsv-helper' && route.transform === 'pdf-fields-to-csv'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'data-explorer' && route.targetToolId === 'text-diff'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetToolId === 'json-data-workbench' && route.targetMode === 'format'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetToolId === 'json-data-workbench' && route.targetMode === 'diff'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetToolId === 'json-data-workbench' && route.targetMode === 'schema'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetToolId === 'json-data-workbench' && route.targetMode === 'explore'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-pages-workbench' && route.sourceOutputId === 'fetchxml-output' && route.targetToolId === 'json-data-workbench' && route.targetInputId === 'explore-xml' && route.targetMode === 'explore'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-pages-workbench' && route.sourceOutputId === 'fetchxml-text-output' && route.transform === 'extract-liquid-fetchxml'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'fetchxml-liquid-builder' && route.targetToolId === 'json-data-workbench' && route.targetInputId === 'explore-xml' && route.targetMode === 'explore'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'fetchxml-liquid-builder' && route.transform === 'extract-liquid-fetchxml'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-platform-cli-command-builder' && route.targetToolId === 'text-diff'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'solution-package-inspector' && route.sourceOutputId === 'mermaid' && route.targetToolId === 'mermaid-studio' && route.targetMode === 'editor'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'solution-package-inspector' && route.sourceOutputId === 'inventory' && route.targetToolId === 'markdown-workbench' && route.targetMode === 'preview'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'solution-package-inspector' && route.sourceOutputId === 'preflight' && route.targetToolId === 'markdown-workbench' && route.targetMode === 'preview'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'solution-package-inspector' && route.sourceOutputId === 'documentation' && route.targetToolId === 'markdown-workbench' && route.targetMode === 'preview'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-platform-solution-mermaid' && route.targetToolId === 'mermaid-studio' && route.targetMode === 'editor'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-platform-solution-mermaid' && route.sourceOutputId === 'inventory' && route.targetToolId === 'markdown-workbench' && route.targetMode === 'preview'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-platform-solution-import-preflight' && route.sourceOutputId === 'preflight' && route.targetToolId === 'markdown-workbench' && route.targetMode === 'preview'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-platform-solution-docs' && route.sourceOutputId === 'documentation' && route.targetToolId === 'markdown-workbench' && route.targetMode === 'preview'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-automate-expression-formatter' && route.targetToolId === 'text-diff'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-fx-snippet-formatter' && route.targetToolId === 'text-diff'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'model-driven-javascript-workbench' && route.sourceOutputId === 'review-report' && route.targetToolId === 'markdown-workbench' && route.targetMode === 'preview'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'model-driven-javascript-workbench' && route.sourceOutputId === 'review-rule-summary' && route.targetToolId === 'json-data-workbench' && route.targetMode === 'format'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'model-driven-javascript-workbench' && route.sourceOutputId === 'web-api-output' && route.targetToolId === 'mermaid-studio' && route.targetMode === 'api-workflow'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'model-driven-solution-inspector' && route.sourceOutputId === 'events' && route.targetToolId === 'markdown-workbench' && route.targetMode === 'preview'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'model-driven-solution-inspector' && route.sourceOutputId === 'dependency-report' && route.targetToolId === 'markdown-workbench' && route.targetMode === 'preview'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'model-driven-solution-inspector' && route.sourceOutputId === 'mermaid' && route.targetToolId === 'mermaid-studio' && route.targetMode === 'editor'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetToolId === 'mermaid-studio' && route.targetMode === 'data'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetToolId === 'mermaid-studio' && route.targetMode === 'editor' && route.transform === 'json-to-mermaid-tree'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetToolId === 'mermaid-studio' && route.targetMode === 'editor' && route.transform === 'request-to-mermaid-sequence'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'mermaid-studio' && route.sourceOutputId === 'template-output' && route.targetToolId === 'mermaid-studio' && route.targetMode === 'editor'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'mermaid-editor' && route.targetToolId === 'text-diff'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetToolId === 'markdown-preview-inspector'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'markdown-preview-inspector' && route.targetToolId === 'mermaid-studio' && route.targetMode === 'editor'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetToolId === 'markdown-table-formatter'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'markdown-table-formatter' && route.targetToolId === 'csv-tsv-helper'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetToolId === 'markdown-workbench' && route.targetMode === 'preview'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetToolId === 'markdown-workbench' && route.targetMode === 'tables'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'markdown-workbench' && route.targetToolId === 'mermaid-studio' && route.targetMode === 'editor'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'markdown-workbench' && route.targetToolId === 'csv-tsv-helper'));
});

test('transforms targeted handover payloads before suggestions are shown', () => {
  const fetchReport = [
    '# Dataverse OData query',
    '',
    '```js',
    'const response = await fetch("/api/data/v9.2/accounts", {',
    '  method: "GET"',
    '});',
    '```'
  ].join('\n');
  const fetch = transformHandoverValue(fetchReport, 'extract-fenced-fetch');

  assert.equal(fetch.valid, true);
  assert.equal(fetch.kind, 'text');
  assert.equal(fetch.rawValue, [
    'const response = await fetch("/api/data/v9.2/accounts", {',
    '  method: "GET"',
    '});'
  ].join('\n'));

  const liquid = [
    '{% fetchxml accounts %}',
    '<fetch>',
    '  <entity name="account"/>',
    '</fetch>',
    '{% endfetchxml %}'
  ].join('\n');
  const fetchXml = transformHandoverValue(liquid, 'extract-liquid-fetchxml');

  assert.equal(fetchXml.valid, true);
  assert.equal(fetchXml.kind, 'xml');
  assert.equal(fetchXml.rawValue, [
    '<fetch>',
    '  <entity name="account"/>',
    '</fetch>'
  ].join('\n'));

  assert.deepEqual(transformHandoverValue('# no code block', 'extract-fenced-fetch'), {
    valid: false,
    reason: 'empty-transform'
  });
  assert.deepEqual(transformHandoverValue(liquid, 'missing-transform'), {
    valid: false,
    reason: 'unsupported-transform'
  });

  const endpoint = transformHandoverValue('Endpoint: /api/data/v9.2/accounts?$select=name&$top=5', 'extract-odata-endpoint');
  assert.equal(endpoint.valid, true);
  assert.equal(endpoint.rawValue, '/api/data/v9.2/accounts?$select=name&$top=5');

  const webApiEndpoint = transformHandoverValue('// Endpoint: /_api/accounts?$select=name&$top=5', 'extract-webapi-endpoint');
  assert.equal(webApiEndpoint.valid, true);
  assert.equal(webApiEndpoint.rawValue, '/_api/accounts?$select=name&$top=5');

  const safeAjax = transformHandoverValue([
    '// Endpoint: /_api/accounts',
    'webapi.safeAjax({',
    '  type: "POST",',
    '  url: "/_api/accounts",',
    '  headers: {',
    '    "Accept": "application/json",',
    '    "OData-MaxVersion": "4.0",',
    '    "OData-Version": "4.0"',
    '  },',
    '  contentType: "application/json",',
    '  data: JSON.stringify({',
    '    "name": "Contoso"',
    '  }),',
    '  success: function(data) {',
    '    console.log(data);',
    '  },',
    '  error: function(xhr) {',
    '    console.error(xhr);',
    '  }',
    '});'
  ].join('\n'), 'safeajax-to-fetch');
  assert.equal(safeAjax.valid, true);
  assert.equal(safeAjax.kind, 'text');
  assert.match(safeAjax.rawValue, /^const response = await fetch\("\/_api\/accounts"/);
  assert.match(safeAjax.rawValue, /method: "POST"/);
  assert.match(safeAjax.rawValue, /"Content-Type": "application\/json"/);
  assert.match(safeAjax.rawValue, /body: JSON\.stringify\(\{/);
  assert.match(safeAjax.rawValue, /"name": "Contoso"/);

  const csv = transformHandoverValue(JSON.stringify([
    { name: 'Ada Lovelace', status: 'active' },
    { name: 'Grace, Hopper', status: 'active' }
  ]), 'json-records-to-csv');
  assert.equal(csv.valid, true);
  assert.equal(csv.rawValue, [
    'name,status',
    'Ada Lovelace,active',
    '"Grace, Hopper",active'
  ].join('\n'));

  assert.deepEqual(transformHandoverValue('{"name":"Ada"}', 'json-records-to-csv'), {
    valid: false,
    reason: 'empty-transform'
  });

  const pdfFieldsCsv = transformHandoverValue(JSON.stringify({
    fileName: 'template.pdf',
    pageCount: 1,
    fieldCount: 1,
    fields: [
      {
        page: 1,
        name: 'customer,name',
        type: 'Tx',
        value: 'Contoso',
        defaultValue: '',
        alternativeText: 'Customer name',
        rect: {
          pdf: {
            x1: 10,
            y1: 20,
            x2: 210,
            y2: 40
          },
          viewport: {
            x: 10.12,
            y: 20.11,
            width: 200.86,
            height: 20.35
          }
        },
        rawAnnotationId: 'field-1'
      }
    ]
  }), 'pdf-fields-to-csv');
  assert.equal(pdfFieldsCsv.valid, true);
  assert.equal(pdfFieldsCsv.kind, 'text');
  assert.equal(pdfFieldsCsv.rawValue, [
    'Page,Name,Type,Value,DefaultValue,AlternativeText,PdfX1,PdfY1,PdfX2,PdfY2,ViewportX,ViewportY,ViewportWidth,ViewportHeight,RawAnnotationId',
    '1,"customer,name",Tx,Contoso,,Customer name,10,20,210,40,10.12,20.11,200.86,20.35,field-1'
  ].join('\n'));

  assert.deepEqual(transformHandoverValue('{"fields":[]}', 'pdf-fields-to-csv'), {
    valid: false,
    reason: 'empty-transform'
  });

  const mermaidTree = transformHandoverValue('{"name":"Ada"}', 'json-to-mermaid-tree');
  assert.equal(mermaidTree.valid, true);
  assert.equal(mermaidTree.kind, 'mermaid');
  assert.match(mermaidTree.rawValue, /^flowchart TD/);

  const mermaidSequence = transformHandoverValue('// Endpoint: /_api/accounts?$select=name', 'request-to-mermaid-sequence');
  assert.equal(mermaidSequence.valid, true);
  assert.equal(mermaidSequence.kind, 'mermaid');
  assert.match(mermaidSequence.rawValue, /^sequenceDiagram/);

  const mermaidFence = transformHandoverValue('```mermaid\nflowchart TD\n  A --> B\n```', 'extract-mermaid-fence');
  assert.equal(mermaidFence.valid, true);
  assert.equal(mermaidFence.rawValue, 'flowchart TD\n  A --> B');

  const markdownTable = transformHandoverValue('| Name | Count |\n| --- | --- |\n| Ada | 12 |', 'require-markdown-table');
  assert.equal(markdownTable.valid, true);
  assert.equal(markdownTable.kind, 'text');
  assert.match(markdownTable.rawValue, /^\| Name \| Count \|/);

  assert.deepEqual(transformHandoverValue('# no table', 'require-markdown-table'), {
    valid: false,
    reason: 'empty-transform'
  });
});

test('detects populated JSON, invalid JSON and JSON Schema payloads', () => {
  assert.deepEqual(analyseJsonHandoverValue(''), {
    valid: false,
    reason: 'empty'
  });
  assert.deepEqual(analyseJsonHandoverValue('{bad json}'), {
    valid: false,
    reason: 'invalid-json'
  });

  const json = analyseJsonHandoverValue('{"name":"Ada"}');
  assert.equal(json.valid, true);
  assert.equal(json.kind, 'json');

  const schema = analyseJsonHandoverValue(JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }));
  assert.equal(schema.valid, true);
  assert.equal(schema.kind, 'json-schema');
});

test('detects populated text, Base64 and XML handover values', () => {
  assert.deepEqual(analyseHandoverValue('', 'text'), {
    valid: false,
    reason: 'empty'
  });

  const text = analyseHandoverValue('  plain text  ', 'text');
  assert.equal(text.valid, true);
  assert.equal(text.kind, 'text');
  assert.equal(text.rawValue, '  plain text  ');

  const base64 = analyseHandoverValue('data:text/plain;base64,aGVsbG8=', 'base64');
  assert.equal(base64.valid, true);
  assert.equal(base64.kind, 'base64');
  assert.equal(base64.rawValue, 'data:text/plain;base64,aGVsbG8=');

  assert.deepEqual(analyseHandoverValue('not valid !', 'base64'), {
    valid: false,
    reason: 'invalid-base64'
  });

  const xml = analyseHandoverValue('  <fetch><entity name="account"/></fetch>  ', 'xml');
  assert.equal(xml.valid, true);
  assert.equal(xml.kind, 'xml');
  assert.equal(xml.rawValue, '<fetch><entity name="account"/></fetch>');

  assert.deepEqual(analyseHandoverValue('{% fetchxml accounts %}<fetch />{% endfetchxml %}', 'xml'), {
    valid: false,
    reason: 'invalid-xml'
  });

  assert.deepEqual(analyseHandoverValue('<fetch><entity></fetch>', 'xml'), {
    valid: false,
    reason: 'invalid-xml'
  });

  const mermaid = analyseHandoverValue('```mermaid\nflowchart TD\n  A --> B\n```', 'mermaid');
  assert.equal(mermaid.valid, true);
  assert.equal(mermaid.kind, 'mermaid');
  assert.equal(mermaid.rawValue, 'flowchart TD\n  A --> B');

  assert.deepEqual(analyseHandoverValue('not a diagram', 'mermaid'), {
    valid: false,
    reason: 'invalid-mermaid'
  });
});

test('resolves suggestions only for compatible populated outputs', () => {
  const root = createRoot([
    createControl({ id: 'jsonOutput', tagName: 'TEXTAREA', value: '{"items":[{"name":"Ada"}]}' })
  ]);
  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'json-data-workbench',
    root,
    availableTools: ['json-data-workbench']
  });

  assert.ok(suggestions.some(suggestion => suggestion.label === 'Explore JSON records'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Compare as left JSON'));
  assert.equal(suggestions.find(suggestion => suggestion.label === 'Explore JSON records').targetMode, 'explore');
  assert.equal(suggestions.find(suggestion => suggestion.label === 'Compare as left JSON').targetMode, 'diff');
  assert.ok(!suggestions.some(suggestion => suggestion.label === 'Use as JSON Schema'));

  root.controls[0].value = '# Markdown report';
  assert.deepEqual(resolveHandoverSuggestions({
    sourceToolId: 'json-data-workbench',
    root,
    availableTools: ['json-data-workbench']
  }), []);
});

test('preserves target modes on handover suggestions', () => {
  const root = createRoot([
    createControl({ id: 'sourceOutput', tagName: 'TEXTAREA', value: 'plain text' })
  ]);
  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'source-tool',
    root,
    availableTools: ['target-workbench'],
    contracts: [
      {
        toolId: 'source-tool',
        outputs: [
          {
            id: 'output',
            selector: '#sourceOutput',
            label: 'Output',
            kind: 'text'
          }
        ],
        inputs: []
      },
      {
        toolId: 'target-workbench',
        outputs: [],
        inputs: [
          {
            id: 'input',
            selector: '#targetInput',
            label: 'Target input',
            kind: 'text'
          }
        ]
      }
    ],
    routes: [
      {
        id: 'source-output-to-target-mode',
        sourceToolId: 'source-tool',
        sourceOutputId: 'output',
        targetToolId: 'target-workbench',
        targetMode: 'review',
        targetInputId: 'input',
        label: 'Review text',
        description: 'Open the target workbench review mode.',
        acceptKinds: ['text']
      }
    ]
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].targetMode, 'review');
});

test('resolves suggestions for additional JSON report sources', () => {
  for (const [toolId, outputId] of [
    ['url-codec', 'urlOutput'],
    ['text-utilities-workbench', 'regexOutput'],
    ['text-utilities-workbench', 'textDiffOutput'],
    ['regex-tester', 'regexOutput'],
    ['text-diff', 'textDiffOutput'],
    ['web-api-workbench', 'jwtHeaderOutput'],
    ['web-api-workbench', 'jwtPayloadOutput'],
    ['jwt-decoder', 'jwtHeaderOutput'],
    ['pdf-template-field-explorer', 'pdfFieldsJsonOutput'],
    ['model-driven-javascript-workbench', 'modelDrivenJsReviewOutput']
  ]) {
    const root = createRoot([
      createControl({ id: outputId, tagName: 'TEXTAREA', value: '{"ok":true}' })
    ]);
    const suggestions = resolveHandoverSuggestions({
      sourceToolId: toolId,
      root,
      availableTools: ['json-data-workbench']
    });

    assert.ok(suggestions.some(suggestion => suggestion.label === 'Format JSON'), `${toolId} should offer JSON & Data Workbench format handover`);
    assert.ok(suggestions.some(suggestion => suggestion.label === 'Explore JSON records'), `${toolId} should offer JSON & Data Workbench explore handover`);

    if (toolId === 'regex-tester' || (toolId === 'text-utilities-workbench' && outputId === 'regexOutput')) {
      const dataExplorerSuggestion = suggestions.find(suggestion => suggestion.label === 'Explore JSON records');
      assert.deepEqual(dataExplorerSuggestion.setFields, [
        {
          selector: '#dataExplorerRecordPath',
          value: 'matches'
        }
      ]);
    }

    if (toolId === 'text-utilities-workbench' && outputId === 'textDiffOutput') {
      const dataExplorerSuggestion = suggestions.find(suggestion => suggestion.label === 'Explore JSON records');
      assert.deepEqual(dataExplorerSuggestion.setFields, [
        {
          selector: '#dataExplorerRecordPath',
          value: 'rows'
        }
      ]);
    }

    if (toolId === 'pdf-template-field-explorer') {
      const dataExplorerSuggestion = suggestions.find(suggestion => suggestion.label === 'Explore JSON records');
      assert.deepEqual(dataExplorerSuggestion.setFields, [
        {
          selector: '#dataExplorerRecordPath',
          value: 'fields'
        }
      ]);
    }
  }
});

test('resolves PDF field mapping handover sources', () => {
  const root = createRoot([
    createControl({
      id: 'pdfFieldsJsonOutput',
      tagName: 'TEXTAREA',
      value: JSON.stringify({
        fileName: 'template.pdf',
        pageCount: 1,
        fieldCount: 2,
        fields: [
          {
            page: 1,
            name: 'customer_name',
            type: 'Tx',
            value: 'Contoso',
            defaultValue: '',
            alternativeText: 'Customer name',
            rect: {
              pdf: {
                x1: 10,
                y1: 20,
                x2: 210,
                y2: 40
              },
              viewport: {
                x: 10,
                y: 20,
                width: 200,
                height: 20
              }
            },
            rawAnnotationId: 'field-1'
          },
          {
            page: 1,
            name: 'newsletter_opt_in',
            type: 'Btn',
            value: '',
            defaultValue: '',
            alternativeText: 'Newsletter opt in',
            rect: {
              pdf: {
                x1: 20,
                y1: 60,
                x2: 40,
                y2: 80
              },
              viewport: {
                x: 20,
                y: 60,
                width: 20,
                height: 20
              }
            },
            rawAnnotationId: 'field-2'
          }
        ]
      })
    })
  ]);
  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'pdf-template-field-explorer',
    root,
    availableTools: ['json-data-workbench', 'csv-tsv-helper']
  });

  assert.ok(suggestions.some(suggestion => suggestion.label === 'Format JSON'));
  const explorerSuggestion = suggestions.find(suggestion => suggestion.label === 'Explore JSON records');
  assert.equal(explorerSuggestion.kind, 'json');
  assert.deepEqual(explorerSuggestion.setFields, [
    {
      selector: '#dataExplorerRecordPath',
      value: 'fields'
    }
  ]);

  const csvSuggestion = suggestions.find(suggestion => suggestion.label === 'Convert fields to CSV');
  assert.equal(csvSuggestion.kind, 'text');
  assert.match(csvSuggestion.value, /^Page,Name,Type,Value/);
  assert.match(csvSuggestion.value, /customer_name/);
  assert.match(csvSuggestion.value, /newsletter_opt_in/);

  root.controls[0].value = '';
  assert.deepEqual(resolveHandoverSuggestions({
    sourceToolId: 'pdf-template-field-explorer',
    root,
    availableTools: ['json-data-workbench', 'csv-tsv-helper']
  }), []);
});

test('resolves suggestions for text handover sources', () => {
  const root = createRoot([
    createControl({ id: 'supportPackOutput', tagName: 'TEXTAREA', value: 'User [EMAIL_1]\nTrace [TOKEN_1]' })
  ]);
  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'support-pack-sanitiser',
    root,
    availableTools: ['regex-tester', 'markdown-workbench', 'text-diff', 'case-converter', 'html-cleaner-converter']
  });

  assert.ok(suggestions.every(suggestion => suggestion.kind === 'text'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Test with regex'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Preview Markdown'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Compare as left text'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Compare as right text'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Convert case'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Clean as HTML'));
  assert.equal(suggestions.find(suggestion => suggestion.label === 'Preview Markdown').targetMode, 'preview');

  const workbenchSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'text-utilities-workbench',
    root,
    availableTools: ['text-utilities-workbench', 'markdown-workbench', 'html-cleaner-converter']
  });

  assert.ok(workbenchSuggestions.some(suggestion => suggestion.label === 'Test with regex' && suggestion.targetMode === 'regex'));
  assert.ok(workbenchSuggestions.some(suggestion => suggestion.label === 'Compare as left text' && suggestion.targetMode === 'diff'));
  assert.ok(workbenchSuggestions.some(suggestion => suggestion.label === 'Convert case' && suggestion.targetMode === 'case'));
  assert.ok(workbenchSuggestions.some(suggestion => suggestion.label === 'Preview Markdown' && suggestion.targetMode === 'preview'));
  assert.ok(workbenchSuggestions.some(suggestion => suggestion.label === 'Clean as HTML'));

  root.controls[0].value = '   ';
  assert.deepEqual(resolveHandoverSuggestions({
    sourceToolId: 'support-pack-sanitiser',
    root,
    availableTools: ['regex-tester', 'markdown-workbench', 'text-diff', 'case-converter', 'html-cleaner-converter']
  }), []);

  const ocrRoot = createRoot([
    createControl({ id: 'imageOcrOutput', tagName: 'TEXTAREA', value: 'HELLO OCR' })
  ]);
  const ocrSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'image-ocr',
    root: ocrRoot,
    availableTools: ['support-pack-sanitiser', 'regex-tester', 'text-diff']
  });

  assert.ok(ocrSuggestions.every(suggestion => suggestion.kind === 'text'));
  assert.ok(ocrSuggestions.some(suggestion => suggestion.label === 'Sanitise text'));
  assert.ok(ocrSuggestions.some(suggestion => suggestion.label === 'Test with regex'));
  assert.ok(ocrSuggestions.some(suggestion => suggestion.label === 'Compare as left text'));
});

test('resolves suggestions for API and Power Platform text sources', () => {
  for (const [toolId, outputId, availableTools, expectedLabels] of [
    ['web-api-workbench', 'curlFetchOutput', ['support-pack-sanitiser', 'regex-tester', 'text-diff'], ['Sanitise request', 'Test with regex', 'Compare as left text']],
    ['curl-fetch-converter', 'curlFetchOutput', ['support-pack-sanitiser', 'regex-tester', 'text-diff'], ['Sanitise request', 'Test with regex', 'Compare as left text']],
    ['dataverse-odata-query-builder', 'odataOutput', ['support-pack-sanitiser', 'markdown-workbench', 'text-diff'], ['Sanitise query', 'Preview Markdown', 'Compare as left text']],
    ['power-pages-workbench', 'webApiSnippetOutput', ['support-pack-sanitiser'], ['Sanitise snippet']],
    ['power-pages-web-api-snippets', 'webApiSnippetOutput', ['support-pack-sanitiser'], ['Sanitise snippet']],
    ['power-platform-cli-command-builder', 'pacOutput', ['support-pack-sanitiser', 'markdown-workbench', 'text-diff'], ['Sanitise command', 'Preview Markdown', 'Compare as left text']],
    ['power-automate-expression-formatter', 'flowExpressionOutput', ['text-diff'], ['Compare as left text', 'Compare as right text']],
    ['power-fx-snippet-formatter', 'powerFxOutput', ['text-diff'], ['Compare as left text', 'Compare as right text']]
  ]) {
    const root = createRoot([
      createControl({ id: outputId, tagName: 'TEXTAREA', value: 'Generated output' })
    ]);
    const suggestions = resolveHandoverSuggestions({
      sourceToolId: toolId,
      root,
      availableTools
    });

    assert.ok(suggestions.every(suggestion => suggestion.kind === 'text'), `${toolId} should only expose text handovers`);
    expectedLabels.forEach(label => {
      assert.ok(suggestions.some(suggestion => suggestion.label === label), `${toolId} should offer ${label}`);
    });

    root.controls[0].value = '';
    assert.deepEqual(resolveHandoverSuggestions({
      sourceToolId: toolId,
      root,
      availableTools
    }), []);
  }
});

test('resolves Model-driven JavaScript Workbench handovers', () => {
  const reviewRoot = createRoot([
    createControl({ id: 'modelDrivenJsReviewOutput', tagName: 'TEXTAREA', value: '# Review\n\nDeprecated Xrm.Page usage.' })
  ]);
  const reviewSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'model-driven-javascript-workbench',
    root: reviewRoot,
    availableTools: ['markdown-workbench', 'support-pack-sanitiser']
  });

  assert.ok(reviewSuggestions.some(suggestion => suggestion.sourceOutputId === 'review-report' && suggestion.label === 'Preview review' && suggestion.targetMode === 'preview'));
  assert.ok(reviewSuggestions.some(suggestion => suggestion.sourceOutputId === 'review-report' && suggestion.label === 'Sanitise review'));

  reviewRoot.controls[0].value = '{"rules":{"deprecated-xrm-page":{"count":1}}}';
  const ruleSummarySuggestions = resolveHandoverSuggestions({
    sourceToolId: 'model-driven-javascript-workbench',
    root: reviewRoot,
    availableTools: ['json-data-workbench']
  });

  assert.ok(ruleSummarySuggestions.some(suggestion => suggestion.sourceOutputId === 'review-rule-summary' && suggestion.label === 'Format JSON' && suggestion.targetMode === 'format'));

  const migrationRoot = createRoot([
    createControl({ id: 'clientApiMigrationOutput', tagName: 'TEXTAREA', value: '# Migration\n\nUse formContext.' })
  ]);
  const migrationSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'model-driven-javascript-workbench',
    root: migrationRoot,
    availableTools: ['markdown-workbench', 'text-diff']
  });

  assert.ok(migrationSuggestions.some(suggestion => suggestion.sourceOutputId === 'migration-report' && suggestion.label === 'Preview migration report'));
  assert.ok(migrationSuggestions.some(suggestion => suggestion.sourceOutputId === 'migration-report' && suggestion.targetToolId === 'text-diff'));

  const webApiRoot = createRoot([
    createControl({ id: 'xrmWebApiSnippetOutput', tagName: 'TEXTAREA', value: 'Xrm.WebApi.retrieveMultipleRecords("account", "?$select=name");' })
  ]);
  const webApiSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'model-driven-javascript-workbench',
    root: webApiRoot,
    availableTools: ['support-pack-sanitiser', 'mermaid-studio']
  });

  assert.ok(webApiSuggestions.some(suggestion => suggestion.sourceOutputId === 'web-api-output' && suggestion.label === 'Sanitise snippet'));
  assert.ok(webApiSuggestions.some(suggestion => suggestion.sourceOutputId === 'web-api-output' && suggestion.targetToolId === 'mermaid-studio' && suggestion.targetMode === 'api-workflow'));
});

test('resolves Model-driven Solution Inspector handovers', () => {
  const eventsRoot = createRoot([
    createControl({ id: 'solutionJavascriptEventsOutput', tagName: 'TEXTAREA', value: '# Model-driven JavaScript event inspection\n\nLibrary inventory.' })
  ]);
  const eventSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'model-driven-solution-inspector',
    root: eventsRoot,
    availableTools: ['markdown-workbench', 'text-diff']
  });

  assert.ok(eventSuggestions.some(suggestion => suggestion.sourceOutputId === 'events' && suggestion.label === 'Preview event report' && suggestion.targetMode === 'preview'));
  assert.ok(eventSuggestions.some(suggestion => suggestion.sourceOutputId === 'events' && suggestion.targetToolId === 'text-diff'));

  const dependencyRoot = createRoot([
    createControl({ id: 'webResourceDependencyMapOutput', tagName: 'TEXTAREA', value: '# Web resource dependency map\n\nSource file references.' }),
    createControl({ id: 'webResourceDependencyMermaidOutput', tagName: 'TEXTAREA', value: 'flowchart LR\n  Form --> Library' })
  ]);
  const dependencySuggestions = resolveHandoverSuggestions({
    sourceToolId: 'model-driven-solution-inspector',
    root: dependencyRoot,
    availableTools: ['markdown-workbench', 'mermaid-studio', 'text-diff']
  });

  assert.ok(dependencySuggestions.some(suggestion => suggestion.sourceOutputId === 'dependency-report' && suggestion.label === 'Preview dependency report'));
  assert.ok(dependencySuggestions.some(suggestion => suggestion.sourceOutputId === 'dependency-report' && suggestion.targetToolId === 'text-diff'));
  assert.ok(dependencySuggestions.some(suggestion => suggestion.sourceOutputId === 'mermaid' && suggestion.targetToolId === 'mermaid-studio' && suggestion.targetMode === 'editor'));
});

test('resolves Markdown Workbench preview handovers to Mermaid and text tools', () => {
  const root = createRoot([
    createControl({
      id: 'markdownInput',
      tagName: 'TEXTAREA',
      value: [
        '# Release notes',
        '',
        '```mermaid',
        'flowchart TD',
        '  Draft --> Review',
        '```',
        '',
        '| Name | Count |',
        '| --- | --- |',
        '| Ada | 12 |'
      ].join('\n')
    }),
    createControl({
      id: 'markdownMermaidOutput',
      tagName: 'TEXTAREA',
      value: [
        'flowchart TD',
        '  Draft --> Review'
      ].join('\n')
    })
  ]);
  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'markdown-workbench',
    root,
    availableTools: ['mermaid-studio', 'markdown-workbench', 'text-diff']
  });

  assert.ok(suggestions.some(suggestion => suggestion.label === 'Preview Mermaid block'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Format Markdown tables'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Compare as left text'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Compare as right text'));
  assert.equal(suggestions.find(suggestion => suggestion.label === 'Preview Mermaid block').kind, 'mermaid');
  assert.equal(suggestions.find(suggestion => suggestion.label === 'Preview Mermaid block').targetToolId, 'mermaid-studio');
  assert.equal(suggestions.find(suggestion => suggestion.label === 'Preview Mermaid block').targetMode, 'editor');
  assert.equal(suggestions.find(suggestion => suggestion.label === 'Format Markdown tables').targetMode, 'tables');

  root.controls[1].value = '';
  const textOnlySuggestions = resolveHandoverSuggestions({
    sourceToolId: 'markdown-workbench',
    root,
    availableTools: ['mermaid-studio', 'markdown-workbench', 'text-diff']
  });

  assert.ok(!textOnlySuggestions.some(suggestion => suggestion.label === 'Preview Mermaid block'));
  assert.ok(textOnlySuggestions.some(suggestion => suggestion.label === 'Format Markdown tables'));
  assert.ok(textOnlySuggestions.some(suggestion => suggestion.label === 'Compare as left text'));
});

test('resolves Markdown Workbench table handovers', () => {
  const root = createRoot([
    createControl({
      id: 'markdownTableOutput',
      tagName: 'TEXTAREA',
      value: [
        'Name,Count',
        'Ada,12'
      ].join('\n')
    })
  ]);
  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'markdown-workbench',
    root,
    availableTools: ['markdown-workbench', 'csv-tsv-helper', 'text-diff']
  });

  assert.ok(suggestions.some(suggestion => suggestion.label === 'Preview Markdown'));
  assert.equal(suggestions.find(suggestion => suggestion.label === 'Preview Markdown').targetMode, 'preview');
  const csvSuggestion = suggestions.find(suggestion => suggestion.label === 'Inspect as delimited data');
  assert.equal(csvSuggestion.kind, 'text');
  assert.deepEqual(csvSuggestion.setFields, [
    {
      selector: '#csvDelimiter',
      value: 'auto'
    },
    {
      selector: '#csvOutputFormat',
      value: 'csv'
    },
    {
      selector: '#csvFirstRowHeaders',
      value: true
    }
  ]);
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Compare as left text'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Compare as right text'));

  root.controls[0].value = '';
  assert.deepEqual(resolveHandoverSuggestions({
    sourceToolId: 'markdown-workbench',
    root,
    availableTools: ['markdown-workbench', 'csv-tsv-helper', 'text-diff']
  }), []);
});

test('resolves CSV helper Markdown table output into the table formatter', () => {
  const root = createRoot([
    createControl({
      id: 'csvOutput',
      tagName: 'TEXTAREA',
      value: [
        '| Name | Count |',
        '| --- | --- |',
        '| Ada | 12 |'
      ].join('\n')
    })
  ]);
  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'csv-tsv-helper',
    root,
    availableTools: ['markdown-workbench']
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].label, 'Format Markdown tables');
  assert.equal(suggestions[0].sourceOutputId, 'text-output');
  assert.equal(suggestions[0].kind, 'text');
  assert.equal(suggestions[0].targetToolId, 'markdown-workbench');
  assert.equal(suggestions[0].targetMode, 'tables');
});

test('resolves Power Pages Web API transformed handover sources', () => {
  const root = createRoot([
    createControl({
      id: 'webApiSnippetOutput',
      tagName: 'TEXTAREA',
      value: [
        '// Power Pages Web API setup checklist',
        '// Endpoint: /_api/accounts?$select=name&$filter=statecode%20eq%200&$top=5',
        'webapi.safeAjax = safeAjax;',
        'webapi.safeAjax({',
        '  type: "GET",',
        '  url: "/_api/accounts?$select=name&$filter=statecode%20eq%200&$top=5",',
        '  headers: {',
        '    "Accept": "application/json",',
        '    "OData-MaxVersion": "4.0",',
        '    "OData-Version": "4.0"',
        '  },',
        '  success: function(data) {',
        '    console.log(data);',
        '  },',
        '  error: function(xhr) {',
        '    console.error(xhr);',
        '  }',
        '});'
      ].join('\n')
    })
  ]);
  for (const sourceToolId of ['power-pages-workbench', 'power-pages-web-api-snippets']) {
    const suggestions = resolveHandoverSuggestions({
      sourceToolId,
      root,
      availableTools: ['support-pack-sanitiser', 'web-api-workbench', 'curl-fetch-converter', 'url-codec']
    });

    assert.ok(suggestions.some(suggestion => suggestion.label === 'Sanitise snippet'));

    const converterSuggestion = suggestions.find(suggestion => suggestion.label === 'Convert safeAjax to cURL');
    assert.equal(converterSuggestion.targetToolId, 'web-api-workbench');
    assert.equal(converterSuggestion.targetInputId, 'request');
    assert.equal(converterSuggestion.targetMode, 'request');
    assert.equal(converterSuggestion.kind, 'text');
    assert.match(converterSuggestion.value, /^const response = await fetch/);
    assert.match(converterSuggestion.value, /\/_api\/accounts/);
    assert.ok(!converterSuggestion.value.includes('webapi.safeAjax'));
    assert.deepEqual(converterSuggestion.setFields, [
      {
        selector: '#curlFetchMode',
        value: 'fetch-to-curl'
      }
    ]);

    const endpointSuggestion = suggestions.find(suggestion => suggestion.label === 'Inspect Web API endpoint');
    assert.equal(endpointSuggestion.kind, 'text');
    assert.equal(endpointSuggestion.value, '/_api/accounts?$select=name&$filter=statecode%20eq%200&$top=5');
    assert.deepEqual(endpointSuggestion.setFields, [
      {
        selector: '#urlToolMode',
        value: 'parse-query'
      },
      {
        selector: '#urlOutputFormat',
        value: 'json'
      }
    ]);
  }
});

test('resolves XML and Data Explorer text handover sources', () => {
  const fetchXmlRoot = createRoot([
    createControl({ id: 'powerPagesOutput', tagName: 'TEXTAREA', value: '<fetch><entity name="account"/></fetch>' })
  ]);
  for (const sourceToolId of ['power-pages-workbench', 'fetchxml-liquid-builder']) {
    const xmlSuggestions = resolveHandoverSuggestions({
      sourceToolId,
      root: fetchXmlRoot,
      availableTools: ['json-data-workbench']
    });

    assert.equal(xmlSuggestions.length, 1);
    assert.equal(xmlSuggestions[0].kind, 'xml');
    assert.equal(xmlSuggestions[0].targetToolId, 'json-data-workbench');
    assert.equal(xmlSuggestions[0].targetInputId, 'explore-xml');
    assert.equal(xmlSuggestions[0].targetMode, 'explore');
    assert.equal(xmlSuggestions[0].label, 'Explore XML data');
  }

  fetchXmlRoot.controls[0].value = '{% fetchxml accounts %}\n<fetch />\n{% endfetchxml %}';
  for (const sourceToolId of ['power-pages-workbench', 'fetchxml-liquid-builder']) {
    const liquidSuggestions = resolveHandoverSuggestions({
      sourceToolId,
      root: fetchXmlRoot,
      availableTools: ['json-data-workbench']
    });

    assert.equal(liquidSuggestions.length, 1);
    assert.equal(liquidSuggestions[0].kind, 'xml');
    assert.equal(liquidSuggestions[0].label, 'Explore embedded FetchXML');
    assert.equal(liquidSuggestions[0].value, '<fetch />');
  }

  const dataverseRoot = createRoot([
    createControl({
      id: 'odataOutput',
      tagName: 'TEXTAREA',
      value: [
        '# Dataverse OData query',
        '',
        'Endpoint: /api/data/v9.2/accounts',
        '',
        '```js',
        'const response = await fetch("/api/data/v9.2/accounts", { method: "GET" });',
        '```'
      ].join('\n')
    })
  ]);
  const dataverseSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'dataverse-odata-query-builder',
    root: dataverseRoot,
    availableTools: ['web-api-workbench', 'curl-fetch-converter', 'support-pack-sanitiser', 'text-diff', 'url-codec']
  });

  const converterSuggestion = dataverseSuggestions.find(suggestion => suggestion.label === 'Convert fetch to cURL');
  assert.equal(converterSuggestion.targetToolId, 'web-api-workbench');
  assert.equal(converterSuggestion.targetInputId, 'request');
  assert.equal(converterSuggestion.targetMode, 'request');
  assert.equal(converterSuggestion.kind, 'text');
  assert.equal(converterSuggestion.value, 'const response = await fetch("/api/data/v9.2/accounts", { method: "GET" });');
  assert.deepEqual(converterSuggestion.setFields, [
    {
      selector: '#curlFetchMode',
      value: 'fetch-to-curl'
    }
  ]);
  const endpointSuggestion = dataverseSuggestions.find(suggestion => suggestion.label === 'Inspect endpoint query');
  assert.equal(endpointSuggestion.kind, 'text');
  assert.equal(endpointSuggestion.value, '/api/data/v9.2/accounts');
  assert.deepEqual(endpointSuggestion.setFields, [
    {
      selector: '#urlToolMode',
      value: 'parse-query'
    },
    {
      selector: '#urlOutputFormat',
      value: 'json'
    }
  ]);

  const dataExplorerRoot = createRoot([
    createControl({ id: 'dataExplorerOutput', tagName: 'TEXTAREA', value: '[{"name":"Ada"}]' })
  ]);
  const textSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'json-data-workbench',
    root: dataExplorerRoot,
    availableTools: ['text-diff', 'csv-tsv-helper']
  });

  assert.ok(textSuggestions.some(suggestion => suggestion.label === 'Compare as left text'));
  assert.ok(textSuggestions.some(suggestion => suggestion.label === 'Compare as right text'));
  const csvSuggestion = textSuggestions.find(suggestion => suggestion.label === 'Convert to CSV');
  assert.equal(csvSuggestion.kind, 'text');
  assert.equal(csvSuggestion.value, 'name\nAda');
});

test('resolves suggestions for Base64 handover sources', () => {
  const root = createRoot([
    createControl({ id: 'base64Output', tagName: 'TEXTAREA', value: 'aGVsbG8=' })
  ]);
  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'base64-file-converter',
    root,
    availableTools: ['base64-file-converter']
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].kind, 'base64');
  assert.equal(suggestions[0].label, 'Create file');
  assert.equal(suggestions[0].targetMode, 'base64-to-file');

  root.controls[0].value = 'not valid !';
  assert.deepEqual(resolveHandoverSuggestions({
    sourceToolId: 'base64-file-converter',
    root,
    availableTools: ['base64-file-converter']
  }), []);
});

test('resolves Mermaid handover sources', () => {
  const templateRoot = createRoot([
    createControl({ id: 'mermaidTemplateOutput', tagName: 'TEXTAREA', value: 'flowchart TD\n  A --> B' })
  ]);
  const templateSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'mermaid-studio',
    root: templateRoot,
    availableTools: ['mermaid-studio', 'text-diff']
  });

  assert.ok(templateSuggestions.some(suggestion => suggestion.label === 'Preview and export'));
  assert.equal(templateSuggestions.find(suggestion => suggestion.label === 'Preview and export').targetMode, 'editor');
  assert.ok(templateSuggestions.some(suggestion => suggestion.label === 'Compare as left text'));
  assert.ok(templateSuggestions.every(suggestion => suggestion.kind === 'mermaid'));

  const jsonRoot = createRoot([
    createControl({ id: 'jsonOutput', tagName: 'TEXTAREA', value: '{"name":"Ada"}' })
  ]);
  const jsonSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'json-data-workbench',
    root: jsonRoot,
    availableTools: ['mermaid-studio']
  });

  assert.ok(jsonSuggestions.some(suggestion => suggestion.label === 'Diagram JSON as Mermaid'));
  assert.equal(jsonSuggestions.find(suggestion => suggestion.label === 'Diagram JSON as Mermaid').targetMode, 'data');
  const treeSuggestion = jsonSuggestions.find(suggestion => suggestion.label === 'Create Mermaid tree');
  assert.equal(treeSuggestion.kind, 'mermaid');
  assert.equal(treeSuggestion.targetToolId, 'mermaid-studio');
  assert.equal(treeSuggestion.targetMode, 'editor');
  assert.match(treeSuggestion.value, /^flowchart TD/);

  const requestRoot = createRoot([
    createControl({ id: 'curlFetchOutput', tagName: 'TEXTAREA', value: 'const response = await fetch("/api/items", { method: "GET" });' })
  ]);
  const requestSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'curl-fetch-converter',
    root: requestRoot,
    availableTools: ['mermaid-studio']
  });

  assert.ok(requestSuggestions.some(suggestion => suggestion.targetToolId === 'mermaid-studio' && suggestion.targetMode === 'api-workflow'));
  assert.ok(requestSuggestions.some(suggestion => suggestion.transform === 'request-to-mermaid-sequence'));

  const workbenchRequestSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'web-api-workbench',
    root: requestRoot,
    availableTools: ['mermaid-studio']
  });

  assert.ok(workbenchRequestSuggestions.some(suggestion => suggestion.targetToolId === 'mermaid-studio' && suggestion.targetMode === 'api-workflow'));
  assert.ok(workbenchRequestSuggestions.some(suggestion => suggestion.transform === 'request-to-mermaid-sequence'));

  const solutionRoot = createRoot([
    createControl({ id: 'solutionMermaidOutput', tagName: 'TEXTAREA', value: 'flowchart TD\n  Flow --> Action' }),
    createControl({ id: 'solutionMermaidInventoryOutput', tagName: 'TEXTAREA', value: '# Inventory\n\n```mermaid\nflowchart TD\n  Flow --> Action\n```' })
  ]);
  for (const sourceToolId of ['solution-package-inspector', 'power-platform-solution-mermaid']) {
    const solutionSuggestions = resolveHandoverSuggestions({
      sourceToolId,
      root: solutionRoot,
      availableTools: ['mermaid-studio', 'markdown-workbench', 'text-diff']
    });

    assert.ok(solutionSuggestions.some(suggestion => suggestion.sourceOutputId === 'mermaid' && suggestion.targetToolId === 'mermaid-studio' && suggestion.targetMode === 'editor'));
    assert.ok(solutionSuggestions.some(suggestion => suggestion.sourceOutputId === 'inventory' && suggestion.targetToolId === 'markdown-workbench' && suggestion.targetMode === 'preview'));
  }

  const preflightRoot = createRoot([
    createControl({ id: 'solutionImportPreflightOutput', tagName: 'TEXTAREA', value: '# Power Platform solution import preflight\n\n## Preflight summary' })
  ]);
  for (const sourceToolId of ['solution-package-inspector', 'power-platform-solution-import-preflight']) {
    const preflightSuggestions = resolveHandoverSuggestions({
      sourceToolId,
      root: preflightRoot,
      availableTools: ['markdown-workbench', 'text-diff']
    });

    assert.ok(preflightSuggestions.some(suggestion => suggestion.sourceOutputId === 'preflight' && suggestion.targetToolId === 'markdown-workbench' && suggestion.targetMode === 'preview'));
    assert.ok(preflightSuggestions.some(suggestion => suggestion.sourceOutputId === 'preflight' && suggestion.targetToolId === 'text-diff'));
  }

  const docsRoot = createRoot([
    createControl({ id: 'solutionDocsOutput', tagName: 'TEXTAREA', value: '# Power Platform solution documentation\n\n## Operational summary' })
  ]);
  for (const sourceToolId of ['solution-package-inspector', 'power-platform-solution-docs']) {
    const docsSuggestions = resolveHandoverSuggestions({
      sourceToolId,
      root: docsRoot,
      availableTools: ['markdown-workbench', 'text-diff']
    });

    assert.ok(docsSuggestions.some(suggestion => suggestion.sourceOutputId === 'documentation' && suggestion.targetToolId === 'markdown-workbench' && suggestion.targetMode === 'preview'));
    assert.ok(docsSuggestions.some(suggestion => suggestion.sourceOutputId === 'documentation' && suggestion.targetToolId === 'text-diff'));
  }
});

test('resolves schema handovers for detected JSON Schema output', () => {
  const root = createRoot([
    createControl({
      id: 'jsonOutput',
      tagName: 'TEXTAREA',
      value: JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' }
        }
      })
    })
  ]);

  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'json-data-workbench',
    root,
    availableTools: ['json-data-workbench']
  });

  assert.ok(suggestions.some(suggestion => suggestion.targetInputId === 'schema'));
  assert.ok(suggestions.some(suggestion => suggestion.targetMode === 'schema'));
});

test('applies handover payloads and restores serialised form state', () => {
  const sourceRoot = createRoot([
    createControl({ id: 'jsonInput', tagName: 'TEXTAREA', value: '{"name":"Ada"}' }),
    createControl({ id: 'jsonOutput', tagName: 'TEXTAREA', value: '{\n  "name": "Ada"\n}' }),
    createControl({ id: 'ignoredFile', tagName: 'INPUT', type: 'file', value: 'secret.txt' }),
    createControl({ id: 'ignoredButton', tagName: 'BUTTON', type: 'button', value: 'Click' })
  ]);
  const state = serialiseToolState('json-formatter', sourceRoot);

  assert.equal(state.toolId, 'json-formatter');
  assert.equal(state.controls.length, 2);

  const restoredRoot = createRoot([
    createControl({ id: 'jsonInput', tagName: 'TEXTAREA', value: '' }),
    createControl({ id: 'jsonOutput', tagName: 'TEXTAREA', value: '' })
  ]);

  assert.equal(restoreToolState(restoredRoot, state), 2);
  assert.equal(restoredRoot.querySelector('#jsonInput').value, '{"name":"Ada"}');
  assert.equal(restoredRoot.querySelector('#jsonOutput').value, '{\n  "name": "Ada"\n}');
  assert.deepEqual(restoredRoot.querySelector('#jsonInput').events, ['input', 'change']);

  const targetRoot = createRoot([
    createControl({ id: 'dataExplorerFormat', tagName: 'SELECT', value: 'auto' }),
    createControl({ id: 'dataExplorerRecordPath', tagName: 'INPUT', value: '' }),
    createControl({ id: 'dataExplorerInput', tagName: 'TEXTAREA', value: '' })
  ]);

  assert.equal(applyHandoverPayload(targetRoot, 'data-explorer', 'input', '[{"name":"Ada"}]', undefined, {
    setFields: [
      {
        selector: '#dataExplorerRecordPath',
        value: 'items'
      }
    ]
  }), true);
  assert.equal(targetRoot.querySelector('#dataExplorerFormat').value, 'json');
  assert.equal(targetRoot.querySelector('#dataExplorerRecordPath').value, 'items');
  assert.equal(targetRoot.querySelector('#dataExplorerInput').value, '[{"name":"Ada"}]');

  assert.equal(applyHandoverPayload(targetRoot, 'data-explorer', 'xml', '<fetch />'), true);
  assert.equal(targetRoot.querySelector('#dataExplorerFormat').value, 'xml');
  assert.equal(targetRoot.querySelector('#dataExplorerInput').value, '<fetch />');

  const textTargetRoot = createRoot([
    createControl({ id: 'regexText', tagName: 'TEXTAREA', value: '' })
  ]);
  assert.equal(applyHandoverPayload(textTargetRoot, 'regex-tester', 'text', 'User [EMAIL_1]'), true);
  assert.equal(textTargetRoot.querySelector('#regexText').value, 'User [EMAIL_1]');

  const base64TargetRoot = createRoot([
    createControl({ id: 'base64Input', tagName: 'TEXTAREA', value: '' })
  ]);
  assert.equal(applyHandoverPayload(base64TargetRoot, 'base64-file-converter', 'content', 'aGVsbG8='), true);
  assert.equal(base64TargetRoot.querySelector('#base64Input').value, 'aGVsbG8=');

  const mermaidTargetRoot = createRoot([
    createControl({ id: 'mermaidSourceInput', tagName: 'TEXTAREA', value: '' })
  ]);
  assert.equal(applyHandoverPayload(mermaidTargetRoot, 'mermaid-studio', 'source', 'flowchart TD\n  A --> B'), true);
  assert.equal(mermaidTargetRoot.querySelector('#mermaidSourceInput').value, 'flowchart TD\n  A --> B');

  const csvTargetRoot = createRoot([
    createControl({ id: 'csvDelimiter', tagName: 'SELECT', value: 'auto' }),
    createControl({ id: 'csvOutputFormat', tagName: 'SELECT', value: 'json' }),
    createControl({ id: 'csvFirstRowHeaders', tagName: 'INPUT', type: 'checkbox', checked: false }),
    createControl({ id: 'csvInput', tagName: 'TEXTAREA', value: '' })
  ]);
  assert.equal(applyHandoverPayload(csvTargetRoot, 'csv-tsv-helper', 'input', 'name\nAda'), true);
  assert.equal(csvTargetRoot.querySelector('#csvDelimiter').value, 'comma');
  assert.equal(csvTargetRoot.querySelector('#csvOutputFormat').value, 'csv');
  assert.equal(csvTargetRoot.querySelector('#csvFirstRowHeaders').checked, true);
  assert.equal(csvTargetRoot.querySelector('#csvInput').value, 'name\nAda');

  const urlTargetRoot = createRoot([
    createControl({ id: 'urlToolMode', tagName: 'SELECT', value: 'encode-component' }),
    createControl({ id: 'urlOutputFormat', tagName: 'SELECT', value: 'markdown' }),
    createControl({ id: 'urlInput', tagName: 'TEXTAREA', value: '' })
  ]);
  assert.equal(applyHandoverPayload(urlTargetRoot, 'url-codec', 'input', '/api/data/v9.2/accounts?$select=name', undefined, {
    setFields: [
      {
        selector: '#urlToolMode',
        value: 'parse-query'
      },
      {
        selector: '#urlOutputFormat',
        value: 'json'
      }
    ]
  }), true);
  assert.equal(urlTargetRoot.querySelector('#urlToolMode').value, 'parse-query');
  assert.equal(urlTargetRoot.querySelector('#urlOutputFormat').value, 'json');
  assert.equal(urlTargetRoot.querySelector('#urlInput').value, '/api/data/v9.2/accounts?$select=name');
});

function createRoot(controls) {
  return {
    controls,
    querySelector(selector) {
      const id = selector.startsWith('#') ? selector.slice(1) : selector;
      return controls.find(control => control.id === id) || null;
    },
    querySelectorAll() {
      return controls;
    }
  };
}

function createControl({ id, tagName, type = '', value = '', checked = false, multiple = false, options = [] }) {
  return {
    id,
    tagName,
    type,
    value,
    checked,
    multiple,
    options,
    events: [],
    dispatchEvent(event) {
      this.events.push(event.type);
      return true;
    }
  };
}
