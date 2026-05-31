import {
  IMAGE_FILE_ACCEPT,
  IMAGE_FORMATS,
  MAX_IMAGE_DIMENSION,
  calculateContainDimensions,
  normaliseImageFormat
} from './image-converter.js';

export const IMAGE_RESIZER_FILE_ACCEPT = IMAGE_FILE_ACCEPT;
export const IMAGE_RESIZER_OUTPUT_FORMATS = IMAGE_FORMATS.filter(format => format.kind === 'raster');
export const IMAGE_RESIZE_MODES = [
  { value: 'scale', label: 'Scale (%)' },
  { value: 'dimensions', label: 'Maximum dimensions' },
  { value: 'target-size', label: 'Target file size' }
];

export const DEFAULT_IMAGE_SCALE_PERCENT = 50;
export const MIN_IMAGE_SCALE_PERCENT = 1;
export const MAX_IMAGE_SCALE_PERCENT = 100;
export const DEFAULT_IMAGE_QUALITY_PERCENT = 82;
export const MIN_IMAGE_QUALITY_PERCENT = 10;
export const MAX_IMAGE_QUALITY_PERCENT = 100;
export const MIN_TARGET_FILE_BYTES = 1024;
export const MAX_TARGET_FILE_BYTES = 100 * 1024 * 1024;

const targetUnits = new Map([
  ['kb', 1024],
  ['mb', 1024 * 1024]
]);

export function normaliseOutputImageFormat(value) {
  const format = normaliseImageFormat(value);

  if (format.kind !== 'raster') {
    throw new Error('Choose PNG, JPEG or WebP as the output format.');
  }

  return format;
}

export function normaliseResizeMode(value) {
  const mode = String(value || '').trim().toLocaleLowerCase('en-GB');

  if (!IMAGE_RESIZE_MODES.some(option => option.value === mode)) {
    throw new Error('Choose a supported resize mode.');
  }

  return mode;
}

export function normaliseScalePercent(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error('Scale must be a number between 1% and 100%.');
  }

  if (parsed < MIN_IMAGE_SCALE_PERCENT || parsed > MAX_IMAGE_SCALE_PERCENT) {
    throw new Error('Scale must be between 1% and 100%.');
  }

  return Math.round(parsed);
}

export function normaliseQualityPercent(value, targetFormat) {
  const format = typeof targetFormat === 'string' ? normaliseOutputImageFormat(targetFormat) : targetFormat;

  if (!format || (format.value !== 'jpeg' && format.value !== 'webp')) {
    return null;
  }

  const text = String(value ?? '').trim();
  const parsed = text ? Number(text) : DEFAULT_IMAGE_QUALITY_PERCENT;

  if (!Number.isFinite(parsed)) {
    throw new Error('Quality must be a number between 10% and 100%.');
  }

  if (parsed < MIN_IMAGE_QUALITY_PERCENT || parsed > MAX_IMAGE_QUALITY_PERCENT) {
    throw new Error('Quality must be between 10% and 100%.');
  }

  return Math.round(parsed);
}

export function normaliseMaxResizeDimensions(options = {}) {
  const maxWidth = normaliseOptionalDimension(options.maxWidth, 'Max width');
  const maxHeight = normaliseOptionalDimension(options.maxHeight, 'Max height');

  if (!maxWidth && !maxHeight) {
    throw new Error('Enter a maximum width, maximum height or both.');
  }

  return {
    maxWidth,
    maxHeight
  };
}

export function normaliseTargetFileSize(value, unit = 'KB') {
  const parsed = Number(String(value ?? '').trim());
  const unitKey = String(unit || '').trim().toLocaleLowerCase('en-GB');
  const multiplier = targetUnits.get(unitKey);

  if (!multiplier) {
    throw new Error('Choose KB or MB for the target file size.');
  }

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Target file size must be a positive number.');
  }

  const bytes = Math.round(parsed * multiplier);

  if (bytes < MIN_TARGET_FILE_BYTES || bytes > MAX_TARGET_FILE_BYTES) {
    throw new Error('Target file size must be between 1 KB and 100 MB.');
  }

  return bytes;
}

