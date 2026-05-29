import { formatBytes } from './base64.js';

const UUID_CANONICAL_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_BRACED_PATTERN = /^\{([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}$/i;
const UUID_HYPHENLESS_PATTERN = /^[0-9a-f]{32}$/i;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const MAX_GENERATED_UUIDS = 100;

export function generateUuidBatch(options = {}) {
  const count = normaliseUuidCount(options.count);
  const uppercase = Boolean(options.uppercase);
  const braces = Boolean(options.braces);
  const uuids = [];

  for (let index = 0; index < count; index += 1) {
    uuids.push(generateUuidV4({
      uppercase,
      braces,
      randomBytes: options.randomBytes,
      index
    }));
  }

  const analysis = analyseUuidValues(uuids);
  const warnings = analysis.summary.duplicates > 0
    ? ['Generated UUIDs included duplicate values. Generate again before using them as identifiers.']
    : [];
  const output = uuids.join('\n');
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    mode: 'Generated UUIDs',
    uuids,
    records: analysis.records,
    summary: analysis.summary,
    warnings,
    output,
    outputType: 'UUID list',
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes)
  };
}

export function generateUuidV4(options = {}) {
  const bytes = getRandomBytes(options.randomBytes, options.index);
  return generateUuidFromBytes(bytes, options);
}

export function generateUuidFromBytes(inputBytes, options = {}) {
  const bytes = Uint8Array.from(inputBytes || []);

  if (bytes.length !== 16) {
    throw new Error('UUID generation requires exactly 16 random bytes.');
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const canonical = formatUuidBytes(bytes);
  const value = options.uppercase ? canonical.toLocaleUpperCase('en-GB') : canonical;

  return options.braces ? `{${value}}` : value;
}

export function validateUuidInput(input) {
  const values = splitUuidInput(input);

  if (values.length === 0) {
    throw new Error('Enter one or more UUIDs to validate.');
  }

  const analysis = analyseUuidValues(values);
  const output = formatUuidValidationReport(analysis);
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    mode: 'Validation report',
    ...analysis,
    output,
    outputType: 'Markdown report',
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes)
  };
}

export function analyseUuidValues(values) {
  const records = values.map((value, index) => analyseUuidValue(value, index + 1));
  const seen = new Map();
  let duplicates = 0;

  records.forEach(record => {
    if (!record.valid) {
      return;
    }

    if (seen.has(record.normalised)) {
      duplicates += 1;
      record.duplicate = true;
      const firstRecord = seen.get(record.normalised);
      firstRecord.duplicate = true;
      return;
    }

    seen.set(record.normalised, record);
  });

  const summary = {
    total: records.length,
    valid: records.filter(record => record.valid).length,
    invalid: records.filter(record => !record.valid).length,
    version4: records.filter(record => record.version === 4).length,
    nil: records.filter(record => record.nil).length,
    duplicates
  };
  const warnings = buildValidationWarnings(records, summary);

  return {
    records,
    summary,
    warnings
  };
}

export function analyseUuidValue(value, index = 1) {
  const raw = String(value ?? '').trim();
  const normalised = normaliseUuid(raw);

  if (!normalised.valid) {
    return {
      index,
      input: raw,
      valid: false,
      duplicate: false,
      issue: normalised.issue
    };
  }

  const version = Number.parseInt(normalised.value[14], 16);
  const variant = getUuidVariant(normalised.value[19]);
  const nil = normalised.value === NIL_UUID;
  const issues = [];

  if (!variant.rfc4122 && !nil) {
    issues.push(`Variant is ${variant.label}, not RFC 4122.`);
  }

  if (nil) {
    issues.push('Nil UUID.');
  }

  return {
    index,
    input: raw,
    valid: true,
    duplicate: false,
    normalised: normalised.value,
    format: normalised.format,
    version: nil ? null : version,
    variant: nil ? 'None' : variant.label,
    rfc4122: nil ? false : variant.rfc4122,
    nil,
    issue: issues.join(' ')
  };
}

export function normaliseUuid(value) {
  const input = String(value ?? '').trim();

  if (input === '') {
    return {
      valid: false,
      issue: 'Empty UUID value.'
    };
  }

  const bracedMatch = input.match(UUID_BRACED_PATTERN);

  if (bracedMatch) {
    return {
      valid: true,
      value: bracedMatch[1].toLocaleLowerCase('en-GB'),
      format: 'Braced canonical'
    };
  }

  if (UUID_CANONICAL_PATTERN.test(input)) {
    return {
      valid: true,
      value: input.toLocaleLowerCase('en-GB'),
      format: 'Canonical'
    };
  }

  if (UUID_HYPHENLESS_PATTERN.test(input)) {
    return {
      valid: true,
      value: insertUuidHyphens(input.toLocaleLowerCase('en-GB')),
      format: 'Hyphenless'
    };
  }

  return {
    valid: false,
    issue: 'Invalid UUID format.'
  };
}

