import { bytesToBase64, formatBytes } from './base64.js';

export const HASH_ALGORITHMS = [
  { value: 'SHA-256', label: 'SHA-256' },
  { value: 'SHA-384', label: 'SHA-384' },
  { value: 'SHA-512', label: 'SHA-512' },
  { value: 'SHA-1', label: 'SHA-1' }
];

const algorithmValues = new Set(HASH_ALGORITHMS.map(algorithm => algorithm.value));

export async function buildHashChecksum(options = {}) {
  const inputType = normaliseInputType(options.inputType);
  const algorithm = normaliseAlgorithm(options.algorithm);
  const bytes = readInputBytes(options, inputType);
  const inputName = normaliseInputName(options, inputType);
  const digest = await hashBytes(bytes, algorithm);
  const expected = normaliseExpectedDigest(options.expectedDigest);
  const match = compareExpectedDigest(expected, digest);
  const warnings = buildHashWarnings({
    algorithm,
    byteLength: bytes.length,
    match
  });
  const result = {
    algorithm,
    inputType,
    inputName,
    byteLength: bytes.length,
    inputSizeLabel: formatBytes(bytes.length),
    hex: digest.hex,
    base64: digest.base64,
    expected,
    match,
    warnings
  };

  return {
    ...result,
    output: buildHashOutput(result)
  };
}

export async function hashBytes(bytes, algorithm = 'SHA-256') {
  const normalisedAlgorithm = normaliseAlgorithm(algorithm);
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);

  if (input.length === 0) {
    throw new Error('Enter text or select a file before generating a hash.');
  }

  const digestBuffer = await getSubtleCrypto().digest(normalisedAlgorithm, input);
  const digestBytes = new Uint8Array(digestBuffer);

  return {
    algorithm: normalisedAlgorithm,
    hex: bytesToHex(digestBytes),
    base64: bytesToBase64(digestBytes),
    bytes: digestBytes
  };
}

export function textToBytes(value) {
  const input = String(value ?? '');

  if (!input) {
    throw new Error('Enter text before generating a hash.');
  }

  return new TextEncoder().encode(input);
}

export function normaliseExpectedDigest(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    return null;
  }

  const compactHex = trimmed.replace(/[\s:]/g, '').toLowerCase();

  if (/^[0-9a-f]+$/i.test(compactHex)) {
    return {
      format: 'hex',
      value: compactHex
    };
  }

  return {
    format: 'base64',
    value: trimmed.replace(/\s+/g, '')
  };
}

export function compareExpectedDigest(expected, digest) {
  if (!expected) {
    return {
      status: 'not-provided',
      label: 'No expected digest'
    };
  }

  const matched = expected.format === 'hex'
    ? expected.value === digest.hex.toLowerCase()
    : expected.value === digest.base64;

  return {
    status: matched ? 'match' : 'mismatch',
    label: matched ? 'Match' : 'Mismatch'
  };
}

export function buildHashOutput(result) {
  return [
    `Algorithm: ${result.algorithm}`,
    `Input: ${result.inputName}`,
    `Size: ${result.inputSizeLabel}`,
    `Expected digest: ${result.match.label}`,
    '',
    'Hex',
    result.hex,
    '',
    'Base64',
    result.base64,
    ...(result.warnings.length > 0 ? ['', 'Warnings', ...result.warnings.map(warning => `- ${warning}`)] : [])
  ].join('\n');
}

export function normaliseAlgorithm(value) {
  const algorithm = String(value || 'SHA-256').toUpperCase();

  if (!algorithmValues.has(algorithm)) {
    throw new Error('Choose a supported SHA algorithm.');
  }

  return algorithm;
}

export function buildHashOutputFileName(inputName) {
  const safeBase = String(inputName || 'hash-checksum')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.+$/g, '') || 'hash-checksum';

  return `${safeBase}.sha.txt`;
}

function readInputBytes(options, inputType) {
  if (inputType === 'text') {
    return textToBytes(options.text);
  }

  const bytes = options.fileBytes instanceof Uint8Array
    ? options.fileBytes
    : options.fileBytes
      ? new Uint8Array(options.fileBytes)
      : null;

  if (!bytes || bytes.length === 0) {
    throw new Error('Select a file before generating a hash.');
  }

  return bytes;
}

function normaliseInputName(options, inputType) {
  if (inputType === 'text') {
    return 'Text input';
  }

  return String(options.fileName || 'Selected file').trim() || 'Selected file';
}

function normaliseInputType(value) {
  return value === 'file' ? 'file' : 'text';
}

function buildHashWarnings(options) {
  const warnings = [];

  if (options.algorithm === 'SHA-1') {
    warnings.push('SHA-1 is included for compatibility checks only; avoid it for new security-sensitive uses.');
  }

  if (options.byteLength > 50 * 1024 * 1024) {
    warnings.push('Large files are read fully in the browser before hashing.');
  }

  if (options.match.status === 'mismatch') {
    warnings.push('The generated digest does not match the expected digest.');
  }

  return warnings;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getSubtleCrypto() {
  if (globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }

  throw new Error('This browser does not support the Web Crypto API required for hashing.');
}
