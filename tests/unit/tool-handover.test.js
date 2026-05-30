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
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'json-formatter'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'url-codec'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'regex-tester'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'text-diff'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'support-pack-sanitiser'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'file-to-base64'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'curl-fetch-converter'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'dataverse-odata-query-builder'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-pages-web-api-snippets'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'fetchxml-liquid-builder'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-platform-cli-command-builder'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-automate-expression-formatter'));
  assert.ok(TOOL_INTEGRATION_CONTRACTS.some(contract => contract.toolId === 'power-fx-snippet-formatter'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetInputId === 'schema'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'jwt-decoder' && route.sourceOutputId === 'header'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'support-pack-sanitiser' && route.targetToolId === 'regex-tester'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'file-to-base64' && route.targetToolId === 'base64-to-file'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'curl-fetch-converter' && route.targetToolId === 'support-pack-sanitiser'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'dataverse-odata-query-builder' && route.targetToolId === 'curl-fetch-converter' && route.transform === 'extract-fenced-fetch'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'dataverse-odata-query-builder' && route.targetToolId === 'support-pack-sanitiser'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'data-explorer' && route.targetToolId === 'text-diff'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'fetchxml-liquid-builder' && route.targetToolId === 'data-explorer' && route.targetInputId === 'xml'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'fetchxml-liquid-builder' && route.transform === 'extract-liquid-fetchxml'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-platform-cli-command-builder' && route.targetToolId === 'text-diff'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-automate-expression-formatter' && route.targetToolId === 'text-diff'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'power-fx-snippet-formatter' && route.targetToolId === 'text-diff'));
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
});

test('resolves suggestions only for compatible populated outputs', () => {
  const root = createRoot([
    createControl({ id: 'jsonOutput', tagName: 'TEXTAREA', value: '{"items":[{"name":"Ada"}]}' })
  ]);
  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'json-formatter',
    root,
    availableTools: ['json-formatter', 'json-diff', 'json-schema-validator', 'data-explorer']
  });

  assert.ok(suggestions.some(suggestion => suggestion.label === 'Explore JSON records'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Compare as left JSON'));
  assert.ok(!suggestions.some(suggestion => suggestion.label === 'Use as JSON Schema'));

  root.controls[0].value = '# Markdown report';
  assert.deepEqual(resolveHandoverSuggestions({
    sourceToolId: 'json-formatter',
    root,
    availableTools: ['json-formatter', 'json-diff', 'json-schema-validator', 'data-explorer']
  }), []);
});

test('resolves suggestions for additional JSON report sources', () => {
  for (const [toolId, outputId] of [
    ['url-codec', 'urlOutput'],
    ['regex-tester', 'regexOutput'],
    ['text-diff', 'textDiffOutput'],
    ['jwt-decoder', 'jwtHeaderOutput']
  ]) {
    const root = createRoot([
      createControl({ id: outputId, tagName: 'TEXTAREA', value: '{"ok":true}' })
    ]);
    const suggestions = resolveHandoverSuggestions({
      sourceToolId: toolId,
      root,
      availableTools: ['json-formatter', 'json-diff', 'json-schema-validator', 'data-explorer']
    });

    assert.ok(suggestions.some(suggestion => suggestion.label === 'Format JSON'), `${toolId} should offer JSON formatter handover`);
    assert.ok(suggestions.some(suggestion => suggestion.label === 'Explore JSON records'), `${toolId} should offer Data Explorer handover`);

    if (toolId === 'regex-tester') {
      const dataExplorerSuggestion = suggestions.find(suggestion => suggestion.label === 'Explore JSON records');
      assert.deepEqual(dataExplorerSuggestion.setFields, [
        {
          selector: '#dataExplorerRecordPath',
          value: 'matches'
        }
      ]);
    }
  }
});

test('resolves suggestions for text handover sources', () => {
  const root = createRoot([
    createControl({ id: 'supportPackOutput', tagName: 'TEXTAREA', value: 'User [EMAIL_1]\nTrace [TOKEN_1]' })
  ]);
  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'support-pack-sanitiser',
    root,
    availableTools: ['regex-tester', 'text-diff', 'case-converter', 'html-cleaner-converter']
  });

  assert.ok(suggestions.every(suggestion => suggestion.kind === 'text'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Test with regex'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Compare as left text'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Compare as right text'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Convert case'));
  assert.ok(suggestions.some(suggestion => suggestion.label === 'Clean as HTML'));

  root.controls[0].value = '   ';
  assert.deepEqual(resolveHandoverSuggestions({
    sourceToolId: 'support-pack-sanitiser',
    root,
    availableTools: ['regex-tester', 'text-diff', 'case-converter', 'html-cleaner-converter']
  }), []);
});

