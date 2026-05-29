import { formatByteSize } from './json-formatter.js';

export const SENSITIVE_VALUE_TYPES = [
  {
    id: 'connectionString',
    placeholder: 'CONNECTION_STRING',
    label: 'connection string',
    pluralLabel: 'connection strings'
  },
  {
    id: 'jwt',
    placeholder: 'JWT',
    label: 'JWT',
    pluralLabel: 'JWTs'
  },
  {
    id: 'email',
    placeholder: 'EMAIL',
    label: 'email address',
    pluralLabel: 'email addresses'
  },
  {
    id: 'guid',
    placeholder: 'GUID',
    label: 'GUID',
    pluralLabel: 'GUIDs'
  },
  {
    id: 'stripeId',
    placeholder: 'STRIPE_ID',
    label: 'Stripe customer or subscription ID',
    pluralLabel: 'Stripe customer or subscription IDs'
  },
  {
    id: 'tenantId',
    placeholder: 'TENANT_ID',
    label: 'tenant ID',
    pluralLabel: 'tenant IDs'
  },
  {
    id: 'internalUrl',
    placeholder: 'INTERNAL_URL',
    label: 'internal URL',
    pluralLabel: 'internal URLs'
  },
  {
    id: 'token',
    placeholder: 'TOKEN',
    label: 'token or secret',
    pluralLabel: 'tokens or secrets'
  },
  {
    id: 'environmentName',
    placeholder: 'ENVIRONMENT_NAME',
    label: 'environment name',
    pluralLabel: 'environment names'
  },
  {
    id: 'localPath',
    placeholder: 'LOCAL_PATH',
    label: 'local path',
    pluralLabel: 'local paths'
  }
];

