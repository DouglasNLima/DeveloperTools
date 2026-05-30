export function isPdfFieldAnnotation(annotation) {
  return Boolean(annotation && Object.hasOwn(annotation, 'fieldName'));
}

export function createPdfFieldModel({ annotation, pageNumber, viewportRect, index }) {
  const rect = normaliseViewportRect(viewportRect);
  const name = String(annotation.fieldName || '');

  return {
    id: `${pageNumber}:${annotation.id || name}:${index}`,
    name,
    type: String(annotation.fieldType || annotation.fieldTypeName || annotation.type || 'Unknown'),
    required: isRequiredPdfField(annotation),
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
  const warnings = analysePdfFields(fields).warnings;

  return JSON.stringify({
    fileName: fileName || '',
    pageCount: Number(pageCount) || 0,
    fieldCount: fields.length,
    warnings,
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
    'Required',
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
    field.required ? 'Yes' : 'No',
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

export function analysePdfFields(fields) {
  const fieldList = Array.isArray(fields) ? fields : [];
  const nameCounts = new Map();

  fieldList.forEach(field => {
    const name = String(field.name || '').trim();

    if (name) {
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    }
  });

  const duplicateNames = [...nameCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort((left, right) => left.localeCompare(right, 'en-GB'));
  const unnamedFields = fieldList.filter(field => !String(field.name || '').trim());
  const suspiciousFields = fieldList.filter(isSuspiciousField);
  const requiredEmptyFields = fieldList.filter(field => field.required && !field.value);
  const warnings = [];

  if (duplicateNames.length > 0) {
    warnings.push(`Duplicate field names found: ${duplicateNames.join(', ')}.`);
  }

  if (unnamedFields.length > 0) {
    warnings.push(`${unnamedFields.length.toLocaleString('en-GB')} field${unnamedFields.length === 1 ? ' has' : 's have'} no field name.`);
  }

  if (suspiciousFields.length > 0) {
    warnings.push(`${suspiciousFields.length.toLocaleString('en-GB')} field${suspiciousFields.length === 1 ? ' has' : 's have'} suspicious type or geometry.`);
  }

  if (requiredEmptyFields.length > 0) {
    warnings.push(`${requiredEmptyFields.length.toLocaleString('en-GB')} required field${requiredEmptyFields.length === 1 ? ' is' : 's are'} empty in the template preview.`);
  }

  return {
    duplicateNames,
    unnamedFields,
    suspiciousFields,
    requiredEmptyFields,
    warnings
  };
}

export function buildPdfFieldHandoverMarkdown({
  fields,
  fileName,
  pageCount,
  reviews = {},
  exportedAtUtc = new Date().toISOString()
} = {}) {
  const fieldList = Array.isArray(fields) ? fields : [];
  const analysis = analysePdfFields(fieldList);
  const rows = fieldList.map(field => {
    const review = reviews[field.id] || {};
    const requirement = normaliseRequirement(review.requirement, field.required);

    return [
      field.page,
      field.name || '(unnamed)',
      field.type || 'Unknown',
      requirement,
      review.notes || '',
      field.alternativeText || ''
    ];
  });

  return [
    '# PDF field handover',
    '',
    `Document: ${fileName || 'Unknown PDF'}`,
    `Pages: ${(Number(pageCount) || 0).toLocaleString('en-GB')}`,
    `Fields: ${fieldList.length.toLocaleString('en-GB')}`,
    `Exported at: ${exportedAtUtc}`,
    '',
    '## Warnings',
    ...(analysis.warnings.length === 0 ? ['- None'] : analysis.warnings.map(warning => `- ${warning}`)),
    '',
    '## Field mapping',
    '| Page | Name | Type | Required | Notes | Alternative text |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.map(toMarkdownCell).join(' | ')} |`)
  ].join('\n');
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
    required: Boolean(field.required),
    value: field.value,
    defaultValue: field.defaultValue,
    alternativeText: field.alternativeText,
    rect: field.rect,
    rawAnnotationId: field.rawAnnotationId
  };
}

function isRequiredPdfField(annotation) {
  const fieldFlags = Number(annotation.fieldFlags);

  return Boolean(annotation.required || (Number.isFinite(fieldFlags) && (fieldFlags & 2) === 2));
}

function isSuspiciousField(field) {
  const type = String(field.type || '').trim().toLowerCase();
  const width = Number(field.rect?.viewport?.width);
  const height = Number(field.rect?.viewport?.height);

  return !type || type === 'unknown' || type === 'sig' || width <= 1 || height <= 1;
}

function normaliseRequirement(value, requiredFlag = false) {
  const requirement = String(value || '').trim().toLowerCase();

  if (requirement === 'required') {
    return 'Required';
  }

  if (requirement === 'optional') {
    return 'Optional';
  }

  return requiredFlag ? 'Required' : 'Unreviewed';
}

function toMarkdownCell(value) {
  const text = value === null || value === undefined ? '' : String(value);

  return text
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
    .trim() || ' ';
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
