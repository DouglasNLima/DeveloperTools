import { formatBytes } from './base64.js';

export const REGEX_OUTPUT_FORMATS = [
  { value: 'json', label: 'JSON report' },
  { value: 'markdown', label: 'Markdown report' }
];

const VALID_FLAG_ORDER = ['d', 'g', 'i', 'm', 's', 'u', 'y'];
const VALID_FLAGS = new Set(VALID_FLAG_ORDER);
const DEFAULT_MAX_MATCHES = 250;

export function processRegexTest(options = {}) {
  const pattern = normalisePattern(options.pattern);
  const flags = normaliseFlags(options.flags);
  const text = String(options.text ?? '');
  const outputFormat = normaliseOutputFormat(options.outputFormat);
  const maxMatches = normaliseMaxMatches(options.maxMatches);
  const regex = compileRegex(pattern, flags.value);
  const matches = collectRegexMatches(regex, text, { maxMatches });
  const warnings = buildWarnings({
    flagWarnings: flags.warnings,
    matches,
    maxMatches,
    truncated: matches.length >= maxMatches
  });
  const segments = buildHighlightSegments(text, matches);
  const output = outputFormat === 'markdown'
    ? formatRegexReportAsMarkdown({ pattern, flags: flags.value, matches, warnings })
    : formatRegexReportAsJson({ pattern, flags: flags.value, matches, warnings });
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    pattern,
    flags: flags.value,
    regex,
    matches,
    matchCount: matches.length,
    groupsCount: matches.reduce((total, match) => total + match.groups.length, 0),
    namedGroupsCount: matches.reduce((total, match) => total + match.namedGroups.length, 0),
    zeroLengthCount: matches.filter(match => match.value === '').length,
    warnings,
    segments,
    output,
    outputFormat,
    outputType: REGEX_OUTPUT_FORMATS.find(format => format.value === outputFormat).label,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes)
  };
}

export function normaliseFlags(value = '') {
  const rawFlags = String(value || '').trim();
  const seen = new Set();
  const duplicates = new Set();
  const unsupported = new Set();

  for (const flag of rawFlags) {
    if (!VALID_FLAGS.has(flag)) {
      unsupported.add(flag);
      continue;
    }

    if (seen.has(flag)) {
      duplicates.add(flag);
      continue;
    }

    seen.add(flag);
  }

  if (unsupported.size > 0) {
    throw new Error(`Unsupported regex flags: ${[...unsupported].join(', ')}.`);
  }

  const flags = VALID_FLAG_ORDER.filter(flag => seen.has(flag)).join('');
  const warnings = duplicates.size > 0
    ? [`Duplicate flags removed: ${[...duplicates].join(', ')}.`]
    : [];

  return {
    value: flags,
    warnings
  };
}

export function compileRegex(pattern, flags = '') {
  const normalisedPattern = normalisePattern(pattern);
  const normalisedFlags = normaliseFlags(flags).value;
  const scanningFlags = normalisedFlags.includes('g') ? normalisedFlags : `${normalisedFlags}g`;

  try {
    return new RegExp(normalisedPattern, scanningFlags);
  } catch (error) {
    throw new Error(`Invalid regular expression: ${error.message}`);
  }
}

export function collectRegexMatches(regex, text, options = {}) {
  const input = String(text ?? '');
  const maxMatches = normaliseMaxMatches(options.maxMatches);
  const matches = [];
  regex.lastIndex = 0;

  while (matches.length < maxMatches) {
    const match = regex.exec(input);

    if (!match) {
      break;
    }

    matches.push(createMatchRecord(match, input, matches.length + 1));

    if (match[0] === '') {
      regex.lastIndex += regex.unicode ? codePointSizeAt(input, regex.lastIndex) : 1;

      if (regex.lastIndex > input.length) {
        break;
      }
    }
  }

  return matches;
}

export function buildHighlightSegments(text, matches) {
  const input = String(text ?? '');
  const segments = [];
  let cursor = 0;

  matches
    .filter(match => match.value.length > 0)
    .forEach(match => {
      if (match.index > cursor) {
        segments.push({
          type: 'text',
          value: input.slice(cursor, match.index)
        });
      }

      segments.push({
        type: 'match',
        index: match.matchNumber,
        value: input.slice(match.index, match.endIndex)
      });
      cursor = match.endIndex;
    });

  if (cursor < input.length) {
    segments.push({
      type: 'text',
      value: input.slice(cursor)
    });
  }

  if (segments.length === 0) {
    segments.push({
      type: 'text',
      value: input
    });
  }

  return segments;
}

