import { buildJsonDiff } from './json-diff.js';
import {
  buildUpdatedPackageFileName,
  bytesEqual,
  compareSolutionVersions,
  encodeTextLikeOriginal,
  findDuplicateEntryPaths,
  incrementSolutionRevision,
  isValidSolutionVersion,
  normaliseZipPath as normalisePath,
  updateSolutionVersionXml
} from './power-platform-package-editor.js';
import {
  findCloudFlowDefinition,
  getCloudFlowDefinitionMetrics,
  isPlainObject,
  parseSolutionMetadata,
  parseWorkflowJsonFiles,
  readPowerPlatformSolutionArchive,
  readZipArchive,
  replaceZipArchiveEntries
} from './power-platform-solution.js';
import { buildComponentDiagram } from './power-platform-solution-mermaid.js';

export {
  buildUpdatedPackageFileName,
  compareSolutionVersions,
  incrementSolutionRevision,
  isValidSolutionVersion,
  updateSolutionVersionXml
} from './power-platform-package-editor.js';

const FLOW_IDENTITY_PATHS = [
  { path: ['properties', 'workflowEntityId'], type: 'id', label: 'properties.workflowEntityId' },
  { path: ['properties', 'workflowid'], type: 'id', label: 'properties.workflowid' },
  { path: ['workflowEntityId'], type: 'id', label: 'workflowEntityId' },
  { path: ['workflowid'], type: 'id', label: 'workflowid' },
  { path: ['id'], type: 'id', label: 'id' },
  { path: ['properties', 'displayName'], type: 'name', label: 'properties.displayName' },
  { path: ['properties', 'name'], type: 'name', label: 'properties.name' },
  { path: ['displayName'], type: 'name', label: 'displayName' },
  { path: ['name'], type: 'name', label: 'name' }
];
const EDITABLE_PATH_PREFIXES = [
  '$.definition',
  '$.properties.definition',
  '$.properties.definitionSummary.definition',
  '$.connectionReferences',
  '$.properties.connectionReferences'
];

export async function inspectFlowPackage(input, options = {}) {
  const archive = await readPowerPlatformSolutionArchive(input, options);
  const duplicatePaths = findDuplicateEntryPaths(archive.zipArchive.entries);
  const workflowFiles = archive.sourceFiles.workflowJsonFiles;
  const flows = await Promise.all(workflowFiles.map(async file => {
    const parsed = parseWorkflowJsonFiles([file])[0];
    const merged = findMergedFlowComponent(archive.components, file.path, parsed);
    const originalBytes = await archive.zipArchive.readBytes(file.path);
    const component = {
      ...(merged || parsed),
      sourcePath: file.path,
      raw: {
        ...(merged?.raw || parsed.raw),
        json: parsed.raw.json,
        definition: parsed.raw.definition
      },
      warnings: [...new Set([...(merged?.warnings || []), ...(parsed.warnings || [])])]
    };

    return {
      id: component.id,
      name: component.name,
      path: file.path,
      originalText: file.text,
      originalBytes: originalBytes || new TextEncoder().encode(file.text),
      originalJson: component.raw.json,
      definition: component.raw.definition,
      metrics: getCloudFlowDefinitionMetrics(component.raw.definition),
      component,
      editable: Boolean(component.raw.json && component.raw.definition),
      warnings: component.warnings
    };
  }));
  const packagingErrors = buildPackagingErrors(archive, flows, duplicatePaths);
  const suggestedVersion = isValidSolutionVersion(archive.solution.version)
    ? incrementSolutionRevision(archive.solution.version)
    : '';

  return {
    ...archive,
    flows: flows.sort((left, right) => (
      left.name.localeCompare(right.name, 'en-GB')
      || left.path.localeCompare(right.path, 'en-GB')
    )),
    duplicatePaths,
    readOnly: archive.solution.packageType !== 'Unmanaged',
    readOnlyReason: archive.solution.packageType === 'Managed'
      ? 'Managed solutions can be inspected here, but only unmanaged solutions can be rebuilt.'
      : archive.solution.packageType === 'Unmanaged'
        ? ''
        : 'The package type could not be confirmed as unmanaged.',
    packagingErrors,
    suggestedVersion
  };
}

