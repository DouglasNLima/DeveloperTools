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

export function formatPowerAutomateExpression(options = {}) {
  const normalised = normaliseExpression(options.input);
  const validation = validateExpressionSyntax(normalised.expression);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const formatted = formatExpressionSegment(normalised.expression, 0);
  const functions = extractFunctionNames(normalised.expression);
  const references = extractReferences(normalised.expression);
  const warnings = buildWarnings({
    wrapperType: normalised.wrapperType,
    functions
  });
  const outputBytes = new TextEncoder().encode(formatted).length;

  return {
    expression: normalised.expression,
    formatted,
    output: formatted,
    outputType: 'Power Automate expression',
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    wrapperType: normalised.wrapperType,
    functions,
    references,
    warnings,
    summary: {
      functionCount: functions.length,
      referenceCount: references.length,
      unknownFunctionCount: functions.filter(name => !knownFunctions.has(name.toLowerCase())).length
    }
  };
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
  const references = [];
  const pattern = /\b(?:variables|outputs|body|items|parameters)\s*\(\s*'([^']+)'\s*\)/gi;
  let match = pattern.exec(expression);

  while (match) {
    references.push(match[1]);
    match = pattern.exec(expression);
  }

  return [...new Set(references)];
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

function buildWarnings(options) {
  const warnings = [];
  const unknownFunctions = options.functions.filter(name => !knownFunctions.has(name.toLowerCase()));

  if (options.wrapperType !== 'Plain expression') {
    warnings.push(`${options.wrapperType} wrapper was removed so the expression can be edited cleanly.`);
  }

  if (unknownFunctions.length > 0) {
    warnings.push(`Review unknown function names: ${unknownFunctions.join(', ')}.`);
  }

  return warnings;
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
