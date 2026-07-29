const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
const UTF16_LE_BOM = new Uint8Array([0xff, 0xfe]);
const UTF16_BE_BOM = new Uint8Array([0xfe, 0xff]);

export function incrementSolutionRevision(version) {
  const parts = parseSolutionVersion(version);

  if (!parts) {
    throw new Error('Solution version must use the major.minor.build.revision format.');
  }

  if (parts[3] >= 0xffffffff - 1) {
    throw new Error('The solution revision cannot be incremented further.');
  }

  parts[3] += 1;
  return parts.join('.');
}

export function isValidSolutionVersion(version) {
  return Boolean(parseSolutionVersion(version));
}

export function compareSolutionVersions(left, right) {
  const leftParts = parseSolutionVersion(left);
  const rightParts = parseSolutionVersion(right);

  if (!leftParts || !rightParts) {
    throw new Error('Solution versions must use the major.minor.build.revision format.');
  }

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] < rightParts[index] ? -1 : 1;
    }
  }

  return 0;
}

export function updateSolutionVersionXml(solutionXml, targetVersion) {
  if (!isValidSolutionVersion(targetVersion)) {
    throw new Error('Target version must use the major.minor.build.revision format.');
  }

  const source = String(solutionXml ?? '');
  const manifestPattern = /(<SolutionManifest\b[^>]*>)([\s\S]*?)(<\/SolutionManifest>)/i;
  const manifestMatch = manifestPattern.exec(source);

  if (!manifestMatch) {
    throw new Error('solution.xml does not contain a SolutionManifest element.');
  }

  const versionPattern = /(<Version\b[^>]*>)([^<]*)(<\/Version>)/i;

  if (!versionPattern.test(manifestMatch[2])) {
    throw new Error('solution.xml does not contain a solution Version element.');
  }

  const updatedManifest = manifestMatch[2].replace(
    versionPattern,
    (_, opening, value, closing) => `${opening}${preserveOuterWhitespace(value, targetVersion)}${closing}`
  );

  return [
    source.slice(0, manifestMatch.index),
    manifestMatch[1],
    updatedManifest,
    manifestMatch[3],
    source.slice(manifestMatch.index + manifestMatch[0].length)
  ].join('');
}

export function buildUpdatedPackageFileName(uniqueName, version) {
  const safeName = String(uniqueName || 'power-platform-solution')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'power-platform-solution';
  const versionSuffix = String(version || '').replace(/\./g, '_');

  return `${safeName}_${versionSuffix}.zip`;
}

export function detectTextEncoding(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0);

  if (startsWithBytes(bytes, UTF8_BOM)) {
    return { encoding: 'utf-8', bom: UTF8_BOM, offset: UTF8_BOM.byteLength };
  }

  if (startsWithBytes(bytes, UTF16_LE_BOM)) {
    return { encoding: 'utf-16le', bom: UTF16_LE_BOM, offset: UTF16_LE_BOM.byteLength };
  }

  if (startsWithBytes(bytes, UTF16_BE_BOM)) {
    return { encoding: 'utf-16be', bom: UTF16_BE_BOM, offset: UTF16_BE_BOM.byteLength };
  }

  if (bytes.byteLength >= 4 && bytes[0] === 0x3c && bytes[1] === 0x00) {
    return { encoding: 'utf-16le', bom: null, offset: 0 };
  }

  if (bytes.byteLength >= 4 && bytes[0] === 0x00 && bytes[1] === 0x3c) {
    return { encoding: 'utf-16be', bom: null, offset: 0 };
  }

  return { encoding: 'utf-8', bom: null, offset: 0 };
}

export function decodeTextBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
  const format = detectTextEncoding(bytes);
  const content = bytes.slice(format.offset);

  if (format.encoding === 'utf-16le') {
    return decodeUtf16(content, true);
  }

  if (format.encoding === 'utf-16be') {
    return decodeUtf16(content, false);
  }

  return new TextDecoder('utf-8').decode(content);
}

export function encodeTextLikeOriginal(text, originalBytes) {
  const format = detectTextEncoding(originalBytes);
  const normalisedText = preserveLineEndings(String(text ?? ''), decodeTextBytes(originalBytes));
  const content = format.encoding === 'utf-16le'
    ? encodeUtf16(normalisedText, true)
    : format.encoding === 'utf-16be'
      ? encodeUtf16(normalisedText, false)
      : new TextEncoder().encode(normalisedText);

  return format.bom ? concatenateBytes([format.bom, content]) : content;
}

function preserveLineEndings(text, originalText) {
  const lineEnding = originalText.includes('\r\n')
    ? '\r\n'
    : originalText.includes('\r')
      ? '\r'
      : originalText.includes('\n')
        ? '\n'
        : '';

  if (!lineEnding) {
    return text;
  }

  return text.replace(/\r\n|\r|\n/g, '\n').replace(/\n/g, lineEnding);
}

export function normaliseZipPath(path) {
  return String(path ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
}

export function findDuplicateEntryPaths(entries = []) {
  const counts = new Map();

  entries.forEach(entry => {
    const key = normaliseZipPath(entry.name).toLocaleLowerCase('en-GB');
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([path]) => path);
}

export function bytesEqual(left, right) {
  if (!left || !right || left.byteLength !== right.byteLength) {
    return false;
  }

  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export function normaliseXmlEncodingName(value) {
  const encoding = String(value || '').trim().toLocaleLowerCase('en-GB').replace(/_/g, '-');

  if (encoding === 'utf8' || encoding === 'utf-8') {
    return 'utf-8';
  }

  if (['utf16', 'utf-16', 'unicode', 'utf-16le'].includes(encoding)) {
    return 'utf-16le';
  }

  if (encoding === 'utf-16be') {
    return 'utf-16be';
  }

  return encoding;
}

function parseSolutionVersion(version) {
  const match = String(version ?? '').trim().match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    return null;
  }

  const parts = match.slice(1).map(Number);

  return parts.every(part => Number.isSafeInteger(part) && part >= 0 && part < 0xffffffff)
    ? parts
    : null;
}

function preserveOuterWhitespace(value, replacement) {
  const text = String(value ?? '');
  const leading = text.match(/^\s*/)?.[0] || '';
  const trailing = text.match(/\s*$/)?.[0] || '';
  return `${leading}${replacement}${trailing}`;
}

function startsWithBytes(bytes, prefix) {
  return bytes.byteLength >= prefix.byteLength
    && prefix.every((byte, index) => bytes[index] === byte);
}

function decodeUtf16(bytes, littleEndian) {
  if (bytes.byteLength % 2 !== 0) {
    throw new Error('The UTF-16 text entry contains an incomplete code unit.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = [];

  for (let offset = 0; offset < bytes.byteLength; offset += 2) {
    chunks.push(view.getUint16(offset, littleEndian));
  }

  let output = '';

  for (let index = 0; index < chunks.length; index += 0x4000) {
    output += String.fromCharCode(...chunks.slice(index, index + 0x4000));
  }

  return output;
}

function encodeUtf16(text, littleEndian) {
  const output = new Uint8Array(text.length * 2);
  const view = new DataView(output.buffer);

  for (let index = 0; index < text.length; index += 1) {
    view.setUint16(index * 2, text.charCodeAt(index), littleEndian);
  }

  return output;
}

function concatenateBytes(chunks) {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;

  chunks.forEach(chunk => {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return output;
}
