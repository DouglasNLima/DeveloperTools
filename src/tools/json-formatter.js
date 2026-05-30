const DEFAULT_INDENT = 2;
const FORMAT_MODE = 'format';
const MINIFY_MODE = 'minify';
const MARKDOWN_SCHEMA_OUTPUT = 'markdown';
const JSON_SCHEMA_OUTPUT = 'schema';

export const JSON_SCHEMA_OUTPUT_FORMATS = [
  { value: MARKDOWN_SCHEMA_OUTPUT, label: 'Markdown contract' },
  { value: JSON_SCHEMA_OUTPUT, label: 'JSON Schema only' }
];

export const JSON_SEARCH_TARGETS = [
  { value: 'keys-values', label: 'Keys and values' },
  { value: 'keys', label: 'Keys only' },
  { value: 'values', label: 'Values only' }
];

export function processJson(input, options = {}) {
  const rawInput = String(input ?? '');
  const parsed = parseJsonInput(rawInput);
  const sorted = Boolean(options.sortKeys);
  const value = sorted ? sortJsonKeys(parsed) : parsed;
  const mode = normaliseMode(options.mode);
  const indent = normaliseIndent(options.indent);
  const output = mode === MINIFY_MODE
    ? JSON.stringify(value)
    : JSON.stringify(value, null, indent);
  const stats = analyseJsonValue(value);
  const inputBytes = countUtf8Bytes(rawInput);
  const outputBytes = countUtf8Bytes(output);

  return {
    mode,
    indent,
    sorted,
    output,
    outputType: mode === MINIFY_MODE ? 'Minified JSON' : 'Formatted JSON',
    stats: {
      ...stats,
      inputBytes,
      outputBytes,
      inputSizeLabel: formatByteSize(inputBytes),
      outputSizeLabel: formatByteSize(outputBytes)
    }
  };
}

export function parseJsonInput(input) {
  const rawInput = String(input ?? '');

  if (!rawInput.trim()) {
    throw createJsonError('Enter JSON input.', {
      originalMessage: 'Empty input',
      line: null,
      column: null,
      position: null,
      snippet: ''
    });
  }

  try {
    return JSON.parse(rawInput);
  } catch (error) {
    const details = getJsonParseErrorDetails(rawInput, error);
    const message = details.line && details.column
      ? `JSON parse error at line ${details.line}, column ${details.column}: ${details.originalMessage}`
      : `JSON parse error: ${details.originalMessage}`;

    throw createJsonError(message, details);
  }
}

export function sortJsonKeys(value) {
  if (Array.isArray(value)) {
    return value.map(item => sortJsonKeys(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right, 'en-GB'))
      .reduce((result, key) => {
        result[key] = sortJsonKeys(value[key]);
        return result;
      }, {});
  }

  return value;
}

export function analyseJsonValue(value) {
  const stats = {
    rootType: getJsonType(value),
    depth: 0,
    objectCount: 0,
    arrayCount: 0,
    keyCount: 0,
    primitiveCount: 0
  };

  visitJsonValue(value, 1, stats);

  return stats;
}

export function generateJsonShape(input, options = {}) {
  const parsed = parseJsonInput(input);
  const shape = analyseJsonShape(parsed);
  const schema = buildJsonSchema(parsed, {
    title: options.title
  });
  const outputFormat = normaliseSchemaOutputFormat(options.outputFormat);
  const schemaJson = JSON.stringify(schema, null, 2);
  const output = outputFormat === JSON_SCHEMA_OUTPUT
    ? schemaJson
    : formatJsonShapeMarkdown(shape, schemaJson);
  const outputBytes = countUtf8Bytes(output);

  return {
    output,
    outputFormat,
    outputType: outputFormat === JSON_SCHEMA_OUTPUT ? 'JSON Schema' : 'Markdown contract',
    outputBytes,
    outputSizeLabel: formatByteSize(outputBytes),
    shape,
    schema
  };
}

export function searchJsonPaths(input, options = {}) {
  const parsed = parseJsonInput(input);
  const query = String(options.query ?? '').trim();

  if (!query) {
    throw new Error('Enter a key or value search term.');
  }

  const target = normaliseSearchTarget(options.target);
  const maxResults = normaliseMaxResults(options.maxResults);
  const matches = [];
  const queryLower = query.toLowerCase();

  visitSearchValue(parsed, '$', {
    queryLower,
    target,
    matches,
    maxResults
  });

  const truncated = matches.length >= maxResults;
  const output = formatJsonPathSearchMarkdown({
    query,
    target,
    matches,
    truncated,
    maxResults
  });
  const outputBytes = countUtf8Bytes(output);

  return {
    output,
    outputType: 'JSON path search',
    outputBytes,
    outputSizeLabel: formatByteSize(outputBytes),
    query,
    target,
    matches,
    truncated,
    maxResults,
    stats: analyseJsonValue(parsed)
  };
}