const TYPE_BY_ID = new Map(SENSITIVE_VALUE_TYPES.map(type => [type.id, type]));
const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>),]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const GUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const JWT_PATTERN = /\b(?:Bearer\s+)?[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const STRIPE_ID_PATTERN = /\b(?:cus|sub)_[A-Za-z0-9]{8,}\b/g;
const WINDOWS_PATH_PATTERN = /\b[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\?)+/g;
const UNC_PATH_PATTERN = /\\\\[A-Za-z0-9._$-]+\\[^\s"'<>|]+/g;
const POSIX_PATH_PATTERN = /(?:\/Users\/|\/home\/|\/var\/www\/|\/opt\/|\/tmp\/)[^\s"'<>)]*/g;
const CONNECTION_STRING_PATTERN = /\b(?:Server|Data Source|Host|Endpoint|AccountEndpoint|DefaultEndpointsProtocol)\s*=\s*[^;\r\n]+(?:;[A-Za-z][A-Za-z0-9\s]*(?:Id)?\s*=\s*[^;\r\n]*){1,}/gi;
const TOKEN_VALUE_PATTERN = /(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret|token|password|passwd|pwd|x-api-key)["']?\s*[:=]\s*["']?)([A-Za-z0-9._~+/=-]{6,})/gi;
const AUTH_BEARER_PATTERN = /(\bAuthorization\s*[:=]\s*Bearer\s+)([A-Za-z0-9._~+/-]{8,})/gi;
const TENANT_VALUE_PATTERN = /(["']?(?:tenant|tenant[_-]?id|tenant[_-]?name|tenantId|tenantName)["']?\s*[:=]\s*["']?)([A-Za-z0-9][A-Za-z0-9._-]{2,})/gi;
const ENVIRONMENT_VALUE_PATTERN = /(["']?(?:environment|environment[_-]?name|environmentName|env)["']?\s*[:=]\s*["']?)([A-Za-z0-9][A-Za-z0-9._-]{1,})/gi;

export function sanitiseSupportPack(input) {
  const rawInput = String(input ?? '');

  if (!rawInput.trim()) {
    throw new Error('Enter support pack content to sanitise.');
  }

  const findings = findSensitiveValues(rawInput);
  const replacement = applyStablePlaceholders(rawInput, findings);
  const output = buildSanitisedSupportPack(replacement.sanitisedPayload, replacement.counts);
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    output,
    outputBytes,
    outputSizeLabel: formatByteSize(outputBytes),
    sanitisedPayload: replacement.sanitisedPayload,
    detectedValues: buildDetectedValues(replacement.counts),
    totalDetected: [...replacement.counts.values()].reduce((total, count) => total + count, 0)
  };
}

export function findSensitiveValues(input) {
  const source = String(input ?? '');
  const findings = [];

  addPatternFindings(findings, source, 'connectionString', CONNECTION_STRING_PATTERN);
  addPatternFindings(findings, source, 'jwt', JWT_PATTERN);
  addCapturedPatternFindings(findings, source, 'tenantId', TENANT_VALUE_PATTERN, 2);
  addCapturedPatternFindings(findings, source, 'environmentName', ENVIRONMENT_VALUE_PATTERN, 2);
  addCapturedPatternFindings(findings, source, 'token', AUTH_BEARER_PATTERN, 2);
  addCapturedPatternFindings(findings, source, 'token', TOKEN_VALUE_PATTERN, 2);
  addPatternFindings(findings, source, 'stripeId', STRIPE_ID_PATTERN);
  addFilteredUrlFindings(findings, source);
  addPatternFindings(findings, source, 'email', EMAIL_PATTERN);
  addPatternFindings(findings, source, 'guid', GUID_PATTERN);
  addPatternFindings(findings, source, 'localPath', WINDOWS_PATH_PATTERN);
  addPatternFindings(findings, source, 'localPath', UNC_PATH_PATTERN);
  addPatternFindings(findings, source, 'localPath', POSIX_PATH_PATTERN);

  return findings;
}

export function applyStablePlaceholders(input, findings) {
  const sortedFindings = [...findings]
    .sort((left, right) => left.start - right.start || right.end - left.end);
  const accepted = [];
  let lastEnd = -1;

  sortedFindings.forEach(finding => {
    if (finding.start < lastEnd || finding.start === finding.end) {
      return;
    }

    accepted.push(finding);
    lastEnd = finding.end;
  });

  const placeholderMaps = new Map();
  const counts = new Map();
  let cursor = 0;
  let sanitisedPayload = '';

  accepted.forEach(finding => {
    sanitisedPayload += input.slice(cursor, finding.start);
    sanitisedPayload += getStablePlaceholder(finding, placeholderMaps);
    cursor = finding.end;
    counts.set(finding.type, (counts.get(finding.type) || 0) + 1);
  });

  sanitisedPayload += input.slice(cursor);

  return {
    sanitisedPayload,
    counts,
    replacements: accepted
  };
}

export function buildSanitisedSupportPack(sanitisedPayload, counts) {
  const detectedValues = buildDetectedValues(counts);
  const detectedLines = detectedValues.length === 0
    ? ['- No sensitive values detected.']
    : detectedValues.map(value => `- ${value.count.toLocaleString('en-GB')} ${value.label} masked`);
  const fence = sanitisedPayload.includes('```') ? '````' : '```';

  return [
    '## Sanitised Support Pack',
    '',
    '### Detected Sensitive Values',
    ...detectedLines,
    '',
    '### Sanitised Payload',
    `${fence}text`,
    sanitisedPayload,
    fence
  ].join('\n');
}

function buildDetectedValues(counts) {
  return SENSITIVE_VALUE_TYPES
    .map(type => {
      const count = counts.get(type.id) || 0;
      return {
        ...type,
        count,
        label: count === 1 ? type.label : type.pluralLabel
      };
    })
    .filter(type => type.count > 0);
}

function getStablePlaceholder(finding, placeholderMaps) {
  const type = TYPE_BY_ID.get(finding.type);
  const map = placeholderMaps.get(finding.type) || new Map();
  const mapKey = finding.value;

  if (!placeholderMaps.has(finding.type)) {
    placeholderMaps.set(finding.type, map);
  }

  if (!map.has(mapKey)) {
    map.set(mapKey, `[${type.placeholder}_${map.size + 1}]`);
  }

  return map.get(mapKey);
}

function addPatternFindings(findings, source, type, pattern) {
  pattern.lastIndex = 0;

  for (const match of source.matchAll(pattern)) {
    const value = trimTrailingPunctuation(match[0]);

    if (!value) {
      continue;
    }

    findings.push({
      type,
      value,
      start: match.index,
      end: match.index + value.length
    });
  }
}

function addCapturedPatternFindings(findings, source, type, pattern, groupIndex) {
  pattern.lastIndex = 0;

  for (const match of source.matchAll(pattern)) {
    const value = trimTrailingPunctuation(match[groupIndex]);

    if (!value) {
      continue;
    }

    const groupStart = match[0].indexOf(match[groupIndex]);

    if (groupStart < 0) {
      continue;
    }

    findings.push({
      type,
      value,
      start: match.index + groupStart,
      end: match.index + groupStart + value.length
    });
  }
}

function addFilteredUrlFindings(findings, source) {
  URL_PATTERN.lastIndex = 0;

  for (const match of source.matchAll(URL_PATTERN)) {
    const value = trimTrailingPunctuation(match[0]);

    if (!isInternalUrl(value)) {
      continue;
    }

    findings.push({
      type: 'internalUrl',
      value,
      start: match.index,
      end: match.index + value.length
    });
  }
}

function isInternalUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const host = url.hostname.toLocaleLowerCase('en-GB');

  return host === 'localhost'
    || host.endsWith('.local')
    || host.endsWith('.internal')
    || host.endsWith('.corp')
    || host.endsWith('.lan')
    || /^127\./.test(host)
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

function trimTrailingPunctuation(value) {
  return String(value ?? '').replace(/[.,;:)]+$/g, '');
}
