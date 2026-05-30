import { formatBytes } from './base64.js';
import {
  analyseMermaidSource,
  buildMermaidDownloadFileName
} from './mermaid.js';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP64_SIZE_SENTINEL = 0xffffffff;
const ZIP64_COUNT_SENTINEL = 0xffff;
const ZIP_ENCRYPTED_FLAG = 0x0001;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORED = 0;
const ZIP_DEFLATE = 8;
const MAX_COMPONENTS = 120;
const MAX_ACTIONS_PER_COMPONENT = 80;

export const SOLUTION_MERMAID_COMPONENT_FILTERS = [
  { value: 'all', label: 'All components' },
  { value: 'cloud-flow', label: 'Cloud flows' },
  { value: 'business-process-flow', label: 'Business process flows' },
  { value: 'business-rule', label: 'Business rules' },
  { value: 'classic-workflow', label: 'Classic workflows' },
  { value: 'other-process', label: 'Other processes' }
];

export const WORKFLOW_CATEGORY_TYPES = {
  0: { type: 'classic-workflow', label: 'Classic workflow' },
  1: { type: 'dialog', label: 'Dialog' },
  2: { type: 'business-rule', label: 'Business rule' },
  3: { type: 'action', label: 'Action' },
  4: { type: 'business-process-flow', label: 'Business process flow' },
  5: { type: 'cloud-flow', label: 'Cloud flow' }
};

export async function processPowerPlatformSolutionArchive(input, options = {}) {
  const bytes = await normaliseArchiveBytes(input);
  const zip = await readZipArchive(bytes, options);
  const textFiles = await readSolutionTextFiles(zip);
  const solution = parseSolutionMetadata(textFiles.solutionXml);
  const metadataComponents = parseWorkflowMetadata(textFiles.customizationsXml);
  const jsonFlowComponents = parseWorkflowJsonFiles(textFiles.workflowJsonFiles);
  const components = mergeWorkflowComponents(metadataComponents, jsonFlowComponents);

  if (components.length === 0) {
    throw new Error('No Power Platform workflow components were found in this solution export.');
  }

  const limitedComponents = components.slice(0, MAX_COMPONENTS).map(component => buildComponentDiagram(component));
  const warnings = [
    ...zip.warnings,
    ...textFiles.warnings,
    ...(components.length > limitedComponents.length
      ? [`${components.length - limitedComponents.length} component${components.length - limitedComponents.length === 1 ? '' : 's'} omitted to keep the report readable.`]
      : [])
  ];
  const inventoryMarkdown = buildSolutionInventoryMarkdown({
    solution,
    components: limitedComponents,
    warnings
  });
  const outputBytes = new TextEncoder().encode(inventoryMarkdown).length;

  return {
    solution,
    components: limitedComponents,
    warnings,
    summary: buildSummary(limitedComponents),
    zip: {
      entryCount: zip.entries.length,
      workflowJsonCount: textFiles.workflowJsonFiles.length
    },
    inventoryMarkdown,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes)
  };
}

