import {
  EMU_PER_INCH,
  WordImageExtractorError,
  detectImageFormat,
  readWordImageDocument,
  validateWordPackage
} from './word-image-extractor.js';
import { replaceZipArchiveEntries } from './power-platform-solution.js';

export const WORD_OPTIMISATION_PRESETS = Object.freeze([
  {
    id: 'lossless',
    value: 'lossless',
    label: 'Lossless clean-up',
    targetPpi: null,
    description: 'Keeps image pixels and formats unchanged; no meaningful safe clean-up is applied.'
  },
  {
    id: 'high-fidelity',
    value: 'high-fidelity',
    label: 'High fidelity',
    targetPpi: 220,
    description: 'Targets approximately 220 PPI for high-quality documents and printing.'
  },
  {
    id: 'documentation',
    value: 'documentation',
    label: 'Documentation',
    targetPpi: 180,
    description: 'Targets approximately 180 PPI for technical documentation and normal office viewing.'
  },
  {
    id: 'smaller-file',
    value: 'smaller-file',
    label: 'Smaller file',
    targetPpi: 150,
    description: 'Targets approximately 150 PPI for a more aggressive, legibility-first reduction.'
  }
]);

export const WORD_OPTIMISER_PRESETS = WORD_OPTIMISATION_PRESETS;
export const DEFAULT_WORD_OPTIMISATION_PRESET = 'documentation';
export const DEFAULT_WORD_OPTIMISER_PRESET = DEFAULT_WORD_OPTIMISATION_PRESET;

export const WORD_OPTIMISER_LIMITS = Object.freeze({
  maxDecodedRasterWidth: 12000,
  maxDecodedRasterHeight: 12000,
  maxDecodedRasterPixels: 100_000_000,
  maxRebuiltPackageBytes: 128 * 1024 * 1024
});

export const WORD_OPTIMISER_STATUS = Object.freeze({
  OPTIMISE: 'optimise',
  ALREADY_EFFICIENT: 'already-efficient',
  PRESERVE: 'preserve',
  UNSUPPORTED: 'unsupported',
  UNKNOWN_DISPLAY: 'unable-to-determine-display-size'
});

const PRESET_BY_ID = new Map(WORD_OPTIMISATION_PRESETS.map(preset => [preset.id, preset]));
const OPTIMISABLE_RASTER_FORMATS = new Set(['png', 'jpeg', 'webp']);
const RASTER_FORMATS = new Set(['png', 'jpeg', 'gif', 'bmp', 'webp', 'tiff', 'ico']);
const VECTOR_FORMATS = new Set(['svg', 'emf', 'wmf']);

export function normaliseWordOptimisationPreset(value) {
  const normalised = String(value || '').trim().toLocaleLowerCase('en-GB');
  const aliases = new Map([
    ['lossless-clean-up', 'lossless'],
    ['lossless-cleanup', 'lossless'],
    ['lossless', 'lossless'],
    ['highfidelity', 'high-fidelity'],
    ['high-fidelity', 'high-fidelity'],
    ['documentation', 'documentation'],
    ['smaller', 'smaller-file'],
    ['smaller-file', 'smaller-file']
  ]);
  const presetId = aliases.get(normalised) || DEFAULT_WORD_OPTIMISATION_PRESET;

  return PRESET_BY_ID.get(presetId);
}

export const normaliseWordOptimiserPreset = normaliseWordOptimisationPreset;

export function getWordOptimisationPreset(value) {
  return normaliseWordOptimisationPreset(value);
}

/**
 * Calculate one-dimensional effective image density in pixels per inch.
 */
export function calculateEffectivePpi(sourcePixels, displayedInches) {
  const pixels = Number(sourcePixels);
  const inches = Number(displayedInches);

  if (!Number.isFinite(pixels) || pixels <= 0 || !Number.isFinite(inches) || inches <= 0) {
    return null;
  }

  return pixels / inches;
}

export const calculateImageEffectivePpi = calculateEffectivePpi;

