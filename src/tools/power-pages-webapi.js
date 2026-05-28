const DEFAULT_OPERATION = 'list';

export const WEB_API_OPERATIONS = [
  { value: 'list', label: 'List records', method: 'GET' },
  { value: 'retrieve', label: 'Retrieve by ID', method: 'GET' },
  { value: 'create', label: 'Create record', method: 'POST' },
  { value: 'update', label: 'Update record', method: 'PATCH' },
  { value: 'delete', label: 'Delete record', method: 'DELETE' }
];

const operationsByValue = new Map(WEB_API_OPERATIONS.map(operation => [operation.value, operation]));

const unsupportedPortalConfigurationTables = new Set([
  'adx_contentsnippet',
  'adx_entityform',
  'adx_entitylist',
  'adx_entitypermission',
  'adx_pagetemplate',
  'adx_sitesetting',
  'adx_webfile',
  'adx_webform',
  'adx_webpage',
  'adx_webrole',
  'adx_webtemplate',
  'adx_website'
]);

export function buildPowerPagesWebApiSnippet(options = {}) {
  const operation = getOperation(options.operation);
  const entitySetName = normaliseEntitySetName(options.entitySetName);
  const logicalTableName = normaliseLogicalTableName(options.logicalTableName);
  const recordId = normaliseRecordId(options.recordId);
  const selectColumns = parseColumnList(options.selectColumns);
  const filter = normaliseOptionalValue(options.filter);
  const top = normaliseTop(options.top);
  const payload = parsePayload(options.payloadJson, operation.value);
  const endpoint = buildEndpoint({
    operation: operation.value,
    entitySetName,
    recordId,
    selectColumns,
    filter,
    top
  });
  const checklist = buildSiteSettingsChecklist({
    logicalTableName,
    selectColumns,
    payload
  });
  const warnings = buildWarnings({
    operation: operation.value,
    logicalTableName,
    entitySetName,
    selectColumns,
    checklist
  });
  const snippet = buildSafeAjaxSnippet({
    method: operation.method,
    endpoint,
    payload
  });
  const output = buildSnippetOutput({
    operation,
    endpoint,
    snippet,
    checklist,
    warnings
  });

  return {
    operation,
    method: operation.method,
    endpoint,
    entitySetName,
    logicalTableName,
    recordId,
    selectColumns,
    payload,
    checklist,
    warnings,
    snippet,
    output,
    siteSettingsCount: checklist.siteSettings.length
  };
}

export function buildEndpoint(options = {}) {
  const operation = getOperation(options.operation).value;
  const entitySetName = normaliseEntitySetName(options.entitySetName);
  const recordId = normaliseRecordId(options.recordId);
  const selectColumns = parseColumnList(options.selectColumns);
  const filter = normaliseOptionalValue(options.filter);
  const top = normaliseTop(options.top);
  const requiresRecordId = ['retrieve', 'update', 'delete'].includes(operation);

  if (requiresRecordId && !recordId) {
    throw new Error('Enter a record ID for this Web API operation.');
  }

  const baseEndpoint = requiresRecordId
    ? `/_api/${entitySetName}(${recordId})`
    : `/_api/${entitySetName}`;
  const queryParts = [];

  if (['list', 'retrieve'].includes(operation) && selectColumns.length > 0) {
    queryParts.push(`$select=${selectColumns.map(encodeQueryValue).join(',')}`);
  }

  if (operation === 'list' && filter) {
    queryParts.push(`$filter=${encodeQueryValue(filter)}`);
  }

  if (operation === 'list' && top) {
    queryParts.push(`$top=${top}`);
  }

  return queryParts.length > 0 ? `${baseEndpoint}?${queryParts.join('&')}` : baseEndpoint;
}

export function buildSiteSettingsChecklist(options = {}) {
  const logicalTableName = normaliseLogicalTableName(options.logicalTableName);
  const selectColumns = parseColumnList(options.selectColumns);
  const payloadKeys = options.payload && typeof options.payload === 'object' && !Array.isArray(options.payload)
    ? Object.keys(options.payload)
    : [];
  const fieldNames = [...new Set([...selectColumns, ...payloadKeys])];
  const fieldsValue = fieldNames.length > 0 ? fieldNames.join(',') : '<comma-separated field logical names>';

  return {
    siteSettings: [
      {
        name: `Webapi/${logicalTableName}/enabled`,
        value: 'true',
        required: true
      },
      {
        name: `Webapi/${logicalTableName}/fields`,
        value: fieldsValue,
        required: true
      },
      {
        name: 'Webapi/error/innererror',
        value: 'true',
        required: false
      }
    ],
    reminders: [
      'Create table permissions for this table and assign them to the relevant web roles.',
      'Use the table logical name in site settings, and the EntitySetName in the Web API URL.',
      'Keep Webapi/error/innererror enabled only while debugging.'
    ]
  };
}