export async function readZipArchive(input, options = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (bytes.byteLength < 22) {
    throw new Error('Choose a valid exported solution ZIP file.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);

  if (eocdOffset < 0) {
    throw new Error('The ZIP central directory could not be found.');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  if (totalEntries === ZIP64_COUNT_SENTINEL || centralDirectorySize === ZIP64_SIZE_SENTINEL || centralDirectoryOffset === ZIP64_SIZE_SENTINEL) {
    throw new Error('ZIP64 solution archives are not supported in this browser-only reader.');
  }

  if (centralDirectoryOffset + centralDirectorySize > bytes.byteLength) {
    throw new Error('The ZIP central directory is outside the archive bounds.');
  }

  const entries = [];
  const warnings = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('The ZIP central directory contains an invalid entry.');
    }

    const flags = view.getUint16(offset + 8, true);
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileNameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength);
    const name = decodeZipName(fileNameBytes, Boolean(flags & ZIP_UTF8_FLAG));

    if (flags & ZIP_ENCRYPTED_FLAG) {
      warnings.push(`${name} is encrypted and was skipped.`);
    } else if (!name.endsWith('/')) {
      entries.push({
        name,
        flags,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        localHeaderOffset
      });
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  async function readText(name) {
    const entry = findZipEntry(entries, name);
    return entry ? decodeUtf8(await readZipEntryBytes(bytes, view, entry, options)) : '';
  }

  async function readMatchingText(predicate) {
    const matches = entries.filter(entry => predicate(normaliseZipPath(entry.name)));
    const files = [];

    for (const entry of matches) {
      files.push({
        path: normaliseZipPath(entry.name),
        text: decodeUtf8(await readZipEntryBytes(bytes, view, entry, options))
      });
    }

    return files;
  }

  return {
    entries,
    warnings,
    readText,
    readMatchingText
  };
}

export function parseSolutionMetadata(solutionXml = '') {
  const uniqueName = readXmlText(solutionXml, 'UniqueName') || readXmlText(solutionXml, 'uniquename');
  const displayName = readFirstXmlAttribute(solutionXml, 'LocalizedName', 'description') || uniqueName || 'Power Platform solution';
  const version = readXmlText(solutionXml, 'Version') || readXmlText(solutionXml, 'version') || 'Unknown';
  const managed = readXmlText(solutionXml, 'Managed') || readXmlText(solutionXml, 'managed');
  const publisher = readXmlText(solutionXml, 'PublisherUniqueName') || readXmlText(solutionXml, 'publisheruniquename');

  return {
    name: displayName,
    uniqueName: uniqueName || displayName,
    version,
    packageType: normaliseManagedValue(managed),
    publisher: publisher || 'Unknown'
  };
}

export function parseWorkflowMetadata(customizationsXml = '') {
  if (!String(customizationsXml || '').trim()) {
    return [];
  }

  return extractXmlElementBlocks(customizationsXml, 'Workflow')
    .map((block, index) => {
      const attrs = parseXmlAttributes(block.attributes);
      const id = normaliseGuid(
        attrs.workflowid
        || attrs.workflowidunique
        || readXmlText(block.content, 'WorkflowId')
        || readXmlText(block.content, 'workflowid')
        || `workflow-${index + 1}`
      );
      const name = attrs.name
        || readXmlText(block.content, 'Name')
        || readXmlText(block.content, 'name')
        || readXmlText(block.content, 'DisplayName')
        || readXmlText(block.content, 'displayname')
        || `Workflow ${index + 1}`;
      const category = readCategoryValue(attrs.category || readXmlText(block.content, 'Category') || readXmlText(block.content, 'category'));
      const mapped = WORKFLOW_CATEGORY_TYPES[category] || { type: 'other-process', label: 'Other process' };
      const clientData = readXmlText(block.content, 'ClientData') || readXmlText(block.content, 'clientdata');
      const xaml = readXmlText(block.content, 'Xaml') || readXmlText(block.content, 'xaml') || readXmlText(block.content, 'XamlFileName');
      const primaryEntity = attrs.primaryentity
        || attrs.primaryentityname
        || readXmlText(block.content, 'PrimaryEntity')
        || readXmlText(block.content, 'primaryentity')
        || readXmlText(block.content, 'Entity')
        || '';

      return {
        id,
        name: decodeXmlEntities(name),
        type: mapped.type,
        typeLabel: mapped.label,
        category,
        sourcePath: 'customizations.xml',
        primaryEntity: decodeXmlEntities(primaryEntity),
        state: decodeXmlEntities(attrs.state || readXmlText(block.content, 'StateCode') || readXmlText(block.content, 'statecode') || ''),
        raw: {
          attributes: attrs,
          content: block.content,
          clientData: decodeXmlEntities(clientData),
          xaml: decodeXmlEntities(xaml)
        },
        warnings: []
      };
    })
    .filter(component => component.name || component.id);
}

export function parseWorkflowJsonFiles(files = []) {
  return files.map((file, index) => {
    const warnings = [];
    let json;

    try {
      json = JSON.parse(file.text);
    } catch (error) {
      return {
        id: normaliseGuid(file.path.replace(/^.*\/|\.json$/gi, '')) || `cloud-flow-${index + 1}`,
        name: file.path.split('/').pop()?.replace(/\.json$/i, '') || `Cloud flow ${index + 1}`,
        type: 'cloud-flow',
        typeLabel: 'Cloud flow',
        category: 5,
        sourcePath: file.path,
        primaryEntity: '',
        state: '',
        raw: { json: null, definition: null },
        warnings: [`${file.path} could not be parsed as JSON: ${error.message || 'Invalid JSON.'}`]
      };
    }

    const properties = isPlainObject(json.properties) ? json.properties : {};
    const definition = findCloudFlowDefinition(json);
    const name = properties.displayName
      || properties.name
      || json.displayName
      || json.name
      || file.path.split('/').pop()?.replace(/\.json$/i, '')
      || `Cloud flow ${index + 1}`;
    const id = normaliseGuid(properties.workflowEntityId || properties.workflowid || json.workflowEntityId || json.id || file.path.replace(/^.*\/|\.json$/gi, ''));

    if (!definition) {
      warnings.push('No cloud flow definition object was found; generated diagram uses available metadata only.');
    }

    return {
      id: id || `cloud-flow-${index + 1}`,
      name: decodeXmlEntities(name),
      type: 'cloud-flow',
      typeLabel: 'Cloud flow',
      category: 5,
      sourcePath: file.path,
      primaryEntity: '',
      state: String(properties.state || properties.status || json.state || ''),
      raw: {
        json,
        definition
      },
      warnings
    };
  });
}

export function mergeWorkflowComponents(metadataComponents = [], jsonComponents = []) {
  const merged = metadataComponents.map(component => ({ ...component, warnings: [...(component.warnings || [])] }));
  const usedJson = new Set();

  merged.forEach(component => {
    const matchIndex = jsonComponents.findIndex((jsonComponent, index) => !usedJson.has(index) && isSameWorkflowComponent(component, jsonComponent));

    if (matchIndex >= 0) {
      const jsonComponent = jsonComponents[matchIndex];
      usedJson.add(matchIndex);
      component.type = jsonComponent.type;
      component.typeLabel = jsonComponent.typeLabel;
      component.category = jsonComponent.category;
      component.sourcePath = `${component.sourcePath}; ${jsonComponent.sourcePath}`;
      component.state = component.state || jsonComponent.state;
      component.raw = {
        ...component.raw,
        json: jsonComponent.raw.json,
        definition: jsonComponent.raw.definition
      };
      component.warnings.push(...jsonComponent.warnings);
    }
  });

  jsonComponents.forEach((component, index) => {
    if (!usedJson.has(index)) {
      merged.push({ ...component, warnings: [...(component.warnings || [])] });
    }
  });

  return merged.sort((left, right) => (
    left.typeLabel.localeCompare(right.typeLabel, 'en-GB')
    || left.name.localeCompare(right.name, 'en-GB')
  ));
}

export function buildComponentDiagram(component) {
  const builders = {
    'cloud-flow': buildCloudFlowDiagram,
    'business-process-flow': buildBusinessProcessFlowDiagram,
    'business-rule': buildBusinessRuleDiagram,
    'classic-workflow': buildClassicWorkflowDiagram
  };
  const builder = builders[component.type] || buildMetadataDiagram;
  const diagram = builder(component);
  const analysis = analyseMermaidSource(diagram.mermaid);

  return {
    ...component,
    ...diagram,
    outputType: analysis.diagramType,
    lineCount: analysis.lineCount,
    outputBytes: analysis.outputBytes,
    outputSizeLabel: analysis.outputSizeLabel,
    downloadName: buildMermaidDownloadFileName(`${component.typeLabel}-${component.name}`, 'mmd'),
    warnings: [...(component.warnings || []), ...(diagram.warnings || [])]
  };
}

export function buildSolutionInventoryMarkdown({ solution, components, warnings = [] }) {
  const summary = buildSummary(components);
  const lines = [
    '# Power Platform solution Mermaid inventory',
    '',
    `Solution: ${solution.name}`,
    `Unique name: ${solution.uniqueName}`,
    `Version: ${solution.version}`,
    `Package type: ${solution.packageType}`,
    `Publisher: ${solution.publisher}`,
    '',
    '## Summary',
    '',
    '| Component type | Count |',
    '| --- | ---: |',
    ...summary.typeCounts.map(item => `| ${escapeMarkdownTableCell(item.label)} | ${item.count} |`)
  ];

  if (warnings.length > 0) {
    lines.push(
      '',
      '## Archive warnings',
      ...warnings.map(warning => `- ${warning}`)
    );
  }

  lines.push('', '## Components');

  components.forEach(component => {
    lines.push(
      '',
      `### ${component.name}`,
      '',
      `- Type: ${component.typeLabel}`,
      `- Source: ${component.sourcePath}`,
      `- Mermaid type: ${component.outputType}`,
      `- Steps: ${component.stepCount.toLocaleString('en-GB')}`,
      ...(component.primaryEntity ? [`- Primary table: ${component.primaryEntity}`] : []),
      ...(component.triggerSummary ? [`- Trigger: ${component.triggerSummary}`] : []),
      ...(component.warnings.length > 0 ? component.warnings.map(warning => `- Warning: ${warning}`) : []),
      '',
      '```mermaid',
      component.mermaid,
      '```'
    );
  });

  return lines.join('\n');
}

export function buildSolutionMermaidFileName(solutionName) {
  return buildMermaidDownloadFileName(`${solutionName || 'power-platform-solution'}-inventory`, 'md');
}

function buildCloudFlowDiagram(component) {
  const definition = component.raw?.definition;

  if (!definition || !isPlainObject(definition)) {
    return buildMetadataDiagram(component, 'Cloud flow metadata');
  }

  const context = createMermaidContext('flowchart TD');
  const rootId = context.node('flow', `Cloud flow: ${component.name}`, 'rounded');
  const triggers = objectEntries(definition.triggers);
  const actions = isPlainObject(definition.actions) ? definition.actions : {};
  const warnings = [];

  if (triggers.length === 0) {
    warnings.push('No trigger was found in the cloud flow definition.');
  }

  triggers.forEach(([key, trigger]) => {
    const triggerId = context.node(`trigger_${key}`, `Trigger: ${formatOperationLabel(key, trigger)}`, 'stadium');
    context.edge(rootId, triggerId);
  });

  const parentIds = triggers.length > 0
    ? triggers.map(([key]) => context.idFor(`trigger_${key}`)).filter(Boolean)
    : [rootId];
  const actionResult = emitCloudActions(context, actions, parentIds, 0, warnings);

  return {
    mermaid: context.toString(),
    stepCount: triggers.length + actionResult.count,
    triggerSummary: triggers.map(([key, trigger]) => formatOperationLabel(key, trigger)).join(', '),
    warnings: [
      ...warnings,
      ...(actionResult.truncated ? ['Some cloud flow actions were omitted to keep the diagram readable.'] : [])
    ]
  };
}

function emitCloudActions(context, actions, parentIds, depth, warnings) {
  const entries = objectEntries(actions);
  const nodeByName = new Map();
  let previousIds = parentIds;
  let count = 0;
  let truncated = false;

  for (const [key, action] of entries) {
    if (context.nodeCount >= MAX_ACTIONS_PER_COMPONENT) {
      truncated = true;
      break;
    }

    const actionId = context.node(`action_${key}`, formatOperationLabel(key, action), isControlAction(action) ? 'diamond' : 'box');
    nodeByName.set(key, actionId);
    count += 1;

    const runAfterIds = Object.keys(action?.runAfter || {})
      .map(name => context.idFor(`action_${name}`) || nodeByName.get(name))
      .filter(Boolean);
    const sources = runAfterIds.length > 0 ? runAfterIds : previousIds;

    sources.forEach(sourceId => context.edge(sourceId, actionId, runAfterIds.length > 1 ? 'after' : ''));

    const nestedGroups = getNestedActionGroups(action);
    nestedGroups.forEach(group => {
      const groupResult = emitCloudActions(context, group.actions, [actionId], depth + 1, warnings);
      count += groupResult.count;
      truncated = truncated || groupResult.truncated;

      if (groupResult.firstIds.length > 0 && group.label) {
        groupResult.firstIds.forEach(firstId => {
          context.relabelEdge(actionId, firstId, group.label);
        });
      }
    });

    previousIds = [actionId];
  }

  if (entries.length === 0 && depth === 0) {
    warnings.push('No actions were found in the cloud flow definition.');
  }

  return {
    count,
    truncated,
    firstIds: entries.length > 0 ? [context.idFor(`action_${entries[0][0]}`)].filter(Boolean) : []
  };
}

function buildBusinessProcessFlowDiagram(component) {
  const stages = extractStageNames(component);

  if (stages.length === 0) {
    return buildMetadataDiagram(component, 'Business process flow metadata');
  }

  const context = createMermaidContext('stateDiagram-v2');
  const limitedStages = stages.slice(0, MAX_ACTIONS_PER_COMPONENT);
  const ids = limitedStages.map((stage, index) => context.state(`stage_${index + 1}`, stage));

  if (ids.length > 0) {
    context.raw(`  [*] --> ${ids[0]}`);
  }

  for (let index = 1; index < ids.length; index += 1) {
    context.raw(`  ${ids[index - 1]} --> ${ids[index]}`);
  }

  if (ids.length > 0) {
    context.raw(`  ${ids.at(-1)} --> [*]`);
  }

  return {
    mermaid: context.toString(),
    stepCount: limitedStages.length,
    triggerSummary: '',
    warnings: stages.length > limitedStages.length ? ['Some BPF stages were omitted to keep the diagram readable.'] : []
  };
}

function buildBusinessRuleDiagram(component) {
  const rule = extractBusinessRuleShape(component);
  const context = createMermaidContext('flowchart TD');
  const rootId = context.node('rule', `Business rule: ${component.name}`, 'rounded');

  if (rule.conditions.length === 0 && rule.actions.length === 0) {
    return buildMetadataDiagram(component, 'Business rule metadata');
  }

  const conditionIds = rule.conditions.slice(0, 12).map((condition, index) => {
    const id = context.node(`condition_${index + 1}`, condition, 'diamond');
    context.edge(index === 0 ? rootId : context.idFor(`condition_${index}`), id);
    return id;
  });
  const sourceId = conditionIds.at(-1) || rootId;

  rule.actions.slice(0, 18).forEach((action, index) => {
    const id = context.node(`action_${index + 1}`, action, 'box');
    context.edge(index === 0 ? sourceId : context.idFor(`action_${index}`), id, index === 0 && conditionIds.length ? 'then' : '');
  });

  return {
    mermaid: context.toString(),
    stepCount: rule.conditions.length + rule.actions.length,
    triggerSummary: rule.conditions[0] || '',
    warnings: [
      ...(rule.conditions.length > 12 || rule.actions.length > 18 ? ['Some business rule nodes were omitted to keep the diagram readable.'] : [])
    ]
  };
}

function buildClassicWorkflowDiagram(component) {
  const steps = extractWorkflowStepNames(component);

  if (steps.length === 0) {
    return buildMetadataDiagram(component, 'Classic workflow metadata');
  }

  const context = createMermaidContext('flowchart TD');
  const rootId = context.node('workflow', `Workflow: ${component.name}`, 'rounded');
  let previousId = rootId;

  steps.slice(0, MAX_ACTIONS_PER_COMPONENT).forEach((step, index) => {
    const id = context.node(`step_${index + 1}`, step, 'box');
    context.edge(previousId, id);
    previousId = id;
  });

  return {
    mermaid: context.toString(),
    stepCount: steps.length,
    triggerSummary: steps[0] || '',
    warnings: steps.length > MAX_ACTIONS_PER_COMPONENT ? ['Some workflow steps were omitted to keep the diagram readable.'] : []
  };
}

function buildMetadataDiagram(component, rootLabel = 'Process metadata') {
  const context = createMermaidContext('flowchart TD');
  const rootId = context.node('component', `${rootLabel}: ${component.name}`, 'rounded');
  const detailRows = [
    ['type', `Type: ${component.typeLabel}`],
    ['source', `Source: ${component.sourcePath}`],
    ...(component.primaryEntity ? [['table', `Primary table: ${component.primaryEntity}`]] : []),
    ...(component.state ? [['state', `State: ${component.state}`]] : [])
  ];

  detailRows.forEach(([id, label]) => {
    const detailId = context.node(id, label, 'box');
    context.edge(rootId, detailId);
  });

  return {
    mermaid: context.toString(),
    stepCount: detailRows.length,
    triggerSummary: '',
    warnings: ['Detailed process logic was not found in the exported metadata, so a metadata diagram was generated.']
  };
}

async function normaliseArchiveBytes(input) {
  if (input instanceof Uint8Array) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  if (input?.arrayBuffer) {
    return new Uint8Array(await input.arrayBuffer());
  }

  throw new Error('Choose an exported solution ZIP file before analysing the solution.');
}

async function readSolutionTextFiles(zip) {
  const solutionXml = await zip.readText('solution.xml');
  const customizationsXml = await zip.readText('customizations.xml');
  const workflowJsonFiles = await zip.readMatchingText(path => /^workflows\/.+\.json$/i.test(path));
  const warnings = [];

  if (!solutionXml) {
    warnings.push('solution.xml was not found; solution metadata is limited.');
  }

  if (!customizationsXml) {
    warnings.push('customizations.xml was not found; workflow category metadata is limited.');
  }

  if (workflowJsonFiles.length === 0) {
    warnings.push('No Workflows/*.json cloud flow definitions were found.');
  }

  return {
    solutionXml,
    customizationsXml,
    workflowJsonFiles,
    warnings
  };
}

function findEndOfCentralDirectory(view) {
  const minimumOffset = Math.max(0, view.byteLength - 22 - 0xffff);

  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      return offset;
    }
  }

  return -1;
}

