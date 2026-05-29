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
    id: 'curl-fetch-converter',
    title: 'cURL/fetch converter',
    category: 'Web/API',
    status: 'planned',
    summary: 'Convert common cURL commands into fetch snippets and back.'
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
    id: 'text-diff',
    title: 'Text diff',
    category: 'Text utilities',
    status: 'available',
    summary: 'Compare plain text snippets locally with line-level changes.',
    renderer: 'text-diff'
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
    summary: 'Generate and validate UUIDs in the browser.',
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
