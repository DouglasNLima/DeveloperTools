export const SITE_SETTING_FEATURES = [
  {
    value: 'webapi',
    label: 'Web API table access'
  },
  {
    value: 'registration',
    label: 'Registration hardening'
  },
  {
    value: 'liquid-safety',
    label: 'Liquid output safety'
  },
  {
    value: 'diagnostics',
    label: 'Diagnostics'
  }
];

const DEFAULT_FEATURE = 'webapi';

const knownBooleanSettings = new Set([
  'Authentication/Registration/RequiresConfirmation',
  'Authentication/Registration/RequiresInvitation',
  'Site/EnableDefaultHtmlEncoding',
  'Webapi/error/innererror'
]);

export function buildSiteSettingsPlan(options = {}) {
  const feature = normaliseFeature(options.feature);
  const logicalTableName = normaliseOptionalLogicalTableName(options.logicalTableName);
  const fields = parseFieldList(options.fields);
  const settings = [];
  const reminders = [];
  const warnings = [];

  if (feature === 'webapi') {
    if (!logicalTableName) {
      throw new Error('Enter the logical table name for Web API site settings.');
    }

    if (fields.length === 0) {
      warnings.push('Add a field allow-list before enabling the Web API for this table.');
    }

    if (fields.includes('*')) {
      warnings.push('Avoid using * unless every field is intentionally exposed through the Web API.');
    }

    settings.push(
      createSetting(`Webapi/${logicalTableName}/enabled`, boolValue(options.enableWebApi !== false), 'Enables the Power Pages Web API for this table.'),
      createSetting(`Webapi/${logicalTableName}/fields`, fields.length > 0 ? fields.join(',') : '<comma-separated field logical names>', 'Controls which table columns are available through the Web API.')
    );

    if (options.includeInnerError) {
      settings.push(createSetting('Webapi/error/innererror', 'true', 'Shows detailed Web API errors while debugging.'));
      warnings.push('Disable Webapi/error/innererror outside local troubleshooting or controlled testing.');
    }

    reminders.push(
      'Create table permissions for this table and attach them to the right web roles.',
      'Use the logical table name in site settings, not the EntitySetName used in /_api URLs.',
      'Clear the Power Pages cache after changing site settings.'
    );
  }

  if (feature === 'registration') {
    settings.push(
      createSetting('Authentication/Registration/RequiresConfirmation', boolValue(options.requiresConfirmation), 'Requires email confirmation before local registration is complete.'),
      createSetting('Authentication/Registration/RequiresInvitation', boolValue(options.requiresInvitation), 'Requires an invitation code and disables open registration.')
    );

    if (!options.requiresConfirmation && !options.requiresInvitation) {
      warnings.push('Consider requiring confirmation or invitations before enabling public registration.');
    }

    reminders.push(
      'Review identity provider configuration before exposing authenticated content.',
      'Use web roles and table permissions to protect data after sign-in.'
    );
  }

  if (feature === 'liquid-safety') {
    settings.push(createSetting('Site/EnableDefaultHtmlEncoding', boolValue(options.enableDefaultHtmlEncoding !== false), 'Keeps default HTML encoding behaviour for Liquid user and request objects.'));

    if (options.enableDefaultHtmlEncoding === false) {
      warnings.push('Disabling default HTML encoding can increase cross-site scripting risk.');
    }

    reminders.push(
      'Keep explicit escaping in custom Liquid templates.',
      'Review any template that renders user-controlled data.'
    );
  }

  if (feature === 'diagnostics') {
    settings.push(createSetting('Webapi/error/innererror', boolValue(Boolean(options.includeInnerError)), 'Shows detailed Web API error information while debugging.'));

    if (options.includeInnerError) {
      warnings.push('Detailed inner errors are useful during development but should be disabled for production.');
    } else {
      reminders.push('Enable Webapi/error/innererror only temporarily when troubleshooting Web API responses.');
    }
  }

  const output = formatSiteSettingsPlan({
    feature,
    settings,
    reminders,
    warnings
  });

  return {
    feature,
    settings,
    reminders,
    warnings,
    output,
    settingCount: settings.length
  };
}

export function parseFieldList(value) {
  return [...new Set(String(value || '')
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean))];
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

export function validateSetting(setting) {
  if (!setting || !setting.name || !setting.value) {
    throw new Error('Site setting name and value are required.');
  }

  if (knownBooleanSettings.has(setting.name) && !/^(true|false)$/i.test(setting.value)) {
    throw new Error(`${setting.name} expects true or false.`);
  }

  return {
    ...setting,
    value: knownBooleanSettings.has(setting.name) ? setting.value.toLowerCase() : setting.value
  };
}

function normaliseFeature(value) {
  const feature = SITE_SETTING_FEATURES.some(item => item.value === value) ? value : DEFAULT_FEATURE;
  return feature;
}

function normaliseOptionalLogicalTableName(value) {
  const trimmed = String(value || '').trim();
  return trimmed ? normaliseLogicalTableName(trimmed) : '';
}

function createSetting(name, value, description) {
  return validateSetting({
    name,
    value,
    description
  });
}

function boolValue(value) {
  return value ? 'true' : 'false';
}

function formatSiteSettingsPlan(plan) {
  const lines = [
    '# Power Pages site settings checklist',
    '',
    `Feature: ${SITE_SETTING_FEATURES.find(feature => feature.value === plan.feature).label}`,
    '',
    '## Settings',
    ...plan.settings.map(setting => `- ${setting.name} = ${setting.value}\n  ${setting.description}`)
  ];

  if (plan.reminders.length > 0) {
    lines.push('', '## Reminders', ...plan.reminders.map(reminder => `- ${reminder}`));
  }

  if (plan.warnings.length > 0) {
    lines.push('', '## Warnings', ...plan.warnings.map(warning => `- ${warning}`));
  }

  return lines.join('\n');
}
