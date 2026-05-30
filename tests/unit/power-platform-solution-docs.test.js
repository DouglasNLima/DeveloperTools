import assert from 'node:assert/strict';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import test from 'node:test';

import {
  buildSolutionDocumentationFileName,
  buildSolutionDocumentationMarkdown,
  processPowerPlatformSolutionDocumentationArchive
} from '../../src/tools/power-platform-solution-docs.js';
import {
  parseConnectionReferences,
  parseEnvironmentVariables,
  readPowerPlatformSolutionArchive
} from '../../src/tools/power-platform-solution.js';

test('generates operational Markdown documentation from an exported solution ZIP', async () => {
  const result = await processPowerPlatformSolutionDocumentationArchive(createZipArchive([
    ['solution.xml', solutionXml()],
    ['customizations.xml', customizationsXml()],
    ['Workflows/11111111-1111-1111-1111-111111111111.json', JSON.stringify(cloudFlowJson(), null, 2)]
  ]));

  assert.equal(result.solution.name, 'Operations Toolkit');
  assert.equal(result.summary.componentCount, 2);
  assert.equal(result.summary.environmentVariableCount, 1);
  assert.equal(result.summary.connectionReferenceCount, 1);
  assert.match(result.documentationMarkdown, /# Power Platform solution documentation/);
  assert.match(result.documentationMarkdown, /Operational summary/);
  assert.match(result.documentationMarkdown, /Account approval/);
  assert.match(result.documentationMarkdown, /1 trigger and 2 actions detected/);
  assert.match(result.documentationMarkdown, /Environment variables/);
  assert.match(result.documentationMarkdown, /Current and default included/);
  assert.doesNotMatch(result.documentationMarkdown, /https:\/\/api\.example\.test\/current/);
  assert.match(result.documentationMarkdown, /Connection references/);
  assert.match(result.documentationMarkdown, /commondataserviceforapps/);
  assert.equal(buildSolutionDocumentationFileName(result.solution.name), 'Operations-Toolkit-documentation.md');
});

test('documents limited solutions without process components', async () => {
  const result = await processPowerPlatformSolutionDocumentationArchive(createZipArchive([
    ['solution.xml', solutionXml()],
    ['customizations.xml', [
      '<ImportExportXml>',
      '  <EnvironmentVariableDefinition schemaName="contoso_flag" displayName="Feature flag" type="100000002" />',
      '</ImportExportXml>'
    ].join('\n')]
  ]));

  assert.equal(result.summary.componentCount, 0);
  assert.equal(result.summary.environmentVariableCount, 1);
  assert.match(result.documentationMarkdown, /No process components were detected/);
  assert.match(result.documentationMarkdown, /No connection references detected/);
});

test('parses reusable solution metadata for documentation tools', async () => {
  const archive = createZipArchive([
    ['solution.xml', solutionXml()],
    ['customizations.xml', customizationsXml()],
    ['Workflows/11111111-1111-1111-1111-111111111111.json', JSON.stringify(cloudFlowJson(), null, 2)]
  ], { method: 8 });
  const result = await readPowerPlatformSolutionArchive(archive, {
    inflateRaw: bytes => inflateRawSync(bytes)
  });

  assert.equal(result.solution.uniqueName, 'ops_toolkit');
  assert.equal(result.components.length, 2);
  assert.equal(result.environmentVariables[0].schemaName, 'contoso_api_url');
  assert.equal(result.connectionReferences[0].connectorName, 'commondataserviceforapps');
});

test('parses environment variables and connection references directly from customisations XML', () => {
  const variables = parseEnvironmentVariables(customizationsXml());
  const references = parseConnectionReferences(customizationsXml());

  assert.equal(variables.length, 1);
  assert.equal(variables[0].displayName, 'API URL');
  assert.equal(variables[0].type, 'String');
  assert.equal(variables[0].currentValue, 'https://api.example.test/current');
  assert.equal(references.length, 1);
  assert.equal(references[0].displayName, 'Dataverse connection');
  assert.equal(references[0].connectorName, 'commondataserviceforapps');
});

test('builds documentation Markdown from supplied report parts', () => {
  const markdown = buildSolutionDocumentationMarkdown({
    solution: {
      name: 'Manual',
      uniqueName: 'manual',
      version: '1.0.0.0',
      packageType: 'Managed',
      publisher: 'contoso'
    },
    summary: {
      componentCount: 0,
      environmentVariableCount: 0,
      connectionReferenceCount: 0,
      warningCount: 0,
      typeCounts: []
    },
    zip: {
      entryCount: 2,
      workflowJsonCount: 0
    }
  });

  assert.match(markdown, /No warnings detected/);
  assert.match(markdown, /Archive entries \| 2/);
  assert.match(markdown, /Environment variable values are reported as presence states/);
});

function solutionXml() {
  return [
    '<ImportExportXml>',
    '  <SolutionManifest>',
    '    <UniqueName>ops_toolkit</UniqueName>',
    '    <LocalizedNames>',
    '      <LocalizedName description="Operations Toolkit" languagecode="1033" />',
    '    </LocalizedNames>',
    '    <Version>1.2.3.4</Version>',
    '    <Managed>0</Managed>',
    '    <PublisherUniqueName>contoso</PublisherUniqueName>',
    '  </SolutionManifest>',
    '</ImportExportXml>'
  ].join('\n');
}

function customizationsXml() {
  return [
    '<ImportExportXml>',
    '  <Workflows>',
    '    <Workflow WorkflowId="{11111111-1111-1111-1111-111111111111}" Name="Account approval" Category="5" />',
    '    <Workflow WorkflowId="{22222222-2222-2222-2222-222222222222}" Name="Lead process" Category="4">',
    '      <PrimaryEntity>lead</PrimaryEntity>',
    '      <ClientData>{"stages":[{"stageName":"Qualify"},{"stageName":"Close"}]}</ClientData>',
    '    </Workflow>',
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
        actions: {
          Get_account: {
            type: 'OpenApiConnection',
            inputs: {
              host: {
                apiId: '/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps',
                operationId: 'GetItem'
              }
            }
          },
          Compose_response: {
            type: 'Compose',
            runAfter: {
              Get_account: ['Succeeded']
            }
          }
        }
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
