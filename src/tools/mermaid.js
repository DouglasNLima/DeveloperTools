import {
  detectDelimiter,
  parseDelimitedText,
  rowsToObjects
} from './csv-tsv-helper.js';
import {
  parseCurlTokens,
  parseFetchSnippet,
  tokenizeShellCommand
} from './curl-fetch-converter.js';
import { formatBytes } from './base64.js';

export const MERMAID_VERSION = '11.15.0';

export const MERMAID_THEME_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'dark', label: 'Dark' },
  { value: 'forest', label: 'Forest' }
];

export const MERMAID_TEMPLATE_TYPES = [
  { value: 'flowchart', label: 'Flowchart' },
  { value: 'sequence', label: 'Sequence diagram' },
  { value: 'er', label: 'ER diagram' },
  { value: 'class', label: 'Class diagram' },
  { value: 'state', label: 'State diagram' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'gantt', label: 'Gantt chart' },
  { value: 'pie', label: 'Pie chart' },
  { value: 'xy', label: 'XY chart' }
];

export const DATA_MERMAID_FORMATS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV/TSV' }
];

export const DATA_MERMAID_DIAGRAMS = [
  { value: 'tree', label: 'Tree flowchart' },
  { value: 'flowchart', label: 'Record flowchart' },
  { value: 'er', label: 'ER-style entity' },
  { value: 'pie', label: 'Pie chart' },
  { value: 'xy', label: 'XY chart' }
];

export const API_MERMAID_MODES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'request', label: 'API request' },
  { value: 'steps', label: 'Step list' }
];

export const API_MERMAID_DIAGRAMS = [
  { value: 'sequence', label: 'Sequence diagram' },
  { value: 'flowchart', label: 'Flowchart' }
];

const MERMAID_STARTERS = [
  { pattern: /^(flowchart|graph)\b/i, label: 'Flowchart' },
  { pattern: /^sequenceDiagram\b/i, label: 'Sequence diagram' },
  { pattern: /^classDiagram(?:-v2)?\b/i, label: 'Class diagram' },
  { pattern: /^stateDiagram(?:-v2)?\b/i, label: 'State diagram' },
  { pattern: /^erDiagram\b/i, label: 'ER diagram' },
  { pattern: /^gantt\b/i, label: 'Gantt chart' },
  { pattern: /^pie\b/i, label: 'Pie chart' },
  { pattern: /^timeline\b/i, label: 'Timeline' },
  { pattern: /^mindmap\b/i, label: 'Mindmap' },
  { pattern: /^journey\b/i, label: 'User journey' },
  { pattern: /^gitGraph\b/i, label: 'Git graph' },
  { pattern: /^quadrantChart\b/i, label: 'Quadrant chart' },
  { pattern: /^xychart(?:-beta)?\b/i, label: 'XY chart' },
  { pattern: /^requirement(?:Diagram)?\b/i, label: 'Requirement diagram' },
  { pattern: /^sankey(?:-beta)?\b/i, label: 'Sankey diagram' },
  { pattern: /^kanban\b/i, label: 'Kanban board' },
  { pattern: /^architecture\b/i, label: 'Architecture diagram' },
  { pattern: /^block(?:-beta)?\b/i, label: 'Block diagram' },
  { pattern: /^radar-beta\b/i, label: 'Radar chart' },
  { pattern: /^treemap\b/i, label: 'Treemap' },
  { pattern: /^packet(?:-beta)?\b/i, label: 'Packet diagram' },
  { pattern: /^venn-beta\b/i, label: 'Venn diagram' }
];

const MAX_TREE_NODES = 80;
const MAX_TREE_DEPTH = 5;
const MAX_RECORDS = 40;
const MAX_FIELDS = 18;

export function normaliseMermaidSource(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

export function extractMermaidSource(value) {
  const text = String(value ?? '').trim();
  const fenced = text.match(/```(?:mermaid|mmd)\s*([\s\S]*?)```/i);

  return normaliseMermaidSource(fenced ? fenced[1] : text);
}

export function detectMermaidDiagramType(value) {
  const source = extractMermaidSource(value);
  const firstLine = source
    .split('\n')
    .map(line => line.trim())
    .find(line => line && !line.startsWith('%%')) || '';
  const match = MERMAID_STARTERS.find(starter => starter.pattern.test(firstLine));

  return match?.label || 'Unknown';
}

export function isLikelyMermaidSource(value) {
  return detectMermaidDiagramType(value) !== 'Unknown';
}

export function analyseMermaidSource(value) {
  const source = extractMermaidSource(value);
  const outputBytes = new TextEncoder().encode(source).length;
  const lineCount = source ? source.split('\n').length : 0;

  return {
    source,
    diagramType: detectMermaidDiagramType(source),
    validSourceShape: isLikelyMermaidSource(source),
    lineCount,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes)
  };
}