export function calculateDisplayedPpi(sourceDimensions, displaySize) {
  const sourceWidth = Number(sourceDimensions?.width);
  const sourceHeight = Number(sourceDimensions?.height);
  const displayWidth = Number(displaySize?.widthInches);
  const displayHeight = Number(displaySize?.heightInches);
  const widthPpi = calculateEffectivePpi(sourceWidth, displayWidth);
  const heightPpi = calculateEffectivePpi(sourceHeight, displayHeight);
  const validPpi = [widthPpi, heightPpi].filter(Number.isFinite);

  return {
    widthPpi,
    heightPpi,
    effectivePpi: validPpi.length ? Math.max(...validPpi) : null
  };
}

/**
 * Calculate a contained target size from source pixels, physical display
 * size and a target PPI. The scale is always capped at one, so this helper
 * can never upscale a source image.
 */
export function calculateTargetDimensions(options, legacyHeight, legacyDisplayWidth, legacyDisplayHeight, legacyTargetPpi) {
  let sourceWidth;
  let sourceHeight;
  let displayWidthInches;
  let displayHeightInches;
  let targetPpi;

  if (typeof options === 'number') {
    sourceWidth = options;
    sourceHeight = legacyHeight;
    displayWidthInches = legacyDisplayWidth;
    displayHeightInches = legacyDisplayHeight;
    targetPpi = legacyTargetPpi;
  } else {
    sourceWidth = options?.sourceWidth ?? options?.width ?? options?.sourceDimensions?.width;
    sourceHeight = options?.sourceHeight ?? options?.height ?? options?.sourceDimensions?.height;
    displayWidthInches = options?.displayWidthInches
      ?? options?.displaySize?.widthInches
      ?? options?.displayedWidthInches;
    displayHeightInches = options?.displayHeightInches
      ?? options?.displaySize?.heightInches
      ?? options?.displayedHeightInches;
    targetPpi = options?.targetPpi ?? options?.ppi;
  }

  sourceWidth = normalisePositiveDimension(sourceWidth);
  sourceHeight = normalisePositiveDimension(sourceHeight);
  displayWidthInches = normalisePositiveNumber(displayWidthInches);
  displayHeightInches = normalisePositiveNumber(displayHeightInches);
  targetPpi = normalisePositiveNumber(targetPpi);

  if (![sourceWidth, sourceHeight, displayWidthInches, displayHeightInches, targetPpi].every(Number.isFinite)) {
    return null;
  }

  const requestedWidth = Math.max(1, Math.round(displayWidthInches * targetPpi));
  const requestedHeight = Math.max(1, Math.round(displayHeightInches * targetPpi));
  const scale = Math.min(1, requestedWidth / sourceWidth, requestedHeight / sourceHeight);
  const width = Math.max(1, Math.min(sourceWidth, Math.round(sourceWidth * scale)));
  const height = Math.max(1, Math.min(sourceHeight, Math.round(sourceHeight * scale)));

  return {
    width,
    height,
    targetWidth: requestedWidth,
    targetHeight: requestedHeight,
    scale,
    targetPpi
  };
}

export const calculateOptimisedDimensions = calculateTargetDimensions;
export const calculateOptimizedDimensions = calculateTargetDimensions;

/**
 * Build a deterministic, side-effect-free plan. The plan only recommends
 * browser work; it never decodes or replaces image bytes.
 */
export function buildWordOptimisationPlan(document, options = {}) {
  const preset = normaliseWordOptimisationPreset(options.preset ?? options.presetId);
  const suppliedKeepOriginal = options.keepOriginalIds ?? options.keepOriginal ?? [];
  const keepOriginalIds = new Set(
    suppliedKeepOriginal instanceof Set || Array.isArray(suppliedKeepOriginal)
      ? suppliedKeepOriginal
      : suppliedKeepOriginal ? [suppliedKeepOriginal] : []
  );
  const assets = (document?.embeddedAssets || document?.assets || [])
    .filter(asset => asset?.isEmbedded)
    .slice()
    .sort(compareAssets);

  return assets.map(asset => buildAssetPlan(asset, preset, keepOriginalIds));
}

