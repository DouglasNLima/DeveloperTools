import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSiteSettingsPlan,
  normaliseLogicalTableName,
  parseFieldList,
  validateSetting
} from '../../src/tools/power-pages-site-settings.js';

test('builds Web API table site settings', () => {
  const result = buildSiteSettingsPlan({
    feature: 'webapi',
    logicalTableName: 'Account',
    fields: 'name, accountnumber',
    enableWebApi: true
  });

  assert.equal(result.settingCount, 2);
  assert.equal(result.settings[0].name, 'Webapi/account/enabled');
  assert.equal(result.settings[0].value, 'true');
  assert.equal(result.settings[1].name, 'Webapi/account/fields');
  assert.equal(result.settings[1].value, 'name,accountnumber');
  assert.match(result.output, /Create table permissions/);
});

test('adds optional inner error setting and warning for Web API troubleshooting', () => {
  const result = buildSiteSettingsPlan({
    feature: 'webapi',
    logicalTableName: 'contact',
    fields: 'fullname',
    includeInnerError: true
  });

  assert.equal(result.settingCount, 3);
  assert.equal(result.settings[2].name, 'Webapi/error/innererror');
  assert.match(result.warnings.join('\n'), /Disable Webapi\/error\/innererror/);
});

test('warns when Web API fields are empty or wildcarded', () => {
  const emptyFields = buildSiteSettingsPlan({
    feature: 'webapi',
    logicalTableName: 'account'
  });
  const wildcardFields = buildSiteSettingsPlan({
    feature: 'webapi',
    logicalTableName: 'account',
    fields: '*'
  });

  assert.match(emptyFields.warnings.join('\n'), /field allow-list/);
  assert.match(wildcardFields.warnings.join('\n'), /Avoid using \*/);
});

test('builds registration hardening settings', () => {
  const result = buildSiteSettingsPlan({
    feature: 'registration',
    requiresConfirmation: true,
    requiresInvitation: true
  });

  assert.deepEqual(result.settings.map(setting => setting.name), [
    'Authentication/Registration/RequiresConfirmation',
    'Authentication/Registration/RequiresInvitation'
  ]);
  assert.deepEqual(result.settings.map(setting => setting.value), ['true', 'true']);
  assert.equal(result.warnings.length, 0);
});

test('warns when registration is left open', () => {
  const result = buildSiteSettingsPlan({
    feature: 'registration',
    requiresConfirmation: false,
    requiresInvitation: false
  });

  assert.match(result.warnings.join('\n'), /requiring confirmation or invitations/);
});

test('builds Liquid output safety setting', () => {
  const result = buildSiteSettingsPlan({
    feature: 'liquid-safety',
    enableDefaultHtmlEncoding: true
  });

  assert.equal(result.settings[0].name, 'Site/EnableDefaultHtmlEncoding');
  assert.equal(result.settings[0].value, 'true');
});

test('warns if default HTML encoding is disabled', () => {
  const result = buildSiteSettingsPlan({
    feature: 'liquid-safety',
    enableDefaultHtmlEncoding: false
  });

  assert.match(result.warnings.join('\n'), /cross-site scripting/);
});

test('builds diagnostics setting', () => {
  const result = buildSiteSettingsPlan({
    feature: 'diagnostics',
    includeInnerError: false
  });

  assert.equal(result.settings[0].name, 'Webapi/error/innererror');
  assert.equal(result.settings[0].value, 'false');
  assert.match(result.reminders.join('\n'), /temporarily/);
});

test('normalises logical table names and field lists', () => {
  assert.equal(normaliseLogicalTableName('Account'), 'account');
  assert.deepEqual(parseFieldList('name, accountnumber\nname'), ['name', 'accountnumber']);
});

test('validates boolean site setting values', () => {
  assert.equal(validateSetting({ name: 'Webapi/error/innererror', value: 'TRUE' }).value, 'true');
  assert.throws(() => validateSetting({ name: 'Webapi/error/innererror', value: 'yes' }), /expects true or false/);
});

test('requires logical table name for Web API feature', () => {
  assert.throws(() => buildSiteSettingsPlan({ feature: 'webapi' }), /logical table name/);
});
