import { formatBytes } from './base64.js';

export const CURL_FETCH_MODES = [
  { value: 'curl-to-fetch', label: 'cURL to fetch' },
  { value: 'fetch-to-curl', label: 'fetch to cURL' }
];

const DATA_OPTIONS = new Set(['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode']);
const HEADER_OPTIONS = new Set(['-H', '--header']);
const UNSUPPORTED_OPTIONS_WITH_VALUE = new Set([
  '--cacert',
  '--cert',
  '--connect-timeout',
  '--interface',
  '--key',
  '--max-time',
  '--proxy',
  '--resolve',
  '--retry',
  '--user-agent',
  '-A',
  '-e',
  '--referer'
]);
const UNSUPPORTED_FLAGS = new Set([
  '--http1.0',
  '--http1.1',
  '--http2',
  '--http3',
  '--ipv4',
  '--ipv6',
  '--no-buffer',
  '--path-as-is',
  '-s',
  '--silent',
  '-v',
  '--verbose'
]);

export function convertCurlFetch(options = {}) {
  const mode = normaliseMode(options.mode);
  const input = String(options.input ?? '').trim();

  if (!input) {
    throw new Error('Enter cURL or fetch input to convert.');
  }

  const result = mode === 'fetch-to-curl'
    ? convertFetchToCurl(input)
    : convertCurlToFetch(input);
  const outputBytes = new TextEncoder().encode(result.output).length;

  return {
    ...result,
    mode,
    modeLabel: CURL_FETCH_MODES.find(item => item.value === mode).label,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes)
  };
}

export function convertCurlToFetch(input) {
  const tokens = tokenizeShellCommand(input);
  const request = parseCurlTokens(tokens);
  const output = buildFetchSnippet(request);

  return {
    direction: 'cURL to fetch',
    request,
    output,
    outputType: 'JavaScript fetch snippet',
    tokenCount: tokens.length,
    warnings: request.warnings
  };
}

export function convertFetchToCurl(input) {
  const request = parseFetchSnippet(input);
  const output = buildCurlCommand(request);

  return {
    direction: 'fetch to cURL',
    request,
    output,
    outputType: 'cURL command',
    tokenCount: splitFetchLines(input).length,
    warnings: request.warnings
  };
}

export function tokenizeShellCommand(input) {
  const command = String(input ?? '')
    .replace(/\\\r?\n/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim();
  const tokens = [];
  let current = '';
  let quote = null;
  let escaped = false;

  for (const character of command) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += character;
  }

  if (escaped) {
    current += '\\';
  }

  if (quote) {
    throw new Error('The cURL command has an unclosed quote.');
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

export function parseCurlTokens(tokens) {
  if (tokens.length === 0 || !isCurlToken(tokens[0])) {
    throw new Error('Enter a cURL command that starts with curl.');
  }

  const request = {
    url: '',
    method: '',
    headers: [],
    body: '',
    warnings: []
  };
  let useGetWithData = false;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === '--url') {
      request.url = requireNextToken(tokens, index, '--url');
      index += 1;
      continue;
    }

    if (token.startsWith('--url=')) {
      request.url = token.slice('--url='.length);
      continue;
    }

    if (token === '-X' || token === '--request') {
      request.method = requireNextToken(tokens, index, token).toLocaleUpperCase('en-GB');
      index += 1;
      continue;
    }

    if (token.startsWith('--request=')) {
      request.method = token.slice('--request='.length).toLocaleUpperCase('en-GB');
      continue;
    }

    if (HEADER_OPTIONS.has(token)) {
      addHeader(request, requireNextToken(tokens, index, token));
      index += 1;
      continue;
    }

    if (token.startsWith('--header=')) {
      addHeader(request, token.slice('--header='.length));
      continue;
    }

    if (DATA_OPTIONS.has(token)) {
      appendBody(request, requireNextToken(tokens, index, token));
      index += 1;
      continue;
    }

    if ([...DATA_OPTIONS].some(option => token.startsWith(`${option}=`))) {
      appendBody(request, token.slice(token.indexOf('=') + 1));
      continue;
    }

    if (token === '-u' || token === '--user') {
      addBasicAuthHeader(request, requireNextToken(tokens, index, token));
      index += 1;
      continue;
    }

    if (token.startsWith('--user=')) {
      addBasicAuthHeader(request, token.slice('--user='.length));
      continue;
    }

    if (token === '-I' || token === '--head') {
      request.method = 'HEAD';
      continue;
    }

    if (token === '-G' || token === '--get') {
      useGetWithData = true;
      continue;
    }

    if (token === '-L' || token === '--location') {
      request.redirect = 'follow';
      continue;
    }

    if (token === '-k' || token === '--insecure') {
      request.warnings.push('The browser fetch API cannot disable TLS certificate checks.');
      continue;
    }

    if (token === '-b' || token === '--cookie' || token.startsWith('--cookie=')) {
      const cookieValue = token.includes('=') ? token.slice(token.indexOf('=') + 1) : requireNextToken(tokens, index, token);
      request.warnings.push('Cookie headers are restricted by browsers; use credentials options instead when appropriate.');
      request.cookie = cookieValue;
      if (!token.includes('=')) {
        index += 1;
      }
      continue;
    }

    if (UNSUPPORTED_OPTIONS_WITH_VALUE.has(token)) {
      request.warnings.push(`${token} is not represented in the generated fetch snippet.`);
      index += hasNextValue(tokens, index) ? 1 : 0;
      continue;
    }

    if (UNSUPPORTED_FLAGS.has(token)) {
      request.warnings.push(`${token} is not represented in the generated fetch snippet.`);
      continue;
    }

    if (token.startsWith('-')) {
      request.warnings.push(`${token} is not currently supported by this converter.`);
      continue;
    }

    if (!request.url) {
      request.url = token;
      continue;
    }

    request.warnings.push(`Extra argument ignored: ${token}.`);
  }

  if (!request.url) {
    throw new Error('No request URL was found in the cURL command.');
  }

  if (useGetWithData && request.body) {
    request.url = appendQueryString(request.url, request.body);
    request.body = '';
    request.method = request.method || 'GET';
  }

  request.method = request.method || (request.body ? 'POST' : 'GET');
  warnForRestrictedHeaders(request);
  warnForJsonBody(request);

  return request;
}

