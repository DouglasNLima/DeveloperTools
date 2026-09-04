import { PDFDocument, StandardFonts } from 'pdf-lib';
import { deflateRawSync, deflateSync } from 'node:zlib';

import { APP_TITLE } from '../../src/app-metadata.js';

export { APP_TITLE };

export const SAMPLE_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10" viewBox="0 0 16 10"><rect width="16" height="10" fill="#ff883e"/></svg>');
export const SAMPLE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/l73XtQAAAABJRU5ErkJggg==', 'base64');

export function createWordImageDocx() {
  return createStoredZip([
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['word/document.xml', '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp"><w:body><w:drawing><wp:inline><wp:docPr descr="Screenshot alt text" title="Screenshot title"/><a:blip r:embed="rId1"/></wp:inline></w:drawing><w:drawing><a:blip r:embed="rId2"/></w:drawing><w:drawing><a:blip r:link="rId3"/></w:drawing></w:body></w:document>'],
    ['word/_rels/document.xml.rels', '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/first.png"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/second.png"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.test/remote.png" TargetMode="External"/></Relationships>'],
    ['word/media/first.png', SAMPLE_PNG],
    ['word/media/second.png', SAMPLE_PNG]
  ]);
}

export function createWordImageFormatsDocx() {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>');
  const emf = Buffer.alloc(44);
  emf.writeInt32LE(100, 8);
  emf.writeInt32LE(80, 12);
  emf.writeUInt32LE(0x464d4520, 40);
  const tiff = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
  const relationships = [
    ['rIdPng', 'media/image.png'],
    ['rIdJpeg', 'media/image.jpg'],
    ['rIdWebp', 'media/image.webp'],
    ['rIdSvg', 'media/image.svg'],
    ['rIdEmf', 'media/image.emf'],
    ['rIdTiff', 'media/image.tiff']
  ].map(([id, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`).join('');
  const references = ['Png', 'Jpeg', 'Webp', 'Svg', 'Emf', 'Tiff']
    .map(id => `<a:blip r:embed="rId${id}"/>`)
    .join('');

  return createStoredZip([
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['word/document.xml', `<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body>${references}</w:body></w:document>`],
    ['word/_rels/document.xml.rels', `<Relationships>${relationships}</Relationships>`],
    ['word/media/image.png', SAMPLE_PNG],
    ['word/media/image.jpg', jpeg],
    ['word/media/image.webp', webp],
    ['word/media/image.svg', svg],
    ['word/media/image.emf', emf],
    ['word/media/image.tiff', tiff]
  ]);
}

let cachedWordOptimiserDocx = null;
let cachedCroppedWordOptimiserDocx = null;
let cachedNonShrinkingWordOptimiserDocx = null;
let cachedTallRasterWordOptimiserDocx = null;
let cachedProcessingFailureWordOptimiserDocx = null;

export function createWordOptimiserDocx() {
  if (cachedWordOptimiserDocx) return cachedWordOptimiserDocx;

  const screenshot = createScreenshotPng(1800, 1000);
  const efficient = createScreenshotPng(300, 200);
  const unknownDisplay = createScreenshotPng(900, 500);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#1976d2"/><path d="M20 320h600" stroke="#fff"/></svg>';
  const tiff = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
  const relationships = [
    ['rIdScreenshot', 'media/screenshot.png'],
    ['rIdEfficient', 'media/efficient.png'],
    ['rIdUnknown', 'media/unknown-display.png'],
    ['rIdVector', 'media/diagram.svg'],
    ['rIdTiff', 'media/unsupported.tiff']
  ].map(([id, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`).join('');
  const documentXml = [
    '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp">',
    '<w:body>',
    '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="5486400" cy="3048000"/><wp:docPr descr="Large application screenshot" title="Screenshot"/><a:blip r:embed="rIdScreenshot"/></wp:inline></w:drawing></w:r></w:p>',
    '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="1828800" cy="1016000"/><a:blip r:embed="rIdScreenshot"/></wp:inline></w:drawing></w:r></w:p>',
    '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="1828800" cy="1219200"/><a:blip r:embed="rIdEfficient"/></wp:inline></w:drawing></w:r></w:p>',
    '<w:p><w:r><w:drawing><a:blip r:embed="rIdUnknown"/></w:drawing></w:r></w:p>',
    '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="3657600" cy="2057400"/><a:blip r:embed="rIdVector"/></wp:inline></w:drawing></w:r></w:p>',
    '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="2743200" cy="1524000"/><a:blip r:embed="rIdTiff"/></wp:inline></w:drawing></w:r></w:p>',
    '</w:body></w:document>'
  ].join('');

  cachedWordOptimiserDocx = createStoredZip([
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['word/document.xml', documentXml],
    ['word/_rels/document.xml.rels', `<Relationships>${relationships}</Relationships>`],
    ['word/media/screenshot.png', screenshot],
    ['word/media/efficient.png', efficient],
    ['word/media/unknown-display.png', unknownDisplay],
    ['word/media/diagram.svg', svg],
    ['word/media/unsupported.tiff', tiff],
    ['word/media/orphan.png', createScreenshotPng(500, 280)]
  ]);
  return cachedWordOptimiserDocx;
}

export function createCroppedWordOptimiserDocx() {
  if (cachedCroppedWordOptimiserDocx) return cachedCroppedWordOptimiserDocx;

  const screenshot = createScreenshotPng(1800, 1000);
  const documentXml = [
    '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp" xmlns:pic="pic">',
    '<w:body>',
    '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="5486400" cy="3048000"/><pic:pic><pic:blipFill><a:srcRect l="10000" r="7500" t="5000" b="12500"/><a:blip r:embed="rIdScreenshot"/></pic:blipFill></pic:pic></wp:inline></w:drawing></w:r></w:p>',
    '</w:body></w:document>'
  ].join('');

  cachedCroppedWordOptimiserDocx = createStoredZip([
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['word/document.xml', documentXml],
    ['word/_rels/document.xml.rels', '<Relationships><Relationship Id="rIdScreenshot" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/cropped-screenshot.png"/></Relationships>'],
    ['word/media/cropped-screenshot.png', screenshot]
  ]);
  return cachedCroppedWordOptimiserDocx;
}

export function createNonShrinkingWordOptimiserDocx() {
  if (cachedNonShrinkingWordOptimiserDocx) return cachedNonShrinkingWordOptimiserDocx;

  const screenshot = Buffer.concat([createScreenshotPng(1800, 1000), Buffer.alloc(2_000_000)]);
  const documentXml = '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp"><w:body><w:p><w:r><w:drawing><wp:inline><wp:extent cx="5486400" cy="3048000"/><a:blip r:embed="rIdScreenshot"/></wp:inline></w:drawing></w:r></w:p></w:body></w:document>';
  cachedNonShrinkingWordOptimiserDocx = createDeflatedZip([
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['word/document.xml', documentXml],
    ['word/_rels/document.xml.rels', '<Relationships><Relationship Id="rIdScreenshot" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/non-shrinking-screenshot.png"/></Relationships>'],
    ['word/media/non-shrinking-screenshot.png', screenshot]
  ]);
  return cachedNonShrinkingWordOptimiserDocx;
}

export function createTallRasterWordOptimiserDocx() {
  if (cachedTallRasterWordOptimiserDocx) return cachedTallRasterWordOptimiserDocx;

  const tallImage = createSolidPng(1238, 12921, 1_500_000);
  const documentXml = '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp"><w:body><w:p><w:r><w:drawing><wp:inline><wp:extent cx="6096000" cy="63607950"/><a:blip r:embed="rIdTall"/></wp:inline></w:drawing></w:r></w:p></w:body></w:document>';
  cachedTallRasterWordOptimiserDocx = createStoredZip([
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['word/document.xml', documentXml],
    ['word/_rels/document.xml.rels', '<Relationships><Relationship Id="rIdTall" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/tall-diagram.png"/></Relationships>'],
    ['word/media/tall-diagram.png', tallImage]
  ]);
  return cachedTallRasterWordOptimiserDocx;
}

export function createProcessingFailureWordOptimiserDocx() {
  if (cachedProcessingFailureWordOptimiserDocx) return cachedProcessingFailureWordOptimiserDocx;

  const first = createScreenshotPng(1800, 1000);
  const second = createScreenshotPng(1800, 1000);
  const documentXml = [
    '<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r" xmlns:wp="wp">',
    '<w:body>',
    '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="5486400" cy="3048000"/><a:blip r:embed="rIdFirst"/></wp:inline></w:drawing></w:r></w:p>',
    '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="4572000" cy="2514600"/><a:blip r:embed="rIdSecond"/></wp:inline></w:drawing></w:r></w:p>',
    '</w:body></w:document>'
  ].join('');
  cachedProcessingFailureWordOptimiserDocx = createStoredZip([
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['word/document.xml', documentXml],
    ['word/_rels/document.xml.rels', '<Relationships><Relationship Id="rIdFirst" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/first.png"/><Relationship Id="rIdSecond" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/second.png"/></Relationships>'],
    ['word/media/first.png', first],
    ['word/media/second.png', second]
  ]);
  return cachedProcessingFailureWordOptimiserDocx;
}

function createScreenshotPng(width, height) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.allocUnsafe(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowLength;
    raw[rowOffset] = 0;
    let seed = (0x9e3779b9 ^ (y * 2654435761)) >>> 0;

    for (let x = 0; x < width; x += 1) {
      seed = Math.imul(seed ^ (seed >>> 13), 0x5bd1e995) >>> 0;
      const noise = (seed >>> 28) & 15;
      let red = 246;
      let green = 248;
      let blue = 251;

      if (y < 72) {
        red = 28 + noise;
        green = 62 + noise;
        blue = 102 + noise;
      } else if (x < 270) {
        red = 230 + (noise >> 2);
        green = 235 + (noise >> 2);
        blue = 244 + (noise >> 2);
      } else if ((y > 130 && y < 158) || (y > 208 && y < 230) || (y > 310 && y < 330) || (y > 420 && y < 442)) {
        red = 45 + noise;
        green = 76 + noise;
        blue = 125 + noise;
      } else if (x > 360 && x < 1480 && y > 250 && y < 860 && ((x + y) % 97 < 12)) {
        red = 205 + (noise >> 1);
        green = 215 + (noise >> 1);
        blue = 230 + (noise >> 1);
      }

      const pixelOffset = rowOffset + 1 + x * 4;
      raw[pixelOffset] = red;
      raw[pixelOffset + 1] = green;
      raw[pixelOffset + 2] = blue;
      raw[pixelOffset + 3] = 255;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', Buffer.concat([pngUInt32(width, height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function createSolidPng(width, height, paddingBytes = 0) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height, 255);

  for (let y = 0; y < height; y += 1) {
    raw[y * rowLength] = 0;
  }

  const chunks = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', Buffer.concat([pngUInt32(width, height), Buffer.from([8, 6, 0, 0, 0])]))
  ];

  if (paddingBytes > 0) {
    chunks.push(pngChunk('tEXt', Buffer.concat([Buffer.from('Padding\0', 'ascii'), Buffer.alloc(paddingBytes, 65)])));
  }

  chunks.push(
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0))
  );
  return Buffer.concat(chunks);
}

