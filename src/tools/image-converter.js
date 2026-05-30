export const IMAGE_FORMATS = [
  {
    value: 'png',
    label: 'PNG',
    mimeType: 'image/png',
    extension: 'png',
    kind: 'raster'
  },
  {
    value: 'jpeg',
    label: 'JPEG',
    mimeType: 'image/jpeg',
    extension: 'jpg',
    kind: 'raster'
  },
  {
    value: 'webp',
    label: 'WebP',
    mimeType: 'image/webp',
    extension: 'webp',
    kind: 'raster'
  },
  {
    value: 'svg',
    label: 'SVG',
    mimeType: 'image/svg+xml',
    extension: 'svg',
    kind: 'vector'
  }
];

export const IMAGE_FILE_ACCEPT = '.svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp';
export const DEFAULT_RASTER_QUALITY = 0.92;
export const MIN_RASTER_QUALITY = 0.1;
export const MAX_RASTER_QUALITY = 1;
export const MAX_IMAGE_DIMENSION = 12000;

const formatByValue = new Map(IMAGE_FORMATS.map(format => [format.value, format]));
const formatByMimeType = new Map(IMAGE_FORMATS.map(format => [format.mimeType, format]));
const formatByExtension = new Map([
  ['svg', formatByValue.get('svg')],
  ['png', formatByValue.get('png')],
  ['jpg', formatByValue.get('jpeg')],
  ['jpeg', formatByValue.get('jpeg')],
  ['webp', formatByValue.get('webp')]
]);

export function normaliseImageFormat(value) {
  const normalised = String(value || '').trim().toLocaleLowerCase('en-GB');
  const format = formatByValue.get(normalised);

  if (!format) {
    throw new Error('Choose a supported target image format.');
  }

  return format;
}

export function detectImageFileType(file) {
  const mimeType = String(file?.type || '').trim().toLocaleLowerCase('en-GB');
  const extension = getFileExtension(file?.name);

  if (mimeType && formatByMimeType.has(mimeType)) {
    return formatByMimeType.get(mimeType);
  }

  if (extension && formatByExtension.has(extension)) {
    return formatByExtension.get(extension);
  }

  return null;
}

export function validateImageFile(file) {
  if (!file) {
    throw new Error('Select one or more image files before converting.');
  }

  const format = detectImageFileType(file);

  if (!format) {
    throw new Error(`Unsupported image type: ${file.name || 'selected file'}. Choose SVG, PNG, JPEG or WebP.`);
  }

  return format;
}

export function determineConversionMode(sourceFormat, targetFormat) {
  const source = typeof sourceFormat === 'string' ? normaliseImageFormat(sourceFormat) : sourceFormat;
  const target = typeof targetFormat === 'string' ? normaliseImageFormat(targetFormat) : targetFormat;

  if (!source || !target) {
    throw new Error('Choose a supported source and target image format.');
  }

  if (source.value === 'svg' && target.value === 'svg') {
    return 'svg-pass-through';
  }

  if (source.value === 'svg' && target.kind === 'raster') {
    return 'svg-to-raster';
  }

  if (source.kind === 'raster' && target.value === 'svg') {
    return 'raster-to-svg';
  }

  if (source.kind === 'raster' && target.kind === 'raster') {
    return 'raster-to-raster';
  }

  throw new Error('This image conversion path is not supported.');
}

export function normaliseRasterQuality(value, targetFormat) {
  const target = typeof targetFormat === 'string' ? normaliseImageFormat(targetFormat) : targetFormat;

  if (!target || (target.value !== 'jpeg' && target.value !== 'webp')) {
    return null;
  }

  if (String(value ?? '').trim() === '') {
    return DEFAULT_RASTER_QUALITY;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_RASTER_QUALITY;
  }

  return Math.min(MAX_RASTER_QUALITY, Math.max(MIN_RASTER_QUALITY, parsed));
}

export function normaliseResizeOptions(options = {}) {
  const maxWidth = normaliseOptionalDimension(options.maxWidth, 'Max width');
  const maxHeight = normaliseOptionalDimension(options.maxHeight, 'Max height');

  return {
    maxWidth,
    maxHeight,
    hasResize: Boolean(maxWidth || maxHeight)
  };
}

