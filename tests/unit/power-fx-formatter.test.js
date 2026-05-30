import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analysePowerFxDelegationRisks,
  extractPowerFxFunctionNames,
  formatFormula,
  formatPowerFxSnippet,
  normaliseFormula,
  validatePowerFxSyntax
} from '../../src/tools/power-fx-formatter.js';

test('formats nested Power Fx formulas predictably', () => {
  const result = formatPowerFxSnippet({
    input: 'If(IsBlank(TextInput1.Text), Notify("Missing"), Patch(Accounts, Defaults(Accounts), { Name: TextInput1.Text }))'
  });

  assert.equal(result.formatted, [
    'If(',
    '  IsBlank(',
    '    TextInput1.Text',
    '  ),',
    '  Notify(',
    '    "Missing"',
    '  ),',
    '  Patch(',
    '    Accounts,',
    '    Defaults(',
    '      Accounts',
    '    ),',
    '    {',
    '      Name: TextInput1.Text',
    '    }',
    '  )',
    ')'
  ].join('\n'));
  assert.deepEqual(result.functions, ['If', 'IsBlank', 'Notify', 'Patch', 'Defaults']);
  assert.equal(result.summary.unknownFunctionCount, 0);
});

test('validates formula syntax and normalises input', () => {
  assert.equal(normaliseFormula('  Today()  '), 'Today()');
  assert.equal(validatePowerFxSyntax('Notify("Saved")').valid, true);
  assert.equal(validatePowerFxSyntax("'Display Name'").valid, true);
  assert.deepEqual(validatePowerFxSyntax('If(IsBlank(TextInput1.Text)'), {
    valid: false,
    message: 'Formula has an unclosed ( character.'
  });
  assert.throws(
    () => formatPowerFxSnippet({ input: '' }),
    /Enter a Power Fx formula/
  );
});

test('extracts function names and formats raw formulas directly', () => {
  assert.deepEqual(extractPowerFxFunctionNames('Set(varName, Lower(User().Email))'), ['Set', 'Lower', 'User']);
  assert.equal(formatFormula('Set(varName, 1); Notify("Saved")'), [
    'Set(',
    '  varName,',
    '  1',
    ');',
    'Notify(',
    '  "Saved"',
    ')'
  ].join('\n'));
});

test('emits practical Power Fx warnings', () => {
  const result = formatPowerFxSnippet({
    input: 'If(!IsBlank(TextInput1.Text), Patch(Accounts, AccountGallery.Selected, { Name: TextInput1.Text }); Notify("Saved"))'
  });

  assert.equal(result.warnings.length, 3);
  assert.match(result.warnings[0], /Not/);
  assert.match(result.warnings[1], /Semicolon/);
  assert.match(result.warnings[2], /Defaults/);
});

test('warns for unknown Power Fx functions', () => {
  const result = formatPowerFxSnippet({
    input: 'CustomFxThing(1)'
  });

  assert.equal(result.summary.unknownFunctionCount, 1);
  assert.match(result.warnings[0], /CustomFxThing/);
});

test('builds Power Fx review and commented output modes', () => {
  const review = formatPowerFxSnippet({
    input: 'ClearCollect(colAccounts, Filter(Accounts, "A" in Name))',
    outputMode: 'review'
  });
  const commented = formatPowerFxSnippet({
    input: 'ClearCollect(colAccounts, Filter(Accounts, "A" in Name))',
    outputMode: 'commented'
  });

  assert.equal(review.outputType, 'Review report');
  assert.match(review.output, /## Delegation Checklist/);
  assert.match(review.output, /Collections are loaded client-side/);
  assert.equal(review.summary.delegationRiskCount, 2);
  assert.equal(commented.outputType, 'Commented snippet');
  assert.match(commented.output, /^\/\/ Power Fx review/);
  assert.match(commented.output, /ClearCollect/);
  assert.equal(analysePowerFxDelegationRisks({ formula: 'ForAll(Accounts, Collect(col, ThisRecord))' }).length, 2);
});