function pngUInt32(...values) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeUInt32BE(value >>> 0, index * 4));
  return bytes;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const content = Buffer.from(data);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(content.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, content])), 0);
  return Buffer.concat([header, name, content, crc]);
}

function crc32(data) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

export async function primeOfflineApp(page) {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

export function createImportPreflightSolutionZip() {
  const files = [
    ['solution.xml', [
      '<ImportExportXml>',
      '  <SolutionManifest>',
      '    <UniqueName>ops_toolkit</UniqueName>',
      '    <LocalizedNames>',
      '      <LocalizedName description="Operations Toolkit" languagecode="1033" />',
      '    </LocalizedNames>',
      '    <Version>1.2.3.4</Version>',
      '    <Managed>0</Managed>',
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
    ].join('\n')],
    ['customizations.xml', [
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
    ].join('\n')],
    ['Workflows/11111111-1111-1111-1111-111111111111.json', JSON.stringify({
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
    }, null, 2)]
  ];

  return createStoredZip(files);
}

export function createSolutionZip() {
  const files = [
    ['solution.xml', [
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
    ].join('\n')],
    ['customizations.xml', [
      '<ImportExportXml>',
      '  <Workflows>',
      '    <Workflow WorkflowId="{11111111-1111-1111-1111-111111111111}" Name="Account approval" Category="5" />',
      '    <Workflow WorkflowId="{22222222-2222-2222-2222-222222222222}" Name="Lead process" Category="4">',
      '      <PrimaryEntity>lead</PrimaryEntity>',
      '      <ClientData>{"stages":[{"stageName":"Qualify"},{"stageName":"Develop"},{"stageName":"Close"}]}</ClientData>',
      '    </Workflow>',
      '  </Workflows>',
      '  <EnvironmentVariableDefinition schemaName="contoso_api_url" displayName="API URL" type="100000000" defaultValue="https://api.example.test/default" />',
      '  <EnvironmentVariableValue schemaName="contoso_api_url">',
      '    <Value>https://api.example.test/current</Value>',
      '  </EnvironmentVariableValue>',
      '  <ConnectionReference connectionreferencelogicalname="contoso_dataverse" displayname="Dataverse connection" connectorid="/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps" />',
      '</ImportExportXml>'
    ].join('\n')],
    ['Workflows/11111111-1111-1111-1111-111111111111.json', JSON.stringify({
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
              }
            }
          }
        }
      }
    }, null, 2)]
  ];

  return createStoredZip(files);
}

