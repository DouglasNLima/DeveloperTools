import assert from 'node:assert/strict';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import test from 'node:test';

import {
  buildClassicWorkflowDiagram,
  buildUpdatedClassicWorkflowPackage,
  inspectClassicWorkflowPackage,
  parseClassicWorkflowXaml,
  validateClassicWorkflowReplacement
} from '../../src/tools/power-platform-classic-workflow-package.js';
import {
  decodeTextBytes,
  encodeTextLikeOriginal
} from '../../src/tools/power-platform-package-editor.js';
import {
  calculateCrc32,
  readZipArchive
} from '../../src/tools/power-platform-solution.js';

const zipOptions = {
  inflateRaw: bytes => inflateRawSync(bytes)
};

test('detects, correlates and sorts Category 0 classic workflow XAML files', async () => {
  const archive = await inspectClassicWorkflowPackage(createClassicSolutionArchive(), zipOptions);

  assert.equal(archive.solution.name, 'Operations Toolkit');
  assert.equal(archive.solution.version, '1.2.3.4');
  assert.equal(archive.solution.packageType, 'Unmanaged');
  assert.equal(archive.readOnly, false);
  assert.equal(archive.suggestedVersion, '1.2.3.5');
  assert.deepEqual(archive.workflows.map(workflow => workflow.name), [
    'Account follow up',
    'Case escalation'
  ]);
  assert.deepEqual(archive.workflows.map(workflow => workflow.displayName), [
    'Account follow up',
    'Case escalation'
  ]);
  assert.equal(archive.workflows[0].triggers.onCreate, true);
  assert.deepEqual(archive.workflows[0].triggers.onUpdateAttributes, ['name', 'statuscode']);
  assert.equal(archive.workflows[0].metrics.stepCount, 4);
  assert.equal(archive.workflows[0].metrics.conditionCount, 1);
  assert.equal(archive.workflows[0].metrics.branchCount, 2);
  assert.equal(archive.workflows[0].metrics.customActivityCount, 1);
  assert.equal(archive.packagingErrors.length, 0);
  assert.match(archive.workflows[0].component.sourcePath, /Workflows\/AccountFollowUp\.xaml/);
});

test('removes GUID noise from classic workflow Mermaid labels', () => {
  const guid = '643ea8ee-9c35-4fd7-909c-facf7fb68428';
  const diagram = buildClassicWorkflowDiagram({
    name: `Account follow up-${guid}`,
    originalText: classicXaml('XrmWorkflowGuid', `${guid} - Create task`)
  });

  assert.match(diagram.mermaid, /Workflow: Account follow up/);
  assert.match(diagram.mermaid, /Create task/);
  assert.doesNotMatch(diagram.mermaid, new RegExp(guid, 'i'));
});

test('parses XAML, builds structural diffs and validates identity and safety rules', async () => {
  const archive = await inspectClassicWorkflowPackage(createClassicSolutionArchive(), zipOptions);
  const workflow = archive.workflows[0];
  const updated = workflow.originalText
    .replace('DisplayName="Create task"', 'DisplayName="Create follow-up task"')
    .replace(
      '</If.Then>',
      '<mxswa:UpdateEntity DisplayName="Update account" /></If.Then>'
    );
  const valid = validateClassicWorkflowReplacement(workflow, updated);

  assert.equal(valid.valid, true);
  assert.ok(valid.diff.summary.totalChanges >= 2);
  assert.ok(valid.diff.lineDiff.summary.totalChanges >= 1);
  assert.equal(valid.originalMetrics.stepCount, 4);
  assert.equal(valid.updatedMetrics.stepCount, 5);
  assert.match(valid.diagram.mermaid, /Create follow-up task/);
  assert.match(valid.diagram.mermaid, /Update account/);

  const reformatted = workflow.originalText
    .replace(/>\s+</g, '><')
    .replace('<Activity ', '<!-- ignored --><Activity ');
  assert.match(
    validateClassicWorkflowReplacement(workflow, reformatted).errors.join('\n'),
    /no structural changes/
  );

  const changedIdentity = updated.replace('XrmWorkflow111', 'XrmWorkflow999');
  assert.match(
    validateClassicWorkflowReplacement(workflow, changedIdentity).errors.join('\n'),
    /x:Class identity/
  );

  assert.match(
    validateClassicWorkflowReplacement(workflow, '<!DOCTYPE Activity><Activity />').errors.join('\n'),
    /DTD and entity declarations/
  );
  assert.match(
    validateClassicWorkflowReplacement(workflow, '<Workflow />').errors.join('\n'),
    /Activity root/
  );
  assert.match(
    validateClassicWorkflowReplacement(
      workflow,
      workflow.originalText.replace('Check account', 'Check & account')
    ).errors.join('\n'),
    /unescaped ampersand/
  );
  assert.throws(
    () => parseClassicWorkflowXaml(workflow.originalText.replace('<mxswa:Workflow>', '')),
    /Unexpected closing tag/
  );
});

