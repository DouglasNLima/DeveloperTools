import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFunctionNames,
  extractReferences,
  formatPowerAutomateExpression,
  normaliseExpression,
  splitTopLevelArguments,
  validateExpressionSyntax
} from '../../src/tools/power-automate-expression.js';

test('formats nested Power Automate expressions predictably', () => {
  const result = formatPowerAutomateExpression({
    input: "@{concat(triggerOutputs()?['body/name'], ' - ', variables('suffix'))}"
  });

  assert.equal(result.formatted, [
    'concat(',
    "  triggerOutputs()?['body/name'],",
    "  ' - ',",
    "  variables('suffix')",
    ')'
  ].join('\n'));
  assert.equal(result.wrapperType, '@{ } interpolation');
  assert.deepEqual(result.functions, ['concat', 'triggerOutputs', 'variables']);
  assert.deepEqual(result.references, ['suffix']);
  assert.equal(result.warnings.length, 1);
});

test('normalises expression wrappers', () => {
  assert.deepEqual(normaliseExpression('@utcNow()'), {
    expression: 'utcNow()',
    wrapperType: '@ expression'
  });
  assert.deepEqual(normaliseExpression('utcNow()'), {
    expression: 'utcNow()',
    wrapperType: 'Plain expression'
  });
  assert.throws(
    () => normaliseExpression(''),
    /Enter a Power Automate expression/
  );
});

test('validates balanced expression syntax', () => {
  assert.equal(validateExpressionSyntax("concat('a', variables('b'))").valid, true);
  assert.equal(validateExpressionSyntax("concat('it''s fine')").valid, true);
  assert.deepEqual(validateExpressionSyntax("concat('a'"), {
    valid: false,
    message: 'Expression has an unclosed ( character.'
  });
  assert.deepEqual(validateExpressionSyntax("concat('a)"), {
    valid: false,
    message: 'Expression has an unclosed string literal.'
  });
});

test('splits top-level arguments and extracts functions and references', () => {
  const expression = "if(equals(items('Apply_to_each')?['status'], 'Open'), outputs('Compose'), 'Closed')";

  assert.deepEqual(splitTopLevelArguments("equals(a, b), 'x,y', variables('name')"), [
    'equals(a, b)',
    "'x,y'",
    "variables('name')"
  ]);
  assert.deepEqual(extractFunctionNames(expression), ['if', 'equals', 'items', 'outputs']);
  assert.deepEqual(extractReferences(expression), ['Apply_to_each', 'Compose']);
});

test('warns for unknown workflow functions', () => {
  const result = formatPowerAutomateExpression({
    input: "customFunction(variables('name'))"
  });

  assert.equal(result.summary.unknownFunctionCount, 1);
  assert.match(result.warnings[0], /customFunction/);
});