export function calculateContainDimensions(width, height, resizeOptions = {}) {
  const sourceWidth = normaliseSourceDimension(width, 'Image width');
  const sourceHeight = normaliseSourceDimension(height, 'Image height');
  const options = normaliseResizeOptions(resizeOptions);
  const widthScale = options.maxWidth ? options.maxWidth / sourceWidth : 1;
  const heightScale = options.maxHeight ? options.maxHeight / sourceHeight : 1;
  const scale = Math.min(1, widthScale, heightScale);

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
    scale
  };
}

export function normaliseBackgroundColour(value) {
  const colour = String(value || '#ffffff').trim();

  if (/^#[0-9a-f]{6}$/i.test(colour)) {
    return colour.toLowerCase();
  }

  if (/^#[0-9a-f]{3}$/i.test(colour)) {
    return `#${colour[1]}${colour[1]}${colour[2]}${colour[2]}${colour[3]}${colour[3]}`.toLowerCase();
  }

  throw new Error('Enter a valid background colour as a hex value.');
}

export function buildImageOutputFileName(inputName, targetFormat) {
  const target = typeof targetFormat === 'string' ? normaliseImageFormat(targetFormat) : targetFormat;
  const sourceName = String(inputName || '').trim() || 'converted-image';
  const safeName = sourceName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.+$/g, '') || 'converted-image';
  const extensionPattern = /\.[A-Za-z0-9]+$/;
  const baseName = safeName.replace(extensionPattern, '');

  return `${baseName || 'converted-image'}.${target.extension}`;
}

export function buildEmbeddedRasterSvg(options = {}) {
  const width = normaliseSourceDimension(options.width, 'Image width');
  const height = normaliseSourceDimension(options.height, 'Image height');
  const dataUrl = String(options.dataUrl || '').trim();
  const title = String(options.title || 'Embedded raster image').trim() || 'Embedded raster image';

  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('A raster image Data URL is required before creating SVG output.');
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXmlAttribute(title)}">`,
    `  <title>${escapeXmlText(title)}</title>`,
    `  <image href="${escapeXmlAttribute(dataUrl)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`,
    '</svg>'
  ].join('\n');
}

export function assertSafeSvgText(svgText) {
  const text = String(svgText || '').trim();

  if (!text) {
    throw new Error('SVG input is empty.');
  }

  if (!/<svg[\s>]/i.test(text)) {
    throw new Error('The selected file does not contain an SVG document.');
  }

  if (hasExternalSvgReference(text)) {
    throw new Error('SVG files with external references are not converted because this app does not make network requests.');
  }

  return text;
}

export function buildImageConversionWarnings(options = {}) {
  const sourceFormat = typeof options.sourceFormat === 'string' ? normaliseImageFormat(options.sourceFormat) : options.sourceFormat;
  const targetFormat = typeof options.targetFormat === 'string' ? normaliseImageFormat(options.targetFormat) : options.targetFormat;
  const warnings = [];

  if (sourceFormat?.kind === 'raster' && targetFormat?.value === 'svg') {
    warnings.push('SVG output embeds the raster image; it does not vectorise pixels into paths.');
  }

  if (targetFormat?.value === 'jpeg') {
    warnings.push('JPEG output uses the selected background colour where the source has transparency.');
  }

  if (options.resized) {
    warnings.push('The image was resized to fit the requested maximum dimensions.');
  }

  return warnings;
}

export function getFormatLabel(value) {
  return normaliseImageFormat(value).label;
}

function getFileExtension(fileName) {
  const match = String(fileName || '').trim().toLocaleLowerCase('en-GB').match(/\.([a-z0-9]+)$/);

  return match ? match[1] : '';
}

function normaliseOptionalDimension(value, label) {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  const parsed = Number(text);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive whole number.`);
  }

  if (parsed > MAX_IMAGE_DIMENSION) {
    throw new Error(`${label} must be ${MAX_IMAGE_DIMENSION.toLocaleString('en-GB')} px or less.`);
  }

  return parsed;
}

function normaliseSourceDimension(value, label) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} could not be detected.`);
  }

  return Math.max(1, Math.round(parsed));
}

function hasExternalSvgReference(svgText) {
  return /(?:href|src)\s*=\s*["']\s*(?:https?:)?\/\//i.test(svgText)
    || /url\(\s*["']?\s*(?:https?:)?\/\//i.test(svgText);
}

function escapeXmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