export function calculateScaleDimensions(width, height, scalePercent) {
  const sourceWidth = normaliseSourceDimension(width, 'Image width');
  const sourceHeight = normaliseSourceDimension(height, 'Image height');
  const percent = normaliseScalePercent(scalePercent);
  const scale = Math.min(1, percent / 100);

  return buildDimensionResult(sourceWidth, sourceHeight, scale);
}

export function calculateMaxResizeDimensions(width, height, options = {}) {
  const sourceWidth = normaliseSourceDimension(width, 'Image width');
  const sourceHeight = normaliseSourceDimension(height, 'Image height');
  const dimensions = calculateContainDimensions(sourceWidth, sourceHeight, normaliseMaxResizeDimensions(options));

  return {
    width: dimensions.width,
    height: dimensions.height,
    scale: dimensions.scale
  };
}

export function calculateDimensionScale(width, height, scale) {
  const sourceWidth = normaliseSourceDimension(width, 'Image width');
  const sourceHeight = normaliseSourceDimension(height, 'Image height');
  const parsedScale = Number(scale);

  if (!Number.isFinite(parsedScale) || parsedScale <= 0) {
    throw new Error('Dimension scale must be greater than zero.');
  }

  return buildDimensionResult(sourceWidth, sourceHeight, Math.min(1, parsedScale));
}

export function buildImageResizerOutputFileName(inputName, targetFormat) {
  const format = typeof targetFormat === 'string' ? normaliseOutputImageFormat(targetFormat) : targetFormat;
  const sourceName = String(inputName || '').trim() || 'image';
  const safeName = sourceName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.+$/g, '') || 'image';
  const baseName = safeName.replace(/\.[A-Za-z0-9]+$/, '') || 'image';

  return `${baseName}.resized.${format.extension}`;
}

export function buildImageResizeWarnings(options = {}) {
  const sourceFormat = options.sourceFormat;
  const targetFormat = options.targetFormat;
  const warnings = [];

  if (sourceFormat?.value === 'svg') {
    warnings.push('SVG input is rasterised before resizing.');
  }

  if (targetFormat?.value === 'jpeg') {
    warnings.push('JPEG output uses a white background where the source has transparency.');
  }

  if (options.mode === 'target-size' && targetFormat?.value === 'png') {
    warnings.push('PNG output is reduced through dimensions because browser PNG quality is not adjustable.');
  }

  if (options.dimensions && options.dimensions.scale >= 1 && options.mode !== 'target-size') {
    warnings.push('Dimensions stayed at the original size because the requested size would upscale the image.');
  }

  if (Number.isFinite(options.sourceBytes) && Number.isFinite(options.outputBytes) && options.outputBytes >= options.sourceBytes) {
    warnings.push('The output is not smaller than the original with these settings.');
  }

  if (Number.isFinite(options.targetBytes) && Number.isFinite(options.outputBytes) && options.outputBytes > options.targetBytes) {
    warnings.push('The requested target file size could not be reached.');
  }

  return [...new Set(warnings)];
}

export function summariseImageSizeChange(sourceBytes, outputBytes) {
  const source = normaliseByteCount(sourceBytes, 'Source size');
  const output = normaliseByteCount(outputBytes, 'Output size');
  const savedBytes = source - output;
  const savedPercent = source === 0 ? 0 : Math.round((savedBytes / source) * 100);

  return {
    sourceBytes: source,
    outputBytes: output,
    savedBytes,
    savedPercent
  };
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

function normaliseByteCount(value, label) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be zero or more bytes.`);
  }

  return Math.round(parsed);
}

function buildDimensionResult(sourceWidth, sourceHeight, scale) {
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
    scale
  };
}
