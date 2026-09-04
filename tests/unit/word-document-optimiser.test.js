import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

import {
  calculateCrc32,
  createStoredZipArchive,
  readZipArchive
} from '../../src/tools/power-platform-solution.js';
import {
  EMU_PER_INCH,
  LEGACY_DOC_MESSAGE,
  WordImageExtractorError,
  detectWordInputType,
  extractDrawingExtent,
  readWordImageDocument,
  validateWordPackage
} from '../../src/tools/word-image-extractor.js';
import {
  DEFAULT_WORD_OPTIMISATION_PRESET,
  WORD_OPTIMISER_STATUS,
  analyseWordDocument,
  buildOptimisedWordPackage,
  buildWordOptimisationPlan,
  buildWordOptimisationSummary,
  calculateDisplayedPpi,
  calculateEffectivePpi,
  calculateTargetDimensions,
  encodeWordRasterAsset,
  isSafeWordRasterDimensions,
  normaliseWordOptimisationPreset,
  optimiseWordDocument,
  validateOptimisedWordPackage
} from '../../src/tools/word-document-optimiser.js';

const encoder = new TextEncoder();

test('accepts DOCX, rejects legacy .doc, encrypted Office and malformed packages', async () => {
  assert.equal(detectWordInputType(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 'document.docx'), 'docx');
  assert.equal(detectWordInputType(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'document.doc'), 'legacy-doc');

  await assert.rejects(
    () => analyseWordDocument(new Uint8Array([1, 2, 3]), { fileName: 'legacy.doc' }),
    error => error instanceof WordImageExtractorError && error.message === LEGACY_DOC_MESSAGE
  );
  await assert.rejects(
    () => analyseWordDocument(new Uint8Array([1, 2, 3]), { fileName: 'broken.docx' }),
    error => error instanceof WordImageExtractorError && error.code === 'invalid-docx'
  );
});

test('converts DrawingML EMU extents and chooses the largest usage of a shared image', async () => {
  assert.equal(EMU_PER_INCH, 914400);
  assert.equal(calculateEffectivePpi(1800, 10), 180);
  assert.deepEqual(calculateDisplayedPpi(
    { width: 2400, height: 1350 },
    { widthInches: 6, heightInches: 3.375 }
  ), {
    widthPpi: 400,
    heightPpi: 400,
    effectivePpi: 400
  });

  const result = await readWordImageDocument(createDocxArchive({
    media: [
      ['shared.png', createPng(2400, 1350, 11)],
      ['efficient.png', createPng(300, 200, 12)],
      ['unknown.png', createPng(1600, 900, 13)],
      ['diagram.svg', encoder.encode('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"/>')]
    ],
    documentXml: [
      '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp">',
      '<w:body>',
      '<w:drawing><wp:inline><wp:extent cx="5486400" cy="3086100"/><a:blip r:embed="rIdShared"/></wp:inline></w:drawing>',
      '<w:drawing><wp:inline><wp:extent cx="1828800" cy="914400"/><a:blip r:embed="rIdShared"/></wp:inline></w:drawing>',
      '<w:drawing><wp:inline><wp:extent cx="1828800" cy="1219200"/><a:blip r:embed="rIdEfficient"/></wp:inline></w:drawing>',
      '<w:drawing><a:blip r:embed="rIdUnknown"/></w:drawing>',
      '<w:drawing><wp:inline><wp:extent cx="2743200" cy="1371600"/><a:blip r:embed="rIdVector"/></wp:inline></w:drawing>',
      '</w:body></w:document>'
    ].join(''),
    relationships: [
      ['rIdShared', 'media/shared.png'],
      ['rIdEfficient', 'media/efficient.png'],
      ['rIdUnknown', 'media/unknown.png'],
      ['rIdVector', 'media/diagram.svg']
    ]
  }), { fileName: 'screenshots.docx' });

  const shared = result.embeddedAssets.find(asset => asset.originalName === 'shared.png');
  assert.equal(shared.references.length, 2);
  assert.equal(shared.displayUsageCount, 2);
  assert.equal(shared.displaySize.widthInches, 6);
  assert.equal(shared.displaySize.heightInches, 3.375);
  assert.equal(shared.references[1].displaySize.widthInches, 2);

  const plan = buildWordOptimisationPlan(result, { preset: 'documentation' });
  assert.equal(plan.find(item => item.originalName === 'shared.png').status, WORD_OPTIMISER_STATUS.OPTIMISE);
  assert.equal(plan.find(item => item.originalName === 'shared.png').effectivePpi, 400);
  assert.deepEqual(plan.find(item => item.originalName === 'shared.png').proposedDimensions, { width: 1080, height: 608 });
  assert.equal(plan.find(item => item.originalName === 'efficient.png').status, WORD_OPTIMISER_STATUS.ALREADY_EFFICIENT);
  assert.equal(plan.find(item => item.originalName === 'unknown.png').status, WORD_OPTIMISER_STATUS.UNKNOWN_DISPLAY);
  assert.equal(plan.find(item => item.originalName === 'diagram.svg').status, WORD_OPTIMISER_STATUS.UNSUPPORTED);
});

