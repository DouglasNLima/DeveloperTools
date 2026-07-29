import assert from 'node:assert/strict';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import test from 'node:test';

import {
  buildUpdatedFlowPackage,
  compareSolutionVersions,
  incrementSolutionRevision,
  inspectFlowPackage,
  isValidSolutionVersion,
  updateSolutionVersionXml,
  validateFlowReplacement
} from '../../src/tools/power-platform-flow-package.js';
import {
  calculateCrc32,
  readZipArchive,
  replaceZipArchiveEntries
} from '../../src/tools/power-platform-solution.js';

test('inspects and sorts cloud flow JSON files from an exported solution', async () => {
  const archive = await inspectFlowPackage(createSolutionArchive(), {
    inflateRaw: bytes => inflateRawSync(bytes)
  });

  assert.equal(archive.solution.name, 'Operations Toolkit');
  assert.equal(archive.solution.version, '1.2.3.4');
  assert.equal(archive.solution.packageType, 'Unmanaged');
  assert.equal(archive.readOnly, false);
  assert.equal(archive.suggestedVersion, '1.2.3.5');
  assert.deepEqual(archive.flows.map(flow => flow.name), [
    'Account approval',
    'Child notifier'
  ]);
  assert.equal(archive.flows[0].metrics.triggerCount, 1);
  assert.equal(archive.flows[0].metrics.actionCount, 1);
  assert.equal(archive.packagingErrors.length, 0);
});

test('validates complete flow JSON, identity, definitions and structural changes', async () => {
  const archive = await inspectFlowPackage(createSolutionArchive(), {
    inflateRaw: bytes => inflateRawSync(bytes)
  });
  const flow = archive.flows[0];
  const updated = structuredClone(flow.originalJson);
  updated.properties.definition.actions.Compose_update = {
    type: 'Compose'
  };

  const valid = validateFlowReplacement(flow, JSON.stringify(updated, null, 2));

  assert.equal(valid.valid, true);
  assert.equal(valid.diff.summary.added, 1);
  assert.equal(valid.originalMetrics.actionCount, 1);
  assert.equal(valid.updatedMetrics.actionCount, 2);
  assert.match(valid.diagram.mermaid, /Compose update/);

  const renamed = structuredClone(updated);
  renamed.properties.displayName = 'Renamed flow';
  assert.match(
    validateFlowReplacement(flow, JSON.stringify(renamed)).errors.join('\n'),
    /properties\.displayName must remain unchanged/
  );

  const changedId = structuredClone(updated);
  changedId.properties.workflowEntityId = '99999999-9999-9999-9999-999999999999';
  assert.match(
    validateFlowReplacement(flow, JSON.stringify(changedId)).errors.join('\n'),
    /workflowEntityId must remain unchanged/
  );

  const missingDefinition = structuredClone(flow.originalJson);
  delete missingDefinition.properties.definition;
  assert.match(
    validateFlowReplacement(flow, JSON.stringify(missingDefinition)).errors.join('\n'),
    /recognised cloud flow definition/
  );

  assert.match(
    validateFlowReplacement(flow, flow.originalText).errors.join('\n'),
    /no structural changes/
  );

  const metadataChange = structuredClone(updated);
  metadataChange.properties.state = 'Stopped';
  assert.match(
    validateFlowReplacement(flow, JSON.stringify(metadataChange)).warnings.join('\n'),
    /outside the flow definition/
  );
});

test('increments and compares four-part solution versions', () => {
  assert.equal(incrementSolutionRevision('1.2.3.4'), '1.2.3.5');
  assert.equal(compareSolutionVersions('1.2.3.4', '1.2.4.0'), -1);
  assert.equal(compareSolutionVersions('2.0.0.0', '1.99.99.99'), 1);
  assert.equal(compareSolutionVersions('1.2.3.4', '1.2.3.4'), 0);
  assert.equal(isValidSolutionVersion('1.2.3.4'), true);
  assert.equal(isValidSolutionVersion('1.2.3'), false);
  assert.throws(() => incrementSolutionRevision('invalid'), /major\.minor\.build\.revision/);

  const xml = '\ufeff<ImportExportXml>\r\n  <SolutionManifest>\r\n    <Version>1.2.3.4</Version>\r\n  </SolutionManifest>\r\n</ImportExportXml>';
  const updated = updateSolutionVersionXml(xml, '1.2.3.5');
  assert.match(updated, /^\ufeff/);
  assert.match(updated, /\r\n    <Version>1\.2\.3\.5<\/Version>\r\n/);
});

