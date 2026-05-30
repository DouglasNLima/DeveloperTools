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
  { toolId: 'jwt-decoder', outputId: 'payload' }
];

const TEXT_HANDOVER_ROUTES = [
  createTextRoute('support-pack-sanitiser', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('support-pack-sanitiser', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('support-pack-sanitiser', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('support-pack-sanitiser', 'output', 'case-converter', 'input', 'Convert case', 'Use this output as the input for the case converter.'),
  createTextRoute('support-pack-sanitiser', 'output', 'html-cleaner-converter', 'input', 'Clean as HTML', 'Use this output as HTML input for the cleaner/converter.'),
  createTextRoute('html-cleaner-converter', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('html-cleaner-converter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('html-cleaner-converter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('html-cleaner-converter', 'output', 'support-pack-sanitiser', 'input', 'Sanitise text', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('case-converter', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('case-converter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('case-converter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.')
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
        label: 'JSON or XML input',
        kind: 'json',
        setFields: [
          {
            selector: '#dataExplorerFormat',
            value: 'json'
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
      }
    ],
    inputs: []
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
    inputs: []
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

function createTextRoute(sourceToolId, sourceOutputId, targetToolId, targetInputId, label, description) {
  return {
    id: `${sourceToolId}-${sourceOutputId}-to-${targetToolId}-${targetInputId}`,
    sourceToolId,
    sourceOutputId,
    targetToolId,
    targetInputId,
    acceptKinds: ['text'],
    label,
    description
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

  return [];
}