test('detects DrawingML cropping and preserves any shared asset with a cropped usage', async () => {
  const cropCases = [
    ['left', 'l="10000"', { left: 10000, right: 0, top: 0, bottom: 0 }],
    ['right', 'r="12500"', { left: 0, right: 12500, top: 0, bottom: 0 }],
    ['top', 't="7500"', { left: 0, right: 0, top: 7500, bottom: 0 }],
    ['bottom', 'b="20000"', { left: 0, right: 0, top: 0, bottom: 20000 }],
    ['multiple', 'l="10000" r="12500" t="7500" b="20000"', { left: 10000, right: 12500, top: 7500, bottom: 20000 }]
  ];

  for (const [name, attributes, expected] of cropCases) {
    const result = await readWordImageDocument(createDocxArchive({
      media: [[`${name}.png`, createPng(2400, 1350, 20)]],
      documentXml: `<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp" xmlns:pic="pic"><w:body><w:drawing><wp:inline><wp:extent cx="5486400" cy="3086100"/><pic:pic><pic:blipFill><a:srcRect ${attributes}/><a:blip r:embed="rId1"/></pic:blipFill></pic:pic></wp:inline></w:drawing></w:body></w:document>`,
      relationships: [['rId1', `media/${name}.png`]]
    }), { fileName: `${name}.docx` });
    const asset = result.embeddedAssets[0];

    assert.deepEqual(asset.references[0].crop, {
      ...expected,
      hasNonZeroCrop: true,
      reliable: true,
      requiresPreservation: true
    });
    assert.equal(asset.croppedUsageCount, 1);

    const plan = buildWordOptimisationPlan(result, { preset: 'documentation' });
    assert.equal(plan[0].status, WORD_OPTIMISER_STATUS.PRESERVE);
    assert.match(plan[0].reason, /Word cropping.*preserved unchanged/i);
  }

  const zeroCrop = await readWordImageDocument(createDocxArchive({
    media: [['zero.png', createPng(2400, 1350, 21)]],
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp" xmlns:pic="pic"><w:body><w:drawing><wp:inline><wp:extent cx="5486400" cy="3086100"/><pic:pic><pic:blipFill><a:srcRect l="0" r="0" t="0" b="0"/><a:blip r:embed="rId1"/></pic:blipFill></pic:pic></wp:inline></w:drawing></w:body></w:document>',
    relationships: [['rId1', 'media/zero.png']]
  }), { fileName: 'zero.docx' });
  assert.equal(zeroCrop.embeddedAssets[0].hasNonZeroCrop, false);
  assert.equal(zeroCrop.embeddedAssets[0].croppedUsageCount, 0);
  assert.equal(buildWordOptimisationPlan(zeroCrop, { preset: 'documentation' })[0].status, WORD_OPTIMISER_STATUS.OPTIMISE);

  const sharedCrop = await readWordImageDocument(createDocxArchive({
    media: [['shared-crop.png', createPng(2400, 1350, 22)]],
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp" xmlns:pic="pic"><w:body><w:drawing><wp:inline><wp:extent cx="5486400" cy="3086100"/><pic:pic><pic:blipFill><a:blip r:embed="rId1"/></pic:blipFill></pic:pic></wp:inline></w:drawing><w:drawing><wp:inline><wp:extent cx="5486400" cy="3086100"/><pic:pic><pic:blipFill><a:srcRect l="10000"/><a:blip r:embed="rId1"/></pic:blipFill></pic:pic></wp:inline></w:drawing></w:body></w:document>',
    relationships: [['rId1', 'media/shared-crop.png']]
  }), { fileName: 'shared-crop.docx' });
  const sharedAsset = sharedCrop.embeddedAssets[0];
  assert.equal(sharedAsset.references.length, 2);
  assert.equal(sharedAsset.croppedUsageCount, 1);
  assert.equal(buildWordOptimisationPlan(sharedCrop, { preset: 'documentation' })[0].status, WORD_OPTIMISER_STATUS.PRESERVE);
});

