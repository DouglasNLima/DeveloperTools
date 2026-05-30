import { formatBytes } from './base64.js';
import {
  escapeMarkdownTableCell,
  formatSolutionFileName,
  readPowerPlatformSolutionArchive
} from './power-platform-solution.js';
import { normalisePath, quoteCliArgument } from './power-platform-cli.js';

export const MAX_IMPORT_PREFLIGHT_COMPONENTS = 160;

const SOLUTION_COMPONENT_TYPES = {
  1: 'Table',
  2: 'Column',
  3: 'Relationship',
  9: 'Choice',
  20: 'Security role',
  26: 'View',
  29: 'Process',
  31: 'Report',
  44: 'Duplicate rule',
  60: 'Form',
  61: 'Web resource',
  62: 'Site map',
  70: 'Field security profile',
  80: 'Model-driven app',
  90: 'Plug-in assembly',
  91: 'SDK message processing step',
  92: 'SDK message processing step image',
  93: 'Service endpoint',
  95: 'Routing rule',
  150: 'Environment variable definition',
  151: 'Environment variable value',
  300: 'Canvas app',
  371: 'Connector',
  372: 'Connection reference'
};

export async function processPowerPlatformSolutionImportPreflightArchive(input, options = {}) {
  const archive = await readPowerPlatformSolutionArchive(input, options);
  const commandPath = normaliseImportPath(options.path || input?.name || `${archive.solution.uniqueName || 'solution'}.zip`);
  const components = parseRootComponents(archive.sourceFiles.solutionXml);
  const missingDependencies = parseMissingDependencies({
    solutionXml: archive.sourceFiles.solutionXml,
    customizationsXml: archive.sourceFiles.customizationsXml
  });
  const command = buildSolutionImportCommand({
    path: commandPath,
    async: options.async,
    forceOverwrite: options.forceOverwrite
  });
  const warnings = buildImportWarnings({
    archiveWarnings: archive.warnings,
    packageType: archive.solution.packageType,
    forceOverwrite: options.forceOverwrite,
    missingDependencies,
    environmentVariables: archive.environmentVariables,
    connectionReferences: archive.connectionReferences
  });
  const limitedComponents = components.slice(0, MAX_IMPORT_PREFLIGHT_COMPONENTS);
  const summary = buildImportSummary({
    components,
    limitedComponents,
    processComponents: archive.components,
    environmentVariables: archive.environmentVariables,
    connectionReferences: archive.connectionReferences,
    missingDependencies,
    warnings,
    zip: archive.zip
  });
  const report = {
    solution: archive.solution,
    summary,
    components: limitedComponents,
    processComponents: archive.components,
    environmentVariables: archive.environmentVariables,
    connectionReferences: archive.connectionReferences,
    missingDependencies,
    warnings,
    command,
    commandPath,
    targetEnvironmentNote: normaliseText(options.targetEnvironmentNote),
    zip: archive.zip
  };
  const documentationMarkdown = buildSolutionImportPreflightMarkdown(report);
  const outputBytes = new TextEncoder().encode(documentationMarkdown).length;

  return {
    ...report,
    documentationMarkdown,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes)
  };
}

