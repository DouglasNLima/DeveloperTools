import { formatBytes } from './base64.js';

const knownFunctions = new Set([
  'add',
  'adddays',
  'addhours',
  'addminutes',
  'addseconds',
  'and',
  'base64',
  'base64tobinary',
  'base64tostring',
  'body',
  'bool',
  'coalesce',
  'concat',
  'contains',
  'convertfromutc',
  'converttimezone',
  'convertutc',
  'createarray',
  'decodebase64',
  'decodeuricomponent',
  'div',
  'empty',
  'encodeuricomponent',
  'endswith',
  'equals',
  'first',
  'float',
  'formatdatetime',
  'guid',
  'if',
  'indexof',
  'int',
  'item',
  'items',
  'join',
  'json',
  'last',
  'lastindexof',
  'length',
  'less',
  'lessorequals',
  'max',
  'min',
  'mod',
  'mul',
  'not',
  'or',
  'outputs',
  'parameters',
  'range',
  'replace',
  'skip',
  'split',
  'startswith',
  'string',
  'sub',
  'substring',
  'take',
  'ticks',
  'tolower',
  'toupper',
  'triggerbody',
  'triggeroutputs',
  'trim',
  'utcnow',
  'variables',
  'workflow'
]);

export const POWER_AUTOMATE_OUTPUT_WRAPPERS = [
  { value: 'plain', label: 'Plain expression' },
  { value: 'expression', label: '@ expression' },
  { value: 'interpolation', label: '@{ } interpolation' }
];

export const POWER_AUTOMATE_EXPRESSION_TEMPLATES = [
  {
    value: 'trigger-field',
    label: 'Trigger field',
    requiredFields: ['fieldPath']
  },
  {
    value: 'action-body-field',
    label: 'Action body field',
    requiredFields: ['actionName', 'fieldPath']
  },
  {
    value: 'trigger-field-default',
    label: 'Trigger field with default',
    requiredFields: ['fieldPath', 'defaultValue']
  },
  {
    value: 'variable-default',
    label: 'Variable with default',
    requiredFields: ['variableName', 'defaultValue']
  }
];

const templateByValue = new Map(POWER_AUTOMATE_EXPRESSION_TEMPLATES.map(template => [template.value, template]));

export function formatPowerAutomateExpression(options = {}) {
  const normalised = normaliseExpression(options.input);
  const validation = validateExpressionSyntax(normalised.expression);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const formatted = formatExpressionSegment(normalised.expression, 0);
  const outputWrapper = normaliseOutputWrapper(options.outputWrapper);
  const output = wrapPowerAutomateExpression(formatted, outputWrapper);
  const functions = extractFunctionNames(normalised.expression);
  const referenceDetails = extractReferenceDetails(normalised.expression);
  const references = extractReferences(normalised.expression);
  const warnings = buildWarnings({
    wrapperType: normalised.wrapperType,
    functions,
    outputWrapper
  });
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    expression: normalised.expression,
    formatted,
    output,
    outputType: 'Power Automate expression',
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    wrapperType: normalised.wrapperType,
    outputWrapper,
    outputWrapperLabel: POWER_AUTOMATE_OUTPUT_WRAPPERS.find(wrapper => wrapper.value === outputWrapper).label,
    functions,
    references,
    referenceDetails,
    warnings,
    summary: {
      functionCount: functions.length,
      referenceCount: referenceDetails.length,
      unknownFunctionCount: functions.filter(name => !knownFunctions.has(name.toLowerCase())).length
    }
  };
}

export function buildPowerAutomateExpressionTemplate(options = {}) {
  const template = getTemplate(options.template || options.templateId);
  const context = normaliseTemplateContext(options);

  validateTemplateContext(template, context);

  const expression = buildTemplateExpression(template.value, context);

  return {
    template,
    templateId: template.value,
    templateLabel: template.label,
    expression,
    output: expression
  };
}

