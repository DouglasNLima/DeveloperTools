import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFieldNamesText,
  buildFieldsCsvExport,
  buildFieldsJsonExport,
  buildPdfFieldOutputFileName,
  createPdfFieldModel,
  filterPdfFields,
  isPdfFieldAnnotation,
  normaliseValue,
  toCsvCell
} from '../../src/tools/pdf-template-fields.js';

const sampleAnnotation = {
  id: 'field-1',
  fieldName: 'customer_name',
  fieldType: 'Tx',
  fieldValue: 'Contoso',
  defaultFieldValue: '',
  alternativeText: 'Customer name',
  rect: [10, 20, 210, 40]
};

test('detects PDF form field annotations', () => {
  assert.equal(isPdfFieldAnnotation(sampleAnnotation), true);
  assert.equal(isPdfFieldAnnotation({ subtype: 'Widget' }), false);
  assert.equal(isPdfFieldAnnotation(null), false);
});

test('creates a normalised field model', () => {
  const field = createPdfFieldModel({
    annotation: sampleAnnotation,
    pageNumber: 2,
    viewportRect: [10.123, 40.456, 210.987, 20.111],
    index: 0
  });

  assert.equal(field.id, '2:field-1:0');
  assert.equal(field.name, 'customer_name');
  assert.equal(field.type, 'Tx');
  assert.equal(field.value, 'Contoso');
  assert.equal(field.page, 2);
  assert.deepEqual(field.rect.viewport, {
    x: 10.12,
    y: 20.11,
    width: 200.86,
    height: 20.35
  });
});

test('normalises PDF annotation values', () => {
  assert.equal(normaliseValue(null), '');
  assert.equal(normaliseValue(['A', 'B']), 'A, B');
  assert.equal(normaliseValue({ on: true }), '{"on":true}');
  assert.equal(normaliseValue(42), '42');
});

test('filters fields by search text and empty values', () => {
  const fields = [
    createPdfFieldModel({ annotation: sampleAnnotation, pageNumber: 1, viewportRect: [0, 0, 10, 10], index: 0 }),
    createPdfFieldModel({
      annotation: { ...sampleAnnotation, id: 'field-2', fieldName: 'empty_email', fieldValue: '', alternativeText: 'Email' },
      pageNumber: 1,
      viewportRect: [0, 0, 10, 10],
      index: 1
    })
  ];

  assert.equal(filterPdfFields(fields, { search: 'customer' }).length, 1);
  assert.equal(filterPdfFields(fields, { hideEmpty: true }).length, 1);
});

test('builds names, JSON and CSV exports', () => {
  const field = createPdfFieldModel({
    annotation: { ...sampleAnnotation, fieldName: 'customer,name' },
    pageNumber: 1,
    viewportRect: [0, 0, 10, 10],
    index: 0
  });
  const json = JSON.parse(buildFieldsJsonExport({
    fields: [field],
    fileName: 'template.pdf',
    pageCount: 1,
    exportedAtUtc: '2026-05-28T00:00:00.000Z'
  }));
  const csv = buildFieldsCsvExport([field]);

  assert.equal(buildFieldNamesText([field]), 'customer,name');
  assert.equal(json.fieldCount, 1);
  assert.equal(json.fields[0].name, 'customer,name');
  assert.match(csv, /"customer,name"/);
});

test('builds safe output file names and CSV cells', () => {
  assert.equal(buildPdfFieldOutputFileName('my template.pdf', 'pdf-fields', 'json'), 'my-template-pdf-fields.json');
  assert.equal(toCsvCell('A "quoted" value'), '"A ""quoted"" value"');
});
