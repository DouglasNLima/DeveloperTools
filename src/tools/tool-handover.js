import {
  TOOL_HANDOVER_ROUTES,
  TOOL_INTEGRATION_CONTRACTS
} from './integration-contracts.js';

const JSON_SCHEMA_TYPES = new Set([
  'array',
  'boolean',
  'integer',
  'null',
  'number',
  'object',
  'string'
]);

const HANDOVER_KINDS = new Set(['base64', 'json', 'json-schema', 'text', 'xml']);

export function getToolIntegrationContract(toolId, contracts = TOOL_INTEGRATION_CONTRACTS) {
  return contracts.find(contract => contract.toolId === toolId) || null;
}

export function analyseJsonHandoverValue(value) {
  const rawValue = String(value ?? '');
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return {
      valid: false,
      reason: 'empty'
    };
  }

  try {
    const parsedValue = JSON.parse(trimmedValue);

    return {
      valid: true,
      rawValue: trimmedValue,
      parsedValue,
      kind: isJsonSchemaValue(parsedValue) ? 'json-schema' : 'json'
    };
  } catch {
    return {
      valid: false,
      reason: 'invalid-json'
    };
  }
}

export function analyseHandoverValue(value, expectedKind = 'text') {
  if (expectedKind === 'json' || expectedKind === 'json-schema') {
    return analyseJsonHandoverValue(value);
  }

  const rawValue = String(value ?? '');
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return {
      valid: false,
      reason: 'empty'
    };
  }

  if (expectedKind === 'base64') {
    if (!isBase64HandoverValue(trimmedValue)) {
      return {
        valid: false,
        reason: 'invalid-base64'
      };
    }

    return {
      valid: true,
      rawValue: trimmedValue,
      parsedValue: null,
      kind: 'base64'
    };
  }

  if (expectedKind === 'xml') {
    if (!isXmlHandoverValue(trimmedValue)) {
      return {
        valid: false,
        reason: 'invalid-xml'
      };
    }

    return {
      valid: true,
      rawValue: trimmedValue,
      parsedValue: null,
      kind: 'xml'
    };
  }

  return {
    valid: true,
    rawValue,
    parsedValue: rawValue,
    kind: 'text'
  };
}

export function isJsonSchemaValue(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (typeof value.$schema === 'string' && value.$schema.toLocaleLowerCase('en-GB').includes('json-schema')) {
    return true;
  }

  if (typeof value.$id === 'string' && hasSchemaKeyword(value)) {
    return true;
  }

  if (typeof value.type === 'string' && JSON_SCHEMA_TYPES.has(value.type) && hasSchemaKeyword(value)) {
    return true;
  }

  if (Array.isArray(value.type) && value.type.some(type => JSON_SCHEMA_TYPES.has(type)) && hasSchemaKeyword(value)) {
    return true;
  }

  return false;
}

export function resolveHandoverSuggestions({
  sourceToolId,
  root,
  availableTools = [],
  contracts = TOOL_INTEGRATION_CONTRACTS,
  routes = TOOL_HANDOVER_ROUTES
} = {}) {
  const sourceContract = getToolIntegrationContract(sourceToolId, contracts);

  if (!sourceContract || !root) {
    return [];
  }

  const availableToolIds = new Set(availableTools.map(tool => (typeof tool === 'string' ? tool : tool.id)));
  const suggestions = [];

  sourceContract.outputs.forEach(sourceOutput => {
    const outputElement = root.querySelector(sourceOutput.selector);
    const analysis = analyseHandoverValue(readControlValue(outputElement), sourceOutput.kind);

    if (!analysis.valid) {
      return;
    }

    routes
      .filter(route => route.sourceToolId === sourceToolId && route.sourceOutputId === sourceOutput.id)
      .forEach(route => {
        const targetContract = getToolIntegrationContract(route.targetToolId, contracts);
        const targetInput = targetContract?.inputs.find(input => input.id === route.targetInputId);

        if (!targetInput || !availableToolIds.has(route.targetToolId)) {
          return;
        }

        if (!route.acceptKinds.includes(analysis.kind)) {
          return;
        }

        suggestions.push({
          id: route.id,
          label: route.label,
          description: route.description,
          sourceToolId,
          sourceOutputId: sourceOutput.id,
          sourceLabel: sourceOutput.label,
          targetToolId: route.targetToolId,
          targetInputId: route.targetInputId,
          targetInputLabel: targetInput.label,
          kind: analysis.kind,
          value: analysis.rawValue,
          setFields: route.setFields || []
        });
      });
  });

  return suggestions;
}

