import { formatBytes } from './base64.js';

export const DATA_EXPLORER_INPUT_FORMATS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' }
];

export const DATA_EXPLORER_FILTER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not-equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts-with', label: 'Starts with' },
  { value: 'ends-with', label: 'Ends with' },
  { value: 'exists', label: 'Exists' },
  { value: 'empty', label: 'Is empty' },
  { value: 'greater-than', label: 'Greater than' },
  { value: 'less-than', label: 'Less than' }
];

const COMMON_RECORD_PATHS = [
  'items',
  'data',
  'records',
  'results',
  'value',
  'data.items',
  'data.records',
  'data.results',
  'data.value'
];

const COMPLEX_VALUE_LIMIT = 240;

export function processDataExplorer(options = {}) {
  const input = requireInput(options.input);
  const inputFormat = resolveInputFormat(input, options.inputFormat);

  if (inputFormat === 'xml') {
    return processXmlData(input, options);
  }

  return processJsonData(input, options);
}

export function processJsonData(input, options = {}) {
  const parsed = parseJsonInput(input);
  const resolved = resolveJsonRecords(parsed, options.recordPath);
  const filters = normaliseFilters(options.filters);
  const sort = normaliseSort(options.sort);
  const selectedColumns = normaliseSelectedColumns(options.selectedColumns);
  const limit = normaliseLimit(options.limit);
  const warnings = [...resolved.warnings];
  const filteredRecords = applyFilters(resolved.records, filters);
  const sortedRecords = applySort(filteredRecords, sort);
  const outputRecords = limit ? sortedRecords.slice(0, limit) : sortedRecords;

  if (limit && filteredRecords.length > outputRecords.length) {
    warnings.push(`Result limit applied: showing ${outputRecords.length.toLocaleString('en-GB')} of ${filteredRecords.length.toLocaleString('en-GB')} matching records.`);
  }

  return buildExplorerResult({
    inputFormat: 'json',
    recordPath: resolved.recordPath,
    sourceCount: resolved.records.length,
    filteredCount: filteredRecords.length,
    outputRecords,
    selectedColumns,
    warnings
  });
}

export function processXmlData(input, options = {}) {
  const document = parseXmlInput(input, options.parseXmlDocument);
  const extracted = extractXmlRecords(document);
  const selectedColumns = normaliseSelectedColumns(options.selectedColumns);
  const limit = normaliseLimit(options.limit);
  const warnings = [...extracted.warnings];

  if (normaliseFilters(options.filters).length > 0 || normaliseSort(options.sort).field) {
    warnings.push('XML query filters are not applied in this version; the XML rows were flattened for review.');
  }

  const flattenedRecords = extracted.records.map(record => flattenRecord(record));
  const outputRecords = limit ? flattenedRecords.slice(0, limit) : flattenedRecords;

  if (limit && flattenedRecords.length > outputRecords.length) {
    warnings.push(`Result limit applied: showing ${outputRecords.length.toLocaleString('en-GB')} of ${flattenedRecords.length.toLocaleString('en-GB')} XML rows.`);
  }

  return buildExplorerResult({
    inputFormat: 'xml',
    recordPath: extracted.recordPath,
    sourceCount: flattenedRecords.length,
    filteredCount: flattenedRecords.length,
    outputRecords,
    selectedColumns,
    warnings
  });
}

export function resolveJsonRecords(value, recordPath = '') {
  const trimmedPath = String(recordPath ?? '').trim();

  if (trimmedPath) {
    const target = getValueAtPath(value, trimmedPath);

    if (!Array.isArray(target)) {
      throw new Error('The JSON record path must point to an array.');
    }

    return {
      recordPath: normaliseRecordPathLabel(trimmedPath),
      records: target,
      warnings: []
    };
  }

  const auto = findAutomaticRecordArray(value);

  if (!auto) {
    throw new Error('No JSON record array was found automatically. Enter a record path such as items or data.records.');
  }

  return {
    recordPath: auto.path,
    records: auto.records,
    warnings: auto.path === '$' ? [] : [`Record path auto-detected as ${auto.path}.`]
  };
}

export function parseJsonInput(input) {
  try {
    return JSON.parse(requireInput(input));
  } catch (error) {
    if (error.message === 'Enter JSON or XML input before exploring data.') {
      throw error;
    }

    throw new Error(`JSON parse error: ${error.message || 'Unable to parse JSON.'}`);
  }
}

