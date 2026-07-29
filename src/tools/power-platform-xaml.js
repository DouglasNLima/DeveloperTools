import { buildTextDiff } from './text-diff.js';
import { formatPowerPlatformDisplayName } from './power-platform-display.js';

const ACTIVITIES_NAMESPACE = 'http://schemas.microsoft.com/netfx/2009/xaml/activities';
const XAML_NAMESPACE = 'http://schemas.microsoft.com/winfx/2006/xaml';
const DATAVERSE_WORKFLOW_NAMESPACE = 'clr-namespace:Microsoft.Xrm.Sdk.Workflow.Activities;assembly=Microsoft.Xrm.Sdk.Workflow';
const MAX_DIAGRAM_STEPS = 80;
const MAX_LINE_DIFF_MATRIX_CELLS = 2_000_000;
const INFRASTRUCTURE_ELEMENTS = new Set([
  'Activity',
  'Workflow',
  'Members',
  'Property',
  'Variable',
  'Variables',
  'InArgument',
  'OutArgument',
  'InOutArgument',
  'Literal',
  'ReferenceLiteral',
  'Collection',
  'VisualBasic.Settings',
  'ActivityReference.Arguments',
  'ActivityReference.Properties'
]);
const CONTAINER_ELEMENTS = new Set([
  'Sequence',
  'Parallel',
  'Pick',
  'PickBranch',
  'Flowchart'
]);

export function parseClassicWorkflowXaml(input) {
  const text = String(input ?? '');

  if (!text.trim()) {
    throw new Error('Classic workflow XAML is empty.');
  }

  if (/<!DOCTYPE\b/i.test(text) || /<!ENTITY\b/i.test(text)) {
    throw new Error('DTD and entity declarations are not allowed in classic workflow XAML.');
  }

  const parsed = parseXmlDocument(text);
  const root = parsed.root;

  if (root.localName !== 'Activity' || root.namespaceUri !== ACTIVITIES_NAMESPACE) {
    throw new Error('Classic workflow XAML must use an Activity root in the Windows Workflow Foundation namespace.');
  }

  const workflowNodes = parsed.elements.filter(node => (
    node.localName === 'Workflow'
    && node.namespaceUri.startsWith(DATAVERSE_WORKFLOW_NAMESPACE)
  ));

  if (workflowNodes.length !== 1) {
    throw new Error('Classic workflow XAML must contain exactly one recognised Dataverse Workflow activity.');
  }

  const workflowNode = workflowNodes[0];
  const xClass = readAttribute(root, 'Class', XAML_NAMESPACE)?.value || '';
  const steps = collectWorkflowSteps(workflowNode);
  const metrics = summariseSteps(steps);

  return {
    text,
    root,
    workflowNode,
    elements: parsed.elements,
    declaredEncoding: parsed.declaredEncoding,
    xClass,
    namespaces: collectNamespaceUris(root),
    assemblyNames: collectAssemblyNames(parsed.elements),
    steps,
    metrics
  };
}

export function buildClassicWorkflowXmlDiff(originalText, updatedText) {
  const original = parseClassicWorkflowXaml(originalText);
  const updated = parseClassicWorkflowXaml(updatedText);
  const originalEntries = flattenXmlTree(original.root);
  const updatedEntries = flattenXmlTree(updated.root);
  const paths = [...new Set([...originalEntries.keys(), ...updatedEntries.keys()])]
    .sort((left, right) => left.localeCompare(right, 'en-GB'));
  const changes = [];
  const summary = {
    added: 0,
    removed: 0,
    changed: 0,
    elements: 0,
    attributes: 0,
    text: 0,
    totalChanges: 0
  };

  paths.forEach(path => {
    const before = originalEntries.get(path);
    const after = updatedEntries.get(path);

    if (before && after && before.value === after.value && before.kind === after.kind) {
      return;
    }

    const type = !before ? 'added' : !after ? 'removed' : 'changed';
    const kind = after?.kind || before?.kind || 'element';
    summary[type] += 1;
    summary[kind === 'attribute' ? 'attributes' : kind === 'text' ? 'text' : 'elements'] += 1;
    changes.push({
      type,
      kind,
      path,
      before: before?.value,
      after: after?.value
    });
  });

  summary.totalChanges = summary.added + summary.removed + summary.changed;

  return {
    equal: summary.totalChanges === 0,
    summary,
    changes,
    lineDiff: buildSafeLineDiff(originalText, updatedText),
    original,
    updated
  };
}