async function readZipEntryBytes(zipBytes, view, entry, options = {}) {
  if (entry.localHeaderOffset + 30 > zipBytes.byteLength || view.getUint32(entry.localHeaderOffset, true) !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`${entry.name} has an invalid local ZIP header.`);
  }

  const localNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const localExtraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const dataOffset = entry.localHeaderOffset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataOffset + entry.compressedSize;

  if (dataEnd > zipBytes.byteLength) {
    throw new Error(`${entry.name} is outside the archive bounds.`);
  }

  const compressedBytes = zipBytes.slice(dataOffset, dataEnd);

  if (entry.compressionMethod === ZIP_STORED) {
    return compressedBytes;
  }

  if (entry.compressionMethod === ZIP_DEFLATE) {
    return inflateRawBytes(compressedBytes, options);
  }

  throw new Error(`${entry.name} uses unsupported ZIP compression method ${entry.compressionMethod}.`);
}

async function inflateRawBytes(bytes, options = {}) {
  if (typeof options.inflateRaw === 'function') {
    const inflated = await options.inflateRaw(bytes);
    return inflated instanceof Uint8Array ? inflated : new Uint8Array(inflated);
  }

  if (typeof DecompressionStream === 'function') {
    for (const format of ['deflate-raw', 'deflate']) {
      try {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch {
        // Try the next browser-supported deflate label.
      }
    }
  }

  throw new Error('This browser cannot decompress deflated ZIP entries.');
}

function findZipEntry(entries, name) {
  const wanted = normaliseZipPath(name);
  return entries.find(entry => normaliseZipPath(entry.name).toLocaleLowerCase('en-GB') === wanted.toLocaleLowerCase('en-GB')) || null;
}

function normaliseZipPath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function decodeZipName(bytes, isUtf8) {
  if (isUtf8 || typeof TextDecoder !== 'undefined') {
    return decodeUtf8(bytes);
  }

  return Array.from(bytes).map(byte => String.fromCharCode(byte)).join('');
}

function decodeUtf8(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function normaliseManagedValue(value) {
  const text = String(value ?? '').trim().toLocaleLowerCase('en-GB');

  if (['1', 'true', 'yes', 'managed'].includes(text)) {
    return 'Managed';
  }

  if (['0', 'false', 'no', 'unmanaged'].includes(text)) {
    return 'Unmanaged';
  }

  return 'Unknown';
}

function readCategoryValue(value) {
  const match = String(value ?? '').match(/-?\d+/);
  return match ? Number(match[0]) : -1;
}

function extractXmlElementBlocks(xml, tagName) {
  const blocks = [];
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  let match = tagPattern.exec(xml);

  while (match) {
    const tag = match[0];

    if (tag.startsWith('</')) {
      match = tagPattern.exec(xml);
      continue;
    }

    if (/\/\s*>$/.test(tag)) {
      blocks.push({
        attributes: tag.replace(new RegExp(`^<${tagName}\\b`, 'i'), '').replace(/\/\s*>$/, ''),
        content: ''
      });
      match = tagPattern.exec(xml);
      continue;
    }

    const contentStart = match.index + tag.length;
    let depth = 1;
    let closingMatch = tagPattern.exec(xml);

    while (closingMatch) {
      const closingTag = closingMatch[0];

      if (closingTag.startsWith('</')) {
        depth -= 1;
      } else if (!/\/\s*>$/.test(closingTag)) {
        depth += 1;
      }

      if (depth === 0) {
        blocks.push({
          attributes: tag.replace(new RegExp(`^<${tagName}\\b`, 'i'), '').replace(/>$/, ''),
          content: xml.slice(contentStart, closingMatch.index)
        });
        break;
      }

      closingMatch = tagPattern.exec(xml);
    }

    match = tagPattern.exec(xml);
  }

  return blocks;
}

function parseXmlAttributes(value) {
  const attrs = {};
  const pattern = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match = pattern.exec(value || '');

  while (match) {
    attrs[match[1].toLocaleLowerCase('en-GB')] = decodeXmlEntities(match[2] ?? match[3] ?? '');
    match = pattern.exec(value || '');
  }

  return attrs;
}

function readXmlText(xml, tagName) {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, 'i');
  const match = pattern.exec(String(xml || ''));
  return match ? decodeXmlEntities(match[1].trim()) : '';
}

function readFirstXmlAttribute(xml, tagName, attributeName) {
  const tagPattern = new RegExp(`<${escapeRegExp(tagName)}\\b([^>]*)>`, 'i');
  const match = tagPattern.exec(String(xml || ''));

  if (!match) {
    return '';
  }

  return parseXmlAttributes(match[1])[attributeName.toLocaleLowerCase('en-GB')] || '';
}

function decodeXmlEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function normaliseGuid(value) {
  return String(value ?? '').trim().replace(/[{}]/g, '').toLocaleLowerCase('en-GB');
}

function isSameWorkflowComponent(left, right) {
  const leftId = normaliseGuid(left.id);
  const rightId = normaliseGuid(right.id);

  if (leftId && rightId && leftId === rightId) {
    return true;
  }

  return normaliseComponentKey(left.name) === normaliseComponentKey(right.name);
}

function normaliseComponentKey(value) {
  return String(value ?? '').trim().toLocaleLowerCase('en-GB').replace(/[^a-z0-9]+/g, '');
}

function findCloudFlowDefinition(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  if (isPlainObject(value.definition)) {
    return value.definition;
  }

  if (isPlainObject(value.properties?.definition)) {
    return value.properties.definition;
  }

  if (isPlainObject(value.properties?.definitionSummary?.definition)) {
    return value.properties.definitionSummary.definition;
  }

  return null;
}

function formatOperationLabel(key, operation = {}) {
  const name = String(operation?.metadata?.operationMetadataId || operation?.description || key || 'Step').replace(/_/g, ' ');
  const type = String(operation?.type || operation?.kind || '').replace(/_/g, ' ');
  const operationId = operation?.inputs?.host?.operationId || operation?.inputs?.method || '';
  const parts = [name];

  if (type) {
    parts.push(type);
  }

  if (operationId) {
    parts.push(operationId);
  }

  return parts.join(' - ');
}

function isControlAction(action) {
  return /^(if|switch|foreach|until|scope|query)$/i.test(String(action?.type || ''));
}

function getNestedActionGroups(action = {}) {
  const groups = [];

  if (isPlainObject(action.actions)) {
    groups.push({ label: branchLabelForAction(action, 'then'), actions: action.actions });
  }

  if (isPlainObject(action.else?.actions)) {
    groups.push({ label: 'else', actions: action.else.actions });
  }

  if (isPlainObject(action.default?.actions)) {
    groups.push({ label: 'default', actions: action.default.actions });
  }

  if (isPlainObject(action.cases)) {
    Object.entries(action.cases).forEach(([caseName, caseValue]) => {
      if (isPlainObject(caseValue?.actions)) {
        groups.push({ label: String(caseName).replace(/_/g, ' '), actions: caseValue.actions });
      }
    });
  }

  return groups;
}

function branchLabelForAction(action, fallback) {
  if (/^if$/i.test(String(action?.type || ''))) {
    return 'yes';
  }

  if (/^foreach$/i.test(String(action?.type || ''))) {
    return 'each';
  }

  return fallback;
}

function extractStageNames(component) {
  const text = [component.raw?.clientData, component.raw?.content, component.raw?.xaml].filter(Boolean).join('\n');
  const names = [
    ...matchAllGroup(text, /"stage(?:Name|name)"\s*:\s*"([^"]+)"/gi),
    ...matchAllGroup(text, /<Stage\b[^>]*(?:name|Name)="([^"]+)"/g),
    ...matchAllGroup(text, /<Step\b[^>]*(?:name|Name)="([^"]+)"/g),
    ...matchAllGroup(text, /(?:stage|step)\s*[:=]\s*([^,;\r\n<]+)/gi)
  ];

  return uniqueLabels(names).slice(0, MAX_ACTIONS_PER_COMPONENT);
}

