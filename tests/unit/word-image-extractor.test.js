import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStoredZipArchive,
  readZipArchive
} from '../../src/tools/power-platform-solution.js';
import {
  ENCRYPTED_OFFICE_MESSAGE,
  LEGACY_DOC_MESSAGE,
  UNSUPPORTED_WORD_MESSAGE,
  WordImageExtractorError,
  buildWordImageFileNames,
  buildWordImageManifestCsv,
  buildWordImageManifestJson,
  buildWordImageZip,
  calculateDeterministicImageHash,
  calculateDeterministicImageHashAsync,
  detectImageFormat,
  detectWordInputType,
  filterWordImageAssets,
  markDuplicateAssets,
  readWordImageDocument,
  resolveWordImageFileNameCollisions,
  sanitiseExtractionFileName,
  selectWordImageAssets
} from '../../src/tools/word-image-extractor.js';

const encoder = new TextEncoder();

test('inspects PNG, JPEG and unsupported-preview assets across body, header and footer relationships', async () => {
  const png = createPng(320, 180, 11);
  const jpeg = Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AT//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AT//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8Qf//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8Qf//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8Qf//Z', 'base64'));
  const emf = createEmf(640, 480);
  const archive = createDocxArchive({
    media: [
      ['image1.png', png],
      ['image2.png', png],
      ['image3.jpg', jpeg],
      ['diagram.emf', emf]
    ],
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp"><w:body><w:p><w:r><w:drawing><wp:inline><wp:docPr descr="Body alt" title="Body title"/><a:blip r:embed="rIdBody"/></wp:inline></w:drawing></w:r></w:p><w:p><w:drawing><a:blip r:link="rIdExternal"/></w:drawing></w:p></w:body></w:document>',
    documentRelationships: [
      ['rIdBody', 'media/image1.png'],
      ['rIdExternal', 'https://example.test/linked.png', 'External']
    ],
    headerXml: '<w:hdr xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp"><w:drawing><wp:inline><wp:docPr descr="Header alt"/><a:blip r:embed="rIdHeader"/></wp:inline></w:drawing></w:hdr>',
    headerRelationships: [['rIdHeader', 'media/image2.png']],
    footerXml: '<w:ftr xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp"><w:drawing><wp:inline><wp:docPr title="Footer title"/><a:blip r:embed="rIdFooter"/></wp:inline></w:drawing></w:ftr>',
    footerRelationships: [['rIdFooter', 'media/image3.jpg']]
  });

  const result = await readWordImageDocument(archive, { fileName: 'Quarterly report.docx' });

  assert.equal(result.documentName, 'Quarterly report');
  assert.equal(result.summary.embeddedCount, 4);
  assert.equal(result.summary.externalCount, 1);
  assert.equal(result.summary.duplicateAssetCount, 2);
  assert.equal(result.summary.duplicateGroupCount, 1);

  const pngAssets = result.embeddedAssets.filter(asset => asset.format === 'png');
  assert.equal(pngAssets.length, 2);
  assert.deepEqual(pngAssets.map(asset => asset.source), ['body', 'header']);
  assert.deepEqual(pngAssets.map(asset => [asset.width, asset.height]), [[320, 180], [320, 180]]);
  assert.equal(pngAssets[0].altText, 'Body alt');
  assert.equal(pngAssets[0].title, 'Body title');
  assert.equal(pngAssets[0].fileSize, png.byteLength);
  assert.equal(pngAssets[0].hash, pngAssets[1].hash);
  assert.equal(pngAssets[0].isDuplicate, true);
  assert.equal(pngAssets[1].duplicateOf, pngAssets[0].id);

  const jpegAsset = result.embeddedAssets.find(asset => asset.format === 'jpeg');
  assert.equal(jpegAsset.source, 'footer');
  assert.deepEqual([jpegAsset.width, jpegAsset.height], [1, 1]);
  assert.equal(jpegAsset.title, 'Footer title');

  const emfAsset = result.embeddedAssets.find(asset => asset.format === 'emf');
  assert.equal(emfAsset.previewSupported, false);
  assert.deepEqual([emfAsset.width, emfAsset.height], [640, 480]);

  const external = result.externalAssets[0];
  assert.equal(external.externalTarget, 'https://example.test/linked.png');
  assert.equal(external.isEmbedded, false);
  assert.equal(external.source, 'body');
  assert.equal(external.bytes, null);
  assert.equal(filterWordImageAssets(result.assets, { source: 'external' }).length, 1);
  assert.ok(result.warnings.every(warning => !/fetch|retriev/i.test(warning)));
});