export function buildMermaidDownloadFileName(name, extension = 'mmd') {
  const base = String(name || 'mermaid-diagram')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.(mmd|mermaid|svg|png)$/i, '') || 'mermaid-diagram';

  return `${base}.${extension}`;
}

export function buildMermaidTemplate(options = {}) {
  const template = normaliseOption(options.template, MERMAID_TEMPLATE_TYPES, 'flowchart');
  const title = normaliseLabel(options.title, 'Developer workflow');
  const primary = normaliseLabel(options.primary, 'Client');
  const secondary = normaliseLabel(options.secondary, 'Service');

  const source = buildTemplateSource({ template, title, primary, secondary });
  const analysis = analyseMermaidSource(source);

  return {
    template,
    templateLabel: MERMAID_TEMPLATE_TYPES.find(item => item.value === template).label,
    title,
    primary,
    secondary,
    output: source,
    outputType: analysis.diagramType,
    lineCount: analysis.lineCount,
    outputBytes: analysis.outputBytes,
    outputSizeLabel: analysis.outputSizeLabel
  };
}

export function convertDataToMermaid(options = {}) {
  const input = requireInput(options.input, 'Enter JSON, CSV or TSV data before generating Mermaid.');
  const inputFormat = normaliseOption(options.inputFormat, DATA_MERMAID_FORMATS, 'auto');
  const diagramType = normaliseOption(options.diagramType, DATA_MERMAID_DIAGRAMS, 'tree');
  const entityName = normaliseEntityName(options.entityName || 'Record');
  const parsed = parseDataInput(input, inputFormat);
  const result = buildDataMermaid({
    ...parsed,
    diagramType,
    labelField: String(options.labelField || '').trim(),
    valueField: String(options.valueField || '').trim(),
    entityName
  });
  const analysis = analyseMermaidSource(result.output);

  return {
    ...result,
    inputFormat: parsed.format,
    inputFormatLabel: parsed.format === 'json' ? 'JSON' : parsed.delimiter?.label || 'CSV/TSV',
    diagramType,
    diagramTypeLabel: DATA_MERMAID_DIAGRAMS.find(item => item.value === diagramType).label,
    entityName,
    outputType: analysis.diagramType,
    outputBytes: analysis.outputBytes,
    outputSizeLabel: analysis.outputSizeLabel,
    lineCount: analysis.lineCount,
    warnings: [
      ...parsed.warnings,
      ...result.warnings
    ]
  };
}

export function convertApiWorkflowToMermaid(options = {}) {
  const input = requireInput(options.input, 'Enter an API request, endpoint note or step list before generating Mermaid.');
  const mode = normaliseOption(options.mode, API_MERMAID_MODES, 'auto');
  const diagramType = normaliseOption(options.diagramType, API_MERMAID_DIAGRAMS, 'sequence');
  const title = normaliseLabel(options.title, 'API workflow');
  const parsed = parseApiWorkflowInput(input, mode);
  const output = diagramType === 'flowchart'
    ? buildWorkflowFlowchart(parsed, title)
    : buildWorkflowSequence(parsed, title);
  const analysis = analyseMermaidSource(output);

  return {
    mode,
    modeLabel: parsed.modeLabel,
    diagramType,
    diagramTypeLabel: API_MERMAID_DIAGRAMS.find(item => item.value === diagramType).label,
    title,
    request: parsed.request,
    steps: parsed.steps,
    output,
    outputType: analysis.diagramType,
    outputBytes: analysis.outputBytes,
    outputSizeLabel: analysis.outputSizeLabel,
    lineCount: analysis.lineCount,
    warnings: parsed.warnings
  };
}

export function convertJsonToMermaidTree(value) {
  const parsed = parseJsonValue(value);
  return buildJsonTreeMermaid(parsed.value, {
    rootLabel: 'JSON payload'
  }).output;
}

export function convertCsvToMermaidChart(value) {
  const parsed = parseCsvRecords(value);
  return buildRecordFlowchart(parsed.records, {
    entityName: 'Record'
  }).output;
}