test('normalises presets, preserves aspect ratio and never upscales', () => {
  assert.equal(normaliseWordOptimisationPreset('unknown').id, DEFAULT_WORD_OPTIMISATION_PRESET);
  assert.equal(normaliseWordOptimisationPreset('lossless-clean-up').id, 'lossless');
  assert.deepEqual(calculateTargetDimensions({
    sourceWidth: 2400,
    sourceHeight: 1350,
    displayWidthInches: 6,
    displayHeightInches: 3.375,
    targetPpi: 180
  }), {
    width: 1080,
    height: 608,
    targetWidth: 1080,
    targetHeight: 608,
    scale: 0.45,
    targetPpi: 180
  });
  const alreadySmall = calculateTargetDimensions({
    sourceWidth: 300,
    sourceHeight: 200,
    displayWidthInches: 4,
    displayHeightInches: 2.667,
    targetPpi: 180
  });
  assert.equal(alreadySmall.scale, 1);
  assert.deepEqual(calculateTargetDimensions({
    sourceWidth: 2,
    sourceHeight: 1,
    displayWidthInches: 10,
    displayHeightInches: 5,
    targetPpi: 180
  }).width, 2);
});

test('keeps moderate-area tall and wide rasters within bounded decode and canvas limits', () => {
  assert.equal(isSafeWordRasterDimensions(1238, 12921), true);
  assert.equal(isSafeWordRasterDimensions(12921, 1238), true);
  assert.equal(isSafeWordRasterDimensions(10001, 10001), false);
  assert.equal(isSafeWordRasterDimensions(1, 32767), true);
  assert.equal(isSafeWordRasterDimensions(1, 32768), false);
  assert.equal(isSafeWordRasterDimensions(12000, 8000, undefined, 'target'), true);
  assert.equal(isSafeWordRasterDimensions(32768, 100, undefined, 'target'), false);
  assert.equal(isSafeWordRasterDimensions(10001, 10001, undefined, 'target'), false);
});

test('rejects excessive source area and unsafe target canvases before browser decode', async () => {
  await assert.rejects(
    () => encodeWordRasterAsset({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      width: 10001,
      height: 10001,
      format: 'png'
    }, { targetDimensions: { width: 100, height: 100 } }),
    error => error instanceof WordImageExtractorError && error.code === 'decoded-image-limit'
  );

  await assert.rejects(
    () => encodeWordRasterAsset({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      width: 100,
      height: 100,
      format: 'png'
    }, { targetDimensions: { width: 32768, height: 1 } }),
    error => error instanceof WordImageExtractorError && error.code === 'target-canvas-limit'
  );
});

