import { formatBytes } from './base64.js';
import {
  escapeMarkdownTableCell,
  formatSolutionFileName,
  readPowerPlatformSolutionArchive
} from './power-platform-solution.js';

const JAVASCRIPT_WEB_RESOURCE_TYPE = new Set(['3', 'script', 'javascript', 'js']);

export async function processSolutionJavaScriptEventsArchive(input, options = {}) {
  const archive = await readPowerPlatformSolutionArchive(input, options);
  const model = parseSolutionJavaScriptModel(archive.sourceFiles.customizationsXml, archive.solution);
  const warnings = buildSolutionJavaScriptWarnings(model, archive.warnings);
  const reportMarkdown = buildSolutionJavaScriptEventsMarkdown({
    solution: archive.solution,
    model,
    warnings,
    zip: archive.zip
  });
  const outputBytes = new TextEncoder().encode(reportMarkdown).length;

  return {
    solution: archive.solution,
    webResources: model.webResources,
    formHandlers: model.formHandlers,
    warnings,
    reportMarkdown,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    summary: {
      webResourceCount: model.webResources.length,
      handlerCount: model.formHandlers.length,
      formCount: new Set(model.formHandlers.map(handler => handler.formName)).size,
      warningCount: warnings.length
    }
  };
}

export async function processWebResourceDependencyMapArchive(input, options = {}) {
  const events = await processSolutionJavaScriptEventsArchive(input, options);
  const dependencyMap = buildWebResourceDependencyMap({
    solution: events.solution,
    webResources: events.webResources,
    formHandlers: events.formHandlers,
    warnings: events.warnings
  });

  return {
    ...events,
    ...dependencyMap
  };
}

export function buildWebResourceDependencyMap(options = {}) {
  const solution = options.solution || { name: 'Power Platform solution' };
  const webResources = Array.isArray(options.webResources) ? options.webResources : [];
  const formHandlers = Array.isArray(options.formHandlers) ? options.formHandlers : [];
  const warnings = [...(options.warnings || [])];
  const markdown = buildDependencyMarkdown({ solution, webResources, formHandlers, warnings });
  const mermaid = buildDependencyMermaid({ solution, webResources, formHandlers });
  const outputBytes = new TextEncoder().encode(`${markdown}\n\n${mermaid}`).length;

  return {
    markdown,
    mermaid,
    warnings,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    summary: {
      webResourceCount: webResources.length,
      handlerCount: formHandlers.length,
      formCount: new Set(formHandlers.map(handler => handler.formName)).size,
      warningCount: warnings.length
    }
  };
}

export function buildSolutionJavaScriptEventsFileName(solutionName) {
  return formatSolutionFileName(solutionName, 'javascript-events', 'md');
}

export function buildWebResourceDependencyFileName(solutionName, extension = 'md') {
  return formatSolutionFileName(solutionName, extension === 'mmd' ? 'web-resource-dependencies' : 'web-resource-dependency-map', extension);
}

export function parseSolutionJavaScriptModel(customizationsXml = '', solution = {}) {
  const webResources = parseJavaScriptWebResources(customizationsXml);
  const formHandlers = parseFormEventHandlers(customizationsXml, webResources);

  return {
    solution,
    webResources,
    formHandlers
  };
}

export function parseJavaScriptWebResources(customizationsXml = '') {
  const blocks = extractXmlElementBlocks(customizationsXml, 'WebResource');
  const resources = blocks
    .map((block, index) => {
      const attrs = parseXmlAttributes(block.attributes);
      const name = firstValue(
        attrs.name,
        attrs.displayname && attrs.name,
        readXmlText(block.content, 'Name'),
        readXmlText(block.content, 'name'),
        readXmlText(block.content, 'WebResourceName')
      );
      const displayName = firstValue(
        attrs.displayname,
        attrs.displayname,
        readXmlText(block.content, 'DisplayName'),
        readXmlText(block.content, 'displayname'),
        name
      );
      const type = firstValue(
        attrs.webresourcetype,
        attrs.type,
        readXmlText(block.content, 'WebResourceType'),
        readXmlText(block.content, 'webresourcetype')
      );
      const normalisedName = normaliseLibraryName(name || displayName || `web-resource-${index + 1}.js`);

      return {
        id: firstValue(attrs.webresourceid, readXmlText(block.content, 'WebResourceId'), `web-resource-${index + 1}`),
        name: normalisedName,
        displayName: decodeXmlEntities(displayName || normalisedName),
        type: type || (normalisedName.endsWith('.js') ? '3' : ''),
        sourcePath: 'customizations.xml'
      };
    })
    .filter(resource => resource.name && isJavaScriptWebResource(resource));

  return dedupeBy(resources, resource => resource.name.toLocaleLowerCase('en-GB'));
}