export function parseFetchSnippet(input) {
  const text = String(input ?? '').trim();
  const fetchIndex = text.indexOf('fetch');

  if (fetchIndex < 0) {
    throw new Error('Enter a fetch(...) snippet to convert.');
  }

  const openIndex = text.indexOf('(', fetchIndex);
  const closeIndex = findMatchingCharacter(text, openIndex, '(', ')');

  if (openIndex < 0 || closeIndex < 0) {
    throw new Error('The fetch snippet could not be parsed.');
  }

  const args = splitTopLevel(text.slice(openIndex + 1, closeIndex), ',');
  const url = parseJavaScriptString(args[0]?.trim());

  if (!url) {
    throw new Error('The fetch URL must be a quoted string.');
  }

  const optionsText = args.slice(1).join(',').trim();
  const request = {
    url,
    method: 'GET',
    headers: [],
    body: '',
    warnings: []
  };

  if (!optionsText) {
    return request;
  }

  const objectStart = optionsText.indexOf('{');
  const objectEnd = findMatchingCharacter(optionsText, objectStart, '{', '}');

  if (objectStart < 0 || objectEnd < 0) {
    request.warnings.push('Fetch options could not be parsed; only the URL was converted.');
    return request;
  }

  const objectText = optionsText.slice(objectStart, objectEnd + 1);
  request.method = extractStringProperty(objectText, 'method')?.toLocaleUpperCase('en-GB') || 'GET';
  request.headers = extractHeadersProperty(objectText);
  request.body = extractBodyProperty(objectText);

  if (!request.body && /body\s*:/.test(objectText)) {
    request.warnings.push('A dynamic fetch body was not converted.');
  }

  return request;
}

export function buildFetchSnippet(request) {
  const optionBlocks = [`  method: ${quoteJs(request.method)}`];

  if (request.redirect) {
    optionBlocks.push(`  redirect: ${quoteJs(request.redirect)}`);
  }

  if (request.headers.length > 0) {
    optionBlocks.push([
      '  headers: {',
      ...request.headers.map((header, index) => {
        const suffix = index === request.headers.length - 1 ? '' : ',';
        return `    ${quoteJs(header.name)}: ${quoteJs(header.value)}${suffix}`;
      }),
      '  }'
    ].join('\n'));
  }

  if (request.body) {
    optionBlocks.push(`  body: ${formatFetchBody(request.body, request.headers)}`);
  }

  const lines = [
    `const response = await fetch(${quoteJs(request.url)}, {`,
    ...optionBlocks.flatMap((block, index) => {
      const suffix = index === optionBlocks.length - 1 ? '' : ',';
      const blockLines = block.split('\n');
      blockLines[blockLines.length - 1] = `${blockLines[blockLines.length - 1]}${suffix}`;
      return blockLines;
    })
  ];

  lines.push('});', '');
  lines.push('if (!response.ok) {');
  lines.push('  throw new Error(`Request failed with status ${response.status}`);');
  lines.push('}', '');
  lines.push('const contentType = response.headers.get("content-type") || "";');
  lines.push('const data = contentType.includes("application/json")');
  lines.push('  ? await response.json()');
  lines.push('  : await response.text();');
  lines.push('console.log(data);');

  return lines.join('\n');
}