export function analyseJsonShape(value) {
  const paths = new Map();
  const objectStats = new Map();

  visitShapeValue(value, '$', paths, objectStats);

  const pathSummaries = [...paths.values()]
    .map(path => ({
      path: path.path,
      types: [...path.types].sort(compareShapeTypes),
      examples: path.examples
    }))
    .sort(comparePathSummaries);
  const fieldPresence = [...objectStats.values()]
    .map(object => {
      const required = [];
      const probablyOptional = [];

      object.keys.forEach((count, key) => {
        if (count === object.count) {
          required.push(key);
        } else {
          probablyOptional.push(key);
        }
      });

      return {
        path: object.path,
        objectCount: object.count,
        required: required.sort((left, right) => left.localeCompare(right, 'en-GB')),
        probablyOptional: probablyOptional.sort((left, right) => left.localeCompare(right, 'en-GB'))
      };
    })
    .sort(comparePathSummaries);
  const stats = analyseJsonValue(value);

  return {
    summary: {
      ...stats,
      pathCount: pathSummaries.length,
      objectPathCount: fieldPresence.length
    },
    paths: pathSummaries,
    fieldPresence
  };
}

export function buildJsonSchema(value, options = {}) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: String(options.title ?? '').trim() || 'Generated JSON shape',
    ...buildJsonSchemaForValues([value])
  };
}

export function formatJsonShapeMarkdown(shape, schemaJson) {
  const fieldRows = shape.fieldPresence.length === 0
    ? ['| - | - | - |']
    : shape.fieldPresence.map(field => [
      escapeMarkdownCell(field.path),
      escapeMarkdownCell(formatFieldList(field.required)),
      escapeMarkdownCell(formatFieldList(field.probablyOptional))
    ]);
  const pathRows = shape.paths.map(path => [
    escapeMarkdownCell(path.path),
    escapeMarkdownCell(path.types.join(', ')),
    escapeMarkdownCell(path.examples.join(', ') || '-')
  ]);

  return [
    '## JSON Shape Contract',
    '',
    '### Shape Summary',
    `- Root type: ${shape.summary.rootType}`,
    `- Maximum depth: ${shape.summary.depth.toLocaleString('en-GB')}`,
    `- Paths analysed: ${shape.summary.pathCount.toLocaleString('en-GB')}`,
    `- Object paths analysed: ${shape.summary.objectPathCount.toLocaleString('en-GB')}`,
    '',
    '### Field Presence',
    '| Object path | Required fields | Probably optional fields |',
    '| --- | --- | --- |',
    ...fieldRows.map(row => Array.isArray(row) ? `| ${row.join(' | ')} |` : row),
    '',
    '### Path Types',
    '| Path | Types | Examples |',
    '| --- | --- | --- |',
    ...pathRows.map(row => `| ${row.join(' | ')} |`),
    '',
    '### JSON Schema',
    '```json',
    schemaJson,
    '```'
  ].join('\n');
}

export function getJsonParseErrorDetails(input, error) {
  const originalMessage = error?.message || 'Unable to parse JSON.';
  const position = extractPosition(originalMessage);
  const explicitLocation = extractLineAndColumn(originalMessage);
  const location = typeof position === 'number'
    ? getLineColumnFromPosition(input, position)
    : explicitLocation;
  const snippet = location.line && location.column
    ? buildErrorSnippet(input, location.line, location.column)
    : '';

  return {
    originalMessage,
    position,
    line: location.line,
    column: location.column,
    snippet
  };
}