export const buildWordOptimizerPlan = buildWordOptimisationPlan;

function buildAssetPlan(asset, preset, keepOriginalIds) {
  const originalWidth = normalisePositiveDimension(asset.width ?? asset.dimensions?.width);
  const originalHeight = normalisePositiveDimension(asset.height ?? asset.dimensions?.height);
  const originalBytes = Math.max(0, Number(asset.fileSize ?? asset.size ?? asset.bytes?.byteLength) || 0);
  const displaySize = normaliseDisplaySize(asset.displaySize, asset);
  const ppi = calculateDisplayedPpi(
    { width: originalWidth, height: originalHeight },
    displaySize
  );
  const targetDimensions = preset.targetPpi && displaySize && originalWidth && originalHeight
    ? calculateTargetDimensions({
      sourceWidth: originalWidth,
      sourceHeight: originalHeight,
      displayWidthInches: displaySize.widthInches,
      displayHeightInches: displaySize.heightInches,
      targetPpi: preset.targetPpi
    })
    : null;
  const format = String(asset.format || '').toLocaleLowerCase('en-GB');
  const isKeepOriginal = keepOriginalIds.has(asset.id) || keepOriginalIds.has(asset.packagePath);
  let status = WORD_OPTIMISER_STATUS.PRESERVE;
  let reason = '';

  if (isKeepOriginal) {
    reason = 'Keep original was selected for this asset.';
  } else if (VECTOR_FORMATS.has(format)) {
    status = WORD_OPTIMISER_STATUS.UNSUPPORTED;
    reason = 'Vector artwork is preserved unchanged by default.';
  } else if (!OPTIMISABLE_RASTER_FORMATS.has(format)) {
    status = WORD_OPTIMISER_STATUS.UNSUPPORTED;
    reason = 'This raster format is not re-encoded by the conservative browser optimiser.';
  } else if (!originalWidth || !originalHeight) {
    status = WORD_OPTIMISER_STATUS.PRESERVE;
    reason = 'Source pixel dimensions could not be determined safely.';
  } else if (!displaySize) {
    status = WORD_OPTIMISER_STATUS.UNKNOWN_DISPLAY;
    reason = 'A reliable DrawingML display size was not found, so the original is preserved.';
  } else if (!preset.targetPpi) {
    status = WORD_OPTIMISER_STATUS.PRESERVE;
    reason = 'Lossless clean-up has no proven pixel-safe operation available for this asset.';
  } else if (!targetDimensions || targetDimensions.scale >= 1 || (ppi.effectivePpi ?? 0) <= preset.targetPpi) {
    status = WORD_OPTIMISER_STATUS.ALREADY_EFFICIENT;
    reason = `The largest displayed usage is already at or below approximately ${preset.targetPpi} PPI.`;
  } else {
    status = WORD_OPTIMISER_STATUS.OPTIMISE;
    reason = `The largest displayed usage is approximately ${formatPpi(ppi.effectivePpi)} PPI; resize to approximately ${preset.targetPpi} PPI without upscaling.`;
  }

  const estimatedBytes = status === WORD_OPTIMISER_STATUS.OPTIMISE && targetDimensions
    ? estimateOptimisedBytes(originalBytes, originalWidth, originalHeight, targetDimensions, format)
    : originalBytes;

  return {
    id: asset.id,
    packagePath: asset.packagePath || '',
    originalName: asset.originalName || asset.packagePath || 'image',
    format,
    formatLabel: asset.formatLabel || format.toLocaleUpperCase('en-GB') || 'Unknown',
    mimeType: asset.mimeType || '',
    source: asset.source || 'other',
    referenceCount: Array.isArray(asset.references) ? asset.references.length : 0,
    displayUsageCount: asset.displayUsageCount || asset.displayUsages?.length || 0,
    originalDimensions: originalWidth && originalHeight ? { width: originalWidth, height: originalHeight } : null,
    displayedDimensions: displaySize,
    effectivePpi: ppi.effectivePpi,
    widthPpi: ppi.widthPpi,
    heightPpi: ppi.heightPpi,
    targetPpi: preset.targetPpi,
    targetDimensions,
    proposedDimensions: targetDimensions ? { width: targetDimensions.width, height: targetDimensions.height } : null,
    originalBytes,
    estimatedBytes,
    estimatedSavingBytes: Math.max(0, originalBytes - estimatedBytes),
    status,
    statusLabel: getWordOptimiserStatusLabel(status),
    recommended: status === WORD_OPTIMISER_STATUS.OPTIMISE,
    reason,
    keepOriginal: isKeepOriginal
  };
}