export function buildCurlCommand(request) {
  const lines = ['curl'];

  if (request.method && request.method !== 'GET') {
    lines.push(`  -X ${quoteShell(request.method)}`);
  }

  lines.push(`  ${quoteShell(request.url)}`);

  request.headers.forEach(header => {
    lines.push(`  -H ${quoteShell(`${header.name}: ${header.value}`)}`);
  });

  if (request.body) {
    lines.push(`  --data-raw ${quoteShell(request.body)}`);
  }

  return lines.join(' \\\n');
}

export function parseHeaderLine(value) {
  const index = String(value).indexOf(':');

  if (index < 0) {
    return null;
  }

  const name = value.slice(0, index).trim();
  const headerValue = value.slice(index + 1).trim();

  if (!name) {
    return null;
  }

  return {
    name,
    value: headerValue
  };
}

function addHeader(request, value) {
  const header = parseHeaderLine(value);

  if (!header) {
    request.warnings.push(`Header ignored because it does not use name: value format: ${value}.`);
    return;
  }

  const existing = request.headers.find(item => item.name.toLocaleLowerCase('en-GB') === header.name.toLocaleLowerCase('en-GB'));

  if (existing) {
    existing.value = header.value;
  } else {
    request.headers.push(header);
  }
}

function addBasicAuthHeader(request, credentials) {
  const encoded = base64Encode(credentials);
  addHeader(request, `Authorization: Basic ${encoded}`);
  request.warnings.push('Basic auth credentials were embedded in the generated Authorization header.');
}

function appendBody(request, value) {
  request.body = request.body ? `${request.body}&${value}` : value;
}

function appendQueryString(url, query) {
  if (!query) {
    return url;
  }

  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}

function warnForRestrictedHeaders(request) {
  const restricted = request.headers
    .filter(header => ['cookie', 'host', 'origin', 'referer', 'user-agent'].includes(header.name.toLocaleLowerCase('en-GB')))
    .map(header => header.name);

  if (restricted.length > 0) {
    request.warnings.push(`Browser fetch may block or rewrite these headers: ${restricted.join(', ')}.`);
  }
}

function warnForJsonBody(request) {
  if (!request.body || !looksLikeJson(request.body)) {
    return;
  }

  const hasContentType = request.headers.some(header => header.name.toLocaleLowerCase('en-GB') === 'content-type');

  if (!hasContentType) {
    request.warnings.push('JSON-looking request bodies usually need a Content-Type: application/json header.');
  }
}

function formatFetchBody(body, headers) {
  const contentType = headers.find(header => header.name.toLocaleLowerCase('en-GB') === 'content-type')?.value || '';

  if (contentType.toLocaleLowerCase('en-GB').includes('application/json') && looksLikeJson(body)) {
    try {
      return `JSON.stringify(${JSON.stringify(JSON.parse(body), null, 2)})`;
    } catch {
      return quoteJs(body);
    }
  }

  return quoteJs(body);
}

