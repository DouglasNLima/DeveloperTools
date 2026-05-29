import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDataverseODataQuery,
  buildEndpoint,
  buildHeaders,
  buildQueryOptions,
  encodeQueryValue,
  normaliseCsvList,
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

  assert.equal(result.warnings.length, 5);
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

test('encodes OData values while preserving useful nested option syntax', () => {
  assert.equal(
    encodeQueryValue("primarycontactid($select=fullname;$filter=emailaddress1 ne null)"),
    "primarycontactid($select=fullname;$filter=emailaddress1%20ne%20null)"
  );
});