test('applies a five-percent minimum linear resize tolerance near the selected target', () => {
  const marginal = {
    embeddedAssets: [{
      id: 'tall-diagram',
      packagePath: 'word/media/diagram-4.png',
      originalName: 'diagram-4.png',
      format: 'png',
      fileSize: 1000,
      width: 1238,
      height: 12921,
      isEmbedded: true,
      references: [],
      displaySize: { widthInches: 6.67, heightInches: 69.56 }
    }],
    zipArchive: {
      entries: [{ name: 'word/media/diagram-4.png', compressedSize: 1000, isDirectory: false }]
    }
  };
  const marginalPlan = buildWordOptimisationPlan(marginal, { preset: 'documentation' });

  assert.equal(marginalPlan[0].status, WORD_OPTIMISER_STATUS.ALREADY_EFFICIENT);
  assert.match(marginalPlan[0].reason, /marginally above.*negligible re-encoding/i);

  const oversized = {
    ...marginal,
    embeddedAssets: [{
      ...marginal.embeddedAssets[0],
      id: 'large-screenshot',
      packagePath: 'word/media/large.png',
      originalName: 'large.png',
      width: 2400,
      height: 1350,
      displaySize: { widthInches: 6, heightInches: 3.375 }
    }]
  };
  assert.equal(buildWordOptimisationPlan(oversized, { preset: 'documentation' })[0].status, WORD_OPTIMISER_STATUS.OPTIMISE);
});

test('lossless, unknown display sizes, vectors and unsupported formats remain unchanged', async () => {
  const result = await readWordImageDocument(createDocxArchive({
    media: [
      ['screen.png', createPng(2400, 1350, 3)],
      ['diagram.svg', encoder.encode('<svg xmlns="http://www.w3.org/2000/svg"/>')],
      ['photo.gif', createGif(2000, 1000)]
    ],
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp"><w:body><w:drawing><wp:inline><wp:extent cx="5486400" cy="3086100"/><a:blip r:embed="rId1"/></wp:inline></w:drawing><a:blip r:embed="rId2"/><a:blip r:embed="rId3"/></w:body></w:document>',
    relationships: [
      ['rId1', 'media/screen.png'],
      ['rId2', 'media/diagram.svg'],
      ['rId3', 'media/photo.gif']
    ]
  }), { fileName: 'safe.docx' });
  const plan = buildWordOptimisationPlan(result, { preset: 'lossless' });

  assert.ok(plan.every(item => item.status !== WORD_OPTIMISER_STATUS.OPTIMISE));
  assert.equal(plan.find(item => item.originalName === 'screen.png').reason.includes('pixel-safe'), true);
  assert.equal(plan.find(item => item.originalName === 'diagram.svg').status, WORD_OPTIMISER_STATUS.UNSUPPORTED);
  assert.equal(plan.find(item => item.originalName === 'photo.gif').status, WORD_OPTIMISER_STATUS.UNSUPPORTED);
});

test('replacement happens only when encoded bytes are smaller and source bytes are never mutated', async () => {
  const source = createDocxArchive({
    media: [['screen.png', createPng(2400, 1350, 5, 4000)]],
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp"><w:body><w:drawing><wp:inline><wp:extent cx="5486400" cy="3086100"/><a:blip r:embed="rId1"/></wp:inline></w:drawing></w:body></w:document>',
    relationships: [['rId1', 'media/screen.png']],
    extra: [['customXml/item1.xml', encoder.encode('untouched')]]
  });
  const before = new Uint8Array(source);
  const analysis = await analyseWordDocument(source, { fileName: 'source.docx', preset: 'documentation' });
  const replacement = createPng(1080, 608, 6);
  const output = await optimiseWordDocument(analysis, {
    encodeRasterAsset: async () => ({
      bytes: replacement,
      width: 1080,
      height: 608
    })
  });

  assert.equal(output.replacements.size, 1);
  assert.ok(output.bytes.byteLength < source.byteLength);
  assert.deepEqual(source, before);
  assert.equal(output.summary.changedCount, 1);
  assert.equal(output.validation.valid, true);

  const outputZip = await readZipArchive(output.bytes);
  assert.deepEqual(await outputZip.readBytes('customXml/item1.xml'), encoder.encode('untouched'));
  assert.deepEqual(await outputZip.readBytes('word/media/screen.png'), replacement);

  const notSmaller = await optimiseWordDocument(analysis, {
    encodeRasterAsset: async asset => ({
      bytes: new Uint8Array(asset.bytes.byteLength + 1),
      width: 1080,
      height: 608
    })
  });
  assert.equal(notSmaller.replacements.size, 0);
  assert.deepEqual(notSmaller.bytes, source);
});

