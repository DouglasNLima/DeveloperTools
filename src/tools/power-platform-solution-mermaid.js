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

export {
  WORKFLOW_CATEGORY_TYPES,
  mergeWorkflowComponents,
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
  { value: 'other-process', label: 'Other processes' }
];

export async function processPowerPlatformSolutionArchive(input, options = {}) {
  const archive = await readPowerPlatformSolutionArchive(input, options);

  if (archive.components.length === 0) {
    throw new Error('No Power Platform workflow components were found in this solution export.');
  }

  const limitedComponents = archive.components.slice(0, MAX_SOLUTION_COMPONENTS).map(component => buildComponentDiagram(component));
  const warnings = [
    ...archive.warnings,
    ...(archive.components.length > limitedComponents.length
      ? [`${archive.components.length - limitedComponents.length} component${archive.components.length - limitedComponents.length === 1 ? '' : 's'} omitted to keep the report readable.`]
      : [])
  ];
  const inventoryMarkdown = buildSolutionInventoryMarkdown({
    solution: archive.solution,
    components: limitedComponents,
    warnings
  });
  const outputBytes = new TextEncoder().encode(inventoryMarkdown).length;

  return {
    solution: archive.solution,
    components: limitedComponents,
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
