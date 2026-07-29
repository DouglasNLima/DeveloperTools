import { decodeTextBytes } from './power-platform-package-editor.js';

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
  3: { type: 'action', label: 'Custom action' },
  4: { type: 'business-process-flow', label: 'Business process flow' },
  5: { type: 'cloud-flow', label: 'Cloud flow' }
};

export async function readPowerPlatformSolutionArchive(input, options = {}) {
  const bytes = await normaliseArchiveBytes(input);
  const zip = await readZipArchive(bytes, options);
  const textFiles = await readSolutionTextFiles(zip);
  const solution = parseSolutionMetadata(textFiles.solutionXml);
  const metadataComponents = mergeClassicWorkflowXamlFiles([
    ...parseWorkflowMetadata(textFiles.customizationsXml),
    ...parsePluginStepMetadata(textFiles.customizationsXml)
  ], textFiles.workflowXamlFiles);
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
      workflowJsonCount: textFiles.workflowJsonFiles.length,
      workflowXamlCount: textFiles.workflowXamlFiles.length
    },
    sourceFiles: textFiles,
    archiveBytes: bytes,
    zipArchive: zip
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

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const commentLength = view.getUint16(eocdOffset + 20, true);
  const eocdEnd = eocdOffset + 22 + commentLength;

  if (totalEntries === ZIP64_COUNT_SENTINEL || centralDirectorySize === ZIP64_SIZE_SENTINEL || centralDirectoryOffset === ZIP64_SIZE_SENTINEL) {
    throw new Error('ZIP64 solution archives are not supported in this browser-only reader.');
  }

  if (eocdEnd > bytes.byteLength) {
    throw new Error('The ZIP end record contains an invalid archive comment.');
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
    const centralRecordLength = 46 + fileNameLength + extraLength + commentLength;

    if (offset + centralRecordLength > centralDirectoryOffset + centralDirectorySize) {
      throw new Error('The ZIP central directory entry is outside the declared directory bounds.');
    }

    const fileNameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength);
    const name = decodeZipName(fileNameBytes, Boolean(flags & ZIP_UTF8_FLAG));

    if (flags & ZIP_ENCRYPTED_FLAG) {
      warnings.push(`${name} is encrypted and was skipped.`);
    }

    entries.push({
      name,
      flags,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      crc32: view.getUint32(offset + 16, true),
      localHeaderOffset,
      centralHeaderOffset: offset,
      centralRecordLength,
      centralRecord: bytes.slice(offset, offset + centralRecordLength),
      encrypted: Boolean(flags & ZIP_ENCRYPTED_FLAG),
      isDirectory: name.endsWith('/')
    });

    offset += centralRecordLength;
  }

  const localEntries = [...entries].sort((left, right) => left.localHeaderOffset - right.localHeaderOffset);

  localEntries.forEach((entry, index) => {
    const localRecordEnd = localEntries[index + 1]?.localHeaderOffset ?? centralDirectoryOffset;

    if (
      entry.localHeaderOffset < 0
      || entry.localHeaderOffset + 30 > centralDirectoryOffset
      || localRecordEnd < entry.localHeaderOffset
      || localRecordEnd > centralDirectoryOffset
      || view.getUint32(entry.localHeaderOffset, true) !== LOCAL_FILE_SIGNATURE
    ) {
      throw new Error(`${entry.name} has an invalid local ZIP record.`);
    }

    const localNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(entry.localHeaderOffset + 28, true);
    const localDataOffset = entry.localHeaderOffset + 30 + localNameLength + localExtraLength;

    if (localDataOffset + entry.compressedSize > localRecordEnd) {
      throw new Error(`${entry.name} is outside the archive bounds.`);
    }

    entry.localRecordEnd = localRecordEnd;
    entry.localRecord = bytes.slice(entry.localHeaderOffset, localRecordEnd);
    entry.localHeader = bytes.slice(entry.localHeaderOffset, localDataOffset);
    entry.compressedBytes = bytes.slice(localDataOffset, localDataOffset + entry.compressedSize);
  });

  async function readText(name) {
    const entry = findZipEntry(entries, name);
    return entry ? decodeTextBytes(await readZipEntryBytes(bytes, view, entry, options)) : '';
  }

  async function readMatchingText(predicate) {
    const matches = entries.filter(entry => (
      !entry.isDirectory
      && !entry.encrypted
      && predicate(normaliseZipPath(entry.name))
    ));
    const files = [];

    for (const entry of matches) {
      files.push({
        path: normaliseZipPath(entry.name),
        text: decodeTextBytes(await readZipEntryBytes(bytes, view, entry, options)),
        uncompressedSize: entry.uncompressedSize
      });
    }

    return files;
  }

  async function readBytes(name) {
    const entry = findZipEntry(entries, name);
    return entry ? readZipEntryBytes(bytes, view, entry, options) : null;
  }

  return {
    entries,
    warnings,
    readText,
    readMatchingText,
    readBytes,
    bytes,
    centralDirectoryOffset,
    centralDirectorySize,
    centralDirectoryTail: bytes.slice(offset, centralDirectoryOffset + centralDirectorySize),
    eocdOffset,
    eocdRecord: bytes.slice(eocdOffset, eocdEnd),
    trailingBytes: bytes.slice(eocdEnd),
    diskNumber,
    centralDirectoryDisk,
    entriesOnDisk,
    totalEntries,
    multiDisk: diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== totalEntries
  };
}