test('filters dimensions, file size, format, orientation, source and duplicate status', async () => {
  const result = await readWordImageDocument(createDocxArchive({
    media: [
      ['landscape.png', createPng(800, 400, 1)],
      ['portrait.png', createPng(200, 600, 2)],
      ['square.png', createPng(100, 100, 3)]
    ],
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body><a:blip r:embed="rId1"/><a:blip r:embed="rId2"/><a:blip r:embed="rId3"/></w:body></w:document>',
    documentRelationships: [
      ['rId1', 'media/landscape.png'],
      ['rId2', 'media/portrait.png'],
      ['rId3', 'media/square.png']
    ]
  }), { fileName: 'filters.docx' });

  assert.equal(filterWordImageAssets(result.assets, { minWidth: 500 }).length, 1);
  assert.equal(filterWordImageAssets(result.assets, { maxHeight: 400 }).length, 2);
  assert.equal(filterWordImageAssets(result.assets, { minFileSize: 24, maxFileSize: 24 }).length, 3);
  assert.equal(filterWordImageAssets(result.assets, { format: 'png', orientation: 'landscape' }).length, 1);
  assert.equal(filterWordImageAssets(result.assets, { source: 'body' }).length, 3);
  assert.equal(filterWordImageAssets(result.assets, { duplicateStatus: 'unique' }).length, 3);
  assert.equal(filterWordImageAssets(result.assets, { source: 'header' }).length, 0);
});

test('selects all or one copy of exact duplicate image bytes', () => {
  const bytes = createPng(20, 10, 5);
  const assets = [
    { id: 'a', isEmbedded: true, bytes, hash: calculateDeterministicImageHash(bytes) },
    { id: 'b', isEmbedded: true, bytes: new Uint8Array(bytes), hash: calculateDeterministicImageHash(bytes) },
    { id: 'c', isEmbedded: false, bytes: null }
  ];

  assert.deepEqual(selectWordImageAssets(assets, { selectedIds: ['a', 'b', 'c'], mode: 'all' }).map(asset => asset.id), ['a', 'b']);
  assert.deepEqual(selectWordImageAssets(assets, { selectedIds: ['a', 'b'], mode: 'unique' }).map(asset => asset.id), ['a']);
});

test('builds deterministic names, sanitises paths and resolves case-insensitive collisions', () => {
  const assets = [
    { originalName: '../same.png', extension: 'png' },
    { originalName: 'same.png', extension: 'png' },
    { originalName: 'CON', extension: 'emf' }
  ];

  assert.equal(sanitiseExtractionFileName('../same.png'), 'same.png');
  assert.equal(sanitiseExtractionFileName('CON'), '_CON');
  assert.deepEqual(buildWordImageFileNames(assets, { strategy: 'original', documentName: 'Quarterly report' }), [
    'same.png',
    'same (2).png',
    '_CON.emf'
  ]);
  assert.deepEqual(buildWordImageFileNames(assets, { strategy: 'sequential', documentName: 'Quarterly report' }), [
    'image-001.png',
    'image-002.png',
    'image-003.emf'
  ]);
  assert.deepEqual(buildWordImageFileNames(assets, { strategy: 'document-prefix', documentName: 'Quarterly report.docx' }), [
    'Quarterly report-same.png',
    'Quarterly report-same (2).png',
    'Quarterly report-_CON.emf'
  ]);
});

test('resolves directory names around existing files and generated manifest collisions', () => {
  assert.deepEqual(resolveWordImageFileNameCollisions(
    ['image.png', 'image.png', 'manifest.json'],
    ['image.png', 'image (2).png', 'manifest.json', 'manifest (2).json']
  ), [
    'image (3).png',
    'image (4).png',
    'manifest (3).json'
  ]);
});