function buildSafeLineDiff(originalText, updatedText) {
  const leftLineCount = String(originalText).split(/\r\n|\r|\n/).length;
  const rightLineCount = String(updatedText).split(/\r\n|\r|\n/).length;

  if (leftLineCount * rightLineCount > MAX_LINE_DIFF_MATRIX_CELLS) {
    return {
      truncated: true,
      leftLineCount,
      rightLineCount,
      summary: {
        added: 0,
        removed: 0,
        changed: 0,
        unchanged: 0,
        totalChanges: 0
      },
      rows: [],
      warnings: ['The line diff was omitted because the XAML documents are too large for a responsive browser comparison.']
    };
  }

  return buildTextDiff({
    leftText: originalText,
    rightText: updatedText,
    outputFormat: 'json'
  });
}

export function buildClassicWorkflowMermaid(workflow = {}, xamlText = workflow.originalText) {
  const parsed = parseClassicWorkflowXaml(xamlText);
  const steps = parsed.steps.slice(0, MAX_DIAGRAM_STEPS);
  const lines = ['flowchart TD'];
  const rootId = 'workflow';
  lines.push(`  ${rootId}(["${escapeMermaidLabel(`Workflow: ${formatPowerPlatformDisplayName(workflow.name, 'Classic workflow')}`)}"])`);
  let previousId = rootId;

  steps.forEach((step, index) => {
    const id = `step_${index + 1}`;
    const shape = step.condition
      ? `{${escapeMermaidLabel(step.label)}}`
      : `["${escapeMermaidLabel(step.label)}"]`;
    lines.push(`  ${id}${shape}`);
    const edgeLabel = step.branch ? `|${escapeMermaidEdge(step.branch)}|` : '';
    lines.push(`  ${previousId} -->${edgeLabel} ${id}`);
    previousId = id;
  });

  if (steps.length === 0) {
    const metadataId = 'metadata';
    lines.push(`  ${metadataId}["No recognised workflow steps"]`);
    lines.push(`  ${rootId} --> ${metadataId}`);
  }

  return {
    mermaid: lines.join('\n'),
    stepCount: parsed.metrics.stepCount,
    triggerSummary: formatTriggerSummary(workflow.triggers),
    metrics: parsed.metrics,
    warnings: parsed.steps.length > MAX_DIAGRAM_STEPS
      ? ['Some workflow steps were omitted to keep the diagram readable.']
      : parsed.steps.length === 0
        ? ['Detailed workflow activities were not recognised, so a metadata node was generated.']
        : []
  };
}

