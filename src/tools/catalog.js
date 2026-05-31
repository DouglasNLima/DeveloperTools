export const TOOL_CATALOGUE = [
  {
    id: 'base64-file-converter',
    title: 'Base64 & File Converter',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Convert local files to Base64 and recreate files from Base64 content.',
    renderer: 'base64-file-converter',
    modes: [
      {
        id: 'base64-to-file',
        title: 'Base64 to file',
        summary: 'Create a downloadable local file from pasted Base64 content.'
      },
      {
        id: 'file-to-base64',
        title: 'File to Base64',
        summary: 'Encode a local file as raw Base64 or a Data URL.'
      }
    ],
    defaultMode: 'base64-to-file',
    legacyIds: ['base64-to-file', 'file-to-base64'],
    modeAliases: {
      'base64-to-file': 'base64-to-file',
      'file-to-base64': 'file-to-base64'
    },
    searchTerms: [
      'Base64 to file',
      'File to Base64',
      'Data URL',
      'download file'
    ]
  },
  {
    id: 'base64-to-file',
    title: 'Base64 to file',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Paste Base64 content and create a downloadable local file.',
    renderer: 'base64-to-file',
    hidden: true
  },
  {
    id: 'file-to-base64',
    title: 'File to Base64',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Select a local file and create raw Base64 or a Data URL.',
    renderer: 'file-to-base64',
    hidden: true
  },
  {
    id: 'image-converter-optimiser',
    title: 'Image Converter & Optimiser',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Convert, resize and compress local images with browser-only previews and downloads.',
    renderer: 'image-converter-optimiser',
    modes: [
      {
        id: 'convert',
        title: 'Convert',
        summary: 'Convert local SVG, PNG, JPEG and WebP images.'
      },
      {
        id: 'optimise',
        title: 'Optimise',
        summary: 'Resize and compress local images.'
      }
    ],
    defaultMode: 'convert',
    legacyIds: ['image-converter', 'image-resizer-compressor'],
    modeAliases: {
      'image-converter': 'convert',
      'image-resizer-compressor': 'optimise'
    },
    searchTerms: [
      'Image converter',
      'Image resizer & compressor',
      'resize image',
      'compress image'
    ]
  },
  {
    id: 'image-converter',
    title: 'Image converter',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Convert local SVG, PNG, JPEG and WebP images with browser-only previews and downloads.',
    renderer: 'image-converter',
    hidden: true
  },
  {
    id: 'image-resizer-compressor',
    title: 'Image resizer & compressor',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Resize and compress local images by percentage, dimensions or target file size.',
    renderer: 'image-resizer-compressor',
    hidden: true
  },
  {
    id: 'image-ocr',
    title: 'Image OCR',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Extract English text from local images with browser-only OCR.',
    renderer: 'image-ocr'
  },
  {
    id: 'mermaid-studio',
    title: 'Mermaid Studio',
    category: 'Charts & diagrams',
    status: 'available',
    summary: 'Create, validate, transform and export Mermaid diagrams from source, templates, data or API notes.',
    renderer: 'mermaid-studio',
    modes: [
      {
        id: 'editor',
        title: 'Editor',
        summary: 'Validate, preview and export Mermaid diagrams locally as MMD, SVG or PNG.'
      },
      {
        id: 'templates',
        title: 'Templates',
        summary: 'Generate starter Mermaid snippets for common charts and diagrams.'
      },
      {
        id: 'data',
        title: 'Data',
        summary: 'Turn JSON, CSV or TSV records into Mermaid diagrams.'
      },
      {
        id: 'api-workflow',
        title: 'API/workflow',
        summary: 'Convert API requests, endpoint notes and step lists into Mermaid diagrams.'
      }
    ],
    defaultMode: 'editor',
    legacyIds: [
      'mermaid-editor',
      'mermaid-template-builder',
      'data-to-mermaid',
      'api-workflow-to-mermaid'
    ],
    modeAliases: {
      'mermaid-editor': 'editor',
      'mermaid-template-builder': 'templates',
      'data-to-mermaid': 'data',
      'api-workflow-to-mermaid': 'api-workflow'
    },
    searchTerms: [
      'Mermaid editor & exporter',
      'Mermaid template builder',
      'Data to Mermaid',
      'API/workflow to Mermaid',
      'Mermaid diagram export',
      'Mermaid templates'
    ]
  },
  {
    id: 'mermaid-editor',
    title: 'Mermaid editor & exporter',
    category: 'Charts & diagrams',
    status: 'available',
    summary: 'Validate, preview and export Mermaid diagrams locally as MMD, SVG or PNG.',
    renderer: 'mermaid-editor',
    hidden: true
  },
  {
    id: 'mermaid-template-builder',
    title: 'Mermaid template builder',
    category: 'Charts & diagrams',
    status: 'available',
    summary: 'Generate starter Mermaid snippets for common charts and diagrams.',
    renderer: 'mermaid-template-builder',
    hidden: true
  },
  {
    id: 'data-to-mermaid',
    title: 'Data to Mermaid',
    category: 'Charts & diagrams',
    status: 'available',
    summary: 'Turn JSON, CSV or TSV records into Mermaid tree, flowchart, ER, pie or XY diagrams.',
    renderer: 'data-to-mermaid',
    hidden: true
  },
  {
    id: 'api-workflow-to-mermaid',
    title: 'API/workflow to Mermaid',
    category: 'Charts & diagrams',
    status: 'available',
    summary: 'Convert API requests, endpoint notes and step lists into Mermaid sequence diagrams or flowcharts.',
    renderer: 'api-workflow-to-mermaid',
    hidden: true
  },
  {
    id: 'power-pages-workbench',
    title: 'Power Pages Workbench',
    category: 'Power Platform',
    status: 'available',
    summary: 'Format FetchXML, build Web API snippets, review site settings and check table permissions.',
    renderer: 'power-pages-workbench',
    modes: [
      {
        id: 'fetchxml',
        title: 'FetchXML',
        summary: 'Format FetchXML and wrap it in a Power Pages Liquid fetchxml block.'
      },
      {
        id: 'web-api',
        title: 'Web API',
        summary: 'Generate Power Pages Web API safeAjax snippets and required site setting reminders.'
      },
      {
        id: 'site-settings',
        title: 'Site settings',
        summary: 'Build local checklists for common Power Pages site settings.'
      },
      {
        id: 'table-permissions',
        title: 'Table permissions',
        summary: 'Review Power Pages table, privilege, web role and scope choices.'
      }
    ],
    defaultMode: 'fetchxml',
    legacyIds: [
      'fetchxml-liquid-builder',
      'power-pages-web-api-snippets',
      'power-pages-site-settings',
      'power-pages-table-permissions'
    ],
    modeAliases: {
      'fetchxml-liquid-builder': 'fetchxml',
      'power-pages-web-api-snippets': 'web-api',
      'power-pages-site-settings': 'site-settings',
      'power-pages-table-permissions': 'table-permissions'
    },
    searchTerms: [
      'FetchXML Formatter & Liquid Builder',
      'Power Pages Web API Snippet Generator',
      'Site Settings Helper',
      'Table Permissions Checklist',
      'safeAjax',
      'Power Pages site settings',
      'Power Pages table permissions'
    ]
  },
  {
    id: 'fetchxml-liquid-builder',
    title: 'FetchXML Formatter & Liquid Builder',
    category: 'Power Platform',
    status: 'available',
    summary: 'Format FetchXML and wrap it in a Power Pages Liquid fetchxml block.',
    renderer: 'fetchxml-liquid-builder',
    hidden: true
  },
  {
    id: 'power-pages-web-api-snippets',
    title: 'Power Pages Web API Snippet Generator',
    category: 'Power Platform',
    status: 'available',
    summary: 'Generate local Power Pages Web API safeAjax snippets and required site setting reminders.',
    renderer: 'power-pages-web-api-snippets',
    hidden: true
  },
  {
    id: 'power-pages-site-settings',
    title: 'Site Settings Helper',
    category: 'Power Platform',
    status: 'available',
    summary: 'Build local checklists for common Power Pages site settings.',
    renderer: 'power-pages-site-settings',
    hidden: true
  },
  {
    id: 'power-pages-table-permissions',
    title: 'Table Permissions Checklist',
    category: 'Power Platform',
    status: 'available',
    summary: 'Review Power Pages table, privilege, web role and scope choices before publishing a page.',
    renderer: 'power-pages-table-permissions',
    hidden: true
  },
  {
    id: 'dataverse-odata-query-builder',
    title: 'Dataverse OData Query Builder',
    category: 'Power Platform',
    status: 'available',
    summary: 'Build Dataverse and Power Pages OData endpoints with headers, warnings and fetch snippets.',
    renderer: 'dataverse-odata-query-builder'
  },
  {
    id: 'power-platform-cli-command-builder',
    title: 'Power Platform CLI Command Builder',
    category: 'Power Platform',
    status: 'available',
    summary: 'Compose common pac auth, pac solution and pac pages commands with local checklists.',
    renderer: 'power-platform-cli-command-builder'
  },
  {
    id: 'solution-package-inspector',
    title: 'Solution Package Inspector',
    category: 'Power Platform',
    status: 'available',
    summary: 'Inspect exported Power Platform solution ZIP files for diagrams, documentation and import preflight reports.',
    renderer: 'solution-package-inspector',
    modes: [
      {
        id: 'diagrams',
        title: 'Diagrams',
        summary: 'Generate Mermaid dependency maps and component diagrams from exported solution ZIP files.'
      },
      {
        id: 'documentation',
        title: 'Documentation',
        summary: 'Generate operational Markdown documentation from exported solution ZIP files.'
      },
      {
        id: 'preflight',
        title: 'Preflight',
        summary: 'Generate import preflight reports and pac import command checklists.'
      }
    ],
    defaultMode: 'diagrams',
    legacyIds: [
      'power-platform-solution-mermaid',
      'power-platform-solution-docs',
      'power-platform-solution-import-preflight'
    ],
    modeAliases: {
      'power-platform-solution-mermaid': 'diagrams',
      'power-platform-solution-docs': 'documentation',
      'power-platform-solution-import-preflight': 'preflight'
    },
    searchTerms: [
      'Power Platform Solution Mermaid Generator',
      'Power Platform Solution Documentation Generator',
      'Power Platform Solution Import Preflight',
      'solution ZIP',
      'solution import',
      'solution documentation',
      'automation dependency map'
    ]
  },
  {
    id: 'power-platform-solution-import-preflight',
    title: 'Power Platform Solution Import Preflight',
    category: 'Power Platform',
    status: 'available',
    summary: 'Inspect exported solution ZIP files and generate local import preflight reports.',
    renderer: 'power-platform-solution-import-preflight',
    hidden: true
  },
  {
    id: 'power-platform-solution-mermaid',
    title: 'Power Platform Solution Mermaid Generator',
    category: 'Power Platform',
    status: 'available',
    summary: 'Inspect exported solution ZIP files and generate Mermaid dependency maps for automation components.',
    renderer: 'power-platform-solution-mermaid',
    hidden: true
  },
  {
    id: 'power-platform-solution-docs',
    title: 'Power Platform Solution Documentation Generator',
    category: 'Power Platform',
    status: 'available',
    summary: 'Inspect exported solution ZIP files and generate operational Markdown documentation.',
    renderer: 'power-platform-solution-docs',
    hidden: true
  },
  {
    id: 'power-automate-expression-formatter',
    title: 'Power Automate Expression Formatter',
    category: 'Power Platform',
    status: 'available',
    summary: 'Format Workflow Definition Language expressions and inspect functions locally.',
    renderer: 'power-automate-expression-formatter'
  },
  {
    id: 'power-fx-snippet-formatter',
    title: 'Power Fx Snippet Formatter',
    category: 'Power Platform',
    status: 'available',
    summary: 'Format Power Fx formulas and highlight practical sharing warnings.',
    renderer: 'power-fx-snippet-formatter'
  },
  {
    id: 'model-driven-javascript-reviewer',
    title: 'Model-driven JavaScript Reviewer',
    category: 'Power Platform',
    status: 'available',
    summary: 'Review model-driven app JavaScript for Client API, async OnSave and command-context risks.',
    renderer: 'model-driven-javascript-reviewer'
  },
  {
    id: 'client-api-migration-helper',
    title: 'Client API Migration Helper',
    category: 'Power Platform',
    status: 'available',
    summary: 'Convert Xrm.Page review notes into formContext migration guidance and handler skeletons.',
    renderer: 'client-api-migration-helper'
  },
  {
    id: 'form-event-handler-builder',
    title: 'Form Event Handler Builder',
    category: 'Power Platform',
    status: 'available',
    summary: 'Generate model-driven app OnLoad, OnSave, OnChange and subgrid handler boilerplate.',
    renderer: 'form-event-handler-builder'
  },
  {
    id: 'xrm-webapi-snippet-builder',
    title: 'Xrm.WebApi Snippet Builder',
    category: 'Power Platform',
    status: 'available',
    summary: 'Generate local model-driven app Xrm.WebApi snippets with warnings and error handling.',
    renderer: 'xrm-webapi-snippet-builder'
  },
  {
    id: 'form-notification-validation-builder',
    title: 'Form Notification & Validation Builder',
    category: 'Power Platform',
    status: 'available',
    summary: 'Build guarded form notification and validation snippets for model-driven app fields.',
    renderer: 'form-notification-validation-builder'
  },
  {
    id: 'command-bar-javascript-builder',
    title: 'Command Bar JavaScript Builder',
    category: 'Power Platform',
    status: 'available',
    summary: 'Generate JavaScript command handlers for form and grid command bars.',
    renderer: 'command-bar-javascript-builder'
  },
  {
    id: 'solution-javascript-event-inspector',
    title: 'Solution JavaScript Event Inspector',
    category: 'Power Platform',
    status: 'available',
    summary: 'Inspect exported solution ZIP files for JavaScript libraries, handlers and source findings.',
    renderer: 'solution-javascript-event-inspector'
  },
  {
    id: 'web-resource-dependency-mapper',
    title: 'Web Resource Dependency Mapper',
    category: 'Power Platform',
    status: 'available',
    summary: 'Map JavaScript web resources, handlers, forms and HTML source references from solution exports.',
    renderer: 'web-resource-dependency-mapper'
  },
  {
    id: 'url-codec',
    title: 'URL & query string helper',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Encode, decode, parse and build URLs and query strings locally.',
    renderer: 'url-codec'
  },
  {
    id: 'hash-checksums',
    title: 'Hashes/checksums',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Generate and compare local SHA hash values for text and files.',
    renderer: 'hash-checksums'
  },
  {
    id: 'json-data-workbench',
    title: 'JSON & Data Workbench',
    category: 'JSON & data',
    status: 'available',
    summary: 'Format, compare, validate and explore JSON or XML payloads locally.',
    renderer: 'json-data-workbench',
    modes: [
      {
        id: 'format',
        title: 'Format',
        summary: 'Format, validate, sort, minify and inspect JSON paths.'
      },
      {
        id: 'diff',
        title: 'Compare',
        summary: 'Compare JSON documents with structure-aware path differences.'
      },
      {
        id: 'schema',
        title: 'Schema',
        summary: 'Validate JSON against local JSON Schema rules.'
      },
      {
        id: 'explore',
        title: 'Explore',
        summary: 'Query JSON records and flatten JSON or XML into a local grid.'
      }
    ],
    defaultMode: 'format',
    legacyIds: [
      'json-formatter',
      'json-diff',
      'json-schema-validator',
      'data-explorer'
    ],
    modeAliases: {
      'json-formatter': 'format',
      'json-diff': 'diff',
      'json-schema-validator': 'schema',
      'data-explorer': 'explore'
    },
    searchTerms: [
      'JSON formatter/validator',
      'JSON diff',
      'JSON Schema validator',
      'JSON/XML data explorer',
      'Data Explorer',
      'JSON shape schema generation'
    ]
  },
  {
    id: 'json-formatter',
    title: 'JSON formatter/validator',
    category: 'JSON & data',
    status: 'available',
    summary: 'Format, validate, sort and minify JSON with clear parse errors.',
    renderer: 'json-formatter',
    hidden: true
  },
  {
    id: 'json-diff',
    title: 'JSON diff',
    category: 'JSON & data',
    status: 'available',
    summary: 'Compare JSON documents with structure-aware path differences.',
    renderer: 'json-diff',
    hidden: true
  },
  {
    id: 'json-schema-validator',
    title: 'JSON Schema validator',
    category: 'JSON & data',
    status: 'available',
    summary: 'Validate JSON against local JSON Schema rules with path-level errors.',
    renderer: 'json-schema-validator',
    hidden: true
  },
  {
    id: 'data-explorer',
    title: 'JSON/XML data explorer',
    category: 'JSON & data',
    status: 'available',
    summary: 'Query JSON records and flatten JSON or XML into a local grid.',
    renderer: 'data-explorer',
    hidden: true
  },
  {
    id: 'pdf-template-field-explorer',
    title: 'PDF Template Field Explorer',
    category: 'Documents',
    status: 'available',
    summary: 'Open local fillable PDFs, inspect form fields and export field mappings.',
    renderer: 'pdf-template-field-explorer'
  },
  {
    id: 'csv-tsv-helper',
    title: 'CSV/TSV helper',
    category: 'JSON & data',
    status: 'available',
    summary: 'Inspect delimited data, convert CSV/TSV and spot row issues.',
    renderer: 'csv-tsv-helper'
  },
  {
    id: 'jwt-decoder',
    title: 'JWT Decoder & Claims Inspector',
    category: 'Web/API',
    status: 'available',
    summary: 'Decode JWT headers and payload claims locally with expiry insight and verification warnings.',
    renderer: 'jwt-decoder'
  },
  {
    id: 'cron-rrule-builder',
    title: 'Cron / RRULE Builder',
    category: 'Web/API',
    status: 'available',
    summary: 'Build guided cron expressions, RRULE snippets and timezone warnings for recurring jobs.',
    renderer: 'cron-rrule-builder'
  },
  {
    id: 'curl-fetch-converter',
    title: 'cURL/fetch converter',
    category: 'Web/API',
    status: 'available',
    summary: 'Convert common cURL commands into fetch snippets and back.',
    renderer: 'curl-fetch-converter'
  },
  {
    id: 'regex-tester',
    title: 'Regex Tester',
    category: 'Text utilities',
    status: 'available',
    summary: 'Test regular expressions locally with matches, groups and highlighted text.',
    renderer: 'regex-tester'
  },
  {
    id: 'markdown-workbench',
    title: 'Markdown Workbench',
    category: 'Text utilities',
    status: 'available',
    summary: 'Preview Markdown, inspect references and format or convert Markdown tables locally.',
    renderer: 'markdown-workbench',
    modes: [
      {
        id: 'preview',
        title: 'Preview',
        summary: 'Preview Markdown and inspect headings, references and Mermaid fences.'
      },
      {
        id: 'tables',
        title: 'Tables',
        summary: 'Format Markdown tables and convert them to CSV or TSV.'
      }
    ],
    defaultMode: 'preview',
    legacyIds: ['markdown-preview-inspector', 'markdown-table-formatter'],
    modeAliases: {
      'markdown-preview-inspector': 'preview',
      'markdown-table-formatter': 'tables'
    },
    searchTerms: [
      'Markdown preview & inspector',
      'Markdown table formatter',
      'Mermaid diagram blocks',
      'Markdown tables'
    ]
  },
  {
    id: 'markdown-preview-inspector',
    title: 'Markdown preview & inspector',
    category: 'Text utilities',
    status: 'available',
    summary: 'Preview Markdown locally, inspect headings and references, and extract Mermaid diagram blocks.',
    renderer: 'markdown-preview-inspector',
    hidden: true
  },
  {
    id: 'markdown-table-formatter',
    title: 'Markdown table formatter',
    category: 'Text utilities',
    status: 'available',
    summary: 'Normalise Markdown tables, validate row lengths and convert tables to CSV or TSV.',
    renderer: 'markdown-table-formatter',
    hidden: true
  },
  {
    id: 'sql-query-formatter',
    title: 'SQL query formatter',
    category: 'Text utilities',
    status: 'available',
    summary: 'Format or linearise common SQL queries while preserving strings and comments.',
    renderer: 'sql-query-formatter'
  },
  {
    id: 'support-pack-sanitiser',
    title: 'Support Pack Sanitiser',
    category: 'Text utilities',
    status: 'available',
    summary: 'Mask sensitive values in logs, payloads, config snippets and stack traces before sharing.',
    renderer: 'support-pack-sanitiser'
  },
  {
    id: 'text-diff',
    title: 'Text diff',
    category: 'Text utilities',
    status: 'available',
    summary: 'Compare plain text snippets locally with line-level changes.',
    renderer: 'text-diff'
  },
  {
    id: 'html-cleaner-converter',
    title: 'HTML cleaner/converter',
    category: 'Text utilities',
    status: 'available',
    summary: 'Remove HTML tags or convert common HTML into Markdown locally.',
    renderer: 'html-cleaner-converter'
  },
  {
    id: 'case-converter',
    title: 'Case converter',
    category: 'Text utilities',
    status: 'available',
    summary: 'Convert text between common casing styles used in code.',
    renderer: 'case-converter'
  },
  {
    id: 'uuid-generator',
    title: 'UUID generator',
    category: 'Text utilities',
    status: 'available',
    summary: 'Generate, restore and validate UUIDs in the browser.',
    renderer: 'uuid-generator'
  }
];