test('preserves per-image decode and encode failures while continuing other assets', async () => {
  const source = createDocxArchive({
    media: [
      ['decode-failure.png', createPng(2400, 1350, 40, 2000)],
      ['encode-failure.png', createPng(2400, 1350, 41, 2000)],
      ['good.png', createPng(2400, 1350, 42, 2000)]
    ],
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp"><w:body><w:drawing><wp:inline><wp:extent cx="5486400" cy="3086100"/><a:blip r:embed="rIdDecode"/></wp:inline></w:drawing><w:drawing><wp:inline><wp:extent cx="5486400" cy="3086100"/><a:blip r:embed="rIdEncode"/></wp:inline></w:drawing><w:drawing><wp:inline><wp:extent cx="5486400" cy="3086100"/><a:blip r:embed="rIdGood"/></wp:inline></w:drawing></w:body></w:document>',
    relationships: [
      ['rIdDecode', 'media/decode-failure.png'],
      ['rIdEncode', 'media/encode-failure.png'],
      ['rIdGood', 'media/good.png']
    ]
  });
  const analysis = await analyseWordDocument(source, { fileName: 'asset-failures.docx', preset: 'documentation' });
  const replacement = createPng(1080, 608, 43);
  const result = await optimiseWordDocument(analysis, {
    encodeRasterAsset: async asset => {
      if (asset.originalName === 'decode-failure.png') {
        throw new Error('The browser decoder rejected this image.');
      }
      if (asset.originalName === 'encode-failure.png') {
        return { bytes: replacement, width: 999, height: 1 };
      }
      return { bytes: replacement, width: 1080, height: 608 };
    }
  });

  assert.equal(result.replacements.size, 1);
  assert.equal(result.summary.changedCount, 1);
  assert.equal(result.summary.processingFailureCount, 2);
  assert.equal(result.summary.preservedCount >= 2, true);
  assert.equal(result.processed.find(item => item.originalName === 'decode-failure.png').processingFailure, true);
  assert.equal(result.processed.find(item => item.originalName === 'encode-failure.png').processingFailure, true);
  assert.match(result.processed.find(item => item.originalName === 'decode-failure.png').reason, /original bytes were preserved/i);
  assert.equal(result.validation.valid, true);
});

test('does not swallow package-level validation failures during optimisation', async () => {
  const source = createDocxArchive({
    media: [['screen.png', createPng(2400, 1350, 44, 1000)]],
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body><a:blip r:embed="rId1"/></w:body></w:document>',
    relationships: [['rId1', 'media/screen.png']]
  });
  const analysis = await analyseWordDocument(source, { fileName: 'valid-before-corruption.docx', preset: 'documentation' });
  analysis.document.zipArchive.bytes[0] = 0;

  await assert.rejects(
    () => optimiseWordDocument(analysis),
    error => error instanceof WordImageExtractorError && ['invalid-docx', 'invalid-optimised-docx'].includes(error.code)
  );
});

