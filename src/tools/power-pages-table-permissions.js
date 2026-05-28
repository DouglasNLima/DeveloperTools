export const TABLE_PERMISSION_SCOPES = [
  {
    value: 'global',
    label: 'Global'
  },
  {
    value: 'contact',
    label: 'Contact'
  },
  {
    value: 'account',
    label: 'Account'
  },
  {
    value: 'self',
    label: 'Self'
  },
  {
    value: 'parent',
    label: 'Parent'
  }
];

export const TABLE_PERMISSION_OPERATIONS = [
  {
    value: 'read',
    label: 'Read'
  },
  {
    value: 'create',
    label: 'Create'
  },
  {
    value: 'write',
    label: 'Write'
  },
  {
    value: 'delete',
    label: 'Delete'
  },
  {
    value: 'append',
    label: 'Append'
  },
  {
    value: 'appendTo',
    label: 'Append To'
  }
];

const DEFAULT_SCOPE = 'global';
const ROLE_ANONYMOUS = 'Anonymous Users';
const ROLE_AUTHENTICATED = 'Authenticated Users';
const RELATIONSHIP_SCOPES = new Set(['contact', 'account', 'parent']);
const WRITE_PRIVILEGES = new Set(['create', 'write', 'delete', 'append', 'appendTo']);
const SENSITIVE_TABLES = new Set([
  'account',
  'contact',
  'incident',
  'lead',
  'opportunity',
  'systemuser',
  'team',
  'annotation',
  'activitypointer'
]);

export function buildTablePermissionsChecklist(options = {}) {
  const logicalTableName = normaliseLogicalTableName(options.logicalTableName);
  const operations = parseOperations(options.operations);
  const scope = normaliseScope(options.scope);
  const relationshipName = normaliseRelationshipName(options.relationshipName);
  const webRoles = parseWebRoles(options.webRoles, {
    includeAnonymous: options.includeAnonymous,
    includeAuthenticated: options.includeAuthenticated
  });
  const webApiEnabled = Boolean(options.webApiEnabled);

  if (operations.length === 0) {
    throw new Error('Select at least one table permission privilege.');
  }

  const warnings = buildWarnings({
    logicalTableName,
    operations,
    scope,
    relationshipName,
    webRoles,
    webApiEnabled
  });
  const reminders = buildReminders({
    logicalTableName,
    operations,
    scope,
    webApiEnabled
  });
  const riskLevel = calculateRiskLevel({
    logicalTableName,
    operations,
    scope,
    relationshipName,
    webRoles,
    warningCount: warnings.length
  });
  const output = formatTablePermissionsChecklist({
    logicalTableName,
    operations,
    scope,
    relationshipName,
    webRoles,
    webApiEnabled,
    warnings,
    reminders,
    riskLevel
  });

  return {
    logicalTableName,
    operations,
    operationLabels: operations.map(formatOperation),
    scope,
    scopeLabel: formatScope(scope),
    relationshipName,
    webRoles,
    webApiEnabled,
    warnings,
    reminders,
    riskLevel,
    output
  };
}

export function normaliseLogicalTableName(value) {
  const cleaned = String(value || '').trim().toLowerCase();

  if (!cleaned) {
    throw new Error('Enter the logical table name.');
  }

  if (!/^[a-z][a-z0-9_]*$/.test(cleaned)) {
    throw new Error('Logical table name should contain only lowercase letters, numbers and underscores.');
  }

  return cleaned;
}

export function parseOperations(value) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null
      ? Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([key]) => key)
      : String(value || '').split(/[\n,]/);
  const selected = new Set(rawValues.map(normaliseOperation).filter(Boolean));

  return TABLE_PERMISSION_OPERATIONS
    .map(operation => operation.value)
    .filter(operation => selected.has(operation));
}

