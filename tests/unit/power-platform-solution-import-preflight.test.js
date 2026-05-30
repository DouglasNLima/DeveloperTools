import assert from 'node:assert/strict';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import test from 'node:test';

import {
  buildSolutionImportCommand,
  buildSolutionImportPreflightFileName,
  parseMissingDependencies,
  parseRootComponents,
  processPowerPlatformSolutionImportPreflightArchive
} from '../../src/tools/power-platform-solution-import-preflight.js';

test('generates an import preflight report from an exported solution ZIP', async () => {
  const result = await processPowerPlatformSolutionImportPreflightArchive(createZipArchive([
    ['solution.xml', solutionXml({ managed: false })],
    ['customizations.xml', customizationsXml()],
    ['Workflows/11111111-1111-1111-1111-111111111111.json', JSON.stringify(cloudFlowJson(), null, 2)]
  ]), {
    path: 'dist/ops toolkit.zip',
    targetEnvironmentNote: 'Test environment before production',
    async: true,
    forceOverwrite: true
  });

  assert.equal(result.solution.name, 'Operations Toolkit');
  assert.equal(result.summary.rootComponentCount, 4);
  assert.equal(result.summary.processComponentCount, 1);
  assert.equal(result.summary.environmentVariableCount, 1);
  assert.equal(result.summary.connectionReferenceCount, 1);
  assert.equal(result.summary.missingDependencyCount, 1);
  assert.equal(result.command, 'pac solution import --path "dist/ops toolkit.zip" --async --force-overwrite');
  assert.match(result.documentationMarkdown, /^# Power Platform solution import preflight/);
  assert.match(result.documentationMarkdown, /Target environment note: Test environment before production/);
  assert.match(result.documentationMarkdown, /Exported missing dependencies/);
  assert.match(result.documentationMarkdown, /exported solution metadata only/);
  assert.match(result.documentationMarkdown, /Account custom table/);
  assert.match(result.documentationMarkdown, /Current and default included/);
  assert.doesNotMatch(result.documentationMarkdown, /https:\/\/api\.example\.test\/current/);
  assert.match(result.warnings.join('\n'), /Unmanaged solution imports/);
  assert.match(result.warnings.join('\n'), /Force overwrite/);
  assert.equal(buildSolutionImportPreflightFileName(result.solution.name), 'Operations-Toolkit-import-preflight.md');
});

test('parses root components and missing dependencies from solution metadata', () => {
  const components = parseRootComponents(solutionXml({ managed: true }));
  const dependencies = parseMissingDependencies({ solutionXml: solutionXml({ managed: true }) });

  assert.equal(components.length, 4);
  assert.deepEqual(
    components.map(component => [component.typeLabel, component.name]).sort(),
    [
      ['Connection reference', 'contoso_dataverse'],
      ['Environment variable definition', 'contoso_api_url'],
      ['Process', 'Account approval'],
      ['Table', 'contoso_account']
    ].sort()
  );
  assert.equal(dependencies.length, 1);
  assert.equal(dependencies[0].required.typeLabel, 'Table');
  assert.equal(dependencies[0].required.name, 'Account custom table');
  assert.equal(dependencies[0].dependent.typeLabel, 'Process');
  assert.equal(dependencies[0].dependent.name, 'Account approval');
});

test('reports managed package warnings without force overwrite warnings', async () => {
  const result = await processPowerPlatformSolutionImportPreflightArchive(createZipArchive([
    ['solution.xml', solutionXml({ managed: true })],
    ['customizations.xml', customizationsXml()],
    ['Workflows/11111111-1111-1111-1111-111111111111.json', JSON.stringify(cloudFlowJson(), null, 2)]
  ]), {
    path: 'dist/ops.zip'
  });

  assert.equal(result.solution.packageType, 'Managed');
  assert.match(result.warnings.join('\n'), /Managed solution imports/);
  assert.doesNotMatch(result.warnings.join('\n'), /Force overwrite/);
  assert.match(result.documentationMarkdown, /pac solution import --path dist\/ops\.zip/);
});

test('builds import commands and validates required paths', () => {
  assert.equal(
    buildSolutionImportCommand({ path: 'dist/core.zip' }),
    'pac solution import --path dist/core.zip'
  );
  assert.equal(
    buildSolutionImportCommand({ path: 'dist/core solution.zip', async: true }),
    'pac solution import --path "dist/core solution.zip" --async'
  );
  assert.throws(
    () => buildSolutionImportCommand({ path: '' }),
    /ZIP path/
  );
});

test('reads deflated solution ZIP entries with an injected inflater', async () => {
  const result = await processPowerPlatformSolutionImportPreflightArchive(createZipArchive([
    ['solution.xml', solutionXml({ managed: false })],
    ['customizations.xml', customizationsXml()],
    ['Workflows/11111111-1111-1111-1111-111111111111.json', JSON.stringify(cloudFlowJson(), null, 2)]
  ], { method: 8 }), {
    path: 'dist/ops.zip',
    inflateRaw: bytes => inflateRawSync(bytes)
  });

  assert.equal(result.summary.rootComponentCount, 4);
  assert.match(result.documentationMarkdown, /Root component mix/);
});

test('reports invalid solution archive inputs', async () => {
  await assert.rejects(
    () => processPowerPlatformSolutionImportPreflightArchive(new Uint8Array([1, 2, 3])),
    /valid exported solution ZIP/
  );
});

function solutionXml({ managed }) {
  return [
    '<ImportExportXml>',
    '  <SolutionManifest>',
    '    <UniqueName>ops_toolkit</UniqueName>',
    '    <LocalizedNames>',
    '      <LocalizedName description="Operations Toolkit" languagecode="1033" />',
    '    </LocalizedNames>',
    '    <Version>1.2.3.4</Version>',
    `    <Managed>${managed ? 1 : 0}</Managed>`,
    '    <PublisherUniqueName>contoso</PublisherUniqueName>',
    '    <RootComponents>',
    '      <RootComponent type="1" schemaName="contoso_account" id="{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}" behavior="0" />',
    '      <RootComponent type="29" schemaName="Account approval" id="{11111111-1111-1111-1111-111111111111}" behavior="1" />',
    '      <RootComponent type="150" schemaName="contoso_api_url" id="{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}" behavior="1" />',
    '      <RootComponent type="372" schemaName="contoso_dataverse" id="{cccccccc-cccc-cccc-cccc-cccccccccccc}" behavior="1" />',
    '    </RootComponents>',
    '    <MissingDependencies>',
    '      <MissingDependency>',
    '        <Required type="1" schemaName="Account custom table" id="{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}" solution="Base solution" />',
    '        <Dependent type="29" schemaName="Account approval" id="{11111111-1111-1111-1111-111111111111}" />',
    '      </MissingDependency>',
    '    </MissingDependencies>',
    '  </SolutionManifest>',
    '</ImportExportXml>'
  ].join('\n');
}

function customizationsXml() {
  return [
    '<ImportExportXml>',
    '  <Workflows>',
    '    <Workflow WorkflowId="{11111111-1111-1111-1111-111111111111}" Name="Account approval" Category="5" />',
    '  </Workflows>',
    '  <EnvironmentVariableDefinition schemaName="contoso_api_url" displayName="API URL" type="100000000" defaultValue="https://api.example.test/default" />',
    '  <EnvironmentVariableValue schemaName="contoso_api_url">',
    '    <Value>https://api.example.test/current</Value>',
    '  </EnvironmentVariableValue>',
    '  <ConnectionReference connectionreferencelogicalname="contoso_dataverse" displayname="Dataverse connection" connectorid="/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps" />',
    '</ImportExportXml>'
  ].join('\n');
}

function cloudFlowJson() {
  return {
    properties: {
      displayName: 'Account approval',
      workflowEntityId: '11111111-1111-1111-1111-111111111111',
      definition: {
        triggers: {
          manual: {
            type: 'Request',
            description: 'When an account is selected'
          }
        },
        actions: {}
      }
    }
  };
}

function createZipArchive(files, options = {}) {
  const method = options.method || 0;
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach(([name, content]) => {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBytes, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + compressed.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localData.length, 16);
  eocd.writeUInt16LE(0, 20);

  return new Uint8Array(Buffer.concat([localData, centralDirectory, eocd]));
}