export function formatByteSize(bytes) {
  const value = Number(bytes) || 0;

  if (value < 1024) {
    return `${value.toLocaleString('en-GB')} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let unitIndex = -1;
  let size = value;

  do {
    size /= 1024;
    unitIndex += 1;
  } while (size >= 1024 && unitIndex < units.length - 1);

  return `${size.toLocaleString('en-GB', {
    maximumFractionDigits: size >= 10 ? 1 : 2
  })} ${units[unitIndex]}`;
}

function visitJsonValue(value, depth, stats) {
  stats.depth = Math.max(stats.depth, depth);

  if (Array.isArray(value)) {
    stats.arrayCount += 1;
    value.forEach(item => visitJsonValue(item, depth + 1, stats));
    return;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    stats.objectCount += 1;
    stats.keyCount += keys.length;
    keys.forEach(key => visitJsonValue(value[key], depth + 1, stats));
    return;
  }

  stats.primitiveCount += 1;
}

function visitShapeValue(value, path, paths, objectStats) {
  addShapePath(paths, path, getShapeType(value), value);

  if (Array.isArray(value)) {
    value.forEach(item => visitShapeValue(item, `${path}[]`, paths, objectStats));
    return;
  }

  if (value && typeof value === 'object') {
    addObjectShapeStats(objectStats, path, Object.keys(value));
    Object.entries(value).forEach(([key, child]) => {
      visitShapeValue(child, joinJsonPath(path, key), paths, objectStats);
    });
  }
}

function visitSearchValue(value, path, state, key = '') {
  if (state.matches.length >= state.maxResults) {
    return;
  }

  if (key && state.target !== 'values' && key.toLowerCase().includes(state.queryLower)) {
    state.matches.push({
      path,
      matchType: 'key',
      key,
      valuePreview: formatSearchValuePreview(value)
    });
  }

  if (state.matches.length >= state.maxResults) {
    return;
  }

  if (state.target !== 'keys' && isSearchableJsonValue(value)) {
    const valueText = String(value);

    if (valueText.toLowerCase().includes(state.queryLower)) {
      state.matches.push({
        path,
        matchType: 'value',
        key,
        valuePreview: formatSearchValuePreview(value)
      });
    }
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => visitSearchValue(item, `${path}[${index}]`, state));
    return;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, child]) => {
      visitSearchValue(child, joinJsonPath(path, childKey), state, childKey);
    });
  }
}

function addShapePath(paths, path, type, value) {
  if (!paths.has(path)) {
    paths.set(path, {
      path,
      types: new Set(),
      examples: []
    });
  }

  const pathSummary = paths.get(path);
  const example = formatShapeExample(value);

  pathSummary.types.add(type);

  if (example && !pathSummary.examples.includes(example) && pathSummary.examples.length < 3) {
    pathSummary.examples.push(example);
  }
}

function addObjectShapeStats(objectStats, path, keys) {
  if (!objectStats.has(path)) {
    objectStats.set(path, {
      path,
      count: 0,
      keys: new Map()
    });
  }

  const stats = objectStats.get(path);
  stats.count += 1;

  keys.forEach(key => {
    stats.keys.set(key, (stats.keys.get(key) || 0) + 1);
  });
}

function buildJsonSchemaForValues(values) {
  const types = values.map(value => getSchemaType(value));
  const type = formatSchemaType(types);
  const nonNullTypes = [...new Set(types.filter(item => item !== 'null'))];

  if (nonNullTypes.length === 1 && nonNullTypes[0] === 'object') {
    return buildObjectSchema(values, type);
  }

  if (nonNullTypes.length === 1 && nonNullTypes[0] === 'array') {
    return buildArraySchema(values, type);
  }

  return {
    type
  };
}

function buildObjectSchema(values, type) {
  const objectValues = values.filter(value => value && typeof value === 'object' && !Array.isArray(value));
  const keySet = new Set();
  const keyCounts = new Map();

  objectValues.forEach(value => {
    Object.keys(value).forEach(key => {
      keySet.add(key);
      keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
    });
  });

  const properties = {};
  [...keySet].sort((left, right) => left.localeCompare(right, 'en-GB')).forEach(key => {
    properties[key] = buildJsonSchemaForValues(objectValues.filter(value => Object.hasOwn(value, key)).map(value => value[key]));
  });

  const required = [...keyCounts.entries()]
    .filter(([, count]) => count === objectValues.length)
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right, 'en-GB'));
  const schema = {
    type,
    properties,
    additionalProperties: true
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

function buildArraySchema(values, type) {
  const itemValues = values
    .filter(Array.isArray)
    .flatMap(value => value);

  return {
    type,
    items: itemValues.length > 0 ? buildJsonSchemaForValues(itemValues) : {}
  };
}

function getShapeType(value) {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return 'integer';
  }

  return typeof value;
}

function getSchemaType(value) {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }

  return typeof value;
}

function formatSchemaType(types) {
  const uniqueTypes = new Set(types);

  if (uniqueTypes.has('number') && uniqueTypes.has('integer')) {
    uniqueTypes.delete('integer');
  }

  const orderedTypes = [...uniqueTypes].sort(compareShapeTypes);
  return orderedTypes.length === 1 ? orderedTypes[0] : orderedTypes;
}

function formatShapeExample(value) {
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : '[...]';
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).length === 0 ? '{}' : '{...}';
  }

  return JSON.stringify(value);
}

function formatJsonPathSearchMarkdown(report) {
  const targetLabel = JSON_SEARCH_TARGETS.find(target => target.value === report.target)?.label || report.target;

  return [
    '# JSON path search',
    '',
    `Query: ${report.query}`,
    `Target: ${targetLabel}`,
    `Matches: ${report.matches.length.toLocaleString('en-GB')}`,
    ...(report.truncated ? [`Result limit: first ${report.maxResults.toLocaleString('en-GB')} matches shown`] : []),
    '',
    '| Path | Match | Value preview |',
    '| --- | --- | --- |',
    ...(report.matches.length === 0
      ? ['| - | No matches found | - |']
      : report.matches.map(match => `| ${escapeMarkdownCell(match.path)} | ${escapeMarkdownCell(match.matchType)} | ${escapeMarkdownCell(match.valuePreview)} |`))
  ].join('\n');
}

function isSearchableJsonValue(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function formatSearchValuePreview(value) {
  const preview = JSON.stringify(value);

  if (preview.length <= 120) {
    return preview;
  }

  return `${preview.slice(0, 117)}...`;
}

function joinJsonPath(path, key) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
    return `${path}.${key}`;
  }

  return `${path}[${JSON.stringify(key)}]`;
}

function comparePathSummaries(left, right) {
  if (left.path === '$') {
    return -1;
  }

  if (right.path === '$') {
    return 1;
  }

  return left.path.localeCompare(right.path, 'en-GB');
}

function compareShapeTypes(left, right) {
  const order = ['object', 'array', 'string', 'integer', 'number', 'boolean', 'null'];
  return order.indexOf(left) - order.indexOf(right) || left.localeCompare(right, 'en-GB');
}

function formatFieldList(fields) {
  return fields.length === 0 ? '-' : fields.join(', ');
}

function normaliseSchemaOutputFormat(value) {
  return value === JSON_SCHEMA_OUTPUT ? JSON_SCHEMA_OUTPUT : MARKDOWN_SCHEMA_OUTPUT;
}

function normaliseSearchTarget(value) {
  return JSON_SEARCH_TARGETS.some(target => target.value === value) ? value : 'keys-values';
}

function normaliseMaxResults(value) {
  const maxResults = Number(value || 250);

  return Number.isFinite(maxResults) && maxResults > 0 ? Math.floor(maxResults) : 250;
}

function escapeMarkdownCell(value) {
  return String(value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function getJsonType(value) {
  if (Array.isArray(value)) {
    return 'Array';
  }

  if (value === null) {
    return 'Null';
  }

  if (typeof value === 'object') {
    return 'Object';
  }

  if (typeof value === 'string') {
    return 'String';
  }

  if (typeof value === 'number') {
    return 'Number';
  }

  if (typeof value === 'boolean') {
    return 'Boolean';
  }

  return 'Unknown';
}

function normaliseMode(value) {
  return value === MINIFY_MODE ? MINIFY_MODE : FORMAT_MODE;
}

function normaliseIndent(value) {
  const indent = Number(value);
  return [2, 4].includes(indent) ? indent : DEFAULT_INDENT;
}

function countUtf8Bytes(value) {
  return new TextEncoder().encode(String(value)).length;
}

function extractPosition(message) {
  const match = String(message).match(/position\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function extractLineAndColumn(message) {
  const match = String(message).match(/line\s+(\d+)\s+column\s+(\d+)/i);

  if (!match) {
    return {
      line: null,
      column: null
    };
  }

  return {
    line: Number(match[1]),
    column: Number(match[2])
  };
}

function getLineColumnFromPosition(input, position) {
  let line = 1;
  let column = 1;
  const limit = Math.max(0, Math.min(position, input.length));

  for (let index = 0; index < limit; index += 1) {
    if (input[index] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return {
    line,
    column
  };
}

function buildErrorSnippet(input, line, column) {
  const lines = String(input).split(/\r?\n/);
  const lineText = lines[line - 1] || '';
  const pointer = `${' '.repeat(Math.max(column - 1, 0))}^`;

  return `${lineText}\n${pointer}`;
}

function createJsonError(message, details) {
  const error = new Error(message);
  error.details = details;
  return error;
}