export function convertRequestTextToMermaid(value) {
  return convertApiWorkflowToMermaid({
    input: value,
    mode: 'request',
    diagramType: 'sequence',
    title: 'Request flow'
  }).output;
}

function buildTemplateSource({ template, title, primary, secondary }) {
  const primaryId = toMermaidId(primary, 'primary');
  const secondaryId = toMermaidId(secondary, 'secondary');

  switch (template) {
    case 'sequence':
      return [
        'sequenceDiagram',
        `  participant ${primaryId} as ${escapeMermaidText(primary)}`,
        `  participant ${secondaryId} as ${escapeMermaidText(secondary)}`,
        `  ${primaryId}->>${secondaryId}: Request`,
        `  ${secondaryId}-->>${primaryId}: Response`
      ].join('\n');

    case 'er':
      return [
        'erDiagram',
        `  ${normaliseEntityName(primary)} ||--o{ ${normaliseEntityName(secondary)} : owns`,
        `  ${normaliseEntityName(primary)} {`,
        '    string id',
        '    string name',
        '  }',
        `  ${normaliseEntityName(secondary)} {`,
        '    string id',
        '    string status',
        '  }'
      ].join('\n');

    case 'class':
      return [
        'classDiagram',
        `  class ${normaliseEntityName(primary)} {`,
        '    +string id',
        '    +validate()',
        '  }',
        `  class ${normaliseEntityName(secondary)} {`,
        '    +string status',
        '    +run()',
        '  }',
        `  ${normaliseEntityName(primary)} --> ${normaliseEntityName(secondary)}`
      ].join('\n');

    case 'state':
      return [
        'stateDiagram-v2',
        '  [*] --> Draft',
        `  Draft --> ${toMermaidState(primary)}: submit`,
        `  ${toMermaidState(primary)} --> ${toMermaidState(secondary)}: approve`,
        `  ${toMermaidState(secondary)} --> [*]`
      ].join('\n');

    case 'timeline':
      return [
        'timeline',
        `  title ${escapeTimelineText(title)}`,
        '  Discovery : Capture inputs : Confirm constraints',
        '  Build : Implement locally : Add tests',
        '  Release : Run npm test : Publish static files'
      ].join('\n');

    case 'gantt':
      return [
        'gantt',
        `  title ${escapeTimelineText(title)}`,
        '  dateFormat  YYYY-MM-DD',
        '  section Delivery',
        '  Plan           :done,    plan, 2026-05-01, 2d',
        '  Build          :active,  build, after plan, 4d',
        '  Verify         :         verify, after build, 2d'
      ].join('\n');

    case 'pie':
      return [
        'pie showData',
        `  title ${escapeMermaidText(title)}`,
        `  "${escapeMermaidText(primary)}" : 60`,
        `  "${escapeMermaidText(secondary)}" : 40`
      ].join('\n');

    case 'xy':
      return [
        'xychart-beta',
        `  title "${escapeMermaidText(title)}"`,
        '  x-axis ["Jan", "Feb", "Mar"]',
        '  y-axis "Items" 0 --> 100',
        '  bar [25, 50, 80]'
      ].join('\n');

    case 'flowchart':
    default:
      return [
        'flowchart TD',
        `  start([${escapeMermaidText(title)}])`,
        `  ${primaryId}["${escapeMermaidText(primary)}"]`,
        `  ${secondaryId}["${escapeMermaidText(secondary)}"]`,
        '  done([Done])',
        `  start --> ${primaryId} --> ${secondaryId} --> done`
      ].join('\n');
  }
}

function parseDataInput(input, inputFormat) {
  if (inputFormat === 'json' || (inputFormat === 'auto' && looksLikeJson(input))) {
    const parsed = parseJsonValue(input);
    return {
      format: 'json',
      value: parsed.value,
      records: recordsFromJson(parsed.value),
      warnings: parsed.warnings
    };
  }

  if (inputFormat === 'auto') {
    try {
      const parsed = parseJsonValue(input);
      return {
        format: 'json',
        value: parsed.value,
        records: recordsFromJson(parsed.value),
        warnings: parsed.warnings
      };
    } catch {
      // Fall through to CSV/TSV parsing.
    }
  }

  const parsedCsv = parseCsvRecords(input);
  return {
    format: 'csv',
    value: parsedCsv.records,
    records: parsedCsv.records,
    delimiter: parsedCsv.delimiter,
    warnings: parsedCsv.warnings
  };
}

