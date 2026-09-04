import {
  createStoredZipArchive,
  readZipArchive
} from './power-platform-solution.js';

export const WORD_IMAGE_FILE_ACCEPT = [
  '.docx',
  '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
].join(',');

export const WORD_IMAGE_LIMITS = Object.freeze({
  maxEntries: 10000,
  maxTotalUncompressedBytes: 128 * 1024 * 1024,
  maxXmlPartBytes: 8 * 1024 * 1024,
  maxImageCount: 2000,
  maxImageReferences: 10000,
  maxImageBytes: 96 * 1024 * 1024,
  maxXmlNodes: 200000,
  maxXmlDepth: 128,
  maxWarnings: 2000
});

const OLE_COMPOUND_FILE_SIGNATURE = new Uint8Array([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1
]);
const ZIP_SIGNATURES = new Set([0x04034b50, 0x06054b50, 0x08074b50]);
const IMAGE_RELATIONSHIP_SUFFIX = '/image';
const SOURCE_ORDER = ['body', 'header', 'footer', 'other', 'unreferenced', 'external'];
const PREVIEWABLE_FORMATS = new Set(['png', 'jpeg', 'gif', 'bmp', 'webp', 'svg']);
const IMAGE_MIME_TYPES = Object.freeze({
  bmp: 'image/bmp',
  emf: 'image/emf',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tiff: 'image/tiff',
  webp: 'image/webp',
  wmf: 'image/wmf'
});
const IMAGE_EXTENSIONS = Object.freeze({
  bmp: 'bmp',
  emf: 'emf',
  gif: 'gif',
  ico: 'ico',
  jpeg: 'jpg',
  jpg: 'jpg',
  png: 'png',
  svg: 'svg',
  tif: 'tif',
  tiff: 'tiff',
  webp: 'webp',
  wmf: 'wmf'
});

export const EMU_PER_INCH = 914400;

export class WordImageExtractorError extends Error {
  constructor(message, code = 'word-image-error') {
    super(message);
    this.name = 'WordImageExtractorError';
    this.code = code;
  }
}

export const LEGACY_DOC_MESSAGE = 'Legacy .doc files are not supported. Save the document as .docx: open it in Word, choose Save As, select Word Document (*.docx), and try again.';
export const ENCRYPTED_OFFICE_MESSAGE = 'This appears to be an encrypted or binary Office document. Encrypted Word files cannot be inspected locally; decrypt it or save an unencrypted .docx and try again.';
export const UNSUPPORTED_WORD_MESSAGE = 'This tool accepts Word .docx files only. Save the document as .docx and try again.';

/**
 * Inspect a DOCX package and return embedded and externally linked image assets.
 * All reads happen against the supplied bytes; no network request is made.
 */
