const JSON_SOURCE_PORTS = [
  { toolId: 'json-formatter', outputId: 'output' },
  { toolId: 'json-diff', outputId: 'output' },
  { toolId: 'json-schema-validator', outputId: 'output' },
  { toolId: 'data-explorer', outputId: 'output' },
  { toolId: 'csv-tsv-helper', outputId: 'output' },
  { toolId: 'url-codec', outputId: 'output' },
  { toolId: 'regex-tester', outputId: 'output' },
  { toolId: 'text-diff', outputId: 'output' },
  { toolId: 'jwt-decoder', outputId: 'header' },
  { toolId: 'jwt-decoder', outputId: 'payload' },
  { toolId: 'pdf-template-field-explorer', outputId: 'fields-json' }
];

const MERMAID_GENERATOR_SOURCE_PORTS = [
  { toolId: 'mermaid-template-builder', outputId: 'output' },
  { toolId: 'data-to-mermaid', outputId: 'output' },
  { toolId: 'api-workflow-to-mermaid', outputId: 'output' },
  { toolId: 'power-platform-solution-mermaid', outputId: 'mermaid' }
];

const MERMAID_SOURCE_PORTS = [
  { toolId: 'mermaid-editor', outputId: 'source' },
  ...MERMAID_GENERATOR_SOURCE_PORTS
];

const REQUEST_TEXT_SOURCE_PORTS = [
  { toolId: 'curl-fetch-converter', outputId: 'output', label: 'Create request diagram', description: 'Convert this request output into a Mermaid sequence diagram.' },
  { toolId: 'dataverse-odata-query-builder', outputId: 'output', label: 'Create Dataverse diagram', description: 'Convert this Dataverse endpoint or fetch snippet into a Mermaid sequence diagram.' },
  { toolId: 'power-pages-web-api-snippets', outputId: 'output', label: 'Create Web API diagram', description: 'Convert this Power Pages Web API snippet into a Mermaid sequence diagram.' }
];