function parseJsonValue(value) {
  try {
    return {
      value: JSON.parse(String(value ?? '')),
      warnings: []
    };
  } catch (error) {
    throw new Error(error.message || 'JSON could not be parsed.');
  }
}

function parseCsvRecords(value) {
  const input = String(value ?? '');
  const delimiter = detectDelimiter(input);
  const rows = parseDelimitedText(input, delimiter.character);
  const records = rowsToObjects(rows, { firstRowHeaders: true });

  return {
    delimiter,
    records,
    warnings: records.length === 0 ? ['No data rows were found after the header row.'] : []
  };
}

function recordsFromJson(value) {
  if (Array.isArray(value)) {
    if (value.every(isPlainObject)) {
      return value;
    }

    return value.map((item, index) => ({ index: index + 1, value: formatNodeValue(item) }));
  }

  if (isPlainObject(value)) {
    const arrayProperty = Object.entries(value).find(([, item]) => Array.isArray(item) && item.every(isPlainObject));

    if (arrayProperty) {
      return arrayProperty[1];
    }

    return Object.entries(value).map(([key, item]) => ({
      key,
      value: formatNodeValue(item)
    }));
  }

  return [{ value: formatNodeValue(value) }];
}

function buildDataMermaid(options) {
  if (options.diagramType === 'tree') {
    return buildJsonTreeMermaid(options.value, {
      rootLabel: options.format === 'json' ? 'JSON payload' : options.entityName
    });
  }

  if (options.diagramType === 'er') {
    return buildErFromRecords(options.records, options);
  }

  if (options.diagramType === 'pie') {
    return buildPieFromRecords(options.records, options);
  }

  if (options.diagramType === 'xy') {
    return buildXyFromRecords(options.records, options);
  }

  return buildRecordFlowchart(options.records, options);
}

function buildJsonTreeMermaid(value, options = {}) {
  const lines = ['flowchart TD'];
  const warnings = [];
  let nodeCount = 0;
  let truncated = false;

  function visit(label, item, depth, parentId = '') {
    if (nodeCount >= MAX_TREE_NODES) {
      truncated = true;
      return;
    }

    const id = `node_${nodeCount + 1}`;
    nodeCount += 1;
    const displayLabel = depth === 0
      ? label
      : `${label}${isContainer(item) ? '' : `: ${formatNodeValue(item)}`}`;

    lines.push(`  ${id}["${escapeMermaidText(displayLabel)}"]`);

    if (parentId) {
      lines.push(`  ${parentId} --> ${id}`);
    }

    if (depth >= MAX_TREE_DEPTH || !isContainer(item)) {
      return;
    }

    const entries = Array.isArray(item)
      ? item.slice(0, 12).map((child, index) => [`[${index}]`, child])
      : Object.entries(item).slice(0, 14);

    if ((Array.isArray(item) && item.length > entries.length) || (!Array.isArray(item) && Object.keys(item).length > entries.length)) {
      truncated = true;
    }

    entries.forEach(([childLabel, childValue]) => {
      visit(childLabel, childValue, depth + 1, id);
    });
  }

  visit(options.rootLabel || 'Root', value, 0);

  if (truncated) {
    warnings.push('Large input was truncated to keep the Mermaid diagram readable.');
  }

  return {
    output: lines.join('\n'),
    warnings,
    recordCount: Array.isArray(value) ? value.length : 1
  };
}