export function splitUuidInput(input) {
  return String(input ?? '')
    .split(/[\s,;]+/)
    .map(value => value.trim())
    .filter(Boolean);
}

export function formatUuidValidationReport(analysis) {
  const lines = [
    '# UUID validation report',
    '',
    `Status: ${analysis.summary.invalid === 0 ? 'Valid' : 'Needs attention'}`,
    `Total entries: ${analysis.summary.total.toLocaleString('en-GB')}`,
    `Valid: ${analysis.summary.valid.toLocaleString('en-GB')}`,
    `Invalid: ${analysis.summary.invalid.toLocaleString('en-GB')}`,
    `Version 4: ${analysis.summary.version4.toLocaleString('en-GB')}`,
    `Nil UUIDs: ${analysis.summary.nil.toLocaleString('en-GB')}`,
    `Duplicates: ${analysis.summary.duplicates.toLocaleString('en-GB')}`,
    ...formatWarnings(analysis.warnings),
    '',
    '## Entries'
  ];

  analysis.records.forEach(record => {
    lines.push('', `### Entry ${record.index}`);
    lines.push(`Input: \`${escapeMarkdownInline(record.input)}\``);

    if (!record.valid) {
      lines.push('Status: Invalid');
      lines.push(`Issue: ${record.issue}`);
      return;
    }

    lines.push('Status: Valid');
    lines.push(`Normalised: \`${record.normalised}\``);
    lines.push(`Format: ${record.format}`);
    lines.push(`Version: ${record.version ?? 'None'}`);
    lines.push(`Variant: ${record.variant}`);
    lines.push(`Duplicate: ${record.duplicate ? 'Yes' : 'No'}`);

    if (record.issue) {
      lines.push(`Issue: ${record.issue}`);
    }
  });

  return lines.join('\n');
}

function normaliseUuidCount(value) {
  const count = Number(value || 1);

  if (!Number.isInteger(count) || count < 1 || count > MAX_GENERATED_UUIDS) {
    throw new Error(`Enter a UUID count between 1 and ${MAX_GENERATED_UUIDS}.`);
  }

  return count;
}

function getRandomBytes(randomBytes, index) {
  if (typeof randomBytes === 'function') {
    const bytes = randomBytes(16, index);
    return Uint8Array.from(bytes || []);
  }

  const bytes = new Uint8Array(16);

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random UUID generation is not available in this browser.');
  }

  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function formatUuidBytes(bytes) {
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return insertUuidHyphens(hex);
}

function insertUuidHyphens(hex) {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-');
}

function getUuidVariant(value) {
  const nibble = Number.parseInt(value, 16);

  if (nibble <= 0x7) {
    return { label: 'NCS compatibility', rfc4122: false };
  }

  if (nibble <= 0xb) {
    return { label: 'RFC 4122', rfc4122: true };
  }

  if (nibble <= 0xd) {
    return { label: 'Microsoft compatibility', rfc4122: false };
  }

  return { label: 'Future reserved', rfc4122: false };
}

function buildValidationWarnings(records, summary) {
  const warnings = [];

  if (summary.invalid > 0) {
    warnings.push('Some entries are not valid UUIDs.');
  }

  if (summary.nil > 0) {
    warnings.push('Nil UUIDs are placeholders and should not be used as unique identifiers.');
  }

  if (summary.duplicates > 0) {
    warnings.push('Duplicate UUID values were found.');
  }

  if (records.some(record => record.valid && record.format !== 'Canonical')) {
    warnings.push('Non-canonical UUID formats were normalised in the report.');
  }

  if (records.some(record => record.valid && record.issue && !record.nil)) {
    warnings.push('Some valid UUIDs use a non-RFC 4122 variant.');
  }

  return warnings;
}

function formatWarnings(warnings) {
  if (!warnings || warnings.length === 0) {
    return [];
  }

  return [
    '',
    'Warnings:',
    ...warnings.map(warning => `- ${warning}`)
  ];
}

function escapeMarkdownInline(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\r?\n/g, '\\n');
}
