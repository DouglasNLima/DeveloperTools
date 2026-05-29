import { formatBytes } from './base64.js';

export const DATAVERSE_ENDPOINT_MODES = [
  { value: 'dataverse', label: 'Dataverse Web API' },
  { value: 'power-pages', label: 'Power Pages Web API' }
];

export const DATAVERSE_ENDPOINT_PRESETS = [
  {
    value: 'custom',
    label: 'Custom endpoint',
    endpointMode: 'dataverse',
    entitySetName: '',
    selectColumns: '',
    filter: '',
    orderBy: '',
    expand: '',
    top: '',
    maxPageSize: '',
    includeCount: false,
    includeFormattedValues: false
  },
  {
    value: 'dataverse-active-accounts',
    label: 'Dataverse Web API: active accounts',
    endpointMode: 'dataverse',
    entitySetName: 'accounts',
    selectColumns: 'name, accountnumber, primarycontactid',
    filter: 'statecode eq 0',
    orderBy: 'name asc',
    expand: 'primarycontactid($select=fullname,emailaddress1)',
    top: '50',
    maxPageSize: '100',
    includeCount: false,
    includeFormattedValues: true
  },
  {
    value: 'dataverse-recent-contacts',
    label: 'Dataverse Web API: recent contacts',
    endpointMode: 'dataverse',
    entitySetName: 'contacts',
    selectColumns: 'fullname, emailaddress1, parentcustomerid',
    filter: 'statecode eq 0',
    orderBy: 'modifiedon desc',
    expand: 'parentcustomerid_account($select=name,accountnumber)',
    top: '50',
    maxPageSize: '100',
    includeCount: false,
    includeFormattedValues: true
  },
  {
    value: 'power-pages-active-accounts',
    label: 'Power Pages Web API: active accounts',
    endpointMode: 'power-pages',
    entitySetName: 'accounts',
    selectColumns: 'name, accountnumber',
    filter: 'statecode eq 0',
    orderBy: 'name asc',
    expand: '',
    top: '50',
    maxPageSize: '',
    includeCount: false,
    includeFormattedValues: false
  },
  {
    value: 'power-pages-active-contacts',
    label: 'Power Pages Web API: active contacts',
    endpointMode: 'power-pages',
    entitySetName: 'contacts',
    selectColumns: 'fullname, emailaddress1',
    filter: 'statecode eq 0',
    orderBy: 'fullname asc',
    expand: '',
    top: '50',
    maxPageSize: '',
    includeCount: false,
    includeFormattedValues: false
  }
];

export function buildDataverseODataQuery(options = {}) {
  const context = mergeEndpointPreset(options);
  const entitySetName = normaliseEntitySetName(context.entitySetName);
  const endpointMode = normaliseEndpointMode(context.endpointMode);
  const select = normaliseCsvList(context.selectColumns);
  const orderBy = normaliseOrderByList(context.orderBy);
  const expand = [
    ...normaliseExpandList(context.expand),
    ...normaliseGuidedExpands(context.guidedExpands)
  ];
  const filter = normaliseQueryExpression(context.filter, '$filter');
  const top = normaliseTop(context.top);
  const includeCount = Boolean(context.includeCount);
  const includeFormattedValues = Boolean(context.includeFormattedValues);
  const maxPageSize = normaliseMaxPageSize(context.maxPageSize);
  const queryOptions = buildQueryOptions({
    select,
    filter,
    orderBy,
    expand,
    top,
    includeCount
  });
  const endpoint = buildEndpoint(entitySetName, endpointMode, queryOptions);
  const headers = buildHeaders({ includeFormattedValues, maxPageSize });
  const warnings = buildWarnings({
    select,
    filter,
    orderBy,
    expand,
    top,
    includeCount,
    includeFormattedValues,
    maxPageSize
  });
  const fetchSnippet = buildDataverseFetchSnippet(endpoint, headers);
  const output = formatDataverseQueryReport({
    endpointPresetLabel: context.endpointPresetLabel,
    endpointMode,
    entitySetName,
    endpoint,
    queryOptions,
    headers,
    warnings,
    fetchSnippet
  });
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    endpointPreset: context.endpointPreset,
    endpointPresetLabel: context.endpointPresetLabel,
    endpointMode,
    endpointModeLabel: DATAVERSE_ENDPOINT_MODES.find(mode => mode.value === endpointMode).label,
    entitySetName,
    endpoint,
    queryOptions,
    headers,
    warnings,
    fetchSnippet,
    output,
    outputType: 'Dataverse OData report',
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    summary: {
      queryOptionCount: queryOptions.length,
      headerCount: headers.length,
      selectCount: select.length,
      expandCount: expand.length,
      guidedExpandCount: normaliseGuidedExpands(context.guidedExpands).length
    }
  };
}

export function getEndpointPreset(value) {
  return DATAVERSE_ENDPOINT_PRESETS.find(preset => preset.value === value) || DATAVERSE_ENDPOINT_PRESETS[0];
}