function buildRecordFlowchart(records, options = {}) {
  const rows = requireRecords(records);
  const sourceField = findField(rows, ['source', 'from', 'parent']);
  const targetField = findField(rows, ['target', 'to', 'child']);
  const labelField = options.labelField || findField(rows, ['label', 'name', 'title', 'id', 'key']);
  const lines = ['flowchart TD'];
  const warnings = [];
  const limitedRows = rows.slice(0, MAX_RECORDS);

  if (sourceField && targetField) {
    limitedRows.forEach((row, index) => {
      const source = normaliseLabel(row[sourceField], `Source ${index + 1}`);
      const target = normaliseLabel(row[targetField], `Target ${index + 1}`);
      const label = labelField ? normaliseLabel(row[labelField], '') : '';
      const sourceId = toMermaidId(source, `source_${index + 1}`);
      const targetId = toMermaidId(target, `target_${index + 1}`);

      lines.push(`  ${sourceId}["${escapeMermaidText(source)}"]`);
      lines.push(`  ${targetId}["${escapeMermaidText(target)}"]`);
      lines.push(label
        ? `  ${sourceId} -->|"${escapeMermaidText(label)}"| ${targetId}`
        : `  ${sourceId} --> ${targetId}`);
    });
  } else {
    const rootId = toMermaidId(options.entityName || 'Records', 'records');
    lines.push(`  ${rootId}["${escapeMermaidText(options.entityName || 'Records')}"]`);
    limitedRows.forEach((row, index) => {
      const label = normaliseLabel(readField(row, labelField) || row.id || row.key || row.name, `Row ${index + 1}`);
      const rowId = `row_${index + 1}`;
      lines.push(`  ${rowId}["${escapeMermaidText(label)}"]`);
      lines.push(`  ${rootId} --> ${rowId}`);
    });
  }

  if (rows.length > limitedRows.length) {
    warnings.push(`${rows.length - limitedRows.length} record${rows.length - limitedRows.length === 1 ? '' : 's'} omitted to keep the diagram readable.`);
  }

  return {
    output: uniqueLines(lines).join('\n'),
    warnings,
    recordCount: rows.length
  };
}

function buildErFromRecords(records, options = {}) {
  const rows = requireRecords(records);
  const fields = collectRecordFields(rows).slice(0, MAX_FIELDS);
  const entity = normaliseEntityName(options.entityName || 'Record');
  const lines = [
    'erDiagram',
    `  ${entity} {`,
    ...fields.map(field => `    ${inferMermaidFieldType(rows, field)} ${toMermaidFieldName(field)}`),
    '  }'
  ];
  const warnings = fields.length < collectRecordFields(rows).length
    ? ['Some fields were omitted to keep the entity readable.']
    : [];

  return {
    output: lines.join('\n'),
    warnings,
    recordCount: rows.length
  };
}

function buildPieFromRecords(records, options = {}) {
  const rows = requireRecords(records);
  const labelField = options.labelField || findField(rows, ['label', 'name', 'status', 'type', 'category', 'key']);
  const valueField = options.valueField || findNumericField(rows);

  if (!labelField) {
    throw new Error('Choose a label field for the pie chart.');
  }

  const buckets = new Map();

  rows.forEach(row => {
    const label = normaliseLabel(row[labelField], 'Unlabelled');
    const rawValue = valueField ? Number(row[valueField]) : 1;
    const value = Number.isFinite(rawValue) ? rawValue : 1;
    buckets.set(label, (buckets.get(label) || 0) + value);
  });

  const entries = [...buckets.entries()].slice(0, 16);

  return {
    output: [
      'pie showData',
      `  title ${escapeMermaidText(labelField)} breakdown`,
      ...entries.map(([label, value]) => `  "${escapeMermaidText(label)}" : ${roundChartValue(value)}`)
    ].join('\n'),
    warnings: buckets.size > entries.length ? ['Some slices were omitted to keep the chart readable.'] : [],
    recordCount: rows.length
  };
}

function buildXyFromRecords(records, options = {}) {
  const rows = requireRecords(records);
  const labelField = options.labelField || findField(rows, ['label', 'name', 'month', 'date', 'key']);
  const valueField = options.valueField || findNumericField(rows);

  if (!labelField || !valueField) {
    throw new Error('Choose label and numeric value fields for the XY chart.');
  }

  const points = rows
    .map(row => ({
      label: normaliseLabel(row[labelField], ''),
      value: Number(row[valueField])
    }))
    .filter(point => point.label && Number.isFinite(point.value))
    .slice(0, 24);

  if (points.length === 0) {
    throw new Error('No numeric chart values were found.');
  }

  const max = Math.max(...points.map(point => point.value), 1);

  return {
    output: [
      'xychart-beta',
      `  title "${escapeMermaidText(valueField)} by ${escapeMermaidText(labelField)}"`,
      `  x-axis [${points.map(point => `"${escapeMermaidText(point.label)}"`).join(', ')}]`,
      `  y-axis "${escapeMermaidText(valueField)}" 0 --> ${roundChartValue(max)}`,
      `  bar [${points.map(point => roundChartValue(point.value)).join(', ')}]`
    ].join('\n'),
    warnings: rows.length > points.length ? ['Rows without usable labels or numeric values were omitted.'] : [],
    recordCount: rows.length
  };
}

