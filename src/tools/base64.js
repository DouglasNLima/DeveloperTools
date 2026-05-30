const mimeExtensionEntries = [
  ['application/pdf', 'pdf'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['image/bmp', 'bmp'],
  ['image/tiff', 'tiff'],
  ['image/svg+xml', 'svg'],
  ['text/plain', 'txt'],
  ['text/csv', 'csv'],
  ['text/html', 'html'],
  ['application/json', 'json'],
  ['application/xml', 'xml'],
  ['text/xml', 'xml'],
  ['application/zip', 'zip'],
  ['application/x-zip-compressed', 'zip'],
  ['application/x-7z-compressed', '7z'],
  ['application/x-rar-compressed', 'rar'],
  ['application/gzip', 'gz'],
  ['application/x-tar', 'tar'],
  ['audio/mpeg', 'mp3'],
  ['audio/wav', 'wav'],
  ['audio/ogg', 'ogg'],
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['application/msword', 'doc'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.ms-powerpoint', 'ppt'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx']
];

export const mimeExtensionMap = new Map(mimeExtensionEntries);

export function parseBase64Input(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error('Paste a Base64 string before creating the file.');
  }

  const dataUrlMatch = trimmed.match(/^data:([^;,]+)?((?:;[^,]*)*);base64,(.*)$/is);

  if (dataUrlMatch) {
    return {
      base64: dataUrlMatch[3],
      mimeType: dataUrlMatch[1] ? dataUrlMatch[1].toLowerCase() : null
    };
  }

  const commaIndex = trimmed.indexOf('base64,');

  if (commaIndex >= 0) {
    return {
      base64: trimmed.slice(commaIndex + 'base64,'.length),
      mimeType: null
    };
  }

  return {
    base64: trimmed,
    mimeType: null
  };
}

export function cleanBase64(value) {
  const cleaned = value
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error('The provided value contains characters that are not valid Base64.');
  }

  if (cleaned.length % 4 === 1) {
    throw new Error('The provided value is not a valid Base64 length.');
  }

  return cleaned.padEnd(cleaned.length + ((4 - (cleaned.length % 4)) % 4), '=');
}