export function validateFlowReplacement(originalFlow, updatedText) {
  const errors = [];
  const warnings = [];
  const text = String(updatedText ?? '');
  let updatedJson = null;
  let definition = null;
  let diff = null;
  let metadataChanges = [];

  if (!text.trim()) {
    errors.push('Enter the complete updated flow JSON.');
    return buildValidationResult();
  }

  try {
    updatedJson = JSON.parse(text);
  } catch (error) {
    errors.push(`Updated flow JSON is invalid: ${error.message || 'Unable to parse JSON.'}`);
    return buildValidationResult();
  }

  if (!isPlainObject(updatedJson)) {
    errors.push('Updated flow JSON must be a top-level object.');
    return buildValidationResult();
  }

  definition = findCloudFlowDefinition(updatedJson);

  if (!definition) {
    errors.push('Updated flow JSON must include a recognised cloud flow definition object.');
  }

  if (!isPlainObject(originalFlow?.originalJson)) {
    errors.push('The original exported flow JSON is invalid and cannot be replaced safely.');
  } else {
    errors.push(...compareFlowIdentity(originalFlow.originalJson, updatedJson));

    try {
      diff = buildJsonDiff(
        JSON.stringify(originalFlow.originalJson),
        JSON.stringify(updatedJson),
        { sortKeys: true, outputFormat: 'json' }
      );
    } catch (error) {
      errors.push(error.message || 'The flow JSON could not be compared.');
    }
  }

  if (diff?.equal) {
    errors.push('The updated JSON has no structural changes to stage.');
  }

  metadataChanges = (diff?.changes || []).filter(change => (
    !EDITABLE_PATH_PREFIXES.some(prefix => (
      change.path === prefix || change.path.startsWith(`${prefix}.`) || change.path.startsWith(`${prefix}[`)
    ))
  ));

  if (metadataChanges.length > 0) {
    warnings.push(
      `${metadataChanges.length.toLocaleString('en-GB')} change${metadataChanges.length === 1 ? '' : 's'} affect exported metadata outside the flow definition or connection references.`
    );
  }

  return buildValidationResult();

  function buildValidationResult() {
    const originalMetrics = originalFlow?.metrics || getCloudFlowDefinitionMetrics(originalFlow?.definition);
    const updatedMetrics = getCloudFlowDefinitionMetrics(definition);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      updatedText: text,
      updatedJson,
      definition,
      diff,
      originalMetrics,
      updatedMetrics,
      metadataChanges,
      diagram: errors.length === 0
        ? buildFlowDiagram(originalFlow, updatedJson)
        : null
    };
  }
}

export function buildFlowDiagram(flow, json = flow?.originalJson) {
  const definition = findCloudFlowDefinition(json);

  if (!flow?.component || !definition) {
    return null;
  }

  return buildComponentDiagram({
    ...flow.component,
    sourcePath: flow.path,
    raw: {
      ...(flow.component.raw || {}),
      json,
      definition
    },
    warnings: [...(flow.component.warnings || [])]
  });
}