test('retains the original when a smaller media replacement makes the rebuilt DOCX larger', async () => {
  const source = createDeflatedDocxArchive({
    media: [['screen.png', createPng(2400, 1350, 30, 4000)]],
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp"><w:body><w:drawing><wp:inline><wp:extent cx="5486400" cy="3086100"/><a:blip r:embed="rId1"/></wp:inline></w:drawing></w:body></w:document>',
    relationships: [['rId1', 'media/screen.png']]
  });
  const inflateRaw = bytes => new Uint8Array(inflateRawSync(bytes));
  const analysis = await analyseWordDocument(source, {
    fileName: 'deflated-source.docx',
    preset: 'documentation',
    inflateRaw
  });
  const replacement = createPng(1080, 608, 31, 100);
  const result = await optimiseWordDocument(analysis, {
    inflateRaw,
    encodeRasterAsset: async () => ({
      bytes: replacement,
      width: 1080,
      height: 608
    })
  });

  assert.equal(result.attemptedReplacements.size, 1);
  assert.equal(result.rebuiltBytes.byteLength > source.byteLength, true);
  assert.equal(result.replacements.size, 0);
  assert.equal(result.summary.noBeneficialOptimisation, true);
  assert.equal(result.summary.finalPackageWasSmaller, false);
  assert.equal(result.summary.savingBytes, 0);
  assert.equal(result.summary.savingPercent, 0);
  assert.deepEqual(result.bytes, source);
  assert.equal(result.validation.valid, true);
});

test('validates package relationships, required parts and safety limits before success', async () => {
  const archive = createDocxArchive({
    media: [['screen.png', createPng(100, 50, 8)]],
    relationships: [['rId1', 'media/screen.png']],
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body><a:blip r:embed="rId1"/></w:body></w:document>'
  });
  const result = await validateWordPackage(archive, { fileName: 'valid.docx' });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);

  const missingTarget = createDocxArchive({
    relationships: [['rId1', 'media/missing.png']],
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body><a:blip r:embed="rId1"/></w:body></w:document>'
  });
  const missingResult = await validateWordPackage(missingTarget, { fileName: 'missing.docx' });
  assert.equal(missingResult.valid, false);
  assert.match(missingResult.errors.join(' '), /missing target|referenced embedded media/i);

  const missingRelationship = createDocxArchive({
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body><a:blip r:embed="rIdMissing"/></w:body></w:document>'
  });
  const missingRelationshipResult = await validateWordPackage(missingRelationship, { fileName: 'missing-relationship.docx' });
  assert.equal(missingRelationshipResult.valid, false);
  assert.match(missingRelationshipResult.errors.join(' '), /missing image relationship/i);

  await assert.rejects(
    () => readWordImageDocument(archive, { fileName: 'limited.docx', maxImageBytes: 1 }),
    error => error instanceof WordImageExtractorError && error.code === 'image-size-limit'
  );
  await assert.rejects(
    () => validateOptimisedWordPackage(missingTarget, { fileName: 'missing.docx' }),
    error => error instanceof WordImageExtractorError && error.code === 'invalid-optimised-docx'
  );
});

test('summary clearly distinguishes estimates from actual output', async () => {
  const document = {
    zipArchive: { bytes: new Uint8Array(1000) },
    embeddedAssets: []
  };
  const plan = [{
    id: 'image-1',
    packagePath: 'word/media/image.png',
    originalBytes: 800,
    estimatedBytes: 400,
    status: WORD_OPTIMISER_STATUS.OPTIMISE,
    format: 'png'
  }];
  const estimated = buildWordOptimisationSummary({ document, plan, preset: 'documentation' });
  assert.equal(estimated.estimatedOptimisedBytes, 600);
  assert.equal(estimated.optimisedBytes, null);
  assert.equal(estimated.estimatedSavingPercent, 40);
});

test('uses compressed ZIP media bytes for archive contribution metrics and labels raw bytes separately', () => {
  const document = {
    zipArchive: {
      bytes: new Uint8Array(1000),
      entries: [{ name: 'word/media/image.png', compressedSize: 1200, isDirectory: false }]
    },
    embeddedAssets: []
  };
  const plan = [{
    id: 'image-1',
    packagePath: 'word/media/image.png',
    originalBytes: 800,
    originalArchiveBytes: 1200,
    estimatedBytes: 400,
    estimatedArchiveBytes: 500,
    status: WORD_OPTIMISER_STATUS.OPTIMISE,
    format: 'png'
  }];
  const summary = buildWordOptimisationSummary({ document, plan, preset: 'documentation' });

  assert.equal(summary.originalImageBytes, 1200);
  assert.equal(summary.originalRawImageBytes, 800);
  assert.equal(summary.imageSharePercent, 100);
  assert.equal(summary.estimatedImageBytes, 500);
  assert.equal(summary.estimatedRawImageBytes, 400);
  assert.equal(summary.estimatedOptimisedBytes, 500);
});