export function parseColumnList(value) {
  return String(value || '')
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function parsePayload(value, operation) {
  if (!['create', 'update'].includes(operation)) {
    return null;
  }

  const trimmed = String(value || '').trim();

  if (!trimmed) {
    throw new Error('Enter a JSON payload for this Web API operation.');
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Payload must be a JSON object.');
    }

    return parsed;
  } catch (error) {
    if (error.message === 'Payload must be a JSON object.') {
      throw error;
    }

    throw new Error('Payload must be valid JSON.');
  }
}

export function normaliseEntitySetName(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/^\/?_api\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/\(.*$/, '')
    .replace(/^\/+|\/+$/g, '');

  if (!cleaned) {
    throw new Error('Enter the Dataverse EntitySetName for the Web API URL.');
  }

  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(cleaned)) {
    throw new Error('EntitySetName should contain only letters, numbers and underscores.');
  }

  return cleaned;
}

export function normaliseLogicalTableName(value) {
  const cleaned = String(value || '').trim().toLowerCase();

  if (!cleaned) {
    throw new Error('Enter the logical table name for the Web API site settings.');
  }

  if (!/^[a-z][a-z0-9_]*$/.test(cleaned)) {
    throw new Error('Logical table name should contain only lowercase letters, numbers and underscores.');
  }

  return cleaned;
}

export function normaliseRecordId(value) {
  return String(value || '')
    .trim()
    .replace(/^\(/, '')
    .replace(/\)$/, '')
    .replace(/^\{/, '')
    .replace(/\}$/, '');
}

function buildWarnings(options) {
  const warnings = [];
  const tableNames = [options.logicalTableName, options.entitySetName.toLowerCase()];

  if (['list', 'retrieve'].includes(options.operation) && options.selectColumns.length === 0) {
    warnings.push('Add $select columns to avoid returning every available property.');
  }

  if (options.checklist.siteSettings.some(setting => setting.value.includes('*'))) {
    warnings.push('Avoid using * in Web API fields unless you intentionally want to expose every field.');
  }

  if (tableNames.some(tableName => unsupportedPortalConfigurationTables.has(tableName))) {
    warnings.push('Power Pages configuration tables are not supported by the Web API.');
  }

  return warnings;
}

function buildSafeAjaxSnippet(options) {
  const ajaxLines = [
    'webapi.safeAjax({',
    `  type: "${options.method}",`,
    `  url: "${options.endpoint}",`,
    '  headers: {',
    '    "Accept": "application/json",',
    '    "OData-MaxVersion": "4.0",',
    '    "OData-Version": "4.0"',
    '  },'
  ];

  if (options.payload) {
    ajaxLines.push('  contentType: "application/json",');
    ajaxLines.push(`  data: JSON.stringify(${formatJson(options.payload, 2).replace(/\n/g, '\n  ')}),`);
  }

  ajaxLines.push(
    '  success: function(data) {',
    '    console.log(data);',
    '  },',
    '  error: function(xhr) {',
    '    console.error(xhr);',
    '  }',
    '});'
  );

  return [
    '(function(webapi, $) {',
    '  function safeAjax(ajaxOptions) {',
    '    var deferredAjax = $.Deferred();',
    '',
    '    shell.getTokenDeferred().done(function(token) {',
    '      ajaxOptions.headers = ajaxOptions.headers || {};',
    '      ajaxOptions.headers.__RequestVerificationToken = token;',
    '',
    '      $.ajax(ajaxOptions)',
    '        .done(function(data, textStatus, jqXHR) {',
    '          validateLoginSession(data, textStatus, jqXHR, deferredAjax.resolve);',
    '        })',
    '        .fail(deferredAjax.reject);',
    '    }).fail(function() {',
    '      deferredAjax.rejectWith(this, arguments);',
    '    });',
    '',
    '    return deferredAjax.promise();',
    '  }',
    '',
    '  webapi.safeAjax = safeAjax;',
    '})(window.webapi = window.webapi || {}, jQuery);',
    '',
    ...ajaxLines
  ].join('\n');
}

function buildSnippetOutput(options) {
  return [
    '// Power Pages Web API setup checklist',
    ...options.checklist.siteSettings.map(setting => `// - ${setting.required ? 'Required' : 'Optional'}: ${setting.name} = ${setting.value}`),
    ...options.checklist.reminders.map(reminder => `// - ${reminder}`),
    ...(options.warnings.length > 0 ? ['', '// Warnings', ...options.warnings.map(warning => `// - ${warning}`)] : []),
    '',
    `// ${options.operation.label}`,
    `// Endpoint: ${options.endpoint}`,
    options.snippet
  ].join('\n');
}

function getOperation(value) {
  const operation = operationsByValue.get(value || DEFAULT_OPERATION);

  if (!operation) {
    throw new Error('Choose a supported Web API operation.');
  }

  return operation;
}

function normaliseOptionalValue(value) {
  return String(value || '').trim();
}

function normaliseTop(value) {
  const trimmed = normaliseOptionalValue(value);

  if (!trimmed) {
    return '';
  }

  if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) {
    throw new Error('$top must be a positive whole number.');
  }

  return String(Number(trimmed));
}

function encodeQueryValue(value) {
  return encodeURIComponent(value).replace(/%2C/g, ',');
}

function formatJson(value, indentSize) {
  return JSON.stringify(value, null, indentSize);
}