test('preserves UTF-8 and UTF-16 text encodings and BOMs', async () => {
  const utf16LeOriginal = encodeTextLikeOriginal(
    classicXaml('XrmWorkflow222', 'Case start').replace('utf-8', 'utf-16'),
    new Uint8Array([0xff, 0xfe, 0x3c, 0x00])
  );
  const utf16BeOriginal = encodeTextLikeOriginal(
    classicXaml('XrmWorkflow333', 'Case finish').replace('utf-8', 'utf-16'),
    new Uint8Array([0xfe, 0xff, 0x00, 0x3c])
  );

  assert.deepEqual([...utf16LeOriginal.slice(0, 2)], [0xff, 0xfe]);
  assert.deepEqual([...utf16BeOriginal.slice(0, 2)], [0xfe, 0xff]);
  assert.match(decodeTextBytes(utf16LeOriginal), /Case start/);
  assert.match(decodeTextBytes(utf16BeOriginal), /Case finish/);

  const archive = await inspectClassicWorkflowPackage(createClassicSolutionArchive({
    secondXamlBytes: utf16LeOriginal
  }), zipOptions);
  assert.match(archive.workflows[1].originalText, /Case start/);
  assert.equal(archive.workflows[1].editable, true);
});

test('rebuilds multiple classic workflows and preserves untouched ZIP records', async () => {
  const archive = await inspectClassicWorkflowPackage(createClassicSolutionArchive(), zipOptions);
  const replacements = archive.workflows.map((workflow, index) => ({
    path: workflow.path,
    updatedText: workflow.originalText.replace(
      index === 0 ? 'Create task' : 'Case start',
      index === 0 ? 'Create reviewed task' : 'Case reviewed start'
    )
  }));
  const result = await buildUpdatedClassicWorkflowPackage({
    archive,
    replacements,
    targetVersion: '1.2.3.5',
    riskAcknowledged: true
  }, zipOptions);
  const outputZip = await readZipArchive(result.bytes, zipOptions);

  assert.equal(result.fileName, 'ops_toolkit_1_2_3_5.zip');
  assert.equal(result.verification.valid, true);
  assert.equal(result.summary.replacementCount, 2);
  assert.match(await outputZip.readText('solution.xml'), /<Version>1\.2\.3\.5<\/Version>/);
  assert.match(await outputZip.readText(archive.workflows[0].path), /Create reviewed task/);
  assert.match(await outputZip.readText(archive.workflows[1].path), /Case reviewed start/);

  for (const path of ['customizations.xml', 'WebResources/contoso_/asset.bin']) {
    const originalEntry = archive.zipArchive.entries.find(entry => entry.name === path);
    const outputEntry = outputZip.entries.find(entry => entry.name === path);
    assert.deepEqual(outputEntry.localRecord, originalEntry.localRecord);
  }

  for (const path of ['solution.xml', ...archive.workflows.map(workflow => workflow.path)]) {
    const outputEntry = outputZip.entries.find(entry => entry.name === path);
    const bytes = await outputZip.readBytes(path);
    assert.equal(outputEntry.compressionMethod, 0);
    assert.equal(outputEntry.crc32, calculateCrc32(bytes));
  }
});