export function buildSolutionImportPreflightMarkdown({
  solution,
  summary,
  components = [],
  processComponents = [],
  environmentVariables = [],
  connectionReferences = [],
  missingDependencies = [],
  warnings = [],
  command,
  commandPath,
  targetEnvironmentNote,
  zip = {}
}) {
  const lines = [
    '# Power Platform solution import preflight',
    '',
    `Solution: ${solution.name}`,
    `Unique name: ${solution.uniqueName}`,
    `Version: ${solution.version}`,
    `Package type: ${solution.packageType}`,
    `Publisher: ${solution.publisher}`,
    ...(targetEnvironmentNote ? [`Target environment note: ${targetEnvironmentNote}`] : []),
    '',
    '## Import command',
    '',
    '```sh',
    command,
    '```',
    '',
    `Command path: ${commandPath}`,
    '',
    '## Preflight summary',
    '',
    '| Area | Count |',
    '| --- | ---: |',
    `| Root components | ${summary.rootComponentCount} |`,
    `| Process components | ${summary.processComponentCount} |`,
    `| Environment variables | ${summary.environmentVariableCount} |`,
    `| Connection references | ${summary.connectionReferenceCount} |`,
    `| Exported missing dependencies | ${summary.missingDependencyCount} |`,
    `| Archive entries | ${zip.entryCount || 0} |`,
    `| Workflow JSON files | ${zip.workflowJsonCount || 0} |`,
    `| Warnings | ${summary.warningCount} |`,
    '',
    '## Root component mix',
    '',
    '| Component type | Count |',
    '| --- | ---: |',
    ...(summary.typeCounts.length > 0
      ? summary.typeCounts.map(item => `| ${escapeMarkdownTableCell(item.label)} | ${item.count} |`)
      : ['| No root components detected | 0 |']),
    '',
    '## Root component inventory',
    '',
    '| Type | Name | Identifier | Behaviour | Source |',
    '| --- | --- | --- | --- | --- |'
  ];

  if (components.length === 0) {
    lines.push('| No root components detected | - | - | - | - |');
  } else {
    components.forEach(component => {
      lines.push([
        component.typeLabel,
        component.name,
        component.id || '-',
        formatRootComponentBehaviour(component.behaviour),
        component.sourcePath
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    });
  }

  if (summary.omittedRootComponentCount > 0) {
    lines.push('', `${summary.omittedRootComponentCount} root component${summary.omittedRootComponentCount === 1 ? '' : 's'} omitted to keep the report readable.`);
  }

  lines.push(
    '',
    '## Process components',
    '',
    '| Type | Name | Primary table | State | Source |',
    '| --- | --- | --- | --- | --- |'
  );

  if (processComponents.length === 0) {
    lines.push('| No process components detected | - | - | - | - |');
  } else {
    processComponents.forEach(component => {
      lines.push([
        component.typeLabel,
        component.name,
        component.primaryEntity || '-',
        component.state || '-',
        component.sourcePath
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    });
  }

  lines.push(
    '',
    '## Environment variables',
    '',
    '| Schema name | Display name | Type | Value state | Source |',
    '| --- | --- | --- | --- | --- |'
  );

  if (environmentVariables.length === 0) {
    lines.push('| No environment variables detected | - | - | - | - |');
  } else {
    environmentVariables.forEach(variable => {
      lines.push([
        variable.schemaName,
        variable.displayName,
        variable.type,
        describeEnvironmentVariableValueState(variable),
        variable.sourcePath
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    });
  }

  lines.push(
    '',
    '## Connection references',
    '',
    '| Logical name | Display name | Connector | Source |',
    '| --- | --- | --- | --- |'
  );

  if (connectionReferences.length === 0) {
    lines.push('| No connection references detected | - | - | - |');
  } else {
    connectionReferences.forEach(reference => {
      lines.push([
        reference.logicalName,
        reference.displayName,
        reference.connectorName || reference.connectorId || 'Unknown',
        reference.sourcePath
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    });
  }

  lines.push(
    '',
    '## Exported missing dependencies',
    '',
    'These findings come from exported solution metadata only; this is not a live check against the target environment.',
    '',
    '| Required component | Dependent component | Source |',
    '| --- | --- | --- |'
  );

  if (missingDependencies.length === 0) {
    lines.push('| No exported missing dependencies found | - | - |');
  } else {
    missingDependencies.forEach(dependency => {
      lines.push([
        formatDependencyComponent(dependency.required),
        formatDependencyComponent(dependency.dependent),
        dependency.sourcePath
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    });
  }

  lines.push('', '## Warnings', '');

  if (warnings.length === 0) {
    lines.push('No import preflight warnings detected from the exported metadata.');
  } else {
    warnings.forEach(warning => lines.push(`- ${warning}`));
  }

  lines.push(
    '',
    '## Post-import checks',
    '',
    '- Confirm the active pac authentication profile before running the import command.',
    '- Review solution checker results before promoting the package.',
    '- Rebind connection references and populate target environment variable values where required.',
    '- Turn on and test cloud flows, business rules and process automation after import.',
    '- Publish and smoke-test model-driven app customisations after import.',
    '',
    '## Notes',
    '',
    '- This report was generated locally from an exported solution ZIP.',
    '- The tool does not authenticate, call Dataverse, run pac commands or import the package.',
    '- Managed and unmanaged conversion is not performed here; that requires the normal Power Platform import/export lifecycle.'
  );

  return lines.join('\n');
}

export function buildSolutionImportPreflightFileName(solutionName) {
  return formatSolutionFileName(solutionName, 'import-preflight', 'md');
}

export function buildSolutionImportCommand({ path, async = false, forceOverwrite = false } = {}) {
  const commandPath = normaliseImportPath(path);

  if (!commandPath) {
    throw new Error('Enter a ZIP path before building the import command.');
  }

  return [
    'pac',
    'solution',
    'import',
    '--path',
    commandPath,
    ...(async ? ['--async'] : []),
    ...(forceOverwrite ? ['--force-overwrite'] : [])
  ].map(quoteCliArgument).join(' ');
}

export function parseRootComponents(solutionXml = '') {
  return matchElements(solutionXml, 'RootComponent')
    .map((match, index) => {
      const attrs = parseXmlAttributes(match.attributes);
      const type = normaliseComponentType(attrs.type || attrs.componenttype);
      const name = attrs.schemaname
        || attrs.schemaName
        || attrs.displayname
        || attrs.name
        || attrs.id
        || `Root component ${index + 1}`;

      return {
        id: normaliseGuid(attrs.id || attrs.componentid || attrs.objectid || ''),
        name: decodeXmlEntities(name),
        schemaName: decodeXmlEntities(attrs.schemaname || attrs.schemaName || ''),
        displayName: decodeXmlEntities(attrs.displayname || attrs.name || ''),
        type,
        typeLabel: getSolutionComponentTypeLabel(type),
        behaviour: attrs.behaviour || attrs.behavior || '',
        parentId: normaliseGuid(attrs.parentid || attrs.parentId || ''),
        sourcePath: 'solution.xml'
      };
    })
    .sort((left, right) => (
      left.typeLabel.localeCompare(right.typeLabel, 'en-GB')
      || left.name.localeCompare(right.name, 'en-GB')
    ));
}

export function parseMissingDependencies({ solutionXml = '', customizationsXml = '' } = {}) {
  return [
    ...parseMissingDependenciesFromXml(solutionXml, 'solution.xml'),
    ...parseMissingDependenciesFromXml(customizationsXml, 'customizations.xml')
  ];
}

export function getSolutionComponentTypeLabel(type) {
  const key = Number(type);
  return SOLUTION_COMPONENT_TYPES[key] || `Component type ${type || 'unknown'}`;
}

function parseMissingDependenciesFromXml(xml, sourcePath) {
  return matchElements(xml, 'MissingDependency')
    .map(match => {
      const parentAttrs = parseXmlAttributes(match.attributes);
      const required = parseDependencyEndpoint(match.content, 'Required', parentAttrs, 'required');
      const dependent = parseDependencyEndpoint(match.content, 'Dependent', parentAttrs, 'dependent');

      if (!required.name && !dependent.name) {
        return null;
      }

      return {
        required,
        dependent,
        sourcePath
      };
    })
    .filter(Boolean);
}

function parseDependencyEndpoint(content, tagName, parentAttrs, prefix) {
  const match = matchElements(content, tagName)[0];
  const attrs = {
    ...pickPrefixedAttributes(parentAttrs, prefix),
    ...(match ? parseXmlAttributes(match.attributes) : {})
  };
  const type = normaliseComponentType(attrs.type || attrs.componenttype || attrs.componentType);
  const name = attrs.schemaname
    || attrs.schemaName
    || attrs.displayname
    || attrs.name
    || attrs.id
    || attrs.componentid
    || '';

  return {
    id: normaliseGuid(attrs.id || attrs.componentid || ''),
    name: decodeXmlEntities(name),
    type,
    typeLabel: getSolutionComponentTypeLabel(type),
    solution: decodeXmlEntities(attrs.solution || attrs.solutionname || attrs.solutionName || '')
  };
}

function pickPrefixedAttributes(attrs, prefix) {
  const output = {};
  const lowerPrefix = prefix.toLocaleLowerCase('en-GB');

  Object.entries(attrs || {}).forEach(([key, value]) => {
    const lowerKey = key.toLocaleLowerCase('en-GB');

    if (lowerKey.startsWith(lowerPrefix)) {
      output[lowerKey.slice(lowerPrefix.length)] = value;
    }
  });

  return output;
}

function buildImportSummary({
  components = [],
  limitedComponents = [],
  processComponents = [],
  environmentVariables = [],
  connectionReferences = [],
  missingDependencies = [],
  warnings = [],
  zip = {}
}) {
  const counts = new Map();

  components.forEach(component => {
    const key = component.typeLabel || 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return {
    rootComponentCount: components.length,
    omittedRootComponentCount: Math.max(components.length - limitedComponents.length, 0),
    processComponentCount: processComponents.length,
    environmentVariableCount: environmentVariables.length,
    connectionReferenceCount: connectionReferences.length,
    missingDependencyCount: missingDependencies.length,
    warningCount: warnings.length,
    archiveEntryCount: zip.entryCount || 0,
    workflowJsonCount: zip.workflowJsonCount || 0,
    typeCounts: [...counts.entries()].map(([label, count]) => ({ label, count }))
  };
}

function buildImportWarnings({
  archiveWarnings = [],
  packageType,
  forceOverwrite = false,
  missingDependencies = [],
  environmentVariables = [],
  connectionReferences = []
}) {
  const warnings = [...archiveWarnings];

  if (packageType === 'Managed') {
    warnings.push('Managed solution imports should follow a tested upgrade or update plan for downstream environments.');
  } else if (packageType === 'Unmanaged') {
    warnings.push('Unmanaged solution imports can overwrite target customisations and are usually intended for development environments.');
  } else {
    warnings.push('The solution package type could not be identified from the exported metadata.');
  }

  if (forceOverwrite) {
    warnings.push('Force overwrite can replace unmanaged customisations in the target environment.');
  }

  if (missingDependencies.length > 0) {
    warnings.push('Exported missing dependency metadata was found; validate these components in the target environment before import.');
  }

  const variablesWithoutValues = environmentVariables.filter(variable => !variable.currentValue && !variable.defaultValue);

  if (variablesWithoutValues.length > 0) {
    warnings.push(`${variablesWithoutValues.length.toLocaleString('en-GB')} environment variable${variablesWithoutValues.length === 1 ? '' : 's'} have no exported value; prepare target values before import.`);
  }

  if (connectionReferences.length > 0) {
    warnings.push('Connection references may need to be rebound after import in the target environment.');
  }

  return uniqueText(warnings);
}

function describeEnvironmentVariableValueState(variable) {
  if (variable.currentValue && variable.defaultValue) {
    return 'Current and default included';
  }

  if (variable.currentValue) {
    return 'Current value included';
  }

  if (variable.defaultValue) {
    return 'Default value included';
  }

  return 'No value exported';
}

function formatDependencyComponent(component) {
  if (!component?.name && !component?.type) {
    return '-';
  }

  const label = component.name || component.id || 'Unnamed component';
  const type = component.typeLabel || getSolutionComponentTypeLabel(component.type);
  const solution = component.solution ? ` from ${component.solution}` : '';

  return `${label} (${type})${solution}`;
}

function formatRootComponentBehaviour(value) {
  const text = String(value || '').trim();

  if (text === '0') {
    return 'Include subcomponents';
  }

  if (text === '1') {
    return 'Do not include subcomponents';
  }

  if (text === '2') {
    return 'Include shell only';
  }

  return text || '-';
}

function matchElements(xml, tagName) {
  const matches = [];
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>)`, 'gi');
  let match = pattern.exec(String(xml || ''));

  while (match) {
    matches.push({
      attributes: match[1] || '',
      content: match[2] || ''
    });
    match = pattern.exec(String(xml || ''));
  }

  return matches;
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

function decodeXmlEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function normaliseComponentType(value) {
  const match = String(value ?? '').match(/-?\d+/);
  return match ? Number(match[0]) : '';
}

function normaliseGuid(value) {
  return String(value ?? '').trim().replace(/[{}]/g, '').toLocaleLowerCase('en-GB');
}

function normaliseImportPath(value) {
  return normalisePath(value || '').trim();
}

function normaliseText(value) {
  return String(value ?? '').trim();
}

function uniqueText(values) {
  const seen = new Set();
  const output = [];

  values.forEach(value => {
    const text = String(value || '').trim();
    const key = text.toLocaleLowerCase('en-GB');

    if (text && !seen.has(key)) {
      seen.add(key);
      output.push(text);
    }
  });

  return output;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