export function replaceZipArchiveEntries(zip, replacements = new Map()) {
  if (!zip?.bytes || !Array.isArray(zip.entries)) {
    throw new Error('Load a valid solution ZIP before rebuilding the package.');
  }

  if (zip.multiDisk) {
    throw new Error('Multi-disk ZIP archives cannot be rebuilt in this browser-only editor.');
  }

  const replacementMap = normaliseZipReplacementMap(replacements);

  if (replacementMap.size === 0) {
    throw new Error('Add at least one replacement before rebuilding the solution ZIP.');
  }

  const entriesByName = new Map();

  zip.entries.forEach(entry => {
    const key = normaliseZipPath(entry.name).toLocaleLowerCase('en-GB');
    const matches = entriesByName.get(key) || [];
    matches.push(entry);
    entriesByName.set(key, matches);
  });

  replacementMap.forEach((value, key) => {
    const matches = entriesByName.get(key) || [];

    if (matches.length === 0) {
      throw new Error(`${value.path} was not found in the original solution ZIP.`);
    }

    if (matches.length > 1) {
      throw new Error(`${value.path} appears more than once in the solution ZIP.`);
    }

    if (matches[0].isDirectory) {
      throw new Error(`${value.path} is a directory and cannot be replaced.`);
    }

    if (matches[0].encrypted) {
      throw new Error(`${value.path} is encrypted and cannot be replaced.`);
    }
  });

  const localChunks = [];
  const replacementDetails = new Map();
  const offsets = new Map();
  let localOffset = 0;

  [...zip.entries]
    .sort((left, right) => left.localHeaderOffset - right.localHeaderOffset)
    .forEach(entry => {
      const key = normaliseZipPath(entry.name).toLocaleLowerCase('en-GB');
      const replacement = replacementMap.get(key);
      const localRecord = replacement
        ? buildReplacementLocalRecord(entry, replacement.bytes)
        : entry.localRecord;

      offsets.set(entry, localOffset);
      localChunks.push(localRecord);
      localOffset += localRecord.byteLength;

      if (replacement) {
        replacementDetails.set(entry, {
          ...replacement,
          crc32: calculateCrc32(replacement.bytes),
          compressedSize: replacement.bytes.byteLength,
          uncompressedSize: replacement.bytes.byteLength,
          flags: entry.flags & ~0x0009,
          compressionMethod: ZIP_STORED
        });
      }
    });

  const centralChunks = zip.entries.map(entry => buildReplacementCentralRecord(
    entry,
    offsets.get(entry),
    replacementDetails.get(entry)
  ));
  centralChunks.push(zip.centralDirectoryTail || new Uint8Array());
  const centralDirectory = concatenateBytes(centralChunks);
  const localData = concatenateBytes(localChunks);
  const eocdRecord = new Uint8Array(zip.eocdRecord);
  const eocdView = new DataView(eocdRecord.buffer, eocdRecord.byteOffset, eocdRecord.byteLength);

  eocdView.setUint32(12, centralDirectory.byteLength, true);
  eocdView.setUint32(16, localData.byteLength, true);

  return concatenateBytes([
    localData,
    centralDirectory,
    eocdRecord,
    zip.trailingBytes || new Uint8Array()
  ]);
}