export function getVisibleTools(catalogue = TOOL_CATALOGUE) {
  return catalogue.filter(tool => !tool.hidden);
}

export function getAvailableTools(catalogue = TOOL_CATALOGUE) {
  return getVisibleTools(catalogue).filter(tool => tool.status === 'available');
}

export function getDefaultTool(catalogue = TOOL_CATALOGUE) {
  return getAvailableTools(catalogue)[0];
}

export function getToolById(id, catalogue = TOOL_CATALOGUE) {
  const targetId = normaliseRouteSegment(id);
  return catalogue.find(tool => tool.id === targetId);
}

export function getCategories(catalogue = TOOL_CATALOGUE) {
  return [...new Set(getVisibleTools(catalogue).map(tool => tool.category))];
}

export function matchesToolSearch(tool, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const modeText = getToolModeIds(tool)
    .map(modeId => {
      const mode = getToolMode(tool, modeId);
      return `${mode?.title || ''} ${mode?.summary || ''}`;
    })
    .join(' ');
  const haystack = [
    tool.title,
    tool.category,
    tool.summary,
    ...(Array.isArray(tool.searchTerms) ? tool.searchTerms : []),
    modeText
  ].join(' ').toLowerCase();

  return haystack.includes(searchTerm.toLowerCase());
}