export function formatRegexReportAsJson(report) {
  return JSON.stringify({
    pattern: report.pattern,
    flags: report.flags,
    matchCount: report.matches.length,
    warnings: report.warnings,
    matches: report.matches.map(match => ({
      matchNumber: match.matchNumber,
      value: match.value,
      index: match.index,
      endIndex: match.endIndex,
      line: match.line,
      column: match.column,
      groups: match.groups,
      namedGroups: Object.fromEntries(match.namedGroups.map(group => [group.name, group.value]))
    }))
  }, null, 2);
}

export function formatRegexReportAsMarkdown(report) {
  if (report.matches.length === 0) {
    return [
      '# Regex report',
      '',
      `Pattern: \`${escapeMarkdownInline(report.pattern)}\``,
      `Flags: \`${report.flags || '(none)'}\``,
      '',
      'No matches found.',
      ...formatWarnings(report.warnings)
    ].join('\n');
  }

  return [
    '# Regex report',
    '',
    `Pattern: \`${escapeMarkdownInline(report.pattern)}\``,
    `Flags: \`${report.flags || '(none)'}\``,
    `Matches: ${report.matches.length.toLocaleString('en-GB')}`,
    ...formatWarnings(report.warnings),
    '',
    ...report.matches.flatMap(match => [
      `## Match ${match.matchNumber}`,
      '',
      `- Value: \`${escapeMarkdownInline(match.value)}\``,
      `- Index: ${match.index}`,
      `- Line / column: ${match.line} / ${match.column}`,
      ...match.groups.map(group => `- Group ${group.index}: ${group.matched ? `\`${escapeMarkdownInline(group.value)}\`` : 'not matched'}`),
      ...match.namedGroups.map(group => `- Named group ${group.name}: ${group.matched ? `\`${escapeMarkdownInline(group.value)}\`` : 'not matched'}`),
      ''
    ])
  ].join('\n').trimEnd();
}

export function normalisePattern(value) {
  const pattern = String(value ?? '');

  if (!pattern) {
    throw new Error('Enter a regular expression pattern.');
  }

  return pattern;
}

function createMatchRecord(match, text, matchNumber) {
  const location = getLineColumn(text, match.index);
  const groups = match.slice(1).map((value, index) => ({
    index: index + 1,
    value: value ?? null,
    matched: value !== undefined
  }));
  const namedGroups = match.groups
    ? Object.entries(match.groups).map(([name, value]) => ({
        name,
        value: value ?? null,
        matched: value !== undefined
      }))
    : [];

  return {
    matchNumber,
    value: match[0],
    index: match.index,
    endIndex: match.index + match[0].length,
    line: location.line,
    column: location.column,
    groups,
    namedGroups
  };
}

function getLineColumn(text, index) {
  const before = text.slice(0, index);
  const lines = before.split(/\r\n|\r|\n/);

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function buildWarnings(options) {
  const warnings = [...options.flagWarnings];
  const zeroLengthCount = options.matches.filter(match => match.value === '').length;

  if (options.matches.length === 0) {
    warnings.push('No matches found.');
  }

  if (zeroLengthCount > 0) {
    warnings.push(`${zeroLengthCount.toLocaleString('en-GB')} zero-length match${zeroLengthCount === 1 ? ' is' : 'es are'} listed but not highlighted.`);
  }

  if (options.truncated) {
    warnings.push(`Only the first ${options.maxMatches.toLocaleString('en-GB')} matches are shown.`);
  }

  return warnings;
}

function normaliseOutputFormat(value) {
  return REGEX_OUTPUT_FORMATS.some(format => format.value === value) ? value : 'json';
}

function normaliseMaxMatches(value) {
  const number = Number(value || DEFAULT_MAX_MATCHES);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : DEFAULT_MAX_MATCHES;
}

function codePointSizeAt(text, index) {
  const codePoint = text.codePointAt(index);
  return codePoint && codePoint > 0xffff ? 2 : 1;
}

function escapeMarkdownInline(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\r?\n/g, '\\n');
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
