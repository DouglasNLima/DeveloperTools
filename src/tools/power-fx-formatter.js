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

export const POWER_FX_OUTPUT_MODES = [
  { value: 'formatted', label: 'Formatted formula' },
  { value: 'review', label: 'Review report' },
  { value: 'commented', label: 'Commented snippet' }
];

export function formatPowerFxSnippet(options = {}) {
  const formula = normaliseFormula(options.input);
  const validation = validatePowerFxSyntax(formula);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const formatted = formatFormula(formula);
  const functions = extractPowerFxFunctionNames(formula);
  const delegationRisks = analysePowerFxDelegationRisks({ formula, functions });
  const warnings = buildPowerFxWarnings({
    formula,
    functions,
    delegationRisks
  });
  const outputMode = normaliseOutputMode(options.outputMode);
  const output = buildPowerFxOutput({
    formula,
    formatted,
    functions,
    warnings,
    delegationRisks,
    outputMode
  });
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    formula,
    formatted,
    output,
    outputMode,
    outputType: POWER_FX_OUTPUT_MODES.find(mode => mode.value === outputMode).label,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    functions,
    delegationRisks,
    warnings,
    summary: {
      functionCount: functions.length,
      lineCount: output.split('\n').length,
      formattedLineCount: formatted.split('\n').length,
      unknownFunctionCount: functions.filter(name => !knownFunctions.has(name.toLowerCase())).length,
      delegationRiskCount: delegationRisks.length
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

export function analysePowerFxDelegationRisks(options = {}) {
  const formula = String(options.formula || '');
  const functions = Array.isArray(options.functions) ? options.functions : extractPowerFxFunctionNames(formula);
  const lowerFunctions = new Set(functions.map(name => name.toLowerCase()));
  const risks = [];

  addDelegationRisk(risks, lowerFunctions, ['search'], 'Search delegation depends on the data source and searchable columns.');
  addDelegationRisk(risks, lowerFunctions, ['collect', 'clearcollect'], 'Collections are loaded client-side and can hide delegation limits.');
  addDelegationRisk(risks, lowerFunctions, ['forall'], 'ForAll often runs client-side over the returned records.');
  addDelegationRisk(risks, lowerFunctions, ['countif'], 'CountIf delegation support depends on the connector and enhanced delegation settings.');

  if (/\bin\b/i.test(stripQuotedPowerFxText(formula))) {
    risks.push({
      rule: 'in-operator',
      message: 'The in operator is delegation-sensitive for many connectors.',
      functions: []
    });
  }

  return risks;
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

  if (/\bCollect\s*\(|\bClearCollect\s*\(/i.test(options.formula)) {
    warnings.push('Collect and ClearCollect can hide delegation limits when loading records into local collections.');
  }

  if (unknownFunctions.length > 0) {
    warnings.push(`Review unknown function names: ${unknownFunctions.join(', ')}.`);
  }

  return warnings;
}

function buildPowerFxOutput(report) {
  if (report.outputMode === 'review') {
    return formatPowerFxReviewReport(report);
  }

  if (report.outputMode === 'commented') {
    return formatCommentedPowerFxSnippet(report);
  }

  return report.formatted;
}

function formatPowerFxReviewReport(report) {
  return [
    '# Power Fx review',
    '',
    `Functions: ${report.functions.length.toLocaleString('en-GB')}`,
    `Warnings: ${report.warnings.length.toLocaleString('en-GB')}`,
    `Delegation risks: ${report.delegationRisks.length.toLocaleString('en-GB')}`,
    '',
    '## Warnings',
    ...(report.warnings.length === 0 ? ['- None'] : report.warnings.map(warning => `- ${warning}`)),
    '',
    '## Delegation Checklist',
    ...(report.delegationRisks.length === 0 ? ['- No obvious delegation-sensitive patterns found.'] : report.delegationRisks.map(risk => `- ${risk.message}`)),
    '',
    '## Functions',
    ...(report.functions.length === 0 ? ['- None'] : report.functions.map(name => `- ${name}`)),
    '',
    '## Formatted Formula',
    '```powerfx',
    report.formatted,
    '```'
  ].join('\n');
}

function formatCommentedPowerFxSnippet(report) {
  const comments = [
    '// Power Fx review',
    ...(report.warnings.length === 0 ? ['// Warnings: none'] : report.warnings.map(warning => `// Warning: ${warning}`)),
    ...(report.delegationRisks.length === 0 ? ['// Delegation: no obvious delegation-sensitive patterns found'] : report.delegationRisks.map(risk => `// Delegation: ${risk.message}`))
  ];

  return [
    ...comments,
    report.formatted
  ].join('\n');
}

function addDelegationRisk(risks, lowerFunctions, functionNames, message) {
  const matched = functionNames.filter(name => lowerFunctions.has(name));

  if (matched.length === 0) {
    return;
  }

  risks.push({
    rule: matched.join(','),
    message,
    functions: matched
  });
}

function normaliseOutputMode(value) {
  return POWER_FX_OUTPUT_MODES.some(mode => mode.value === value) ? value : 'formatted';
}

function stripQuotedPowerFxText(value) {
  let output = '';
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
      output += ' ';
      continue;
    }

    if (character === '"' || character === '\'') {
      quote = character;
      output += ' ';
      continue;
    }

    output += character;
  }

  return output;
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