test('keeps managed solutions read only and requires risk acknowledgement and a higher version', async () => {
  const managed = await inspectClassicWorkflowPackage(
    createClassicSolutionArchive({ managed: true }),
    zipOptions
  );
  const replacement = [{
    path: managed.workflows[0].path,
    updatedText: managed.workflows[0].originalText.replace('Create task', 'Create managed task')
  }];

  assert.equal(managed.readOnly, true);
  await assert.rejects(
    () => buildUpdatedClassicWorkflowPackage({
      archive: managed,
      replacements: replacement,
      targetVersion: '1.2.3.5',
      riskAcknowledged: true
    }, zipOptions),
    /Only unmanaged solutions/
  );

  const unmanaged = await inspectClassicWorkflowPackage(createClassicSolutionArchive(), zipOptions);
  await assert.rejects(
    () => buildUpdatedClassicWorkflowPackage({
      archive: unmanaged,
      replacements: replacement,
      targetVersion: '1.2.3.5'
    }, zipOptions),
    /Acknowledge/
  );
  await assert.rejects(
    () => buildUpdatedClassicWorkflowPackage({
      archive: unmanaged,
      replacements: replacement,
      targetVersion: '1.2.3.4',
      riskAcknowledged: true
    }, zipOptions),
    /must be higher/
  );
});

test('reports missing, orphan, shared, duplicate, encrypted, multi-disk and ZIP64 XAML targets', async () => {
  const missing = await inspectClassicWorkflowPackage(createClassicSolutionArchive({
    omitSecondXaml: true,
    orphanXaml: true
  }), zipOptions);
  assert.equal(missing.workflows[1].editable, false);
  assert.match(missing.workflows[1].warnings.join('\n'), /was not found/);
  assert.deepEqual(missing.orphanXamlFiles, ['Workflows/Orphan.xaml']);

  const shared = await inspectClassicWorkflowPackage(createClassicSolutionArchive({
    sharedXaml: true
  }), zipOptions);
  assert.match(shared.packagingErrors.join('\n'), /referenced by more than one/);

  const duplicate = await inspectClassicWorkflowPackage(createClassicSolutionArchive({
    duplicateFirstXaml: true
  }), zipOptions);
  assert.match(duplicate.packagingErrors.join('\n'), /appears more than once/);

  const encrypted = await inspectClassicWorkflowPackage(createClassicSolutionArchive({
    encryptedFirstXaml: true
  }), zipOptions);
  assert.match(encrypted.packagingErrors.join('\n'), /encrypted/);

  const multiDiskBytes = createClassicSolutionArchive();
  const multiDiskEocd = multiDiskBytes.byteLength - 22;
  new DataView(multiDiskBytes.buffer, multiDiskBytes.byteOffset, multiDiskBytes.byteLength)
    .setUint16(multiDiskEocd + 4, 1, true);
  const multiDisk = await inspectClassicWorkflowPackage(multiDiskBytes, zipOptions);
  assert.match(multiDisk.packagingErrors.join('\n'), /Multi-disk/);

  const zip64Bytes = createClassicSolutionArchive();
  const zip64Eocd = zip64Bytes.byteLength - 22;
  new DataView(zip64Bytes.buffer, zip64Bytes.byteOffset, zip64Bytes.byteLength)
    .setUint16(zip64Eocd + 10, 0xffff, true);
  await assert.rejects(
    () => inspectClassicWorkflowPackage(zip64Bytes, zipOptions),
    /ZIP64/
  );
});

