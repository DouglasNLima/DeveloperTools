import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDataverseODataQuery,
  buildEndpoint,
  buildGuidedExpand,
  buildHeaders,
  buildQueryOptions,
  encodeQueryValue,
  getEndpointPreset,
  normaliseCsvList,
  normaliseExpandList,
  normaliseEntitySetName
} from '../../src/tools/dataverse-odata.js';

test('builds Dataverse endpoints with common OData query options', () => {
  const result = buildDataverseODataQuery({
    entitySetName: 'accounts',
    selectColumns: 'name, accountnumber',
    filter: 'statecode eq 0',
    orderBy: 'name asc',
    expand: 'primarycontactid($select=fullname,emailaddress1)',
    top: '5',
    includeCount: true
  });

  assert.equal(
    result.endpoint,
    '/api/data/v9.2/accounts?$select=name,accountnumber&$filter=statecode%20eq%200&$orderby=name%20asc&$expand=primarycontactid($select=fullname,emailaddress1)&$top=5&$count=true'
  );
  assert.equal(result.summary.queryOptionCount, 6);
  assert.equal(result.summary.selectCount, 2);
  assert.equal(result.summary.expandCount, 1);
  assert.match(result.fetchSnippet, /await fetch/);
});

test('builds Power Pages endpoints and merged Prefer headers', () => {
  const queryOptions = buildQueryOptions({
    select: ['name'],
    top: 10
  });
  const endpoint = buildEndpoint('accounts', 'power-pages', queryOptions);
  const headers = buildHeaders({
    includeFormattedValues: true,
    maxPageSize: 100
  });

  assert.equal(endpoint, '/_api/accounts?$select=name&$top=10');
  assert.deepEqual(headers.at(-1), {
    name: 'Prefer',
    value: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue", odata.maxpagesize=100'
  });
});

test('builds queries from reusable endpoint presets', () => {
  const preset = getEndpointPreset('power-pages-active-accounts');
  const result = buildDataverseODataQuery({
    endpointPreset: preset.value
  });

  assert.equal(preset.label, 'Power Pages Web API: active accounts');
  assert.equal(result.endpointPresetLabel, 'Power Pages Web API: active accounts');
  assert.equal(result.endpointModeLabel, 'Power Pages Web API');
  assert.equal(result.endpoint, '/_api/accounts?$select=name,accountnumber&$filter=statecode%20eq%200&$orderby=name%20asc&$top=50');
  assert.match(result.output, /Preset: Power Pages Web API: active accounts/);
});

test('builds guided expand expressions with nested query options', () => {
  const expand = buildGuidedExpand({
    relationshipName: 'primarycontactid',
    selectColumns: 'fullname, emailaddress1',
    filter: '$filter=statecode eq 0',
    orderBy: '$orderby=fullname asc'
  });

  assert.equal(
    expand,
    'primarycontactid($select=fullname,emailaddress1;$filter=statecode eq 0;$orderby=fullname asc)'
  );
  assert.throws(
    () => buildGuidedExpand({ relationshipName: 'primarycontactid' }),
    /Add at least one nested/
  );
  assert.throws(
    () => buildGuidedExpand({ relationshipName: 'primary contact', selectColumns: 'fullname' }),
    /Relationship name/
  );
});

test('normalises CSV lists and validates EntitySetName', () => {
  assert.deepEqual(normaliseCsvList('$select=name, accountnumber\nprimarycontactid'), [
    'name',
    'accountnumber',
    'primarycontactid'
  ]);
  assert.equal(normaliseEntitySetName('accounts'), 'accounts');
  assert.deepEqual(
    normaliseCsvList('primarycontactid($select=fullname,emailaddress1), ownerid($select=fullname)'),
    ['primarycontactid($select=fullname,emailaddress1)', 'ownerid($select=fullname)']
  );
  assert.deepEqual(normaliseExpandList('$expand=primarycontactid($select=fullname), ownerid'), [
    'primarycontactid($select=fullname)',
    'ownerid'
  ]);
  assert.throws(
    () => normaliseEntitySetName('accounts?$select=name'),
    /EntitySetName/
  );
});

test('emits practical warnings and validation errors', () => {
  const result = buildDataverseODataQuery({
    entitySetName: 'accounts',
    selectColumns: '*',
    filter: '$filter=statecode eq 0',
    expand: 'primarycontactid',
    orderBy: 'name',
    includeCount: true
  });

  assert.equal(result.warnings.length, 4);
  assert.match(result.output, /\$select=\*/);
  assert.throws(
    () => buildDataverseODataQuery({ entitySetName: 'accounts', top: '0' }),
    /\$top/
  );
  assert.throws(
    () => buildDataverseODataQuery({ entitySetName: 'accounts', maxPageSize: '9999' }),
    /Max page size/
  );
});

test('warns for broad expands, missing nested selects and expensive counts', () => {
  const result = buildDataverseODataQuery({
    entitySetName: 'accounts',
    selectColumns: 'name',
    expand: [
      'primarycontactid($filter=statecode eq 0)',
      'ownerid',
      'createdby($select=fullname)'
    ].join(','),
    includeCount: true
  });

  assert.equal(result.summary.expandCount, 3);
  assert.deepEqual(result.warnings, [
    'Use nested $select inside $expand where possible to keep related records small.',
    'Add nested $select inside every $expand item to avoid retrieving broad related records.',
    'Review broad $expand usage; each relationship can increase payload size and query cost.',
    '$count without a focused $filter can be expensive on large Dataverse tables.',
    '$count can be expensive on large tables; pair it with $top or a max page size where possible.'
  ]);
});

test('encodes OData values while preserving useful nested option syntax', () => {
  assert.equal(
    encodeQueryValue("primarycontactid($select=fullname;$filter=emailaddress1 ne null)"),
    "primarycontactid($select=fullname;$filter=emailaddress1%20ne%20null)"
  );
});
