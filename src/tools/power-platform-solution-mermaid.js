import { formatBytes } from './base64.js';
import {
  analyseMermaidSource,
  buildMermaidDownloadFileName
} from './mermaid.js';
import {
  MAX_SOLUTION_COMPONENTS,
  collectLabelsFromKeys,
  decodeXmlEntities,
  escapeMarkdownTableCell,
  formatOperationLabel,
  isPlainObject,
  matchAllGroup,
  mergeWorkflowComponents,
  objectEntries,
  parseMaybeJson,
  parseSolutionMetadata,
  parseWorkflowJsonFiles,
  parseWorkflowMetadata,
  readPowerPlatformSolutionArchive,
  readZipArchive,
  uniqueLabels
} from './power-platform-solution.js';

const MAX_ACTIONS_PER_COMPONENT = 80;
const MAX_DEPENDENCY_RELATIONS = 180;

export {
  WORKFLOW_CATEGORY_TYPES,
  mergeWorkflowComponents,
  parsePluginStepMetadata,
  parseSolutionMetadata,
  parseWorkflowJsonFiles,
  parseWorkflowMetadata,
  readZipArchive
} from './power-platform-solution.js';

export const SOLUTION_MERMAID_COMPONENT_FILTERS = [
  { value: 'all', label: 'All components' },
  { value: 'cloud-flow', label: 'Cloud flows' },
  { value: 'business-process-flow', label: 'Business process flows' },
  { value: 'business-rule', label: 'Business rules' },
  { value: 'classic-workflow', label: 'Classic workflows' },
  { value: 'action', label: 'Custom actions' },
  { value: 'plugin-step', label: 'Plug-in steps' },
  { value: 'other-process', label: 'Other processes' }
];

export async function processPowerPlatformSolutionArchive(input, options = {}) {
  const archive = await readPowerPlatformSolutionArchive(input, options);

  if (archive.components.length === 0) {
    throw new Error('No Power Platform workflow components were found in this solution export.');
  }

  const limitedComponents = archive.components.slice(0, MAX_SOLUTION_COMPONENTS).map(component => buildComponentDiagram(component));
  const dependencyMap = buildSolutionDependencyMap(limitedComponents, {
    solution: archive.solution
  });
  const warnings = [
    ...archive.warnings,
    ...(archive.components.length > limitedComponents.length
      ? [`${archive.components.length - limitedComponents.length} component${archive.components.length - limitedComponents.length === 1 ? '' : 's'} omitted to keep the report readable.`]
      : [])
  ];
  const inventoryMarkdown = buildSolutionInventoryMarkdown({
    solution: archive.solution,
    components: limitedComponents,
    dependencyMap,
    warnings
  });
  const outputBytes = new TextEncoder().encode(inventoryMarkdown).length;

  return {
    solution: archive.solution,
    components: limitedComponents,
    dependencyMap,
    warnings,
    summary: buildSummary(limitedComponents),
    zip: archive.zip,
    inventoryMarkdown,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes)
  };
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