export function resolveInputFormat(input, inputFormat = 'auto') {
  const format = DATA_EXPLORER_INPUT_FORMATS.some(item => item.value === inputFormat) ? inputFormat : 'auto';

  if (format !== 'auto') {
    return format;
  }

  const trimmed = requireInput(input).trimStart();
  return trimmed.startsWith('<') ? 'xml' : 'json';
}

export function flattenRecord(value, prefix = '', result = {}) {
  if (Array.isArray(value)) {
    result[prefix || 'value'] = formatGridValue(value);
    return result;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value);

    if (entries.length === 0 && prefix) {
      result[prefix] = '{}';
      return result;
    }

    entries.forEach(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;

      if (Array.isArray(child)) {
        result[path] = formatGridValue(child);
      } else if (child && typeof child === 'object') {
        flattenRecord(child, path, result);
      } else {
        result[path] = formatGridValue(child);
      }
    });

    return result;
  }

  result[prefix || 'value'] = formatGridValue(value);
  return result;
}

export function applyFilters(records, filters = []) {
  const activeFilters = normaliseFilters(filters);

  if (activeFilters.length === 0) {
    return [...records];
  }

  return records.filter(record => activeFilters.every(filter => matchesFilter(record, filter)));
}

export function applySort(records, sort = {}) {
  const normalisedSort = normaliseSort(sort);

  if (!normalisedSort.field) {
    return [...records];
  }

  const direction = normalisedSort.direction === 'desc' ? -1 : 1;

  return [...records].sort((left, right) => compareValues(
    getValueAtPath(left, normalisedSort.field),
    getValueAtPath(right, normalisedSort.field)
  ) * direction);
}

export function getValueAtPath(value, path) {
  const segments = parsePathSegments(path);

  return segments.reduce((current, segment) => {
    if (current == null) {
      return undefined;
    }

    return current[segment];
  }, value);
}

export function parsePathSegments(path) {
  const rawPath = String(path ?? '').trim();

  if (!rawPath || rawPath === '$') {
    return [];
  }

  const source = rawPath.startsWith('$') ? rawPath.slice(1).replace(/^\./, '') : rawPath;
  const segments = [];
  let buffer = '';

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (character === '.') {
      if (buffer) {
        pushPathSegment(segments, buffer);
        buffer = '';
      } else if (source[index - 1] !== ']') {
        throw new Error('Record path contains an empty segment.');
      }

      continue;
    }

    if (character === '[') {
      if (buffer) {
        pushPathSegment(segments, buffer);
        buffer = '';
      }

      const closeIndex = source.indexOf(']', index);

      if (closeIndex === -1) {
        throw new Error('Record path contains an unclosed bracket.');
      }

      const segment = source.slice(index + 1, closeIndex).trim();
      segments.push(normaliseBracketSegment(segment));
      index = closeIndex;
      continue;
    }

    buffer += character;
  }

  if (buffer) {
    pushPathSegment(segments, buffer);
  }

  return segments;
}

export function extractXmlRecords(document) {
  const root = document?.documentElement;

  if (!root) {
    throw new Error('XML input does not contain a root element.');
  }

  const group = findRepeatedXmlElementGroup(root);

  if (!group) {
    return {
      recordPath: buildXmlPath(root),
      records: [xmlElementToRecord(root)],
      warnings: ['No repeated XML sibling elements were found, so the root element was shown as one row.']
    };
  }

  return {
    recordPath: buildXmlPath(group.elements[0]),
    records: group.elements.map(element => xmlElementToRecord(element)),
    warnings: []
  };
}

export function xmlElementToRecord(element) {
  const record = {};

  Array.from(element.attributes || []).forEach(attribute => {
    record[`@${attribute.name}`] = attribute.value;
  });

  const childElements = getElementChildren(element);
  const directText = getDirectText(element);

  if (childElements.length === 0) {
    if (directText || Object.keys(record).length === 0) {
      record._text = directText;
    }

    return record;
  }

  if (directText) {
    record._text = directText;
  }

  groupXmlChildren(childElements).forEach((children, name) => {
    if (children.length === 1) {
      record[name] = xmlElementValue(children[0]);
    } else {
      record[name] = children.map(child => xmlElementValue(child));
    }
  });

  return record;
}

