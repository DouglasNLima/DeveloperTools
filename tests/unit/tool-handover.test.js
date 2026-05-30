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
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetInputId === 'schema'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'jwt-decoder' && route.sourceOutputId === 'header'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'support-pack-sanitiser' && route.targetToolId === 'regex-tester'));
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.sourceToolId === 'file-to-base64' && route.targetToolId === 'base64-to-file'));
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

test('detects populated text and Base64 handover values', () => {
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
