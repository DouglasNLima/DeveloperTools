import {
  buildUpdatedPackageFileName,
  bytesEqual,
  compareSolutionVersions,
  detectTextEncoding,
  encodeTextLikeOriginal,
  findDuplicateEntryPaths,
  incrementSolutionRevision,
  isValidSolutionVersion,
  normaliseXmlEncodingName,
  normaliseZipPath,
  updateSolutionVersionXml
} from './power-platform-package-editor.js';
import {
  parseSolutionMetadata,
  readPowerPlatformSolutionArchive,
  readZipArchive,
  replaceZipArchiveEntries
} from './power-platform-solution.js';
import {
  buildClassicWorkflowMermaid,
  buildClassicWorkflowXmlDiff,
  parseClassicWorkflowXaml
} from './power-platform-xaml.js';

export {
  buildClassicWorkflowMermaid as buildClassicWorkflowDiagram,
  parseClassicWorkflowXaml
} from './power-platform-xaml.js';
export {
  compareSolutionVersions,
  incrementSolutionRevision,
  isValidSolutionVersion
} from './power-platform-package-editor.js';

export async function inspectClassicWorkflowPackage(input, options = {}) {
  const archive = await readPowerPlatformSolutionArchive(input, options);
  const duplicatePaths = findDuplicateEntryPaths(archive.zipArchive.entries);
  const xamlFiles = archive.sourceFiles.workflowXamlFiles || [];
  const filesByPath = groupByPath(xamlFiles);
  const metadata = archive.components.filter(component => component.category === 0);
  const referenceCounts = countReferences(metadata);
  const referencedPaths = new Set();
  const workflows = [];

  for (const component of metadata) {
    const declaredPath = normaliseZipPath(component.raw?.xamlFileName);
    const matches = filesByPath.get(declaredPath.toLocaleLowerCase('en-GB')) || [];
    const file = matches[0] || null;
    const path = file?.path || declaredPath;
    const warnings = [...(component.warnings || [])];
    let parsed = null;
    let originalBytes = null;

    if (!declaredPath) {
      warnings.push('Workflow metadata does not include an XamlFileName reference.');
    } else {
      referencedPaths.add(declaredPath.toLocaleLowerCase('en-GB'));
    }

    if (declaredPath && matches.length === 0) {
      warnings.push(`${declaredPath} is referenced by this workflow but was not found in the solution ZIP.`);
    }

    if (matches.length > 1) {
      warnings.push(`${declaredPath} appears more than once in the solution ZIP.`);
    }

    if (declaredPath && (referenceCounts.get(declaredPath.toLocaleLowerCase('en-GB')) || 0) > 1) {
      warnings.push(`${declaredPath} is referenced by more than one classic workflow.`);
    }

    if (file) {
      originalBytes = await archive.zipArchive.readBytes(file.path);

      try {
        parsed = parseClassicWorkflowXaml(file.text);

        if (
          parsed.declaredEncoding
          && !isXmlEncodingCompatible(parsed.declaredEncoding, detectTextEncoding(originalBytes).encoding)
        ) {
          warnings.push(`${file.path} declares ${parsed.declaredEncoding} but uses a different byte encoding.`);
          parsed = null;
        }
      } catch (error) {
        warnings.push(`${file.path} cannot be edited safely: ${error.message}`);
      }
    }

    const entry = archive.zipArchive.entries.find(candidate => (
      normaliseZipPath(candidate.name).toLocaleLowerCase('en-GB')
      === normaliseZipPath(path).toLocaleLowerCase('en-GB')
    ));

    if (entry?.encrypted) {
      warnings.push(`${path} is encrypted and cannot be replaced.`);
    }

    workflows.push({
      id: component.id,
      name: component.name,
      path,
      metadataPath: 'customizations.xml',
      originalText: file?.text || '',
      originalBytes,
      parsed,
      metrics: parsed?.metrics || emptyMetrics(),
      triggers: component.triggers || {},
      primaryEntity: component.primaryEntity,
      state: component.state,
      component,
      editable: Boolean(
        file
        && parsed
        && matches.length === 1
        && !entry?.encrypted
        && (referenceCounts.get(declaredPath.toLocaleLowerCase('en-GB')) || 0) === 1
      ),
      warnings: [...new Set(warnings)]
    });
  }

  const orphanXamlFiles = xamlFiles
    .filter(file => !referencedPaths.has(normaliseZipPath(file.path).toLocaleLowerCase('en-GB')))
    .map(file => file.path)
    .sort((left, right) => left.localeCompare(right, 'en-GB'));
  const packagingErrors = buildPackagingErrors({
    archive,
    workflows,
    duplicatePaths,
    referenceCounts
  });
  const suggestedVersion = isValidSolutionVersion(archive.solution.version)
    ? incrementSolutionRevision(archive.solution.version)
    : '';
  const warnings = [
    ...archive.warnings.filter(warning => !/Workflows\/\*\.json cloud flow definitions/i.test(warning)),
    ...orphanXamlFiles.map(path => `${path} is not referenced by a Category 0 classic workflow.`)
  ];

  if (workflows.length === 0) {
    warnings.push('No Category 0 classic workflows were found in customizations.xml.');
  }

  return {
    ...archive,
    workflows: workflows.sort((left, right) => (
      left.name.localeCompare(right.name, 'en-GB')
      || left.path.localeCompare(right.path, 'en-GB')
    )),
    orphanXamlFiles,
    duplicatePaths,
    warnings: [...new Set(warnings)],
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

export function validateClassicWorkflowReplacement(originalWorkflow, updatedText) {
  const errors = [];
  const warnings = [];
  const text = String(updatedText ?? '');
  let parsed = null;
  let diff = null;

  if (!text.trim()) {
    errors.push('Enter the complete updated classic workflow XAML.');
    return buildResult();
  }

  if (!originalWorkflow?.parsed) {
    errors.push('The original exported workflow XAML is not recognised and cannot be replaced safely.');
    return buildResult();
  }

  try {
    parsed = parseClassicWorkflowXaml(text);
  } catch (error) {
    errors.push(`Updated classic workflow XAML is invalid: ${error.message}`);
    return buildResult();
  }

  if (originalWorkflow.parsed.xClass && parsed.xClass !== originalWorkflow.parsed.xClass) {
    errors.push('The XAML x:Class identity must remain unchanged.');
  }

  const originalEncoding = normaliseXmlEncodingName(originalWorkflow.parsed.declaredEncoding);
  const updatedEncoding = normaliseXmlEncodingName(parsed.declaredEncoding);

  if (originalEncoding !== updatedEncoding) {
    errors.push('The XML declaration encoding must remain unchanged.');
  }

  try {
    diff = buildClassicWorkflowXmlDiff(originalWorkflow.originalText, text);
  } catch (error) {
    errors.push(error.message || 'The classic workflow XAML could not be compared.');
  }

  if (diff?.equal) {
    errors.push('The updated XAML has no structural changes to stage.');
  }

  const outsideWorkflowChanges = (diff?.changes || []).filter(change => (
    !change.path.includes('/Workflow[')
  ));

  if (outsideWorkflowChanges.length > 0) {
    warnings.push(
      `${outsideWorkflowChanges.length.toLocaleString('en-GB')} structural change${outsideWorkflowChanges.length === 1 ? '' : 's'} affect XAML outside the Dataverse Workflow activity.`
    );
  }

  if (!sameStringArray(originalWorkflow.parsed.namespaces, parsed.namespaces)) {
    warnings.push('Root namespace declarations changed; confirm that referenced activity types remain available.');
  }

  if (!sameStringArray(originalWorkflow.parsed.assemblyNames, parsed.assemblyNames)) {
    warnings.push('One or more assembly-qualified activity references changed.');
  }

  return buildResult();

  function buildResult() {
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      updatedText: text,
      parsed,
      diff,
      originalMetrics: originalWorkflow?.metrics || emptyMetrics(),
      updatedMetrics: parsed?.metrics || emptyMetrics(),
      outsideWorkflowChanges: (diff?.changes || []).filter(change => !change.path.includes('/Workflow[')),
      diagram: errors.length === 0
        ? buildClassicWorkflowMermaid(originalWorkflow, text)
        : null
    };
  }
}

export async function buildUpdatedClassicWorkflowPackage({
  archive,
  replacements,
  targetVersion,
  riskAcknowledged = false
}, options = {}) {
  if (!archive?.zipArchive || !Array.isArray(archive.workflows)) {
    throw new Error('Inspect an exported solution ZIP before building an updated package.');
  }

  if (archive.solution.packageType !== 'Unmanaged') {
    throw new Error('Only unmanaged solutions can be rebuilt by the Classic workflow editor.');
  }

  if (!riskAcknowledged) {
    throw new Error('Acknowledge the unsupported classic workflow XAML editing risk before generating the package.');
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

  const replacementItems = normaliseReplacements(replacements);

  if (replacementItems.length === 0) {
    throw new Error('Stage at least one valid classic workflow update before generating the solution ZIP.');
  }

  const zipReplacements = new Map();
  const validatedReplacements = [];

  replacementItems.forEach(item => {
    const workflow = archive.workflows.find(candidate => (
      candidate.path.toLocaleLowerCase('en-GB') === item.path.toLocaleLowerCase('en-GB')
    ));

    if (!workflow) {
      throw new Error(`${item.path} is not a classic workflow in the inspected solution.`);
    }

    if (!workflow.editable) {
      throw new Error(`${workflow.name} cannot be replaced safely.`);
    }

    const validation = validateClassicWorkflowReplacement(workflow, item.updatedText);

    if (!validation.valid) {
      throw new Error(`${workflow.name}: ${validation.errors[0]}`);
    }

    const bytes = encodeTextLikeOriginal(validation.updatedText, workflow.originalBytes);
    zipReplacements.set(workflow.path, bytes);
    validatedReplacements.push({ workflow, validation, bytes });
  });

  const solutionXml = updateSolutionVersionXml(archive.sourceFiles.solutionXml, targetVersion);
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

  return {
    bytes,
    fileName: buildUpdatedPackageFileName(archive.solution.uniqueName, targetVersion),
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
    ...replacements.map(item => item.workflow.path)
  ].map(path => normaliseZipPath(path).toLocaleLowerCase('en-GB')));
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

    const key = normaliseZipPath(entry.name).toLocaleLowerCase('en-GB');

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
    const actualBytes = await outputZip.readBytes(replacement.workflow.path);
    if (!bytesEqual(replacement.bytes, actualBytes)) {
      errors.push(`${replacement.workflow.path} does not match the approved updated XAML.`);
    }

    try {
      parseClassicWorkflowXaml(await outputZip.readText(replacement.workflow.path));
    } catch (error) {
      errors.push(`${replacement.workflow.path} is not valid classic workflow XAML after rebuilding: ${error.message}`);
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

function buildPackagingErrors({ archive, workflows, duplicatePaths, referenceCounts }) {
  const errors = [];

  if (!archive.sourceFiles.solutionXml) {
    errors.push('solution.xml is required before the package can be rebuilt.');
  }

  if (!archive.sourceFiles.customizationsXml) {
    errors.push('customizations.xml is required to correlate classic workflows safely.');
  }

  if (archive.zipArchive.multiDisk) {
    errors.push('Multi-disk ZIP archives cannot be rebuilt in this browser-only editor.');
  }

  if (!isValidSolutionVersion(archive.solution.version)) {
    errors.push('The exported solution version is not a valid major.minor.build.revision value.');
  }

  const targetPaths = new Set([
    'solution.xml',
    ...workflows.map(workflow => normaliseZipPath(workflow.path).toLocaleLowerCase('en-GB'))
  ]);
  const duplicateTarget = duplicatePaths.find(path => targetPaths.has(path));
  if (duplicateTarget) {
    errors.push(`${duplicateTarget} appears more than once in the solution ZIP.`);
  }

  workflows.forEach(workflow => {
    const key = normaliseZipPath(workflow.path).toLocaleLowerCase('en-GB');
    const entry = archive.zipArchive.entries.find(candidate => (
      normaliseZipPath(candidate.name).toLocaleLowerCase('en-GB') === key
    ));

    if (entry?.encrypted) {
      errors.push(`${workflow.path} is encrypted and cannot be replaced.`);
    }

    if ((referenceCounts.get(key) || 0) > 1) {
      errors.push(`${workflow.path} is referenced by more than one classic workflow.`);
    }
  });

  return [...new Set(errors)];
}

function groupByPath(files) {
  const groups = new Map();

  files.forEach(file => {
    const key = normaliseZipPath(file.path).toLocaleLowerCase('en-GB');
    const values = groups.get(key) || [];
    values.push(file);
    groups.set(key, values);
  });

  return groups;
}

function countReferences(components) {
  const counts = new Map();

  components.forEach(component => {
    const key = normaliseZipPath(component.raw?.xamlFileName).toLocaleLowerCase('en-GB');
    if (key) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  });

  return counts;
}

function normaliseReplacements(replacements) {
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
    const path = normaliseZipPath(item?.path);
    const key = path.toLocaleLowerCase('en-GB');

    if (!path) {
      throw new Error('Every staged classic workflow update requires its original ZIP path.');
    }

    if (seen.has(key)) {
      throw new Error(`${path} was staged more than once.`);
    }

    seen.add(key);
    return { path, updatedText: String(item?.updatedText ?? '') };
  });
}

function sameStringArray(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isXmlEncodingCompatible(declaredEncoding, actualEncoding) {
  const declared = String(declaredEncoding || '').trim().toLocaleLowerCase('en-GB').replace(/[_-]/g, '');
  const actual = String(actualEncoding || '').trim().toLocaleLowerCase('en-GB').replace(/[_-]/g, '');

  if (declared === 'utf16') {
    return actual === 'utf16le' || actual === 'utf16be';
  }

  return declared === actual;
}

function emptyMetrics() {
  return {
    stepCount: 0,
    conditionCount: 0,
    branchCount: 0,
    customActivityCount: 0
  };
}
