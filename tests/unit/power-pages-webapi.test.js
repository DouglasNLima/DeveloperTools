import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEndpoint,
  buildPowerPagesWebApiSnippet,
  buildSiteSettingsChecklist,
  normaliseEntitySetName,
  normaliseLogicalTableName,
  parsePayload
} from '../../src/tools/power-pages-webapi.js';

test('builds list endpoint with select, filter and top query options', () => {
  const endpoint = buildEndpoint({
    operation: 'list',
    entitySetName: 'accounts',
    selectColumns: 'name, accountnumber',
    filter: 'statecode eq 0',
    top: '5'
  });

  assert.equal(endpoint, '/_api/accounts?$select=name,accountnumber&$filter=statecode%20eq%200&$top=5');
});

test('builds retrieve endpoint with record ID and select columns', () => {
  const endpoint = buildEndpoint({
    operation: 'retrieve',
    entitySetName: '/_api/accounts(ignored)',
    recordId: '{00000000-0000-0000-0000-000000000001}',
    selectColumns: 'name'
  });

  assert.equal(endpoint, '/_api/accounts(00000000-0000-0000-0000-000000000001)?$select=name');
});

test('generates create snippet with payload and site settings', () => {
  const result = buildPowerPagesWebApiSnippet({
    operation: 'create',
    entitySetName: 'accounts',
    logicalTableName: 'account',
    selectColumns: 'name',
    payloadJson: '{"name":"Contoso"}'
  });

  assert.equal(result.method, 'POST');
  assert.equal(result.endpoint, '/_api/accounts');
  assert.equal(result.checklist.siteSettings[0].name, 'Webapi/account/enabled');
  assert.equal(result.checklist.siteSettings[1].value, 'name');
  assert.match(result.output, /contentType: "application\/json"/);
  assert.match(result.output, /data: JSON\.stringify\(\{/);
});

test('generates update and delete endpoints', () => {
  const updateResult = buildPowerPagesWebApiSnippet({
    operation: 'update',
    entitySetName: 'accounts',
    logicalTableName: 'account',
    recordId: '00000000-0000-0000-0000-000000000001',
    payloadJson: '{"name":"Updated"}'
  });
  const deleteResult = buildPowerPagesWebApiSnippet({
    operation: 'delete',
    entitySetName: 'accounts',
    logicalTableName: 'account',
    recordId: '00000000-0000-0000-0000-000000000001'
  });

  assert.equal(updateResult.method, 'PATCH');
  assert.equal(updateResult.endpoint, '/_api/accounts(00000000-0000-0000-0000-000000000001)');
  assert.equal(deleteResult.method, 'DELETE');
  assert.equal(deleteResult.endpoint, '/_api/accounts(00000000-0000-0000-0000-000000000001)');
});

test('keeps EntitySetName and logical table name responsibilities separate', () => {
  const result = buildPowerPagesWebApiSnippet({
    operation: 'list',
    entitySetName: 'contacts',
    logicalTableName: 'contact'
  });

  assert.equal(result.endpoint, '/_api/contacts');
  assert.equal(result.checklist.siteSettings[0].name, 'Webapi/contact/enabled');
  assert.equal(result.checklist.siteSettings[1].name, 'Webapi/contact/fields');
});

test('normalises entity set and logical names', () => {
  assert.equal(normaliseEntitySetName('/_api/accounts?$select=name'), 'accounts');
  assert.equal(normaliseLogicalTableName('Account'), 'account');
});

test('parses JSON payload objects and rejects invalid payloads', () => {
  assert.deepEqual(parsePayload('{"name":"Contoso"}', 'create'), { name: 'Contoso' });
  assert.throws(() => parsePayload('[1,2,3]', 'create'), /JSON object/);
  assert.throws(() => parsePayload('{bad json}', 'update'), /valid JSON/);
});

test('builds site settings checklist from selected columns and payload keys', () => {
  const checklist = buildSiteSettingsChecklist({
    logicalTableName: 'account',
    selectColumns: 'name, accountnumber',
    payload: { emailaddress1: 'hello@example.com' }
  });

  assert.equal(checklist.siteSettings.length, 3);
  assert.equal(checklist.siteSettings[1].value, 'name,accountnumber,emailaddress1');
});

test('reports required record ID and top validation errors', () => {
  assert.throws(() => buildEndpoint({ operation: 'delete', entitySetName: 'accounts' }), /record ID/);
  assert.throws(() => buildEndpoint({ operation: 'list', entitySetName: 'accounts', top: '0' }), /\$top/);
});

test('emits warnings for missing select, star fields and unsupported configuration tables', () => {
  const missingSelect = buildPowerPagesWebApiSnippet({
    operation: 'list',
    entitySetName: 'accounts',
    logicalTableName: 'account'
  });
  const starFields = buildPowerPagesWebApiSnippet({
    operation: 'list',
    entitySetName: 'accounts',
    logicalTableName: 'account',
    selectColumns: '*'
  });
  const unsupportedTable = buildPowerPagesWebApiSnippet({
    operation: 'list',
    entitySetName: 'adx_sitesettings',
    logicalTableName: 'adx_sitesetting',
    selectColumns: 'adx_name'
  });

  assert.match(missingSelect.warnings.join('\n'), /Add \$select/);
  assert.match(starFields.warnings.join('\n'), /Avoid using \*/);
  assert.match(unsupportedTable.warnings.join('\n'), /configuration tables/);
});