export async function buildUpdatedFlowPackage({
  archive,
  replacements,
  targetVersion
}, options = {}) {
  if (!archive?.zipArchive || !Array.isArray(archive.flows)) {
    throw new Error('Inspect an exported solution ZIP before building an updated package.');
  }

  if (archive.solution.packageType !== 'Unmanaged') {
    throw new Error('Only unmanaged solutions can be rebuilt by the Flow editor.');
  }

  if (archive.packagingErrors.length > 0) {
    throw new Error(archive.packagingErrors[0]);
  }

  if (!isValidSolutionVersion(targetVersion)) {
    throw new Error('Target version must use the major.minor.build.revision format.');
  }

  if (compareSolutionVersions(archive.solution.version, targetVersion) >= 0) {
    throw new Error('Target version must be higher than the exported solution version.');
  }

  const replacementItems = normaliseFlowReplacements(replacements);

  if (replacementItems.length === 0) {
    throw new Error('Stage at least one valid flow update before generating the solution ZIP.');
  }

  const zipReplacements = new Map();
  const validatedReplacements = [];

  replacementItems.forEach(item => {
    const flow = archive.flows.find(candidate => (
      candidate.path.toLocaleLowerCase('en-GB') === item.path.toLocaleLowerCase('en-GB')
    ));

    if (!flow) {
      throw new Error(`${item.path} is not a flow in the inspected solution.`);
    }

    const validation = validateFlowReplacement(flow, item.updatedText);

    if (!validation.valid) {
      throw new Error(`${flow.name}: ${validation.errors[0]}`);
    }

    const bytes = encodeTextLikeOriginal(validation.updatedText, flow.originalBytes);
    zipReplacements.set(flow.path, bytes);
    validatedReplacements.push({
      flow,
      validation,
      bytes
    });
  });

  const solutionXml = updateSolutionVersionXml(
    archive.sourceFiles.solutionXml,
    targetVersion
  );
  const originalSolutionBytes = await archive.zipArchive.readBytes('solution.xml');

  if (!originalSolutionBytes) {
    throw new Error('solution.xml was not found and the package version cannot be updated.');
  }

  const solutionBytes = encodeTextLikeOriginal(solutionXml, originalSolutionBytes);
  zipReplacements.set('solution.xml', solutionBytes);
  const bytes = replaceZipArchiveEntries(archive.zipArchive, zipReplacements);
  const verification = await verifyUpdatedPackage({
    originalArchive: archive,
    outputBytes: bytes,
    replacements: validatedReplacements,
    solutionBytes,
    targetVersion,
    options
  });
  const fileName = buildUpdatedPackageFileName(archive.solution.uniqueName, targetVersion);

  return {
    bytes,
    fileName,
    sourceVersion: archive.solution.version,
    targetVersion,
    replacements: validatedReplacements,
    verification,
    summary: {
      replacementCount: validatedReplacements.length,
      entryCount: archive.zipArchive.entries.length,
      unchangedEntryCount: archive.zipArchive.entries.length - validatedReplacements.length - 1
    }
  };
}