export function parseFormEventHandlers(customizationsXml = '', webResources = []) {
  const systemForms = extractXmlElementBlocks(customizationsXml, 'systemform');
  const handlers = [];

  systemForms.forEach((formBlock, formIndex) => {
    const formAttrs = parseXmlAttributes(formBlock.attributes);
    const formName = firstValue(
      formAttrs.name,
      formAttrs.formname,
      formAttrs.objecttypecode,
      readXmlText(formBlock.content, 'Name'),
      readFirstXmlAttribute(formBlock.content, 'LocalizedName', 'description'),
      `Form ${formIndex + 1}`
    );
    parseEventHandlersFromXml(formBlock.content, formName, webResources)
      .forEach(handler => handlers.push(handler));
  });

  if (handlers.length === 0) {
    parseEventHandlersFromXml(customizationsXml, 'Unknown form', webResources)
      .forEach(handler => handlers.push(handler));
  }

  return handlers.map((handler, index) => ({
    ...handler,
    id: `handler-${index + 1}`
  }));
}

function parseEventHandlersFromXml(xml, formName, webResources) {
  const eventBlocks = extractXmlElementBlocks(xml, 'event');
  const handlers = [];

  eventBlocks.forEach(eventBlock => {
    const eventAttrs = parseXmlAttributes(eventBlock.attributes);
    const eventName = eventAttrs.name || eventAttrs.eventname || 'event';
    const handlerTags = matchHandlerTags(eventBlock.content);

    handlerTags.forEach(handlerTag => {
      const attrs = parseXmlAttributes(handlerTag);
      const libraryName = normaliseLibraryName(firstValue(attrs.libraryname, attrs.library, attrs.libraryuniqueid));
      const functionName = firstValue(attrs.functionname, attrs.function, attrs.handler) || 'Unknown handler';
      const matchedResource = findMatchingResource(libraryName, webResources);

      handlers.push({
        formName: decodeXmlEntities(formName || 'Unknown form'),
        eventName: decodeXmlEntities(eventName),
        functionName: decodeXmlEntities(functionName),
        libraryName,
        matchedWebResource: matchedResource?.name || '',
        enabled: normaliseBoolean(attrs.enabled, true),
        passExecutionContext: normaliseBoolean(
          firstValue(attrs.passexecutioncontext, attrs.passcontext, attrs.passexecutioncontextflag),
          false
        ),
        handlerUniqueId: firstValue(attrs.handleruniqueid, attrs.id, attrs.uniqueid),
        rank: firstValue(attrs.rank, attrs.order, attrs.sequence) || ''
      });
    });
  });

  return handlers;
}

function buildSolutionJavaScriptWarnings(model, archiveWarnings = []) {
  const warnings = [...archiveWarnings.filter(warning => !/Workflows\/\*\.json/i.test(warning))];

  if (model.webResources.length === 0) {
    warnings.push('No JavaScript web resources were detected in the exported customizations.xml metadata.');
  }

  if (model.formHandlers.length === 0) {
    warnings.push('No form JavaScript event handlers were detected in the exported metadata.');
  }

  model.formHandlers.forEach(handler => {
    if (!handler.passExecutionContext) {
      warnings.push(`${handler.formName} ${handler.eventName} ${handler.functionName} does not show Pass execution context enabled.`);
    }

    if (!handler.enabled) {
      warnings.push(`${handler.formName} ${handler.eventName} ${handler.functionName} is disabled in the exported metadata.`);
    }

    if (handler.libraryName && !handler.matchedWebResource) {
      warnings.push(`${handler.functionName} references ${handler.libraryName}, but no matching JavaScript web resource was detected.`);
    }
  });

  return dedupeStrings(warnings);
}