export function createFlowEditorSolutionZip(options = {}) {
  const managed = options.managed ? '1' : '0';
  const accountId = '11111111-1111-1111-1111-111111111111';
  const childId = '22222222-2222-2222-2222-222222222222';
  const accountName = options.guidLabels ? `Account approval-${accountId}` : 'Account approval';
  const childName = options.guidLabels ? `Child notifier-${childId}` : 'Child notifier';
  const accountFlow = {
    properties: {
      displayName: accountName,
      workflowEntityId: accountId,
      definition: {
        triggers: {
          manual: {
            type: 'Request',
            description: 'When an account is selected',
            ...(options.guidLabels ? { metadata: { operationMetadataId: accountId } } : {})
          }
        },
        actions: {
          Get_account: {
            type: 'OpenApiConnection',
            ...(options.guidLabels ? { metadata: { operationMetadataId: childId } } : {}),
            inputs: {
              host: {
                operationId: 'GetItem'
              }
            }
          }
        }
      }
    }
  };
  const childFlow = {
    properties: {
      displayName: childName,
      workflowEntityId: childId,
      definition: {
        triggers: {
          request: {
            type: 'Request',
            description: 'Run from a parent flow'
          }
        },
        actions: {
          Compose_response: {
            type: 'Compose'
          }
        }
      }
    }
  };
  const extraFlows = Array.from({ length: options.extraFlowCount || 0 }, (_, index) => {
    const sequence = index + 3;
    const token = String(sequence).padStart(8, '0');
    const id = `${token}-0000-0000-0000-${String(sequence).padStart(12, '0')}`;
    const baseName = `Batch status processor ${String(sequence).padStart(2, '0')}`;
    const name = options.guidLabels ? `${baseName}-${id}` : baseName;

    return {
      id,
      name,
      text: JSON.stringify({
        properties: {
          displayName: name,
          workflowEntityId: id,
          definition: {
            triggers: {
              request: {
                type: 'Request',
                ...(options.guidLabels ? { metadata: { operationMetadataId: id } } : {})
              }
            },
            actions: {
              Process_status_update: {
                type: 'Compose',
                ...(options.guidLabels ? { metadata: { operationMetadataId: id } } : {})
              }
            }
          }
        }
      }, null, 2)
    };
  });

  return createStoredZip([
    ['solution.xml', [
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
    ].join('\n')],
    ['customizations.xml', [
      '<ImportExportXml>',
      '  <Workflows>',
      `    <Workflow WorkflowId="{${accountId}}" Name="${accountName}" Category="5" />`,
      `    <Workflow WorkflowId="{${childId}}" Name="${childName}" Category="5" />`,
      ...extraFlows.map(flow => `    <Workflow WorkflowId="{${flow.id}}" Name="${flow.name}" Category="5" />`),
      '  </Workflows>',
      '</ImportExportXml>'
    ].join('\n')],
    ['Workflows/11111111-1111-1111-1111-111111111111.json', JSON.stringify(accountFlow, null, 2)],
    ['Workflows/22222222-2222-2222-2222-222222222222.json', JSON.stringify(childFlow, null, 2)],
    ...extraFlows.map(flow => [`Workflows/${flow.id}.json`, flow.text]),
    ['WebResources/contoso_/unchanged.txt', 'This entry must remain unchanged.']
  ]);
}

