import { formatBytes } from './base64.js';

export const TEXT_DIFF_OUTPUT_FORMATS = [
  { value: 'unified', label: 'Unified diff' },
  { value: 'markdown', label: 'Markdown report' },
  { value: 'json', label: 'JSON report' }
];

const DEFAULT_MAX_PREVIEW_ROWS = 500;

export function buildTextDiff(options = {}) {
  const leftText = String(options.leftText ?? '');
  const rightText = String(options.rightText ?? '');
  const outputFormat = normaliseOutputFormat(options.outputFormat);
  const compareOptions = {
    ignoreWhitespace: Boolean(options.ignoreWhitespace),
    ignoreCase: Boolean(options.ignoreCase)
  };
  const leftLines = splitTextLines(leftText);
  const rightLines = splitTextLines(rightText);
  const operations = buildLineOperations(leftLines, rightLines, compareOptions);
  const rows = combineChangeRows(operations);
  const summary = summariseRows(rows);
  const warnings = buildWarnings({
    leftText,
    rightText,
    leftLines,
    rightLines,
    rows,
    compareOptions
  });
  const report = {
    equal: summary.totalChanges === 0,
    options: compareOptions,
    leftLineCount: leftLines.length,
    rightLineCount: rightLines.length,
    summary,
    rows,
    warnings
  };
  const output = formatTextDiffOutput(report, outputFormat);
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    ...report,
    output,
    outputFormat,
    outputType: TEXT_DIFF_OUTPUT_FORMATS.find(format => format.value === outputFormat).label,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    previewRows: rows.slice(0, normaliseMaxPreviewRows(options.maxPreviewRows)),
    previewTruncated: rows.length > normaliseMaxPreviewRows(options.maxPreviewRows)
  };
}

export function splitTextLines(value) {
  const text = normaliseLineEndings(value);

  if (text === '') {
    return [];
  }

  return text.split('\n');
}

export function buildLineOperations(leftLines, rightLines, options = {}) {
  const leftKeys = leftLines.map(line => normaliseLineForCompare(line, options));
  const rightKeys = rightLines.map(line => normaliseLineForCompare(line, options));
  const matrix = buildLcsMatrix(leftKeys, rightKeys);
  const operations = [];
  let leftIndex = leftLines.length;
  let rightIndex = rightLines.length;

  while (leftIndex > 0 || rightIndex > 0) {
    if (
      leftIndex > 0 &&
      rightIndex > 0 &&
      leftKeys[leftIndex - 1] === rightKeys[rightIndex - 1]
    ) {
      operations.push({
        type: 'unchanged',
        leftLineNumber: leftIndex,
        rightLineNumber: rightIndex,
        leftText: leftLines[leftIndex - 1],
        rightText: rightLines[rightIndex - 1]
      });
      leftIndex -= 1;
      rightIndex -= 1;
      continue;
    }

    if (
      rightIndex > 0 &&
      (leftIndex === 0 || matrix[leftIndex][rightIndex - 1] >= matrix[leftIndex - 1][rightIndex])
    ) {
      operations.push({
        type: 'added',
        rightLineNumber: rightIndex,
        rightText: rightLines[rightIndex - 1]
      });
      rightIndex -= 1;
      continue;
    }

    operations.push({
      type: 'removed',
      leftLineNumber: leftIndex,
      leftText: leftLines[leftIndex - 1]
    });
    leftIndex -= 1;
  }

  return operations.reverse();
}

export function combineChangeRows(operations) {
  const rows = [];
  let index = 0;

  while (index < operations.length) {
    const operation = operations[index];

    if (operation.type === 'unchanged') {
      rows.push({
        type: 'unchanged',
        leftLineNumber: operation.leftLineNumber,
        rightLineNumber: operation.rightLineNumber,
        leftText: operation.leftText,
        rightText: operation.rightText
      });
      index += 1;
      continue;
    }

    const block = [];

    while (index < operations.length && operations[index].type !== 'unchanged') {
      block.push(operations[index]);
      index += 1;
    }

    rows.push(...combineChangeBlock(block));
  }

  return rows;
}

export function formatTextDiffOutput(report, outputFormat = 'unified') {
  const format = normaliseOutputFormat(outputFormat);

  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }

  if (format === 'markdown') {
    return formatTextDiffAsMarkdown(report);
  }

  return formatTextDiffAsUnifiedDiff(report);
}

export function normaliseLineForCompare(line, options = {}) {
  let value = String(line ?? '');

  if (options.ignoreWhitespace) {
    value = value.replace(/\s+/g, ' ').trim();
  }

  if (options.ignoreCase) {
    value = value.toLocaleLowerCase('en-GB');
  }

  return value;
}

function buildLcsMatrix(leftKeys, rightKeys) {
  const matrix = Array.from(
    { length: leftKeys.length + 1 },
    () => new Array(rightKeys.length + 1).fill(0)
  );

  for (let leftIndex = 1; leftIndex <= leftKeys.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= rightKeys.length; rightIndex += 1) {
      if (leftKeys[leftIndex - 1] === rightKeys[rightIndex - 1]) {
        matrix[leftIndex][rightIndex] = matrix[leftIndex - 1][rightIndex - 1] + 1;
      } else {
        matrix[leftIndex][rightIndex] = Math.max(
          matrix[leftIndex - 1][rightIndex],
          matrix[leftIndex][rightIndex - 1]
        );
      }
    }
  }

  return matrix;
}

