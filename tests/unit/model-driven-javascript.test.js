import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyseModelDrivenJavaScript,
  buildJavaScriptRuleSummary,
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
  assert.ok(result.findings.every(finding => finding.ruleId));
  assert.ok(result.findings.every(finding => finding.category));
  assert.ok(result.findings.every(finding => finding.confidence));
  assert.ok(result.findings.every(finding => finding.remediation));
  assert.equal(result.ruleSummary.rules['deprecated-xrm-page'].count, 1);
  assert.match(result.reportMarkdown, /Model-driven JavaScript review/);
  assert.match(result.reportMarkdown, /Rule summary/);
});

test('detects async OnSave hardening risks', () => {
  const result = analyseModelDrivenJavaScript({
    source: [
      'Contoso.Account.onSave = function (executionContext) {',
      '  Xrm.WebApi.retrieveRecord("account", "11111111-1111-4111-8111-111111111111").then(function () {});',
      '  if (window.shouldBlock) {',
      '    executionContext.getEventArgs().preventDefault();',
      '  }',
      '};'
    ].join('\n')
  });

  assert.ok(result.findings.some(finding => finding.ruleId === 'async-onsave-unreturned-promise'));
  assert.ok(result.findings.some(finding => finding.ruleId === 'onsave-preventdefault-unclear-branch'));
  assert.equal(result.ruleSummary.categories['async-onsave'] >= 2, true);
});

test('detects client API quality and command-context risks', () => {
  const result = analyseModelDrivenJavaScript({
    source: [
      'function onNameChange(executionContext) {',
      '  const formContext = executionContext.getFormContext();',
      '  formContext.getAttribute("name").setValue("A");',
      '  formContext.getAttribute("name").getValue();',
      '  formContext.getControl("name").setDisabled(false);',
      '}',
      'function loadRows() {',
      '  return Xrm.WebApi.retrieveMultipleRecords("account", "?$select=name");',
      '}',
      'function gridCommand(selectedControl) {',
      '  const formContext = selectedControl.getFormContext();',
      '  return formContext.data.entity.getId();',
      '}'
    ].join('\n')
  });

  assert.ok(result.findings.some(finding => finding.ruleId === 'repeated-form-member-access'));
  assert.ok(result.findings.some(finding => finding.ruleId === 'missing-depth-check'));
  assert.ok(result.findings.some(finding => finding.ruleId === 'retrieve-multiple-missing-paging'));
  assert.ok(result.findings.some(finding => finding.ruleId === 'command-grid-form-context-assumption'));

  const summary = buildJavaScriptRuleSummary(result.findings);
  assert.equal(summary.total, result.findings.length);
  assert.equal(summary.rules['retrieve-multiple-missing-paging'].category, 'webapi');
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
  assert.match(result.output, /getDepth/);
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
  assert.match(result.code, /maxPageSize/);
  assert.match(result.code, /nextLink/);
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
