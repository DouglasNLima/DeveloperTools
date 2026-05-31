import { formatBytes } from './base64.js';
import { analyseModelDrivenJavaScript, buildJavaScriptRuleSummary } from './model-driven-javascript.js';
import {
  escapeMarkdownTableCell,
  formatSolutionFileName,
  readPowerPlatformSolutionArchive,
  readZipArchive
} from './power-platform-solution.js';

const JAVASCRIPT_WEB_RESOURCE_TYPE = new Set(['3', 'script', 'javascript', 'js']);

export async function processSolutionJavaScriptEventsArchive(input, options = {}) {
  const archive = await readPowerPlatformSolutionArchive(input, options);
  const webResourceSourceEntries = await readWebResourceSourceEntries(input, options);
  const webResourceSources = parseWebResourceSourceFiles(webResourceSourceEntries);
  const model = parseSolutionJavaScriptModel(archive.sourceFiles.customizationsXml, archive.solution, webResourceSources);
  const libraryFindings = buildLibraryFindings(model.webResourceSources);
  const warnings = buildSolutionJavaScriptWarnings(model, archive.warnings);
  const reportMarkdown = buildSolutionJavaScriptEventsMarkdown({
    solution: archive.solution,
    model,
    libraryFindings,
    warnings,
    zip: archive.zip
  });
  const outputBytes = new TextEncoder().encode(reportMarkdown).length;

  return {
    solution: archive.solution,
    webResources: model.webResources,
    libraries: model.libraries,
    formHandlers: model.formHandlers,
    webResourceSources: model.webResourceSources,
    libraryFindings,
    warnings,
    reportMarkdown,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    summary: {
      webResourceCount: model.webResources.length,
      libraryCount: model.libraries.length,
      handlerCount: model.formHandlers.length,
      sourceFileCount: model.webResourceSources.length,
      libraryFindingCount: libraryFindings.reduce((count, item) => count + item.findingCount, 0),
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
    libraries: events.libraries,
    formHandlers: events.formHandlers,
    webResourceSources: events.webResourceSources,
    libraryFindings: events.libraryFindings,
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
  const libraries = Array.isArray(options.libraries) ? options.libraries : [];
  const formHandlers = Array.isArray(options.formHandlers) ? options.formHandlers : [];
  const webResourceSources = Array.isArray(options.webResourceSources) ? options.webResourceSources : [];
  const warnings = [...(options.warnings || [])];
  const sourceDependencyMap = buildWebResourceSourceDependencyMap({ webResourceSources });
  const markdown = buildDependencyMarkdown({ solution, webResources, libraries, formHandlers, sourceDependencyMap, warnings });
  const mermaid = buildDependencyMermaid({ solution, webResources, libraries, formHandlers, webResourceSources, sourceDependencyMap });
  const outputBytes = new TextEncoder().encode(`${markdown}\n\n${mermaid}`).length;

  return {
    markdown,
    mermaid,
    sourceReferences: sourceDependencyMap.references,
    warnings,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    summary: {
      webResourceCount: webResources.length,
      libraryCount: libraries.length,
      handlerCount: formHandlers.length,
      sourceFileCount: webResourceSources.length,
      sourceReferenceCount: sourceDependencyMap.references.length,
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

export function parseSolutionJavaScriptModel(customizationsXml = '', solution = {}, webResourceSources = []) {
  const webResources = parseJavaScriptWebResources(customizationsXml);
  const libraries = parseFormLibraries(customizationsXml, webResources);
  const correlatedSources = correlateWebResourceSources(webResourceSources, webResources);
  const formHandlers = correlateHandlersToLibraries(parseFormEventHandlers(customizationsXml, webResources), libraries);

  return {
    solution,
    webResources,
    libraries,
    webResourceSources: correlatedSources,
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

export function parseFormLibraries(customizationsXml = '', webResources = []) {
  const systemForms = extractXmlElementBlocks(customizationsXml, 'systemform');
  const libraries = [];

  systemForms.forEach((formBlock, formIndex) => {
    const formName = readSystemFormName(formBlock, formIndex);
    const libraryTags = matchLibraryTags(formBlock.content);

    libraryTags.forEach((libraryTag, libraryIndex) => {
      const attrs = parseXmlAttributes(libraryTag);
      const libraryName = normaliseLibraryName(firstValue(
        attrs.name,
        attrs.libraryname,
        attrs.library,
        attrs.webresourcename,
        attrs.uniqueid
      ));

      if (!libraryName) {
        return;
      }

      const matchedResource = findMatchingResource(libraryName, webResources);
      libraries.push({
        id: `library-${libraries.length + 1}`,
        formName,
        libraryName,
        matchedWebResource: matchedResource?.name || '',
        sourcePath: 'customizations.xml',
        rank: firstValue(attrs.rank, attrs.order, attrs.sequence, String(libraryIndex + 1))
      });
    });
  });

  return dedupeBy(libraries, library => `${library.formName.toLocaleLowerCase('en-GB')}::${library.libraryName.toLocaleLowerCase('en-GB')}`);
}

export function parseWebResourceSourceFiles(zipEntries = []) {
  return zipEntries
    .map((entry, index) => {
      const path = normaliseZipPath(entry.path || entry.name || '');
      const text = String(entry.text || '');
      const webResourceName = normaliseWebResourceSourceName(path);
      const lowerName = webResourceName.toLocaleLowerCase('en-GB');
      const type = lowerName.endsWith('.js') ? 'javascript' : 'html';

      return {
        id: `source-${index + 1}`,
        path,
        webResourceName,
        type,
        text,
        uncompressedSize: entry.uncompressedSize || new TextEncoder().encode(text).length
      };
    })
    .filter(source => source.path && source.webResourceName && ['javascript', 'html'].includes(source.type));
}

export function buildWebResourceSourceDependencyMap(options = {}) {
  const webResourceSources = Array.isArray(options.webResourceSources) ? options.webResourceSources : [];
  const references = [];

  webResourceSources.forEach(source => {
    const sourceName = source.webResourceName || source.path;

    extractHtmlScriptReferences(source).forEach(reference => {
      references.push({
        id: `source-reference-${references.length + 1}`,
        sourcePath: source.path,
        sourceName,
        target: reference,
        referenceType: 'html-script'
      });
    });

    extractWebResourceReferences(source.text).forEach(reference => {
      references.push({
        id: `source-reference-${references.length + 1}`,
        sourcePath: source.path,
        sourceName,
        target: reference,
        referenceType: '$webresource'
      });
    });
  });

  return {
    references: dedupeBy(references, reference => `${reference.sourceName.toLocaleLowerCase('en-GB')}::${reference.referenceType}::${reference.target.toLocaleLowerCase('en-GB')}`)
  };
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

async function readWebResourceSourceEntries(input, options = {}) {
  const bytes = await normaliseArchiveBytes(input);
  const zip = await readZipArchive(bytes, options);

  return zip.readMatchingText(path => {
    const lowerPath = normaliseZipPath(path).toLocaleLowerCase('en-GB');
    const isSourceFile = /\.(?:js|html?)$/.test(lowerPath);
    const looksLikeWebResource = lowerPath.startsWith('webresources/')
      || lowerPath.includes('/webresources/')
      || lowerPath.includes('webresource');

    return isSourceFile && looksLikeWebResource;
  });
}

function buildLibraryFindings(webResourceSources = []) {
  return webResourceSources
    .filter(source => source.type === 'javascript')
    .map(source => {
      if (!String(source.text || '').trim()) {
        return {
          id: `library-finding-${source.id}`,
          sourcePath: source.path,
          webResourceName: source.webResourceName,
          matchedWebResource: source.matchedWebResource || '',
          findings: [],
          ruleSummary: buildJavaScriptRuleSummary([]),
          findingCount: 0,
          reportMarkdown: 'No JavaScript source text was available for this exported web resource.'
        };
      }

      const analysis = analyseModelDrivenJavaScript({
        source: source.text,
        fileName: source.webResourceName || source.path
      });

      return {
        id: `library-finding-${source.id}`,
        sourcePath: source.path,
        webResourceName: source.webResourceName,
        matchedWebResource: source.matchedWebResource || '',
        findings: analysis.findings,
        ruleSummary: analysis.ruleSummary,
        findingCount: analysis.findings.length,
        reportMarkdown: analysis.reportMarkdown
      };
    });
}

function correlateWebResourceSources(webResourceSources, webResources) {
  return webResourceSources.map(source => {
    const matchedResource = findMatchingResource(source.webResourceName, webResources);

    return {
      ...source,
      matchedWebResource: matchedResource?.name || ''
    };
  });
}

function correlateHandlersToLibraries(formHandlers, libraries) {
  const libraryLookup = new Set(libraries.map(library => buildFormLibraryKey(library.formName, library.libraryName)));

  return formHandlers.map(handler => ({
    ...handler,
    libraryOnForm: handler.libraryName ? libraryLookup.has(buildFormLibraryKey(handler.formName, handler.libraryName)) : false
  }));
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

    if (handler.libraryName && !handler.libraryOnForm) {
      warnings.push(`${handler.functionName} references ${handler.libraryName}, but that library was not detected in the exported form library inventory.`);
    }
  });

  model.libraries.forEach(library => {
    const isUsed = model.formHandlers.some(handler => buildFormLibraryKey(handler.formName, handler.libraryName) === buildFormLibraryKey(library.formName, library.libraryName));

    if (!isUsed) {
      warnings.push(`${library.libraryName} is listed on ${library.formName}, but no exported form event handler references it.`);
    }
  });

  return dedupeStrings(warnings);
}

function buildSolutionJavaScriptEventsMarkdown({ solution, model, libraryFindings, warnings, zip }) {
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
    `| Form libraries | ${model.libraries.length} |`,
    `| Form event handlers | ${model.formHandlers.length} |`,
    `| Web resource source files | ${model.webResourceSources.length} |`,
    `| Per-library review findings | ${libraryFindings.reduce((count, item) => count + item.findingCount, 0)} |`,
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
    '## Library inventory',
    '',
    '| Form | Library | Matched web resource | Rank |',
    '| --- | --- | --- | ---: |',
    ...(model.libraries.length > 0
      ? model.libraries.map(library => [
        library.formName,
        library.libraryName,
        library.matchedWebResource || '-',
        library.rank || '-'
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
      : ['| No form libraries detected | - | - | - |']),
    '',
    '## Form event handlers',
    '',
    '| Form | Event | Library | Library on form | Function | Pass execution context | Enabled | Rank |',
    '| --- | --- | --- | --- | --- | --- | --- | ---: |',
    ...(model.formHandlers.length > 0
      ? model.formHandlers.map(handler => [
        handler.formName,
        handler.eventName,
        handler.libraryName || '-',
        handler.libraryName ? (handler.libraryOnForm ? 'Yes' : 'No') : '-',
        handler.functionName,
        handler.passExecutionContext ? 'Yes' : 'No',
        handler.enabled ? 'Yes' : 'No',
        handler.rank || '-'
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
      : ['| No form event handlers detected | - | - | - | - | - | - | - |']),
    '',
    '## Handler inventory',
    '',
    ...(model.formHandlers.length > 0
      ? model.formHandlers.map(handler => `- ${handler.formName}: ${handler.eventName} -> ${handler.functionName} (${handler.libraryName || 'no library'})`)
      : ['No handler inventory entries were detected from exported metadata.']),
    '',
    '## Web resource source files',
    '',
    '| Source path | Web resource name | Type | Matched metadata | Size |',
    '| --- | --- | --- | --- | ---: |',
    ...(model.webResourceSources.length > 0
      ? model.webResourceSources.map(source => [
        source.path,
        source.webResourceName,
        source.type,
        source.matchedWebResource || '-',
        source.uncompressedSize.toLocaleString('en-GB')
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
      : ['| No JavaScript or HTML web resource source files were detected | - | - | - | - |']),
    '',
    '## Per-library review findings',
    '',
    ...(libraryFindings.length > 0
      ? libraryFindings.flatMap(item => [
        `### ${item.webResourceName}`,
        '',
        `Findings: ${item.findingCount}`,
        `Matched metadata: ${item.matchedWebResource || 'No'}`,
        '',
        ...(item.findings.length > 0
          ? item.findings.slice(0, 12).map(finding => `- ${finding.ruleId}: ${finding.title} (${finding.severity}, ${finding.confidence})`)
          : ['No reviewer findings detected in this JavaScript source file.']),
        ''
      ])
      : ['No JavaScript source files were available for per-library review.']),
    '',
    '## Warnings',
    '',
    ...(warnings.length > 0 ? warnings.map(warning => `- ${warning}`) : ['No JavaScript event warnings detected from exported metadata.']),
    '',
    '## Review notes',
    '',
    '- This is an exported metadata inspection, not a live Dataverse validation.',
    '- Source-file findings are based only on JavaScript and HTML files found inside the exported solution ZIP.',
    '- Confirm each handler registration in the maker portal after import.',
    '- Keep form libraries ordered so shared namespaces load before handlers.'
  ];

  return lines.join('\n');
}

function buildDependencyMarkdown({ solution, webResources, libraries, formHandlers, sourceDependencyMap, warnings }) {
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
    '## Form libraries',
    ''
  );

  if (libraries.length === 0) {
    lines.push('No form libraries were detected from exported metadata.');
  } else {
    libraries.forEach(library => {
      lines.push(`- ${library.formName}: ${library.libraryName}${library.matchedWebResource ? '' : ' (metadata match not found)'}`);
    });
  }

  lines.push(
    '',
    '## Source file references',
    '',
    '| Source | Reference type | Target |',
    '| --- | --- | --- |'
  );

  if (sourceDependencyMap.references.length === 0) {
    lines.push('| No source-file references detected | - | - |');
  } else {
    sourceDependencyMap.references.forEach(reference => {
      lines.push([
        reference.sourceName,
        reference.referenceType,
        reference.target
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    });
  }

  lines.push(
    '',
    '## Warnings',
    '',
    ...(warnings.length > 0 ? warnings.map(warning => `- ${warning}`) : ['No dependency warnings detected.'])
  );

  return lines.join('\n');
}

function buildDependencyMermaid({ solution, webResources, libraries, formHandlers, webResourceSources, sourceDependencyMap }) {
  const lines = [
    'flowchart LR',
    `  SOL["${escapeMermaidLabel(solution.name || 'Power Platform solution')}"]`
  ];
  const resourceIds = new Map();
  const formIds = new Map();
  const sourceIds = new Map();

  webResources.forEach((resource, index) => {
    const id = `WR${index + 1}`;
    resourceIds.set(resource.name, id);
    lines.push(`  ${id}["${escapeMermaidLabel(resource.name)}"]`);
    lines.push(`  SOL --> ${id}`);
  });

  libraries.forEach((library, index) => {
    const formId = getOrCreateFormNode(library.formName, formIds, lines);
    const resourceId = getOrCreateResourceNode(library.matchedWebResource || library.libraryName, resourceIds, lines);
    lines.push(`  ${resourceId} -->|form library| ${formId}`);

    if (!library.matchedWebResource) {
      lines.push(`  LIB${index + 1}["${escapeMermaidLabel(library.libraryName)}"]`);
      lines.push(`  SOL --> LIB${index + 1}`);
    }
  });

  formHandlers.forEach((handler, index) => {
    const handlerId = `H${index + 1}`;
    const formId = getOrCreateFormNode(handler.formName, formIds, lines);
    const resourceId = resourceIds.get(handler.matchedWebResource) || getOrCreateResourceNode(handler.libraryName || 'Unknown library', resourceIds, lines);
    lines.push(`  ${handlerId}["${escapeMermaidLabel(`${handler.eventName}: ${handler.functionName}`)}"]`);
    lines.push(`  ${resourceId} --> ${handlerId}`);
    lines.push(`  ${handlerId} --> ${formId}`);
  });

  webResourceSources.forEach(source => {
    const sourceId = getOrCreateSourceNode(source, sourceIds, resourceIds, lines);
    lines.push(`  SOL --> ${sourceId}`);
  });

  sourceDependencyMap.references.forEach(reference => {
    const source = webResourceSources.find(item => item.webResourceName === reference.sourceName || item.path === reference.sourcePath);
    const sourceId = source
      ? getOrCreateSourceNode(source, sourceIds, resourceIds, lines)
      : getOrCreateResourceNode(reference.sourceName, resourceIds, lines);
    const targetId = getOrCreateResourceNode(reference.target, resourceIds, lines);
    const label = reference.referenceType === 'html-script' ? 'HTML script' : '$webresource';
    lines.push(`  ${sourceId} -->|${label}| ${targetId}`);
  });

  if (formHandlers.length === 0 && webResources.length === 0 && webResourceSources.length === 0) {
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

function getOrCreateSourceNode(source, sourceIds, resourceIds, lines) {
  if (source.matchedWebResource) {
    return getOrCreateResourceNode(source.matchedWebResource, resourceIds, lines);
  }

  const key = source.webResourceName || source.path || 'Unknown source file';

  if (!sourceIds.has(key)) {
    const id = `SRC${sourceIds.size + 1}`;
    sourceIds.set(key, id);
    lines.push(`  ${id}["${escapeMermaidLabel(key)}"]`);
  }

  return sourceIds.get(key);
}

async function normaliseArchiveBytes(input) {
  if (input instanceof Uint8Array) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  if (input && typeof input.arrayBuffer === 'function') {
    return new Uint8Array(await input.arrayBuffer());
  }

  if (Array.isArray(input)) {
    return new Uint8Array(input);
  }

  throw new Error('Choose a valid exported solution ZIP file.');
}

function readSystemFormName(formBlock, formIndex) {
  const formAttrs = parseXmlAttributes(formBlock.attributes);

  return decodeXmlEntities(firstValue(
    formAttrs.name,
    formAttrs.formname,
    formAttrs.objecttypecode,
    readXmlText(formBlock.content, 'Name'),
    readFirstXmlAttribute(formBlock.content, 'LocalizedName', 'description'),
    `Form ${formIndex + 1}`
  ));
}

function matchLibraryTags(xml) {
  const tags = [];
  const pattern = /<Library\b([^>]*)\/?>/gi;
  let match = pattern.exec(xml || '');

  while (match) {
    tags.push(match[1]);
    match = pattern.exec(xml || '');
  }

  return tags;
}

function normaliseZipPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function normaliseWebResourceSourceName(path) {
  const normalisedPath = normaliseZipPath(path);
  const match = /(?:^|\/)WebResources\/(.+)$/i.exec(normalisedPath);
  return normaliseLibraryName(match ? match[1] : normalisedPath);
}

function extractHtmlScriptReferences(source) {
  if (source.type !== 'html') {
    return [];
  }

  const references = [];
  const pattern = /<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi;
  let match = pattern.exec(source.text || '');

  while (match) {
    const target = normaliseReferenceTarget(match[2]);

    if (target && target !== source.webResourceName) {
      references.push(target);
    }

    match = pattern.exec(source.text || '');
  }

  return dedupeStrings(references);
}

function extractWebResourceReferences(text = '') {
  const references = [];
  const pattern = /\$webresource:([A-Za-z0-9_./-]+\.(?:js|html?|css|png|jpg|jpeg|gif|svg))/gi;
  let match = pattern.exec(text || '');

  while (match) {
    references.push(normaliseReferenceTarget(match[1]));
    match = pattern.exec(text || '');
  }

  return dedupeStrings(references);
}

function normaliseReferenceTarget(value) {
  const text = decodeXmlEntities(String(value || '').trim())
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\.\.\//, '')
    .replace(/^\/+/, '')
    .replace(/^WebResources\//i, '')
    .replace(/^\$webresource:/i, '');

  return normaliseLibraryName(text.split(/[?#]/)[0]);
}

function buildFormLibraryKey(formName, libraryName) {
  return `${String(formName || '').toLocaleLowerCase('en-GB')}::${normaliseLibraryName(libraryName).toLocaleLowerCase('en-GB')}`;
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