async function verifyUpdatedPackage({
  originalArchive,
  outputBytes,
  replacements,
  solutionBytes,
  targetVersion,
  options
}) {
  const outputZip = await readZipArchive(outputBytes, options);
  const originalEntries = originalArchive.zipArchive.entries;
  const outputEntries = outputZip.entries;
  const replacedPaths = new Set([
    'solution.xml',
    ...replacements.map(item => item.flow.path)
  ].map(path => normalisePath(path).toLocaleLowerCase('en-GB')));
  const errors = [];

  if (originalEntries.length !== outputEntries.length) {
    errors.push('The rebuilt ZIP does not contain the same number of entries as the original.');
  }

  originalEntries.forEach((entry, index) => {
    const outputEntry = outputEntries[index];

    if (!outputEntry || entry.name !== outputEntry.name) {
      errors.push(`ZIP entry order changed at ${entry.name}.`);
      return;
    }

    const key = normalisePath(entry.name).toLocaleLowerCase('en-GB');

    if (!replacedPaths.has(key) && !bytesEqual(entry.localRecord, outputEntry.localRecord)) {
      errors.push(`${entry.name} changed even though it was not selected for replacement.`);
    }
  });

  const actualSolutionBytes = await outputZip.readBytes('solution.xml');

  if (!bytesEqual(solutionBytes, actualSolutionBytes)) {
    errors.push('The rebuilt solution.xml does not match the requested version update.');
  }

  const actualVersion = parseSolutionMetadata(await outputZip.readText('solution.xml')).version;

  if (actualVersion !== targetVersion) {
    errors.push(`The rebuilt solution version is ${actualVersion}, not ${targetVersion}.`);
  }

  for (const replacement of replacements) {
    const actualBytes = await outputZip.readBytes(replacement.flow.path);

    if (!bytesEqual(replacement.bytes, actualBytes)) {
      errors.push(`${replacement.flow.path} does not match the approved updated JSON.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`The rebuilt solution ZIP failed verification: ${errors[0]}`);
  }

  return {
    valid: true,
    entryCount: outputEntries.length,
    unchangedEntriesVerified: outputEntries.length - replacedPaths.size,
    replacedEntriesVerified: replacedPaths.size
  };
}

function buildPackagingErrors(archive, flows, duplicatePaths) {
  const errors = [];

  if (!archive.sourceFiles.solutionXml) {
    errors.push('solution.xml is required before the package can be rebuilt.');
  }

  if (archive.zipArchive.multiDisk) {
    errors.push('Multi-disk ZIP archives cannot be rebuilt in this browser-only editor.');
  }

  if (!isValidSolutionVersion(archive.solution.version)) {
    errors.push('The exported solution version is not a valid major.minor.build.revision value.');
  }

  const duplicateTargets = duplicatePaths.filter(path => (
    path === 'solution.xml' || /^workflows\/.+\.json$/i.test(path)
  ));

  if (duplicateTargets.length > 0) {
    errors.push(`${duplicateTargets[0]} appears more than once in the solution ZIP.`);
  }

  flows.forEach(flow => {
    const entry = archive.zipArchive.entries.find(candidate => (
      normalisePath(candidate.name).toLocaleLowerCase('en-GB')
      === normalisePath(flow.path).toLocaleLowerCase('en-GB')
    ));

    if (entry?.encrypted) {
      errors.push(`${flow.path} is encrypted and cannot be replaced.`);
    }
  });

  return errors;
}

function findMergedFlowComponent(components, path, parsed) {
  const normalisedPath = normalisePath(path).toLocaleLowerCase('en-GB');

  return components.find(component => (
    component.type === 'cloud-flow'
    && String(component.sourcePath || '')
      .split(';')
      .map(item => normalisePath(item.trim()).toLocaleLowerCase('en-GB'))
      .includes(normalisedPath)
  )) || components.find(component => (
    component.type === 'cloud-flow'
    && normaliseGuid(component.id)
    && normaliseGuid(component.id) === normaliseGuid(parsed.id)
  ));
}

function compareFlowIdentity(original, updated) {
  const errors = [];

  FLOW_IDENTITY_PATHS.forEach(identity => {
    const originalValue = readObjectPath(original, identity.path);
    const updatedValue = readObjectPath(updated, identity.path);
    const normalise = identity.type === 'id' ? normaliseGuid : value => String(value ?? '');

    if (
      originalValue.present !== updatedValue.present
      || (originalValue.present && normalise(originalValue.value) !== normalise(updatedValue.value))
    ) {
      errors.push(`Flow identity field ${identity.label} must remain unchanged.`);
    }
  });

  return errors;
}

function readObjectPath(value, path) {
  let current = value;

  for (const segment of path) {
    if (!isPlainObject(current) || !Object.hasOwn(current, segment)) {
      return { present: false, value: undefined };
    }

    current = current[segment];
  }

  return { present: true, value: current };
}

function normaliseFlowReplacements(replacements) {
  const values = replacements instanceof Map
    ? [...replacements.entries()].map(([path, value]) => ({
        path,
        updatedText: value?.updatedText ?? value?.validation?.updatedText ?? value
      }))
    : Array.isArray(replacements)
      ? replacements
      : Object.entries(replacements || {}).map(([path, value]) => ({
          path,
          updatedText: value?.updatedText ?? value
        }));
  const seen = new Set();

  return values.map(item => {
    const path = normalisePath(item?.path);
    const key = path.toLocaleLowerCase('en-GB');

    if (!path) {
      throw new Error('Every staged flow update requires its original ZIP path.');
    }

    if (seen.has(key)) {
      throw new Error(`${path} was staged more than once.`);
    }

    seen.add(key);
    return {
      path,
      updatedText: String(item?.updatedText ?? '')
    };
  });
}

function normaliseGuid(value) {
  return String(value ?? '').trim().replace(/[{}]/g, '').toLocaleLowerCase('en-GB');
}