export function resolveToolRoute(hashOrId, catalogue = TOOL_CATALOGUE) {
  const parsedRoute = parseToolRoute(hashOrId);

  if (!parsedRoute.toolId) {
    return null;
  }

  const visibleTools = getVisibleTools(catalogue);
  const directTool = visibleTools.find(tool => tool.id === parsedRoute.toolId);

  if (directTool) {
    return createResolvedRoute(directTool, parsedRoute.mode, parsedRoute, false);
  }

  const aliasMatch = findToolByLegacyId(parsedRoute.toolId, visibleTools);

  if (!aliasMatch) {
    return null;
  }

  return createResolvedRoute(
    aliasMatch.tool,
    parsedRoute.mode || aliasMatch.mode,
    parsedRoute,
    true
  );
}

export function buildToolHash(toolOrId, mode = '', catalogue = TOOL_CATALOGUE) {
  const tool = typeof toolOrId === 'string'
    ? getToolById(toolOrId, catalogue)
    : toolOrId;

  if (!tool?.id) {
    return '#';
  }

  const resolvedMode = resolveToolMode(tool, mode);
  const defaultMode = resolveToolMode(tool);
  const modeSuffix = resolvedMode && resolvedMode !== defaultMode ? `/${resolvedMode}` : '';

  return `#${tool.id}${modeSuffix}`;
}

