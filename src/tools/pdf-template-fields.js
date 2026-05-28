export function isPdfFieldAnnotation(annotation) {
  return Boolean(annotation && annotation.fieldName);
}

export function createPdfFieldModel({ annotation, pageNumber, viewportRect, index }) {
  const rect = normaliseViewportRect(viewportRect);
  const name = String(annotation.fieldName || '');

  return {
    id: `${pageNumber}:${annotation.id || name}:${index}`,
    name,
    type: String(annotation.fieldType || annotation.fieldTypeName || annotation.type || 'Unknown'),
    value: normaliseValue(annotation.fieldValue),
    defaultValue: normaliseValue(annotation.defaultFieldValue),
    alternativeText: String(annotation.alternativeText || ''),
    page: pageNumber,
    rect: {
      pdf: {
        x1: round(annotation.rect?.[0]),
        y1: round(annotation.rect?.[1]),
        x2: round(annotation.rect?.[2]),
        y2: round(annotation.rect?.[3])
      },
      viewport: rect
    },
    rawAnnotationId: annotation.id || ''
  };
}

export function filterPdfFields(fields, options = {}) {
  const search = String(options.search || '').trim().toLowerCase();

  return fields.filter(field => {
    if (options.hideEmpty && !field.value) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = [
      field.name,
      field.type,
      field.value,
      field.defaultValue,
      field.alternativeText,
      String(field.page)
    ].join(' ').toLowerCase();

    return haystack.includes(search);
  });
}

export function buildFieldNamesText(fields) {
  return fields.map(field => field.name).join('\n');
}

export function buildFieldsJsonExport({ fields, fileName, pageCount, exportedAtUtc = new Date().toISOString() }) {
  return JSON.stringify({
    fileName: fileName || '',
    pageCount: Number(pageCount) || 0,
    fieldCount: fields.length,
    exportedAtUtc,
    fields: fields.map(toExportField)
  }, null, 2);
}

export function buildFieldsCsvExport(fields) {
  const headers = [
    'Page',
    'Name',
    'Type',
    'Value',
    'DefaultValue',
    'AlternativeText',
    'PdfX1',
    'PdfY1',
    'PdfX2',
    'PdfY2',
    'ViewportX',
    'ViewportY',
    'ViewportWidth',
    'ViewportHeight',
    'RawAnnotationId'
  ];
  const rows = fields.map(field => [
    field.page,
    field.name,
    field.type,
    field.value,
    field.defaultValue,
    field.alternativeText,
    field.rect.pdf.x1,
    field.rect.pdf.y1,
    field.rect.pdf.x2,
    field.rect.pdf.y2,
    field.rect.viewport.x,
    field.rect.viewport.y,
    field.rect.viewport.width,
    field.rect.viewport.height,
    field.rawAnnotationId
  ]);

  return [
    headers.map(toCsvCell).join(','),
    ...rows.map(row => row.map(toCsvCell).join(','))
  ].join('\r\n');
}

export function buildPdfFieldOutputFileName(fileName, prefix, extension) {
  const base = String(fileName || prefix)
    .replace(/\.pdf$/i, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base || prefix}-${prefix}.${extension}`;
}

export function normaliseValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

export function toCsvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toExportField(field) {
  return {
    page: field.page,
    name: field.name,
    type: field.type,
    value: field.value,
    defaultValue: field.defaultValue,
    alternativeText: field.alternativeText,
    rect: field.rect,
    rawAnnotationId: field.rawAnnotationId
  };
}

function normaliseViewportRect(viewportRect) {
  if (!viewportRect) {
    return {
      x: null,
      y: null,
      width: null,
      height: null
    };
  }

  const x = Math.min(viewportRect[0], viewportRect[2]);
  const y = Math.min(viewportRect[1], viewportRect[3]);
  const width = Math.abs(viewportRect[0] - viewportRect[2]);
  const height = Math.abs(viewportRect[1] - viewportRect[3]);

  return {
    x: round(x),
    y: round(y),
    width: round(width),
    height: round(height)
  };
}

function round(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return Math.round(value * 100) / 100;
}