export function calculateCrc32(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
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
      const embeddedXaml = readXmlText(block.content, 'Xaml') || readXmlText(block.content, 'xaml');
      const xamlFileName = readXmlText(block.content, 'XamlFileName');
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
        triggers: {
          onCreate: readXmlBoolean(block.content, 'TriggerOnCreate'),
          onDelete: readXmlBoolean(block.content, 'TriggerOnDelete'),
          onDemand: readXmlBoolean(block.content, 'OnDemand'),
          onUpdateAttributes: parseXmlList(readXmlText(block.content, 'TriggerOnUpdateAttributeList')),
          mode: decodeXmlEntities(readXmlText(block.content, 'Mode')),
          scope: decodeXmlEntities(readXmlText(block.content, 'Scope'))
        },
        raw: {
          attributes: attrs,
          content: block.content,
          clientData: decodeXmlEntities(clientData),
          xaml: decodeXmlEntities(embeddedXaml),
          xamlFileName: decodeXmlEntities(xamlFileName)
        },
        warnings: []
      };
    })
    .filter(component => component.name || component.id);
}

export function mergeClassicWorkflowXamlFiles(components = [], files = []) {
  const fileMap = new Map(files.map(file => [
    normaliseZipPath(file.path).toLocaleLowerCase('en-GB'),
    file
  ]));

  return components.map(component => {
    const xamlFileName = component.raw?.xamlFileName;

    if (!xamlFileName) {
      return component;
    }

    const path = normaliseZipPath(xamlFileName);
    const file = fileMap.get(path.toLocaleLowerCase('en-GB'));

    if (!file) {
      return {
        ...component,
        warnings: [
          ...(component.warnings || []),
          `${path} is referenced by workflow metadata but was not found in the solution ZIP.`
        ]
      };
    }

    return {
      ...component,
      sourcePath: `${component.sourcePath}; ${file.path}`,
      raw: {
        ...component.raw,
        xaml: file.text,
        xamlFileName: file.path
      }
    };
  });
}

