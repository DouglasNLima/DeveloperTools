export const IMAGE_OCR_LANGUAGE = {
  code: 'eng',
  label: 'English'
};

export const IMAGE_OCR_FILE_ACCEPT = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.gif',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/gif'
].join(',');

export const IMAGE_OCR_SUPPORTED_FORMATS = [
  {
    value: 'png',
    label: 'PNG',
    mimeTypes: ['image/png'],
    extensions: ['png']
  },
  {
    value: 'jpeg',
    label: 'JPEG',
    mimeTypes: ['image/jpeg'],
    extensions: ['jpg', 'jpeg']
  },
  {
    value: 'webp',
    label: 'WebP',
    mimeTypes: ['image/webp'],
    extensions: ['webp']
  },
  {
    value: 'bmp',
    label: 'BMP',
    mimeTypes: ['image/bmp', 'image/x-ms-bmp'],
    extensions: ['bmp']
  },
  {
    value: 'gif',
    label: 'GIF',
    mimeTypes: ['image/gif'],
    extensions: ['gif']
  }
];

export const IMAGE_OCR_OUTPUT_MIME_TYPE = 'text/plain;charset=utf-8';

const formatByMimeType = new Map(
  IMAGE_OCR_SUPPORTED_FORMATS.flatMap(format => (
    format.mimeTypes.map(mimeType => [mimeType, format])
  ))
);
const formatByExtension = new Map(
  IMAGE_OCR_SUPPORTED_FORMATS.flatMap(format => (
    format.extensions.map(extension => [extension, format])
  ))
);

export function detectOcrImageFileType(file) {
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

export function validateOcrImageFile(file) {
  if (!file) {
    throw new Error('Select an image before running OCR.');
  }

  const format = detectOcrImageFileType(file);

  if (!format) {
    throw new Error(`Unsupported image type: ${file.name || 'selected file'}. Choose PNG, JPEG, WebP, BMP or non-animated GIF.`);
  }

  return format;
}

export function buildOcrOutputFileName(inputName) {
  const sourceName = String(inputName || '').trim() || 'image';
  const safeName = sourceName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.+$/g, '') || 'image';
  const baseName = safeName.replace(/(?:\.ocr)?\.[A-Za-z0-9]+$/i, '') || 'image';

  return `${baseName}.ocr.txt`;
}

export function normaliseOcrText(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

export function normaliseOcrConfidence(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(100, Math.max(0, parsed));
}

export function formatOcrConfidence(value) {
  const confidence = normaliseOcrConfidence(value);

  if (confidence === null) {
    return 'Unknown';
  }

  return `${confidence.toLocaleString('en-GB', {
    maximumFractionDigits: 1
  })}%`;
}

export function countOcrWords(text) {
  const normalised = normaliseOcrText(text);

  if (!normalised) {
    return 0;
  }

  return normalised.split(/\s+/).filter(Boolean).length;
}

export function buildOcrResult(data = {}, file = {}, sourceFormat = null) {
  const text = normaliseOcrText(data.text);
  const confidence = normaliseOcrConfidence(data.confidence);

  return {
    text,
    displayText: text || 'No text was detected.',
    confidence,
    confidenceLabel: formatOcrConfidence(confidence),
    wordCount: countOcrWords(text),
    sourceFileName: file?.name || 'Selected image',
    sourceFormat,
    outputName: buildOcrOutputFileName(file?.name)
  };
}

export function createOcrTextBlob(text) {
  return new Blob([normaliseOcrText(text) || 'No text was detected.'], {
    type: IMAGE_OCR_OUTPUT_MIME_TYPE
  });
}

export function normaliseOcrProgressStatus(progress = {}) {
  const status = String(progress.status || '').trim().toLocaleLowerCase('en-GB');
  const percentage = normaliseProgressPercentage(progress.progress);
  const label = getOcrProgressLabel(status);

  return percentage === null ? label : `${label} (${percentage}%)`;
}

export function buildTesseractWorkerOptions(logger) {
  return {
    workerPath: new URL('../vendor/tesseract/worker.min.js', import.meta.url).href,
    corePath: new URL('../vendor/tesseract/core', import.meta.url).href,
    langPath: new URL('../vendor/tesseract/lang', import.meta.url).href,
    cacheMethod: 'write',
    gzip: true,
    workerBlobURL: false,
    logger
  };
}

export async function recogniseImageFile(file, options = {}) {
  const sourceFormat = validateOcrImageFile(file);
  const tesseract = options.tesseract || await loadTesseractRuntime();
  const worker = await tesseract.createWorker(
    IMAGE_OCR_LANGUAGE.code,
    tesseract.OEM?.LSTM_ONLY ?? 1,
    buildTesseractWorkerOptions(options.onProgress)
  );

  try {
    const recognition = await worker.recognize(file, {}, { text: true });
    return buildOcrResult(recognition?.data, file, sourceFormat);
  } finally {
    await worker.terminate();
  }
}

async function loadTesseractRuntime() {
  const module = await import('../vendor/tesseract/tesseract.esm.min.js');
  return module.default;
}

function getFileExtension(fileName) {
  const match = String(fileName || '').trim().toLocaleLowerCase('en-GB').match(/\.([a-z0-9]+)$/);

  return match ? match[1] : '';
}

function normaliseProgressPercentage(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(parsed * 100)));
}

function getOcrProgressLabel(status) {
  if (status.includes('loading tesseract core')) {
    return 'Loading OCR engine';
  }

  if (status.includes('initializing tesseract') || status.includes('initializing api')) {
    return 'Initialising OCR engine';
  }

  if (status.includes('loading language')) {
    return 'Loading English OCR data';
  }

  if (status.includes('recognizing text')) {
    return 'Recognising text';
  }

  return 'Running OCR';
}
