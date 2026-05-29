import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFilters,
  applySort,
  flattenRecord,
  getValueAtPath,
  parsePathSegments,
  processDataExplorer,
  resolveJsonRecords
} from '../../src/tools/data-explorer.js';

const sampleRecords = [
  {
    name: 'Ada Lovelace',
    status: 'active',
    age: 36,
    address: { city: 'London' },
    tags: ['maths', 'notes'],
    hidden: 'kept'
  },
  {
    name: 'Grace Hopper',
    status: 'active',
    age: 85,
    address: { city: 'Arlington' },
    tags: ['navy']
  },
  {
    name: 'Katherine Johnson',
    status: 'retired',
    age: 101,
    address: { city: '' },
    tags: []
  }
];

test('queries JSON records with filters, sorting, grid columns and full-record JSON output', () => {
  const result = processDataExplorer({
    input: JSON.stringify(sampleRecords),
    filters: [
      { field: 'status', operator: 'equals', value: 'active' }
    ],
    sort: {
      field: 'age',
      direction: 'desc'
    },
    selectedColumns: 'name, address.city'
  });

  assert.equal(result.inputFormat, 'json');
  assert.equal(result.recordPath, '$');
  assert.equal(result.sourceCount, 3);
  assert.equal(result.filteredCount, 2);
  assert.equal(result.matchedCount, 2);
  assert.deepEqual(result.outputRecords.map(record => record.name), ['Grace Hopper', 'Ada Lovelace']);
  assert.deepEqual(result.gridColumns, ['name', 'address.city']);
  assert.deepEqual(result.gridRows[0], {
    name: 'Grace Hopper',
    'address.city': 'Arlington'
  });
  assert.match(result.outputJson, /"hidden": "kept"/);
  assert.equal(result.warnings.length, 0);
});

test('auto-detects common wrapper paths and supports manual bracket paths', () => {
  const auto = resolveJsonRecords({
    data: {
      records: sampleRecords
    }
  });

  assert.equal(auto.recordPath, '$.data.records');
  assert.equal(auto.records.length, 3);
  assert.match(auto.warnings[0], /auto-detected/);

  const manual = resolveJsonRecords({
    batches: [
      { rows: [] },
      { rows: sampleRecords }
    ]
  }, 'batches[1].rows');

  assert.equal(manual.recordPath, '$.batches[1].rows');
  assert.equal(manual.records[0].name, 'Ada Lovelace');
});

test('reports validation errors for JSON input, record paths and limits', () => {
  assert.throws(
    () => processDataExplorer({ input: '{bad json}' }),
    /JSON parse error/
  );
  assert.throws(
    () => processDataExplorer({ input: '{"name":"Ada"}' }),
    /No JSON record array/
  );
  assert.throws(
    () => processDataExplorer({ input: '{"items":{"name":"Ada"}}', recordPath: 'items' }),
    /must point to an array/
  );
  assert.throws(
    () => processDataExplorer({ input: '[]', limit: '0' }),
    /Result limit/
  );
});

test('applies the supported guided filter operators', () => {
  const filtered = applyFilters(sampleRecords, [
    { field: 'name', operator: 'contains', value: 'hopper' },
    { field: 'address.city', operator: 'starts-with', value: 'Ar' },
    { field: 'name', operator: 'ends-with', value: 'per' },
    { field: 'tags', operator: 'exists' },
    { field: 'status', operator: 'not-equals', value: 'retired' },
    { field: 'age', operator: 'greater-than', value: '80' },
    { field: 'age', operator: 'less-than', value: '90' }
  ]);

  assert.deepEqual(filtered.map(record => record.name), ['Grace Hopper']);

  const emptyCity = applyFilters(sampleRecords, [
    { field: 'address.city', operator: 'empty' }
  ]);

  assert.deepEqual(emptyCity.map(record => record.name), ['Katherine Johnson']);
});

test('sorts and limits JSON records deterministically', () => {
  const result = processDataExplorer({
    input: JSON.stringify({ items: sampleRecords }),
    sort: {
      field: 'name',
      direction: 'asc'
    },
    limit: '2'
  });

  assert.deepEqual(result.outputRecords.map(record => record.name), ['Ada Lovelace', 'Grace Hopper']);
  assert.equal(result.matchedCount, 2);
  assert.equal(result.filteredCount, 3);
  assert.match(result.warnings.join('\n'), /Result limit applied/);

  const sorted = applySort(sampleRecords, { field: 'age', direction: 'desc' });
  assert.deepEqual(sorted.map(record => record.age), [101, 85, 36]);
});

test('flattens nested values with dot paths and compact complex values', () => {
  const flattened = flattenRecord({
    account: {
      name: 'Contoso',
      address: {
        city: 'Bristol'
      }
    },
    contacts: [{ name: 'Ada' }],
    active: true,
    empty: null
  });

  assert.deepEqual(flattened, {
    'account.name': 'Contoso',
    'account.address.city': 'Bristol',
    contacts: '[{"name":"Ada"}]',
    active: 'true',
    empty: 'null'
  });
});

test('parses JSON-style record paths', () => {
  assert.deepEqual(parsePathSegments('data.items[0]["rows"]'), ['data', 'items', 0, 'rows']);
  assert.equal(
    getValueAtPath({ data: { items: [{ rows: ['first'] }] } }, 'data.items[0].rows[0]'),
    'first'
  );
});

test('warns when selected grid columns are not present', () => {
  const result = processDataExplorer({
    input: JSON.stringify(sampleRecords),
    selectedColumns: 'name,missing'
  });

  assert.deepEqual(result.gridColumns, ['name', 'missing']);
  assert.match(result.warnings.join('\n'), /Selected column not found: missing/);
});
