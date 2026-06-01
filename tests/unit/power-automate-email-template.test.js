import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POWER_AUTOMATE_EMAIL_OUTPUT_SCOPES,
  POWER_AUTOMATE_EMAIL_TEMPLATES,
  buildPowerAutomateEmailTemplate
} from '../../src/tools/power-automate-email-template.js';

test('defines operational templates and output scopes', () => {
  assert.deepEqual(POWER_AUTOMATE_EMAIL_TEMPLATES.map(template => template.label), [
    'Notification',
    'Approval update',
    'Alert',
    'Digest'
  ]);
  assert.deepEqual(POWER_AUTOMATE_EMAIL_OUTPUT_SCOPES.map(scope => scope.label), [
    'Power Automate body fragment',
    'Full HTML document'
  ]);
});

test('requires email text before generating HTML', () => {
  assert.throws(
    () => buildPowerAutomateEmailTemplate({ input: '   \n  ' }),
    /Enter email text before generating HTML\./
  );
});

test('turns plain text into a heading, paragraphs and Outlook-friendly list tables', () => {
  const result = buildPowerAutomateEmailTemplate({
    input: [
      'Deployment complete',
      'The nightly job finished successfully.',
      '- Accounts updated',
      '- Contacts checked',
      '1. Review the summary',
      '2. Archive the run'
    ].join('\n')
  });

  assert.equal(result.template.label, 'Notification');
  assert.equal(result.heading, 'Deployment complete');
  assert.equal(result.paragraphCount, 1);
  assert.equal(result.listCount, 2);
  assert.match(result.html, /<table role="presentation" width="100%"/);
  assert.match(result.html, /mso-table-lspace:0pt/);
  assert.match(result.html, /<h1[^>]*>Deployment complete<\/h1>/);
  assert.match(result.html, /&bull;/);
  assert.match(result.html, />1\.<\/td>/);
  assert.match(result.html, /The nightly job finished successfully\./);
});

test('escapes pasted HTML because the input is treated as plain text', () => {
  const result = buildPowerAutomateEmailTemplate({
    input: [
      '<Status>',
      'Use <strong>plain text</strong> & keep it safe.'
    ].join('\n')
  });

  assert.match(result.html, /&lt;Status&gt;/);
  assert.match(result.html, /Use &lt;strong&gt;plain text&lt;\/strong&gt; &amp; keep it safe\./);
  assert.doesNotMatch(result.html, /<strong>plain text<\/strong>/);
});

test('applies template-specific styling metadata', () => {
  const result = buildPowerAutomateEmailTemplate({
    input: 'Action required\nPlease review the approval.',
    templateId: 'alert'
  });

  assert.equal(result.template.label, 'Alert');
  assert.equal(result.template.accent, '#dc2626');
  assert.match(result.html, /background-color:#dc2626/);
  assert.match(result.html, /border:1px solid #fecaca/);
});

test('detects Power Automate tokens and highlights them only in the preview', () => {
  const result = buildPowerAutomateEmailTemplate({
    input: [
      'Approval for @{triggerOutputs()?[' + "'body/name'" + ']}',
      'Owner: @variables(' + "'ownerName'" + ')'
    ].join('\n'),
    templateId: 'approval-update'
  });

  assert.equal(result.tokenCount, 2);
  assert.doesNotMatch(result.html, /data-power-automate-token/);
  assert.match(result.html, /@\{triggerOutputs\(\)\?\['body\/name'\]\}/);
  assert.match(result.html, /@variables\('ownerName'\)/);
  assert.match(result.previewHtml, /data-power-automate-token="true"/);
  assert.match(result.previewHtml, /@\{triggerOutputs\(\)\?\['body\/name'\]\}/);
});

test('reports incomplete Power Automate tokens without changing them', () => {
  const result = buildPowerAutomateEmailTemplate({
    input: 'Broken token\nHello @{triggerOutputs()?[' + "'body/name'" + ']'
  });

  assert.equal(result.tokenCount, 0);
  assert.deepEqual(result.warnings, [
    'Some Power Automate tokens look incomplete and were left unchanged.'
  ]);
  assert.match(result.html, /@\{triggerOutputs\(\)\?\['body\/name'\]/);
});

test('supports body fragments and full HTML documents', () => {
  const fragment = buildPowerAutomateEmailTemplate({
    input: 'Digest\nAlpha',
    outputScope: 'fragment'
  });
  const document = buildPowerAutomateEmailTemplate({
    input: 'Digest\nAlpha',
    outputScope: 'document'
  });

  assert.equal(fragment.outputScopeLabel, 'Power Automate body fragment');
  assert.equal(document.outputScopeLabel, 'Full HTML document');
  assert.match(fragment.html, /^<table role="presentation"/);
  assert.doesNotMatch(fragment.html, /<!doctype html>/);
  assert.match(document.html, /^<!doctype html>/);
  assert.match(document.html, /<html lang="en-GB">/);
  assert.match(document.html, /<title>Digest<\/title>/);
  assert.match(document.previewHtml, /^<!doctype html>/);
});

test('warns when only a heading is present', () => {
  const result = buildPowerAutomateEmailTemplate({
    input: 'Status update'
  });

  assert.equal(result.heading, 'Status update');
  assert.equal(result.paragraphCount, 0);
  assert.equal(result.listCount, 0);
  assert.deepEqual(result.warnings, [
    'Only a heading was found; add body text before sending.'
  ]);
});
