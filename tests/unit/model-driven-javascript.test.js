import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyseModelDrivenJavaScript,
  buildClientApiMigrationReport,
  buildCommandBarJavaScriptSnippet,
  buildFormEventHandlerSnippet,
  buildFormValidationSnippet,
  buildXrmWebApiSnippet,
  extractFunctionCandidates
} from '../../src/tools/model-driven-javascript.js';

test('reviews model-driven JavaScript for Client API risks', () => {
  const result = analyseModelDrivenJavaScript({
    source: [
      'function onLoad() {',
      '  var name = Xrm.Page.getAttribute("name").getValue();',
      '  document.getElementById("crmForm");',
      '  Xrm.WebApi.retrieveRecord("account", "11111111-1111-4111-8111-111111111111");',
      '  return "https://contoso.crm.dynamics.com";',
      '}'
    ].join('\n')
  });

  assert.equal(result.summary.high, 2);
  assert.ok(result.findings.some(finding => finding.code === 'deprecated-xrm-page'));
  assert.ok(result.findings.some(finding => finding.code === 'unhandled-webapi-promise'));
  assert.ok(result.findings.some(finding => finding.code === 'unsupported-dom-access'));
  assert.match(result.reportMarkdown, /Model-driven JavaScript review/);
});

test('builds Client API migration guidance for Xrm.Page patterns', () => {
  const result = buildClientApiMigrationReport({
    source: 'function onLoad(){ var name = Xrm.Page.getAttribute("name").getValue(); Xrm.Page.context.getUserId(); }',
    namespace: 'Contoso.Account',
    functionName: 'onLoad'
  });

  assert.equal(result.summary.replacementCount, 2);
  assert.match(result.reportMarkdown, /formContext.getAttribute\("name"\)/);
  assert.match(result.handlerSnippet, /executionContext.getFormContext/);
});

test('extracts model-driven JavaScript function candidates', () => {
  const functions = extractFunctionCandidates([
    'function onLoad(executionContext) {}',
    'Contoso.Account.onSave = async function (executionContext) {}'
  ].join('\n'));

  assert.deepEqual(functions.map(fn => fn.name), ['onLoad', 'Contoso.Account.onSave']);
  assert.deepEqual(functions[0].parameters, ['executionContext']);
});

test('builds form event handler snippets with registration notes', () => {
  const result = buildFormEventHandlerSnippet({
    eventType: 'onchange',
    namespace: 'Contoso.Account',
    functionName: 'onNameChange',
    fieldName: 'name'
  });

  assert.equal(result.outputType, 'OnChange handler');
  assert.match(result.output, /Contoso.Account.onNameChange/);
  assert.match(result.output, /Pass execution context/);
});

test('builds Xrm.WebApi snippets and validation errors', () => {
  const result = buildXrmWebApiSnippet({
    operation: 'retrieveMultipleRecords',
    entityName: 'account',
    select: 'name,accountnumber',
    filter: 'statecode eq 0',
    functionName: 'retrieveAccounts'
  });

  assert.match(result.code, /Xrm.WebApi.retrieveMultipleRecords/);
  assert.equal(result.warnings.length, 0);
  assert.throws(
    () => buildXrmWebApiSnippet({ operation: 'createRecord', entityName: 'account', dataJson: '[' }),
    /valid JSON/
  );
});

test('builds validation and command bar snippets', () => {
  const validation = buildFormValidationSnippet({
    namespace: 'Contoso.Account',
    functionName: 'validateName',
    fieldName: 'name',
    ruleType: 'maxLength',
    maxLength: '50',
    message: 'Use a shorter name.',
    runOnSave: true
  });
  const command = buildCommandBarJavaScriptSnippet({
    contextType: 'grid',
    namespace: 'Contoso.Commands',
    functionName: 'updateSelected',
    entityName: 'account',
    useConfirmation: true,
    includeWebApiUpdate: true
  });

  assert.match(validation.output, /preventDefault/);
  assert.match(validation.output, /setNotification/);
  assert.match(command.output, /SelectedControl/);
  assert.match(command.output, /Promise.all/);
});