test('rebuilds a mixed-compression solution and preserves untouched entry records', async () => {
  const input = createSolutionArchive();
  const options = {
    inflateRaw: bytes => inflateRawSync(bytes)
  };
  const archive = await inspectFlowPackage(input, options);
  const firstUpdate = structuredClone(archive.flows[0].originalJson);
  const secondUpdate = structuredClone(archive.flows[1].originalJson);
  firstUpdate.properties.definition.actions.Compose_update = { type: 'Compose' };
  secondUpdate.properties.definition.actions.Send_message = { type: 'OpenApiConnection' };

  const result = await buildUpdatedFlowPackage({
    archive,
    targetVersion: '1.2.3.5',
    replacements: [
      {
        path: archive.flows[0].path,
        updatedText: JSON.stringify(firstUpdate, null, 2)
      },
      {
        path: archive.flows[1].path,
        updatedText: JSON.stringify(secondUpdate, null, 2)
      }
    ]
  }, options);
  const outputZip = await readZipArchive(result.bytes, options);

  assert.equal(result.fileName, 'ops_toolkit_1_2_3_5.zip');
  assert.equal(result.verification.valid, true);
  assert.equal(result.summary.replacementCount, 2);
  assert.match(await outputZip.readText('solution.xml'), /<Version>1\.2\.3\.5<\/Version>/);
  assert.deepEqual(
    JSON.parse(await outputZip.readText(archive.flows[0].path)),
    firstUpdate
  );
  assert.deepEqual(
    JSON.parse(await outputZip.readText(archive.flows[1].path)),
    secondUpdate
  );

  const originalAsset = archive.zipArchive.entries.find(entry => entry.name === 'WebResources/contoso_/asset.bin');
  const outputAsset = outputZip.entries.find(entry => entry.name === 'WebResources/contoso_/asset.bin');
  assert.deepEqual(outputAsset.localRecord, originalAsset.localRecord);

  for (const path of ['solution.xml', archive.flows[0].path, archive.flows[1].path]) {
    const entry = outputZip.entries.find(candidate => candidate.name === path);
    const bytes = await outputZip.readBytes(path);
    assert.equal(entry.compressionMethod, 0);
    assert.equal(entry.crc32, calculateCrc32(bytes));
  }
});

test('keeps managed solutions read only and requires a higher target version', async () => {
  const options = {
    inflateRaw: bytes => inflateRawSync(bytes)
  };
  const managed = await inspectFlowPackage(createSolutionArchive({ managed: true }), options);
  const update = structuredClone(managed.flows[0].originalJson);
  update.properties.definition.actions.Compose_update = { type: 'Compose' };

  assert.equal(managed.readOnly, true);
  assert.match(managed.readOnlyReason, /Managed solutions/);
  await assert.rejects(
    () => buildUpdatedFlowPackage({
      archive: managed,
      targetVersion: '1.2.3.5',
      replacements: [{
        path: managed.flows[0].path,
        updatedText: JSON.stringify(update)
      }]
    }, options),
    /Only unmanaged solutions/
  );

  const unmanaged = await inspectFlowPackage(createSolutionArchive(), options);
  await assert.rejects(
    () => buildUpdatedFlowPackage({
      archive: unmanaged,
      targetVersion: '1.2.3.4',
      replacements: [{
        path: unmanaged.flows[0].path,
        updatedText: JSON.stringify(update)
      }]
    }, options),
    /must be higher/
  );
});