export function validateToolCatalogue(catalogue = TOOL_CATALOGUE) {
  const errors = [];
  const ids = new Set();
  const visibleIds = new Set();
  const aliases = new Map();

  catalogue.forEach(tool => {
    if (!tool.id) {
      errors.push('Tool is missing an id.');
      return;
    }

    if (ids.has(tool.id)) {
      errors.push(`Duplicate tool id ${tool.id}.`);
    }

    ids.add(tool.id);

    if (!tool.hidden) {
      visibleIds.add(tool.id);
    }

    validateToolModes(errors, tool);
  });

  catalogue.forEach(tool => {
    collectToolAliases(tool).forEach(alias => {
      if (!alias) {
        errors.push(`${tool.id} has an empty alias.`);
        return;
      }

      if (visibleIds.has(alias)) {
        errors.push(`${tool.id} alias ${alias} conflicts with a visible tool id.`);
      }

      if (aliases.has(alias)) {
        errors.push(`${tool.id} alias ${alias} is already used by ${aliases.get(alias)}.`);
      } else {
        aliases.set(alias, tool.id);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

function parseToolRoute(hashOrId) {
  const trimmed = String(hashOrId ?? '').trim().replace(/^#/, '');
  const separatorIndex = trimmed.indexOf('/');

  if (separatorIndex < 0) {
    return {
      toolId: normaliseRouteSegment(trimmed),
      mode: ''
    };
  }

  return {
    toolId: normaliseRouteSegment(trimmed.slice(0, separatorIndex)),
    mode: normaliseRouteSegment(trimmed.slice(separatorIndex + 1))
  };
}

function createResolvedRoute(tool, requestedMode, parsedRoute, isAlias) {
  const mode = resolveToolMode(tool, requestedMode);
  const canonicalHash = buildToolHash(tool, mode);
  const requestedHash = `#${[
    parsedRoute.toolId,
    parsedRoute.mode
  ].filter(Boolean).join('/')}`;

  return {
    tool,
    mode,
    canonicalHash,
    requestedId: parsedRoute.toolId,
    requestedMode: parsedRoute.mode,
    isAlias,
    isCanonical: requestedHash === canonicalHash
  };
}

function findToolByLegacyId(toolId, catalogue) {
  for (const tool of catalogue) {
    const legacyIds = Array.isArray(tool.legacyIds) ? tool.legacyIds.map(normaliseRouteSegment) : [];
    const modeAliases = isPlainObject(tool.modeAliases) ? tool.modeAliases : {};
    const modeAlias = Object.entries(modeAliases).find(([alias]) => normaliseRouteSegment(alias) === toolId);

    if (legacyIds.includes(toolId)) {
      return {
        tool,
        mode: modeAlias?.[1] || ''
      };
    }

    if (modeAlias) {
      return {
        tool,
        mode: modeAlias[1]
      };
    }
  }

  return null;
}

function resolveToolMode(tool, requestedMode = '') {
  const modeIds = getToolModeIds(tool);
  const fallbackMode = tool.defaultMode || modeIds[0] || '';
  const normalisedMode = normaliseRouteSegment(requestedMode);

  if (!normalisedMode) {
    return fallbackMode;
  }

  return modeIds.includes(normalisedMode) ? normalisedMode : fallbackMode;
}

function getToolModeIds(tool) {
  return Array.isArray(tool.modes)
    ? tool.modes.map(mode => (typeof mode === 'string' ? mode : mode?.id)).filter(Boolean)
    : [];
}

function getToolMode(tool, modeId) {
  if (!Array.isArray(tool.modes)) {
    return null;
  }

  const mode = tool.modes.find(candidate => (
    typeof candidate === 'string' ? candidate === modeId : candidate?.id === modeId
  ));

  return typeof mode === 'string' ? { id: mode } : mode || null;
}

function validateToolModes(errors, tool) {
  const modeIds = getToolModeIds(tool);
  const seenModes = new Set();

  if (tool.defaultMode && !modeIds.includes(tool.defaultMode)) {
    errors.push(`${tool.id} defaultMode ${tool.defaultMode} does not match a mode.`);
  }

  modeIds.forEach(modeId => {
    if (seenModes.has(modeId)) {
      errors.push(`${tool.id} has duplicate mode ${modeId}.`);
    }

    seenModes.add(modeId);
  });

  if (Array.isArray(tool.modes)) {
    tool.modes.forEach(mode => {
      if (!normaliseRouteSegment(typeof mode === 'string' ? mode : mode?.id)) {
        errors.push(`${tool.id} has a mode without an id.`);
      }
    });
  }

  if (tool.modeAliases && !isPlainObject(tool.modeAliases)) {
    errors.push(`${tool.id} modeAliases must be an object.`);
    return;
  }

  Object.entries(tool.modeAliases || {}).forEach(([alias, mode]) => {
    const normalisedAlias = normaliseRouteSegment(alias);
    const normalisedMode = normaliseRouteSegment(mode);

    if (!normalisedAlias) {
      errors.push(`${tool.id} has an empty mode alias.`);
    }

    if (!modeIds.includes(normalisedMode)) {
      errors.push(`${tool.id} mode alias ${normalisedAlias || alias} references unknown mode ${normalisedMode || mode}.`);
    }
  });
}

function collectToolAliases(tool) {
  return [...new Set([
    ...(Array.isArray(tool.legacyIds) ? tool.legacyIds : []),
    ...(isPlainObject(tool.modeAliases) ? Object.keys(tool.modeAliases) : [])
  ].map(normaliseRouteSegment))];
}

function normaliseRouteSegment(value) {
  return String(value ?? '').trim().replace(/^#/, '');
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