export function buildSolutionInventoryMarkdown({ solution, components, dependencyMap = null, warnings = [] }) {
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

  if (dependencyMap) {
    lines.push(
      '',
      '## Automation dependency map',
      '',
      `- Relations: ${dependencyMap.relationCount.toLocaleString('en-GB')}`,
      `- Nodes: ${dependencyMap.nodeCount.toLocaleString('en-GB')}`,
      `- Mermaid type: ${dependencyMap.outputType}`,
      ...(dependencyMap.warnings.length > 0 ? dependencyMap.warnings.map(warning => `- Warning: ${warning}`) : []),
      '',
      '```mermaid',
      dependencyMap.mermaid,
      '```'
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

export function buildSolutionDependencyMap(components = [], options = {}) {
  const warnings = [];
  const context = createMermaidContext('flowchart LR');
  const facts = components.map(component => extractDependencyFacts(component, components));
  const operations = facts.flatMap(item => item.operations);
  const triggers = facts.flatMap(item => item.triggers);
  const calls = facts.flatMap(item => item.calls);
  const relations = [];
  const relationKeys = new Set();

  function addRelation(relation) {
    const key = [
      relation.from.kind,
      relation.from.id,
      relation.to.kind,
      relation.to.id,
      relation.label
    ].join('|').toLocaleLowerCase('en-GB');

    if (!relationKeys.has(key)) {
      relationKeys.add(key);
      relations.push(relation);
    }
  }

  calls.forEach(call => {
    if (!call.target) {
      warnings.push(`${call.sourceName} references ${call.targetLabel}, but that target was not found in this solution.`);
    }

    addRelation({
      from: componentNodeRef(call.sourceId),
      to: call.target ? componentNodeRef(call.target.id) : externalNodeRef(call.targetLabel),
      label: call.label,
      confidence: call.confidence
    });
  });

  operations.forEach(operation => {
    const eventRef = eventNodeRef(operation);
    addRelation({
      from: componentNodeRef(operation.sourceId),
      to: eventRef,
      label: `writes ${formatDependencyMessage(operation.message)}`,
      confidence: operation.confidence
    });

    triggers.forEach(trigger => {
      const match = matchOperationToTrigger(operation, trigger);

      if (!match) {
        return;
      }

      addRelation({
        from: eventRef,
        to: componentNodeRef(trigger.targetId),
        label: `${match.confidence === 'explicit' ? 'triggers' : 'may trigger'} ${formatDependencyMessage(operation.message)}`,
        confidence: match.confidence
      });
    });
  });

  if (relations.length === 0) {
    warnings.push('No cross-component automation dependency relations were inferred from the exported metadata.');
    const rootId = context.node('solution_dependency_map', `Automation dependency map: ${options.solution?.name || 'Power Platform solution'}`, 'rounded');
    components.slice(0, 24).forEach(component => {
      const componentId = context.node(`component_${component.id}`, componentNodeLabel(component), 'box');
      context.edge(rootId, componentId, 'component');
    });
  } else {
    relations.slice(0, MAX_DEPENDENCY_RELATIONS).forEach(relation => {
      const fromId = emitDependencyNode(context, relation.from, components);
      const toId = emitDependencyNode(context, relation.to, components);
      const label = relation.confidence && relation.confidence !== 'explicit'
        ? `${relation.label} (${relation.confidence})`
        : relation.label;
      context.edge(fromId, toId, label);
    });

    if (relations.length > MAX_DEPENDENCY_RELATIONS) {
      warnings.push(`${relations.length - MAX_DEPENDENCY_RELATIONS} relation${relations.length - MAX_DEPENDENCY_RELATIONS === 1 ? '' : 's'} omitted to keep the dependency map readable.`);
    }
  }

  const mermaid = context.toString();
  const analysis = analyseMermaidSource(mermaid);

  return {
    id: '__dependency_map',
    name: 'Automation dependency map',
    type: 'dependency-map',
    typeLabel: 'Dependency map',
    sourcePath: 'solution analysis',
    primaryEntity: '',
    state: '',
    mermaid,
    stepCount: relations.length,
    relationCount: relations.length,
    nodeCount: context.nodeCount,
    triggerSummary: relations.length === 0
      ? ''
      : `${relations.length.toLocaleString('en-GB')} relation${relations.length === 1 ? '' : 's'}`,
    outputType: analysis.diagramType,
    lineCount: analysis.lineCount,
    outputBytes: analysis.outputBytes,
    outputSizeLabel: analysis.outputSizeLabel,
    downloadName: buildMermaidDownloadFileName(`${options.solution?.name || 'Power Platform solution'}-automation-map`, 'mmd'),
    warnings,
    relations: relations.slice(0, MAX_DEPENDENCY_RELATIONS)
  };
}

function extractDependencyFacts(component, components) {
  if (component.type === 'cloud-flow') {
    return extractCloudFlowDependencyFacts(component, components);
  }

  if (component.type === 'plugin-step') {
    const message = normaliseDataverseMessage(component.raw?.step?.message || '');
    const table = normaliseTableName(component.primaryEntity);

    return {
      operations: [],
      calls: [],
      triggers: table && message
        ? [{
            targetId: component.id,
            table,
            messages: [message],
            fields: normaliseFieldList(component.raw?.step?.filteringAttributes || []),
            confidence: 'explicit',
            targetType: component.type
          }]
        : []
    };
  }

  if (component.type === 'business-rule') {
    const table = normaliseTableName(component.primaryEntity);

    return {
      operations: [],
      calls: [],
      triggers: table
        ? [{
            targetId: component.id,
            table,
            messages: ['create', 'update', 'delete'],
            fields: extractBusinessRuleFields(component),
            confidence: 'probable',
            targetType: component.type
          }]
        : []
    };
  }

  if (component.type === 'classic-workflow') {
    const table = normaliseTableName(component.primaryEntity);
    const messages = extractClassicWorkflowMessages(component);

    return {
      operations: extractTextDataverseOperations(component),
      calls: [],
      triggers: table && messages.length > 0
        ? [{
            targetId: component.id,
            table,
            messages,
            fields: extractClassicWorkflowFields(component),
            confidence: messages.length === 3 ? 'probable' : 'explicit',
            targetType: component.type
          }]
        : []
    };
  }

  if (component.type === 'action') {
    return {
      operations: extractTextDataverseOperations(component),
      calls: [],
      triggers: []
    };
  }

  return {
    operations: [],
    calls: [],
    triggers: []
  };
}

function extractCloudFlowDependencyFacts(component, components) {
  const definition = component.raw?.definition;
  const facts = {
    operations: [],
    calls: [],
    triggers: []
  };

  if (!definition || !isPlainObject(definition)) {
    return facts;
  }

  objectEntries(definition.triggers).forEach(([key, trigger]) => {
    const fact = extractDataverseTriggerFact(component, key, trigger);

    if (fact) {
      facts.triggers.push(fact);
    }
  });

  collectCloudActionEntries(definition.actions).forEach(({ key, action }) => {
    const operation = extractDataverseActionOperation(component, key, action);
    const childCall = extractChildFlowCall(component, key, action, components);
    const customActionCall = extractCustomActionCall(component, key, action, components);

    if (operation) {
      facts.operations.push(operation);
    }

    if (childCall) {
      facts.calls.push(childCall);
    }

    if (customActionCall) {
      facts.calls.push(customActionCall);
    }
  });

  return facts;
}

function collectCloudActionEntries(actions, path = []) {
  const entries = [];

  objectEntries(actions).forEach(([key, action]) => {
    entries.push({ key, action, path: [...path, key] });
    getNestedActionGroups(action).forEach(group => {
      entries.push(...collectCloudActionEntries(group.actions, [...path, key]));
    });
  });

  return entries;
}

function extractDataverseTriggerFact(component, key, trigger) {
  const table = readDataverseTable(trigger);
  const messages = readDataverseMessages(trigger, key);

  if (!table || messages.length === 0) {
    return null;
  }

  return {
    targetId: component.id,
    table,
    messages,
    fields: readDataverseFields(trigger),
    confidence: 'explicit',
    targetType: component.type
  };
}

function extractDataverseActionOperation(component, key, action) {
  const operationId = readOperationId(action);
  const message = normaliseDataverseMessage(operationId || action?.type || key);
  const table = readDataverseTable(action);

  if (!isDataverseConnectorOperation(action) || !table || !['create', 'update', 'delete'].includes(message)) {
    return null;
  }

  return {
    sourceId: component.id,
    sourceName: component.name,
    table,
    message,
    fields: readDataverseFields(action),
    label: formatOperationLabel(key, action),
    confidence: 'explicit'
  };
}

function extractChildFlowCall(component, key, action, components) {
  const candidates = uniqueLabels([
    ...readDeepStringsByKey(action, /workflow(reference)?name|workflowid|childflow|flowname/i),
    /^workflow$/i.test(String(action?.type || '')) ? key : ''
  ]).filter(Boolean);

  if (!/^workflow$/i.test(String(action?.type || '')) && candidates.length === 0) {
    return null;
  }

  const resolvedTarget = findReferencedComponent(
    components,
    candidates,
    candidate => candidate.type === 'cloud-flow' && candidate.id !== component.id
  );
  const targetLabel = resolvedTarget?.name || candidates[0] || formatOperationLabel(key, action);

  return {
    sourceId: component.id,
    sourceName: component.name,
    target: resolvedTarget,
    targetLabel: `child flow ${targetLabel}`,
    label: 'calls child flow',
    confidence: resolvedTarget ? 'explicit' : 'unresolved'
  };
}

function extractCustomActionCall(component, key, action, components) {
  const operationId = readOperationId(action);

  if (!/perform.*action|boundaction|unboundaction|customaction/i.test(operationId)) {
    return null;
  }

  const candidates = uniqueLabels([
    ...readDeepStringsByKey(action, /actionname|operationname|processname|workflowname/i),
    key
  ]).filter(Boolean);
  const target = findReferencedComponent(components, candidates, item => item.type === 'action');

  if (!target && candidates.length === 0) {
    return null;
  }

  return {
    sourceId: component.id,
    sourceName: component.name,
    target,
    targetLabel: `custom action ${target?.name || candidates[0]}`,
    label: 'calls custom action',
    confidence: target ? 'explicit' : 'unresolved'
  };
}

function extractTextDataverseOperations(component) {
  const text = [component.raw?.clientData, component.raw?.content, component.raw?.xaml].filter(Boolean).join('\n');
  const json = parseMaybeJson(component.raw?.clientData);
  const operations = [];

  if (json) {
    collectDataverseOperationsFromObject(json).forEach(operation => {
      operations.push({
        sourceId: component.id,
        sourceName: component.name,
        ...operation
      });
    });
  }

  for (const match of text.matchAll(/\b(create|update|delete)\s+(?:record\s+)?(?:on\s+|in\s+)?([A-Za-z_][\w.]*)/gi)) {
    operations.push({
      sourceId: component.id,
      sourceName: component.name,
      table: normaliseTableName(match[2]),
      message: normaliseDataverseMessage(match[1]),
      fields: [],
      label: `${match[1]} ${match[2]}`,
      confidence: 'probable'
    });
  }

  return operations.filter(operation => operation.table && operation.message);
}

function collectDataverseOperationsFromObject(value, operations = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectDataverseOperationsFromObject(item, operations));
    return operations;
  }

  if (!isPlainObject(value)) {
    return operations;
  }

  const message = normaliseDataverseMessage(value.type || value.message || value.operation || value.action || value.name || '');
  const table = normaliseTableName(value.table || value.entity || value.entityName || value.primaryEntity || '');

  if (table && ['create', 'update', 'delete'].includes(message)) {
    operations.push({
      table,
      message,
      fields: normaliseFieldList(Object.keys(value.fields || value.attributes || value.values || {})),
      label: String(value.name || value.label || `${message} ${table}`),
      confidence: 'probable'
    });
  }

  Object.values(value).forEach(child => collectDataverseOperationsFromObject(child, operations));
  return operations;
}

function extractClassicWorkflowMessages(component) {
  const source = [
    component.raw?.attributes,
    component.raw?.content,
    component.raw?.clientData,
    component.raw?.xaml
  ];
  const text = source.map(value => (typeof value === 'string' ? value : JSON.stringify(value || {}))).join('\n');
  const messages = [];

  if (/triggeroncreate|oncreate|create/i.test(text)) {
    messages.push('create');
  }

  if (/triggeronupdate|onupdate|update/i.test(text)) {
    messages.push('update');
  }

  if (/triggerondelete|ondelete|delete/i.test(text)) {
    messages.push('delete');
  }

  return uniqueLabels(messages).length > 0 ? uniqueLabels(messages) : ['create', 'update', 'delete'];
}

function extractClassicWorkflowFields(component) {
  const text = [component.raw?.content, component.raw?.clientData, component.raw?.xaml].filter(Boolean).join('\n');
  const fields = [
    ...matchAllGroup(text, /TriggerOnUpdateAttributeList[^>]*>([^<]+)/gi),
    ...matchAllGroup(text, /filteringattributes?["':=\s]+([A-Za-z0-9_,;\s]+)/gi)
  ].flatMap(splitFieldList);

  return normaliseFieldList(fields);
}

function extractBusinessRuleFields(component) {
  const clientData = component.raw?.clientData || '';
  const json = parseMaybeJson(clientData);

  if (json) {
    return normaliseFieldList(readDeepStringsByKey(json, /field|attribute|column/i));
  }

  return normaliseFieldList([
    ...matchAllGroup(clientData, /(?:field|attribute|column)\s*[:=]\s*([A-Za-z_][\w.]*)/gi)
  ]);
}

function readOperationId(action) {
  return String(action?.inputs?.host?.operationId || action?.inputs?.method || '');
}

function isDataverseConnectorOperation(action) {
  const host = action?.inputs?.host || {};
  const marker = [
    host.apiId,
    host.connectionName,
    host.apiName,
    host.operationId,
    action?.type
  ].filter(Boolean).join(' ');

  return /commondataservice|dataverse/i.test(marker);
}

function readDataverseTable(operation) {
  const candidates = [
    ...readDeepStringsByKey(operation, /^(entityname|entityName|table|tableName|logicalName|primaryEntity|primaryentityname)$/i),
    ...readDeepStringsByKey(operation?.inputs?.parameters?.subscriptionRequest, /entityname|table/i)
  ];

  return normaliseTableName(candidates.find(Boolean));
}

function readDataverseMessages(operation, fallback = '') {
  const candidates = [
    readOperationId(operation),
    ...readDeepStringsByKey(operation, /message|operation|event|type/i),
    fallback
  ];
  const messages = [];

  candidates.forEach(candidate => {
    const text = String(candidate || '').toLocaleLowerCase('en-GB');

    if (/added.*modified.*deleted|create.*update.*delete/.test(text)) {
      messages.push('create', 'update', 'delete');
      return;
    }

    const message = normaliseDataverseMessage(candidate);

    if (message) {
      messages.push(message);
    }
  });

  return uniqueLabels(messages).filter(message => ['create', 'update', 'delete', 'assign'].includes(message));
}

function readDataverseFields(operation) {
  const fields = [
    ...readDeepStringsByKey(operation, /filteringattributes|attribute|field|column/i).flatMap(splitFieldList)
  ];
  const payloads = [
    operation?.inputs?.parameters?.item,
    operation?.inputs?.parameters?.record,
    operation?.inputs?.parameters?.body,
    operation?.inputs?.body
  ].filter(isPlainObject);

  payloads.forEach(payload => {
    fields.push(...Object.keys(payload));
  });

  return normaliseFieldList(fields);
}

function normaliseDataverseMessage(value) {
  const text = String(value ?? '').trim().toLocaleLowerCase('en-GB');

  if (!text) {
    return '';
  }

  if (/create|add/.test(text)) {
    return 'create';
  }

  if (/update|modify|patch/.test(text)) {
    return 'update';
  }

  if (/delete|remove/.test(text)) {
    return 'delete';
  }

  if (/assign/.test(text)) {
    return 'assign';
  }

  return '';
}

function normaliseTableName(value) {
  return String(value ?? '')
    .trim()
    .replace(/[{}]/g, '')
    .replace(/^['"]|['"]$/g, '')
    .toLocaleLowerCase('en-GB');
}

function normaliseFieldList(fields) {
  return uniqueLabels(
    fields
      .flatMap(splitFieldList)
      .map(field => String(field || '').trim().replace(/^['"]|['"]$/g, '').toLocaleLowerCase('en-GB'))
      .filter(field => field && !['id', 'entityname', 'table', 'tablename', 'item'].includes(field))
  );
}

function splitFieldList(value) {
  if (Array.isArray(value)) {
    return value.flatMap(splitFieldList);
  }

  return String(value ?? '')
    .split(/[,\s;|]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function readDeepStringsByKey(value, keyPattern, output = []) {
  if (Array.isArray(value)) {
    value.forEach(item => readDeepStringsByKey(item, keyPattern, output));
    return output;
  }

  if (!isPlainObject(value)) {
    return output;
  }

  Object.entries(value).forEach(([key, child]) => {
    if (keyPattern.test(key)) {
      if (typeof child === 'string' || typeof child === 'number') {
        output.push(String(child));
      } else if (Array.isArray(child)) {
        output.push(...child.filter(item => typeof item === 'string' || typeof item === 'number').map(String));
      }
    }

    readDeepStringsByKey(child, keyPattern, output);
  });

  return output;
}

function findReferencedComponent(components, candidates, predicate) {
  const normalisedCandidates = candidates.map(candidate => ({
    raw: String(candidate || ''),
    guid: normaliseGuid(candidate),
    key: normaliseDependencyKey(candidate)
  })).filter(candidate => candidate.raw);

  return components.find(component => {
    if (!predicate(component)) {
      return false;
    }

    const aliases = componentAliases(component);
    return normalisedCandidates.some(candidate => (
      (candidate.guid && aliases.guids.has(candidate.guid))
      || (candidate.key && aliases.keys.has(candidate.key))
    ));
  }) || null;
}

function componentAliases(component) {
  return {
    guids: new Set([
      normaliseGuid(component.id),
      normaliseGuid(component.raw?.json?.id),
      normaliseGuid(component.raw?.json?.properties?.workflowEntityId)
    ].filter(Boolean)),
    keys: new Set([
      normaliseDependencyKey(component.name),
      normaliseDependencyKey(component.raw?.json?.name),
      normaliseDependencyKey(component.raw?.json?.properties?.name),
      normaliseDependencyKey(component.raw?.json?.properties?.displayName)
    ].filter(Boolean))
  };
}

function matchOperationToTrigger(operation, trigger) {
  if (operation.table !== trigger.table) {
    return null;
  }

  if (!trigger.messages.includes(operation.message)) {
    return null;
  }

  if (operation.message === 'update' && operation.fields.length > 0 && trigger.fields.length > 0) {
    const operationFields = new Set(operation.fields);

    if (!trigger.fields.some(field => operationFields.has(field))) {
      return null;
    }

    return {
      confidence: operation.confidence === 'explicit' && trigger.confidence === 'explicit' ? 'explicit' : 'probable'
    };
  }

  return {
    confidence: operation.confidence === 'explicit' && trigger.confidence === 'explicit' && trigger.fields.length === 0
      ? 'probable'
      : (operation.confidence === 'explicit' && trigger.confidence === 'explicit' ? 'explicit' : 'probable')
  };
}

function componentNodeRef(id) {
  return { kind: 'component', id };
}

function eventNodeRef(operation) {
  return {
    kind: 'event',
    id: `${operation.message}:${operation.table}:${operation.fields.join(',')}`,
    operation
  };
}

function externalNodeRef(label) {
  return {
    kind: 'external',
    id: normaliseDependencyKey(label),
    label
  };
}

function emitDependencyNode(context, ref, components) {
  if (ref.kind === 'event') {
    return context.node(`event_${ref.id}`, eventNodeLabel(ref.operation), 'diamond');
  }

  if (ref.kind === 'external') {
    return context.node(`external_${ref.id}`, ref.label, 'box');
  }

  const component = components.find(item => item.id === ref.id);
  return context.node(`component_${ref.id}`, componentNodeLabel(component), 'rounded');
}

function componentNodeLabel(component) {
  if (!component) {
    return 'Unknown component';
  }

  return `${component.typeLabel}: ${component.name}`;
}

function eventNodeLabel(operation) {
  const fields = operation.fields.length > 0 ? ` (${operation.fields.slice(0, 4).join(', ')})` : '';
  return `Dataverse ${formatDependencyMessage(operation.message)}: ${operation.table}${fields}`;
}

function formatDependencyMessage(message) {
  return String(message || 'event').replace(/^\w/, character => character.toLocaleUpperCase('en-GB'));
}

function normaliseGuid(value) {
  return String(value ?? '').trim().replace(/[{}]/g, '').toLocaleLowerCase('en-GB');
}

function normaliseDependencyKey(value) {
  return String(value ?? '').trim().toLocaleLowerCase('en-GB').replace(/[^a-z0-9]+/g, '');
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
  return decodeXmlEntities(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
    .trim();
}
