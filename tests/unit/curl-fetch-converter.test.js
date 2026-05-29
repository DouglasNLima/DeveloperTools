import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCurlCommand,
  buildFetchSnippet,
  convertCurlFetch,
  convertCurlToFetch,
  convertFetchToCurl,
  parseCurlTokens,
  parseFetchSnippet,
  parseHeaderLine,
  tokenizeShellCommand
} from '../../src/tools/curl-fetch-converter.js';

test('tokenises quoted cURL commands', () => {
  assert.deepEqual(
    tokenizeShellCommand("curl -X POST 'https://api.example.test/items' -H 'Content-Type: application/json' --data-raw '{\"name\":\"Contoso\"}'"),
    [
      'curl',
      '-X',
      'POST',
      'https://api.example.test/items',
      '-H',
      'Content-Type: application/json',
      '--data-raw',
      '{"name":"Contoso"}'
    ]
  );

  assert.throws(
    () => tokenizeShellCommand("curl 'https://example.test"),
    /unclosed quote/
  );
});

test('converts cURL POST JSON requests to fetch snippets', () => {
  const result = convertCurlToFetch("curl -X POST https://api.example.test/items -H 'Content-Type: application/json' --data-raw '{\"name\":\"Contoso\"}'");

  assert.equal(result.request.method, 'POST');
  assert.equal(result.request.url, 'https://api.example.test/items');
  assert.deepEqual(result.request.headers, [{ name: 'Content-Type', value: 'application/json' }]);
  assert.equal(result.request.body, '{"name":"Contoso"}');
  assert.match(result.output, /await fetch\("https:\/\/api\.example\.test\/items"/);
  assert.match(result.output, /method: "POST"/);
  assert.match(result.output, /JSON\.stringify/);
  assert.match(result.output, /"name": "Contoso"/);
});

test('defaults cURL methods and appends -G data to query strings', () => {
  const getRequest = parseCurlTokens(tokenizeShellCommand("curl 'https://api.example.test/search'"));
  const postRequest = parseCurlTokens(tokenizeShellCommand("curl https://api.example.test/items -d 'name=Contoso'"));
  const queryRequest = parseCurlTokens(tokenizeShellCommand("curl -G https://api.example.test/items -d 'q=abc' -d 'top=5'"));

  assert.equal(getRequest.method, 'GET');
  assert.equal(postRequest.method, 'POST');
  assert.equal(postRequest.body, 'name=Contoso');
  assert.equal(queryRequest.method, 'GET');
  assert.equal(queryRequest.url, 'https://api.example.test/items?q=abc&top=5');
  assert.equal(queryRequest.body, '');
});

test('adds basic auth and practical cURL warnings', () => {
  const result = convertCurlToFetch("curl -u user:pass -k -b 'sid=123' https://api.example.test/me");

  assert.equal(result.request.headers[0].name, 'Authorization');
  assert.equal(result.request.headers[0].value, 'Basic dXNlcjpwYXNz');
  assert.deepEqual(result.warnings, [
    'Basic auth credentials were embedded in the generated Authorization header.',
    'The browser fetch API cannot disable TLS certificate checks.',
    'Cookie headers are restricted by browsers; use credentials options instead when appropriate.'
  ]);
});

test('warns for JSON bodies without content type and unsupported options', () => {
  const result = convertCurlToFetch("curl https://api.example.test/items --proxy http://proxy.test --data-raw '{\"ok\":true}'");

  assert.equal(result.request.method, 'POST');
  assert.deepEqual(result.warnings, [
    '--proxy is not represented in the generated fetch snippet.',
    'JSON-looking request bodies usually need a Content-Type: application/json header.'
  ]);
});

test('parses common fetch snippets', () => {
  const request = parseFetchSnippet(`
    const response = await fetch("https://api.example.test/items", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({"name":"Updated"})
    });
  `);

  assert.equal(request.url, 'https://api.example.test/items');
  assert.equal(request.method, 'PATCH');
  assert.deepEqual(request.headers, [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Accept', value: 'application/json' }
  ]);
  assert.equal(request.body, '{"name":"Updated"}');
});

test('converts fetch snippets to cURL commands', () => {
  const result = convertFetchToCurl(`
    fetch('https://api.example.test/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({"name":"Contoso"})
    })
  `);

  assert.equal(result.request.method, 'POST');
  assert.match(result.output, /curl/);
  assert.match(result.output, /-X 'POST'/);
  assert.match(result.output, /-H 'Content-Type: application\/json'/);
  assert.match(result.output, /--data-raw '\{"name":"Contoso"\}'/);
});

test('builds cURL and fetch output helpers directly', () => {
  const request = {
    url: 'https://api.example.test/items',
    method: 'DELETE',
    headers: [{ name: 'Accept', value: 'application/json' }],
    body: '',
    warnings: []
  };

  assert.match(buildCurlCommand(request), /-X 'DELETE'/);
  assert.match(buildFetchSnippet(request), /method: "DELETE"/);
  assert.match(buildFetchSnippet(request), /"Accept": "application\/json"/);
});

test('handles validation errors', () => {
  assert.throws(
    () => convertCurlFetch({ mode: 'curl-to-fetch', input: '' }),
    /Enter cURL or fetch input/
  );
  assert.throws(
    () => convertCurlToFetch('wget https://example.test'),
    /starts with curl/
  );
  assert.throws(
    () => convertCurlToFetch('curl -H'),
    /requires a value/
  );
  assert.throws(
    () => convertFetchToCurl('const x = 1;'),
    /fetch/
  );
});

test('parses header lines safely', () => {
  assert.deepEqual(parseHeaderLine('Accept: application/json'), {
    name: 'Accept',
    value: 'application/json'
  });
  assert.equal(parseHeaderLine('not a header'), null);
});