function buildExplorerResult(options) {
  const flattenedRows = options.outputRecords.map(record => flattenRecord(record));
  const availableColumns = collectColumns(flattenedRows);
  const missingColumns = options.selectedColumns.filter(column => !availableColumns.includes(column));
  const gridColumns = options.selectedColumns.length > 0 ? options.selectedColumns : availableColumns;
  const gridRows = flattenedRows.map(row => gridColumns.reduce((result, column) => {
    result[column] = row[column] ?? '';
    return result;
  }, {}));
  const outputJson = JSON.stringify(options.outputRecords, null, 2);
  const outputBytes = new TextEncoder().encode(outputJson).length;
  const warnings = [...options.warnings];

  if (missingColumns.length > 0) {
    warnings.push(`Selected column${missingColumns.length === 1 ? '' : 's'} not found: ${missingColumns.join(', ')}.`);
  }

  return {
    inputFormat: options.inputFormat,
    recordPath: options.recordPath,
    sourceCount: options.sourceCount,
    filteredCount: options.filteredCount,
    matchedCount: options.outputRecords.length,
    outputRecords: options.outputRecords,
    gridColumns,
    gridRows,
    outputJson,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    warnings
  };
}

function processXmlParserError(document) {
  const parserError = document.getElementsByTagName('parsererror')[0];

  if (!parserError) {
    return null;
  }

  const message = parserError.textContent
    .replace(/\s+/g, ' ')
    .trim();

  return message || 'Unable to parse XML.';
}

function parseXmlInput(input, parser) {
  if (typeof parser === 'function') {
    return parser(input);
  }

  if (typeof DOMParser === 'undefined') {
    throw new Error('XML parsing is only available in the browser.');
  }

  const document = new DOMParser().parseFromString(requireInput(input), 'application/xml');
  const parserError = processXmlParserError(document);

  if (parserError) {
    throw new Error(`XML parse error: ${parserError}`);
  }

  return document;
}

function findAutomaticRecordArray(value) {
  if (Array.isArray(value)) {
    return {
      path: '$',
      records: value
    };
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  for (const path of COMMON_RECORD_PATHS) {
    const records = getValueAtPath(value, path);

    if (Array.isArray(records)) {
      return {
        path: `$.${path}`,
        records
      };
    }
  }

  return findFirstNestedArray(value);
}

function findFirstNestedArray(value, prefix = '$') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    const path = `${prefix}.${key}`;

    if (Array.isArray(child)) {
      return {
        path,
        records: child
      };
    }

    const nested = findFirstNestedArray(child, path);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function matchesFilter(record, filter) {
  const actual = getValueAtPath(record, filter.field);

  if (filter.operator === 'exists') {
    return actual !== undefined;
  }

  if (filter.operator === 'empty') {
    return actual === undefined || actual === null || String(actual).trim() === '';
  }

  if (filter.operator === 'equals') {
    return compareFilterValues(actual, filter.value) === 0;
  }

  if (filter.operator === 'not-equals') {
    return compareFilterValues(actual, filter.value) !== 0;
  }

  const actualText = String(formatRawComparableValue(actual)).toLocaleLowerCase('en-GB');
  const expectedText = String(filter.value ?? '').toLocaleLowerCase('en-GB');

  if (filter.operator === 'contains') {
    return actualText.includes(expectedText);
  }

  if (filter.operator === 'starts-with') {
    return actualText.startsWith(expectedText);
  }

  if (filter.operator === 'ends-with') {
    return actualText.endsWith(expectedText);
  }

  if (filter.operator === 'greater-than') {
    return compareValues(actual, filter.value) > 0;
  }

  if (filter.operator === 'less-than') {
    return compareValues(actual, filter.value) < 0;
  }

  return true;
}

function normaliseFilters(filters = []) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters
    .map(filter => ({
      field: String(filter?.field ?? '').trim(),
      operator: normaliseFilterOperator(filter?.operator),
      value: filter?.value ?? ''
    }))
    .filter(filter => filter.field);
}

function normaliseFilterOperator(value) {
  return DATA_EXPLORER_FILTER_OPERATORS.some(operator => operator.value === value) ? value : 'equals';
}

function normaliseSort(sort = {}) {
  return {
    field: String(sort?.field ?? '').trim(),
    direction: sort?.direction === 'desc' ? 'desc' : 'asc'
  };
}

function normaliseSelectedColumns(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(/[\n,]/);

  return list
    .map(item => String(item ?? '').trim())
    .filter(Boolean);
}

function normaliseLimit(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) {
    throw new Error('Result limit must be a whole number between 1 and 10,000.');
  }

  return limit;
}

function compareFilterValues(actual, expected) {
  const coercedExpected = coerceExpectedValue(actual, expected);

  if (actual === coercedExpected) {
    return 0;
  }

  return compareValues(actual, coercedExpected);
}