export async function readWordImageDocument(input, options = {}) {
  const fileName = String(options.fileName ?? input?.name ?? '').trim();
  const bytes = await normaliseInputBytes(input);
  const inputType = detectWordInputType(bytes, fileName);

  if (inputType === 'legacy-doc') {
    throw new WordImageExtractorError(LEGACY_DOC_MESSAGE, 'legacy-doc');
  }

  if (inputType === 'encrypted-office') {
    throw new WordImageExtractorError(ENCRYPTED_OFFICE_MESSAGE, 'encrypted-office');
  }

  if (fileName && !/\.docx$/i.test(fileName)) {
    throw new WordImageExtractorError(UNSUPPORTED_WORD_MESSAGE, 'unsupported-input');
  }

  const limits = normaliseLimits(options);
  let zip;

  try {
    zip = await readZipArchive(bytes, options);
  } catch (error) {
    throw new WordImageExtractorError(
      `The selected file is not a valid DOCX package. ${normaliseErrorMessage(error, 'The ZIP package could not be read.')}`,
      'invalid-docx'
    );
  }

  assertPackageSafety(zip, limits);

  const entryByPath = new Map();
  zip.entries.forEach(entry => {
    if (!entry.isDirectory) {
      const packagePath = normalisePackagePath(entry.name);

      if (!isSafePackagePath(entry.name)) {
        throw new WordImageExtractorError(`The DOCX package contains an unsafe ZIP path: ${entry.name}.`, 'unsafe-zip-path');
      }

      const key = packagePath.toLocaleLowerCase('en-GB');

      if (entryByPath.has(key)) {
        throw new WordImageExtractorError(`The DOCX package contains duplicate ZIP entries for ${packagePath}.`, 'duplicate-zip-path');
      }

      entryByPath.set(key, entry);
    }
  });

  const documentEntry = entryByPath.get('word/document.xml');

  if (!documentEntry) {
    const hasOfficeEncryptionEntry = [...entryByPath.keys()].some(path => (
      path === 'encryptedpackage' || path === 'encryptioninfo'
    ));

    if (hasOfficeEncryptionEntry) {
      throw new WordImageExtractorError(ENCRYPTED_OFFICE_MESSAGE, 'encrypted-office');
    }

    throw new WordImageExtractorError(
      `${UNSUPPORTED_WORD_MESSAGE} The package does not contain word/document.xml.`,
      'unsupported-docx'
    );
  }

  const warnings = [];
  let warningOverflow = false;
  const addWarning = message => {
    const value = String(message || '').trim();

    if (!value) return;

    if (warnings.length < limits.maxWarnings) {
      warnings.push(value);
      return;
    }

    if (!warningOverflow) {
      warningOverflow = true;
      warnings[warnings.length - 1] = `Additional validation warnings were omitted after reaching the safety limit of ${limits.maxWarnings.toLocaleString('en-GB')} warnings.`;
    }
  };
  (zip.warnings || []).forEach(addWarning);
  const contentTypes = await readPackageText(zip, entryByPath, '[Content_Types].xml', limits, 'content types');

  if (contentTypes) {
    try {
      parseXmlDocument(contentTypes, limits);
    } catch (error) {
      throw new WordImageExtractorError(
        `The DOCX content types part is malformed. ${normaliseErrorMessage(error, 'The XML could not be parsed.')}`,
        'malformed-xml'
      );
    }
  }

  if (contentTypes && !hasWordDocumentContentType(contentTypes)) {
    throw new WordImageExtractorError(
      `${UNSUPPORTED_WORD_MESSAGE} The package is not identified as a WordprocessingML document.`,
      'unsupported-docx'
    );
  }

  const xmlEntries = [...entryByPath.values()]
    .filter(entry => /^word\/(?!_rels\/).+\.xml$/i.test(normalisePackagePath(entry.name)))
    .sort((left, right) => normalisePackagePath(left.name).localeCompare(normalisePackagePath(right.name), 'en-GB'));
  const localReferences = [];
  const externalReferences = [];
  let imageReferenceCount = 0;

  for (const xmlEntry of xmlEntries) {
    const partPath = normalisePackagePath(xmlEntry.name);
    const xml = await readPackageText(zip, entryByPath, partPath, limits, partPath);
    let tree;

    try {
      tree = parseXmlDocument(xml, limits);
    } catch (error) {
      throw new WordImageExtractorError(
        `The DOCX part ${partPath} is malformed. ${normaliseErrorMessage(error, 'The XML could not be parsed.')}`,
        'malformed-xml'
      );
    }

    const relationshipsPath = getRelationshipsPartPath(partPath);
    const relationshipsXml = await readPackageText(zip, entryByPath, relationshipsPath, limits, relationshipsPath);
    let relationships = new Map();

    if (relationshipsXml) {
      try {
        relationships = parseRelationships(relationshipsXml, limits);
      } catch (error) {
        throw new WordImageExtractorError(
          `The DOCX relationships part ${relationshipsPath} is malformed. ${normaliseErrorMessage(error, 'The XML could not be parsed.')}`,
          'malformed-xml'
        );
      }
    }
    const sourceCategory = classifySourcePart(partPath);

    collectImageReferences(tree, reference => {
      imageReferenceCount += 1;

      if (imageReferenceCount > limits.maxImageReferences) {
        throw new WordImageExtractorError(
          `This document contains more than ${limits.maxImageReferences.toLocaleString('en-GB')} image references, including repeated or broken relationships, so it was refused for safety. Reduce repeated or malformed image references and try again.`,
          'image-reference-limit'
        );
      }

      const relationship = relationships.get(reference.relationshipId);

      if (!relationship) {
        addWarning(`${partPath} refers to missing image relationship ${reference.relationshipId}.`);
        return;
      }

      if (!isImageRelationship(relationship.type) && !reference.isImageElement) {
        return;
      }

      const target = relationship.target;
      const metadata = reference.metadata;

      if (relationship.external || relationship.targetMode.toLocaleLowerCase('en-GB') === 'external') {
        externalReferences.push({
          sourceCategory,
          sourcePart: partPath,
          relationshipId: reference.relationshipId,
          target,
          metadata,
          displaySize: reference.displaySize,
          crop: reference.crop
        });
        return;
      }

      const resolvedPath = resolveRelationshipTarget(partPath, target);

      if (!resolvedPath) {
        addWarning(`${partPath} contains an unsafe or invalid image relationship target.`);
        return;
      }

      localReferences.push({
        sourceCategory,
        sourcePart: partPath,
        relationshipId: reference.relationshipId,
        target: resolvedPath,
        metadata,
        displaySize: reference.displaySize,
        crop: reference.crop
      });
    });
  }

  const candidatePaths = new Set(
    [...entryByPath.values()]
      .map(entry => normalisePackagePath(entry.name))
      .filter(path => /^word\/media\//i.test(path))
  );
  localReferences.forEach(reference => candidatePaths.add(reference.target));

  if (candidatePaths.size > limits.maxImageCount) {
    throw new WordImageExtractorError(
      `This document contains more than ${limits.maxImageCount.toLocaleString('en-GB')} possible image assets. Reduce the document size and try again.`,
      'image-count-limit'
    );
  }

  const candidateAssets = new Map();
  let imageBytesTotal = 0;

  for (const path of [...candidatePaths].sort((left, right) => left.localeCompare(right, 'en-GB'))) {
    const entry = entryByPath.get(path.toLocaleLowerCase('en-GB'));

    if (!entry) {
      continue;
    }

    if (entry.encrypted) {
      addWarning(`${path} is encrypted and was not extracted.`);
      continue;
    }

    if (entry.uncompressedSize > limits.maxImageBytes || entry.uncompressedSize > limits.maxTotalUncompressedBytes) {
      throw new WordImageExtractorError(
        `${path} exceeds the safe image size limit for browser processing.`,
        'image-size-limit'
      );
    }

    const imageBytes = await readPackageBytes(zip, entry, limits.maxImageBytes, path);
    imageBytesTotal += imageBytes.byteLength;

    if (imageBytesTotal > limits.maxImageBytes) {
      throw new WordImageExtractorError(
        `The document's embedded images exceed the ${formatByteLimit(limits.maxImageBytes)} browser processing limit.`,
        'image-size-limit'
      );
    }

    const info = detectImageFormat(imageBytes, path);
    const referenced = localReferences.some(reference => reference.target.toLocaleLowerCase('en-GB') === path.toLocaleLowerCase('en-GB'));

    if (!info.isImage && !referenced) {
      continue;
    }

    candidateAssets.set(path.toLocaleLowerCase('en-GB'), {
      ...info,
      bytes: imageBytes,
      packagePath: path,
      originalName: getPackageBaseName(path),
      references: [],
      sourceCategories: new Set(),
      altTexts: new Set(),
      titles: new Set(),
      isEmbedded: true,
      isExternal: false,
      missing: false
    });
  }

  const missingAssets = new Map();

  localReferences.forEach(reference => {
    const key = reference.target.toLocaleLowerCase('en-GB');
    let asset = candidateAssets.get(key);

    if (!asset) {
      asset = missingAssets.get(key);

      if (!asset) {
        const fallbackInfo = detectImageFormat(new Uint8Array(), reference.target);
        asset = {
          ...fallbackInfo,
          bytes: null,
          packagePath: reference.target,
          originalName: getPackageBaseName(reference.target),
          references: [],
          sourceCategories: new Set(),
          altTexts: new Set(),
          titles: new Set(),
          isEmbedded: false,
          isExternal: false,
          missing: true
        };
        missingAssets.set(key, asset);
      }
    }

    addAssetReference(asset, reference);
  });

  const externalAssets = new Map();

  externalReferences.forEach(reference => {
    const target = String(reference.target || '').trim();
    const key = target || `relationship:${reference.sourcePart}:${reference.relationshipId}`;
    let asset = externalAssets.get(key);

    if (!asset) {
      const info = detectImageFormat(new Uint8Array(), target);
      asset = {
        ...info,
        bytes: null,
        packagePath: '',
        originalName: getExternalBaseName(target) || 'external-image',
        externalTarget: target,
        references: [],
        sourceCategories: new Set(),
        altTexts: new Set(),
        titles: new Set(),
        isEmbedded: false,
        isExternal: true,
        missing: false
      };
      externalAssets.set(key, asset);
    }

    addAssetReference(asset, reference);
  });

  const mediaAssets = [...candidateAssets.values()]
    .concat([...missingAssets.values()])
    .concat([...externalAssets.values()])
    .filter(asset => asset.isEmbedded || asset.isExternal || asset.missing);
  const unreferencedAssets = [...candidateAssets.values()].filter(asset => asset.references.length === 0);

  unreferencedAssets.forEach(asset => asset.sourceCategories.add('unreferenced'));

  const assets = await Promise.all(mediaAssets
    .sort(compareAssets)
    .map((asset, index) => finaliseAsset(asset, index)));
  const markedAssets = markDuplicateAssets(assets);
  const embeddedAssets = markedAssets.filter(asset => asset.isEmbedded);
  const linkedAssets = markedAssets.filter(asset => asset.isExternal);
  const missingImageAssets = markedAssets.filter(asset => asset.missing);

  if (embeddedAssets.length === 0 && linkedAssets.length === 0 && missingImageAssets.length === 0) {
    addWarning('No embedded or externally linked image assets were found in the document.');
  }

  return {
    type: 'docx',
    fileName: fileName || 'document.docx',
    documentName: stripExtension(fileName || 'document.docx'),
    assets: markedAssets,
    embeddedAssets,
    externalAssets: linkedAssets,
    missingAssets: missingImageAssets,
    warnings: uniqueStrings(warnings),
    summary: buildWordImageSummary(markedAssets, warnings, imageReferenceCount),
    package: {
      entryCount: zip.entries.length,
      uncompressedBytes: zip.entries.reduce((total, entry) => total + (Number(entry.uncompressedSize) || 0), 0),
      imageBytes: imageBytesTotal,
      imageReferenceCount,
      warnings: zip.warnings
    },
    zipArchive: zip
  };
}

export const extractWordImages = readWordImageDocument;
export const parseWordImageDocument = readWordImageDocument;

/**
 * Validate a Word package without changing it. This is shared by the image
 * extractor and document optimiser so rebuilt packages use the same safety
 * and relationship rules as source packages.
 */
export async function validateWordPackage(input, options = {}) {
  const document = input?.zipArchive && input?.type === 'docx'
    ? input
    : await readWordImageDocument(input, options);
  const zip = document.zipArchive;
  const entriesByPath = new Map();
  const errors = [];

  zip.entries.forEach(entry => {
    if (!entry.isDirectory) {
      const packagePath = normalisePackagePath(entry.name);
      const key = packagePath.toLocaleLowerCase('en-GB');

      if (!isSafePackagePath(entry.name)) {
        errors.push(`The DOCX package contains an unsafe ZIP path: ${entry.name}.`);
      }

      if (entriesByPath.has(key)) {
        errors.push(`The DOCX package contains duplicate ZIP entries for ${packagePath}.`);
      } else {
        entriesByPath.set(key, entry);
      }
    }

    if (entry.encrypted) {
      errors.push(`${entry.name} is encrypted and cannot be validated as an editable DOCX package.`);
    }
  });

  if (!entriesByPath.has('[content_types].xml')) {
    errors.push('The DOCX package is missing [Content_Types].xml.');
  }

  if (!entriesByPath.has('word/document.xml')) {
    errors.push('The DOCX package is missing word/document.xml.');
  }

  if (document.missingAssets?.length) {
    errors.push(`${document.missingAssets.length.toLocaleString('en-GB')} referenced embedded media target${document.missingAssets.length === 1 ? '' : 's'} could not be resolved.`);
  }

  (document.warnings || [])
    .filter(warning => /missing image relationship|unsafe or invalid image relationship target/i.test(warning))
    .forEach(warning => errors.push(warning));

  const relationshipEntries = zip.entries
    .filter(entry => !entry.isDirectory && (
      /(?:^|\/)\_rels\/[^/]+\.rels$/i.test(normalisePackagePath(entry.name))
      || /^\_rels\/\.rels$/i.test(normalisePackagePath(entry.name))
    ))
    .sort((left, right) => normalisePackagePath(left.name).localeCompare(normalisePackagePath(right.name), 'en-GB'));

  for (const relationshipEntry of relationshipEntries) {
    if (relationshipEntry.encrypted) {
      continue;
    }

    const relationshipPath = normalisePackagePath(relationshipEntry.name);
    const sourcePart = getRelationshipsSourcePart(relationshipPath);
    let relationships;

    try {
      const xml = await readPackageText(zip, entriesByPath, relationshipPath, normaliseLimits(options), relationshipPath);
      relationships = parseRelationships(xml, normaliseLimits(options));
    } catch (error) {
      errors.push(`${relationshipPath} is malformed. ${normaliseErrorMessage(error, 'The XML could not be parsed.')}`);
      continue;
    }

    relationships.forEach(relationship => {
      if (relationship.external) {
        return;
      }

      const targetPath = resolveRelationshipTarget(sourcePart, relationship.target);

      if (!targetPath || !entriesByPath.has(targetPath.toLocaleLowerCase('en-GB'))) {
        errors.push(`${relationshipPath} refers to missing target ${relationship.target || '(empty)'}.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors: uniqueStrings(errors),
    document
  };
}

export const validateWordDocumentPackage = validateWordPackage;

function getRelationshipsSourcePart(relationshipPath) {
  const normalised = normalisePackagePath(relationshipPath);

  if (normalised.toLocaleLowerCase('en-GB') === '_rels/.rels') {
    return '';
  }

  const match = /^(.*)\/_rels\/([^/]+)\.rels$/i.exec(normalised);

  if (!match) {
    return '';
  }

  return `${match[1]}/${match[2]}`;
}

export function detectWordInputType(input, fileName = '') {
  const bytes = toUint8Array(input);
  const name = String(fileName || '').toLocaleLowerCase('en-GB');

  if (name.endsWith('.doc')) {
    return 'legacy-doc';
  }

  if (startsWithBytes(bytes, OLE_COMPOUND_FILE_SIGNATURE)) {
    return 'encrypted-office';
  }

  if (name.endsWith('.docx')) {
    return 'docx';
  }

  if (bytes.byteLength >= 4) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const signature = view.getUint32(0, true);

    if (ZIP_SIGNATURES.has(signature)) {
      return 'zip';
    }
  }

  return 'unsupported';
}

export function detectImageFormat(input, hintPath = '') {
  const bytes = toUint8Array(input);
  const pathExtension = getPathExtension(hintPath);

  if (hasSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return makeImageInfo('png', readPngDimensions(bytes), true);
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return makeImageInfo('jpeg', readJpegDimensions(bytes), true);
  }

  if (hasAsciiSignature(bytes, 'GIF87a') || hasAsciiSignature(bytes, 'GIF89a')) {
    return makeImageInfo('gif', readGifDimensions(bytes), true);
  }

  if (hasAsciiSignature(bytes, 'RIFF') && hasAsciiSignature(bytes.slice(8), 'WEBP')) {
    return makeImageInfo('webp', readWebpDimensions(bytes), true);
  }

  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return makeImageInfo('bmp', readBmpDimensions(bytes), true);
  }

  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00)
    || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)) {
    return makeImageInfo('tiff', readTiffDimensions(bytes), true);
  }

  if (isSvgBytes(bytes)) {
    return makeImageInfo('svg', readSvgDimensions(bytes), true);
  }

  if (isEmfBytes(bytes)) {
    return makeImageInfo('emf', readEmfDimensions(bytes), true);
  }

  if (isWmfBytes(bytes)) {
    return makeImageInfo('wmf', null, true);
  }

  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return makeImageInfo('ico', readIcoDimensions(bytes), true);
  }

  const extensionFormat = extensionToFormat(pathExtension);

  if (extensionFormat) {
    return makeImageInfo(extensionFormat, null, true);
  }

  return makeImageInfo('unknown', null, false);
}

export function calculateDeterministicImageHash(input) {
  const bytes = toUint8Array(input);
  // Keep the synchronous fallback cheap. Parsed documents use the async
  // Web Crypto path below, while duplicate groups always verify full bytes.
  let first = 2166136261;
  let second = 2654435769;

  for (const byte of bytes) {
    first = Math.imul(first ^ byte, 16777619);
    second = Math.imul(second ^ (byte + 17), 2246822519);
  }

  return `fnv1a-dual:${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

export async function calculateDeterministicImageHashAsync(input) {
  const bytes = toUint8Array(input);
  const subtle = globalThis.crypto?.subtle;

  if (subtle?.digest) {
    try {
      const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
      return `sha256:${[...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
    } catch {
      // Fall back to the synchronous local hash if Web Crypto is unavailable.
    }
  }

  return calculateDeterministicImageHash(bytes);
}

export const hashImageBytes = calculateDeterministicImageHash;
export const hashImageBytesAsync = calculateDeterministicImageHashAsync;

export function markDuplicateAssets(assets = []) {
  const groups = new Map();

  assets.forEach(asset => {
    if (!asset?.isEmbedded || !(asset.bytes instanceof Uint8Array)) {
      return;
    }

    const hash = asset.hash || calculateDeterministicImageHash(asset.bytes);
    const candidates = groups.get(hash) || [];
    const exactGroup = candidates.find(group => bytesEqual(group[0].bytes, asset.bytes));

    if (exactGroup) {
      exactGroup.push(asset);
    } else {
      candidates.push([asset]);
      groups.set(hash, candidates);
    }
  });

  const duplicateGroups = new Map();
  groups.forEach((hashGroups, hash) => {
    hashGroups.forEach(group => {
      if (group.length > 1) {
        duplicateGroups.set(`${hash}:${group[0].id}`, group);
      }
    });
  });

  const duplicateIds = new Set();
  duplicateGroups.forEach(group => group.forEach(asset => duplicateIds.add(asset.id)));

  return assets.map(asset => {
    if (!asset?.isEmbedded || !(asset.bytes instanceof Uint8Array)) {
      return {
        ...asset,
        hash: null,
        duplicateStatus: asset?.isExternal ? 'external' : asset?.missing ? 'missing' : 'not-embedded',
        isDuplicate: false,
        duplicateOf: null,
        duplicateGroup: null
      };
    }

    const hash = asset.hash || calculateDeterministicImageHash(asset.bytes);
    const group = [...duplicateGroups.values()].find(items => items.includes(asset));
    const first = group?.[0];
    const duplicateGroup = group ? `${hash}:${first.id}` : null;

    return {
      ...asset,
      hash,
      duplicateStatus: duplicateIds.has(asset.id) ? 'duplicate' : 'unique',
      isDuplicate: Boolean(group),
      duplicateOf: first && first.id !== asset.id ? first.id : null,
      duplicateGroup
    };
  });
}

export function filterWordImageAssets(assets = [], filters = {}) {
  return assets.filter(asset => matchesWordImageFilters(asset, filters));
}

export const filterImageAssets = filterWordImageAssets;

export function matchesWordImageFilters(asset, filters = {}) {
  if (!asset) {
    return false;
  }

  const minWidth = readFilterNumber(filters.minWidth ?? filters.minimumWidth ?? filters.widthMin);
  const maxWidth = readFilterNumber(filters.maxWidth ?? filters.maximumWidth ?? filters.widthMax);
  const minHeight = readFilterNumber(filters.minHeight ?? filters.minimumHeight ?? filters.heightMin);
  const maxHeight = readFilterNumber(filters.maxHeight ?? filters.maximumHeight ?? filters.heightMax);
  const minFileSize = readFilterNumber(filters.minFileSize ?? filters.minimumFileSize ?? filters.minSize);
  const maxFileSize = readFilterNumber(filters.maxFileSize ?? filters.maximumFileSize ?? filters.maxSize);
  const width = Number(asset.width ?? asset.dimensions?.width);
  const height = Number(asset.height ?? asset.dimensions?.height);
  const fileSize = Number(asset.fileSize ?? asset.size);

  if (minWidth !== null && (!Number.isFinite(width) || width < minWidth)) return false;
  if (maxWidth !== null && (!Number.isFinite(width) || width > maxWidth)) return false;
  if (minHeight !== null && (!Number.isFinite(height) || height < minHeight)) return false;
  if (maxHeight !== null && (!Number.isFinite(height) || height > maxHeight)) return false;
  if (minFileSize !== null && (!Number.isFinite(fileSize) || fileSize < minFileSize)) return false;
  if (maxFileSize !== null && (!Number.isFinite(fileSize) || fileSize > maxFileSize)) return false;

  const formatFilter = new Set([...normaliseFilterSet(filters.format)].map(normaliseFormatFilter));
  if (formatFilter.size && !formatFilter.has('all') && !formatFilter.has(normaliseFormatFilter(asset.format))) return false;

  const orientationFilter = String(filters.orientation || '').toLocaleLowerCase('en-GB');
  if (orientationFilter && !['all', 'any'].includes(orientationFilter) && orientationFilter !== asset.orientation) return false;

  const sourceFilter = normaliseFilterSet(filters.source ?? filters.sources);
  const sourceValues = [
    ...(asset.sourceCategories || []),
    asset.source,
    asset.isExternal ? 'external' : '',
  ];
  if (sourceFilter.size && !sourceFilter.has('all') && !sourceValues.some(source => sourceFilter.has(String(source).toLocaleLowerCase('en-GB')))) return false;

  const duplicateFilter = String(filters.duplicateStatus ?? filters.duplicates ?? '').toLocaleLowerCase('en-GB');
  if (duplicateFilter && !['all', 'any'].includes(duplicateFilter)) {
    if (['duplicate', 'duplicates'].includes(duplicateFilter) && !asset.isDuplicate) return false;
    if (['unique', 'uniques'].includes(duplicateFilter) && (!asset.isEmbedded || asset.isDuplicate)) return false;
    if (duplicateFilter === 'external' && !asset.isExternal) return false;
  }

  return true;
}

export function selectWordImageAssets(assets = [], options = {}) {
  const ids = new Set(options.selectedIds || options.ids || []);
  let selected = assets.filter(asset => asset?.isEmbedded && asset.bytes instanceof Uint8Array);

  if (ids.size) {
    selected = selected.filter(asset => ids.has(asset.id));
  }

  const mode = String(options.mode ?? options.selection ?? options.duplicateMode ?? 'all').toLocaleLowerCase('en-GB');

  if (mode !== 'unique') {
    return selected;
  }

  const seen = new Map();
  return selected.filter(asset => {
    const hash = asset.hash || calculateDeterministicImageHash(asset.bytes);
    const previous = seen.get(hash) || [];

    if (previous.some(bytes => bytesEqual(bytes, asset.bytes))) {
      return false;
    }

    previous.push(asset.bytes);
    seen.set(hash, previous);
    return true;
  });
}

export const getExtractableWordImageAssets = selectWordImageAssets;

export function sanitiseExtractionFileName(value, fallback = 'image') {
  let name = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '');
  name = name.split(/[\\/]+/).pop() || '';
  name = name.replace(/[<>:"|?*]/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
  name = name.replace(/^\.+$/g, '');

  if (!name) {
    name = fallback;
  }

  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(name)) {
    name = `_${name}`;
  }

  return name.slice(0, 180);
}

export function buildWordImageFileNames(assets = [], options = {}) {
  const strategy = normaliseNamingStrategy(options.strategy ?? options.namingStrategy);
  const documentName = sanitiseExtractionFileName(stripExtension(options.documentName || options.fileName || 'document'), 'document');
  const width = Math.max(3, String(Math.max(1, assets.length)).length);
  const used = new Set();

  return assets.map((asset, index) => {
    const extension = asset.extension || extensionToFormat(getPathExtension(asset.originalName)) || 'bin';
    const fallback = `image-${String(index + 1).padStart(width, '0')}.${extension}`;
    const original = sanitiseExtractionFileName(asset.originalName, fallback);
    const originalWithExtension = hasFileExtension(original) ? original : `${original}.${extension}`;
    let candidate;

    if (strategy === 'sequential') {
      candidate = `image-${String(index + 1).padStart(width, '0')}.${extension}`;
    } else if (strategy === 'document-prefix') {
      candidate = `${documentName}-${originalWithExtension}`;
    } else {
      candidate = originalWithExtension;
    }

    candidate = sanitiseExtractionFileName(candidate, fallback);
    const uniqueName = makeCollisionFreeName(candidate, used);
    used.add(uniqueName.toLocaleLowerCase('en-GB'));
    return uniqueName;
  });
}

export function resolveWordImageFileNameCollisions(candidates = [], existingNames = []) {
  const used = new Set(existingNames.map(normaliseDirectoryNameKey).filter(Boolean));

  return candidates.map(candidate => {
    const safeCandidate = sanitiseExtractionFileName(candidate, 'image');
    const name = makeCollisionFreeName(safeCandidate, used);
    used.add(normaliseDirectoryNameKey(name));
    return name;
  });
}

export const buildExtractionFileNames = buildWordImageFileNames;

export function nameWordImageAssets(assets = [], options = {}) {
  const names = buildWordImageFileNames(assets, options);
  return assets.map((asset, index) => ({ ...asset, outputName: names[index] }));
}

export function buildWordImageManifest(assets = [], options = {}) {
  const namedAssets = options.namedAssets || nameWordImageAssets(assets, options);

  return namedAssets.map(asset => ({
    outputName: asset.outputName || '',
    originalName: asset.originalName || '',
    packagePath: asset.packagePath || '',
    format: asset.format || 'unknown',
    mimeType: asset.mimeType || '',
    width: asset.width ?? asset.dimensions?.width ?? '',
    height: asset.height ?? asset.dimensions?.height ?? '',
    orientation: asset.orientation || 'unknown',
    fileSizeBytes: asset.fileSize ?? asset.size ?? 0,
    source: asset.sourceLabel || asset.source || '',
    altText: asset.altText || '',
    title: asset.title || '',
    hash: asset.hash || '',
    duplicateStatus: asset.duplicateStatus || '',
    embedded: Boolean(asset.isEmbedded),
    external: Boolean(asset.isExternal),
    externalTarget: asset.externalTarget || ''
  }));
}

export function buildWordImageManifestCsv(assets = [], options = {}) {
  const rows = buildWordImageManifest(assets, options);
  const fields = [
    'outputName',
    'originalName',
    'packagePath',
    'format',
    'mimeType',
    'width',
    'height',
    'orientation',
    'fileSizeBytes',
    'source',
    'altText',
    'title',
    'hash',
    'duplicateStatus',
    'embedded',
    'external',
    'externalTarget'
  ];

  return [
    fields.join(','),
    ...rows.map(row => fields.map(field => csvCell(row[field])).join(','))
  ].join('\r\n');
}

export function buildWordImageManifestJson(assets = [], options = {}) {
  return JSON.stringify(buildWordImageManifest(assets, options), null, 2);
}

export function buildWordImageZip(assets = [], options = {}) {
  const namedAssets = options.namedAssets || nameWordImageAssets(assets, options);
  const entries = namedAssets
    .filter(asset => asset.isEmbedded && asset.bytes instanceof Uint8Array)
    .map(asset => ({ name: asset.outputName, bytes: asset.bytes }));

  if (entries.length === 0) {
    throw new WordImageExtractorError('Select at least one embedded image before extracting.', 'no-selection');
  }

  if (options.includeManifest) {
    const manifestFormat = String(options.manifestFormat || 'json').toLocaleLowerCase('en-GB') === 'csv' ? 'csv' : 'json';
    const manifestBytes = new TextEncoder().encode(manifestFormat === 'csv'
      ? buildWordImageManifestCsv(namedAssets, { namedAssets })
      : buildWordImageManifestJson(namedAssets, { namedAssets }));
    entries.push({
      name: `manifest.${manifestFormat}`,
      bytes: manifestBytes
    });
  }

  return createStoredZipArchive(entries);
}

export const createWordImageZip = buildWordImageZip;

function normaliseInputBytes(input) {
  if (input instanceof Uint8Array) {
    return Promise.resolve(input);
  }

  if (input instanceof ArrayBuffer) {
    return Promise.resolve(new Uint8Array(input));
  }

  if (ArrayBuffer.isView(input)) {
    return Promise.resolve(new Uint8Array(input.buffer, input.byteOffset, input.byteLength));
  }

  if (input?.arrayBuffer) {
    return input.arrayBuffer().then(value => new Uint8Array(value));
  }

  return Promise.reject(new WordImageExtractorError('Choose a Word .docx file before inspecting it.', 'missing-input'));
}

function normaliseLimits(options) {
  const supplied = options.limits || {};
  const values = {
    ...WORD_IMAGE_LIMITS,
    ...supplied
  };
  Object.keys(WORD_IMAGE_LIMITS).forEach(key => {
    if (options[key] !== undefined) values[key] = options[key];
  });
  const aliases = {
    maxUncompressedBytes: 'maxTotalUncompressedBytes',
    maxPackageBytes: 'maxTotalUncompressedBytes',
    maxXmlBytes: 'maxXmlPartBytes',
    maxImages: 'maxImageCount',
    maxReferences: 'maxImageReferences',
    maxImageReferenceCount: 'maxImageReferences',
    maxEmbeddedImageBytes: 'maxImageBytes'
  };

  Object.entries(aliases).forEach(([alias, key]) => {
    if (options[alias] !== undefined) values[key] = options[alias];
    if (supplied[alias] !== undefined) values[key] = supplied[alias];
  });

  return Object.fromEntries(Object.entries(values).map(([key, value]) => [
    key,
    Math.max(1, Number(value) || WORD_IMAGE_LIMITS[key])
  ]));
}

function assertPackageSafety(zip, limits) {
  if (zip.entries.length > limits.maxEntries) {
    throw new WordImageExtractorError(
      `This DOCX package contains more than ${limits.maxEntries.toLocaleString('en-GB')} entries, so it was refused for safety.`,
      'package-entry-limit'
    );
  }

  const totalUncompressedBytes = zip.entries.reduce((total, entry) => total + (Number(entry.uncompressedSize) || 0), 0);

  if (totalUncompressedBytes > limits.maxTotalUncompressedBytes) {
    throw new WordImageExtractorError(
      `This DOCX package expands beyond the ${formatByteLimit(limits.maxTotalUncompressedBytes)} browser processing limit.`,
      'package-size-limit'
    );
  }
}

async function readPackageText(zip, entryByPath, path, limits, label) {
  const entry = entryByPath.get(normalisePackagePath(path).toLocaleLowerCase('en-GB'));

  if (!entry) {
    return '';
  }

  if (entry.encrypted) {
    throw new WordImageExtractorError(`The DOCX ${label} part is encrypted and cannot be inspected.`, 'encrypted-part');
  }

  if (entry.uncompressedSize > limits.maxXmlPartBytes) {
    throw new WordImageExtractorError(`The DOCX ${label} part exceeds the safe XML size limit.`, 'xml-size-limit');
  }

  let bytes;

  try {
    bytes = await zip.readBytes(entry.name);
  } catch (error) {
    throw new WordImageExtractorError(
      `The DOCX ${label} part could not be read. ${normaliseErrorMessage(error, 'The ZIP entry is not readable.')}`,
      'unreadable-part'
    );
  }

  if (!bytes || bytes.byteLength > limits.maxXmlPartBytes) {
    throw new WordImageExtractorError(`The DOCX ${label} part exceeds the safe XML size limit.`, 'xml-size-limit');
  }

  return decodeUtf8(bytes);
}

async function readPackageBytes(zip, entry, limit, label) {
  let bytes;

  try {
    bytes = await zip.readBytes(entry.name);
  } catch (error) {
    throw new WordImageExtractorError(
      `${label} could not be read. ${normaliseErrorMessage(error, 'The ZIP entry is not readable.')}`,
      'unreadable-image'
    );
  }

  if (!bytes || bytes.byteLength > limit) {
    throw new WordImageExtractorError(`${label} exceeds the safe image size limit.`, 'image-size-limit');
  }

  return bytes;
}

function hasWordDocumentContentType(xml) {
  return /wordprocessingml\.document(?:\.main)?\+xml/i.test(xml)
    || /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i.test(xml);
}

function parseRelationships(xml, limits) {
  const tree = parseXmlDocument(xml, limits);
  const relationships = new Map();

  walkXml(tree, node => {
    if (node.localName !== 'relationship') return;

    const id = getXmlAttribute(node, 'id');
    if (!id) return;

    const target = decodeXmlEntities(getXmlAttribute(node, 'target'));
    const targetMode = getXmlAttribute(node, 'targetmode') || '';
    relationships.set(id, {
      id,
      type: getXmlAttribute(node, 'type') || '',
      target,
      targetMode,
      external: /^([a-z][a-z\d+.-]*:|\/\/)/i.test(target) || targetMode.toLocaleLowerCase('en-GB') === 'external'
    });
  });

  return relationships;
}

function parseXmlDocument(xml, limits = WORD_IMAGE_LIMITS) {
  const source = String(xml || '');
  const documentNode = {
    name: '#document',
    localName: '#document',
    attributes: {},
    children: [],
    text: '',
    parent: null
  };
  const stack = [documentNode];
  let cursor = 0;
  let nodeCount = 0;

  while (cursor < source.length) {
    if (source[cursor] !== '<') {
      const nextTag = source.indexOf('<', cursor);
      const text = source.slice(cursor, nextTag < 0 ? source.length : nextTag);
      stack[stack.length - 1].text += decodeXmlEntities(text);
      cursor = nextTag < 0 ? source.length : nextTag;
      continue;
    }

    if (source.startsWith('<!--', cursor)) {
      const end = source.indexOf('-->', cursor + 4);
      if (end < 0) throw new Error('An XML comment is not closed.');
      cursor = end + 3;
      continue;
    }

    if (source.startsWith('<![CDATA[', cursor)) {
      const end = source.indexOf(']]>', cursor + 9);
      if (end < 0) throw new Error('An XML CDATA section is not closed.');
      stack[stack.length - 1].text += source.slice(cursor + 9, end);
      cursor = end + 3;
      continue;
    }

    if (source.startsWith('<?', cursor)) {
      const end = source.indexOf('?>', cursor + 2);
      if (end < 0) throw new Error('An XML processing instruction is not closed.');
      cursor = end + 2;
      continue;
    }

    const tagEnd = findXmlTagEnd(source, cursor + 1);
    if (tagEnd < 0) throw new Error('An XML tag is not closed.');
    const rawTag = source.slice(cursor + 1, tagEnd).trim();
    cursor = tagEnd + 1;

    if (!rawTag || rawTag.startsWith('!')) {
      continue;
    }

    if (rawTag.startsWith('/')) {
      const closingName = rawTag.slice(1).trim().toLocaleLowerCase('en-GB');
      const current = stack.pop();

      if (!current || current === documentNode || current.name.toLocaleLowerCase('en-GB') !== closingName) {
        throw new Error(`Unexpected closing tag ${closingName}.`);
      }

      continue;
    }

    const selfClosing = /\/\s*$/.test(rawTag);
    const tagText = selfClosing ? rawTag.replace(/\/\s*$/, '').trim() : rawTag;
    const nameMatch = /^([^\s/>]+)/.exec(tagText);

    if (!nameMatch) {
      throw new Error('An XML element is missing its name.');
    }

    const node = {
      name: nameMatch[1],
      localName: getLocalName(nameMatch[1]),
      attributes: parseXmlAttributes(tagText.slice(nameMatch[0].length)),
      children: [],
      text: '',
      parent: stack[stack.length - 1]
    };
    stack[stack.length - 1].children.push(node);
    nodeCount += 1;

    if (nodeCount > limits.maxXmlNodes) {
      throw new Error('The XML contains too many elements.');
    }

    if (stack.length > limits.maxXmlDepth) {
      throw new Error('The XML nesting depth is not safe to process.');
    }

    if (!selfClosing) {
      stack.push(node);
    }
  }

  if (stack.length !== 1) {
    throw new Error(`The XML element ${stack[stack.length - 1]?.name || 'root'} is not closed.`);
  }

  const roots = documentNode.children.filter(node => node.name !== '#text');

  if (roots.length !== 1) {
    throw new Error('The XML document must contain one root element.');
  }

  return roots[0];
}

function collectImageReferences(tree, onReference) {
  walkXml(tree, node => {
    let relationshipId = '';
    let isImageElement = false;

    if (node.localName === 'blip') {
      relationshipId = getXmlAttribute(node, 'embed') || getXmlAttribute(node, 'link');
      isImageElement = true;
    } else if (node.localName === 'imagedata') {
      relationshipId = getXmlAttribute(node, 'id') || getXmlAttribute(node, 'embed');
      isImageElement = true;
    }

    if (!relationshipId) return;

    onReference({
      relationshipId,
      isImageElement,
      metadata: findImageMetadata(node),
      displaySize: extractDrawingExtent(node),
      crop: extractDrawingCrop(node)
    });
  });
}

export const parseWordXmlDocument = parseXmlDocument;

/**
 * Convert an Open XML English Metric Unit value into physical inches.
 * Word stores DrawingML extents in EMUs; keeping this conversion in the
 * package reader means every consumer uses the same physical-size model.
 */
export function emuToInches(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed / EMU_PER_INCH;
}

/**
 * Read the common DrawingML inline/anchor extent for an image reference.
 * The Word package can contain several size-like elements, so prefer the
 * wp:extent that controls the drawing frame and fall back to a:ext when a
 * frame extent is not present. Unsupported VML and missing extents return
 * null instead of guessing a rendered size.
 */
export function extractDrawingExtent(node) {
  let current = node;
  let drawingScope = null;

  for (let depth = 0; current && depth < 24; depth += 1, current = current.parent) {
    if (['inline', 'anchor'].includes(current.localName)) {
      drawingScope = current;
      break;
    }

    if (current.localName === 'drawing') {
      drawingScope = current;
      break;
    }
  }

  if (!drawingScope) {
    return null;
  }

  const candidates = [];
  walkXml(drawingScope, candidate => {
    const localName = candidate.localName;
    const isExtent = localName === 'extent' || localName === 'ext';

    if (!isExtent) {
      return;
    }

    const widthEmu = Number(getXmlAttribute(candidate, 'cx'));
    const heightEmu = Number(getXmlAttribute(candidate, 'cy'));
    const widthInches = emuToInches(widthEmu);
    const heightInches = emuToInches(heightEmu);

    if (widthInches && heightInches) {
      candidates.push({
        widthEmu,
        heightEmu,
        widthInches,
        heightInches,
        isWordExtent: /^wp:/i.test(candidate.name)
      });
    }
  });

  const selected = candidates.find(candidate => candidate.isWordExtent) || candidates[0];

  if (!selected) {
    return null;
  }

  const { isWordExtent, ...extent } = selected;
  return extent;
}

/**
 * Read the source crop applied to a DrawingML picture. Word stores crop
 * amounts as thousandths of a percent on a:srcRect within pic:blipFill.
 * Missing values mean zero. Invalid values are treated conservatively as
 * requiring preservation rather than being guessed.
 */
export function extractDrawingCrop(node) {
  let current = node;

  for (let depth = 0; current && depth < 24; depth += 1, current = current.parent) {
    if (current.localName === 'blipfill') {
      let sourceRect = null;
      walkXml(current, candidate => {
        if (!sourceRect && candidate.localName === 'srcrect') {
          sourceRect = candidate;
        }
      });

      if (!sourceRect) return null;

      const values = ['l', 'r', 't', 'b'].map(name => {
        const raw = getXmlAttribute(sourceRect, name);
        if (raw === '') return 0;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      });
      const reliable = values.every(value => Number.isFinite(value) && value >= 0 && value <= 100000);
      const hasNonZeroCrop = values.some(value => Number.isFinite(value) && value > 0);

      return {
        left: values[0],
        right: values[1],
        top: values[2],
        bottom: values[3],
        hasNonZeroCrop,
        reliable,
        requiresPreservation: !reliable || hasNonZeroCrop
      };
    }

    if (['inline', 'anchor', 'drawing'].includes(current.localName)) {
      break;
    }
  }

  return null;
}

function findImageMetadata(node) {
  let current = node;
  let fallback = { altText: '', title: '' };

  for (let depth = 0; current && depth < 12; depth += 1, current = current.parent) {
    const directAltText = getXmlAttribute(current, 'descr') || getXmlAttribute(current, 'alttext') || getXmlAttribute(current, 'alt');
    const directTitle = getXmlAttribute(current, 'title');

    if (directAltText || directTitle) {
      return {
        altText: directAltText,
        title: directTitle
      };
    }

    const candidates = [];
    walkXml(current, child => {
      if (child.localName === 'docpr' || child.localName === 'cnvpr') {
        candidates.push(child);
      }
    });

    for (const candidate of candidates) {
      const altText = getXmlAttribute(candidate, 'descr') || getXmlAttribute(candidate, 'alttext');
      const title = getXmlAttribute(candidate, 'title');

      if (altText || title) {
        return {
          altText,
          title
        };
      }

      if (!fallback.altText && !fallback.title) {
        fallback = { altText, title };
      }
    }

    if (['inline', 'anchor', 'drawing'].includes(current.localName)) {
      break;
    }
  }

  return fallback;
}

function addAssetReference(asset, reference) {
  asset.references.push({
    source: reference.sourceCategory,
    sourcePart: reference.sourcePart,
    relationshipId: reference.relationshipId,
    displaySize: reference.displaySize || null,
    crop: reference.crop || null
  });
  asset.sourceCategories.add(reference.sourceCategory);

  if (reference.metadata?.altText) asset.altTexts.add(reference.metadata.altText);
  if (reference.metadata?.title) asset.titles.add(reference.metadata.title);
}

async function finaliseAsset(asset, index) {
  const sourceCategories = [...asset.sourceCategories].sort((left, right) => sourceOrder(left) - sourceOrder(right));
  const altTexts = [...asset.altTexts];
  const titles = [...asset.titles];
  const bytes = asset.bytes instanceof Uint8Array ? asset.bytes : null;
  const hash = bytes ? await calculateDeterministicImageHashAsync(bytes) : null;
  const displayUsages = asset.references
    .map(reference => reference.displaySize)
    .filter(Boolean);
  const maxDisplayedWidth = displayUsages.length
    ? Math.max(...displayUsages.map(usage => usage.widthInches))
    : null;
  const maxDisplayedHeight = displayUsages.length
    ? Math.max(...displayUsages.map(usage => usage.heightInches))
    : null;
  const displaySize = maxDisplayedWidth && maxDisplayedHeight
    ? {
      widthInches: maxDisplayedWidth,
      heightInches: maxDisplayedHeight,
      widthEmu: Math.round(maxDisplayedWidth * EMU_PER_INCH),
      heightEmu: Math.round(maxDisplayedHeight * EMU_PER_INCH)
    }
    : null;
  const cropUsages = asset.references
    .map(reference => reference.crop)
    .filter(Boolean);
  const croppedUsages = cropUsages.filter(crop => crop.requiresPreservation);

  return {
    ...asset,
    id: `word-image-${String(index + 1).padStart(3, '0')}`,
    bytes,
    width: asset.dimensions?.width ?? null,
    height: asset.dimensions?.height ?? null,
    fileSize: bytes?.byteLength ?? 0,
    size: bytes?.byteLength ?? 0,
    displaySize,
    displayUsages,
    displayUsageCount: displayUsages.length,
    maxDisplayedWidthInches: maxDisplayedWidth,
    maxDisplayedHeightInches: maxDisplayedHeight,
    cropUsages,
    cropUsageCount: cropUsages.length,
    croppedUsageCount: croppedUsages.length,
    hasNonZeroCrop: cropUsages.some(crop => crop.hasNonZeroCrop),
    requiresCropPreservation: croppedUsages.length > 0,
    orientation: getOrientation(asset.dimensions),
    sourceCategories,
    source: sourceCategories.length === 1 ? sourceCategories[0] : sourceCategories.length > 1 ? 'multiple' : 'other',
    sourceLabel: sourceCategories.length ? sourceCategories.join(', ') : 'other',
    altText: altTexts[0] || '',
    altTexts,
    title: titles[0] || '',
    titles,
    previewSupported: Boolean(asset.previewSupported),
    canPreview: Boolean(asset.previewSupported),
    hash,
    duplicateStatus: asset.isEmbedded ? 'unique' : asset.isExternal ? 'external' : asset.missing ? 'missing' : 'not-embedded',
    isDuplicate: false,
    duplicateOf: null,
    duplicateGroup: null
  };
}

function compareAssets(left, right) {
  const leftKey = left.isExternal ? `external:${left.externalTarget}` : left.packagePath || left.originalName;
  const rightKey = right.isExternal ? `external:${right.externalTarget}` : right.packagePath || right.originalName;
  return leftKey.localeCompare(rightKey, 'en-GB');
}

function buildWordImageSummary(assets, warnings, imageReferenceCount = 0) {
  const embedded = assets.filter(asset => asset.isEmbedded);
  const external = assets.filter(asset => asset.isExternal);
  const duplicateGroups = new Set(embedded.filter(asset => asset.isDuplicate).map(asset => asset.duplicateGroup));

  return {
    assetCount: assets.length,
    embeddedCount: embedded.length,
    externalCount: external.length,
    missingCount: assets.filter(asset => asset.missing).length,
    duplicateAssetCount: embedded.filter(asset => asset.isDuplicate).length,
    duplicateGroupCount: duplicateGroups.size,
    imageReferenceCount,
    selectedCount: 0,
    warningCount: uniqueStrings(warnings).length
  };
}

function makeImageInfo(format, dimensions, isImage) {
  const normalisedFormat = format || 'unknown';
  const extension = IMAGE_EXTENSIONS[normalisedFormat] || normalisedFormat;
  const cleanDimensions = validDimensions(dimensions);

  return {
    isImage,
    format: normalisedFormat,
    formatLabel: normalisedFormat === 'unknown' ? 'Unknown' : normalisedFormat.toLocaleUpperCase('en-GB'),
    extension,
    mimeType: IMAGE_MIME_TYPES[normalisedFormat] || 'application/octet-stream',
    dimensions: cleanDimensions,
    previewSupported: PREVIEWABLE_FORMATS.has(normalisedFormat)
  };
}

function validDimensions(dimensions) {
  if (!dimensions || !Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height)
    || dimensions.width <= 0 || dimensions.height <= 0) {
    return null;
  }

  return {
    width: Math.round(dimensions.width),
    height: Math.round(dimensions.height)
  };
}

function readPngDimensions(bytes) {
  if (bytes.byteLength < 24) return null;
  const view = dataView(bytes);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

function readJpegDimensions(bytes) {
  let offset = 2;

  while (offset + 9 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];

    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }

    if (offset + 1 >= bytes.byteLength) return null;
    const length = dataView(bytes).getUint16(offset, false);

    if (length < 2 || offset + length > bytes.byteLength) return null;

    const isFrameMarker = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf);

    if (isFrameMarker && length >= 7) {
      const view = dataView(bytes);
      return {
        width: view.getUint16(offset + 5, false),
        height: view.getUint16(offset + 3, false)
      };
    }

    offset += length;
  }

  return null;
}

function readGifDimensions(bytes) {
  if (bytes.byteLength < 10) return null;
  const view = dataView(bytes);
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function readBmpDimensions(bytes) {
  if (bytes.byteLength < 26) return null;
  const view = dataView(bytes);
  return { width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)) };
}

function readWebpDimensions(bytes) {
  let offset = 12;

  while (offset + 8 <= bytes.byteLength) {
    const chunk = ascii(bytes, offset, 4);
    const length = dataView(bytes).getUint32(offset + 4, true);
    const dataOffset = offset + 8;

    if (chunk === 'VP8X' && dataOffset + 10 <= bytes.byteLength) {
      return {
        width: 1 + readLittleEndian24(bytes, dataOffset + 4),
        height: 1 + readLittleEndian24(bytes, dataOffset + 7)
      };
    }

    if (chunk === 'VP8 ' && dataOffset + 10 <= bytes.byteLength) {
      for (let index = dataOffset; index + 10 < bytes.byteLength; index += 1) {
        if (bytes[index] === 0x9d && bytes[index + 1] === 0x01 && bytes[index + 2] === 0x2a) {
          const view = dataView(bytes);
          return { width: view.getUint16(index + 3, true) & 0x3fff, height: view.getUint16(index + 5, true) & 0x3fff };
        }
      }
    }

    if (chunk === 'VP8L' && dataOffset + 5 <= bytes.byteLength && bytes[dataOffset] === 0x2f) {
      const b1 = bytes[dataOffset + 1];
      const b2 = bytes[dataOffset + 2];
      const b3 = bytes[dataOffset + 3];
      const b4 = bytes[dataOffset + 4];
      return {
        width: 1 + (b1 | ((b2 & 0x3f) << 8)),
        height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0xf) << 10))
      };
    }

    offset = dataOffset + length + (length % 2);
  }

  return null;
}

function readTiffDimensions(bytes) {
  if (bytes.byteLength < 8) return null;
  const littleEndian = bytes[0] === 0x49;
  const view = dataView(bytes);
  const ifdOffset = view.getUint32(4, littleEndian);

  if (ifdOffset + 2 > bytes.byteLength) return null;
  const count = view.getUint16(ifdOffset, littleEndian);
  let width = null;
  let height = null;

  for (let index = 0; index < Math.min(count, 256); index += 1) {
    const offset = ifdOffset + 2 + index * 12;
    if (offset + 12 > bytes.byteLength) break;
    const tag = view.getUint16(offset, littleEndian);
    const value = readTiffValue(bytes, offset, littleEndian);

    if (tag === 256) width = value;
    if (tag === 257) height = value;
  }

  return width && height ? { width, height } : null;
}

function readTiffValue(bytes, entryOffset, littleEndian) {
  const view = dataView(bytes);
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const count = view.getUint32(entryOffset + 4, littleEndian);
  const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
  const size = sizes[type];

  if (!size || count < 1 || count * size > 1024 * 1024) return null;
  const valueOffset = count * size <= 4 ? entryOffset + 8 : view.getUint32(entryOffset + 8, littleEndian);

  if (valueOffset < 0 || valueOffset + size > bytes.byteLength) return null;

  if (type === 3) return view.getUint16(valueOffset, littleEndian);
  if (type === 4) return view.getUint32(valueOffset, littleEndian);
  if (type === 8) return Math.abs(view.getInt16(valueOffset, littleEndian));
  if (type === 9) return Math.abs(view.getInt32(valueOffset, littleEndian));
  return null;
}

function readSvgDimensions(bytes) {
  const text = decodeUtf8(bytes.slice(0, Math.min(bytes.byteLength, 1024 * 1024)));
  const svgMatch = /<svg\b([^>]*)>/i.exec(text);

  if (!svgMatch) return null;

  const attrs = parseXmlAttributes(svgMatch[1]);
  const width = parseSvgLength(attrs.width);
  const height = parseSvgLength(attrs.height);
  const viewBox = String(attrs.viewbox || '').trim().split(/[\s,]+/).map(Number);

  if (width && height) return { width, height };
  if (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) return { width: viewBox[2], height: viewBox[3] };
  return null;
}

function readEmfDimensions(bytes) {
  if (bytes.byteLength < 44) return null;
  const view = dataView(bytes);
  const signature = view.getUint32(40, true);

  if (signature !== 0x464d4520) return null;
  return {
    width: Math.abs(view.getInt32(8, true)),
    height: Math.abs(view.getInt32(12, true))
  };
}

function readIcoDimensions(bytes) {
  if (bytes.byteLength < 8) return null;
  return {
    width: bytes[6] || 256,
    height: bytes[7] || 256
  };
}

function isSvgBytes(bytes) {
  const text = decodeUtf8(bytes.slice(0, Math.min(bytes.byteLength, 1024))).replace(/^\uFEFF/, '').trimStart();
  return /^<svg\b/i.test(text) || /^<\?xml[\s\S]*?<svg\b/i.test(text);
}

function isEmfBytes(bytes) {
  return bytes.byteLength >= 44 && dataView(bytes).getUint32(40, true) === 0x464d4520;
}

function isWmfBytes(bytes) {
  if (bytes.byteLength < 4) return false;
  const view = dataView(bytes);
  return view.getUint32(0, true) === 0x9ac6cdd7 || view.getUint16(0, true) === 1 || view.getUint16(0, true) === 2;
}

function getOrientation(dimensions) {
  if (!dimensions) return 'unknown';
  if (dimensions.width === dimensions.height) return 'square';
  return dimensions.width > dimensions.height ? 'landscape' : 'portrait';
}

function makeCollisionFreeName(candidate, used) {
  const extensionMatch = /^(.*?)(\.[^.]*)?$/.exec(candidate);
  const stem = extensionMatch?.[1] || candidate;
  const extension = extensionMatch?.[2] || '';
  let name = candidate;
  let count = 2;

  while (used.has(name.toLocaleLowerCase('en-GB'))) {
    name = `${stem} (${count})${extension}`;
    count += 1;
  }

  return name;
}

function normaliseDirectoryNameKey(value) {
  return String(value || '').trim().toLocaleLowerCase('en-GB');
}

function normaliseNamingStrategy(value) {
  const strategy = String(value || 'original').toLocaleLowerCase('en-GB');
  if (['sequential', 'sequence', 'numbered'].includes(strategy)) return 'sequential';
  if (['document-prefix', 'document-name-prefix', 'prefix'].includes(strategy)) return 'document-prefix';
  return 'original';
}

function classifySourcePart(path) {
  const lower = path.toLocaleLowerCase('en-GB');
  if (lower === 'word/document.xml') return 'body';
  if (/^word\/header[^/]*\.xml$/i.test(path)) return 'header';
  if (/^word\/footer[^/]*\.xml$/i.test(path)) return 'footer';
  return 'other';
}

function getRelationshipsPartPath(partPath) {
  const slash = partPath.lastIndexOf('/');
  const directory = slash >= 0 ? partPath.slice(0, slash) : '';
  const name = slash >= 0 ? partPath.slice(slash + 1) : partPath;
  return `${directory ? `${directory}/` : ''}_rels/${name}.rels`;
}

function isImageRelationship(type) {
  return String(type || '').toLocaleLowerCase('en-GB').endsWith(IMAGE_RELATIONSHIP_SUFFIX);
}

function resolveRelationshipTarget(sourcePart, target) {
  const rawTarget = String(target || '').split('#')[0].split('?')[0];

  if (!rawTarget || /^([a-z][a-z\d+.-]*:|\/\/)/i.test(rawTarget)) {
    return null;
  }

  const decodedTarget = safeDecodeURIComponent(rawTarget).replace(/\\/g, '/');
  const combined = decodedTarget.startsWith('/')
    ? decodedTarget.slice(1)
    : `${sourcePart.slice(0, sourcePart.lastIndexOf('/') + 1)}${decodedTarget}`;
  const segments = [];

  for (const segment of combined.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }

  return segments.join('/');
}

function normalisePackagePath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function isSafePackagePath(path) {
  const value = String(path || '').replace(/\\/g, '/');
  return Boolean(value)
    && !value.startsWith('/')
    && !value.split('/').some(segment => !segment || segment === '.' || segment === '..' || segment.includes(':'));
}

function getPackageBaseName(path) {
  return normalisePackagePath(path).split('/').pop() || 'image';
}

function getExternalBaseName(target) {
  try {
    const url = new URL(target);
    return getPackageBaseName(url.pathname) || 'external-image';
  } catch {
    return getPackageBaseName(String(target).split(/[?#]/)[0]);
  }
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getPathExtension(path) {
  const name = getPackageBaseName(path).toLocaleLowerCase('en-GB');
  const match = /\.([a-z0-9]+)$/.exec(name);
  return match ? match[1] : '';
}

function extensionToFormat(extension) {
  const value = String(extension || '').toLocaleLowerCase('en-GB');
  if (value === 'jpg' || value === 'jpeg') return 'jpeg';
  if (value === 'tif' || value === 'tiff') return 'tiff';
  return IMAGE_EXTENSIONS[value] ? value : null;
}

function stripExtension(value) {
  return String(value || '').replace(/\.[^.\\/]+$/, '') || 'document';
}

function hasFileExtension(value) {
  return /\.[^./\\]+$/.test(String(value || ''));
}

function readFilterNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normaliseFilterSet(value) {
  if (value === '' || value === null || value === undefined) return new Set();
  const values = Array.isArray(value) ? value : [value];
  return new Set(values.map(item => String(item).toLocaleLowerCase('en-GB')).filter(Boolean));
}

function normaliseFormatFilter(value) {
  const format = String(value || '').toLocaleLowerCase('en-GB');
  if (format === 'jpg') return 'jpeg';
  if (format === 'tif') return 'tiff';
  return format;
}

function sourceOrder(value) {
  const index = SOURCE_ORDER.indexOf(value);
  return index < 0 ? SOURCE_ORDER.length : index;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatByteLimit(value) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = Number(value) || 0;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toLocaleString('en-GB', { maximumFractionDigits: 1 })} ${units[unit]}`;
}

function getLocalName(name) {
  return String(name || '').split(':').pop().toLocaleLowerCase('en-GB');
}

function getXmlAttribute(node, name) {
  const wanted = String(name || '').toLocaleLowerCase('en-GB');
  const direct = node?.attributes?.[wanted] ?? node?.attributes?.[name];

  if (direct !== undefined) return direct;

  const found = Object.entries(node?.attributes || {}).find(([key]) => getLocalName(key) === wanted);
  return found ? found[1] : '';
}

function parseXmlAttributes(text) {
  const attributes = {};
  const pattern = /([^\s=/>]+)\s*=\s*(["'])([\s\S]*?)\2/g;
  let match;

  while ((match = pattern.exec(String(text || '')))) {
    const name = match[1];
    attributes[name.toLocaleLowerCase('en-GB')] = decodeXmlEntities(match[3]);
  }

  return attributes;
}

function findXmlTagEnd(source, start) {
  let quote = '';

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }

  return -1;
}

function walkXml(node, callback) {
  callback(node);
  node.children?.forEach(child => walkXml(child, callback));
}

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => codePoint(code, 16))
    .replace(/&#(\d+);/g, (_match, code) => codePoint(code, 10))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function codePoint(value, radix) {
  const number = parseInt(value, radix);
  return Number.isFinite(number) && number <= 0x10ffff ? String.fromCodePoint(number) : '';
}

function parseSvgLength(value) {
  const match = /^\s*([\d.]+)(?:px|pt|pc|cm|mm|in)?\s*$/i.exec(String(value || ''));
  return match ? Number(match[1]) : null;
}

function readLittleEndian24(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function startsWithBytes(bytes, signature) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function hasSignature(bytes, signature) {
  return startsWithBytes(bytes, signature);
}

function hasAsciiSignature(bytes, signature) {
  return ascii(bytes, 0, signature.length) === signature;
}

function ascii(bytes, offset, length) {
  return Array.from(bytes.slice(offset, offset + length), byte => String.fromCharCode(byte)).join('');
}

function dataView(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function decodeUtf8(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return new Uint8Array();
}

function bytesEqual(left, right) {
  if (left?.byteLength !== right?.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(value => String(value)))];
}

function normaliseErrorMessage(error, fallback) {
  const message = String(error?.message || '').trim();
  return message || fallback;
}