export async function analyseWordDocument(input, options = {}) {
  const document = await readWordImageDocument(input, options);
  const packageValidation = await validateWordPackage(document, options);

  if (!packageValidation.valid) {
    throw new WordImageExtractorError(
      `The selected DOCX package failed safety validation. ${packageValidation.errors.join(' ')}`,
      'invalid-docx-package'
    );
  }

  const plan = buildWordOptimisationPlan(document, options);
  const summary = buildWordOptimisationSummary({ document, plan, preset: options.preset });

  return {
    document,
    plan,
    summary,
    preset: summary.preset,
    originalBytes: document.zipArchive?.bytes ? new Uint8Array(document.zipArchive.bytes) : null
  };
}

export const analyseWordDocumentLocally = analyseWordDocument;

export function buildWordOptimisationSummary({ document, plan = [], preset = DEFAULT_WORD_OPTIMISATION_PRESET, outputBytes = null, replacements = new Map(), actual = false } = {}) {
  const selectedPreset = normaliseWordOptimisationPreset(preset);
  const originalDocumentBytes = document?.zipArchive?.bytes?.byteLength
    ?? document?.package?.archiveBytes
    ?? document?.package?.fileBytes
    ?? 0;
  const originalImageBytes = plan.reduce((total, item) => total + item.originalBytes, 0);
  const estimatedImageBytes = plan.reduce((total, item) => total + item.estimatedBytes, 0);
  const imageBytes = actual
    ? plan.reduce((total, item) => total + getActualAssetBytes(item, replacements), 0)
    : estimatedImageBytes;
  const nonImagePackageBytes = Math.max(0, originalDocumentBytes - originalImageBytes);
  const estimatedDocumentBytes = Math.max(0, nonImagePackageBytes + estimatedImageBytes);
  const finalDocumentBytes = outputBytes?.byteLength ?? null;
  const optimisedDocumentBytes = actual ? finalDocumentBytes : estimatedDocumentBytes;
  const savingBytes = Math.max(0, originalDocumentBytes - optimisedDocumentBytes);
  const optimised = plan.filter(item => item.status === WORD_OPTIMISER_STATUS.OPTIMISE);
  const alreadyEfficient = plan.filter(item => item.status === WORD_OPTIMISER_STATUS.ALREADY_EFFICIENT);
  const unsupported = plan.filter(item => item.status === WORD_OPTIMISER_STATUS.UNSUPPORTED);
  const unknownDisplay = plan.filter(item => item.status === WORD_OPTIMISER_STATUS.UNKNOWN_DISPLAY);
  const preserved = plan.filter(item => [
    WORD_OPTIMISER_STATUS.PRESERVE,
    WORD_OPTIMISER_STATUS.UNSUPPORTED,
    WORD_OPTIMISER_STATUS.UNKNOWN_DISPLAY
  ].includes(item.status));
  const changedCount = actual
    ? plan.filter(item => replacements.has(item.packagePath.toLocaleLowerCase('en-GB'))).length
    : 0;

  return {
    preset: selectedPreset.id,
    presetLabel: selectedPreset.label,
    originalBytes: originalDocumentBytes,
    originalImageBytes,
    embeddedImageCount: plan.length,
    embeddedRasterCount: plan.filter(item => RASTER_FORMATS.has(item.format)).length,
    imageSharePercent: originalDocumentBytes ? Math.round((originalImageBytes / originalDocumentBytes) * 100) : 0,
    oversizedCount: optimised.length,
    alreadyEfficientCount: alreadyEfficient.length,
    unsupportedCount: unsupported.length,
    unknownDisplayCount: unknownDisplay.length,
    preservedCount: preserved.length,
    estimatedImageBytes,
    estimatedOptimisedBytes: estimatedDocumentBytes,
    estimatedSavingBytes: Math.max(0, originalDocumentBytes - estimatedDocumentBytes),
    estimatedSavingPercent: calculatePercent(originalDocumentBytes, Math.max(0, originalDocumentBytes - estimatedDocumentBytes)),
    optimisedImageBytes: actual ? imageBytes : null,
    optimisedBytes: actual ? optimisedDocumentBytes : null,
    savingBytes: actual ? savingBytes : null,
    savingPercent: actual ? calculatePercent(originalDocumentBytes, savingBytes) : null,
    changedCount,
    nonImagePackageBytes,
    outputAvailable: actual && Number.isFinite(finalDocumentBytes),
    originalFileLabel: formatBytes(originalDocumentBytes),
    estimatedFileLabel: formatBytes(estimatedDocumentBytes),
    finalFileLabel: actual ? formatBytes(optimisedDocumentBytes) : '',
    estimatedSavingLabel: formatBytes(Math.max(0, originalDocumentBytes - estimatedDocumentBytes))
  };
}

