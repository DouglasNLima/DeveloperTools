import { formatBytes } from './base64.js';
import {
  MAX_SOLUTION_COMPONENTS,
  collectLabelsFromKeys,
  escapeMarkdownTableCell,
  formatOperationLabel,
  formatSolutionFileName,
  getCloudFlowDefinitionMetrics,
  isPlainObject,
  matchAllGroup,
  parseMaybeJson,
  readPowerPlatformSolutionArchive,
  uniqueLabels
} from './power-platform-solution.js';

export async function processPowerPlatformSolutionDocumentationArchive(input, options = {}) {
  const archive = await readPowerPlatformSolutionArchive(input, options);
  const limitedComponents = archive.components.slice(0, MAX_SOLUTION_COMPONENTS);
  const warnings = [
    ...archive.warnings,
    ...(archive.components.length > limitedComponents.length
      ? [`${archive.components.length - limitedComponents.length} component${archive.components.length - limitedComponents.length === 1 ? '' : 's'} omitted to keep the documentation readable.`]
      : [])
  ];
  const components = limitedComponents.map(component => ({
    ...component,
    documentation: summariseComponent(component)
  }));
  const summary = buildDocumentationSummary({
    components,
    environmentVariables: archive.environmentVariables,
    connectionReferences: archive.connectionReferences,
    warnings
  });
  const documentationMarkdown = buildSolutionDocumentationMarkdown({
    solution: archive.solution,
    summary,
    components,
    environmentVariables: archive.environmentVariables,
    connectionReferences: archive.connectionReferences,
    warnings,
    zip: archive.zip
  });
  const outputBytes = new TextEncoder().encode(documentationMarkdown).length;

  return {
    solution: archive.solution,
    components,
    environmentVariables: archive.environmentVariables,
    connectionReferences: archive.connectionReferences,
    warnings,
    summary,
    zip: archive.zip,
    documentationMarkdown,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes)
  };
}