export function base64ToBytes(base64) {
  const binary = decodeBase64String(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function bytesToBase64(bytes) {
  if (typeof btoa === 'function') {
    let binary = '';
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.slice(index, index + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  throw new Error('This environment cannot encode Base64.');
}

export function decodeBase64Input(value) {
  const parsedInput = parseBase64Input(value);
  const base64 = cleanBase64(parsedInput.base64);
  const bytes = base64ToBytes(base64);

  if (bytes.length === 0) {
    throw new Error('The Base64 string decoded to an empty file.');
  }

  return {
    bytes,
    mimeType: parsedInput.mimeType,
    fileInfo: detectFileType(bytes, parsedInput.mimeType)
  };
}

export function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 bytes';
  }

  const units = ['bytes', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export const TEXT_PREVIEW_BYTE_LIMIT = 256 * 1024;

const browserPreviewImageTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/avif',
  'image/x-icon'
]);

const browserPreviewTextTypes = new Set([
  'application/json',
  'application/xml',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/xml'
]);

export function getFilePreviewKind(mimeType) {
  const normalisedMimeType = normaliseMimeType(mimeType);

  if (!normalisedMimeType) {
    return 'unsupported';
  }

  if (normalisedMimeType.startsWith('text/') || browserPreviewTextTypes.has(normalisedMimeType)) {
    return 'text';
  }

  if (browserPreviewImageTypes.has(normalisedMimeType)) {
    return 'image';
  }

  if (normalisedMimeType === 'application/pdf') {
    return 'pdf';
  }

  if (normalisedMimeType.startsWith('audio/')) {
    return 'audio';
  }

  if (normalisedMimeType === 'video/mp4' || normalisedMimeType === 'video/webm') {
    return 'video';
  }

  return 'unsupported';
}

export function formatTextPreview(value, mimeType, truncated = false) {
  const normalisedMimeType = normaliseMimeType(mimeType);
  let text = value;

  if (!truncated && normalisedMimeType === 'application/json') {
    try {
      text = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      text = value;
    }
  }

  return {
    text,
    truncated
  };
}

export function startsWithBytes(bytes, signature, offset = 0) {
  if (bytes.length < offset + signature.length) {
    return false;
  }

  return signature.every((value, index) => bytes[offset + index] === value);
}

export function bytesToAscii(bytes, start = 0, length = bytes.length - start) {
  return Array.from(bytes.slice(start, start + length))
    .map(value => String.fromCharCode(value))
    .join('');
}

export function containsAscii(bytes, value) {
  return bytesToAscii(bytes).includes(value);
}

export function detectTextType(bytes, mimeType) {
  if (mimeType) {
    return null;
  }

  const text = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.slice(0, Math.min(bytes.length, 4096)))
    .trimStart();

  if (!text) {
    return null;
  }

  if (/<!doctype html/i.test(text) || /<html[\s>]/i.test(text)) {
    return { mimeType: 'text/html', extension: 'html', label: 'HTML document' };
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      JSON.parse(new TextDecoder('utf-8', { fatal: false }).decode(bytes));
      return { mimeType: 'application/json', extension: 'json', label: 'JSON document' };
    } catch {
      return null;
    }
  }

  if (text.startsWith('<?xml') || /^<[A-Za-z][\s\S]*>/.test(text)) {
    if (text.includes('<svg')) {
      return { mimeType: 'image/svg+xml', extension: 'svg', label: 'SVG image' };
    }

    return { mimeType: 'application/xml', extension: 'xml', label: 'XML document' };
  }

  const sample = bytes.slice(0, Math.min(bytes.length, 1024));
  const controlCharacters = sample.filter(value => value < 9 || (value > 13 && value < 32)).length;

  if (sample.length > 0 && controlCharacters / sample.length < 0.02) {
    return { mimeType: 'text/plain', extension: 'txt', label: 'Text file' };
  }

  return null;
}

export function detectOfficeOpenXml(bytes) {
  if (!startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) && !startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) && !startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08])) {
    return null;
  }

  const sampleLength = Math.min(bytes.length, 500000);
  const head = bytes.slice(0, sampleLength);
  const tail = bytes.slice(Math.max(0, bytes.length - sampleLength));
  const searchableBytes = new Uint8Array(head.length + tail.length);
  searchableBytes.set(head, 0);
  searchableBytes.set(tail, head.length);

  if (containsAscii(searchableBytes, 'word/')) {
    return {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
      label: 'Word document'
    };
  }

  if (containsAscii(searchableBytes, 'xl/')) {
    return {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      label: 'Excel workbook'
    };
  }

  if (containsAscii(searchableBytes, 'ppt/')) {
    return {
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      extension: 'pptx',
      label: 'PowerPoint presentation'
    };
  }

  return { mimeType: 'application/zip', extension: 'zip', label: 'ZIP archive' };
}

