import { formatBytes } from './base64.js';

export const CASE_OUTPUT_FORMATS = [
  { value: 'all', label: 'All common cases' },
  { value: 'camel', label: 'camelCase' },
  { value: 'pascal', label: 'PascalCase' },
  { value: 'snake', label: 'snake_case' },
  { value: 'constant', label: 'SCREAMING_SNAKE_CASE' },
  { value: 'kebab', label: 'kebab-case' },
  { value: 'train', label: 'Train-Case' },
  { value: 'dot', label: 'dot.case' },
  { value: 'lowerWords', label: 'lower words' },
  { value: 'titleWords', label: 'Title Words' }
];

const SPECIFIC_FORMATS = CASE_OUTPUT_FORMATS.filter(format => format.value !== 'all');

export function convertCase(options = {}) {
  const input = String(options.input ?? '');

  if (input === '') {
    throw new Error('Enter text to convert.');
  }

  const outputFormat = normaliseOutputFormat(options.outputFormat);
  const convertEachLine = Boolean(options.convertEachLine);
  const records = buildConversionRecords(input, { convertEachLine });
  const wordCount = records.reduce((total, record) => total + record.words.length, 0);

  if (wordCount === 0) {
    throw new Error('No words were detected in the input.');
  }

  const warnings = buildWarnings({ input, records, convertEachLine });
  const output = outputFormat === 'all'
    ? formatCaseReport({ records, warnings, convertEachLine })
    : formatSpecificOutput(records, outputFormat, convertEachLine);
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    convertEachLine,
    mode: convertEachLine ? 'Each line' : 'Whole input',
    inputLineCount: splitLines(input).length,
    wordCount,
    records,
    warnings,
    output,
    outputFormat,
    outputType: CASE_OUTPUT_FORMATS.find(format => format.value === outputFormat).label,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    previewItems: buildPreviewItems(records, outputFormat)
  };
}

export function tokeniseWords(value) {
  const normalised = normaliseIdentifierText(value);

  if (!normalised.trim()) {
    return [];
  }

  return normalised
    .split(/\s+/)
    .map(word => word.toLocaleLowerCase('en-GB'))
    .filter(Boolean);
}

export function buildCaseConversions(words) {
  const normalisedWords = words.map(word => String(word || '').toLocaleLowerCase('en-GB')).filter(Boolean);

  return {
    camel: toCamelCase(normalisedWords),
    pascal: toPascalCase(normalisedWords),
    snake: normalisedWords.join('_'),
    constant: normalisedWords.join('_').toLocaleUpperCase('en-GB'),
    kebab: normalisedWords.join('-'),
    train: normalisedWords.map(capitaliseWord).join('-'),
    dot: normalisedWords.join('.'),
    lowerWords: normalisedWords.join(' '),
    titleWords: normalisedWords.map(capitaliseWord).join(' ')
  };
}

export function formatSpecificOutput(records, outputFormat, convertEachLine = false) {
  const format = normaliseOutputFormat(outputFormat);

  if (format === 'all') {
    return formatCaseReport({ records, warnings: [], convertEachLine });
  }

  if (convertEachLine) {
    return records.map(record => record.conversions[format] || '').join('\n');
  }

  return records[0]?.conversions[format] || '';
}

export function formatCaseReport(report) {
  const lines = [
    '# Case converter report',
    '',
    `Mode: ${report.convertEachLine ? 'Each line' : 'Whole input'}`,
    `Sections: ${report.records.length.toLocaleString('en-GB')}`,
    `Words: ${report.records.reduce((total, record) => total + record.words.length, 0).toLocaleString('en-GB')}`,
    ...formatWarnings(report.warnings),
    ''
  ];

  report.records.forEach(record => {
    lines.push(`## ${record.label}`, '');

    if (record.words.length === 0) {
      lines.push('- No words detected.', '');
      return;
    }

    SPECIFIC_FORMATS.forEach(format => {
      lines.push(`- ${format.label}: \`${escapeMarkdownInline(record.conversions[format.value])}\``);
    });

    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

export function normaliseIdentifierText(value) {
  return stripDiacritics(String(value ?? ''))
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim();
}

function buildConversionRecords(input, options) {
  if (options.convertEachLine) {
    return splitLines(input).map((line, index) => {
      const words = tokeniseWords(line);

      return {
        label: `Line ${index + 1}`,
        lineNumber: index + 1,
        source: line,
        words,
        conversions: buildCaseConversions(words)
      };
    });
  }

  const words = tokeniseWords(input);

  return [{
    label: 'Whole input',
    lineNumber: null,
    source: input,
    words,
    conversions: buildCaseConversions(words)
  }];
}

function buildPreviewItems(records, outputFormat) {
  const format = normaliseOutputFormat(outputFormat);

  if (format !== 'all') {
    return records.map(record => ({
      label: record.label,
      format: CASE_OUTPUT_FORMATS.find(item => item.value === format).label,
      value: record.conversions[format] || ''
    }));
  }

  return records.flatMap(record => (
    SPECIFIC_FORMATS.map(item => ({
      label: record.label,
      format: item.label,
      value: record.conversions[item.value] || ''
    }))
  ));
}

function buildWarnings(options) {
  const warnings = [];

  if (/[^\p{L}\p{N}_\-.\/\\\s]/u.test(options.input)) {
    warnings.push('Unsupported symbols were treated as separators.');
  }

  if (stripDiacritics(options.input) !== options.input) {
    warnings.push('Accented characters were normalised for code-friendly output.');
  }

  if (options.records.some(record => record.words[0] && /^[0-9]/.test(record.words[0]))) {
    warnings.push('Some outputs start with a number and may not be valid identifiers in every language.');
  }

  if (options.convertEachLine && options.records.some(record => record.words.length === 0)) {
    warnings.push('Empty lines were preserved.');
  }

  return warnings;
}

function toCamelCase(words) {
  if (words.length === 0) {
    return '';
  }

  return [
    words[0],
    ...words.slice(1).map(capitaliseWord)
  ].join('');
}

function toPascalCase(words) {
  return words.map(capitaliseWord).join('');
}

function capitaliseWord(word) {
  const value = String(word || '');

  if (value === '') {
    return '';
  }

  return `${value.charAt(0).toLocaleUpperCase('en-GB')}${value.slice(1)}`;
}

function splitLines(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function normaliseOutputFormat(value) {
  return CASE_OUTPUT_FORMATS.some(format => format.value === value) ? value : 'all';
}

function stripDiacritics(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function escapeMarkdownInline(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\r?\n/g, '\\n');
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