export const buildWordOptimiserSummary = buildWordOptimisationSummary;

/**
 * Rebuild only the supplied media records. If there are no replacements the
 * source archive is copied, leaving the original byte array untouched.
 */
export function buildOptimisedWordPackage(zipArchive, replacements = new Map()) {
  if (!zipArchive?.bytes || !Array.isArray(zipArchive.entries)) {
    throw new WordImageExtractorError('Load a valid DOCX package before rebuilding the document.', 'missing-package');
  }

  const replacementMap = normaliseReplacementMap(replacements);

  if (replacementMap.size === 0) {
    return new Uint8Array(zipArchive.bytes);
  }

  const zipReplacementMap = new Map(
    [...replacementMap.values()].map(replacement => [replacement.path, replacement.bytes])
  );

  return replaceZipArchiveEntries(zipArchive, zipReplacementMap);
}

export const replaceWordDocumentMedia = buildOptimisedWordPackage;

/**
 * Validate the new package and, when a source analysis is supplied, verify
 * that every untouched package entry and relationship target remains intact.
 */
export async function validateOptimisedWordPackage(input, options = {}) {
  const fileName = options.fileName || 'document-optimised.docx';
  let validation;

  try {
    validation = await validateWordPackage(input, { ...options, fileName });
  } catch (error) {
    if (error instanceof WordImageExtractorError) {
      throw error;
    }

    throw new WordImageExtractorError(
      `The rebuilt DOCX could not be validated. ${normaliseErrorMessage(error, 'The package is not readable.')}`,
      'invalid-optimised-docx'
    );
  }

  const errors = [...(validation.errors || [])];
  const sourceDocument = options.sourceDocument?.document || options.sourceDocument;
  const replacements = normaliseReplacementMap(options.replacements);

  if (sourceDocument?.zipArchive && validation.document?.zipArchive) {
    errors.push(...await compareUntouchedPackageEntries(
      sourceDocument.zipArchive,
      validation.document.zipArchive,
      replacements
    ));
  }

  if (errors.length) {
    throw new WordImageExtractorError(
      `The rebuilt DOCX failed validation. ${errors.join(' ')}`,
      'invalid-optimised-docx'
    );
  }

  return {
    valid: true,
    document: validation.document,
    zipArchive: validation.document.zipArchive,
    errors: []
  };
}

