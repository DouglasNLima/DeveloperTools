const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP64_SIZE_SENTINEL = 0xffffffff;
const ZIP64_COUNT_SENTINEL = 0xffff;
const ZIP_ENCRYPTED_FLAG = 0x0001;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORED = 0;
const ZIP_DEFLATE = 8;

export const MAX_SOLUTION_COMPONENTS = 120;

export const WORKFLOW_CATEGORY_TYPES = {
  0: { type: 'classic-workflow', label: 'Classic workflow' },
  1: { type: 'dialog', label: 'Dialog' },
  2: { type: 'business-rule', label: 'Business rule' },
  3: { type: 'action', label: 'Action' },
  4: { type: 'business-process-flow', label: 'Business process flow' },
  5: { type: 'cloud-flow', label: 'Cloud flow' }
};

export async function readPowerPlatformSolutionArchive(input, options = {}) {
  const bytes = await normaliseArchiveBytes(input);
  const zip = await readZipArchive(bytes, options);
  const textFiles = await readSolutionTextFiles(zip);
  const solution = parseSolutionMetadata(textFiles.solutionXml);
  const metadataComponents = parseWorkflowMetadata(textFiles.customizationsXml);
  const jsonFlowComponents = parseWorkflowJsonFiles(textFiles.workflowJsonFiles);
  const components = mergeWorkflowComponents(metadataComponents, jsonFlowComponents);
  const environmentVariables = parseEnvironmentVariables(textFiles.customizationsXml);
  const connectionReferences = parseConnectionReferences(textFiles.customizationsXml);
  const warnings = [
    ...zip.warnings,
    ...textFiles.warnings
  ];

  return {
    solution,
    components,
    environmentVariables,
    connectionReferences,
    warnings,
    summary: buildSolutionSummary({
      components,
      environmentVariables,
      connectionReferences,
      warnings
    }),
    zip: {
      entryCount: zip.entries.length,
      workflowJsonCount: textFiles.workflowJsonFiles.length
    },
    sourceFiles: textFiles
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
        text: decodeUtf8(await readZipEntryBytes(bytes, view, entry, options)),
        uncompressedSize: entry.uncompressedSize
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

export function parseEnvironmentVariables(customizationsXml = '') {
  const definitionBlocks = extractXmlElementBlocks(customizationsXml, 'EnvironmentVariableDefinition');
  const valueBlocks = extractXmlElementBlocks(customizationsXml, 'EnvironmentVariableValue');
  const valuesByName = new Map();

  valueBlocks.forEach((block, index) => {
    const attrs = parseXmlAttributes(block.attributes);
    const schemaName = attrs.schemaname
      || attrs.environmentvariablename
      || attrs.environmentvariabledefinitionid
      || readXmlText(block.content, 'SchemaName')
      || readXmlText(block.content, 'EnvironmentVariableName')
      || readXmlText(block.content, 'EnvironmentVariableDefinitionId')
      || `environment-variable-value-${index + 1}`;
    const value = attrs.value || readXmlText(block.content, 'Value') || readXmlText(block.content, 'value');
    valuesByName.set(normaliseComponentKey(schemaName), decodeXmlEntities(value));
  });

  return definitionBlocks
    .map((block, index) => {
      const attrs = parseXmlAttributes(block.attributes);
      const schemaName = attrs.schemaname
        || attrs.name
        || attrs.logicalname
        || readXmlText(block.content, 'SchemaName')
        || readXmlText(block.content, 'Name')
        || readXmlText(block.content, 'LogicalName')
        || `environment-variable-${index + 1}`;
      const displayName = attrs.displayname
        || readXmlText(block.content, 'DisplayName')
        || readFirstXmlAttribute(block.content, 'displayname', 'default')
        || schemaName;
      const type = attrs.type || readXmlText(block.content, 'Type') || readXmlText(block.content, 'type') || 'Unknown';
      const defaultValue = attrs.defaultvalue || readXmlText(block.content, 'DefaultValue') || readXmlText(block.content, 'defaultvalue') || '';
      const currentValue = attrs.value
        || readXmlText(block.content, 'Value')
        || readXmlText(block.content, 'value')
        || valuesByName.get(normaliseComponentKey(schemaName))
        || '';

      return {
        id: normaliseGuid(attrs.environmentvariabledefinitionid || attrs.id || schemaName),
        schemaName: decodeXmlEntities(schemaName),
        displayName: decodeXmlEntities(displayName),
        type: normaliseEnvironmentVariableType(type),
        defaultValue: decodeXmlEntities(defaultValue),
        currentValue: decodeXmlEntities(currentValue),
        sourcePath: 'customizations.xml'
      };
    })
    .filter(item => item.schemaName || item.displayName)
    .sort((left, right) => left.schemaName.localeCompare(right.schemaName, 'en-GB'));
}

export function parseConnectionReferences(customizationsXml = '') {
  return extractXmlElementBlocks(customizationsXml, 'ConnectionReference')
    .map((block, index) => {
      const attrs = parseXmlAttributes(block.attributes);
      const logicalName = attrs.connectionreferencelogicalname
        || attrs.logicalname
        || attrs.name
        || readXmlText(block.content, 'ConnectionReferenceLogicalName')
        || readXmlText(block.content, 'LogicalName')
        || readXmlText(block.content, 'Name')
        || `connection-reference-${index + 1}`;
      const displayName = attrs.displayname
        || readXmlText(block.content, 'DisplayName')
        || readFirstXmlAttribute(block.content, 'displayname', 'default')
        || logicalName;
      const connectorId = attrs.connectorid
        || attrs.connector
        || readXmlText(block.content, 'ConnectorId')
        || readXmlText(block.content, 'Connector')
        || '';

      return {
        id: normaliseGuid(attrs.connectionreferenceid || attrs.id || logicalName),
        logicalName: decodeXmlEntities(logicalName),
        displayName: decodeXmlEntities(displayName),
        connectorId: decodeXmlEntities(connectorId),
        connectorName: formatConnectorName(connectorId),
        sourcePath: 'customizations.xml'
      };
    })
    .filter(item => item.logicalName || item.displayName || item.connectorId)
    .sort((left, right) => left.logicalName.localeCompare(right.logicalName, 'en-GB'));
}

export function buildSolutionSummary({ components = [], environmentVariables = [], connectionReferences = [], warnings = [] } = {}) {
  const typeCounts = countBy(components, component => component.typeLabel || 'Other process');

  return {
    componentCount: components.length,
    environmentVariableCount: environmentVariables.length,
    connectionReferenceCount: connectionReferences.length,
    warningCount: warnings.length + components.reduce((total, component) => total + (component.warnings?.length || 0), 0),
    typeCounts
  };
}

export function formatSolutionFileName(name, suffix, extension) {
  const base = `${name || 'power-platform-solution'}-${suffix || 'documentation'}`
    .trim()
    .replace(/[^A-Za-z0-9._ -]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'power-platform-solution';

  return `${base}.${extension || 'md'}`;
}

export function getCloudFlowDefinitionMetrics(definition) {
  const triggers = objectEntries(definition?.triggers);
  const actions = isPlainObject(definition?.actions) ? definition.actions : {};

  return {
    triggerCount: triggers.length,
    actionCount: countWorkflowActions(actions),
    triggerSummary: triggers.map(([key, trigger]) => formatOperationLabel(key, trigger)).join(', ')
  };
}

export function findCloudFlowDefinition(value) {
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

export function formatOperationLabel(key, operation = {}) {
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

export function objectEntries(value) {
  return isPlainObject(value) ? Object.entries(value) : [];
}

export function matchAllGroup(text, pattern) {
  return [...String(text || '').matchAll(pattern)]
    .map(match => decodeXmlEntities(match[1] || '').trim())
    .filter(Boolean);
}

export function uniqueLabels(labels) {
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

export function parseMaybeJson(value) {
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

export function collectLabelsFromKeys(value, keys, labels = []) {
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

export function decodeXmlEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function escapeMarkdownTableCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function normaliseEnvironmentVariableType(value) {
  const text = String(value ?? '').trim();
  const knownTypes = {
    '100000000': 'String',
    '100000001': 'Number',
    '100000002': 'Boolean',
    '100000003': 'JSON',
    '100000004': 'Data source',
    string: 'String',
    number: 'Number',
    boolean: 'Boolean',
    json: 'JSON',
    datasource: 'Data source',
    'data source': 'Data source'
  };
  const key = text.toLocaleLowerCase('en-GB').replace(/[_-]+/g, ' ');

  return knownTypes[key] || knownTypes[text] || text || 'Unknown';
}

function formatConnectorName(connectorId) {
  const text = String(connectorId || '').trim();
  const match = text.match(/\/apis\/([^/]+)$/i) || text.match(/shared_[A-Za-z0-9_]+/);

  if (!match) {
    return text || 'Unknown';
  }

  return String(match[1] || match[0]).replace(/^shared_/i, '').replace(/_/g, ' ');
}

function countWorkflowActions(actions) {
  if (!isPlainObject(actions)) {
    return 0;
  }

  return Object.values(actions).reduce((total, action) => {
    const nested = [
      action?.actions,
      action?.else?.actions,
      action?.default?.actions,
      ...Object.values(action?.cases || {}).map(value => value?.actions)
    ];

    return total + 1 + nested.reduce((nestedTotal, group) => nestedTotal + countWorkflowActions(group), 0);
  }, 0);
}

function countBy(items, readKey) {
  const counts = new Map();

  items.forEach(item => {
    const key = readKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

function readObjectLabel(value, fallback) {
  if (!isPlainObject(value)) {
    return String(value ?? fallback);
  }

  return String(value.displayName || value.name || value.label || value.type || value.id || fallback);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