export function parsePluginStepMetadata(customizationsXml = '') {
  if (!String(customizationsXml || '').trim()) {
    return [];
  }

  return extractXmlElementBlocks(customizationsXml, 'SdkMessageProcessingStep')
    .map((block, index) => {
      const attrs = parseXmlAttributes(block.attributes);
      const content = block.content || '';
      const name = attrs.name
        || attrs.displayname
        || readFirstAvailableXmlText(content, ['Name', 'DisplayName'])
        || `Plug-in step ${index + 1}`;
      const message = normalisePluginMessage(
        attrs.message
        || attrs.messagename
        || attrs.sdkmessagename
        || attrs.sdkmessage
        || readFirstAvailableXmlText(content, ['MessageName', 'SdkMessageName', 'SdkMessage', 'Message'])
        || inferPluginMessage(`${name}\n${content}`)
      );
      const primaryEntity = attrs.primaryentity
        || attrs.primaryentityname
        || attrs.entity
        || attrs.entityname
        || readFirstAvailableXmlText(content, ['PrimaryEntity', 'PrimaryEntityName', 'Entity', 'EntityName'])
        || inferPluginEntity(`${name}\n${content}`);
      const filteringAttributes = parseAttributeList(
        attrs.filteringattributes
        || attrs.filteringattributeslist
        || readFirstAvailableXmlText(content, ['FilteringAttributes', 'FilteringAttributesList'])
      );

      return {
        id: normaliseGuid(
          attrs.sdkmessageprocessingstepid
          || attrs.stepid
          || attrs.id
          || readFirstAvailableXmlText(content, ['SdkMessageProcessingStepId', 'StepId', 'Id'])
          || `plugin-step-${index + 1}`
        ),
        name: decodeXmlEntities(name),
        type: 'plugin-step',
        typeLabel: 'Plug-in step',
        category: null,
        sourcePath: 'customizations.xml',
        primaryEntity: decodeXmlEntities(primaryEntity),
        state: decodeXmlEntities(attrs.state || readFirstAvailableXmlText(content, ['StateCode', 'statecode']) || ''),
        raw: {
          attributes: attrs,
          content,
          step: {
            message,
            filteringAttributes,
            stage: decodeXmlEntities(attrs.stage || readFirstAvailableXmlText(content, ['Stage']) || ''),
            mode: decodeXmlEntities(attrs.mode || readFirstAvailableXmlText(content, ['Mode']) || ''),
            rank: decodeXmlEntities(attrs.rank || readFirstAvailableXmlText(content, ['Rank']) || ''),
            handler: decodeXmlEntities(
              attrs.eventhandler
              || attrs.plugintype
              || attrs.plugintypename
              || readFirstAvailableXmlText(content, ['EventHandler', 'PluginType', 'PluginTypeName'])
              || ''
            )
          }
        },
        warnings: [
          ...(message ? [] : ['Plug-in step message was not found in the exported metadata.']),
          ...(primaryEntity ? [] : ['Plug-in step primary table was not found in the exported metadata.'])
        ]
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
  const workflowXamlFiles = await zip.readMatchingText(path => /^workflows\/.+\.xaml$/i.test(path));
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
    workflowXamlFiles,
    warnings
  };
}

function findEndOfCentralDirectory(view) {
  const minimumOffset = Math.max(0, view.byteLength - 22 - 0xffff);

  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (
      view.getUint32(offset, true) === EOCD_SIGNATURE
      && offset + 22 + view.getUint16(offset + 20, true) <= view.byteLength
    ) {
      return offset;
    }
  }

  return -1;
}

async function readZipEntryBytes(zipBytes, view, entry, options = {}) {
  if (entry.encrypted || entry.flags & ZIP_ENCRYPTED_FLAG) {
    throw new Error(`${entry.name} is encrypted and cannot be read.`);
  }

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
  return entries.find(entry => (
    !entry.isDirectory
    && normaliseZipPath(entry.name).toLocaleLowerCase('en-GB') === wanted.toLocaleLowerCase('en-GB')
  )) || null;
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

function normaliseZipReplacementMap(replacements) {
  const output = new Map();
  const values = replacements instanceof Map
    ? [...replacements.entries()]
    : Array.isArray(replacements)
      ? replacements.map(item => [item?.path, item?.bytes ?? item?.content])
      : Object.entries(replacements || {});

  values.forEach(([path, value]) => {
    const normalisedPath = normaliseZipPath(path);
    const bytes = value instanceof Uint8Array
      ? value
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new TextEncoder().encode(String(value ?? ''));

    if (!normalisedPath) {
      throw new Error('Every ZIP replacement requires a file path.');
    }

    const key = normalisedPath.toLocaleLowerCase('en-GB');

    if (output.has(key)) {
      throw new Error(`${normalisedPath} was supplied more than once as a ZIP replacement.`);
    }

    output.set(key, {
      path: normalisedPath,
      bytes
    });
  });

  return output;
}

function buildReplacementLocalRecord(entry, replacementBytes) {
  if (replacementBytes.byteLength > ZIP64_SIZE_SENTINEL - 1) {
    throw new Error(`${entry.name} is too large for a non-ZIP64 solution archive.`);
  }

  const header = new Uint8Array(entry.localHeader);
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const flags = entry.flags & ~0x0009;
  const crc = calculateCrc32(replacementBytes);

  view.setUint16(6, flags, true);
  view.setUint16(8, ZIP_STORED, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, replacementBytes.byteLength, true);
  view.setUint32(22, replacementBytes.byteLength, true);

  return concatenateBytes([header, replacementBytes]);
}

function buildReplacementCentralRecord(entry, localHeaderOffset, replacement) {
  if (!Number.isInteger(localHeaderOffset) || localHeaderOffset < 0 || localHeaderOffset >= ZIP64_SIZE_SENTINEL) {
    throw new Error('The rebuilt ZIP requires ZIP64 offsets, which are not supported.');
  }

  const record = new Uint8Array(entry.centralRecord);
  const view = new DataView(record.buffer, record.byteOffset, record.byteLength);

  if (replacement) {
    view.setUint16(8, replacement.flags, true);
    view.setUint16(10, replacement.compressionMethod, true);
    view.setUint32(16, replacement.crc32, true);
    view.setUint32(20, replacement.compressedSize, true);
    view.setUint32(24, replacement.uncompressedSize, true);
  }

  view.setUint32(42, localHeaderOffset, true);
  return record;
}

function concatenateBytes(chunks) {
  const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);

  if (byteLength >= ZIP64_SIZE_SENTINEL) {
    throw new Error('The rebuilt solution ZIP would require ZIP64 support.');
  }

  const output = new Uint8Array(byteLength);
  let offset = 0;

  chunks.forEach(chunk => {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return output;
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

function readXmlBoolean(xml, tagName) {
  const value = readXmlText(xml, tagName).trim().toLocaleLowerCase('en-GB');
  return value === '1' || value === 'true' || value === 'yes';
}

function parseXmlList(value) {
  return String(value || '')
    .split(/[,\s;|]+/)
    .map(item => item.trim())
    .filter(Boolean);
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

function readFirstAvailableXmlText(xml, tagNames) {
  for (const tagName of tagNames) {
    const value = readXmlText(xml, tagName);

    if (value) {
      return value;
    }
  }

  return '';
}

function normalisePluginMessage(value) {
  const text = String(value ?? '').trim();
  const lower = text.toLocaleLowerCase('en-GB');

  if (/(^|[^a-z])create(d|s)?([^a-z]|$)/.test(lower) || lower.includes('add')) {
    return 'Create';
  }

  if (/(^|[^a-z])update(d|s)?([^a-z]|$)/.test(lower) || lower.includes('modify')) {
    return 'Update';
  }

  if (/(^|[^a-z])delete(d|s)?([^a-z]|$)/.test(lower) || lower.includes('remove')) {
    return 'Delete';
  }

  if (/(^|[^a-z])assign(ed|s)?([^a-z]|$)/.test(lower)) {
    return 'Assign';
  }

  return decodeXmlEntities(text);
}

function inferPluginMessage(value) {
  return normalisePluginMessage(value);
}

function inferPluginEntity(value) {
  const text = String(value ?? '');
  const match = text.match(/\b(?:primaryentity|entity|table)\s*[:=]\s*["']?([A-Za-z_][\w.]*)/i)
    || text.match(/\b(?:create|update|delete|assign)\s+(?:of\s+|on\s+)?([A-Za-z_][\w.]*)\b/i);

  return match ? match[1] : '';
}

function parseAttributeList(value) {
  return uniqueLabels(
    String(value ?? '')
      .split(/[,\s;|]+/)
      .map(item => item.trim())
      .filter(Boolean)
  );
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