function parseApiWorkflowInput(input, mode) {
  if (mode === 'steps') {
    return parseStepList(input);
  }

  if (mode === 'request' || looksLikeRequest(input)) {
    return parseRequestInput(input);
  }

  return parseStepList(input);
}

function parseRequestInput(input) {
  const text = String(input ?? '').trim();
  const warnings = [];
  let request = null;

  try {
    if (/^\s*curl(?:\.exe)?\b/i.test(text)) {
      request = parseCurlTokens(tokenizeShellCommand(text));
    } else {
      const fetchSnippet = extractFencedCode(text, 'fetch') || text;
      request = parseFetchSnippet(fetchSnippet);
    }
  } catch (error) {
    const endpoint = extractEndpoint(text);
    if (!endpoint) {
      throw new Error(error.message || 'The request could not be parsed.');
    }

    request = {
      method: extractMethod(text) || 'GET',
      url: endpoint,
      headers: [],
      body: '',
      warnings: []
    };
    warnings.push('Only the endpoint and method could be inferred.');
  }

  return {
    modeLabel: 'API request',
    request,
    steps: [],
    warnings: [...warnings, ...(request.warnings || [])]
  };
}

function parseStepList(input) {
  const steps = String(input ?? '')
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);

  if (steps.length === 0) {
    throw new Error('Enter at least one workflow step.');
  }

  return {
    modeLabel: 'Step list',
    request: null,
    steps,
    warnings: []
  };
}

function buildWorkflowSequence(parsed, title) {
  if (parsed.request) {
    const method = normaliseLabel(parsed.request.method || 'GET', 'GET').toLocaleUpperCase('en-GB');
    const url = normaliseLabel(parsed.request.url, '/');
    const serviceName = serviceNameFromUrl(url);
    const bodyNote = parsed.request.body ? ' with body' : '';

    return [
      'sequenceDiagram',
      '  autonumber',
      '  participant Client',
      `  participant Service as ${escapeMermaidText(serviceName)}`,
      `  Client->>Service: ${escapeMermaidText(`${method} ${url}${bodyNote}`)}`,
      '  Service-->>Client: Response'
    ].join('\n');
  }

  const lines = [
    'sequenceDiagram',
    '  autonumber',
    '  participant User',
    `  participant Flow as ${escapeMermaidText(title)}`
  ];

  parsed.steps.slice(0, MAX_RECORDS).forEach(step => {
    lines.push(`  User->>Flow: ${escapeMermaidText(step)}`);
    lines.push('  Flow-->>User: Continue');
  });

  return lines.join('\n');
}

function buildWorkflowFlowchart(parsed, title) {
  const steps = parsed.request
    ? [
        `Prepare ${parsed.request.method || 'GET'} request`,
        parsed.request.url,
        parsed.request.body ? 'Send request body' : 'Send request',
        'Handle response'
      ]
    : parsed.steps;
  const lines = ['flowchart TD'];
  const titleId = toMermaidId(title, 'workflow');

  lines.push(`  ${titleId}["${escapeMermaidText(title)}"]`);
  steps.slice(0, MAX_RECORDS).forEach((step, index) => {
    const id = `step_${index + 1}`;
    lines.push(`  ${id}["${escapeMermaidText(step)}"]`);
    lines.push(index === 0 ? `  ${titleId} --> ${id}` : `  step_${index} --> ${id}`);
  });

  return lines.join('\n');
}

