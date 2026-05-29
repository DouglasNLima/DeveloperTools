import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