test('creates a stored ZIP with unchanged image bytes and optional CSV/JSON manifests', async () => {
  const first = createPng(10, 10, 7);
  const second = createPng(12, 8, 8);
  const assets = [
    { id: 'one', originalName: 'one.png', extension: 'png', format: 'png', formatLabel: 'PNG', mimeType: 'image/png', bytes: first, isEmbedded: true, width: 10, height: 10, orientation: 'square', fileSize: first.byteLength, source: 'body', sourceLabel: 'body', hash: calculateDeterministicImageHash(first), duplicateStatus: 'unique', isDuplicate: false },
    { id: 'two', originalName: 'two.png', extension: 'png', format: 'png', formatLabel: 'PNG', mimeType: 'image/png', bytes: second, isEmbedded: true, width: 12, height: 8, orientation: 'landscape', fileSize: second.byteLength, source: 'header', sourceLabel: 'header', hash: calculateDeterministicImageHash(second), duplicateStatus: 'unique', isDuplicate: false }
  ];
  const namedAssets = assets.map((asset, index) => ({ ...asset, outputName: `export-${index + 1}.png` }));
  const zipBytes = buildWordImageZip(assets, { namedAssets, includeManifest: true, manifestFormat: 'json' });
  const zip = await readZipArchive(zipBytes);

  assert.deepEqual([...zip.entries].map(entry => entry.name), ['export-1.png', 'export-2.png', 'manifest.json']);
  assert.deepEqual(await zip.readBytes('export-1.png'), first);
  assert.deepEqual(await zip.readBytes('export-2.png'), second);
  assert.match(new TextDecoder().decode(await zip.readBytes('manifest.json')), /"originalName": "one\.png"/);
  assert.match(buildWordImageManifestCsv(namedAssets, { namedAssets }), /outputName,originalName/);
  assert.match(buildWordImageManifestCsv(namedAssets, { namedAssets }), /export-1\.png,one\.png/);
  assert.match(buildWordImageManifestJson(namedAssets, { namedAssets }), /"format": "png"/);
});

test('detects linked, unsupported-preview and common invalid Office inputs', async () => {
  assert.equal(detectWordInputType(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'legacy.doc'), 'legacy-doc');
  assert.equal(detectWordInputType(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'encrypted.docx'), 'encrypted-office');
  assert.equal(detectImageFormat(createEmf(100, 90), 'diagram.emf').previewSupported, false);

  await assert.rejects(
    () => readWordImageDocument(new Uint8Array([1, 2, 3]), { fileName: 'legacy.doc' }),
    error => error instanceof WordImageExtractorError && error.code === 'legacy-doc' && error.message === LEGACY_DOC_MESSAGE
  );
  await assert.rejects(
    () => readWordImageDocument(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), { fileName: 'encrypted.docx' }),
    error => error instanceof WordImageExtractorError && error.code === 'encrypted-office' && error.message === ENCRYPTED_OFFICE_MESSAGE
  );
  await assert.rejects(
    () => readWordImageDocument(createStoredZipArchive([{ name: 'xl/workbook.xml', bytes: encoder.encode('<workbook/>') }]), { fileName: 'book.xlsx' }),
    error => error instanceof WordImageExtractorError && error.code === 'unsupported-input' && error.message === UNSUPPORTED_WORD_MESSAGE
  );
  await assert.rejects(
    () => readWordImageDocument(createStoredZipArchive([{ name: 'xl/workbook.xml', bytes: encoder.encode('<workbook/>') }]), { fileName: 'book.docx' }),
    error => error instanceof WordImageExtractorError && error.code === 'unsupported-docx' && error.message.includes('word/document.xml')
  );
  await assert.rejects(
    () => readWordImageDocument(new Uint8Array([1, 2, 3]), { fileName: 'broken.docx' }),
    error => error instanceof WordImageExtractorError && error.code === 'invalid-docx'
  );
});

test('bounds repeated local, external and malformed image references during collection', async () => {
  const repeatedLocalReferences = '<a:blip r:embed="rId1"/>'.repeat(4);
  const localArchive = createDocxArchive({
    documentXml: `<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body>${repeatedLocalReferences}</w:body></w:document>`,
    documentRelationships: [['rId1', 'media/image.png']],
    media: [['image.png', createPng(10, 10, 1)]]
  });
  const repeatedExternalReferences = '<a:blip r:link="rIdExternal"/>'.repeat(4);
  const externalArchive = createDocxArchive({
    documentXml: `<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body>${repeatedExternalReferences}</w:body></w:document>`,
    documentRelationships: [['rIdExternal', 'https://example.test/remote.png', 'External']]
  });

  for (const archive of [localArchive, externalArchive]) {
    await assert.rejects(
      () => readWordImageDocument(archive, { fileName: 'references.docx', maxImageReferences: 3 }),
      error => error instanceof WordImageExtractorError
        && error.code === 'image-reference-limit'
        && /more than 3 image references/.test(error.message)
    );
  }

  const warningArchive = createDocxArchive({
    documentXml: '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body><a:blip r:embed="missing1"/><a:blip r:embed="missing2"/><a:blip r:embed="missing3"/></w:body></w:document>'
  });
  const warningResult = await readWordImageDocument(warningArchive, {
    fileName: 'warnings.docx',
    maxImageReferences: 10,
    maxWarnings: 2
  });

  assert.equal(warningResult.warnings.length, 2);
  assert.match(warningResult.warnings[1], /Additional validation warnings were omitted/);
});

