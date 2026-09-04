import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
