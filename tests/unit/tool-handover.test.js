import test from 'node:test';
import assert from 'node:assert/strict';

import { TOOL_CATALOGUE } from '../../src/tools/catalog.js';
import {
  TOOL_HANDOVER_ROUTES,
  TOOL_INTEGRATION_CONTRACTS
} from '../../src/tools/integration-contracts.js';
import {
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
  assert.ok(TOOL_HANDOVER_ROUTES.some(route => route.targetInputId === 'schema'));
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
    createControl({ id: 'dataExplorerInput', tagName: 'TEXTAREA', value: '' })
  ]);

  assert.equal(applyHandoverPayload(targetRoot, 'data-explorer', 'input', '[{"name":"Ada"}]'), true);
  assert.equal(targetRoot.querySelector('#dataExplorerFormat').value, 'json');
  assert.equal(targetRoot.querySelector('#dataExplorerInput').value, '[{"name":"Ada"}]');
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
