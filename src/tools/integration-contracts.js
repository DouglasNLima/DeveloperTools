const JSON_SOURCE_PORTS = [
  { toolId: 'json-formatter', outputId: 'output' },
  { toolId: 'json-diff', outputId: 'output' },
  { toolId: 'json-schema-validator', outputId: 'output' },
  { toolId: 'data-explorer', outputId: 'output' },
  { toolId: 'csv-tsv-helper', outputId: 'output' },
  { toolId: 'jwt-decoder', outputId: 'payload' }
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
    toolId: 'jwt-decoder',
    outputs: [
      {
        id: 'payload',
        selector: '#jwtPayloadOutput',
        label: 'Decoded payload',
        mediaType: 'application/json',
        kind: 'json'
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
      description: target.description
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
  }))
];