function parseXmlDocument(text) {
  const declarationMatch = text.match(/^\s*<\?xml\b([\s\S]*?)\?>/i);
  const declaredEncoding = declarationMatch?.[1]?.match(/\bencoding\s*=\s*(['"])(.*?)\1/i)?.[2] || '';
  const elements = [];
  const stack = [];
  let root = null;
  let index = 0;

  while (index < text.length) {
    if (text.startsWith('<!--', index)) {
      const end = text.indexOf('-->', index + 4);
      if (end < 0) {
        throw xmlError('Unclosed XML comment', index);
      }
      if (text.slice(index + 4, end).includes('--')) {
        throw xmlError('XML comments cannot contain a double hyphen', index);
      }
      index = end + 3;
      continue;
    }

    if (text.startsWith('<![CDATA[', index)) {
      const end = text.indexOf(']]>', index + 9);
      if (end < 0) {
        throw xmlError('Unclosed CDATA section', index);
      }
      appendText(stack, text.slice(index + 9, end), true);
      index = end + 3;
      continue;
    }

    if (text.startsWith('<?', index)) {
      const end = text.indexOf('?>', index + 2);
      if (end < 0) {
        throw xmlError('Unclosed processing instruction', index);
      }
      index = end + 2;
      continue;
    }

    if (text[index] !== '<') {
      const end = text.indexOf('<', index);
      const next = end < 0 ? text.length : end;
      const value = text.slice(index, next);

      if (stack.length === 0 && value.trim()) {
        throw xmlError('Text is not allowed outside the XML root element', index);
      }

      appendText(stack, decodeXmlEntities(value), false);
      index = next;
      continue;
    }

    if (text.startsWith('</', index)) {
      const end = text.indexOf('>', index + 2);
      if (end < 0) {
        throw xmlError('Unclosed XML end tag', index);
      }
      const name = text.slice(index + 2, end).trim();
      const current = stack.pop();

      if (!current || current.name !== name) {
        throw xmlError(`Unexpected closing tag ${name}`, index);
      }

      index = end + 1;
      continue;
    }

    if (text.startsWith('<!', index)) {
      throw xmlError('Unsupported XML declaration', index);
    }

    const end = findTagEnd(text, index + 1);
    const rawTag = text.slice(index + 1, end);
    const selfClosing = /\/\s*$/.test(rawTag);
    const body = rawTag.replace(/\/\s*$/, '').trim();
    const nameMatch = body.match(/^([A-Za-z_][\w.:-]*)/);

    if (!nameMatch) {
      throw xmlError('Invalid XML element name', index);
    }

    const name = nameMatch[1];
    const rawAttributes = parseAttributes(body.slice(name.length), index);
    const parentNamespaces = stack.at(-1)?.namespaceMap || { xml: 'http://www.w3.org/XML/1998/namespace' };
    const namespaceMap = { ...parentNamespaces };

    rawAttributes.forEach(attribute => {
      if (attribute.name === 'xmlns') {
        namespaceMap[''] = attribute.value;
      } else if (attribute.name.startsWith('xmlns:')) {
        namespaceMap[attribute.name.slice(6)] = attribute.value;
      }
    });

    const qualified = splitQualifiedName(name);
    const node = {
      type: 'element',
      name,
      prefix: qualified.prefix,
      localName: qualified.localName,
      namespaceUri: namespaceMap[qualified.prefix] || '',
      namespaceMap,
      namespaceDeclarations: rawAttributes.filter(attribute => (
        attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:')
      )),
      attributes: [],
      children: [],
      parent: stack.at(-1) || null,
      preserveSpace: false
    };
    const attributeKeys = new Set();

    rawAttributes
      .filter(attribute => attribute.name !== 'xmlns' && !attribute.name.startsWith('xmlns:'))
      .forEach(attribute => {
        const attributeName = splitQualifiedName(attribute.name);
        const namespaceUri = attributeName.prefix ? namespaceMap[attributeName.prefix] || '' : '';
        const key = `{${namespaceUri}}${attributeName.localName}`;

        if (attributeKeys.has(key)) {
          throw xmlError(`Duplicate attribute ${attribute.name}`, index);
        }

        attributeKeys.add(key);
        node.attributes.push({
          ...attribute,
          prefix: attributeName.prefix,
          localName: attributeName.localName,
          namespaceUri
        });
      });

    node.preserveSpace = (
      stack.at(-1)?.preserveSpace
      || readAttribute(node, 'space', 'http://www.w3.org/XML/1998/namespace')?.value === 'preserve'
    );

    if (node.parent) {
      node.parent.children.push(node);
    } else if (root) {
      throw xmlError('XML must contain a single root element', index);
    } else {
      root = node;
    }

    elements.push(node);

    if (!selfClosing) {
      stack.push(node);
    }

    index = end + 1;
  }

  if (stack.length > 0) {
    throw new Error(`Unclosed XML element ${stack.at(-1).name}.`);
  }

  if (!root) {
    throw new Error('XML does not contain a root element.');
  }

  return { root, elements, declaredEncoding };
}

function parseAttributes(input, sourceIndex) {
  const attributes = [];
  let index = 0;

  while (index < input.length) {
    while (/\s/.test(input[index] || '')) {
      index += 1;
    }

    if (index >= input.length) {
      break;
    }

    const nameMatch = input.slice(index).match(/^([A-Za-z_][\w.:-]*)/);
    if (!nameMatch) {
      throw xmlError('Invalid XML attribute name', sourceIndex + index);
    }

    const name = nameMatch[1];
    index += name.length;

    while (/\s/.test(input[index] || '')) {
      index += 1;
    }

    if (input[index] !== '=') {
      throw xmlError(`Attribute ${name} must have a value`, sourceIndex + index);
    }
    index += 1;

    while (/\s/.test(input[index] || '')) {
      index += 1;
    }

    const quote = input[index];
    if (quote !== '"' && quote !== "'") {
      throw xmlError(`Attribute ${name} must use quotes`, sourceIndex + index);
    }
    index += 1;
    const end = input.indexOf(quote, index);
    if (end < 0) {
      throw xmlError(`Attribute ${name} is not closed`, sourceIndex + index);
    }

    const rawValue = input.slice(index, end);
    if (rawValue.includes('<')) {
      throw xmlError(`Attribute ${name} contains an unescaped less-than sign`, sourceIndex + index);
    }

    attributes.push({
      name,
      value: decodeXmlEntities(rawValue)
    });
    index = end + 1;
  }

  return attributes;
}

function findTagEnd(text, start) {
  let quote = '';

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (quote) {
      if (character === quote) {
        quote = '';
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }

  throw xmlError('Unclosed XML start tag', start);
}

function appendText(stack, value, cdata) {
  const parent = stack.at(-1);

  if (!parent || (!parent.preserveSpace && !String(value).trim())) {
    return;
  }

  const text = parent.preserveSpace || cdata ? String(value) : String(value).trim();
  const previous = parent.children.at(-1);

  if (previous?.type === 'text') {
    previous.value += text;
  } else {
    parent.children.push({ type: 'text', value, parent });
  }
}

function decodeXmlEntities(value) {
  const source = String(value);

  if (/&(?!(?:#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);)/i.test(source)) {
    throw new Error('XML contains an invalid or unescaped ampersand.');
  }

  return source.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    const lower = entity.toLocaleLowerCase('en-GB');
    const named = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'"
    };

    if (Object.hasOwn(named, lower)) {
      return named[lower];
    }

    const codePoint = lower.startsWith('#x')
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);

    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
      throw new Error(`Invalid XML character entity &${entity};.`);
    }

    return String.fromCodePoint(codePoint);
  });
}

function splitQualifiedName(name) {
  const separator = name.indexOf(':');
  return separator < 0
    ? { prefix: '', localName: name }
    : { prefix: name.slice(0, separator), localName: name.slice(separator + 1) };
}

function readAttribute(node, localName, namespaceUri = null) {
  return node.attributes.find(attribute => (
    attribute.localName === localName
    && (namespaceUri === null || attribute.namespaceUri === namespaceUri)
  ));
}

function collectNamespaceUris(root) {
  return [...new Set(Object.values(root.namespaceMap).filter(Boolean))].sort();
}

function collectAssemblyNames(elements) {
  return [...new Set(elements.flatMap(node => (
    node.attributes
      .filter(attribute => attribute.localName === 'AssemblyQualifiedName')
      .map(attribute => attribute.value)
  )))].sort();
}

function collectWorkflowSteps(workflowNode) {
  const steps = [];

  function visit(node, depth = 0, branch = '') {
    if (node.type !== 'element') {
      return;
    }

    const nextBranch = inferBranch(node) || branch;

    if (isMeaningfulActivity(node)) {
      const assemblyName = readAttribute(node, 'AssemblyQualifiedName')?.value || '';
      const label = formatPowerPlatformDisplayName(
        readAttribute(node, 'DisplayName')?.value
        || assemblyName.split(',')[0].split('.').pop()
        || node.localName,
        node.localName
      );
      const condition = (
        node.localName === 'If'
        || node.localName === 'Switch'
        || /Condition|Decision/i.test(assemblyName)
        || /Condition|Decision/i.test(label)
      );
      const custom = Boolean(
        assemblyName
        && !/^Microsoft\.(?:Crm|Xrm)\./i.test(assemblyName)
      );

      steps.push({
        label,
        localName: node.localName,
        assemblyName,
        depth,
        branch: nextBranch,
        condition,
        custom
      });
    }

    node.children.forEach(child => {
      if (child.type === 'element') {
        visit(child, depth + (isMeaningfulActivity(node) || CONTAINER_ELEMENTS.has(node.localName) ? 1 : 0), nextBranch);
      }
    });
  }

  workflowNode.children.forEach(child => visit(child));
  return steps;
}

function isMeaningfulActivity(node) {
  if (INFRASTRUCTURE_ELEMENTS.has(node.localName) || node.localName.includes('.')) {
    return false;
  }

  if (node.localName === 'ActivityReference') {
    return true;
  }

  if (CONTAINER_ELEMENTS.has(node.localName)) {
    return false;
  }

  if (['If', 'Switch', 'While', 'DoWhile', 'ForEach', 'Assign', 'Delay', 'Persist'].includes(node.localName)) {
    return true;
  }

  return node.namespaceUri.includes('Microsoft.Crm.Workflow')
    || node.namespaceUri.includes('Microsoft.Xrm.Sdk.Workflow');
}

function inferBranch(node) {
  if (/\.Then$/i.test(node.localName)) {
    return 'yes';
  }

  if (/\.Else$/i.test(node.localName)) {
    return 'no';
  }

  const key = readAttribute(node, 'Key', XAML_NAMESPACE)?.value || '';
  return /^(then|else|default|yes|no)$/i.test(key) ? key.toLocaleLowerCase('en-GB') : '';
}

function summariseSteps(steps) {
  return {
    stepCount: steps.length,
    conditionCount: steps.filter(step => step.condition).length,
    branchCount: new Set(steps.map(step => step.branch).filter(Boolean)).size,
    customActivityCount: steps.filter(step => step.custom).length
  };
}

function flattenXmlTree(root) {
  const entries = new Map();

  function visit(node, parentPath) {
    const siblings = node.parent?.children.filter(child => (
      child.type === 'element'
      && child.localName === node.localName
      && child.namespaceUri === node.namespaceUri
    )) || [node];
    const position = siblings.indexOf(node) + 1;
    const path = `${parentPath}/${node.localName}[${position}]`;
    entries.set(path, {
      kind: 'element',
      value: `{${node.namespaceUri}}${node.localName}`
    });

    [...node.attributes]
      .sort((left, right) => (
        `${left.namespaceUri}:${left.localName}`.localeCompare(`${right.namespaceUri}:${right.localName}`, 'en-GB')
      ))
      .forEach(attribute => {
        entries.set(`${path}/@${attribute.localName}`, {
          kind: 'attribute',
          value: `{${attribute.namespaceUri}}${attribute.localName}=${attribute.value}`
        });
      });

    let textIndex = 0;
    node.children.forEach(child => {
      if (child.type === 'element') {
        visit(child, path);
      } else if (child.value !== '') {
        textIndex += 1;
        entries.set(`${path}/#text[${textIndex}]`, {
          kind: 'text',
          value: child.value
        });
      }
    });
  }

  visit(root, '');
  return entries;
}

function formatTriggerSummary(triggers = {}) {
  const labels = [
    triggers.onCreate ? 'create' : '',
    triggers.onDelete ? 'delete' : '',
    triggers.onUpdateAttributes?.length ? `update: ${triggers.onUpdateAttributes.join(', ')}` : '',
    triggers.onDemand ? 'on demand' : ''
  ].filter(Boolean);

  return labels.join('; ');
}

function escapeMermaidLabel(value) {
  return formatPowerPlatformDisplayName(value, 'Step')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, ' ')
    .replace(/[{}[\]]/g, character => `&#${character.codePointAt(0)};`);
}

function escapeMermaidEdge(value) {
  return formatPowerPlatformDisplayName(value)
    .replace(/[|<>{}[\]\r\n]/g, ' ')
    .trim();
}

function xmlError(message, index) {
  return new Error(`${message} near character ${index.toLocaleString('en-GB')}.`);
}