export function createClassicWorkflowEditorSolutionZip(options = {}) {
  const managed = options.managed ? '1' : '0';
  const accountId = '11111111-1111-1111-1111-111111111111';
  const caseId = '22222222-2222-2222-2222-222222222222';
  const accountName = options.guidLabels ? `Account follow up-${accountId}` : 'Account follow up';
  const caseName = options.guidLabels ? `Case escalation-${caseId}` : 'Case escalation';

  return createStoredZip([
    ['solution.xml', [
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
    ].join('\n')],
    ['customizations.xml', [
      '<ImportExportXml>',
      '  <Workflows>',
      `    <Workflow WorkflowId="{${accountId}}" Name="${accountName}" Category="0">`,
      '      <XamlFileName>/Workflows/AccountFollowUp.xaml</XamlFileName>',
      '      <PrimaryEntity>account</PrimaryEntity><Mode>0</Mode><Scope>4</Scope>',
      '      <TriggerOnCreate>1</TriggerOnCreate><TriggerOnDelete>0</TriggerOnDelete>',
      '      <TriggerOnUpdateAttributeList>name,statuscode</TriggerOnUpdateAttributeList><OnDemand>1</OnDemand>',
      '      <StateCode>1</StateCode>',
      '    </Workflow>',
      `    <Workflow WorkflowId="{${caseId}}" Name="${caseName}" Category="0">`,
      '      <XamlFileName>/Workflows/CaseEscalation.xaml</XamlFileName>',
      '      <PrimaryEntity>incident</PrimaryEntity><Mode>1</Mode><OnDemand>1</OnDemand>',
      '    </Workflow>',
      '    <Workflow WorkflowId="{33333333-3333-3333-3333-333333333333}" Name="Ignored action" Category="3">',
      '      <XamlFileName>/Workflows/IgnoredAction.xaml</XamlFileName>',
      '    </Workflow>',
      '  </Workflows>',
      '</ImportExportXml>'
    ].join('\n')],
    ['Workflows/AccountFollowUp.xaml', classicWorkflowXaml(
      'XrmWorkflow111',
      options.guidLabels ? `${accountId} - Check account` : 'Check account'
    )],
    ['Workflows/CaseEscalation.xaml', classicWorkflowXaml('XrmWorkflow222', 'Case start')],
    ['WebResources/contoso_/unchanged.txt', 'This entry must remain unchanged.']
  ]);
}