function extractBusinessRuleShape(component) {
  const clientData = component.raw?.clientData || '';
  const json = parseMaybeJson(clientData);

  if (json) {
    return {
      conditions: collectLabelsFromKeys(json, ['conditions', 'condition', 'rules']).slice(0, 24),
      actions: collectLabelsFromKeys(json, ['actions', 'action', 'setValue', 'setVisibility', 'setRequiredLevel']).slice(0, 40)
    };
  }

  return {
    conditions: uniqueLabels(matchAllGroup(clientData, /(?:condition|if)\s*[:=]\s*([^;\r\n<]+)/gi)),
    actions: uniqueLabels(matchAllGroup(clientData, /(?:action|then|set)\s*[:=]\s*([^;\r\n<]+)/gi))
  };
}

function extractWorkflowStepNames(component) {
  const text = [component.raw?.clientData, component.raw?.content, component.raw?.xaml].filter(Boolean).join('\n');
  const json = parseMaybeJson(component.raw?.clientData);

  if (json) {
    return collectLabelsFromKeys(json, ['steps', 'actions', 'activities']).slice(0, MAX_ACTIONS_PER_COMPONENT);
  }

  return uniqueLabels([
    ...matchAllGroup(text, /<Step\b[^>]*(?:name|Name)="([^"]+)"/g),
    ...matchAllGroup(text, /<Activity\b[^>]*(?:name|Name)="([^"]+)"/g),
    ...matchAllGroup(text, /(?:step|activity)\s*[:=]\s*([^;\r\n<]+)/gi)
  ]).slice(0, MAX_ACTIONS_PER_COMPONENT);
}