export function wrapPowerAutomateExpression(expression, wrapperMode = 'plain') {
  const value = String(expression ?? '').trim();
  const mode = normaliseOutputWrapper(wrapperMode);

  if (mode === 'expression') {
    return `@${value}`;
  }

  if (mode === 'interpolation') {
    return `@{${value}}`;
  }

  return value;
}

export function normaliseExpression(input) {
  const raw = String(input ?? '').trim();

  if (!raw) {
    throw new Error('Enter a Power Automate expression to format.');
  }

  if (raw.startsWith('@{') && raw.endsWith('}')) {
    return {
      expression: raw.slice(2, -1).trim(),
      wrapperType: '@{ } interpolation'
    };
  }

  if (raw.startsWith('@')) {
    return {
      expression: raw.slice(1).trim(),
      wrapperType: '@ expression'
    };
  }

  return {
    expression: raw,
    wrapperType: 'Plain expression'
  };
}

export function validateExpressionSyntax(expression) {
  const pairs = new Map([
    [')', '('],
    [']', '['],
    ['}', '{']
  ]);
  const stack = [];
  let quote = null;

  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    const next = expression[index + 1];

    if (quote) {
      if (character === quote) {
        if (quote === '\'' && next === '\'') {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === '\'' || character === '"') {
      quote = character;
      continue;
    }

    if ('([{'.includes(character)) {
      stack.push(character);
      continue;
    }

    if (pairs.has(character)) {
      const expected = pairs.get(character);
      const actual = stack.pop();

      if (actual !== expected) {
        return {
          valid: false,
          message: `Expression has an unmatched ${character} character.`
        };
      }
    }
  }

  if (quote) {
    return {
      valid: false,
      message: 'Expression has an unclosed string literal.'
    };
  }

  if (stack.length > 0) {
    return {
      valid: false,
      message: `Expression has an unclosed ${stack.at(-1)} character.`
    };
  }

  return {
    valid: true,
    message: ''
  };
}

export function extractFunctionNames(expression) {
  const names = [];
  const seen = new Set();
  const functionPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match = functionPattern.exec(expression);

  while (match) {
    const name = match[1];
    const key = name.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      names.push(name);
    }

    match = functionPattern.exec(expression);
  }

  return names;
}

export function extractReferences(expression) {
  const references = extractReferenceDetails(expression).map(detail => detail.value);
  return [...new Set(references)];
}

export function extractReferenceDetails(expression) {
  const source = String(expression ?? '');
  const details = [];
  const namedCallPattern = /\b(variables|outputs|body|items|parameters)\s*\(\s*'((?:''|[^'])*)'\s*\)/gi;
  const triggerPattern = /\b(triggerOutputs|triggerBody)\s*\(\s*\)/gi;
  let match = namedCallPattern.exec(source);

  while (match) {
    addReferenceDetail(details, {
      index: match.index,
      type: canonicalReferenceType(match[1]),
      label: referenceLabel(match[1]),
      name: unescapeExpressionLiteral(match[2]),
      path: readAccessPath(source, match.index + match[0].length)
    });
    match = namedCallPattern.exec(source);
  }

  match = triggerPattern.exec(source);

  while (match) {
    addReferenceDetail(details, {
      index: match.index,
      type: canonicalReferenceType(match[1]),
      label: referenceLabel(match[1]),
      name: '',
      path: readAccessPath(source, match.index + match[0].length)
    });
    match = triggerPattern.exec(source);
  }

  return details
    .sort((left, right) => left.index - right.index)
    .map(({ index, ...detail }) => detail);
}