function compareValues(left, right) {
  const leftValue = formatRawComparableValue(left);
  const rightValue = formatRawComparableValue(right);

  if (leftValue == null && rightValue == null) {
    return 0;
  }

  if (leftValue == null) {
    return 1;
  }

  if (rightValue == null) {
    return -1;
  }

  const leftNumber = Number(leftValue);
  const rightNumber = Number(rightValue);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && String(leftValue).trim() !== '' && String(rightValue).trim() !== '') {
    return leftNumber === rightNumber ? 0 : leftNumber > rightNumber ? 1 : -1;
  }

  return String(leftValue).localeCompare(String(rightValue), 'en-GB', {
    sensitivity: 'base',
    numeric: true
  });
}

function coerceExpectedValue(actual, expected) {
  if (typeof actual === 'number') {
    const number = Number(expected);
    return Number.isFinite(number) ? number : expected;
  }

  if (typeof actual === 'boolean') {
    if (String(expected).toLocaleLowerCase('en-GB') === 'true') {
      return true;
    }

    if (String(expected).toLocaleLowerCase('en-GB') === 'false') {
      return false;
    }
  }

  if (actual === null && String(expected).toLocaleLowerCase('en-GB') === 'null') {
    return null;
  }

  return expected;
}

function formatRawComparableValue(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.stringify(value);
  }

  return value;
}

function collectColumns(rows) {
  const columns = [];
  const seen = new Set();

  rows.forEach(row => {
    Object.keys(row).forEach(column => {
      if (!seen.has(column)) {
        seen.add(column);
        columns.push(column);
      }
    });
  });

  return columns;
}

function formatGridValue(value) {
  if (value === undefined) {
    return '';
  }

  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value) || (value && typeof value === 'object')) {
    const output = JSON.stringify(value);
    return output.length > COMPLEX_VALUE_LIMIT ? `${output.slice(0, COMPLEX_VALUE_LIMIT - 3)}...` : output;
  }

  return String(value);
}

function findRepeatedXmlElementGroup(root) {
  const groups = [];

  visitXmlElement(root, element => {
    const childGroups = groupXmlChildren(getElementChildren(element));

    childGroups.forEach(children => {
      if (children.length > 1) {
        groups.push({
          elements: children,
          count: children.length,
          depth: getXmlDepth(children[0])
        });
      }
    });
  });

  return groups.sort((left, right) => right.count - left.count || left.depth - right.depth)[0] || null;
}

function xmlElementValue(element) {
  const childElements = getElementChildren(element);
  const hasAttributes = (element.attributes || []).length > 0;

  if (childElements.length === 0 && !hasAttributes) {
    return getDirectText(element);
  }

  return xmlElementToRecord(element);
}

function visitXmlElement(element, callback) {
  callback(element);
  getElementChildren(element).forEach(child => visitXmlElement(child, callback));
}

function getElementChildren(element) {
  return Array.from(element.childNodes || []).filter(node => node.nodeType === 1);
}

function groupXmlChildren(children) {
  return children.reduce((groups, child) => {
    const name = child.localName || child.nodeName;
    const items = groups.get(name) || [];
    items.push(child);
    groups.set(name, items);
    return groups;
  }, new Map());
}

function getDirectText(element) {
  return Array.from(element.childNodes || [])
    .filter(node => node.nodeType === 3 || node.nodeType === 4)
    .map(node => node.nodeValue)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildXmlPath(element) {
  const parts = [];
  let current = element;

  while (current && current.nodeType === 1) {
    parts.unshift(current.localName || current.nodeName);
    current = current.parentElement;
  }

  return `/${parts.join('/')}`;
}

function getXmlDepth(element) {
  let depth = 0;
  let current = element;

  while (current && current.nodeType === 1) {
    depth += 1;
    current = current.parentElement;
  }

  return depth;
}

function normaliseRecordPathLabel(path) {
  const trimmed = String(path ?? '').trim();

  if (!trimmed || trimmed === '$') {
    return '$';
  }

  return trimmed.startsWith('$') ? trimmed : `$.${trimmed}`;
}

function normaliseBracketSegment(segment) {
  if (!segment) {
    throw new Error('Record path contains an empty bracket segment.');
  }

  if (/^\d+$/.test(segment)) {
    return Number(segment);
  }

  const quoted = segment.match(/^["'](.+)["']$/);
  return quoted ? quoted[1] : segment;
}

function pushPathSegment(segments, value) {
  const segment = String(value ?? '').trim();

  if (!segment) {
    throw new Error('Record path contains an empty segment.');
  }

  segments.push(segment);
}

function requireInput(input) {
  const value = String(input ?? '');

  if (!value.trim()) {
    throw new Error('Enter JSON or XML input before exploring data.');
  }

  return value;
}
