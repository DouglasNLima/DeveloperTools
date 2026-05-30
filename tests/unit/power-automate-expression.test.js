import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPowerAutomateExpressionTemplate,
  extractReferenceDetails,
  extractFunctionNames,
  extractReferences,
  formatPowerAutomateExpression,
  normaliseExpression,
  splitTopLevelArguments,
  validateExpressionSyntax,
  wrapPowerAutomateExpression
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
  assert.deepEqual(result.references, ['body/name', 'suffix']);
  assert.equal(result.summary.referenceCount, 2);
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
  assert.deepEqual(extractReferences(expression), ['Apply_to_each.status', 'Compose']);
  assert.deepEqual(extractReferenceDetails(expression), [
    {
      type: 'items',
      label: 'Loop item',
      name: 'Apply_to_each',
      path: 'status',
      value: 'Apply_to_each.status'
    },
    {
      type: 'outputs',
      label: 'Action output',
      name: 'Compose',
      path: '',
      value: 'Compose'
    }
  ]);
});

test('warns for unknown workflow functions', () => {
  const result = formatPowerAutomateExpression({
    input: "customFunction(variables('name'))"
  });

  assert.equal(result.summary.unknownFunctionCount, 1);
  assert.match(result.warnings[0], /customFunction/);
});

test('builds safe field expression templates', () => {
  assert.equal(
    buildPowerAutomateExpressionTemplate({
      template: 'trigger-field',
      fieldPath: 'body/name'
    }).expression,
    "triggerOutputs()?['body/name']"
  );
  assert.equal(
    buildPowerAutomateExpressionTemplate({
      template: 'action-body-field',
      actionName: 'Get contact',
      fieldPath: 'emailaddress1'
    }).expression,
    "body('Get contact')?['emailaddress1']"
  );
});

test('builds default templates and escapes Power Automate string literals', () => {
  assert.equal(
    buildPowerAutomateExpressionTemplate({
      template: 'trigger-field-default',
      fieldPath: 'customer/name',
      defaultValue: "Contoso's customer"
    }).expression,
    "coalesce(triggerOutputs()?['body/customer/name'], 'Contoso''s customer')"
  );
  assert.equal(
    buildPowerAutomateExpressionTemplate({
      template: 'variable-default',
      variableName: "owner's name",
      defaultValue: 'Unknown'
    }).expression,
    "coalesce(variables('owner''s name'), 'Unknown')"
  );
});

test('wraps formatted expressions in requested output wrappers', () => {
  assert.equal(wrapPowerAutomateExpression('utcNow()', 'plain'), 'utcNow()');
  assert.equal(wrapPowerAutomateExpression('utcNow()', 'expression'), '@utcNow()');
  assert.equal(wrapPowerAutomateExpression('utcNow()', 'interpolation'), '@{utcNow()}');

  const result = formatPowerAutomateExpression({
    input: 'utcNow()',
    outputWrapper: 'expression'
  });

  assert.equal(result.output, '@utcNow()');
  assert.equal(result.outputWrapperLabel, '@ expression');
});

test('extracts trigger, action, loop, variable and parameter reference details', () => {
  const expression = [
    "concat(triggerBody()?['email'],",
    "body('Get contact')?['fullname'],",
    "outputs('Compose')?['body/value'],",
    "items('Apply_to_each')?['status'],",
    "variables('suffix'),",
    "parameters('Environment Name'))"
  ].join(' ');

  assert.deepEqual(extractReferenceDetails(expression), [
    {
      type: 'triggerBody',
      label: 'Trigger body',
      name: '',
      path: 'email',
      value: 'email'
    },
    {
      type: 'body',
      label: 'Action body',
      name: 'Get contact',
      path: 'fullname',
      value: 'Get contact.fullname'
    },
    {
      type: 'outputs',
      label: 'Action output',
      name: 'Compose',
      path: 'body/value',
      value: 'Compose.body/value'
    },
    {
      type: 'items',
      label: 'Loop item',
      name: 'Apply_to_each',
      path: 'status',
      value: 'Apply_to_each.status'
    },
    {
      type: 'variables',
      label: 'Variable',
      name: 'suffix',
      path: '',
      value: 'suffix'
    },
    {
      type: 'parameters',
      label: 'Parameter',
      name: 'Environment Name',
      path: '',
      value: 'Environment Name'
    }
  ]);
});

test('reports missing template fields clearly', () => {
  assert.throws(
    () => buildPowerAutomateExpressionTemplate({
      template: 'action-body-field',
      actionName: 'Get contact'
    }),
    /Enter a field path before using the Action body field template/
  );
});