test('resolves suggestions for API and Power Platform text sources', () => {
  for (const [toolId, outputId, availableTools, expectedLabels] of [
    ['curl-fetch-converter', 'curlFetchOutput', ['support-pack-sanitiser', 'regex-tester', 'text-diff'], ['Sanitise request', 'Test with regex', 'Compare as left text']],
    ['dataverse-odata-query-builder', 'odataOutput', ['support-pack-sanitiser', 'text-diff'], ['Sanitise query', 'Compare as left text']],
    ['power-pages-web-api-snippets', 'webApiSnippetOutput', ['support-pack-sanitiser'], ['Sanitise snippet']],
    ['power-platform-cli-command-builder', 'pacOutput', ['support-pack-sanitiser', 'text-diff'], ['Sanitise command', 'Compare as left text']],
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

test('resolves XML and Data Explorer text handover sources', () => {
  const fetchXmlRoot = createRoot([
    createControl({ id: 'powerPagesOutput', tagName: 'TEXTAREA', value: '<fetch><entity name="account"/></fetch>' })
  ]);
  const xmlSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'fetchxml-liquid-builder',
    root: fetchXmlRoot,
    availableTools: ['data-explorer']
  });

  assert.equal(xmlSuggestions.length, 1);
  assert.equal(xmlSuggestions[0].kind, 'xml');
  assert.equal(xmlSuggestions[0].targetInputId, 'xml');
  assert.equal(xmlSuggestions[0].label, 'Explore XML data');

  fetchXmlRoot.controls[0].value = '{% fetchxml accounts %}\n<fetch />\n{% endfetchxml %}';
  const liquidSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'fetchxml-liquid-builder',
    root: fetchXmlRoot,
    availableTools: ['data-explorer']
  });

  assert.equal(liquidSuggestions.length, 1);
  assert.equal(liquidSuggestions[0].kind, 'xml');
  assert.equal(liquidSuggestions[0].label, 'Explore embedded FetchXML');
  assert.equal(liquidSuggestions[0].value, '<fetch />');

  const dataverseRoot = createRoot([
    createControl({
      id: 'odataOutput',
      tagName: 'TEXTAREA',
      value: [
        '# Dataverse OData query',
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
    availableTools: ['curl-fetch-converter', 'support-pack-sanitiser', 'text-diff']
  });

  const converterSuggestion = dataverseSuggestions.find(suggestion => suggestion.label === 'Convert fetch to cURL');
  assert.equal(converterSuggestion.kind, 'text');
  assert.equal(converterSuggestion.value, 'const response = await fetch("/api/data/v9.2/accounts", { method: "GET" });');
  assert.deepEqual(converterSuggestion.setFields, [
    {
      selector: '#curlFetchMode',
      value: 'fetch-to-curl'
    }
  ]);

  const dataExplorerRoot = createRoot([
    createControl({ id: 'dataExplorerOutput', tagName: 'TEXTAREA', value: '[{"name":"Ada"}]' })
  ]);
  const textSuggestions = resolveHandoverSuggestions({
    sourceToolId: 'data-explorer',
    root: dataExplorerRoot,
    availableTools: ['text-diff']
  });

  assert.ok(textSuggestions.some(suggestion => suggestion.label === 'Compare as left text'));
  assert.ok(textSuggestions.some(suggestion => suggestion.label === 'Compare as right text'));
});

test('resolves suggestions for Base64 handover sources', () => {
  const root = createRoot([
    createControl({ id: 'base64Output', tagName: 'TEXTAREA', value: 'aGVsbG8=' })
  ]);
  const suggestions = resolveHandoverSuggestions({
    sourceToolId: 'file-to-base64',
    root,
    availableTools: ['base64-to-file']
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].kind, 'base64');
  assert.equal(suggestions[0].label, 'Create file');

  root.controls[0].value = 'not valid !';
  assert.deepEqual(resolveHandoverSuggestions({
    sourceToolId: 'file-to-base64',
    root,
    availableTools: ['base64-to-file']
  }), []);
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
    sourceToolId: 'json-formatter',
    root,
    availableTools: ['json-schema-validator']
  });

  assert.ok(suggestions.some(suggestion => suggestion.targetInputId === 'schema'));
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
  assert.equal(applyHandoverPayload(base64TargetRoot, 'base64-to-file', 'content', 'aGVsbG8='), true);
  assert.equal(base64TargetRoot.querySelector('#base64Input').value, 'aGVsbG8=');
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