export function buildSolutionDocumentationMarkdown({
  solution,
  summary,
  components = [],
  environmentVariables = [],
  connectionReferences = [],
  warnings = [],
  zip = {}
}) {
  const lines = [
    '# Power Platform solution documentation',
    '',
    `Solution: ${solution.name}`,
    `Unique name: ${solution.uniqueName}`,
    `Version: ${solution.version}`,
    `Package type: ${solution.packageType}`,
    `Publisher: ${solution.publisher}`,
    '',
    '## Operational summary',
    '',
    '| Area | Count |',
    '| --- | ---: |',
    `| Process components | ${summary.componentCount} |`,
    `| Environment variables | ${summary.environmentVariableCount} |`,
    `| Connection references | ${summary.connectionReferenceCount} |`,
    `| Archive entries | ${zip.entryCount || 0} |`,
    `| Workflow JSON files | ${zip.workflowJsonCount || 0} |`,
    `| Warnings | ${summary.warningCount} |`,
    '',
    '## Process component mix',
    '',
    '| Component type | Count |',
    '| --- | ---: |',
    ...(summary.typeCounts.length > 0
      ? summary.typeCounts.map(item => `| ${escapeMarkdownTableCell(item.label)} | ${item.count} |`)
      : ['| No process components detected | 0 |'])
  ];

  lines.push('', '## Review warnings', '');

  if (warnings.length === 0 && !components.some(component => component.warnings.length > 0)) {
    lines.push('No warnings detected from the exported metadata.');
  } else {
    warnings.forEach(warning => lines.push(`- ${warning}`));
    components.forEach(component => {
      component.warnings.forEach(warning => lines.push(`- ${component.name}: ${warning}`));
    });
  }

  lines.push(
    '',
    '## Component inventory',
    '',
    '| Type | Name | Primary table | State | Source |',
    '| --- | --- | --- | --- | --- |'
  );

  if (components.length === 0) {
    lines.push('| No process components detected | - | - | - | - |');
  } else {
    components.forEach(component => {
      lines.push([
        component.typeLabel,
        component.name,
        component.primaryEntity || '-',
        component.state || '-',
        component.sourcePath
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    });
  }

  lines.push('', '## Process details');

  if (components.length === 0) {
    lines.push('', 'No process components were detected in this solution export.');
  } else {
    components.forEach(component => {
      lines.push(
        '',
        `### ${component.name}`,
        '',
        `- Type: ${component.typeLabel}`,
        `- Source: ${component.sourcePath}`,
        `- Detail: ${component.documentation.summary}`,
        ...(component.primaryEntity ? [`- Primary table: ${component.primaryEntity}`] : []),
        ...(component.documentation.trigger ? [`- Trigger: ${component.documentation.trigger}`] : []),
        ...(component.documentation.connectors.length > 0 ? [`- Connectors: ${component.documentation.connectors.join(', ')}`] : []),
        ...(component.documentation.notes.length > 0 ? component.documentation.notes.map(note => `- Note: ${note}`) : [])
      );
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
    '## Appendix',
    '',
    '- This documentation was generated locally from an exported Solution ZIP.',
    '- Values are summarised from exported metadata only; validate deployment-specific settings before release.',
    '- Environment variable values are reported as presence states rather than printed values.'
  );

  return lines.join('\n');
}

export function buildSolutionDocumentationFileName(solutionName) {
  return formatSolutionFileName(solutionName, 'documentation', 'md');
}

function summariseComponent(component) {
  if (component.type === 'cloud-flow') {
    return summariseCloudFlow(component);
  }

  if (component.type === 'business-process-flow') {
    const stages = extractStageNames(component);
    return {
      summary: `${stages.length.toLocaleString('en-GB')} stage${stages.length === 1 ? '' : 's'} detected`,
      trigger: '',
      connectors: [],
      notes: stages.length > 0 ? [`Stages: ${stages.join(', ')}`] : ['Detailed BPF stage metadata was not exported.']
    };
  }

  if (component.type === 'business-rule') {
    const rule = extractBusinessRuleShape(component);
    const total = rule.conditions.length + rule.actions.length;
    return {
      summary: `${total.toLocaleString('en-GB')} condition/action item${total === 1 ? '' : 's'} detected`,
      trigger: rule.conditions[0] || '',
      connectors: [],
      notes: [
        ...(rule.conditions.length > 0 ? [`Conditions: ${rule.conditions.join(', ')}`] : []),
        ...(rule.actions.length > 0 ? [`Actions: ${rule.actions.join(', ')}`] : []),
        ...(total === 0 ? ['Detailed business rule metadata was not exported.'] : [])
      ]
    };
  }

  if (component.type === 'classic-workflow') {
    const steps = extractWorkflowStepNames(component);
    return {
      summary: `${steps.length.toLocaleString('en-GB')} workflow step${steps.length === 1 ? '' : 's'} detected`,
      trigger: steps[0] || '',
      connectors: [],
      notes: steps.length > 0 ? [`Steps: ${steps.join(', ')}`] : ['Detailed workflow step metadata was not exported.']
    };
  }

  return {
    summary: 'Metadata only',
    trigger: '',
    connectors: [],
    notes: ['This component type has limited documentation support.']
  };
}

function summariseCloudFlow(component) {
  const definition = component.raw?.definition;

  if (!definition || !isPlainObject(definition)) {
    return {
      summary: 'Metadata only',
      trigger: '',
      connectors: [],
      notes: ['Detailed cloud flow definition metadata was not exported.']
    };
  }

  const metrics = getCloudFlowDefinitionMetrics(definition);
  const connectors = collectCloudFlowConnectors(definition);

  return {
    summary: `${metrics.triggerCount.toLocaleString('en-GB')} trigger${metrics.triggerCount === 1 ? '' : 's'} and ${metrics.actionCount.toLocaleString('en-GB')} action${metrics.actionCount === 1 ? '' : 's'} detected`,
    trigger: metrics.triggerSummary,
    connectors,
    notes: connectors.length > 0 ? [] : ['No connector identifiers were found in the flow definition.']
  };
}

function extractStageNames(component) {
  const text = [component.raw?.clientData, component.raw?.content, component.raw?.xaml].filter(Boolean).join('\n');
  const names = [
    ...matchAllGroup(text, /"stage(?:Name|name)"\s*:\s*"([^"]+)"/gi),
    ...matchAllGroup(text, /<Stage\b[^>]*(?:name|Name)="([^"]+)"/g),
    ...matchAllGroup(text, /<Step\b[^>]*(?:name|Name)="([^"]+)"/g),
    ...matchAllGroup(text, /(?:stage|step)\s*[:=]\s*([^,;\r\n<]+)/gi)
  ];

  return uniqueLabels(names).slice(0, 80);
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
    return collectLabelsFromKeys(json, ['steps', 'actions', 'activities']).slice(0, 80);
  }

  return uniqueLabels([
    ...matchAllGroup(text, /<Step\b[^>]*(?:name|Name)="([^"]+)"/g),
    ...matchAllGroup(text, /<Activity\b[^>]*(?:name|Name)="([^"]+)"/g),
    ...matchAllGroup(text, /(?:step|activity)\s*[:=]\s*([^;\r\n<]+)/gi)
  ]).slice(0, 80);
}

function collectCloudFlowConnectors(definition) {
  const labels = [];

  function visitAction(action, key) {
    const host = action?.inputs?.host || {};
    const apiId = host.apiId || host.connectionName || host.operationId || action?.type || key;

    if (apiId) {
      labels.push(formatOperationLabel(apiId, { type: action?.type }));
    }

    [
      action?.actions,
      action?.else?.actions,
      action?.default?.actions,
      ...Object.values(action?.cases || {}).map(value => value?.actions)
    ].forEach(group => {
      if (isPlainObject(group)) {
        Object.entries(group).forEach(([childKey, childAction]) => visitAction(childAction, childKey));
      }
    });
  }

  Object.entries(definition.actions || {}).forEach(([key, action]) => visitAction(action, key));

  return uniqueLabels(labels)
    .map(label => label.replace(/^\/providers\/Microsoft\.PowerApps\/apis\//i, '').replace(/^shared_/i, '').replace(/_/g, ' '))
    .slice(0, 12);
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

function buildDocumentationSummary({ components = [], environmentVariables = [], connectionReferences = [], warnings = [] }) {
  const counts = new Map();

  components.forEach(component => {
    const key = component.typeLabel || 'Other process';
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return {
    componentCount: components.length,
    environmentVariableCount: environmentVariables.length,
    connectionReferenceCount: connectionReferences.length,
    warningCount: warnings.length + components.reduce((total, component) => total + (component.warnings?.length || 0), 0),
    typeCounts: [...counts.entries()].map(([label, count]) => ({ label, count }))
  };
}