export function detectFileType(bytes, mimeTypeFromDataUrl) {
  const normalisedMimeType = mimeTypeFromDataUrl ? mimeTypeFromDataUrl.toLowerCase() : null;

  if (normalisedMimeType && mimeExtensionMap.has(normalisedMimeType)) {
    return {
      mimeType: normalisedMimeType,
      extension: mimeExtensionMap.get(normalisedMimeType),
      label: normalisedMimeType
    };
  }

  if (startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mimeType: 'application/pdf', extension: 'pdf', label: 'PDF document' };
  }

  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: 'image/png', extension: 'png', label: 'PNG image' };
  }

  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return { mimeType: 'image/jpeg', extension: 'jpg', label: 'JPEG image' };
  }

  if (startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) {
    return { mimeType: 'image/gif', extension: 'gif', label: 'GIF image' };
  }

  if (startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mimeType: 'image/webp', extension: 'webp', label: 'WebP image' };
  }

  if (startsWithBytes(bytes, [0x42, 0x4d])) {
    return { mimeType: 'image/bmp', extension: 'bmp', label: 'BMP image' };
  }

  if (startsWithBytes(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWithBytes(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return { mimeType: 'image/tiff', extension: 'tiff', label: 'TIFF image' };
  }

  if (startsWithBytes(bytes, [0x25, 0x21, 0x50, 0x53])) {
    return { mimeType: 'application/postscript', extension: 'ps', label: 'PostScript document' };
  }

  if (startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return { mimeType: 'application/vnd.ms-office', extension: 'doc', label: 'Legacy Microsoft Office document' };
  }

  const officeOpenXml = detectOfficeOpenXml(bytes);

  if (officeOpenXml) {
    return officeOpenXml;
  }

  if (startsWithBytes(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) {
    return { mimeType: 'application/x-7z-compressed', extension: '7z', label: '7-Zip archive' };
  }

  if (startsWithBytes(bytes, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]) || startsWithBytes(bytes, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00])) {
    return { mimeType: 'application/x-rar-compressed', extension: 'rar', label: 'RAR archive' };
  }

  if (startsWithBytes(bytes, [0x1f, 0x8b, 0x08])) {
    return { mimeType: 'application/gzip', extension: 'gz', label: 'GZip archive' };
  }

  if (bytes.length > 262 && bytesToAscii(bytes, 257, 5) === 'ustar') {
    return { mimeType: 'application/x-tar', extension: 'tar', label: 'TAR archive' };
  }

  if (startsWithBytes(bytes, [0x49, 0x44, 0x33]) || startsWithBytes(bytes, [0xff, 0xfb]) || startsWithBytes(bytes, [0xff, 0xf3]) || startsWithBytes(bytes, [0xff, 0xf2])) {
    return { mimeType: 'audio/mpeg', extension: 'mp3', label: 'MP3 audio' };
  }

  if (startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(bytes, [0x57, 0x41, 0x56, 0x45], 8)) {
    return { mimeType: 'audio/wav', extension: 'wav', label: 'WAV audio' };
  }

  if (startsWithBytes(bytes, [0x4f, 0x67, 0x67, 0x53])) {
    return { mimeType: 'audio/ogg', extension: 'ogg', label: 'OGG media' };
  }

  if (startsWithBytes(bytes, [0x00, 0x00, 0x00]) && bytesToAscii(bytes, 4, 4) === 'ftyp') {
    return { mimeType: 'video/mp4', extension: 'mp4', label: 'MP4 video' };
  }

  if (startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { mimeType: 'video/webm', extension: 'webm', label: 'WebM video' };
  }

  const textType = detectTextType(bytes, normalisedMimeType);

  if (textType) {
    return textType;
  }

  if (normalisedMimeType) {
    return {
      mimeType: normalisedMimeType,
      extension: mimeExtensionMap.get(normalisedMimeType) || 'bin',
      label: normalisedMimeType
    };
  }

  return { mimeType: 'application/octet-stream', extension: 'bin', label: 'Binary file' };
}

export function normaliseFileName(value, extension) {
  const trimmed = value.trim();
  const safeBaseName = trimmed || 'converted';
  const safeName = safeBaseName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  const finalExtension = extension || 'bin';
  const extensionPattern = new RegExp(`\\.${finalExtension}$`, 'i');

  return extensionPattern.test(safeName) ? safeName : `${safeName}.${finalExtension}`;
}

export function normaliseTextFileName(value, selectedFileName) {
  const fallbackName = selectedFileName ? `${selectedFileName}.base64.txt` : 'converted-base64.txt';
  const safeName = (value.trim() || fallbackName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');

  return /\.(txt|b64|base64)$/i.test(safeName) ? safeName : `${safeName}.txt`;
}

function decodeBase64String(base64) {
  if (typeof atob === 'function') {
    return atob(base64);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('binary');
  }

  throw new Error('This environment cannot decode Base64.');
}

function normaliseMimeType(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}
