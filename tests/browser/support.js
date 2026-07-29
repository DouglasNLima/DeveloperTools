import { PDFDocument, StandardFonts } from 'pdf-lib';

import { APP_TITLE } from '../../src/app-metadata.js';

export { APP_TITLE };

export const SAMPLE_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10" viewBox="0 0 16 10"><rect width="16" height="10" fill="#ff883e"/></svg>');
export const SAMPLE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/l73XtQAAAABJRU5ErkJggg==', 'base64');

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
    const data = Buffer.from(content, 'utf8');
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