export const validateRebuiltWordDocument = validateOptimisedWordPackage;

/**
 * Decode, resize and encode one image in the browser. Work is sequential by
 * design: the bitmap and canvas are released before the next asset starts.
 */
export async function encodeWordRasterAsset(asset, plan, options = {}) {
  if (!asset?.bytes || !plan?.targetDimensions) {
    throw new WordImageExtractorError('This image does not have a safe optimisation target.', 'invalid-image-plan');
  }

  const sourceWidth = Number(asset.width ?? asset.dimensions?.width);
  const sourceHeight = Number(asset.height ?? asset.dimensions?.height);
  const targetWidth = Number(plan.targetDimensions.width);
  const targetHeight = Number(plan.targetDimensions.height);
  const limits = { ...WORD_OPTIMISER_LIMITS, ...(options.limits || {}) };

  if (!validRasterDimensions(sourceWidth, sourceHeight, limits) || !validRasterDimensions(targetWidth, targetHeight, limits)) {
    throw new WordImageExtractorError('This image is too large to decode safely in the browser.', 'decoded-image-limit');
  }

  const format = String(asset.format || '').toLocaleLowerCase('en-GB');
  const outputMime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const outputQuality = format === 'jpeg' ? 0.9 : format === 'webp' ? 0.92 : undefined;
  const documentRef = globalThis.document;

  if (!documentRef?.createElement) {
    throw new WordImageExtractorError('Browser image encoding is unavailable in this environment.', 'image-encoder-unavailable');
  }

  const sourceBlob = new Blob([asset.bytes], { type: asset.mimeType || outputMime });
  let decoded = null;
  let objectUrl = '';
  let canvas = null;

  try {
    const decodedResource = await decodeRasterBlob(sourceBlob);
    decoded = decodedResource.image;
    objectUrl = decodedResource.objectUrl;
    canvas = documentRef.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d', { alpha: format !== 'jpeg' });

    if (!context) {
      throw new WordImageExtractorError('The browser could not create an image canvas.', 'image-encoder-unavailable');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    if (format === 'jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, targetWidth, targetHeight);
    }
    context.drawImage(decoded, 0, 0, targetWidth, targetHeight);

    const outputBlob = await canvasToBlob(canvas, outputMime, outputQuality);
    const bytes = new Uint8Array(await outputBlob.arrayBuffer());
    const detected = detectImageFormat(bytes, asset.packagePath);

    if (!detected.dimensions || detected.dimensions.width !== targetWidth || detected.dimensions.height !== targetHeight) {
      throw new WordImageExtractorError('The browser returned an image with unexpected dimensions.', 'invalid-encoded-image');
    }

    return {
      bytes,
      width: targetWidth,
      height: targetHeight,
      format,
      mimeType: outputMime,
      fileSize: bytes.byteLength,
      originalBytes: asset.fileSize ?? asset.bytes.byteLength,
      smaller: bytes.byteLength < (asset.fileSize ?? asset.bytes.byteLength)
    };
  } finally {
    if (decoded?.close) decoded.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
}

export const encodeRasterAssetForWord = encodeWordRasterAsset;

export async function optimiseWordDocument(analysis, options = {}) {
  const document = analysis?.document || analysis;
  const plan = analysis?.plan || buildWordOptimisationPlan(document, options);
  const limits = { ...WORD_OPTIMISER_LIMITS, ...(options.limits || {}) };

  if (!document?.zipArchive) {
    throw new WordImageExtractorError('Analyse a DOCX before optimising it.', 'missing-analysis');
  }

  const encode = options.encodeRasterAsset || encodeWordRasterAsset;
  const replacements = new Map();
  const processed = [];

  for (const item of plan) {
    const asset = document.assets?.find(candidate => candidate.id === item.id);

    if (item.status !== WORD_OPTIMISER_STATUS.OPTIMISE || !asset) {
      processed.push({ ...item, actualStatus: item.status, outputBytes: item.originalBytes });
      continue;
    }

    const encoded = await encode(asset, item, options);

    if (encoded?.bytes instanceof Uint8Array && encoded.bytes.byteLength < item.originalBytes) {
      replacements.set(item.packagePath, {
        path: item.packagePath,
        bytes: encoded.bytes
      });
      processed.push({
        ...item,
        actualStatus: WORD_OPTIMISER_STATUS.OPTIMISE,
        outputBytes: encoded.bytes.byteLength,
        actualSavingBytes: item.originalBytes - encoded.bytes.byteLength,
        outputDimensions: { width: encoded.width, height: encoded.height }
      });
    } else {
      processed.push({
        ...item,
        actualStatus: WORD_OPTIMISER_STATUS.PRESERVE,
        outputBytes: item.originalBytes,
        actualSavingBytes: 0,
        reason: 'The generated replacement was not smaller, so the original bytes were preserved.'
      });
    }
  }

  const outputBytes = buildOptimisedWordPackage(document.zipArchive, replacements);

  if (outputBytes.byteLength > limits.maxRebuiltPackageBytes) {
    throw new WordImageExtractorError('The rebuilt DOCX exceeds the safe browser output limit.', 'rebuilt-package-limit');
  }

  const validation = await validateOptimisedWordPackage(outputBytes, {
    fileName: `${document.documentName || 'document'}-optimised.docx`,
    sourceDocument: document,
    replacements
  });
  const summary = buildWordOptimisationSummary({
    document,
    plan: processed,
    preset: analysis?.preset || options.preset,
    outputBytes,
    replacements,
    actual: true
  });

  return {
    bytes: outputBytes,
    replacements,
    processed,
    summary,
    validation
  };
}

export const optimiseWordDocumentLocally = optimiseWordDocument;

function normaliseDisplaySize(displaySize, asset) {
  const widthInches = Number(displaySize?.widthInches ?? asset?.maxDisplayedWidthInches);
  const heightInches = Number(displaySize?.heightInches ?? asset?.maxDisplayedHeightInches);

  if (!Number.isFinite(widthInches) || widthInches <= 0 || !Number.isFinite(heightInches) || heightInches <= 0) {
    return null;
  }

  return {
    widthInches,
    heightInches,
    widthEmu: Number(displaySize?.widthEmu) || Math.round(widthInches * EMU_PER_INCH),
    heightEmu: Number(displaySize?.heightEmu) || Math.round(heightInches * EMU_PER_INCH)
  };
}

function estimateOptimisedBytes(originalBytes, sourceWidth, sourceHeight, targetDimensions, format) {
  if (!originalBytes || !targetDimensions || !sourceWidth || !sourceHeight) {
    return originalBytes;
  }

  const pixelRatio = (targetDimensions.width * targetDimensions.height) / (sourceWidth * sourceHeight);
  const codecFactor = format === 'png' ? 0.82 : format === 'jpeg' ? 0.72 : 0.78;
  const estimated = Math.round(originalBytes * Math.max(0.05, Math.min(0.96, pixelRatio * codecFactor)));
  return Math.max(1, Math.min(originalBytes, estimated));
}

function getActualAssetBytes(item, replacements) {
  const replacement = replacements.get(item.packagePath.toLocaleLowerCase('en-GB'))
    || replacements.get(item.packagePath);
  return replacement?.bytes?.byteLength ?? item.originalBytes;
}

function compareAssets(left, right) {
  const leftKey = String(left?.packagePath || left?.id || left?.originalName || '').toLocaleLowerCase('en-GB');
  const rightKey = String(right?.packagePath || right?.id || right?.originalName || '').toLocaleLowerCase('en-GB');
  return leftKey.localeCompare(rightKey, 'en-GB');
}

function getWordOptimiserStatusLabel(status) {
  return {
    [WORD_OPTIMISER_STATUS.OPTIMISE]: 'Optimise',
    [WORD_OPTIMISER_STATUS.ALREADY_EFFICIENT]: 'Already efficient',
    [WORD_OPTIMISER_STATUS.PRESERVE]: 'Preserve',
    [WORD_OPTIMISER_STATUS.UNSUPPORTED]: 'Unsupported',
    [WORD_OPTIMISER_STATUS.UNKNOWN_DISPLAY]: 'Unable to determine display size'
  }[status] || 'Preserve';
}

function formatPpi(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('en-GB') : 'unknown';
}

function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);

  if (value < 1024) return `${value.toLocaleString('en-GB')} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function calculatePercent(total, amount) {
  return total > 0 ? Math.round((amount / total) * 100) : 0;
}

function normalisePositiveDimension(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function normalisePositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normaliseReplacementMap(replacements) {
  const entries = replacements instanceof Map
    ? [...replacements.entries()]
    : Array.isArray(replacements)
      ? replacements.map(item => [item?.path, item])
      : Object.entries(replacements || {});
  const map = new Map();

  entries.forEach(([key, value]) => {
    const path = String(value?.path || key || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const bytes = value instanceof Uint8Array
      ? value
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : value?.bytes instanceof Uint8Array
          ? value.bytes
          : value?.bytes instanceof ArrayBuffer
            ? new Uint8Array(value.bytes)
            : null;

    if (!path || !bytes) return;
    map.set(path.toLocaleLowerCase('en-GB'), { path, bytes });
  });

  return map;
}

function validRasterDimensions(width, height, limits) {
  return Number.isInteger(width)
    && Number.isInteger(height)
    && width > 0
    && height > 0
    && width <= limits.maxDecodedRasterWidth
    && height <= limits.maxDecodedRasterHeight
    && width * height <= limits.maxDecodedRasterPixels;
}

async function decodeRasterBlob(blob) {
  if (typeof globalThis.createImageBitmap === 'function') {
    return {
      image: await globalThis.createImageBitmap(blob),
      objectUrl: ''
    };
  }

  if (typeof globalThis.Image !== 'function' || typeof globalThis.URL?.createObjectURL !== 'function') {
    throw new WordImageExtractorError('This browser cannot decode the selected raster image.', 'image-decoder-unavailable');
  }

  const url = globalThis.URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve({ image, objectUrl: url });
    image.onerror = () => {
      globalThis.URL.revokeObjectURL(url);
      reject(new WordImageExtractorError('The selected raster image could not be decoded.', 'invalid-raster-image'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new WordImageExtractorError('The browser could not encode the optimised image.', 'image-encoder-failed'));
      }
    }, type, quality);
  });
}

async function compareUntouchedPackageEntries(sourceZip, outputZip, replacements) {
  const errors = [];
  const sourceEntries = new Map(sourceZip.entries.filter(entry => !entry.isDirectory).map(entry => [packageKey(entry.name), entry]));
  const outputEntries = new Map(outputZip.entries.filter(entry => !entry.isDirectory).map(entry => [packageKey(entry.name), entry]));

  if (sourceEntries.size !== outputEntries.size) {
    errors.push('The rebuilt package changed its ZIP entry set.');
  }

  for (const [key, sourceEntry] of sourceEntries) {
    const outputEntry = outputEntries.get(key);

    if (!outputEntry) {
      errors.push(`The rebuilt package is missing ${sourceEntry.name}.`);
      continue;
    }

    const replacement = replacements.get(key);
    const expected = replacement?.bytes || await sourceZip.readBytes(sourceEntry.name);
    const actual = await outputZip.readBytes(outputEntry.name);

    if (!bytesEqual(expected, actual)) {
      errors.push(`${sourceEntry.name} changed without a matching validated replacement.`);
    }
  }

  return errors;
}

function packageKey(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').toLocaleLowerCase('en-GB');
}

function bytesEqual(left, right) {
  if (!left || !right || left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function normaliseErrorMessage(error, fallback) {
  const message = String(error?.message || '').trim();
  return message || fallback;
}