export function buildGuidedExpand(options = {}) {
  const relationshipName = normaliseNavigationPropertyName(options.relationshipName);
  const select = normaliseCsvList(options.selectColumns);
  const filter = normaliseQueryExpression(options.filter, '$filter');
  const orderBy = normaliseOrderByList(options.orderBy);
  const nestedOptions = [];

  if (select.length > 0) {
    nestedOptions.push(`$select=${select.join(',')}`);
  }

  if (filter) {
    nestedOptions.push(`$filter=${filter}`);
  }

  if (orderBy.length > 0) {
    nestedOptions.push(`$orderby=${orderBy.join(',')}`);
  }

  if (nestedOptions.length === 0) {
    throw new Error('Add at least one nested $select, $filter or $orderby value for the guided $expand.');
  }

  return `${relationshipName}(${nestedOptions.join(';')})`;
}

export function buildEndpoint(entitySetName, endpointMode = 'dataverse', queryOptions = []) {
  const basePath = endpointMode === 'power-pages'
    ? `/_api/${entitySetName}`
    : `/api/data/v9.2/${entitySetName}`;
  const queryString = queryOptions
    .map(option => `${option.name}=${encodeQueryValue(option.value)}`)
    .join('&');

  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function buildQueryOptions(options = {}) {
  const queryOptions = [];

  if (options.select?.length) {
    queryOptions.push({ name: '$select', value: options.select.join(',') });
  }

  if (options.filter) {
    queryOptions.push({ name: '$filter', value: options.filter });
  }

  if (options.orderBy?.length) {
    queryOptions.push({ name: '$orderby', value: options.orderBy.join(',') });
  }

  if (options.expand?.length) {
    queryOptions.push({ name: '$expand', value: options.expand.join(',') });
  }

  if (options.top) {
    queryOptions.push({ name: '$top', value: String(options.top) });
  }

  if (options.includeCount) {
    queryOptions.push({ name: '$count', value: 'true' });
  }

  return queryOptions;
}

export function buildHeaders(options = {}) {
  const headers = [
    { name: 'Accept', value: 'application/json' },
    { name: 'OData-MaxVersion', value: '4.0' },
    { name: 'OData-Version', value: '4.0' }
  ];

  if (options.includeFormattedValues) {
    headers.push({
      name: 'Prefer',
      value: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
    });
  }

  if (options.maxPageSize) {
    headers.push({
      name: 'Prefer',
      value: `odata.maxpagesize=${options.maxPageSize}`
    });
  }

  return mergePreferHeaders(headers);
}

export function normaliseCsvList(value) {
  return splitTopLevelList(String(value ?? ''))
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.replace(/^\$select=/i, '').trim())
    .filter(Boolean);
}

export function normaliseOrderByList(value) {
  return normaliseCsvList(value)
    .map(item => item.replace(/^\$orderby=/i, '').trim())
    .filter(Boolean);
}

export function normaliseExpandList(value) {
  return splitTopLevelList(String(value ?? ''))
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.replace(/^\$expand=/i, '').trim())
    .filter(Boolean);
}

function splitTopLevelList(value) {
  const items = [];
  let start = 0;
  let depth = 0;
  let quote = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '\'' || character === '"') {
      quote = character;
      continue;
    }

    if (character === '(') {
      depth += 1;
      continue;
    }

    if (character === ')' && depth > 0) {
      depth -= 1;
      continue;
    }

    if ((character === ',' || character === '\n') && depth === 0) {
      items.push(value.slice(start, index));
      start = index + 1;
    }
  }

  items.push(value.slice(start));
  return items;
}

export function normaliseEntitySetName(value) {
  const entitySetName = String(value ?? '').trim();

  if (!entitySetName) {
    throw new Error('Enter the Dataverse EntitySetName.');
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(entitySetName)) {
    throw new Error('EntitySetName must start with a letter or underscore and contain only letters, numbers and underscores.');
  }

  return entitySetName;
}

export function normaliseNavigationPropertyName(value) {
  const relationshipName = String(value ?? '').trim();

  if (!relationshipName) {
    throw new Error('Enter the relationship name for the guided $expand.');
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(relationshipName)) {
    throw new Error('Relationship name must start with a letter or underscore and contain only letters, numbers and underscores.');
  }

  return relationshipName;
}

export function encodeQueryValue(value) {
  return encodeURIComponent(String(value ?? ''))
    .replace(/%2C/g, ',')
    .replace(/%24/g, '$')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%3D/g, '=')
    .replace(/%3B/g, ';')
    .replace(/%2F/g, '/')
    .replace(/%27/g, "'");
}

function normaliseEndpointMode(value) {
  return DATAVERSE_ENDPOINT_MODES.some(mode => mode.value === value) ? value : 'dataverse';
}