export function splitTopLevelArguments(value) {
  const args = [];
  let start = 0;
  let depth = 0;
  let quote = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];

    if (quote) {
      if (character === quote) {
        if (quote === '\'' && next === '\'') {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === '\'' || character === '"') {
      quote = character;
      continue;
    }

    if ('([{'.includes(character)) {
      depth += 1;
      continue;
    }

    if (')]}'.includes(character)) {
      depth -= 1;
      continue;
    }

    if (character === ',' && depth === 0) {
      args.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  const tail = value.slice(start).trim();

  if (tail) {
    args.push(tail);
  }

  return args;
}

function getTemplate(value) {
  const template = templateByValue.get(value || POWER_AUTOMATE_EXPRESSION_TEMPLATES[0].value);

  if (!template) {
    throw new Error('Choose a supported Power Automate expression template.');
  }

  return template;
}

function normaliseTemplateContext(options) {
  return {
    actionName: normaliseTemplateText(options.actionName),
    fieldPath: normaliseTemplateText(options.fieldPath),
    variableName: normaliseTemplateText(options.variableName),
    defaultValue: normaliseTemplateText(options.defaultValue)
  };
}

function validateTemplateContext(template, context) {
  const missing = template.requiredFields.filter(field => !context[field]);

  if (missing.length > 0) {
    throw new Error(`Enter ${formatTemplateFieldList(missing)} before using the ${template.label} template.`);
  }
}

function buildTemplateExpression(templateValue, context) {
  switch (templateValue) {
    case 'trigger-field':
      return `triggerOutputs()?['body/${escapeExpressionLiteral(normaliseTriggerFieldPath(context.fieldPath))}']`;
    case 'action-body-field':
      return `body('${escapeExpressionLiteral(context.actionName)}')?['${escapeExpressionLiteral(context.fieldPath)}']`;
    case 'trigger-field-default':
      return `coalesce(triggerOutputs()?['body/${escapeExpressionLiteral(normaliseTriggerFieldPath(context.fieldPath))}'], '${escapeExpressionLiteral(context.defaultValue)}')`;
    case 'variable-default':
      return `coalesce(variables('${escapeExpressionLiteral(context.variableName)}'), '${escapeExpressionLiteral(context.defaultValue)}')`;
    default:
      throw new Error('Choose a supported Power Automate expression template.');
  }
}

function normaliseTriggerFieldPath(value) {
  return String(value ?? '').trim().replace(/^body[/.]/i, '');
}

function normaliseTemplateText(value) {
  return String(value ?? '').trim();
}

function formatTemplateFieldList(fields) {
  const labels = fields.map(field => {
    const fieldLabels = {
      actionName: 'an action name',
      fieldPath: 'a field path',
      variableName: 'a variable name',
      defaultValue: 'a default value'
    };

    return fieldLabels[field] || field;
  });

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

function normaliseOutputWrapper(value) {
  return POWER_AUTOMATE_OUTPUT_WRAPPERS.some(wrapper => wrapper.value === value) ? value : 'plain';
}

function buildWarnings(options) {
  const warnings = [];
  const unknownFunctions = options.functions.filter(name => !knownFunctions.has(name.toLowerCase()));

  if (options.wrapperType !== 'Plain expression' && options.outputWrapper === 'plain') {
    warnings.push(`${options.wrapperType} wrapper was removed so the expression can be edited cleanly.`);
  } else if (options.wrapperType !== 'Plain expression') {
    warnings.push(`${options.wrapperType} wrapper was normalised before formatting.`);
  }

  if (unknownFunctions.length > 0) {
    warnings.push(`Review unknown function names: ${unknownFunctions.join(', ')}.`);
  }

  return warnings;
}

function addReferenceDetail(details, detail) {
  const normalised = {
    index: detail.index,
    type: detail.type,
    label: detail.label,
    name: detail.name,
    path: detail.path,
    value: formatReferenceValue(detail)
  };
  const key = [normalised.type.toLowerCase(), normalised.name, normalised.path].join('\u0000');

  if (!details.some(item => [item.type.toLowerCase(), item.name, item.path].join('\u0000') === key)) {
    details.push(normalised);
  }
}

function referenceLabel(type) {
  const labels = {
    body: 'Action body',
    items: 'Loop item',
    outputs: 'Action output',
    parameters: 'Parameter',
    triggerBody: 'Trigger body',
    triggerOutputs: 'Trigger output',
    variables: 'Variable'
  };

  return labels[canonicalReferenceType(type)] || type;
}

function canonicalReferenceType(type) {
  const types = {
    body: 'body',
    items: 'items',
    outputs: 'outputs',
    parameters: 'parameters',
    triggerbody: 'triggerBody',
    triggeroutputs: 'triggerOutputs',
    variables: 'variables'
  };

  return types[String(type ?? '').toLowerCase()] || String(type ?? '');
}

function formatReferenceValue(detail) {
  if (detail.name && detail.path) {
    return `${detail.name}.${detail.path}`;
  }

  if (detail.name) {
    return detail.name;
  }

  if (detail.path) {
    return detail.path;
  }

  return detail.type;
}

function readAccessPath(source, startIndex) {
  const segments = [];
  let cursor = startIndex;

  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);

    if (source[cursor] === '?') {
      cursor += 1;
      cursor = skipWhitespace(source, cursor);
    }

    if (source[cursor] !== '[') {
      break;
    }

    cursor += 1;
    cursor = skipWhitespace(source, cursor);

    if (source[cursor] !== '\'') {
      break;
    }

    const literal = readSingleQuotedLiteral(source, cursor);

    if (!literal) {
      break;
    }

    cursor = skipWhitespace(source, literal.endIndex);

    if (source[cursor] !== ']') {
      break;
    }

    segments.push(literal.value);
    cursor += 1;
  }

  return segments.join('.');
}

function readSingleQuotedLiteral(source, quoteIndex) {
  let value = '';

  for (let index = quoteIndex + 1; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (character === '\'' && next === '\'') {
      value += '\'';
      index += 1;
      continue;
    }

    if (character === '\'') {
      return {
        value,
        endIndex: index + 1
      };
    }

    value += character;
  }

  return null;
}

function skipWhitespace(source, startIndex) {
  let index = startIndex;

  while (/\s/.test(source[index] || '')) {
    index += 1;
  }

  return index;
}

function escapeExpressionLiteral(value) {
  return String(value ?? '').replace(/'/g, '\'\'');
}

function unescapeExpressionLiteral(value) {
  return String(value ?? '').replace(/''/g, '\'');
}

function formatExpressionSegment(segment, level) {
  const trimmed = segment.trim();
  const call = parseWholeFunctionCall(trimmed);

  if (!call) {
    return trimmed;
  }

  const args = splitTopLevelArguments(call.args);

  if (args.length === 0) {
    return `${call.name}()`;
  }

  const hasNestedArgument = args.some(arg => parseWholeFunctionCall(arg.trim()));

  if (trimmed.length <= 90 && args.length <= 2 && !hasNestedArgument) {
    return trimmed;
  }

  const childIndent = '  '.repeat(level + 1);
  const currentIndent = '  '.repeat(level);
  const formattedArgs = args.map(arg => `${childIndent}${formatExpressionSegment(arg, level + 1)}`);

  return [
    `${call.name}(`,
    formattedArgs.join(',\n'),
    `${currentIndent})`
  ].join('\n');
}

function parseWholeFunctionCall(value) {
  const match = value.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(/);

  if (!match) {
    return null;
  }

  const openIndex = value.indexOf('(', match[1].length);
  const closeIndex = findMatchingClose(value, openIndex);

  if (closeIndex !== value.length - 1) {
    return null;
  }

  return {
    name: match[1],
    args: value.slice(openIndex + 1, closeIndex)
  };
}

function findMatchingClose(value, openIndex) {
  let depth = 0;
  let quote = null;

  for (let index = openIndex; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];

    if (quote) {
      if (character === quote) {
        if (quote === '\'' && next === '\'') {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === '\'' || character === '"') {
      quote = character;
      continue;
    }

    if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}