function combineChangeBlock(block) {
  const removed = block.filter(operation => operation.type === 'removed');
  const added = block.filter(operation => operation.type === 'added');
  const rows = [];
  const pairCount = Math.min(removed.length, added.length);

  for (let index = 0; index < pairCount; index += 1) {
    rows.push({
      type: 'changed',
      leftLineNumber: removed[index].leftLineNumber,
      rightLineNumber: added[index].rightLineNumber,
      leftText: removed[index].leftText,
      rightText: added[index].rightText
    });
  }

  removed.slice(pairCount).forEach(operation => {
    rows.push({
      type: 'removed',
      leftLineNumber: operation.leftLineNumber,
      leftText: operation.leftText
    });
  });

  added.slice(pairCount).forEach(operation => {
    rows.push({
      type: 'added',
      rightLineNumber: operation.rightLineNumber,
      rightText: operation.rightText
    });
  });

  return rows;
}

function summariseRows(rows) {
  const summary = {
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
    totalChanges: 0
  };

  rows.forEach(row => {
    summary[row.type] += 1;
  });
  summary.totalChanges = summary.added + summary.removed + summary.changed;

  return summary;
}

function formatTextDiffAsUnifiedDiff(report) {
  const lines = [
    '--- Left',
    '+++ Right',
    `@@ -1,${report.leftLineCount.toLocaleString('en-GB')} +1,${report.rightLineCount.toLocaleString('en-GB')} @@`
  ];

  if (report.rows.length === 0) {
    lines.push('# Both inputs are empty.');
    return lines.join('\n');
  }

  report.rows.forEach(row => {
    if (row.type === 'unchanged') {
      lines.push(` ${row.leftText}`);
      return;
    }

    if (row.type === 'removed') {
      lines.push(`-${row.leftText}`);
      return;
    }

    if (row.type === 'added') {
      lines.push(`+${row.rightText}`);
      return;
    }

    lines.push(`-${row.leftText}`, `+${row.rightText}`);
  });

  return lines.join('\n');
}

function formatTextDiffAsMarkdown(report) {
  const lines = [
    '# Text diff report',
    '',
    `Status: ${report.equal ? 'Identical' : 'Different'}`,
    `Ignore whitespace changes: ${report.options.ignoreWhitespace ? 'Yes' : 'No'}`,
    `Ignore case: ${report.options.ignoreCase ? 'Yes' : 'No'}`,
    `Left lines: ${report.leftLineCount.toLocaleString('en-GB')}`,
    `Right lines: ${report.rightLineCount.toLocaleString('en-GB')}`,
    `Total changes: ${report.summary.totalChanges.toLocaleString('en-GB')}`,
    `Added: ${report.summary.added.toLocaleString('en-GB')}`,
    `Removed: ${report.summary.removed.toLocaleString('en-GB')}`,
    `Changed: ${report.summary.changed.toLocaleString('en-GB')}`,
    `Unchanged lines: ${report.summary.unchanged.toLocaleString('en-GB')}`,
    ...formatWarnings(report.warnings),
    '',
    '## Changes'
  ];

  if (report.summary.totalChanges === 0) {
    lines.push('', '- No line-level differences found.');
    return lines.join('\n');
  }

  report.rows
    .filter(row => row.type !== 'unchanged')
    .forEach(row => {
      lines.push('', `### ${capitalise(row.type)} line`);

      if (row.leftLineNumber) {
        lines.push(`Left ${row.leftLineNumber}: \`${escapeMarkdownInline(row.leftText)}\``);
      }

      if (row.rightLineNumber) {
        lines.push(`Right ${row.rightLineNumber}: \`${escapeMarkdownInline(row.rightText)}\``);
      }
    });

  return lines.join('\n');
}

function buildWarnings(options) {
  const warnings = [];

  if (options.leftText === '' && options.rightText === '') {
    warnings.push('Both inputs are empty.');
  }

  if (/\r/.test(options.leftText) || /\r/.test(options.rightText)) {
    warnings.push('Line endings were normalised before comparison.');
  }

  if (
    options.compareOptions.ignoreWhitespace &&
    options.rows.length > 0 &&
    options.leftText !== options.rightText &&
    options.rows.every(row => row.type === 'unchanged')
  ) {
    warnings.push('Whitespace differences were ignored.');
  }

  if (
    options.compareOptions.ignoreCase &&
    options.rows.length > 0 &&
    options.leftText !== options.rightText &&
    options.rows.every(row => row.type === 'unchanged')
  ) {
    warnings.push('Case differences were ignored.');
  }

  return [...new Set(warnings)];
}

function normaliseLineEndings(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function normaliseOutputFormat(value) {
  return TEXT_DIFF_OUTPUT_FORMATS.some(format => format.value === value) ? value : 'unified';
}

function normaliseMaxPreviewRows(value) {
  const number = Number(value || DEFAULT_MAX_PREVIEW_ROWS);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : DEFAULT_MAX_PREVIEW_ROWS;
}

function formatWarnings(warnings) {
  if (warnings.length === 0) {
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

function capitalise(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
