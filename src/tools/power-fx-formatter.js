import { formatBytes } from './base64.js';

const knownFunctions = new Set([
  'abs',
  'and',
  'average',
  'blank',
  'char',
  'clear',
  'clearcollect',
  'collect',
  'concat',
  'concatenate',
  'countif',
  'date',
  'dateadd',
  'datediff',
  'datetimevalue',
  'defaults',
  'filter',
  'find',
  'first',
  'forall',
  'if',
  'isblank',
  'isempty',
  'iserror',
  'isnumeric',
  'last',
  'left',
  'len',
  'lookup',
  'lower',
  'mid',
  'navigate',
  'newform',
  'notify',
  'not',
  'or',
  'patch',
  'remove',
  'reset',
  'right',
  'search',
  'select',
  'set',
  'sort',
  'sortbycolumns',
  'split',
  'submitform',
  'sum',
  'switch',
  'text',
  'timevalue',
  'today',
  'trim',
  'upper',
  'user',
  'value',
  'with'
]);

export function formatPowerFxSnippet(options = {}) {
  const formula = normaliseFormula(options.input);
  const validation = validatePowerFxSyntax(formula);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const formatted = formatFormula(formula);
  const functions = extractPowerFxFunctionNames(formula);
  const warnings = buildPowerFxWarnings({
    formula,
    functions
  });
  const outputBytes = new TextEncoder().encode(formatted).length;

  return {
    formula,
    formatted,
    output: formatted,
    outputType: 'Power Fx formula',
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    functions,
    warnings,
    summary: {
      functionCount: functions.length,
      lineCount: formatted.split('\n').length,
      unknownFunctionCount: functions.filter(name => !knownFunctions.has(name.toLowerCase())).length
    }
  };
}

export function normaliseFormula(input) {
  const formula = String(input ?? '').trim();

  if (!formula) {
    throw new Error('Enter a Power Fx formula to format.');
  }

  return formula;
}

export function validatePowerFxSyntax(formula) {
  const pairs = new Map([
    [')', '('],
    [']', '['],
    ['}', '{']
  ]);
  const stack = [];
  let quote = null;

  for (let index = 0; index < formula.length; index += 1) {
    const character = formula[index];
    const next = formula[index + 1];

    if (quote) {
      if (character === quote) {
        if (quote === '"' && next === '"') {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === '"' || character === '\'') {
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
          message: `Formula has an unmatched ${character} character.`
        };
      }
    }
  }

  if (quote) {
    return {
      valid: false,
      message: 'Formula has an unclosed string or quoted identifier.'
    };
  }

  if (stack.length > 0) {
    return {
      valid: false,
      message: `Formula has an unclosed ${stack.at(-1)} character.`
    };
  }

  return {
    valid: true,
    message: ''
  };
}

export function extractPowerFxFunctionNames(formula) {
  const names = [];
  const seen = new Set();
  const functionPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match = functionPattern.exec(formula);

  while (match) {
    const name = match[1];
    const key = name.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      names.push(name);
    }

    match = functionPattern.exec(formula);
  }

  return names;
}

export function formatFormula(formula) {
  const lines = [];
  let current = '';
  let indent = 0;
  let quote = null;

  function pushLine() {
    const trimmed = current.trim();

    if (trimmed) {
      lines.push(`${'  '.repeat(Math.max(indent, 0))}${trimmed}`);
    }

    current = '';
  }

  for (let index = 0; index < formula.length; index += 1) {
    const character = formula[index];
    const next = formula[index + 1];

    if (quote) {
      current += character;

      if (character === quote) {
        if (quote === '"' && next === '"') {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === '"' || character === '\'') {
      current += character;
      quote = character;
      continue;
    }

    if (character === '(' || character === '[' || character === '{') {
      current += character;
      pushLine();
      indent += 1;
      continue;
    }

    if (character === ')' || character === ']' || character === '}') {
      pushLine();
      indent -= 1;
      current = character;
      continue;
    }

    if (character === ',' || character === ';') {
      current += character;
      pushLine();
      continue;
    }

    if (/\s/.test(character)) {
      if (current && !/\s$/.test(current)) {
        current += ' ';
      }
      continue;
    }

    current += character;
  }

  pushLine();

  return lines.join('\n');
}

function buildPowerFxWarnings(options) {
  const warnings = [];
  const unknownFunctions = options.functions.filter(name => !knownFunctions.has(name.toLowerCase()));

  if (containsCharacterOutsideQuotes(options.formula, '!')) {
    warnings.push('Review ! operators; Not(...) is often clearer in shared Power Fx snippets.');
  }

  if (containsCharacterOutsideQuotes(options.formula, ';')) {
    warnings.push('Semicolon chaining can depend on app locale and authoring context.');
  }

  if (/\bPatch\s*\(/i.test(options.formula) && !/\bDefaults\s*\(/i.test(options.formula)) {
    warnings.push('Patch formulas without Defaults(...) should be checked for update versus create intent.');
  }

  if (unknownFunctions.length > 0) {
    warnings.push(`Review unknown function names: ${unknownFunctions.join(', ')}.`);
  }

  return warnings;
}

function containsCharacterOutsideQuotes(value, target) {
  let quote = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];

    if (quote) {
      if (character === quote) {
        if (quote === '"' && next === '"') {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === '"' || character === '\'') {
      quote = character;
      continue;
    }

    if (character === target) {
      return true;
    }
  }

  return false;
}