function looksLikeJson(value) {
  const trimmed = String(value ?? '').trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

function extractHeadersProperty(objectText) {
  const propertyIndex = findPropertyIndex(objectText, 'headers');

  if (propertyIndex < 0) {
    return [];
  }

  const objectStart = objectText.indexOf('{', propertyIndex);
  const objectEnd = findMatchingCharacter(objectText, objectStart, '{', '}');

  if (objectStart < 0 || objectEnd < 0) {
    return [];
  }

  return parseObjectLiteralPairs(objectText.slice(objectStart + 1, objectEnd))
    .map(pair => ({ name: pair.key, value: pair.value }))
    .filter(header => header.name && header.value !== null);
}

function extractBodyProperty(objectText) {
  const propertyIndex = findPropertyIndex(objectText, 'body');

  if (propertyIndex < 0) {
    return '';
  }

  const afterColon = objectText.slice(objectText.indexOf(':', propertyIndex) + 1).trimStart();

  if (afterColon.startsWith('JSON.stringify')) {
    const openIndex = afterColon.indexOf('(');
    const closeIndex = findMatchingCharacter(afterColon, openIndex, '(', ')');

    if (openIndex >= 0 && closeIndex >= 0) {
      const payload = afterColon.slice(openIndex + 1, closeIndex).trim();

      try {
        return JSON.stringify(JSON.parse(payload));
      } catch {
        return payload;
      }
    }
  }

  const bodyString = parseJavaScriptString(afterColon);
  return bodyString || '';
}

function extractStringProperty(objectText, propertyName) {
  const propertyIndex = findPropertyIndex(objectText, propertyName);

  if (propertyIndex < 0) {
    return '';
  }

  const afterColon = objectText.slice(objectText.indexOf(':', propertyIndex) + 1).trimStart();
  return parseJavaScriptString(afterColon);
}

function parseObjectLiteralPairs(text) {
  return splitTopLevel(text, ',')
    .map(part => {
      const separatorIndex = part.indexOf(':');

      if (separatorIndex < 0) {
        return null;
      }

      const rawKey = part.slice(0, separatorIndex).trim();
      const rawValue = part.slice(separatorIndex + 1).trim();
      const key = parseJavaScriptString(rawKey) || rawKey.replace(/^['"`]|['"`]$/g, '');
      const value = parseJavaScriptString(rawValue);

      if (!key || value === '') {
        return null;
      }

      return { key, value };
    })
    .filter(Boolean);
}

function splitTopLevel(text, separator) {
  const parts = [];
  let current = '';
  let quote = null;
  let escaped = false;
  let depth = 0;

  for (const character of text) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === '\\' && quote) {
      current += character;
      escaped = true;
      continue;
    }

    if (quote) {
      current += character;

      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      current += character;
      continue;
    }

    if (character === '{' || character === '(' || character === '[') {
      depth += 1;
    }

    if (character === '}' || character === ')' || character === ']') {
      depth -= 1;
    }

    if (character === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function findMatchingCharacter(text, openIndex, openCharacter, closeCharacter) {
  if (openIndex < 0 || text[openIndex] !== openCharacter) {
    return -1;
  }

  let quote = null;
  let escaped = false;
  let depth = 0;

  for (let index = openIndex; index < text.length; index += 1) {
    const character = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === '\\' && quote) {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }

    if (character === openCharacter) {
      depth += 1;
    }

    if (character === closeCharacter) {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function parseJavaScriptString(value) {
  const text = String(value ?? '').trim();
  const quote = text[0];

  if (!['"', "'", '`'].includes(quote)) {
    return '';
  }

  let result = '';
  let escaped = false;

  for (let index = 1; index < text.length; index += 1) {
    const character = text[index];

    if (escaped) {
      result += unescapeCharacter(character);
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (character === quote) {
      return result;
    }

    result += character;
  }

  return '';
}

function findPropertyIndex(objectText, propertyName) {
  const pattern = new RegExp(`(?:^|[,\\s{])${escapeRegExp(propertyName)}\\s*:`);
  const match = objectText.match(pattern);
  return match ? match.index + match[0].indexOf(propertyName) : -1;
}

function quoteJs(value) {
  return JSON.stringify(String(value ?? ''));
}

function quoteShell(value) {
  return `'${String(value ?? '').replace(/'/g, "'\\''")}'`;
}

function base64Encode(value) {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function requireNextToken(tokens, index, option) {
  if (!hasNextValue(tokens, index)) {
    throw new Error(`${option} requires a value.`);
  }

  return tokens[index + 1];
}

function hasNextValue(tokens, index) {
  return index + 1 < tokens.length && !tokens[index + 1].startsWith('-');
}

function isCurlToken(token) {
  return /^curl(?:\.exe)?$/i.test(token);
}

function splitFetchLines(input) {
  return String(input ?? '').split(/\r\n|\r|\n/).filter(line => line.trim());
}

function normaliseMode(value) {
  return CURL_FETCH_MODES.some(mode => mode.value === value) ? value : 'curl-to-fetch';
}

function unescapeCharacter(character) {
  if (character === 'n') {
    return '\n';
  }

  if (character === 'r') {
    return '\r';
  }

  if (character === 't') {
    return '\t';
  }

  return character;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