function extractFencedCode(text, preferredKind = '') {
  const fencePattern = /```([^\r\n]*)\r?\n([\s\S]*?)```/g;
  let match = fencePattern.exec(text);

  while (match) {
    const kind = match[1].trim().toLocaleLowerCase('en-GB');
    const block = match[2].trim();

    if (!preferredKind || kind.includes(preferredKind) || (preferredKind === 'fetch' && /\bfetch\s*\(/.test(block))) {
      return block;
    }

    match = fencePattern.exec(text);
  }

  return '';
}

function extractEndpoint(text) {
  const endpointLine = String(text ?? '').match(/^(?:\/\/\s*)?Endpoint:\s*(.+)$/im);

  if (endpointLine) {
    return endpointLine[1].trim();
  }

  const url = String(text ?? '').match(/https?:\/\/[^\s"'`]+|\/(?:_api|api)\/[^\s"'`]+/i);
  return url ? url[0].trim() : '';
}

function extractMethod(text) {
  const method = String(text ?? '').match(/\b(?:method|type)\s*:\s*["'`](GET|POST|PUT|PATCH|DELETE|HEAD)["'`]/i)
    || String(text ?? '').match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD)\s+(?:https?:\/\/|\/)/i);

  return method ? method[1].toLocaleUpperCase('en-GB') : '';
}

function looksLikeRequest(text) {
  return /^\s*curl(?:\.exe)?\b/i.test(text)
    || /\bfetch\s*\(/.test(text)
    || /Endpoint:\s*/i.test(text)
    || /\b(GET|POST|PUT|PATCH|DELETE|HEAD)\s+(?:https?:\/\/|\/)/i.test(text);
}

function requireRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('No records were found for this diagram type.');
  }

  return records.filter(isPlainObject);
}

function collectRecordFields(records) {
  const fields = [];
  const seen = new Set();

  records.forEach(record => {
    Object.keys(record).forEach(field => {
      if (!seen.has(field)) {
        seen.add(field);
        fields.push(field);
      }
    });
  });

  return fields;
}

function findField(records, candidates) {
  const fields = collectRecordFields(records);
  const lowerFields = new Map(fields.map(field => [field.toLocaleLowerCase('en-GB'), field]));

  for (const candidate of candidates) {
    if (lowerFields.has(candidate)) {
      return lowerFields.get(candidate);
    }
  }

  return fields.find(field => candidates.some(candidate => field.toLocaleLowerCase('en-GB').includes(candidate))) || '';
}

function findNumericField(records) {
  return collectRecordFields(records).find(field => records.some(record => Number.isFinite(Number(record[field])))) || '';
}

function readField(record, field) {
  return field ? record[field] : '';
}

function inferMermaidFieldType(records, field) {
  const sample = records.map(record => record[field]).find(value => value != null && String(value).trim() !== '');
  const text = String(sample ?? '');

  if (/^(true|false)$/i.test(text) || typeof sample === 'boolean') {
    return 'boolean';
  }

  if (/^-?\d+$/.test(text)) {
    return 'int';
  }

  if (/^-?\d+\.\d+$/.test(text)) {
    return 'float';
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return 'date';
  }

  return 'string';
}

function formatNodeValue(value) {
  if (value == null) {
    return 'null';
  }

  if (typeof value === 'object') {
    return Array.isArray(value) ? `Array(${value.length})` : 'Object';
  }

  const text = String(value);
  return text.length > 48 ? `${text.slice(0, 45)}...` : text;
}

function isContainer(value) {
  return value && typeof value === 'object';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function looksLikeJson(value) {
  const text = String(value ?? '').trim();
  return text.startsWith('{') || text.startsWith('[');
}

function normaliseOption(value, options, fallback) {
  return options.some(option => option.value === value) ? value : fallback;
}

function requireInput(value, message) {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new Error(message);
  }

  return text;
}

function normaliseLabel(value, fallback) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normaliseEntityName(value) {
  const text = String(value || 'Record')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLocaleUpperCase('en-GB');

  return /^[A-Z_]/.test(text) ? text : `ENTITY_${text || 'RECORD'}`;
}

function toMermaidFieldName(value) {
  const text = String(value || 'field')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLocaleLowerCase('en-GB');

  return /^[a-z_]/.test(text) ? text : `field_${text || 'value'}`;
}

function toMermaidState(value) {
  return toMermaidId(value, 'state');
}

function toMermaidId(value, fallback) {
  const text = String(value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLocaleLowerCase('en-GB');

  return /^[a-z_]/.test(text) ? text : `${fallback}_${text || 'node'}`;
}

function escapeMermaidText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function escapeTimelineText(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ').replace(/:/g, '-').trim();
}

function roundChartValue(value) {
  return Math.round(Number(value) * 100) / 100;
}

function serviceNameFromUrl(value) {
  const text = String(value || '').trim();

  try {
    const url = new URL(text, 'https://local.example');
    return url.hostname === 'local.example' ? 'Local app' : url.hostname;
  } catch {
    return 'Service';
  }
}

function uniqueLines(lines) {
  const seenNodeDeclarations = new Set();

  return lines.filter(line => {
    const nodeMatch = line.match(/^\s*([A-Za-z_][\w]*)\["/);

    if (!nodeMatch) {
      return true;
    }

    if (seenNodeDeclarations.has(nodeMatch[1])) {
      return false;
    }

    seenNodeDeclarations.add(nodeMatch[1]);
    return true;
  });
}