function classicWorkflowXaml(xClass, firstStep) {
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

export function createModelDrivenJavascriptSolutionZip(options = {}) {
  const labelGuid = '643ea8ee-9c35-4fd7-909c-facf7fb68428';
  const webResourceDisplayName = options.guidLabels ? `Account script-${labelGuid}` : 'Account script';
  const files = [
    ['solution.xml', [
      '<ImportExportXml>',
      '  <SolutionManifest>',
      '    <UniqueName>model_driven_tools</UniqueName>',
      '    <LocalizedNames>',
      '      <LocalizedName description="Model-driven Tools" languagecode="1033" />',
      '    </LocalizedNames>',
      '    <Version>2.0.0.0</Version>',
      '    <Managed>0</Managed>',
      '    <PublisherUniqueName>contoso</PublisherUniqueName>',
      '  </SolutionManifest>',
      '</ImportExportXml>'
    ].join('\n')],
    ['customizations.xml', [
      '<ImportExportXml>',
      '  <WebResources>',
      `    <WebResource Name="contoso_/account.js" DisplayName="${webResourceDisplayName}" WebResourceType="3" />`,
      '  </WebResources>',
      '  <Entities>',
      '    <Entity>',
      '      <FormXml>',
      '        <systemform name="Account main">',
      '          <formLibraries>',
      '            <Library name="$webresource:contoso_/account.js" rank="1" />',
      '          </formLibraries>',
      '          <events>',
      '            <event name="onload">',
      '              <Handlers>',
      '                <Handler functionName="Contoso.Account.onLoad" libraryName="$webresource:contoso_/account.js" enabled="true" passExecutionContext="true" rank="1" />',
      '              </Handlers>',
      '            </event>',
      '            <event name="onsave">',
      '              <Handlers>',
      '                <Handler functionName="Contoso.Account.onSave" libraryName="$webresource:contoso_/account.js" enabled="true" passExecutionContext="false" rank="2" />',
      '              </Handlers>',
      '            </event>',
      '          </events>',
      '        </systemform>',
      '      </FormXml>',
      '    </Entity>',
      '  </Entities>',
      '</ImportExportXml>'
    ].join('\n')],
    ['WebResources/contoso_/account.js', [
      'Contoso.Account.onSave = function (executionContext) {',
      '  return Xrm.WebApi.retrieveMultipleRecords("account", "?$select=name");',
      '};'
    ].join('\n')],
    ['WebResources/contoso_/page.html', [
      '<!doctype html>',
      '<html>',
      '<head><script src="/WebResources/contoso_/account.js"></script></head>',
      '<body data-script="$webresource:contoso_/account.js"></body>',
      '</html>'
    ].join('\n')]
  ];

  return createStoredZip(files);
}

export function createDependencySolutionZip(options = {}) {
  const labelGuid = '643ea8ee-9c35-4fd7-909c-facf7fb68428';
  const parentName = options.guidLabels ? `Parent account updater-${labelGuid}` : 'Parent account updater';
  const childName = options.guidLabels ? `Child account notifier-${labelGuid}` : 'Child account notifier';
  const ruleName = options.guidLabels ? `Account risk rule-${labelGuid}` : 'Account risk rule';
  const actionName = options.guidLabels ? `contoso_DoAccountWork-${labelGuid}` : 'contoso_DoAccountWork';
  const pluginName = options.guidLabels ? `Account post update-${labelGuid}` : 'Account post update';
  const files = [
    ['solution.xml', [
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
    ].join('\n')],
    ['customizations.xml', [
      '<ImportExportXml>',
      '  <Workflows>',
      `    <Workflow WorkflowId="{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}" Name="${parentName}" Category="5" />`,
      `    <Workflow WorkflowId="{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}" Name="${childName}" Category="5" />`,
      `    <Workflow WorkflowId="{cccccccc-cccc-cccc-cccc-cccccccccccc}" Name="${ruleName}" Category="2">`,
      '      <PrimaryEntity>account</PrimaryEntity>',
      '      <ClientData>{"conditions":[{"field":"name","name":"Name changed"}],"actions":[{"name":"Show risk field"}]}</ClientData>',
      '    </Workflow>',
      `    <Workflow WorkflowId="{dddddddd-dddd-dddd-dddd-dddddddddddd}" Name="${actionName}" Category="3">`,
      '      <PrimaryEntity>account</PrimaryEntity>',
      '    </Workflow>',
      '  </Workflows>',
      `  <SdkMessageProcessingStep SdkMessageProcessingStepId="{eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee}" Name="${pluginName}" MessageName="Update" PrimaryEntity="account" FilteringAttributes="name" Stage="40" Mode="0" />`,
      '</ImportExportXml>'
    ].join('\n')],
    ['Workflows/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json', JSON.stringify({
      properties: {
        displayName: parentName,
        workflowEntityId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        definition: {
          triggers: {
            manual: {
              type: 'Request',
              description: 'When an account is selected'
            }
          },
          actions: {
            Update_account: {
              type: 'OpenApiConnection',
              inputs: {
                host: {
                  apiId: '/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps',
                  operationId: 'UpdateRecord'
                },
                parameters: {
                  entityName: 'account',
                  item: {
                    name: 'Contoso'
                  }
                }
              }
            },
            Run_child_flow: {
              type: 'Workflow',
              runAfter: {
                Update_account: ['Succeeded']
              },
              inputs: {
                host: {
                  workflowReferenceName: childName
                }
              }
            },
            Call_custom_action: {
              type: 'OpenApiConnection',
              runAfter: {
                Run_child_flow: ['Succeeded']
              },
              inputs: {
                host: {
                  apiId: '/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps',
                  operationId: 'PerformUnboundAction'
                },
                parameters: {
                  actionName
                }
              }
            }
          }
        }
      }
    }, null, 2)],
    ['Workflows/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.json', JSON.stringify({
      properties: {
        displayName: childName,
        workflowEntityId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        definition: {
          triggers: {
            request: {
              type: 'Request',
              description: 'Run from parent flow'
            }
          },
          actions: {
            Compose_response: {
              type: 'Compose'
            }
          }
        }
      }
    }, null, 2)]
  ];

  return createStoredZip(files);
}

export function createStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach(([name, content]) => {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBytes, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
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

  return Buffer.concat([localData, centralDirectory, eocd]);
}

function createDeflatedZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach(([name, content]) => {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
    const compressed = Buffer.from(deflateRawSync(data));
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt32LE(crc32(data), 14);
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
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt32LE(crc32(data), 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + compressed.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localData.length, 16);

  return Buffer.concat([localData, centralDirectory, eocd]);
}

export async function createFillablePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([420, 260]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const form = pdfDoc.getForm();

  page.drawText('Customer name', { x: 40, y: 206, size: 11, font });
  const nameField = form.createTextField('customer_name');
  nameField.setText('Contoso');
  nameField.addToPage(page, { x: 40, y: 178, width: 220, height: 24 });

  page.drawText('Newsletter opt in', { x: 40, y: 136, size: 11, font });
  const checkBox = form.createCheckBox('newsletter_opt_in');
  checkBox.check();
  checkBox.addToPage(page, { x: 40, y: 108, width: 18, height: 18 });

  form.updateFieldAppearances(font);
  return Buffer.from(await pdfDoc.save());
}

export async function createOcrPng(page, text) {
  const base64 = await page.evaluate(value => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = 900;
    canvas.height = 260;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000000';
    context.font = 'bold 96px Arial, sans-serif';
    context.textBaseline = 'middle';
    context.fillText(value, 64, 130);

    return canvas.toDataURL('image/png').split(',')[1];
  }, text);

  return Buffer.from(base64, 'base64');
}

export async function createGradientPng(page, width, height) {
  const base64 = await page.evaluate(dimensions => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const gradient = context.createLinearGradient(0, 0, dimensions.width, dimensions.height);
    gradient.addColorStop(0, '#0f766e');
    gradient.addColorStop(0.45, '#f59e0b');
    gradient.addColorStop(1, '#be123c');
    context.fillStyle = gradient;
    context.fillRect(0, 0, dimensions.width, dimensions.height);

    for (let y = 0; y < dimensions.height; y += 24) {
      for (let x = 0; x < dimensions.width; x += 24) {
        const red = (x * 17 + y * 3) % 255;
        const green = (x * 5 + y * 11) % 255;
        const blue = (x * 13 + y * 7) % 255;
        context.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.42)`;
        context.fillRect(x, y, 16, 16);
      }
    }

    return canvas.toDataURL('image/png').split(',')[1];
  }, { width, height });

  return Buffer.from(base64, 'base64');
}

export async function dropFile(page, selector, file) {
  await dropFiles(page, selector, [file]);
}

export async function dropFiles(page, selector, files) {
  const dataTransfer = await page.evaluateHandle(droppedFiles => {
    const transfer = new DataTransfer();

    droppedFiles.forEach(({ name, mimeType, bytes }) => {
      const droppedFile = new File([new Uint8Array(bytes)], name, { type: mimeType });
      transfer.items.add(droppedFile);
    });

    return transfer;
  }, files.map(file => ({
    name: file.name,
    mimeType: file.mimeType,
    bytes: [...file.buffer]
  })));

  await page.dispatchEvent(selector, 'dragenter', { dataTransfer });
  await page.dispatchEvent(selector, 'dragover', { dataTransfer });
  await page.dispatchEvent(selector, 'drop', { dataTransfer });
  await dataTransfer.dispose();
}

export function makeJwt(payload, header = { alg: 'HS256', typ: 'JWT' }, signature = 'signature') {
  return `${encodeJwtPart(header)}.${encodeJwtPart(payload)}.${encodeJwtPart(signature)}`;
}

export function encodeJwtPart(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return Buffer.from(text, 'utf8').toString('base64url');
}
