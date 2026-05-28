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
    status: 'planned',
    summary: 'Build checklists for common Power Pages site settings without connecting to a tenant.'
  },
  {
    id: 'power-pages-table-permissions',
    title: 'Table Permissions Checklist',
    category: 'Power Platform',
    status: 'planned',
    summary: 'Review Power Pages table, operation, web role and scope choices before publishing a page.'
  },
  {
    id: 'url-codec',
    title: 'URL encode/decode',
    category: 'Encoding & files',
    status: 'planned',
    summary: 'Encode, decode and inspect URL components without leaving the browser.'
  },
  {
    id: 'hash-checksums',
    title: 'Hashes/checksums',
    category: 'Encoding & files',
    status: 'planned',
    summary: 'Generate local SHA and checksum values for text and files.'
  },
  {
    id: 'json-formatter',
    title: 'JSON formatter/validator',
    category: 'JSON & data',
    status: 'planned',
    summary: 'Format, validate and minify JSON with clear parse errors.'
  },
  {
    id: 'json-diff',
    title: 'JSON diff',
    category: 'JSON & data',
    status: 'planned',
    summary: 'Compare JSON documents with structure-aware differences.'
  },
  {
    id: 'csv-tsv-helper',
    title: 'CSV/TSV helper',
    category: 'JSON & data',
    status: 'planned',
    summary: 'Inspect delimited data, convert between formats and spot row issues.'
  },
  {
    id: 'jwt-decoder',
    title: 'JWT decoder',
    category: 'Web/API',
    status: 'planned',
    summary: 'Decode JWT headers and payloads locally, with expiry and claims inspection.'
  },
  {
    id: 'query-string-builder',
    title: 'Query string builder',
    category: 'Web/API',
    status: 'planned',
    summary: 'Build, parse and sort query strings for API work.'
  },
  {
    id: 'curl-fetch-converter',
    title: 'cURL/fetch converter',
    category: 'Web/API',
    status: 'planned',
    summary: 'Convert common cURL commands into fetch snippets and back.'
  },
  {
    id: 'regex-tester',
    title: 'Regex tester',
    category: 'Text utilities',
    status: 'planned',
    summary: 'Test expressions against sample text with match group feedback.'
  },
  {
    id: 'text-diff',
    title: 'Text diff',
    category: 'Text utilities',
    status: 'planned',
    summary: 'Compare plain text snippets locally with line-level changes.'
  },
  {
    id: 'case-converter',
    title: 'Case converter',
    category: 'Text utilities',
    status: 'planned',
    summary: 'Convert text between common casing styles used in code.'
  },
  {
    id: 'uuid-generator',
    title: 'UUID generator',
    category: 'Text utilities',
    status: 'planned',
    summary: 'Generate and validate UUIDs in the browser.'
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