function createClassicSolutionArchive(options = {}) {
  const managed = options.managed ? '1' : '0';
  const secondPath = options.sharedXaml ? '/Workflows/AccountFollowUp.xaml' : '/Workflows/CaseEscalation.xaml';
  const entries = [
    entry('solution.xml', solutionXml(managed), { method: 8 }),
    entry('customizations.xml', customizationsXml(secondPath)),
    entry('Workflows/AccountFollowUp.xaml', classicXaml('XrmWorkflow111', 'Check account'), {
      method: 8,
      flags: options.encryptedFirstXaml ? 0x0801 : 0x0800
    }),
    entry('WebResources/contoso_/asset.bin', new Uint8Array([0, 1, 2, 3, 254, 255]), { method: 8 })
  ];

  if (!options.omitSecondXaml && !options.sharedXaml) {
    entries.splice(3, 0, entry(
      'Workflows/CaseEscalation.xaml',
      options.secondXamlBytes || classicXaml('XrmWorkflow222', 'Case start')
    ));
  }

  if (options.duplicateFirstXaml) {
    entries.splice(3, 0, entry('Workflows/AccountFollowUp.xaml', classicXaml('XrmWorkflow111', 'Duplicate')));
  }

  if (options.orphanXaml) {
    entries.splice(-1, 0, entry('Workflows/Orphan.xaml', classicXaml('XrmWorkflow999', 'Orphan')));
  }

  return createZipArchive(entries);
}

function solutionXml(managed) {
  return [
    '<ImportExportXml>',
    '  <SolutionManifest>',
    '    <UniqueName>ops_toolkit</UniqueName>',
    '    <LocalizedNames><LocalizedName description="Operations Toolkit" languagecode="1033" /></LocalizedNames>',
    '    <Version>1.2.3.4</Version>',
    `    <Managed>${managed}</Managed>`,
    '    <PublisherUniqueName>contoso</PublisherUniqueName>',
    '  </SolutionManifest>',
    '</ImportExportXml>'
  ].join('\r\n');
}

function customizationsXml(secondPath) {
  return [
    '<ImportExportXml>',
    '  <Workflows>',
    '    <Workflow WorkflowId="{11111111-1111-1111-1111-111111111111}" Name="Account follow up" Category="0">',
    '      <XamlFileName>/Workflows/AccountFollowUp.xaml</XamlFileName>',
    '      <PrimaryEntity>account</PrimaryEntity><Mode>0</Mode><Scope>4</Scope>',
    '      <TriggerOnCreate>1</TriggerOnCreate><TriggerOnDelete>0</TriggerOnDelete>',
    '      <TriggerOnUpdateAttributeList>name,statuscode</TriggerOnUpdateAttributeList><OnDemand>1</OnDemand>',
    '      <StateCode>1</StateCode>',
    '    </Workflow>',
    '    <Workflow WorkflowId="{22222222-2222-2222-2222-222222222222}" Name="Case escalation" Category="0">',
    `      <XamlFileName>${secondPath}</XamlFileName>`,
    '      <PrimaryEntity>incident</PrimaryEntity><Mode>1</Mode><OnDemand>1</OnDemand>',
    '    </Workflow>',
    '    <Workflow WorkflowId="{33333333-3333-3333-3333-333333333333}" Name="Ignored action" Category="3">',
    '      <XamlFileName>/Workflows/IgnoredAction.xaml</XamlFileName>',
    '    </Workflow>',
    '  </Workflows>',
    '</ImportExportXml>'
  ].join('\n');
}

function classicXaml(xClass, firstStep) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<Activity x:Class="${xClass}" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"`,
    ' xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
    ' xmlns:mxswa="clr-namespace:Microsoft.Xrm.Sdk.Workflow.Activities;assembly=Microsoft.Xrm.Sdk.Workflow, Version=9.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35">',
    '  <mxswa:Workflow>',
    '    <Sequence DisplayName="Main sequence">',
    `      <mxswa:ActivityReference AssemblyQualifiedName="Microsoft.Crm.Workflow.Activities.EvaluateExpression, Microsoft.Crm.Workflow" DisplayName="${firstStep}" />`,
    '      <If DisplayName="Account is active">',
    '        <If.Then><mxswa:CreateEntity DisplayName="Create task" /></If.Then>',
    '        <If.Else><mxswa:ActivityReference AssemblyQualifiedName="Contoso.Workflow.Activities.Notify, Contoso.Workflow" DisplayName="Notify owner" /></If.Else>',
    '      </If>',
    '    </Sequence>',
    '  </mxswa:Workflow>',
    '</Activity>'
  ].join('\n');
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