export function parseWebRoles(value, options = {}) {
  const roles = [
    options.includeAnonymous ? ROLE_ANONYMOUS : '',
    options.includeAuthenticated ? ROLE_AUTHENTICATED : '',
    ...String(value || '').split(/[\n,]/)
  ]
    .map(role => role.trim())
    .filter(Boolean);

  return [...new Set(roles)];
}

export function formatOperation(value) {
  return TABLE_PERMISSION_OPERATIONS.find(operation => operation.value === value)?.label || value;
}

export function formatScope(value) {
  return TABLE_PERMISSION_SCOPES.find(scope => scope.value === value)?.label || formatScope(DEFAULT_SCOPE);
}

function buildWarnings(context) {
  const warnings = [];
  const webRoleSet = new Set(context.webRoles);
  const hasAnonymous = webRoleSet.has(ROLE_ANONYMOUS);
  const hasAuthenticated = webRoleSet.has(ROLE_AUTHENTICATED);
  const hasWritePrivilege = context.operations.some(operation => WRITE_PRIVILEGES.has(operation));

  if (context.webRoles.length === 0) {
    addWarning(warnings, 'Associate the table permission to at least one web role; permissions without roles do not take effect.');
  }

  if (hasAnonymous) {
    addWarning(warnings, 'Anonymous Users gives every site visitor access to the selected table privileges.');
  }

  if (hasAnonymous && context.scope === 'global' && context.operations.includes('read')) {
    addWarning(warnings, 'Anonymous Users with Global read can expose all readable rows to any site visitor.');
  }

  if (hasAnonymous && hasWritePrivilege) {
    addWarning(warnings, 'Avoid granting create, write, delete, append or append to privileges to Anonymous Users unless the table is intentionally public.');
  }

  if (hasAuthenticated && hasWritePrivilege) {
    addWarning(warnings, 'Write-style privileges for all Authenticated Users can be broad; prefer a narrower custom web role where possible.');
  }

  if (context.scope === 'global') {
    addWarning(warnings, 'Global access applies the selected privileges to all records for the selected web roles.');
  }

  if (context.scope === 'global' && SENSITIVE_TABLES.has(context.logicalTableName)) {
    addWarning(warnings, `Global access on ${context.logicalTableName} is usually high risk; prefer Contact, Account, Self or Parent access when possible.`);
  }

  if (RELATIONSHIP_SCOPES.has(context.scope) && !context.relationshipName) {
    addWarning(warnings, `${formatScope(context.scope)} access needs the relevant table relationship to be selected in Power Pages.`);
  }

  if (context.scope === 'parent') {
    addWarning(warnings, 'Parent access is normally handled through child permissions in the design studio or the Portal Management app.');
  }

  if (context.operations.includes('append') !== context.operations.includes('appendTo')) {
    addWarning(warnings, 'Relationship updates commonly need Append and Append To to be reviewed together.');
  }

  if (context.operations.includes('delete')) {
    addWarning(warnings, 'Delete privilege is destructive; confirm retention, audit and restore expectations before enabling it.');
  }

  if (context.webApiEnabled) {
    addWarning(warnings, `Web API use also needs matching Webapi/${context.logicalTableName}/enabled and Webapi/${context.logicalTableName}/fields site settings.`);
  }

  return warnings;
}

function buildReminders(context) {
  const reminders = [
    'Create or update the table permission from Security > Table permissions or the Portal Management app.',
    'Assign the permission to the intended web roles before testing the page.',
    'Publish site changes and clear the Power Pages cache after permission updates.'
  ];

  if (RELATIONSHIP_SCOPES.has(context.scope)) {
    reminders.push(`Confirm the ${formatScope(context.scope)} relationship matches the records shown by the page, list, form, FetchXML or Web API call.`);
  }

  if (context.scope === 'parent') {
    reminders.push('Check that child permissions inherit the intended roles from the parent permission.');
  }

  if (context.operations.some(operation => WRITE_PRIVILEGES.has(operation))) {
    reminders.push('Test write-style privileges with a user that only has the target web role.');
  }

  if (context.webApiEnabled) {
    reminders.push(`Keep the Webapi/${context.logicalTableName}/fields allow-list aligned with the fields used by the page.`);
  }

  return reminders;
}