function parseMaybeJson(value) {
  const text = String(value || '').trim();

  if (!text.startsWith('{') && !text.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function collectLabelsFromKeys(value, keys, labels = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectLabelsFromKeys(item, keys, labels));
    return labels;
  }

  if (!isPlainObject(value)) {
    return labels;
  }

  Object.entries(value).forEach(([key, child]) => {
    const lowerKey = key.toLocaleLowerCase('en-GB');

    if (keys.some(candidate => lowerKey.includes(candidate.toLocaleLowerCase('en-GB')))) {
      if (Array.isArray(child)) {
        child.forEach(item => labels.push(readObjectLabel(item, key)));
      } else if (isPlainObject(child)) {
        labels.push(readObjectLabel(child, key));
      } else {
        labels.push(String(child));
      }
    }

    collectLabelsFromKeys(child, keys, labels);
  });

  return uniqueLabels(labels);
}

function readObjectLabel(value, fallback) {
  if (!isPlainObject(value)) {
    return String(value ?? fallback);
  }

  return String(value.displayName || value.name || value.label || value.type || value.id || fallback);
}

function createMermaidContext(header) {
  const lines = [header];
  const ids = new Map();
  let nodeCount = 0;

  function getId(rawId) {
    const base = toMermaidId(rawId, `node_${nodeCount + 1}`);
    let id = base;
    let suffix = 2;

    while ([...ids.values()].includes(id)) {
      id = `${base}_${suffix}`;
      suffix += 1;
    }

    ids.set(String(rawId), id);
    return id;
  }

  return {
    get nodeCount() {
      return nodeCount;
    },
    idFor(rawId) {
      return ids.get(String(rawId)) || '';
    },
    node(rawId, label, shape = 'box') {
      const id = ids.get(String(rawId)) || getId(rawId);
      const safeLabel = escapeMermaidText(label);
      const declaration = shape === 'diamond'
        ? `  ${id}{"${safeLabel}"}`
        : shape === 'stadium'
          ? `  ${id}(["${safeLabel}"])`
          : shape === 'rounded'
            ? `  ${id}("${safeLabel}")`
            : `  ${id}["${safeLabel}"]`;

      if (!lines.includes(declaration)) {
        lines.push(declaration);
        nodeCount += 1;
      }

      return id;
    },
    state(rawId, label) {
      const id = ids.get(String(rawId)) || getId(rawId);
      lines.push(`  state "${escapeMermaidText(label)}" as ${id}`);
      nodeCount += 1;
      return id;
    },
    edge(from, to, label = '') {
      lines.push(label ? `  ${from} -->|"${escapeMermaidText(label)}"| ${to}` : `  ${from} --> ${to}`);
    },
    relabelEdge(from, to, label) {
      const plain = `  ${from} --> ${to}`;
      const index = lines.indexOf(plain);

      if (index >= 0) {
        lines[index] = `  ${from} -->|"${escapeMermaidText(label)}"| ${to}`;
      }
    },
    raw(line) {
      lines.push(line);
    },
    toString() {
      return uniqueLines(lines).join('\n');
    }
  };
}