function buildSolutionJavaScriptEventsMarkdown({ solution, model, warnings, zip }) {
  const lines = [
    '# Model-driven JavaScript event inspection',
    '',
    `Solution: ${solution.name}`,
    `Unique name: ${solution.uniqueName}`,
    `Version: ${solution.version}`,
    '',
    '## Summary',
    '',
    '| Area | Count |',
    '| --- | ---: |',
    `| JavaScript web resources | ${model.webResources.length} |`,
    `| Form event handlers | ${model.formHandlers.length} |`,
    `| Forms with handlers | ${new Set(model.formHandlers.map(handler => handler.formName)).size} |`,
    `| Archive entries | ${zip.entryCount || 0} |`,
    `| Warnings | ${warnings.length} |`,
    '',
    '## JavaScript web resources',
    '',
    '| Name | Display name | Type | Source |',
    '| --- | --- | --- | --- |',
    ...(model.webResources.length > 0
      ? model.webResources.map(resource => [
        resource.name,
        resource.displayName,
        resource.type || '-',
        resource.sourcePath
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
      : ['| No JavaScript web resources detected | - | - | - |']),
    '',
    '## Form event handlers',
    '',
    '| Form | Event | Library | Function | Pass execution context | Enabled | Rank |',
    '| --- | --- | --- | --- | --- | --- | ---: |',
    ...(model.formHandlers.length > 0
      ? model.formHandlers.map(handler => [
        handler.formName,
        handler.eventName,
        handler.libraryName || '-',
        handler.functionName,
        handler.passExecutionContext ? 'Yes' : 'No',
        handler.enabled ? 'Yes' : 'No',
        handler.rank || '-'
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
      : ['| No form event handlers detected | - | - | - | - | - | - |']),
    '',
    '## Warnings',
    '',
    ...(warnings.length > 0 ? warnings.map(warning => `- ${warning}`) : ['No JavaScript event warnings detected from exported metadata.']),
    '',
    '## Review notes',
    '',
    '- This is an exported metadata inspection, not a live Dataverse validation.',
    '- Confirm each handler registration in the maker portal after import.',
    '- Keep form libraries ordered so shared namespaces load before handlers.'
  ];

  return lines.join('\n');
}

function buildDependencyMarkdown({ solution, webResources, formHandlers, warnings }) {
  const lines = [
    '# Web resource dependency map',
    '',
    `Solution: ${solution.name}`,
    '',
    '## Dependencies',
    '',
    '| Web resource | Handler | Form | Event |',
    '| --- | --- | --- | --- |'
  ];

  if (formHandlers.length === 0) {
    lines.push('| No dependencies detected | - | - | - |');
  } else {
    formHandlers.forEach(handler => {
      lines.push([
        handler.matchedWebResource || handler.libraryName || 'Unknown library',
        handler.functionName,
        handler.formName,
        handler.eventName
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    });
  }

  lines.push(
    '',
    '## Unused JavaScript web resources',
    ''
  );

  const used = new Set(formHandlers.map(handler => handler.matchedWebResource).filter(Boolean));
  const unused = webResources.filter(resource => !used.has(resource.name));

  if (unused.length === 0) {
    lines.push('No unused JavaScript web resources were detected from form event metadata.');
  } else {
    unused.forEach(resource => lines.push(`- ${resource.name}`));
  }

  lines.push(
    '',
    '## Warnings',
    '',
    ...(warnings.length > 0 ? warnings.map(warning => `- ${warning}`) : ['No dependency warnings detected.'])
  );

  return lines.join('\n');
}

function buildDependencyMermaid({ solution, webResources, formHandlers }) {
  const lines = [
    'flowchart LR',
    `  SOL["${escapeMermaidLabel(solution.name || 'Power Platform solution')}"]`
  ];
  const resourceIds = new Map();
  const formIds = new Map();

  webResources.forEach((resource, index) => {
    const id = `WR${index + 1}`;
    resourceIds.set(resource.name, id);
    lines.push(`  ${id}["${escapeMermaidLabel(resource.name)}"]`);
    lines.push(`  SOL --> ${id}`);
  });

  formHandlers.forEach((handler, index) => {
    const handlerId = `H${index + 1}`;
    const formId = getOrCreateFormNode(handler.formName, formIds, lines);
    const resourceId = resourceIds.get(handler.matchedWebResource) || getOrCreateResourceNode(handler.libraryName || 'Unknown library', resourceIds, lines);
    lines.push(`  ${handlerId}["${escapeMermaidLabel(`${handler.eventName}: ${handler.functionName}`)}"]`);
    lines.push(`  ${resourceId} --> ${handlerId}`);
    lines.push(`  ${handlerId} --> ${formId}`);
  });

  if (formHandlers.length === 0 && webResources.length === 0) {
    lines.push('  EMPTY["No JavaScript dependencies detected"]');
    lines.push('  SOL --> EMPTY');
  }

  return lines.join('\n');
}

function getOrCreateFormNode(formName, formIds, lines) {
  const key = formName || 'Unknown form';

  if (!formIds.has(key)) {
    const id = `FORM${formIds.size + 1}`;
    formIds.set(key, id);
    lines.push(`  ${id}["${escapeMermaidLabel(key)}"]`);
  }

  return formIds.get(key);
}

function getOrCreateResourceNode(name, resourceIds, lines) {
  const key = name || 'Unknown library';

  if (!resourceIds.has(key)) {
    const id = `WRX${resourceIds.size + 1}`;
    resourceIds.set(key, id);
    lines.push(`  ${id}["${escapeMermaidLabel(key)}"]`);
  }

  return resourceIds.get(key);
}

function isJavaScriptWebResource(resource) {
  const type = String(resource.type || '').trim().toLocaleLowerCase('en-GB');
  const name = String(resource.name || '').trim().toLocaleLowerCase('en-GB');

  return JAVASCRIPT_WEB_RESOURCE_TYPE.has(type) || name.endsWith('.js') || name.includes('/js/');
}

function findMatchingResource(libraryName, webResources) {
  const normalisedLibrary = normaliseLibraryName(libraryName).toLocaleLowerCase('en-GB');

  return webResources.find(resource => {
    const name = resource.name.toLocaleLowerCase('en-GB');
    return name === normalisedLibrary || `$webresource:${name}` === normalisedLibrary || normalisedLibrary.endsWith(name);
  }) || null;
}

function normaliseLibraryName(value) {
  return decodeXmlEntities(String(value || ''))
    .replace(/^\$webresource:/i, '')
    .replace(/^webresource:/i, '')
    .trim();
}

function matchHandlerTags(xml) {
  const tags = [];
  const pattern = /<Handler\b([^>]*)\/?>/gi;
  let match = pattern.exec(xml || '');

  while (match) {
    tags.push(match[1]);
    match = pattern.exec(xml || '');
  }

  return tags;
}

function extractXmlElementBlocks(xml, tagName) {
  const blocks = [];
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  let match = tagPattern.exec(xml || '');

  while (match) {
    const tag = match[0];

    if (tag.startsWith('</')) {
      match = tagPattern.exec(xml || '');
      continue;
    }

    if (/\/\s*>$/.test(tag)) {
      blocks.push({
        attributes: tag.replace(new RegExp(`^<${tagName}\\b`, 'i'), '').replace(/\/\s*>$/, ''),
        content: ''
      });
      match = tagPattern.exec(xml || '');
      continue;
    }

    const contentStart = match.index + tag.length;
    let depth = 1;
    let closingMatch = tagPattern.exec(xml || '');

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
          content: String(xml || '').slice(contentStart, closingMatch.index)
        });
        break;
      }

      closingMatch = tagPattern.exec(xml || '');
    }

    match = tagPattern.exec(xml || '');
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
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function normaliseBoolean(value, fallback = false) {
  const text = String(value ?? '').trim().toLocaleLowerCase('en-GB');

  if (!text) {
    return fallback;
  }

  return ['1', 'true', 'yes'].includes(text);
}

function firstValue(...values) {
  return values.find(value => String(value ?? '').trim()) || '';
}

function dedupeBy(items, readKey) {
  const seen = new Set();
  return items.filter(item => {
    const key = readKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeStrings(items) {
  return [...new Set(items.filter(Boolean))];
}

function escapeMermaidLabel(value) {
  return String(value ?? '').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