function calculateRiskLevel(context) {
  let score = 0;
  const webRoleSet = new Set(context.webRoles);
  const hasAnonymous = webRoleSet.has(ROLE_ANONYMOUS);
  const hasWritePrivilege = context.operations.some(operation => WRITE_PRIVILEGES.has(operation));

  if (hasAnonymous) {
    score += 3;
  }

  if (context.scope === 'global') {
    score += 2;
  }

  if (hasWritePrivilege) {
    score += 1;
  }

  if (hasAnonymous && hasWritePrivilege) {
    score += 3;
  }

  if (context.operations.includes('delete')) {
    score += 2;
  }

  if (context.scope === 'global' && SENSITIVE_TABLES.has(context.logicalTableName)) {
    score += 2;
  }

  if (RELATIONSHIP_SCOPES.has(context.scope) && !context.relationshipName) {
    score += 1;
  }

  if (context.webRoles.length === 0) {
    score += 1;
  }

  score += Math.min(context.warningCount, 3);

  if (score >= 9) {
    return 'Critical';
  }

  if (score >= 6) {
    return 'High';
  }

  if (score >= 3) {
    return 'Medium';
  }

  return 'Low';
}

function formatTablePermissionsChecklist(result) {
  const roleSummary = result.webRoles.length > 0 ? result.webRoles.join(', ') : 'No web role selected yet';
  const relationshipSummary = result.relationshipName || 'Not specified';
  const lines = [
    '# Power Pages table permissions checklist',
    '',
    `Table: ${result.logicalTableName}`,
    `Scope: ${result.scopeLabel}`,
    `Privileges: ${result.operations.map(formatOperation).join(', ')}`,
    `Web roles: ${roleSummary}`,
    `Relationship: ${relationshipSummary}`,
    `Web API context: ${result.webApiEnabled ? 'Enabled' : 'Not selected'}`,
    `Risk level: ${result.riskLevel}`,
    '',
    '## Permission setup',
    `- Create or update a table permission for \`${result.logicalTableName}\`.`,
    `- Set access type to ${result.scopeLabel}.`,
    `- Grant privileges: ${result.operations.map(formatOperation).join(', ')}.`,
    `- Associate the permission to: ${roleSummary}.`
  ];

  if (result.relationshipName) {
    lines.push(`- Use relationship: \`${result.relationshipName}\`.`);
  }

  if (result.webApiEnabled) {
    lines.push(
      '',
      '## Web API checks',
      `- Confirm \`Webapi/${result.logicalTableName}/enabled\` is set to \`true\`.`,
      `- Confirm \`Webapi/${result.logicalTableName}/fields\` only exposes the fields required by the page.`,
      '- Confirm the request user has this table permission through the selected web role.'
    );
  }

  lines.push('', '## Reminders', ...result.reminders.map(reminder => `- ${reminder}`));

  if (result.warnings.length > 0) {
    lines.push('', '## Warnings', ...result.warnings.map(warning => `- ${warning}`));
  }

  return lines.join('\n');
}

function normaliseOperation(value) {
  const cleaned = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

  if (cleaned === 'appendto') {
    return 'appendTo';
  }

  return TABLE_PERMISSION_OPERATIONS.find(operation => operation.value.toLowerCase() === cleaned)?.value || '';
}

function normaliseScope(value) {
  const cleaned = String(value || '').trim().toLowerCase();
  return TABLE_PERMISSION_SCOPES.some(scope => scope.value === cleaned) ? cleaned : DEFAULT_SCOPE;
}

function normaliseRelationshipName(value) {
  return String(value || '').trim();
}

function addWarning(warnings, warning) {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}
