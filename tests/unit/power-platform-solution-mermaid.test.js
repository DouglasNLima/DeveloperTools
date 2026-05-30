import assert from 'node:assert/strict';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import test from 'node:test';

import {
  buildComponentDiagram,
  buildSolutionInventoryMarkdown,
  mergeWorkflowComponents,
  parseSolutionMetadata,
  parseWorkflowJsonFiles,
  parseWorkflowMetadata,
  processPowerPlatformSolutionArchive,
  readZipArchive
} from '../../src/tools/power-platform-solution-mermaid.js';

test('reads stored ZIP entries and generates Mermaid for solution workflow components', async () => {
  const archive = createZipArchive([
    ['solution.xml', solutionXml()],
    ['customizations.xml', customizationsXml()],
    ['Workflows/11111111-1111-1111-1111-111111111111.json', JSON.stringify(cloudFlowJson(), null, 2)]
  ]);

  const result = await processPowerPlatformSolutionArchive(archive);

  assert.equal(result.solution.name, 'Operations Toolkit');
  assert.equal(result.solution.version, '1.2.3.4');
  assert.equal(result.solution.packageType, 'Unmanaged');
  assert.equal(result.summary.componentCount, 4);
  assert.deepEqual(
    result.summary.typeCounts.map(item => [item.label, item.count]),
    [
      ['Business process flow', 1],
      ['Business rule', 1],
      ['Classic workflow', 1],
      ['Cloud flow', 1]
    ]
  );

  const cloudFlow = result.components.find(component => component.type === 'cloud-flow');
  assert.ok(cloudFlow);
  assert.match(cloudFlow.mermaid, /^flowchart TD/);
  assert.match(cloudFlow.mermaid, /Trigger: When an account is selected/);
  assert.match(cloudFlow.mermaid, /Get account - OpenApiConnection - GetItem/);
  assert.match(cloudFlow.mermaid, /Condition - If/);
  assert.match(cloudFlow.mermaid, /yes/);
  assert.equal(cloudFlow.stepCount, 5);

  const bpf = result.components.find(component => component.type === 'business-process-flow');
  assert.match(bpf.mermaid, /^stateDiagram-v2/);
  assert.match(bpf.mermaid, /Qualify/);
  assert.match(bpf.mermaid, /Develop/);

  const businessRule = result.components.find(component => component.type === 'business-rule');
  assert.match(businessRule.mermaid, /Credit approved/);
  assert.match(businessRule.mermaid, /Show discount/);

  const workflow = result.components.find(component => component.type === 'classic-workflow');
  assert.match(workflow.mermaid, /Check account/);
  assert.match(workflow.mermaid, /Send email/);
  assert.match(result.inventoryMarkdown, /```mermaid\nflowchart TD/);
});

test('reads deflated ZIP entries with an injected inflater', async () => {
  const archive = createZipArchive([
    ['solution.xml', solutionXml()],
    ['Workflows/flow.json', JSON.stringify(cloudFlowJson(), null, 2)]
  ], { method: 8 });
  const zip = await readZipArchive(archive, {
    inflateRaw: bytes => inflateRawSync(bytes)
  });

  assert.equal(await zip.readText('solution.xml'), solutionXml());
  const workflowFiles = await zip.readMatchingText(path => path.toLocaleLowerCase('en-GB').startsWith('workflows/'));
  assert.equal(workflowFiles.length, 1);
  assert.match(workflowFiles[0].text, /When an account is selected/);
});

test('reports invalid or unsupported solution archive inputs', async () => {
  await assert.rejects(
    () => readZipArchive(new Uint8Array([1, 2, 3])),
    /valid exported solution ZIP/
  );

  await assert.rejects(
    () => processPowerPlatformSolutionArchive(createZipArchive([
      ['solution.xml', solutionXml()]
    ])),
    /No Power Platform workflow components/
  );
});

test('parses solution metadata and workflow metadata from XML', () => {
  const solution = parseSolutionMetadata(solutionXml());
  const components = parseWorkflowMetadata(customizationsXml());

  assert.equal(solution.uniqueName, 'ops_toolkit');
  assert.equal(solution.publisher, 'contoso');
  assert.equal(components.length, 4);
  assert.equal(components.find(component => component.name === 'Account approval').type, 'cloud-flow');
  assert.equal(components.find(component => component.name === 'Lead process').primaryEntity, 'lead');
});

test('merges cloud flow JSON definitions with customisations metadata', () => {
  const metadata = parseWorkflowMetadata(customizationsXml());
  const json = parseWorkflowJsonFiles([
    {
      path: 'Workflows/11111111-1111-1111-1111-111111111111.json',
      text: JSON.stringify(cloudFlowJson())
    }
  ]);
  const merged = mergeWorkflowComponents(metadata, json);
  const flow = buildComponentDiagram(merged.find(component => component.type === 'cloud-flow'));

  assert.equal(flow.name, 'Account approval');
  assert.equal(flow.typeLabel, 'Cloud flow');
  assert.match(flow.sourcePath, /customizations\.xml; Workflows/);
  assert.match(flow.mermaid, /Approval branch/);
});

test('generates metadata fallback diagrams for limited workflow exports', () => {
  const component = buildComponentDiagram({
    id: 'limited',
    name: 'Limited process',
    type: 'business-rule',
    typeLabel: 'Business rule',
    category: 2,
    sourcePath: 'customizations.xml',
    primaryEntity: 'account',
    state: 'Active',
    raw: {},
    warnings: []
  });

  assert.match(component.mermaid, /^flowchart TD/);
  assert.match(component.mermaid, /Business rule metadata/);
  assert.match(component.warnings.join('\n'), /metadata diagram/);

  const markdown = buildSolutionInventoryMarkdown({
    solution: {
      name: 'Limited',
      uniqueName: 'limited',
      version: '1.0.0.0',
      packageType: 'Managed',
      publisher: 'contoso'
    },
    components: [component],
    warnings: ['custom warning']
  });

  assert.match(markdown, /Archive warnings/);
  assert.match(markdown, /Business rule/);
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
    '      <ClientData>{"stages":[{"stageName":"Qualify"},{"stageName":"Develop"},{"stageName":"Close"}]}</ClientData>',
    '    </Workflow>',
    '    <Workflow WorkflowId="{33333333-3333-3333-3333-333333333333}" Name="Discount rule" Category="2">',
    '      <ClientData>{"conditions":[{"name":"Credit approved"}],"actions":[{"name":"Show discount"}]}</ClientData>',
    '    </Workflow>',
    '    <Workflow WorkflowId="{44444444-4444-4444-4444-444444444444}" Name="Account follow up" Category="0">',
    '      <ClientData>{"steps":[{"name":"Check account"},{"name":"Send email"}]}</ClientData>',
    '    </Workflow>',
    '  </Workflows>',
    '</ImportExportXml>'
  ].join('\n');
}

function cloudFlowJson() {
  return {
    properties: {
      displayName: 'Account approval',
      workflowEntityId: '11111111-1111-1111-1111-111111111111',
      state: 'Started',
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
                operationId: 'GetItem'
              }
            }
          },
          Condition: {
            type: 'If',
            runAfter: {
              Get_account: ['Succeeded']
            },
            actions: {
              Approval_branch: {
                type: 'OpenApiConnection',
                inputs: {
                  host: {
                    operationId: 'StartApproval'
                  }
                }
              }
            },
            else: {
              actions: {
                Reject_branch: {
                  type: 'Compose'
                }
              }
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
