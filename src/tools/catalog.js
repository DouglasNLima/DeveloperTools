export const TOOL_CATALOGUE = [
  {
    id: 'base64-to-file',
    title: 'Base64 to file',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Paste Base64 content and create a downloadable local file.',
    renderer: 'base64-to-file'
  },
  {
    id: 'file-to-base64',
    title: 'File to Base64',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Select a local file and create raw Base64 or a Data URL.',
    renderer: 'file-to-base64'
  },
  {
    id: 'image-converter',
    title: 'Image converter',
    category: 'Encoding & files',
    status: 'available',
    summary: 'Convert local SVG, PNG, JPEG and WebP images with browser-only previews and downloads.',
    renderer: 'image-converter'
  },
  {
    id: 'mermaid-editor',
    title: 'Mermaid editor & exporter',
    category: 'Charts & diagrams',
    status: 'available',
    summary: 'Validate, preview and export Mermaid diagrams locally as MMD, SVG or PNG.',
    renderer: 'mermaid-editor'
  },
  {
    id: 'mermaid-template-builder',
    title: 'Mermaid template builder',
    category: 'Charts & diagrams',
    status: 'available',
    summary: 'Generate starter Mermaid snippets for common charts and diagrams.',
    renderer: 'mermaid-template-builder'
  },
  {
    id: 'data-to-mermaid',
    title: 'Data to Mermaid',
    category: 'Charts & diagrams',
    status: 'available',
    summary: 'Turn JSON, CSV or TSV records into Mermaid tree, flowchart, ER, pie or XY diagrams.',
    renderer: 'data-to-mermaid'
  },
  {
    id: 'api-workflow-to-mermaid',
    title: 'API/workflow to Mermaid',
    category: 'Charts & diagrams',
    status: 'available',
    summary: 'Convert API requests, endpoint notes and step lists into Mermaid sequence diagrams or flowcharts.',
    renderer: 'api-workflow-to-mermaid'
  },
  {
    id: 'fetchxml-liquid-builder',
    title: 'FetchXML Formatter & Liquid Builder',
    category: 'Power Platform',
    status: 'available',
    summary: 'Format FetchXML and wrap it in a Power Pages Liquid fetchxml block.',
    renderer: 'fetchxml-liquid-builder'
  },
  {
    id: 'power-pages-web-api-snippets',
    title: 'Power Pages Web API Snippet Generator',
    category: 'Power Platform',
    status: 'available',
    summary: 'Generate local Power Pages Web API safeAjax snippets and required site setting reminders.',
    renderer: 'power-pages-web-api-snippets'
  },
  {
    id: 'power-pages-site-settings',
    title: 'Site Settings Helper',
    category: 'Power Platform',
    status: 'available',
    summary: 'Build local checklists for common Power Pages site settings.',
    renderer: 'power-pages-site-settings'
  },
  {
    id: 'power-pages-table-permissions',
    title: 'Table Permissions Checklist',
    category: 'Power Platform',
    status: 'available',
    summary: 'Review Power Pages table, privilege, web role and scope choices before publishing a page.',
    renderer: 'power-pages-table-permissions'
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
    id: 'json-formatter',
    title: 'JSON formatter/validator',
    category: 'JSON & data',
    status: 'available',
    summary: 'Format, validate, sort and minify JSON with clear parse errors.',
    renderer: 'json-formatter'
  },
  {
    id: 'json-diff',
    title: 'JSON diff',
    category: 'JSON & data',
    status: 'available',
    summary: 'Compare JSON documents with structure-aware path differences.',
    renderer: 'json-diff'
  },
  {
    id: 'json-schema-validator',
    title: 'JSON Schema validator',
    category: 'JSON & data',
    status: 'available',
    summary: 'Validate JSON against local JSON Schema rules with path-level errors.',
    renderer: 'json-schema-validator'
  },
  {
    id: 'data-explorer',
    title: 'JSON/XML data explorer',
    category: 'JSON & data',
    status: 'available',
    summary: 'Query JSON records and flatten JSON or XML into a local grid.',
    renderer: 'data-explorer'
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

export function getAvailableTools() {
  return TOOL_CATALOGUE.filter(tool => tool.status === 'available');
}

export function getDefaultTool() {
  return getAvailableTools()[0];
}

export function getToolById(id) {
  return TOOL_CATALOGUE.find(tool => tool.id === id);
}

export function getCategories() {
  return [...new Set(TOOL_CATALOGUE.map(tool => tool.category))];
}

export function matchesToolSearch(tool, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const haystack = `${tool.title} ${tool.category} ${tool.summary}`.toLowerCase();
  return haystack.includes(searchTerm.toLowerCase());
}
