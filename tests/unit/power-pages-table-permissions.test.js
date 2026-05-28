import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTablePermissionsChecklist,
  formatOperation,
  formatScope,
  normaliseLogicalTableName,
  parseOperations,
  parseWebRoles
} from '../../src/tools/power-pages-table-permissions.js';

test('builds a table permissions checklist with roles and privileges', () => {
  const result = buildTablePermissionsChecklist({
    logicalTableName: 'Account',
    operations: ['read', 'write'],
    scope: 'global',
    webRoles: 'Portal Managers',
    includeAuthenticated: true
  });

  assert.equal(result.logicalTableName, 'account');
  assert.deepEqual(result.operationLabels, ['Read', 'Write']);
  assert.deepEqual(result.webRoles, ['Authenticated Users', 'Portal Managers']);
  assert.equal(result.scopeLabel, 'Global');
  assert.match(result.output, /Table: account/);
  assert.match(result.output, /Privileges: Read, Write/);
  assert.match(result.output, /Authenticated Users, Portal Managers/);
});

test('warns about Anonymous Users with Global read access', () => {
  const result = buildTablePermissionsChecklist({
    logicalTableName: 'contact',
    operations: ['read'],
    scope: 'global',
    includeAnonymous: true
  });

  assert.equal(result.riskLevel, 'Critical');
  assert.match(result.warnings.join('\n'), /Anonymous Users gives every site visitor/);
  assert.match(result.warnings.join('\n'), /Global read/);
  assert.match(result.warnings.join('\n'), /Global access on contact/);
});

test('warns about write privileges for broad web roles', () => {
  const result = buildTablePermissionsChecklist({
    logicalTableName: 'account',
    operations: ['create', 'delete'],
    scope: 'global',
    includeAnonymous: true,
    includeAuthenticated: true
  });

  assert.match(result.warnings.join('\n'), /Avoid granting create, write, delete/);
  assert.match(result.warnings.join('\n'), /all Authenticated Users/);
  assert.match(result.warnings.join('\n'), /Delete privilege is destructive/);
});

test('warns when relationship-backed scopes have no relationship', () => {
  const contactResult = buildTablePermissionsChecklist({
    logicalTableName: 'case',
    operations: ['read'],
    scope: 'contact',
    includeAuthenticated: true
  });
  const parentResult = buildTablePermissionsChecklist({
    logicalTableName: 'annotation',
    operations: ['read'],
    scope: 'parent',
    includeAuthenticated: true
  });

  assert.match(contactResult.warnings.join('\n'), /Contact access needs/);
  assert.match(parentResult.warnings.join('\n'), /Parent access needs/);
  assert.match(parentResult.warnings.join('\n'), /child permissions/);
});

test('adds Web API reminders and site setting warnings', () => {
  const result = buildTablePermissionsChecklist({
    logicalTableName: 'account',
    operations: ['read'],
    scope: 'self',
    includeAuthenticated: true,
    webApiEnabled: true
  });

  assert.match(result.warnings.join('\n'), /Webapi\/account\/enabled/);
  assert.match(result.output, /Webapi\/account\/fields/);
  assert.match(result.reminders.join('\n'), /fields allow-list/);
});

test('parses operations and web roles predictably', () => {
  assert.deepEqual(parseOperations('write, append to\nread'), ['read', 'write', 'appendTo']);
  assert.deepEqual(parseOperations({ read: true, delete: false, appendTo: true }), ['read', 'appendTo']);
  assert.deepEqual(parseWebRoles('Portal Managers,Portal Managers\nService Agents', { includeAuthenticated: true }), [
    'Authenticated Users',
    'Portal Managers',
    'Service Agents'
  ]);
});

test('formats unknown scope and operation values safely', () => {
  assert.equal(formatOperation('appendTo'), 'Append To');
  assert.equal(formatOperation('unknown'), 'unknown');
  assert.equal(formatScope('not-a-scope'), 'Global');
});

test('requires a valid logical table name and at least one privilege', () => {
  assert.equal(normaliseLogicalTableName('Account'), 'account');
  assert.throws(() => normaliseLogicalTableName('bad name'), /lowercase letters/);
  assert.throws(() => buildTablePermissionsChecklist({ operations: ['read'] }), /logical table name/);
  assert.throws(() => buildTablePermissionsChecklist({ logicalTableName: 'account', operations: [] }), /at least one/);
});