function mergeEndpointPreset(options) {
  const preset = getEndpointPreset(options.endpointPreset);
  const merged = { ...preset };

  [
    'endpointMode',
    'entitySetName',
    'selectColumns',
    'filter',
    'orderBy',
    'expand',
    'top',
    'maxPageSize',
    'guidedExpands'
  ].forEach(field => {
    if (options[field] !== undefined && options[field] !== null) {
      merged[field] = options[field];
    }
  });

  ['includeCount', 'includeFormattedValues'].forEach(field => {
    if (typeof options[field] === 'boolean') {
      merged[field] = options[field];
    }
  });

  return {
    ...merged,
    endpointPreset: preset.value,
    endpointPresetLabel: preset.label
  };
}

function normaliseGuidedExpands(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(item => String(item ?? '').trim()).filter(Boolean);
  }

  return normaliseExpandList(value);
}

function normaliseQueryExpression(value, optionName) {
  return String(value ?? '')
    .trim()
    .replace(/^\?/, '')
    .replace(new RegExp(`^\\${optionName}=`, 'i'), '')
    .trim();
}

function normaliseTop(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }

  const top = Number(value);

  if (!Number.isInteger(top) || top < 1 || top > 5000) {
    throw new Error('$top must be a whole number between 1 and 5,000.');
  }

  return top;
}

function normaliseMaxPageSize(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }

  const maxPageSize = Number(value);

  if (!Number.isInteger(maxPageSize) || maxPageSize < 1 || maxPageSize > 5000) {
    throw new Error('Max page size must be a whole number between 1 and 5,000.');
  }

  return maxPageSize;
}

function mergePreferHeaders(headers) {
  const preferValues = headers
    .filter(header => header.name === 'Prefer')
    .map(header => header.value);
  const baseHeaders = headers.filter(header => header.name !== 'Prefer');

  if (preferValues.length > 0) {
    baseHeaders.push({
      name: 'Prefer',
      value: preferValues.join(', ')
    });
  }

  return baseHeaders;
}

function buildWarnings(options) {
  const warnings = [];

  if (options.select.length === 0) {
    warnings.push('Add $select columns before using this query in production to avoid retrieving every readable column.');
  }

  if (options.select.some(column => column === '*')) {
    warnings.push('$select=* is not recommended for Dataverse Web API queries.');
  }

  if (options.expand.some(item => !item.includes('('))) {
    warnings.push('Use nested $select inside $expand where possible to keep related records small.');
  }

  if (options.expand.some(item => item.includes('(') && /\$select=/i.test(item) === false)) {
    warnings.push('Add nested $select inside every $expand item to avoid retrieving broad related records.');
  }

  if (options.expand.length > 2) {
    warnings.push('Review broad $expand usage; each relationship can increase payload size and query cost.');
  }

  if (options.includeCount && !options.filter) {
    warnings.push('$count without a focused $filter can be expensive on large Dataverse tables.');
  }

  if (options.includeCount && !options.top && !options.maxPageSize) {
    warnings.push('$count can be expensive on large tables; pair it with $top or a max page size where possible.');
  }

  if (options.orderBy.some(item => /\s+(asc|desc)$/i.test(item) === false)) {
    warnings.push('Order columns without asc/desc default to ascending order.');
  }

  return warnings;
}

function buildDataverseFetchSnippet(endpoint, headers) {
  const headerLines = headers.map((header, index) => {
    const suffix = index === headers.length - 1 ? '' : ',';
    return `    ${JSON.stringify(header.name)}: ${JSON.stringify(header.value)}${suffix}`;
  });

  return [
    `const response = await fetch(${JSON.stringify(endpoint)}, {`,
    '  method: "GET",',
    '  headers: {',
    ...headerLines,
    '  }',
    '});',
    '',
    'if (!response.ok) {',
    '  throw new Error(`Dataverse request failed with status ${response.status}`);',
    '}',
    '',
    'const data = await response.json();',
    'console.log(data);'
  ].join('\n');
}

function formatDataverseQueryReport(report) {
  return [
    '# Dataverse OData query',
    '',
    `Preset: ${report.endpointPresetLabel}`,
    `Mode: ${DATAVERSE_ENDPOINT_MODES.find(mode => mode.value === report.endpointMode).label}`,
    `EntitySetName: ${report.entitySetName}`,
    `Endpoint: ${report.endpoint}`,
    '',
    '## Query options',
    ...formatQueryOptions(report.queryOptions),
    '',
    '## Headers',
    ...report.headers.map(header => `- ${header.name}: ${header.value}`),
    ...formatWarnings(report.warnings),
    '',
    '## fetch snippet',
    '',
    '```js',
    report.fetchSnippet,
    '```'
  ].join('\n');
}

function formatQueryOptions(queryOptions) {
  if (queryOptions.length === 0) {
    return ['- None'];
  }

  return queryOptions.map(option => `- ${option.name}: ${option.value}`);
}

function formatWarnings(warnings) {
  if (warnings.length === 0) {
    return [];
  }

  return [
    '',
    '## Warnings',
    ...warnings.map(warning => `- ${warning}`)
  ];
}