function buildSummary(components) {
  const counts = new Map();

  components.forEach(component => {
    const key = component.typeLabel || 'Other process';
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return {
    componentCount: components.length,
    warningCount: components.reduce((total, component) => total + component.warnings.length, 0),
    typeCounts: [...counts.entries()].map(([label, count]) => ({ label, count }))
  };
}

function objectEntries(value) {
  return isPlainObject(value) ? Object.entries(value) : [];
}

function matchAllGroup(text, pattern) {
  return [...String(text || '').matchAll(pattern)]
    .map(match => decodeXmlEntities(match[1] || '').trim())
    .filter(Boolean);
}

function uniqueLabels(labels) {
  const seen = new Set();
  const output = [];

  labels.forEach(label => {
    const cleaned = String(label || '').replace(/\s+/g, ' ').trim();
    const key = cleaned.toLocaleLowerCase('en-GB');

    if (cleaned && !seen.has(key)) {
      seen.add(key);
      output.push(cleaned);
    }
  });

  return output;
}

function uniqueLines(lines) {
  return lines.filter((line, index) => lines.indexOf(line) === index);
}

function toMermaidId(value, fallback) {
  const text = String(value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLocaleLowerCase('en-GB');

  return /^[a-z_]/.test(text) ? text || fallback : `${fallback}_${text}`;
}

function escapeMermaidText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function escapeMarkdownTableCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
