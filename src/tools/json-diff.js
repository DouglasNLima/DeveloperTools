import { parseJsonInput, sortJsonKeys } from './json-formatter.js';

const MARKDOWN_OUTPUT = 'markdown';
const JSON_OUTPUT = 'json';

export function buildJsonDiff(leftInput, rightInput, options = {}) {
  const sortKeys = Boolean(options.sortKeys);
  const outputFormat = normaliseOutputFormat(options.outputFormat);
  const leftValue = parseJsonSide(leftInput, 'Left JSON');
  const rightValue = parseJsonSide(rightInput, 'Right JSON');
  const left = sortKeys ? sortJsonKeys(leftValue) : leftValue;
  const right = sortKeys ? sortJsonKeys(rightValue) : rightValue;
  const changes = [];
  const summary = {
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
    totalChanges: 0
  };

  compareJsonValues(left, right, '$', changes, summary);
  summary.totalChanges = summary.added + summary.removed + summary.changed;

  const report = {
    equal: summary.totalChanges === 0,
    sortKeys,
    summary,
    changes
  };
  const output = outputFormat === JSON_OUTPUT
    ? formatJsonReport(report)
    : formatMarkdownReport(report);

  return {
    ...report,
    output,
    outputFormat,
    outputType: outputFormat === JSON_OUTPUT ? 'JSON report' : 'Markdown report'
  };
}

export function compareJsonValues(left, right, path = '$', changes = [], summary = createSummary()) {
  const leftType = getJsonType(left);
  const rightType = getJsonType(right);

  if (leftType !== rightType) {
    addChange(changes, summary, {
      type: 'changed',
      path,
      message: `Type changed from ${leftType} to ${rightType}.`,
      leftValue: left,
      rightValue: right
    });
    return { changes, summary };
  }

  if (leftType === 'array') {
    compareArrays(left, right, path, changes, summary);
    return { changes, summary };
  }

  if (leftType === 'object') {
    compareObjects(left, right, path, changes, summary);
    return { changes, summary };
  }

  if (Object.is(left, right)) {
    summary.unchanged += 1;
    return { changes, summary };
  }

  addChange(changes, summary, {
    type: 'changed',
    path,
    message: 'Value changed.',
    leftValue: left,
    rightValue: right
  });

  return { changes, summary };
}

export function formatPath(parentPath, key) {
  if (/^[A-Za-z_$][\w$]*$/.test(key)) {
    return `${parentPath}.${key}`;
  }

  return `${parentPath}[${JSON.stringify(key)}]`;
}

export function formatValuePreview(value) {
  const text = JSON.stringify(value, null, 2);

  if (text.length <= 220) {
    return text;
  }

  return `${text.slice(0, 217)}...`;
}

function compareArrays(left, right, path, changes, summary) {
  if (left.length === 0 && right.length === 0) {
    summary.unchanged += 1;
    return;
  }

  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const childPath = `${path}[${index}]`;

    if (index >= left.length) {
      addChange(changes, summary, {
        type: 'added',
        path: childPath,
        message: 'Array item added.',
        rightValue: right[index]
      });
      continue;
    }

    if (index >= right.length) {
      addChange(changes, summary, {
        type: 'removed',
        path: childPath,
        message: 'Array item removed.',
        leftValue: left[index]
      });
      continue;
    }

    compareJsonValues(left[index], right[index], childPath, changes, summary);
  }
}

function compareObjects(left, right, path, changes, summary) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length === 0 && rightKeys.length === 0) {
    summary.unchanged += 1;
    return;
  }

  const keys = [...new Set([...leftKeys, ...rightKeys])]
    .sort((leftKey, rightKey) => leftKey.localeCompare(rightKey, 'en-GB'));

  keys.forEach(key => {
    const childPath = formatPath(path, key);

    if (!Object.hasOwn(left, key)) {
      addChange(changes, summary, {
        type: 'added',
        path: childPath,
        message: 'Property added.',
        rightValue: right[key]
      });
      return;
    }

    if (!Object.hasOwn(right, key)) {
      addChange(changes, summary, {
        type: 'removed',
        path: childPath,
        message: 'Property removed.',
        leftValue: left[key]
      });
      return;
    }

    compareJsonValues(left[key], right[key], childPath, changes, summary);
  });
}

function addChange(changes, summary, change) {
  changes.push(change);
  summary[change.type] += 1;
  summary.totalChanges += 1;
}

function parseJsonSide(input, label) {
  try {
    return parseJsonInput(input);
  } catch (error) {
    const diffError = new Error(`${label}: ${error.message}`);
    diffError.details = {
      side: label,
      parseError: error.details || null
    };
    throw diffError;
  }
}

function formatMarkdownReport(report) {
  const lines = [
    '# JSON diff report',
    '',
    `Status: ${report.equal ? 'Identical' : 'Different'}`,
    `Sort keys: ${report.sortKeys ? 'Yes' : 'No'}`,
    `Total changes: ${report.summary.totalChanges.toLocaleString('en-GB')}`,
    `Added: ${report.summary.added.toLocaleString('en-GB')}`,
    `Removed: ${report.summary.removed.toLocaleString('en-GB')}`,
    `Changed: ${report.summary.changed.toLocaleString('en-GB')}`,
    `Unchanged values: ${report.summary.unchanged.toLocaleString('en-GB')}`
  ];

  if (report.changes.length === 0) {
    lines.push('', '## Changes', '- No structural differences found.');
    return lines.join('\n');
  }

  lines.push('', '## Changes');

  report.changes.forEach(change => {
    lines.push('', `### ${capitalise(change.type)} ${change.path}`, change.message);

    if ('leftValue' in change) {
      lines.push('', 'Left:', '```json', formatValuePreview(change.leftValue), '```');
    }

    if ('rightValue' in change) {
      lines.push('', 'Right:', '```json', formatValuePreview(change.rightValue), '```');
    }
  });

  return lines.join('\n');
}

function formatJsonReport(report) {
  return JSON.stringify(report, null, 2);
}

function normaliseOutputFormat(value) {
  return value === JSON_OUTPUT ? JSON_OUTPUT : MARKDOWN_OUTPUT;
}

function getJsonType(value) {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value === null) {
    return 'null';
  }

  return typeof value;
}

function createSummary() {
  return {
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
    totalChanges: 0
  };
}

function capitalise(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