export function applyHandoverPayload(root, toolId, inputId, value, contracts = TOOL_INTEGRATION_CONTRACTS, options = {}) {
  const contract = getToolIntegrationContract(toolId, contracts);
  const input = contract?.inputs.find(candidate => candidate.id === inputId);

  if (!root || !input) {
    return false;
  }

  [
    ...(input.setFields || []),
    ...(options.setFields || [])
  ].forEach(field => {
    const element = root.querySelector(field.selector);
    setControlValue(element, field.value);
  });

  const inputElement = root.querySelector(input.selector);
  return setControlValue(inputElement, value);
}

export function serialiseToolState(toolId, root) {
  if (!root) {
    return {
      toolId,
      controls: []
    };
  }

  const controls = getStatefulControls(root);

  return {
    toolId,
    controls: controls.map((control, index) => serialiseControl(control, index)).filter(Boolean)
  };
}

export function restoreToolState(root, state) {
  if (!root || !state?.controls) {
    return 0;
  }

  const indexedControls = getStatefulControls(root);
  let restoredCount = 0;

  state.controls.forEach(savedControl => {
    const control = savedControl.selector
      ? root.querySelector(savedControl.selector)
      : indexedControls[savedControl.index];

    if (setControlValue(control, savedControl.value, savedControl)) {
      restoredCount += 1;
    }
  });

  return restoredCount;
}