test('uses native asynchronous hashing for inspection and never treats hash collisions as exact duplicates', async () => {
  const bytes = createPng(10, 10, 4);
  const hash = await calculateDeterministicImageHashAsync(bytes);
  assert.match(hash, /^(sha256|fnv1a-dual):/);
  assert.equal(hash, await calculateDeterministicImageHashAsync(new Uint8Array(bytes)));

  const marked = markDuplicateAssets([
    { id: 'same-a', isEmbedded: true, bytes: Uint8Array.from([1, 2]), hash: 'forced-collision' },
    { id: 'different', isEmbedded: true, bytes: Uint8Array.from([1, 3]), hash: 'forced-collision' },
    { id: 'same-b', isEmbedded: true, bytes: Uint8Array.from([1, 2]), hash: 'forced-collision' }
  ]);

  assert.equal(marked.find(asset => asset.id === 'different').isDuplicate, false);
  assert.equal(marked.find(asset => asset.id === 'same-a').isDuplicate, true);
  assert.equal(marked.find(asset => asset.id === 'same-b').duplicateOf, 'same-a');
  assert.notEqual(marked.find(asset => asset.id === 'same-a').duplicateGroup, marked.find(asset => asset.id === 'different').duplicateGroup);
});

test('reports DOCX packages with no image parts and refuses unsafe package expansion', async () => {
  const result = await readWordImageDocument(createDocxArchive({
    documentXml: '<w:document xmlns:w="w"><w:body><w:p><w:r><w:t>No pictures</w:t></w:r></w:p></w:body></w:document>'
  }), { fileName: 'empty.docx' });

  assert.equal(result.assets.length, 0);
  assert.match(result.warnings.join(' '), /No embedded or externally linked image assets/);

  await assert.rejects(
    () => readWordImageDocument(createDocxArchive({
      media: [['large.png', createPng(10, 10, 1)]]
    }), { fileName: 'large.docx', maxImageBytes: 1 }),
    error => error instanceof WordImageExtractorError && error.code === 'image-size-limit'
  );
});

function createDocxArchive(options = {}) {
  const files = [
    {
      name: '[Content_Types].xml',
      bytes: encoder.encode('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    },
    { name: 'word/document.xml', bytes: encoder.encode(options.documentXml || '<w:document xmlns:w="w"><w:body/></w:document>') },
    ...buildRelationshipFiles('word/document.xml', options.documentRelationships)
  ];

  if (options.headerXml) {
    files.push({ name: 'word/header1.xml', bytes: encoder.encode(options.headerXml) });
    files.push(...buildRelationshipFiles('word/header1.xml', options.headerRelationships));
  }

  if (options.footerXml) {
    files.push({ name: 'word/footer1.xml', bytes: encoder.encode(options.footerXml) });
    files.push(...buildRelationshipFiles('word/footer1.xml', options.footerRelationships));
  }

  (options.media || []).forEach(([name, bytes]) => files.push({ name: `word/media/${name}`, bytes }));
  return createStoredZipArchive(files);
}

function buildRelationshipFiles(partPath, relationships = []) {
  if (!relationships?.length) return [];
  const relationshipPath = partPath.replace(/([^/]+)$/, '_rels/$1.rels');
  const body = relationships.map(([id, target, targetMode]) => (
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"${targetMode ? ` TargetMode="${targetMode}"` : ''}/>`
  )).join('');
  return [{ name: relationshipPath, bytes: encoder.encode(`<Relationships>${body}</Relationships>`) }];
}

function createPng(width, height, marker) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  bytes[8] = marker;
  return bytes;
}

function createEmf(width, height) {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  view.setInt32(8, width, true);
  view.setInt32(12, height, true);
  view.setUint32(40, 0x464d4520, true);
  return bytes;
}