test('rejects multi-disk, encrypted, duplicate and ZIP64 edit targets', async () => {
  const options = {
    inflateRaw: bytes => inflateRawSync(bytes)
  };
  const multiDiskBytes = createSolutionArchive();
  const multiDiskEocd = multiDiskBytes.byteLength - 22;
  new DataView(multiDiskBytes.buffer, multiDiskBytes.byteOffset, multiDiskBytes.byteLength)
    .setUint16(multiDiskEocd + 4, 1, true);
  const multiDisk = await inspectFlowPackage(multiDiskBytes, options);
  assert.match(multiDisk.packagingErrors.join('\n'), /Multi-disk/);

  const encryptedBytes = createZipArchive([
    entry('solution.xml', solutionXml()),
    entry('Workflows/encrypted.json', JSON.stringify(flowJson('Encrypted', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')), {
      flags: 0x0801
    })
  ]);
  const encryptedZip = await readZipArchive(encryptedBytes, options);
  assert.throws(
    () => replaceZipArchiveEntries(encryptedZip, new Map([
      ['Workflows/encrypted.json', new TextEncoder().encode('{}')]
    ])),
    /encrypted/
  );

  const duplicate = await inspectFlowPackage(createZipArchive([
    entry('solution.xml', solutionXml()),
    entry('Workflows/duplicate.json', JSON.stringify(flowJson('Duplicate', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'))),
    entry('Workflows/duplicate.json', JSON.stringify(flowJson('Duplicate', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')))
  ]), options);
  assert.match(duplicate.packagingErrors.join('\n'), /appears more than once/);

  const zip64Bytes = createSolutionArchive();
  const zip64Eocd = zip64Bytes.byteLength - 22;
  new DataView(zip64Bytes.buffer, zip64Bytes.byteOffset, zip64Bytes.byteLength)
    .setUint16(zip64Eocd + 10, 0xffff, true);
  await assert.rejects(
    () => readZipArchive(zip64Bytes, options),
    /ZIP64/
  );
});

function createSolutionArchive(options = {}) {
  const managed = options.managed ? '1' : '0';

  return createZipArchive([
    entry('solution.xml', solutionXml(managed), { method: 8 }),
    entry('customizations.xml', [
      '<ImportExportXml>',
      '  <Workflows>',
      '    <Workflow WorkflowId="{11111111-1111-1111-1111-111111111111}" Name="Account approval" Category="5" />',
      '    <Workflow WorkflowId="{22222222-2222-2222-2222-222222222222}" Name="Child notifier" Category="5" />',
      '  </Workflows>',
      '</ImportExportXml>'
    ].join('\n')),
    entry(
      'Workflows/22222222-2222-2222-2222-222222222222.json',
      JSON.stringify(flowJson('Child notifier', '22222222-2222-2222-2222-222222222222'), null, 2)
    ),
    entry(
      'Workflows/11111111-1111-1111-1111-111111111111.json',
      JSON.stringify(flowJson('Account approval', '11111111-1111-1111-1111-111111111111'), null, 2),
      { method: 8 }
    ),
    entry('WebResources/contoso_/asset.bin', new Uint8Array([0, 1, 2, 3, 254, 255]), { method: 8 })
  ]);
}

function solutionXml(managed = '0') {
  return [
    '<ImportExportXml>',
    '  <SolutionManifest>',
    '    <UniqueName>ops_toolkit</UniqueName>',
    '    <LocalizedNames>',
    '      <LocalizedName description="Operations Toolkit" languagecode="1033" />',
    '    </LocalizedNames>',
    '    <Version>1.2.3.4</Version>',
    `    <Managed>${managed}</Managed>`,
    '    <PublisherUniqueName>contoso</PublisherUniqueName>',
    '  </SolutionManifest>',
    '</ImportExportXml>'
  ].join('\n');
}

function flowJson(displayName, id) {
  return {
    properties: {
      displayName,
      workflowEntityId: id,
      definition: {
        triggers: {
          manual: {
            type: 'Request',
            description: 'Run the flow'
          }
        },
        actions: {
          Compose: {
            type: 'Compose'
          }
        }
      }
    }
  };
}

function entry(name, content, options = {}) {
  return {
    name,
    bytes: content instanceof Uint8Array ? content : new TextEncoder().encode(content),
    method: options.method || 0,
    flags: options.flags ?? 0x0800
  };
}

function createZipArchive(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach(item => {
    const nameBytes = Buffer.from(item.name, 'utf8');
    const data = Buffer.from(item.bytes);
    const compressed = item.method === 8 ? deflateRawSync(data) : data;
    const crc = calculateCrc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(item.flags, 6);
    localHeader.writeUInt16LE(item.method, 8);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localParts.push(localHeader, nameBytes, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(item.flags, 8);
    centralHeader.writeUInt16LE(item.method, 10);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + compressed.length;
  });

  const localData = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localData.length, 16);

  return new Uint8Array(Buffer.concat([localData, centralDirectory, eocd]));
}