export function validateIntegrationContracts({
  toolIds = [],
  contracts = TOOL_INTEGRATION_CONTRACTS,
  routes = TOOL_HANDOVER_ROUTES
} = {}) {
  const errors = [];
  const knownToolIds = new Set(toolIds);
  const contractIds = new Set();

  contracts.forEach(contract => {
    if (!contract.toolId) {
      errors.push('Contract is missing toolId.');
      return;
    }

    if (contractIds.has(contract.toolId)) {
      errors.push(`Duplicate integration contract for ${contract.toolId}.`);
    }

    contractIds.add(contract.toolId);

    if (knownToolIds.size > 0 && !knownToolIds.has(contract.toolId)) {
      errors.push(`Integration contract references unknown tool ${contract.toolId}.`);
    }

    validatePorts(errors, contract, 'outputs');
    validatePorts(errors, contract, 'inputs');
  });

  routes.forEach(route => {
    const sourceContract = getToolIntegrationContract(route.sourceToolId, contracts);
    const targetContract = getToolIntegrationContract(route.targetToolId, contracts);

    if (!sourceContract) {
      errors.push(`Handover route ${route.id} references unknown source tool ${route.sourceToolId}.`);
    } else if (!sourceContract.outputs.some(output => output.id === route.sourceOutputId)) {
      errors.push(`Handover route ${route.id} references unknown source output ${route.sourceOutputId}.`);
    }

    if (!targetContract) {
      errors.push(`Handover route ${route.id} references unknown target tool ${route.targetToolId}.`);
    } else if (!targetContract.inputs.some(input => input.id === route.targetInputId)) {
      errors.push(`Handover route ${route.id} references unknown target input ${route.targetInputId}.`);
    }

    if (!Array.isArray(route.acceptKinds) || route.acceptKinds.length === 0) {
      errors.push(`Handover route ${route.id} must declare accepted kinds.`);
    } else {
      route.acceptKinds.forEach(kind => {
        if (!HANDOVER_KINDS.has(kind)) {
          errors.push(`Handover route ${route.id} has unsupported accepted kind ${kind}.`);
        }
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

function validatePorts(errors, contract, portType) {
  const seenPortIds = new Set();

  (contract[portType] || []).forEach(port => {
    if (!port.id) {
      errors.push(`${contract.toolId} has a ${portType} port without an id.`);
    }

    if (seenPortIds.has(port.id)) {
      errors.push(`${contract.toolId} has duplicate ${portType} port ${port.id}.`);
    }

    seenPortIds.add(port.id);

    if (!port.selector) {
      errors.push(`${contract.toolId}.${port.id} is missing a selector.`);
    }

    if (!HANDOVER_KINDS.has(port.kind)) {
      errors.push(`${contract.toolId}.${port.id} has unsupported kind ${port.kind}.`);
    }
  });
}

function getStatefulControls(root) {
  return Array.from(root.querySelectorAll('input, textarea, select'))
    .filter(control => !shouldIgnoreControl(control));
}

function shouldIgnoreControl(control) {
  const type = String(control?.type || '').toLocaleLowerCase('en-GB');
  return ['button', 'file', 'hidden', 'image', 'reset', 'submit'].includes(type);
}

function serialiseControl(control, index) {
  const selector = control.id ? `#${escapeSelectorId(control.id)}` : '';
  const type = String(control.type || '').toLocaleLowerCase('en-GB');

  if (type === 'checkbox' || type === 'radio') {
    return {
      selector,
      index,
      type,
      value: Boolean(control.checked)
    };
  }

  if (control.tagName?.toLocaleLowerCase('en-GB') === 'select' && control.multiple) {
    return {
      selector,
      index,
      type: 'select-multiple',
      value: Array.from(control.options).filter(option => option.selected).map(option => option.value)
    };
  }

  return {
    selector,
    index,
    type,
    value: control.value ?? ''
  };
}

function setControlValue(control, value, savedControl = {}) {
  if (!control || shouldIgnoreControl(control)) {
    return false;
  }

  const type = String(control.type || savedControl.type || '').toLocaleLowerCase('en-GB');

  if (type === 'checkbox' || type === 'radio') {
    control.checked = Boolean(value);
  } else if (savedControl.type === 'select-multiple' && control.options) {
    const selectedValues = new Set(Array.isArray(value) ? value : []);
    Array.from(control.options).forEach(option => {
      option.selected = selectedValues.has(option.value);
    });
  } else {
    control.value = String(value ?? '');
  }

  dispatchControlEvents(control);
  return true;
}

function dispatchControlEvents(control) {
  if (typeof Event !== 'function' || typeof control.dispatchEvent !== 'function') {
    return;
  }

  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function readControlValue(control) {
  if (!control) {
    return '';
  }

  return control.value ?? control.textContent ?? '';
}

function hasSchemaKeyword(value) {
  return [
    'additionalProperties',
    'allOf',
    'anyOf',
    'const',
    'enum',
    'items',
    'oneOf',
    'properties',
    'required'
  ].some(keyword => Object.prototype.hasOwnProperty.call(value, keyword));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isBase64HandoverValue(value) {
  const parsedBase64 = extractBase64Payload(value);
  const cleaned = parsedBase64
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  return cleaned.length > 0
    && cleaned.length % 4 !== 1
    && /^[A-Za-z0-9+/]*={0,2}$/.test(cleaned);
}

function extractBase64Payload(value) {
  const dataUrlMatch = String(value ?? '').trim().match(/^data:[^,]*;base64,(.*)$/is);

  if (dataUrlMatch) {
    return dataUrlMatch[1];
  }

  const commaIndex = String(value ?? '').indexOf('base64,');
  return commaIndex >= 0 ? String(value).slice(commaIndex + 'base64,'.length) : String(value ?? '');
}

function isXmlHandoverValue(value) {
  const trimmedValue = String(value ?? '').trim();

  if (!trimmedValue.startsWith('<')) {
    return false;
  }

  const tags = trimmedValue.match(/<[^>]+>/g) || [];
  const stack = [];
  let rootCount = 0;

  for (const tag of tags) {
    if (/^<\?/.test(tag) || /^<!--/.test(tag) || /^<!\[CDATA\[/.test(tag) || /^<!doctype\s/i.test(tag)) {
      continue;
    }

    const nameMatch = tag.match(/^<\s*\/?\s*([A-Za-z_][\w:.-]*)/);

    if (!nameMatch) {
      return false;
    }

    const name = nameMatch[1];

    if (/^<\s*\//.test(tag)) {
      if (stack.pop() !== name) {
        return false;
      }
      continue;
    }

    if (stack.length === 0) {
      rootCount += 1;
    }

    if (!/\/\s*>$/.test(tag)) {
      stack.push(name);
    }
  }

  return rootCount === 1 && stack.length === 0;
}

function escapeSelectorId(id) {
  return String(id).replace(/[^A-Za-z0-9_-]/g, character => `\\${character}`);
}