function createDocxArchive({ documentXml, relationships = [], media = [], extra = [] } = {}) {
  const files = [
    {
      name: '[Content_Types].xml',
      bytes: encoder.encode('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    },
    {
      name: 'word/document.xml',
      bytes: encoder.encode(documentXml || '<w:document xmlns:w="w"><w:body/></w:document>')
    }
  ];

  if (relationships.length) {
    const relationshipXml = relationships.map(([id, target, targetMode]) => (
      `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"${targetMode ? ` TargetMode="${targetMode}"` : ''}/>`
    )).join('');
    files.push({
      name: 'word/_rels/document.xml.rels',
      bytes: encoder.encode(`<Relationships>${relationshipXml}</Relationships>`)
    });
  }

  media.forEach(([name, bytes]) => files.push({ name: `word/media/${name}`, bytes }));
  extra.forEach(([name, bytes]) => files.push({ name, bytes }));
  return createStoredZipArchive(files);
}

function createDeflatedDocxArchive({ documentXml, relationships = [], media = [], extra = [] } = {}) {
  const files = [
    {
      name: '[Content_Types].xml',
      bytes: encoder.encode('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    },
    {
      name: 'word/document.xml',
      bytes: encoder.encode(documentXml || '<w:document xmlns:w="w"><w:body/></w:document>')
    }
  ];

  if (relationships.length) {
    const relationshipXml = relationships.map(([id, target, targetMode]) => (
      `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"${targetMode ? ` TargetMode="${targetMode}"` : ''}/>`
    )).join('');
    files.push({
      name: 'word/_rels/document.xml.rels',
      bytes: encoder.encode(`<Relationships>${relationshipXml}</Relationships>`)
    });
  }

  media.forEach(([name, bytes]) => files.push({ name: `word/media/${name}`, bytes }));
  extra.forEach(([name, bytes]) => files.push({ name, bytes }));

  const localRecords = [];
  const centralRecords = [];
  let offset = 0;

  files.forEach(file => {
    const nameBytes = encoder.encode(file.name);
    const sourceBytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
    const compressedBytes = new Uint8Array(deflateRawSync(sourceBytes));
    const local = new Uint8Array(30 + nameBytes.byteLength + compressedBytes.byteLength);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 8, true);
    localView.setUint32(14, calculateCrc32(sourceBytes), true);
    localView.setUint32(18, compressedBytes.byteLength, true);
    localView.setUint32(22, sourceBytes.byteLength, true);
    localView.setUint16(26, nameBytes.byteLength, true);
    local.set(nameBytes, 30);
    local.set(compressedBytes, 30 + nameBytes.byteLength);
    localRecords.push(local);

    const central = new Uint8Array(46 + nameBytes.byteLength);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 8, true);
    centralView.setUint32(16, calculateCrc32(sourceBytes), true);
    centralView.setUint32(20, compressedBytes.byteLength, true);
    centralView.setUint32(24, sourceBytes.byteLength, true);
    centralView.setUint16(28, nameBytes.byteLength, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralRecords.push(central);
    offset += local.byteLength;
  });

  const localData = concatenateTestBytes(localRecords);
  const centralData = concatenateTestBytes(centralRecords);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralData.byteLength, true);
  endView.setUint32(16, localData.byteLength, true);

  return concatenateTestBytes([localData, centralData, end]);
}

function concatenateTestBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach(chunk => {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return output;
}

function createPng(width, height, marker = 1, extraBytes = 0) {
  const bytes = new Uint8Array(24 + extraBytes);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  bytes[8] = marker;
  return bytes;
}

function createGif(width, height) {
  const bytes = new Uint8Array(10);
  bytes.set([...encoder.encode('GIF89a')], 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return bytes;
}