const TEXT_HANDOVER_ROUTES = [
  createTextRoute('support-pack-sanitiser', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('support-pack-sanitiser', 'output', 'markdown-preview-inspector', 'input', 'Preview Markdown', 'Open this output in the Markdown preview and inspector.'),
  createTextRoute('support-pack-sanitiser', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('support-pack-sanitiser', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('support-pack-sanitiser', 'output', 'case-converter', 'input', 'Convert case', 'Use this output as the input for the case converter.'),
  createTextRoute('support-pack-sanitiser', 'output', 'html-cleaner-converter', 'input', 'Clean as HTML', 'Use this output as HTML input for the cleaner/converter.'),
  createTextRoute('html-cleaner-converter', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('html-cleaner-converter', 'output', 'markdown-preview-inspector', 'input', 'Preview Markdown', 'Open this output in the Markdown preview and inspector.'),
  createTextRoute('html-cleaner-converter', 'output', 'markdown-table-formatter', 'input', 'Format Markdown tables', 'Open this output in the Markdown table formatter.', 'require-markdown-table'),
  createTextRoute('html-cleaner-converter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('html-cleaner-converter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('html-cleaner-converter', 'output', 'support-pack-sanitiser', 'input', 'Sanitise text', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('csv-tsv-helper', 'text-output', 'markdown-table-formatter', 'input', 'Format Markdown tables', 'Open this output in the Markdown table formatter.', 'require-markdown-table'),
  createTextRoute('markdown-preview-inspector', 'source', 'markdown-table-formatter', 'input', 'Format Markdown tables', 'Open this Markdown source in the table formatter.', 'require-markdown-table'),
  createTextRoute('markdown-table-formatter', 'output', 'markdown-preview-inspector', 'input', 'Preview Markdown', 'Open this output in the Markdown preview and inspector.'),
  createTextRoute('markdown-table-formatter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('markdown-table-formatter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('case-converter', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('case-converter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('case-converter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('curl-fetch-converter', 'output', 'support-pack-sanitiser', 'input', 'Sanitise request', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('curl-fetch-converter', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('curl-fetch-converter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('curl-fetch-converter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('dataverse-odata-query-builder', 'output', 'support-pack-sanitiser', 'input', 'Sanitise query', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('dataverse-odata-query-builder', 'output', 'markdown-preview-inspector', 'input', 'Preview Markdown', 'Open this output in the Markdown preview and inspector.'),
  createTextRoute('dataverse-odata-query-builder', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('dataverse-odata-query-builder', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('power-pages-web-api-snippets', 'output', 'support-pack-sanitiser', 'input', 'Sanitise snippet', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('power-platform-cli-command-builder', 'output', 'support-pack-sanitiser', 'input', 'Sanitise command', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('power-platform-cli-command-builder', 'output', 'markdown-preview-inspector', 'input', 'Preview Markdown', 'Open this output in the Markdown preview and inspector.'),
  createTextRoute('power-platform-cli-command-builder', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('power-platform-cli-command-builder', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('power-platform-solution-mermaid', 'inventory', 'markdown-preview-inspector', 'input', 'Preview inventory', 'Open this generated inventory in the Markdown preview and inspector.'),
  createTextRoute('power-platform-solution-mermaid', 'inventory', 'text-diff', 'left', 'Compare inventory as left text', 'Use this inventory as the left side of a text diff.'),
  createTextRoute('power-platform-solution-mermaid', 'inventory', 'text-diff', 'right', 'Compare inventory as right text', 'Use this inventory as the right side of a text diff.'),
  createTextRoute('power-automate-expression-formatter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('power-automate-expression-formatter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('power-fx-snippet-formatter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('power-fx-snippet-formatter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('support-pack-sanitiser', 'output', 'api-workflow-to-mermaid', 'input', 'Diagram workflow', 'Use this output as step or request input for the API/workflow Mermaid tool.'),
  createTextRoute('curl-fetch-converter', 'output', 'api-workflow-to-mermaid', 'input', 'Diagram request', 'Use this output as request input for the API/workflow Mermaid tool.'),
  createTextRoute('dataverse-odata-query-builder', 'output', 'api-workflow-to-mermaid', 'input', 'Diagram Dataverse call', 'Use this output as request input for the API/workflow Mermaid tool.'),
  createTextRoute('power-pages-web-api-snippets', 'output', 'api-workflow-to-mermaid', 'input', 'Diagram Web API call', 'Use this output as request input for the API/workflow Mermaid tool.'),
  createTextRoute('power-platform-cli-command-builder', 'output', 'api-workflow-to-mermaid', 'input', 'Diagram command steps', 'Use this output as step input for the API/workflow Mermaid tool.'),
  createTextRoute('power-automate-expression-formatter', 'output', 'api-workflow-to-mermaid', 'input', 'Diagram expression steps', 'Use this output as step input for the API/workflow Mermaid tool.'),
  createTextRoute('power-fx-snippet-formatter', 'output', 'api-workflow-to-mermaid', 'input', 'Diagram formula steps', 'Use this output as step input for the API/workflow Mermaid tool.')
];

const GENERIC_JSON_TARGETS = [
  {
    toolId: 'json-formatter',
    inputId: 'input',
    label: 'Format JSON',
    description: 'Open this output in the JSON formatter.'
  },
  {
    toolId: 'json-diff',
    inputId: 'left',
    label: 'Compare as left JSON',
    description: 'Use this output as the left side of a JSON diff.'
  },
  {
    toolId: 'json-diff',
    inputId: 'right',
    label: 'Compare as right JSON',
    description: 'Use this output as the right side of a JSON diff.'
  },
  {
    toolId: 'json-schema-validator',
    inputId: 'json',
    label: 'Validate as JSON data',
    description: 'Use this output as the JSON document to validate.'
  },
  {
    toolId: 'data-explorer',
    inputId: 'input',
    label: 'Explore JSON records',
    description: 'Load this output into the JSON data explorer.'
  }
];

export const TOOL_INTEGRATION_CONTRACTS = [
  {
    toolId: 'base64-to-file',
    outputs: [],
    inputs: [
      {
        id: 'content',
        selector: '#base64Input',
        label: 'Base64 content',
        kind: 'base64'
      }
    ]
  },
  {
    toolId: 'file-to-base64',
    outputs: [
      {
        id: 'output',
        selector: '#base64Output',
        label: 'Base64 output',
        mediaType: 'text/plain',
        kind: 'base64'
      }
    ],
    inputs: []
  },
  {
    toolId: 'mermaid-editor',
    outputs: [
      {
        id: 'source',
        selector: '#mermaidSourceInput',
        label: 'Mermaid source',
        mediaType: 'text/plain',
        kind: 'mermaid'
      }
    ],
    inputs: [
      {
        id: 'source',
        selector: '#mermaidSourceInput',
        label: 'Mermaid source',
        kind: 'mermaid'
      }
    ]
  },
  {
    toolId: 'mermaid-template-builder',
    outputs: [
      {
        id: 'output',
        selector: '#mermaidTemplateOutput',
        label: 'Mermaid output',
        mediaType: 'text/plain',
        kind: 'mermaid'
      }
    ],
    inputs: []
  },
  {
    toolId: 'data-to-mermaid',
    outputs: [
      {
        id: 'output',
        selector: '#dataMermaidOutput',
        label: 'Mermaid output',
        mediaType: 'text/plain',
        kind: 'mermaid'
      }
    ],
    inputs: [
      {
        id: 'json',
        selector: '#dataMermaidInput',
        label: 'JSON input',
        kind: 'json',
        setFields: [
          {
            selector: '#dataMermaidInputFormat',
            value: 'json'
          }
        ]
      },
      {
        id: 'text',
        selector: '#dataMermaidInput',
        label: 'CSV/TSV input',
        kind: 'text',
        setFields: [
          {
            selector: '#dataMermaidInputFormat',
            value: 'csv'
          }
        ]
      }
    ]
  },
  {
    toolId: 'api-workflow-to-mermaid',
    outputs: [
      {
        id: 'output',
        selector: '#apiMermaidOutput',
        label: 'Mermaid output',
        mediaType: 'text/plain',
        kind: 'mermaid'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#apiMermaidInput',
        label: 'Workflow input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'power-platform-solution-mermaid',
    outputs: [
      {
        id: 'mermaid',
        selector: '#solutionMermaidOutput',
        label: 'Selected Mermaid',
        mediaType: 'text/plain',
        kind: 'mermaid'
      },
      {
        id: 'inventory',
        selector: '#solutionMermaidInventoryOutput',
        label: 'Inventory Markdown',
        mediaType: 'text/markdown',
        kind: 'text'
      }
    ],
    inputs: []
  },
  {
    toolId: 'markdown-preview-inspector',
    outputs: [
      {
        id: 'source',
        selector: '#markdownInput',
        label: 'Markdown source',
        mediaType: 'text/markdown',
        kind: 'text'
      },
      {
        id: 'mermaid',
        selector: '#markdownMermaidOutput',
        label: 'First Mermaid block',
        mediaType: 'text/plain',
        kind: 'mermaid'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#markdownInput',
        label: 'Markdown input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'markdown-table-formatter',
    outputs: [
      {
        id: 'output',
        selector: '#markdownTableOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#markdownTableInput',
        label: 'Markdown table input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'json-formatter',
    outputs: [
      {
        id: 'output',
        selector: '#jsonOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#jsonInput',
        label: 'JSON input',
        kind: 'json'
      }
    ]
  },
  {
    toolId: 'json-diff',
    outputs: [
      {
        id: 'output',
        selector: '#jsonDiffOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      }
    ],
    inputs: [
      {
        id: 'left',
        selector: '#jsonDiffLeft',
        label: 'Left JSON',
        kind: 'json'
      },
      {
        id: 'right',
        selector: '#jsonDiffRight',
        label: 'Right JSON',
        kind: 'json'
      }
    ]
  },
  {
    toolId: 'json-schema-validator',
    outputs: [
      {
        id: 'output',
        selector: '#jsonSchemaValidatorOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      }
    ],
    inputs: [
      {
        id: 'json',
        selector: '#jsonSchemaValidatorInput',
        label: 'JSON input',
        kind: 'json'
      },
      {
        id: 'schema',
        selector: '#jsonSchemaValidatorSchema',
        label: 'JSON Schema input',
        kind: 'json-schema'
      }
    ]
  },
  {
    toolId: 'data-explorer',
    outputs: [
      {
        id: 'output',
        selector: '#dataExplorerOutput',
        label: 'JSON output',
        mediaType: 'application/json',
        kind: 'json'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#dataExplorerInput',
        label: 'JSON input',
        kind: 'json',
        setFields: [
          {
            selector: '#dataExplorerFormat',
            value: 'json'
          }
        ]
      },
      {
        id: 'xml',
        selector: '#dataExplorerInput',
        label: 'XML input',
        kind: 'xml',
        setFields: [
          {
            selector: '#dataExplorerFormat',
            value: 'xml'
          }
        ]
      }
    ]
  },
  {
    toolId: 'csv-tsv-helper',
    outputs: [
      {
        id: 'output',
        selector: '#csvOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      },
      {
        id: 'text-output',
        selector: '#csvOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#csvInput',
        label: 'CSV/TSV input',
        kind: 'text',
        setFields: [
          {
            selector: '#csvDelimiter',
            value: 'comma'
          },
          {
            selector: '#csvOutputFormat',
            value: 'csv'
          },
          {
            selector: '#csvFirstRowHeaders',
            value: true
          }
        ]
      }
    ]
  },
  {
    toolId: 'url-codec',
    outputs: [
      {
        id: 'output',
        selector: '#urlOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#urlInput',
        label: 'Input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'regex-tester',
    outputs: [
      {
        id: 'output',
        selector: '#regexOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      }
    ],
    inputs: [
      {
        id: 'text',
        selector: '#regexText',
        label: 'Test text',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'text-diff',
    outputs: [
      {
        id: 'output',
        selector: '#textDiffOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      }
    ],
    inputs: [
      {
        id: 'left',
        selector: '#textDiffLeft',
        label: 'Left text',
        kind: 'text'
      },
      {
        id: 'right',
        selector: '#textDiffRight',
        label: 'Right text',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'jwt-decoder',
    outputs: [
      {
        id: 'header',
        selector: '#jwtHeaderOutput',
        label: 'Decoded header',
        mediaType: 'application/json',
        kind: 'json'
      },
      {
        id: 'payload',
        selector: '#jwtPayloadOutput',
        label: 'Decoded payload',
        mediaType: 'application/json',
        kind: 'json'
      }
    ],
    inputs: []
  },
  {
    toolId: 'pdf-template-field-explorer',
    outputs: [
      {
        id: 'fields-json',
        selector: '#pdfFieldsJsonOutput',
        label: 'Field mapping JSON',
        mediaType: 'application/json',
        kind: 'json'
      }
    ],
    inputs: []
  },
  {
    toolId: 'support-pack-sanitiser',
    outputs: [
      {
        id: 'output',
        selector: '#supportPackOutput',
        label: 'Sanitised output',
        mediaType: 'text/markdown',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#supportPackInput',
        label: 'Support pack input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'html-cleaner-converter',
    outputs: [
      {
        id: 'output',
        selector: '#htmlCleanerOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#htmlCleanerInput',
        label: 'HTML input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'case-converter',
    outputs: [
      {
        id: 'output',
        selector: '#caseOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#caseInput',
        label: 'Text input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'curl-fetch-converter',
    outputs: [
      {
        id: 'output',
        selector: '#curlFetchOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#curlFetchInput',
        label: 'Request input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'dataverse-odata-query-builder',
    outputs: [
      {
        id: 'output',
        selector: '#odataOutput',
        label: 'Output',
        mediaType: 'text/markdown',
        kind: 'text'
      }
    ],
    inputs: []
  },
  {
    toolId: 'power-pages-web-api-snippets',
    outputs: [
      {
        id: 'output',
        selector: '#webApiSnippetOutput',
        label: 'Output',
        mediaType: 'text/javascript',
        kind: 'text'
      }
    ],
    inputs: []
  },
  {
    toolId: 'fetchxml-liquid-builder',
    outputs: [
      {
        id: 'output',
        selector: '#powerPagesOutput',
        label: 'Output',
        mediaType: 'application/xml',
        kind: 'xml'
      },
      {
        id: 'text-output',
        selector: '#powerPagesOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#fetchXmlInput',
        label: 'FetchXML input',
        kind: 'xml'
      }
    ]
  },
  {
    toolId: 'power-platform-cli-command-builder',
    outputs: [
      {
        id: 'output',
        selector: '#pacOutput',
        label: 'Output',
        mediaType: 'text/markdown',
        kind: 'text'
      }
    ],
    inputs: []
  },
  {
    toolId: 'power-automate-expression-formatter',
    outputs: [
      {
        id: 'output',
        selector: '#flowExpressionOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: []
  },
  {
    toolId: 'power-fx-snippet-formatter',
    outputs: [
      {
        id: 'output',
        selector: '#powerFxOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: []
  }
];

export const TOOL_HANDOVER_ROUTES = [
  ...JSON_SOURCE_PORTS.flatMap(source => (
    GENERIC_JSON_TARGETS.map(target => ({
      id: `${source.toolId}-${source.outputId}-to-${target.toolId}-${target.inputId}`,
      sourceToolId: source.toolId,
      sourceOutputId: source.outputId,
      targetToolId: target.toolId,
      targetInputId: target.inputId,
      acceptKinds: ['json', 'json-schema'],
      label: target.label,
      description: target.description,
      setFields: getRouteSetFields(source, target)
    }))
  )),
  ...JSON_SOURCE_PORTS.map(source => ({
    id: `${source.toolId}-${source.outputId}-to-json-schema-validator-schema`,
    sourceToolId: source.toolId,
    sourceOutputId: source.outputId,
    targetToolId: 'json-schema-validator',
    targetInputId: 'schema',
    acceptKinds: ['json-schema'],
    label: 'Use as JSON Schema',
    description: 'Load this output as the schema for JSON validation.'
  })),
  ...JSON_SOURCE_PORTS.map(source => ({
    id: `${source.toolId}-${source.outputId}-to-data-to-mermaid-json`,
    sourceToolId: source.toolId,
    sourceOutputId: source.outputId,
    targetToolId: 'data-to-mermaid',
    targetInputId: 'json',
    acceptKinds: ['json', 'json-schema'],
    label: 'Diagram JSON as Mermaid',
    description: 'Load this JSON into the Data to Mermaid tool.'
  })),
  ...JSON_SOURCE_PORTS.map(source => ({
    id: `${source.toolId}-${source.outputId}-to-mermaid-editor-tree`,
    sourceToolId: source.toolId,
    sourceOutputId: source.outputId,
    targetToolId: 'mermaid-editor',
    targetInputId: 'source',
    acceptKinds: ['mermaid'],
    label: 'Create Mermaid tree',
    description: 'Transform this JSON into a Mermaid tree flowchart.',
    transform: 'json-to-mermaid-tree'
  })),
  ...MERMAID_GENERATOR_SOURCE_PORTS.map(source => ({
    id: `${source.toolId}-${source.outputId}-to-mermaid-editor-source`,
    sourceToolId: source.toolId,
    sourceOutputId: source.outputId,
    targetToolId: 'mermaid-editor',
    targetInputId: 'source',
    acceptKinds: ['mermaid'],
    label: 'Preview and export',
    description: 'Open this Mermaid source in the editor/exporter.'
  })),
  {
    id: 'markdown-preview-inspector-mermaid-to-mermaid-editor-source',
    sourceToolId: 'markdown-preview-inspector',
    sourceOutputId: 'mermaid',
    targetToolId: 'mermaid-editor',
    targetInputId: 'source',
    acceptKinds: ['mermaid'],
    label: 'Preview Mermaid block',
    description: 'Open the first Mermaid code fence in the editor/exporter.'
  },
  ...MERMAID_SOURCE_PORTS.flatMap(source => ([
    {
      id: `${source.toolId}-${source.outputId}-to-text-diff-left-mermaid`,
      sourceToolId: source.toolId,
      sourceOutputId: source.outputId,
      targetToolId: 'text-diff',
      targetInputId: 'left',
      acceptKinds: ['mermaid'],
      label: 'Compare as left text',
      description: 'Use this Mermaid source as the left side of a text diff.'
    },
    {
      id: `${source.toolId}-${source.outputId}-to-text-diff-right-mermaid`,
      sourceToolId: source.toolId,
      sourceOutputId: source.outputId,
      targetToolId: 'text-diff',
      targetInputId: 'right',
      acceptKinds: ['mermaid'],
      label: 'Compare as right text',
      description: 'Use this Mermaid source as the right side of a text diff.'
    }
  ])),
  ...REQUEST_TEXT_SOURCE_PORTS.map(source => ({
    id: `${source.toolId}-${source.outputId}-to-mermaid-editor-sequence`,
    sourceToolId: source.toolId,
    sourceOutputId: source.outputId,
    targetToolId: 'mermaid-editor',
    targetInputId: 'source',
    acceptKinds: ['mermaid'],
    label: source.label,
    description: source.description,
    transform: 'request-to-mermaid-sequence'
  })),
  {
    id: 'dataverse-odata-query-builder-output-to-curl-fetch-converter-input',
    sourceToolId: 'dataverse-odata-query-builder',
    sourceOutputId: 'output',
    targetToolId: 'curl-fetch-converter',
    targetInputId: 'input',
    acceptKinds: ['text'],
    label: 'Convert fetch to cURL',
    description: 'Extract the generated fetch snippet and open it in the cURL/fetch converter.',
    transform: 'extract-fenced-fetch',
    setFields: [
      {
        selector: '#curlFetchMode',
        value: 'fetch-to-curl'
      }
    ]
  },
  {
    id: 'dataverse-odata-query-builder-output-to-url-codec-input',
    sourceToolId: 'dataverse-odata-query-builder',
    sourceOutputId: 'output',
    targetToolId: 'url-codec',
    targetInputId: 'input',
    acceptKinds: ['text'],
    label: 'Inspect endpoint query',
    description: 'Extract the generated endpoint and open it in the URL and query string helper.',
    transform: 'extract-odata-endpoint',
    setFields: [
      {
        selector: '#urlToolMode',
        value: 'parse-query'
      },
      {
        selector: '#urlOutputFormat',
        value: 'json'
      }
    ]
  },
  {
    id: 'power-pages-web-api-snippets-output-to-curl-fetch-converter-input',
    sourceToolId: 'power-pages-web-api-snippets',
    sourceOutputId: 'output',
    targetToolId: 'curl-fetch-converter',
    targetInputId: 'input',
    acceptKinds: ['text'],
    label: 'Convert safeAjax to cURL',
    description: 'Transform the generated safeAjax call into a fetch snippet for the cURL/fetch converter.',
    transform: 'safeajax-to-fetch',
    setFields: [
      {
        selector: '#curlFetchMode',
        value: 'fetch-to-curl'
      }
    ]
  },
  {
    id: 'power-pages-web-api-snippets-output-to-url-codec-input',
    sourceToolId: 'power-pages-web-api-snippets',
    sourceOutputId: 'output',
    targetToolId: 'url-codec',
    targetInputId: 'input',
    acceptKinds: ['text'],
    label: 'Inspect Web API endpoint',
    description: 'Extract the generated Web API endpoint and open it in the URL and query string helper.',
    transform: 'extract-webapi-endpoint',
    setFields: [
      {
        selector: '#urlToolMode',
        value: 'parse-query'
      },
      {
        selector: '#urlOutputFormat',
        value: 'json'
      }
    ]
  },
  {
    id: 'fetchxml-liquid-builder-output-to-data-explorer-xml',
    sourceToolId: 'fetchxml-liquid-builder',
    sourceOutputId: 'output',
    targetToolId: 'data-explorer',
    targetInputId: 'xml',
    acceptKinds: ['xml'],
    label: 'Explore XML data',
    description: 'Load this output into the JSON/XML data explorer.'
  },
  {
    id: 'fetchxml-liquid-builder-text-output-to-data-explorer-xml',
    sourceToolId: 'fetchxml-liquid-builder',
    sourceOutputId: 'text-output',
    targetToolId: 'data-explorer',
    targetInputId: 'xml',
    acceptKinds: ['xml'],
    label: 'Explore embedded FetchXML',
    description: 'Extract the FetchXML from this Liquid block and load it into the JSON/XML data explorer.',
    transform: 'extract-liquid-fetchxml'
  },
  {
    id: 'data-explorer-output-to-text-diff-left',
    sourceToolId: 'data-explorer',
    sourceOutputId: 'output',
    targetToolId: 'text-diff',
    targetInputId: 'left',
    acceptKinds: ['json', 'json-schema'],
    label: 'Compare as left text',
    description: 'Use this JSON output as the left side of a text diff.'
  },
  {
    id: 'data-explorer-output-to-text-diff-right',
    sourceToolId: 'data-explorer',
    sourceOutputId: 'output',
    targetToolId: 'text-diff',
    targetInputId: 'right',
    acceptKinds: ['json', 'json-schema'],
    label: 'Compare as right text',
    description: 'Use this JSON output as the right side of a text diff.'
  },
  {
    id: 'data-explorer-output-to-csv-tsv-helper-input',
    sourceToolId: 'data-explorer',
    sourceOutputId: 'output',
    targetToolId: 'csv-tsv-helper',
    targetInputId: 'input',
    acceptKinds: ['text'],
    label: 'Convert to CSV',
    description: 'Transform this JSON output into CSV input for the CSV/TSV helper.',
    transform: 'json-records-to-csv'
  },
  {
    id: 'markdown-table-formatter-output-to-csv-tsv-helper-input',
    sourceToolId: 'markdown-table-formatter',
    sourceOutputId: 'output',
    targetToolId: 'csv-tsv-helper',
    targetInputId: 'input',
    acceptKinds: ['text'],
    label: 'Inspect as delimited data',
    description: 'Open this CSV or TSV output in the CSV/TSV helper.',
    setFields: [
      {
        selector: '#csvDelimiter',
        value: 'auto'
      },
      {
        selector: '#csvOutputFormat',
        value: 'csv'
      },
      {
        selector: '#csvFirstRowHeaders',
        value: true
      }
    ]
  },
  {
    id: 'markdown-preview-inspector-source-to-text-diff-left',
    sourceToolId: 'markdown-preview-inspector',
    sourceOutputId: 'source',
    targetToolId: 'text-diff',
    targetInputId: 'left',
    acceptKinds: ['text'],
    label: 'Compare as left text',
    description: 'Use this Markdown source as the left side of a text diff.'
  },
  {
    id: 'markdown-preview-inspector-source-to-text-diff-right',
    sourceToolId: 'markdown-preview-inspector',
    sourceOutputId: 'source',
    targetToolId: 'text-diff',
    targetInputId: 'right',
    acceptKinds: ['text'],
    label: 'Compare as right text',
    description: 'Use this Markdown source as the right side of a text diff.'
  },
  {
    id: 'pdf-template-field-explorer-fields-json-to-csv-tsv-helper-input',
    sourceToolId: 'pdf-template-field-explorer',
    sourceOutputId: 'fields-json',
    targetToolId: 'csv-tsv-helper',
    targetInputId: 'input',
    acceptKinds: ['text'],
    label: 'Convert fields to CSV',
    description: 'Transform the exported field mapping into CSV input for the CSV/TSV helper.',
    transform: 'pdf-fields-to-csv'
  },
  ...TEXT_HANDOVER_ROUTES,
  {
    id: 'file-to-base64-output-to-base64-to-file-content',
    sourceToolId: 'file-to-base64',
    sourceOutputId: 'output',
    targetToolId: 'base64-to-file',
    targetInputId: 'content',
    acceptKinds: ['base64'],
    label: 'Create file',
    description: 'Open this Base64 output in the file creator.'
  }
];

function createTextRoute(sourceToolId, sourceOutputId, targetToolId, targetInputId, label, description, transform = '') {
  return {
    id: `${sourceToolId}-${sourceOutputId}-to-${targetToolId}-${targetInputId}`,
    sourceToolId,
    sourceOutputId,
    targetToolId,
    targetInputId,
    acceptKinds: ['text'],
    label,
    description,
    ...(transform ? { transform } : {})
  };
}

function getRouteSetFields(source, target) {
  if (target.toolId !== 'data-explorer' || target.inputId !== 'input') {
    return [];
  }

  if (source.toolId === 'regex-tester') {
    return [
      {
        selector: '#dataExplorerRecordPath',
        value: 'matches'
      }
    ];
  }

  if (source.toolId === 'text-diff') {
    return [
      {
        selector: '#dataExplorerRecordPath',
        value: 'rows'
      }
    ];
  }

  if (source.toolId === 'json-diff') {
    return [
      {
        selector: '#dataExplorerRecordPath',
        value: 'changes'
      }
    ];
  }

  if (source.toolId === 'pdf-template-field-explorer') {
    return [
      {
        selector: '#dataExplorerRecordPath',
        value: 'fields'
      }
    ];
  }

  return [];
}
