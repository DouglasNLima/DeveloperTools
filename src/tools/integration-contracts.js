const JSON_SOURCE_PORTS = [
  { toolId: 'json-data-workbench', outputId: 'output' },
  { toolId: 'json-data-workbench', outputId: 'diff-output' },
  { toolId: 'json-data-workbench', outputId: 'validation-output' },
  { toolId: 'json-data-workbench', outputId: 'explorer-output' },
  { toolId: 'json-formatter', outputId: 'output' },
  { toolId: 'json-diff', outputId: 'output' },
  { toolId: 'json-schema-validator', outputId: 'output' },
  { toolId: 'data-explorer', outputId: 'output' },
  { toolId: 'csv-tsv-helper', outputId: 'output' },
  { toolId: 'url-codec', outputId: 'output' },
  { toolId: 'text-utilities-workbench', outputId: 'regex-output' },
  { toolId: 'text-utilities-workbench', outputId: 'diff-output' },
  { toolId: 'regex-tester', outputId: 'output' },
  { toolId: 'text-diff', outputId: 'output' },
  { toolId: 'web-api-workbench', outputId: 'jwt-header' },
  { toolId: 'web-api-workbench', outputId: 'jwt-payload' },
  { toolId: 'jwt-decoder', outputId: 'header' },
  { toolId: 'jwt-decoder', outputId: 'payload' },
  { toolId: 'pdf-template-field-explorer', outputId: 'fields-json' },
  { toolId: 'model-driven-javascript-workbench', outputId: 'review-rule-summary' },
  { toolId: 'model-driven-javascript-reviewer', outputId: 'rule-summary' }
];

const MERMAID_GENERATOR_SOURCE_PORTS = [
  { toolId: 'mermaid-studio', outputId: 'template-output' },
  { toolId: 'mermaid-studio', outputId: 'data-output' },
  { toolId: 'mermaid-studio', outputId: 'api-output' },
  { toolId: 'mermaid-template-builder', outputId: 'output' },
  { toolId: 'data-to-mermaid', outputId: 'output' },
  { toolId: 'api-workflow-to-mermaid', outputId: 'output' },
  { toolId: 'solution-package-inspector', outputId: 'mermaid' },
  { toolId: 'power-platform-solution-mermaid', outputId: 'mermaid' },
  { toolId: 'model-driven-solution-inspector', outputId: 'mermaid' },
  { toolId: 'web-resource-dependency-mapper', outputId: 'mermaid' }
];

const MERMAID_SOURCE_PORTS = [
  { toolId: 'mermaid-studio', outputId: 'source' },
  { toolId: 'mermaid-editor', outputId: 'source' },
  { toolId: 'markdown-workbench', outputId: 'mermaid' },
  ...MERMAID_GENERATOR_SOURCE_PORTS
];

const REQUEST_TEXT_SOURCE_PORTS = [
  { toolId: 'web-api-workbench', outputId: 'request-output', label: 'Create request diagram', description: 'Convert this request output into a Mermaid sequence diagram.' },
  { toolId: 'curl-fetch-converter', outputId: 'output', label: 'Create request diagram', description: 'Convert this request output into a Mermaid sequence diagram.' },
  { toolId: 'dataverse-odata-query-builder', outputId: 'output', label: 'Create Dataverse diagram', description: 'Convert this Dataverse endpoint or fetch snippet into a Mermaid sequence diagram.' },
  { toolId: 'power-pages-workbench', outputId: 'web-api-output', label: 'Create Web API diagram', description: 'Convert this Power Pages Web API snippet into a Mermaid sequence diagram.' },
  { toolId: 'power-pages-web-api-snippets', outputId: 'output', label: 'Create Web API diagram', description: 'Convert this Power Pages Web API snippet into a Mermaid sequence diagram.' }
];

const TEXT_HANDOVER_ROUTES = [
  createTextRoute('image-ocr', 'output', 'support-pack-sanitiser', 'input', 'Sanitise text', 'Use this OCR text as input for the support pack sanitiser.'),
  createTextRoute('image-ocr', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this OCR text as the test text for the regex tester.'),
  createTextRoute('image-ocr', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this OCR text as the left side of a text diff.'),
  createTextRoute('image-ocr', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this OCR text as the right side of a text diff.'),
  createTextRoute('support-pack-sanitiser', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('support-pack-sanitiser', 'output', 'markdown-workbench', 'input', 'Preview Markdown', 'Open this output in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('support-pack-sanitiser', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('support-pack-sanitiser', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('support-pack-sanitiser', 'output', 'case-converter', 'input', 'Convert case', 'Use this output as the input for the case converter.'),
  createTextRoute('support-pack-sanitiser', 'output', 'html-cleaner-converter', 'input', 'Clean as HTML', 'Use this output as HTML input for the cleaner/converter.'),
  createTextRoute('html-cleaner-converter', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('html-cleaner-converter', 'output', 'markdown-workbench', 'input', 'Preview Markdown', 'Open this output in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('html-cleaner-converter', 'output', 'markdown-workbench', 'table-input', 'Format Markdown tables', 'Open this output in the Markdown Workbench table mode.', 'require-markdown-table', 'tables'),
  createTextRoute('html-cleaner-converter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('html-cleaner-converter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('html-cleaner-converter', 'output', 'support-pack-sanitiser', 'input', 'Sanitise text', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('csv-tsv-helper', 'text-output', 'markdown-workbench', 'table-input', 'Format Markdown tables', 'Open this output in the Markdown Workbench table mode.', 'require-markdown-table', 'tables'),
  createTextRoute('markdown-preview-inspector', 'source', 'markdown-table-formatter', 'input', 'Format Markdown tables', 'Open this Markdown source in the table formatter.', 'require-markdown-table'),
  createTextRoute('markdown-table-formatter', 'output', 'markdown-preview-inspector', 'input', 'Preview Markdown', 'Open this output in the Markdown preview and inspector.'),
  createTextRoute('markdown-table-formatter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('markdown-table-formatter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('markdown-workbench', 'source', 'markdown-workbench', 'table-input', 'Format Markdown tables', 'Open this Markdown source in the Markdown Workbench table mode.', 'require-markdown-table', 'tables'),
  createTextRoute('markdown-workbench', 'source', 'text-diff', 'left', 'Compare as left text', 'Use this Markdown source as the left side of a text diff.'),
  createTextRoute('markdown-workbench', 'source', 'text-diff', 'right', 'Compare as right text', 'Use this Markdown source as the right side of a text diff.'),
  createTextRoute('markdown-workbench', 'table-output', 'markdown-workbench', 'input', 'Preview Markdown', 'Open this output in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('markdown-workbench', 'table-output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('markdown-workbench', 'table-output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('case-converter', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('case-converter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('case-converter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('web-api-workbench', 'request-output', 'support-pack-sanitiser', 'input', 'Sanitise request', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('web-api-workbench', 'request-output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('web-api-workbench', 'request-output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('web-api-workbench', 'request-output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('curl-fetch-converter', 'output', 'support-pack-sanitiser', 'input', 'Sanitise request', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('curl-fetch-converter', 'output', 'regex-tester', 'text', 'Test with regex', 'Use this output as the test text for the regex tester.'),
  createTextRoute('curl-fetch-converter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('curl-fetch-converter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('dataverse-odata-query-builder', 'output', 'support-pack-sanitiser', 'input', 'Sanitise query', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('dataverse-odata-query-builder', 'output', 'markdown-workbench', 'input', 'Preview Markdown', 'Open this output in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('dataverse-odata-query-builder', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('dataverse-odata-query-builder', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('power-pages-workbench', 'web-api-output', 'support-pack-sanitiser', 'input', 'Sanitise snippet', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('power-pages-web-api-snippets', 'output', 'support-pack-sanitiser', 'input', 'Sanitise snippet', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('power-platform-cli-command-builder', 'output', 'support-pack-sanitiser', 'input', 'Sanitise command', 'Use this output as input for the support pack sanitiser.'),
  createTextRoute('power-platform-cli-command-builder', 'output', 'markdown-workbench', 'input', 'Preview Markdown', 'Open this output in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('power-platform-cli-command-builder', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('power-platform-cli-command-builder', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('solution-package-inspector', 'inventory', 'markdown-workbench', 'input', 'Preview inventory', 'Open this generated inventory in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('solution-package-inspector', 'inventory', 'text-diff', 'left', 'Compare inventory as left text', 'Use this inventory as the left side of a text diff.'),
  createTextRoute('solution-package-inspector', 'inventory', 'text-diff', 'right', 'Compare inventory as right text', 'Use this inventory as the right side of a text diff.'),
  createTextRoute('solution-package-inspector', 'preflight', 'markdown-workbench', 'input', 'Preview preflight report', 'Open this generated preflight report in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('solution-package-inspector', 'preflight', 'text-diff', 'left', 'Compare preflight as left text', 'Use this preflight report as the left side of a text diff.'),
  createTextRoute('solution-package-inspector', 'preflight', 'text-diff', 'right', 'Compare preflight as right text', 'Use this preflight report as the right side of a text diff.'),
  createTextRoute('solution-package-inspector', 'documentation', 'markdown-workbench', 'input', 'Preview documentation', 'Open this generated documentation in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('solution-package-inspector', 'documentation', 'text-diff', 'left', 'Compare documentation as left text', 'Use this documentation as the left side of a text diff.'),
  createTextRoute('solution-package-inspector', 'documentation', 'text-diff', 'right', 'Compare documentation as right text', 'Use this documentation as the right side of a text diff.'),
  createTextRoute('power-platform-solution-mermaid', 'inventory', 'markdown-workbench', 'input', 'Preview inventory', 'Open this generated inventory in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('power-platform-solution-mermaid', 'inventory', 'text-diff', 'left', 'Compare inventory as left text', 'Use this inventory as the left side of a text diff.'),
  createTextRoute('power-platform-solution-mermaid', 'inventory', 'text-diff', 'right', 'Compare inventory as right text', 'Use this inventory as the right side of a text diff.'),
  createTextRoute('power-platform-solution-import-preflight', 'preflight', 'markdown-workbench', 'input', 'Preview preflight report', 'Open this generated preflight report in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('power-platform-solution-import-preflight', 'preflight', 'text-diff', 'left', 'Compare preflight as left text', 'Use this preflight report as the left side of a text diff.'),
  createTextRoute('power-platform-solution-import-preflight', 'preflight', 'text-diff', 'right', 'Compare preflight as right text', 'Use this preflight report as the right side of a text diff.'),
  createTextRoute('power-platform-solution-docs', 'documentation', 'markdown-workbench', 'input', 'Preview documentation', 'Open this generated documentation in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('power-platform-solution-docs', 'documentation', 'text-diff', 'left', 'Compare documentation as left text', 'Use this documentation as the left side of a text diff.'),
  createTextRoute('power-platform-solution-docs', 'documentation', 'text-diff', 'right', 'Compare documentation as right text', 'Use this documentation as the right side of a text diff.'),
  createTextRoute('power-automate-expression-formatter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('power-automate-expression-formatter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('power-fx-snippet-formatter', 'output', 'text-diff', 'left', 'Compare as left text', 'Use this output as the left side of a text diff.'),
  createTextRoute('power-fx-snippet-formatter', 'output', 'text-diff', 'right', 'Compare as right text', 'Use this output as the right side of a text diff.'),
  createTextRoute('model-driven-javascript-workbench', 'review-report', 'markdown-workbench', 'input', 'Preview review', 'Open this model-driven JavaScript review in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('model-driven-javascript-workbench', 'review-report', 'support-pack-sanitiser', 'input', 'Sanitise review', 'Use this review as input for the support pack sanitiser.'),
  createTextRoute('model-driven-javascript-workbench', 'migration-report', 'markdown-workbench', 'input', 'Preview migration report', 'Open this migration report in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('model-driven-javascript-workbench', 'migration-report', 'text-diff', 'left', 'Compare migration as left text', 'Use this migration report as the left side of a text diff.'),
  createTextRoute('model-driven-javascript-workbench', 'migration-report', 'text-diff', 'right', 'Compare migration as right text', 'Use this migration report as the right side of a text diff.'),
  createTextRoute('model-driven-javascript-workbench', 'form-event-output', 'text-diff', 'left', 'Compare handler as left text', 'Use this handler output as the left side of a text diff.'),
  createTextRoute('model-driven-javascript-workbench', 'form-event-output', 'text-diff', 'right', 'Compare handler as right text', 'Use this handler output as the right side of a text diff.'),
  createTextRoute('model-driven-javascript-workbench', 'web-api-output', 'support-pack-sanitiser', 'input', 'Sanitise snippet', 'Use this Xrm.WebApi snippet as input for the support pack sanitiser.'),
  createTextRoute('model-driven-javascript-workbench', 'web-api-output', 'mermaid-studio', 'input', 'Diagram Web API call', 'Use this Xrm.WebApi snippet in Mermaid Studio API/workflow mode.', '', 'api-workflow'),
  createTextRoute('model-driven-javascript-workbench', 'validation-output', 'text-diff', 'left', 'Compare validation as left text', 'Use this validation output as the left side of a text diff.'),
  createTextRoute('model-driven-javascript-workbench', 'validation-output', 'text-diff', 'right', 'Compare validation as right text', 'Use this validation output as the right side of a text diff.'),
  createTextRoute('model-driven-javascript-workbench', 'command-output', 'support-pack-sanitiser', 'input', 'Sanitise command handler', 'Use this command handler as input for the support pack sanitiser.'),
  createTextRoute('model-driven-javascript-reviewer', 'report', 'markdown-workbench', 'input', 'Preview review', 'Open this model-driven JavaScript review in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('model-driven-javascript-reviewer', 'report', 'support-pack-sanitiser', 'input', 'Sanitise review', 'Use this review as input for the support pack sanitiser.'),
  createTextRoute('client-api-migration-helper', 'report', 'markdown-workbench', 'input', 'Preview migration report', 'Open this migration report in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('client-api-migration-helper', 'report', 'text-diff', 'left', 'Compare migration as left text', 'Use this migration report as the left side of a text diff.'),
  createTextRoute('client-api-migration-helper', 'report', 'text-diff', 'right', 'Compare migration as right text', 'Use this migration report as the right side of a text diff.'),
  createTextRoute('form-event-handler-builder', 'output', 'text-diff', 'left', 'Compare handler as left text', 'Use this handler output as the left side of a text diff.'),
  createTextRoute('form-event-handler-builder', 'output', 'text-diff', 'right', 'Compare handler as right text', 'Use this handler output as the right side of a text diff.'),
  createTextRoute('xrm-webapi-snippet-builder', 'output', 'support-pack-sanitiser', 'input', 'Sanitise snippet', 'Use this Xrm.WebApi snippet as input for the support pack sanitiser.'),
  createTextRoute('xrm-webapi-snippet-builder', 'output', 'mermaid-studio', 'input', 'Diagram Web API call', 'Use this Xrm.WebApi snippet in Mermaid Studio API/workflow mode.', '', 'api-workflow'),
  createTextRoute('form-notification-validation-builder', 'output', 'text-diff', 'left', 'Compare validation as left text', 'Use this validation output as the left side of a text diff.'),
  createTextRoute('form-notification-validation-builder', 'output', 'text-diff', 'right', 'Compare validation as right text', 'Use this validation output as the right side of a text diff.'),
  createTextRoute('command-bar-javascript-builder', 'output', 'support-pack-sanitiser', 'input', 'Sanitise command handler', 'Use this command handler as input for the support pack sanitiser.'),
  createTextRoute('model-driven-solution-inspector', 'events', 'markdown-workbench', 'input', 'Preview event report', 'Open this JavaScript event report in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('model-driven-solution-inspector', 'events', 'text-diff', 'left', 'Compare event report as left text', 'Use this event report as the left side of a text diff.'),
  createTextRoute('model-driven-solution-inspector', 'events', 'text-diff', 'right', 'Compare event report as right text', 'Use this event report as the right side of a text diff.'),
  createTextRoute('model-driven-solution-inspector', 'dependency-report', 'markdown-workbench', 'input', 'Preview dependency report', 'Open this dependency report in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('model-driven-solution-inspector', 'dependency-report', 'text-diff', 'left', 'Compare dependency report as left text', 'Use this dependency report as the left side of a text diff.'),
  createTextRoute('model-driven-solution-inspector', 'dependency-report', 'text-diff', 'right', 'Compare dependency report as right text', 'Use this dependency report as the right side of a text diff.'),
  createTextRoute('solution-javascript-event-inspector', 'events', 'markdown-workbench', 'input', 'Preview event report', 'Open this JavaScript event report in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('solution-javascript-event-inspector', 'events', 'text-diff', 'left', 'Compare event report as left text', 'Use this event report as the left side of a text diff.'),
  createTextRoute('solution-javascript-event-inspector', 'events', 'text-diff', 'right', 'Compare event report as right text', 'Use this event report as the right side of a text diff.'),
  createTextRoute('web-resource-dependency-mapper', 'report', 'markdown-workbench', 'input', 'Preview dependency report', 'Open this dependency report in the Markdown Workbench preview mode.', '', 'preview'),
  createTextRoute('web-resource-dependency-mapper', 'report', 'text-diff', 'left', 'Compare dependency report as left text', 'Use this dependency report as the left side of a text diff.'),
  createTextRoute('web-resource-dependency-mapper', 'report', 'text-diff', 'right', 'Compare dependency report as right text', 'Use this dependency report as the right side of a text diff.'),
  createTextRoute('support-pack-sanitiser', 'output', 'mermaid-studio', 'input', 'Diagram workflow', 'Use this output in Mermaid Studio API/workflow mode.', '', 'api-workflow'),
  createTextRoute('web-api-workbench', 'request-output', 'mermaid-studio', 'input', 'Diagram request', 'Use this output in Mermaid Studio API/workflow mode.', '', 'api-workflow'),
  createTextRoute('curl-fetch-converter', 'output', 'mermaid-studio', 'input', 'Diagram request', 'Use this output in Mermaid Studio API/workflow mode.', '', 'api-workflow'),
  createTextRoute('dataverse-odata-query-builder', 'output', 'mermaid-studio', 'input', 'Diagram Dataverse call', 'Use this output in Mermaid Studio API/workflow mode.', '', 'api-workflow'),
  createTextRoute('power-pages-workbench', 'web-api-output', 'mermaid-studio', 'input', 'Diagram Web API call', 'Use this output in Mermaid Studio API/workflow mode.', '', 'api-workflow'),
  createTextRoute('power-pages-web-api-snippets', 'output', 'mermaid-studio', 'input', 'Diagram Web API call', 'Use this output in Mermaid Studio API/workflow mode.', '', 'api-workflow'),
  createTextRoute('power-platform-cli-command-builder', 'output', 'mermaid-studio', 'input', 'Diagram command steps', 'Use this output in Mermaid Studio API/workflow mode.', '', 'api-workflow'),
  createTextRoute('power-automate-expression-formatter', 'output', 'mermaid-studio', 'input', 'Diagram expression steps', 'Use this output in Mermaid Studio API/workflow mode.', '', 'api-workflow'),
  createTextRoute('power-fx-snippet-formatter', 'output', 'mermaid-studio', 'input', 'Diagram formula steps', 'Use this output in Mermaid Studio API/workflow mode.', '', 'api-workflow')
];

const GENERIC_JSON_TARGETS = [
  {
    toolId: 'json-data-workbench',
    inputId: 'format-input',
    targetMode: 'format',
    label: 'Format JSON',
    description: 'Open this output in JSON & Data Workbench format mode.'
  },
  {
    toolId: 'json-data-workbench',
    inputId: 'diff-left',
    targetMode: 'diff',
    label: 'Compare as left JSON',
    description: 'Use this output as the left side of a JSON comparison.'
  },
  {
    toolId: 'json-data-workbench',
    inputId: 'diff-right',
    targetMode: 'diff',
    label: 'Compare as right JSON',
    description: 'Use this output as the right side of a JSON comparison.'
  },
  {
    toolId: 'json-data-workbench',
    inputId: 'schema-json',
    targetMode: 'schema',
    label: 'Validate as JSON data',
    description: 'Use this output as the JSON document to validate.'
  },
  {
    toolId: 'json-data-workbench',
    inputId: 'explore-input',
    targetMode: 'explore',
    label: 'Explore JSON records',
    description: 'Load this output into JSON & Data Workbench explore mode.'
  }
];

const TEXT_UTILITY_WORKBENCH_TARGETS = {
  'regex-tester:text': {
    inputId: 'regex-text',
    mode: 'regex',
    description: 'Open this output in Text Utilities Workbench regex mode.'
  },
  'support-pack-sanitiser:input': {
    inputId: 'sanitise-input',
    mode: 'sanitise',
    description: 'Open this output in Text Utilities Workbench sanitise mode.'
  },
  'text-diff:left': {
    inputId: 'diff-left',
    mode: 'diff',
    description: 'Use this output as the left side of a Text Utilities Workbench diff.'
  },
  'text-diff:right': {
    inputId: 'diff-right',
    mode: 'diff',
    description: 'Use this output as the right side of a Text Utilities Workbench diff.'
  },
  'case-converter:input': {
    inputId: 'case-input',
    mode: 'case',
    description: 'Open this output in Text Utilities Workbench case mode.'
  }
};

const TEXT_UTILITY_WORKBENCH_SOURCES = {
  'support-pack-sanitiser:output': 'sanitised-output',
  'case-converter:output': 'case-output'
};

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
    toolId: 'base64-file-converter',
    outputs: [
      {
        id: 'output',
        selector: '#base64Output',
        label: 'Base64 output',
        mediaType: 'text/plain',
        kind: 'base64'
      }
    ],
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
    toolId: 'mermaid-studio',
    outputs: [
      {
        id: 'source',
        selector: '#mermaidSourceInput',
        label: 'Mermaid source',
        mediaType: 'text/plain',
        kind: 'mermaid'
      },
      {
        id: 'template-output',
        selector: '#mermaidTemplateOutput',
        label: 'Mermaid output',
        mediaType: 'text/plain',
        kind: 'mermaid'
      },
      {
        id: 'data-output',
        selector: '#dataMermaidOutput',
        label: 'Mermaid output',
        mediaType: 'text/plain',
        kind: 'mermaid'
      },
      {
        id: 'api-output',
        selector: '#apiMermaidOutput',
        label: 'Mermaid output',
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
      },
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
      },
      {
        id: 'input',
        selector: '#apiMermaidInput',
        label: 'Workflow input',
        kind: 'text'
      }
    ]
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
    toolId: 'solution-package-inspector',
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
      },
      {
        id: 'documentation',
        selector: '#solutionDocsOutput',
        label: 'Documentation Markdown',
        mediaType: 'text/markdown',
        kind: 'text'
      },
      {
        id: 'preflight',
        selector: '#solutionImportPreflightOutput',
        label: 'Preflight Markdown',
        mediaType: 'text/markdown',
        kind: 'text'
      }
    ],
    inputs: []
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
    toolId: 'power-platform-solution-docs',
    outputs: [
      {
        id: 'documentation',
        selector: '#solutionDocsOutput',
        label: 'Documentation Markdown',
        mediaType: 'text/markdown',
        kind: 'text'
      }
    ],
    inputs: []
  },
  {
    toolId: 'power-platform-solution-import-preflight',
    outputs: [
      {
        id: 'preflight',
        selector: '#solutionImportPreflightOutput',
        label: 'Preflight Markdown',
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
    toolId: 'markdown-workbench',
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
      },
      {
        id: 'table-output',
        selector: '#markdownTableOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'input',
        selector: '#markdownInput',
        label: 'Markdown input',
        kind: 'text'
      },
      {
        id: 'table-input',
        selector: '#markdownTableInput',
        label: 'Markdown table input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'json-data-workbench',
    outputs: [
      {
        id: 'output',
        selector: '#jsonOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      },
      {
        id: 'diff-output',
        selector: '#jsonDiffOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      },
      {
        id: 'validation-output',
        selector: '#jsonSchemaValidatorOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      },
      {
        id: 'explorer-output',
        selector: '#dataExplorerOutput',
        label: 'JSON output',
        mediaType: 'application/json',
        kind: 'json'
      }
    ],
    inputs: [
      {
        id: 'format-input',
        selector: '#jsonInput',
        label: 'JSON input',
        kind: 'json'
      },
      {
        id: 'diff-left',
        selector: '#jsonDiffLeft',
        label: 'Left JSON',
        kind: 'json'
      },
      {
        id: 'diff-right',
        selector: '#jsonDiffRight',
        label: 'Right JSON',
        kind: 'json'
      },
      {
        id: 'schema-json',
        selector: '#jsonSchemaValidatorInput',
        label: 'JSON input',
        kind: 'json'
      },
      {
        id: 'schema',
        selector: '#jsonSchemaValidatorSchema',
        label: 'JSON Schema input',
        kind: 'json-schema'
      },
      {
        id: 'explore-input',
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
        id: 'explore-xml',
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
    toolId: 'text-utilities-workbench',
    outputs: [
      {
        id: 'regex-output',
        selector: '#regexOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      },
      {
        id: 'sql-output',
        selector: '#sqlOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      },
      {
        id: 'sanitised-output',
        selector: '#supportPackOutput',
        label: 'Sanitised output',
        mediaType: 'text/markdown',
        kind: 'text'
      },
      {
        id: 'diff-output',
        selector: '#textDiffOutput',
        label: 'Output',
        mediaType: 'application/json',
        kind: 'json'
      },
      {
        id: 'case-output',
        selector: '#caseOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      },
      {
        id: 'uuid-output',
        selector: '#uuidOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'regex-text',
        selector: '#regexText',
        label: 'Test text',
        kind: 'text'
      },
      {
        id: 'sql-input',
        selector: '#sqlInput',
        label: 'SQL input',
        kind: 'text'
      },
      {
        id: 'sanitise-input',
        selector: '#supportPackInput',
        label: 'Support pack input',
        kind: 'text'
      },
      {
        id: 'diff-left',
        selector: '#textDiffLeft',
        label: 'Left text',
        kind: 'text'
      },
      {
        id: 'diff-right',
        selector: '#textDiffRight',
        label: 'Right text',
        kind: 'text'
      },
      {
        id: 'case-input',
        selector: '#caseInput',
        label: 'Text input',
        kind: 'text'
      },
      {
        id: 'uuid-input',
        selector: '#uuidInput',
        label: 'UUID input',
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
    toolId: 'web-api-workbench',
    outputs: [
      {
        id: 'jwt-header',
        selector: '#jwtHeaderOutput',
        label: 'Decoded header',
        mediaType: 'application/json',
        kind: 'json'
      },
      {
        id: 'jwt-payload',
        selector: '#jwtPayloadOutput',
        label: 'Decoded payload',
        mediaType: 'application/json',
        kind: 'json'
      },
      {
        id: 'schedule-output',
        selector: '#scheduleOutput',
        label: 'Schedule output',
        mediaType: 'text/markdown',
        kind: 'text'
      },
      {
        id: 'request-output',
        selector: '#curlFetchOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'jwt',
        selector: '#jwtInput',
        label: 'JWT input',
        kind: 'text'
      },
      {
        id: 'request',
        selector: '#curlFetchInput',
        label: 'Request input',
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
    toolId: 'image-ocr',
    outputs: [
      {
        id: 'output',
        selector: '#imageOcrOutput',
        label: 'OCR text',
        mediaType: 'text/plain',
        kind: 'text'
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
    toolId: 'power-pages-workbench',
    outputs: [
      {
        id: 'fetchxml-output',
        selector: '#powerPagesOutput',
        label: 'Output',
        mediaType: 'application/xml',
        kind: 'xml'
      },
      {
        id: 'fetchxml-text-output',
        selector: '#powerPagesOutput',
        label: 'Output',
        mediaType: 'text/plain',
        kind: 'text'
      },
      {
        id: 'web-api-output',
        selector: '#webApiSnippetOutput',
        label: 'Output',
        mediaType: 'text/javascript',
        kind: 'text'
      },
      {
        id: 'site-settings-output',
        selector: '#siteSettingsOutput',
        label: 'Output',
        mediaType: 'text/markdown',
        kind: 'text'
      },
      {
        id: 'table-permissions-output',
        selector: '#tablePermissionOutput',
        label: 'Output',
        mediaType: 'text/markdown',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'fetchxml-input',
        selector: '#fetchXmlInput',
        label: 'FetchXML input',
        kind: 'xml'
      }
    ]
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
  },
  {
    toolId: 'model-driven-javascript-workbench',
    outputs: [
      {
        id: 'review-report',
        selector: '#modelDrivenJsReviewOutput',
        label: 'Review report',
        mediaType: 'text/markdown',
        kind: 'text'
      },
      {
        id: 'review-rule-summary',
        selector: '#modelDrivenJsReviewOutput',
        label: 'Rule summary JSON',
        mediaType: 'application/json',
        kind: 'json'
      },
      {
        id: 'migration-report',
        selector: '#clientApiMigrationOutput',
        label: 'Migration report',
        mediaType: 'text/markdown',
        kind: 'text'
      },
      {
        id: 'form-event-output',
        selector: '#formEventHandlerOutput',
        label: 'Generated handler',
        mediaType: 'text/plain',
        kind: 'text'
      },
      {
        id: 'web-api-output',
        selector: '#xrmWebApiSnippetOutput',
        label: 'Generated snippet',
        mediaType: 'text/plain',
        kind: 'text'
      },
      {
        id: 'validation-output',
        selector: '#formValidationOutput',
        label: 'Generated validation',
        mediaType: 'text/plain',
        kind: 'text'
      },
      {
        id: 'command-output',
        selector: '#commandBarJavascriptOutput',
        label: 'Generated command handler',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'review-source',
        selector: '#modelDrivenJsReviewInput',
        label: 'JavaScript input',
        kind: 'text'
      },
      {
        id: 'migration-source',
        selector: '#clientApiMigrationInput',
        label: 'Legacy JavaScript input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'model-driven-javascript-reviewer',
    outputs: [
      {
        id: 'report',
        selector: '#modelDrivenJsReviewOutput',
        label: 'Review report',
        mediaType: 'text/markdown',
        kind: 'text'
      },
      {
        id: 'rule-summary',
        selector: '#modelDrivenJsReviewOutput',
        label: 'Rule summary JSON',
        mediaType: 'application/json',
        kind: 'json'
      }
    ],
    inputs: [
      {
        id: 'source',
        selector: '#modelDrivenJsReviewInput',
        label: 'JavaScript input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'client-api-migration-helper',
    outputs: [
      {
        id: 'report',
        selector: '#clientApiMigrationOutput',
        label: 'Migration report',
        mediaType: 'text/markdown',
        kind: 'text'
      }
    ],
    inputs: [
      {
        id: 'source',
        selector: '#clientApiMigrationInput',
        label: 'Legacy JavaScript input',
        kind: 'text'
      }
    ]
  },
  {
    toolId: 'form-event-handler-builder',
    outputs: [
      {
        id: 'output',
        selector: '#formEventHandlerOutput',
        label: 'Generated handler',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: []
  },
  {
    toolId: 'xrm-webapi-snippet-builder',
    outputs: [
      {
        id: 'output',
        selector: '#xrmWebApiSnippetOutput',
        label: 'Generated snippet',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: []
  },
  {
    toolId: 'form-notification-validation-builder',
    outputs: [
      {
        id: 'output',
        selector: '#formValidationOutput',
        label: 'Generated validation',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: []
  },
  {
    toolId: 'command-bar-javascript-builder',
    outputs: [
      {
        id: 'output',
        selector: '#commandBarJavascriptOutput',
        label: 'Generated command handler',
        mediaType: 'text/plain',
        kind: 'text'
      }
    ],
    inputs: []
  },
  {
    toolId: 'model-driven-solution-inspector',
    outputs: [
      {
        id: 'events',
        selector: '#solutionJavascriptEventsOutput',
        label: 'JavaScript event report',
        mediaType: 'text/markdown',
        kind: 'text'
      },
      {
        id: 'dependency-report',
        selector: '#webResourceDependencyMapOutput',
        label: 'Dependency report',
        mediaType: 'text/markdown',
        kind: 'text'
      },
      {
        id: 'mermaid',
        selector: '#webResourceDependencyMermaidOutput',
        label: 'Mermaid diagram',
        mediaType: 'text/plain',
        kind: 'mermaid'
      }
    ],
    inputs: []
  },
  {
    toolId: 'solution-javascript-event-inspector',
    outputs: [
      {
        id: 'events',
        selector: '#solutionJavascriptEventsOutput',
        label: 'JavaScript event report',
        mediaType: 'text/markdown',
        kind: 'text'
      }
    ],
    inputs: []
  },
  {
    toolId: 'web-resource-dependency-mapper',
    outputs: [
      {
        id: 'report',
        selector: '#webResourceDependencyMapOutput',
        label: 'Dependency report',
        mediaType: 'text/markdown',
        kind: 'text'
      },
      {
        id: 'mermaid',
        selector: '#webResourceDependencyMermaidOutput',
        label: 'Mermaid diagram',
        mediaType: 'text/plain',
        kind: 'mermaid'
      }
    ],
    inputs: []
  }
];

const BASE_TOOL_HANDOVER_ROUTES = [
  ...JSON_SOURCE_PORTS.flatMap(source => (
    GENERIC_JSON_TARGETS
      .filter(target => !shouldSkipGenericJsonRoute(source, target))
      .map(target => ({
        id: `${source.toolId}-${source.outputId}-to-${target.toolId}-${target.inputId}`,
        sourceToolId: source.toolId,
        sourceOutputId: source.outputId,
        targetToolId: target.toolId,
        targetInputId: target.inputId,
        targetMode: target.targetMode,
        acceptKinds: ['json', 'json-schema'],
        label: target.label,
        description: target.description,
        setFields: getRouteSetFields(source, target)
      }))
  )),
  ...JSON_SOURCE_PORTS.map(source => ({
    id: `${source.toolId}-${source.outputId}-to-json-data-workbench-schema`,
    sourceToolId: source.toolId,
    sourceOutputId: source.outputId,
    targetToolId: 'json-data-workbench',
    targetInputId: 'schema',
    targetMode: 'schema',
    acceptKinds: ['json-schema'],
    label: 'Use as JSON Schema',
    description: 'Load this output as the schema for JSON validation.'
  })),
  ...JSON_SOURCE_PORTS.map(source => ({
    id: `${source.toolId}-${source.outputId}-to-mermaid-studio-json`,
    sourceToolId: source.toolId,
    sourceOutputId: source.outputId,
    targetToolId: 'mermaid-studio',
    targetInputId: 'json',
    targetMode: 'data',
    acceptKinds: ['json', 'json-schema'],
    label: 'Diagram JSON as Mermaid',
    description: 'Load this JSON into Mermaid Studio data mode.'
  })),
  ...JSON_SOURCE_PORTS.map(source => ({
    id: `${source.toolId}-${source.outputId}-to-mermaid-studio-tree`,
    sourceToolId: source.toolId,
    sourceOutputId: source.outputId,
    targetToolId: 'mermaid-studio',
    targetInputId: 'source',
    targetMode: 'editor',
    acceptKinds: ['mermaid'],
    label: 'Create Mermaid tree',
    description: 'Transform this JSON into a Mermaid tree flowchart.',
    transform: 'json-to-mermaid-tree'
  })),
  ...MERMAID_GENERATOR_SOURCE_PORTS.map(source => ({
    id: `${source.toolId}-${source.outputId}-to-mermaid-studio-source`,
    sourceToolId: source.toolId,
    sourceOutputId: source.outputId,
    targetToolId: 'mermaid-studio',
    targetInputId: 'source',
    targetMode: 'editor',
    acceptKinds: ['mermaid'],
    label: 'Preview and export',
    description: 'Open this Mermaid source in Mermaid Studio editor mode.'
  })),
  {
    id: 'markdown-preview-inspector-mermaid-to-mermaid-studio-source',
    sourceToolId: 'markdown-preview-inspector',
    sourceOutputId: 'mermaid',
    targetToolId: 'mermaid-studio',
    targetInputId: 'source',
    targetMode: 'editor',
    acceptKinds: ['mermaid'],
    label: 'Preview Mermaid block',
    description: 'Open the first Mermaid code fence in Mermaid Studio editor mode.'
  },
  {
    id: 'markdown-workbench-mermaid-to-mermaid-studio-source',
    sourceToolId: 'markdown-workbench',
    sourceOutputId: 'mermaid',
    targetToolId: 'mermaid-studio',
    targetInputId: 'source',
    targetMode: 'editor',
    acceptKinds: ['mermaid'],
    label: 'Preview Mermaid block',
    description: 'Open the first Mermaid code fence in Mermaid Studio editor mode.'
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
    id: `${source.toolId}-${source.outputId}-to-mermaid-studio-sequence`,
    sourceToolId: source.toolId,
    sourceOutputId: source.outputId,
    targetToolId: 'mermaid-studio',
    targetInputId: 'source',
    targetMode: 'editor',
    acceptKinds: ['mermaid'],
    label: source.label,
    description: source.description,
    transform: 'request-to-mermaid-sequence'
  })),
  {
    id: 'dataverse-odata-query-builder-output-to-web-api-workbench-request',
    sourceToolId: 'dataverse-odata-query-builder',
    sourceOutputId: 'output',
    targetToolId: 'web-api-workbench',
    targetInputId: 'request',
    targetMode: 'request',
    acceptKinds: ['text'],
    label: 'Convert fetch to cURL',
    description: 'Extract the generated fetch snippet and open it in Web/API Workbench request mode.',
    transform: 'extract-fenced-fetch',
    setFields: [
      {
        selector: '#curlFetchMode',
        value: 'fetch-to-curl'
      }
    ]
  },
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
    id: 'power-pages-workbench-web-api-output-to-web-api-workbench-request',
    sourceToolId: 'power-pages-workbench',
    sourceOutputId: 'web-api-output',
    targetToolId: 'web-api-workbench',
    targetInputId: 'request',
    targetMode: 'request',
    acceptKinds: ['text'],
    label: 'Convert safeAjax to cURL',
    description: 'Transform the generated safeAjax call into a fetch snippet for Web/API Workbench request mode.',
    transform: 'safeajax-to-fetch',
    setFields: [
      {
        selector: '#curlFetchMode',
        value: 'fetch-to-curl'
      }
    ]
  },
  {
    id: 'power-pages-workbench-web-api-output-to-curl-fetch-converter-input',
    sourceToolId: 'power-pages-workbench',
    sourceOutputId: 'web-api-output',
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
    id: 'power-pages-web-api-snippets-output-to-web-api-workbench-request',
    sourceToolId: 'power-pages-web-api-snippets',
    sourceOutputId: 'output',
    targetToolId: 'web-api-workbench',
    targetInputId: 'request',
    targetMode: 'request',
    acceptKinds: ['text'],
    label: 'Convert safeAjax to cURL',
    description: 'Transform the generated safeAjax call into a fetch snippet for Web/API Workbench request mode.',
    transform: 'safeajax-to-fetch',
    setFields: [
      {
        selector: '#curlFetchMode',
        value: 'fetch-to-curl'
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
    id: 'power-pages-workbench-web-api-output-to-url-codec-input',
    sourceToolId: 'power-pages-workbench',
    sourceOutputId: 'web-api-output',
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
    id: 'power-pages-workbench-fetchxml-output-to-json-data-workbench-xml',
    sourceToolId: 'power-pages-workbench',
    sourceOutputId: 'fetchxml-output',
    targetToolId: 'json-data-workbench',
    targetInputId: 'explore-xml',
    targetMode: 'explore',
    acceptKinds: ['xml'],
    label: 'Explore XML data',
    description: 'Load this output into JSON & Data Workbench explore mode.'
  },
  {
    id: 'fetchxml-liquid-builder-output-to-data-explorer-xml',
    sourceToolId: 'fetchxml-liquid-builder',
    sourceOutputId: 'output',
    targetToolId: 'json-data-workbench',
    targetInputId: 'explore-xml',
    targetMode: 'explore',
    acceptKinds: ['xml'],
    label: 'Explore XML data',
    description: 'Load this output into JSON & Data Workbench explore mode.'
  },
  {
    id: 'power-pages-workbench-fetchxml-text-output-to-json-data-workbench-xml',
    sourceToolId: 'power-pages-workbench',
    sourceOutputId: 'fetchxml-text-output',
    targetToolId: 'json-data-workbench',
    targetInputId: 'explore-xml',
    targetMode: 'explore',
    acceptKinds: ['xml'],
    label: 'Explore embedded FetchXML',
    description: 'Extract the FetchXML from this Liquid block and load it into JSON & Data Workbench explore mode.',
    transform: 'extract-liquid-fetchxml'
  },
  {
    id: 'fetchxml-liquid-builder-text-output-to-data-explorer-xml',
    sourceToolId: 'fetchxml-liquid-builder',
    sourceOutputId: 'text-output',
    targetToolId: 'json-data-workbench',
    targetInputId: 'explore-xml',
    targetMode: 'explore',
    acceptKinds: ['xml'],
    label: 'Explore embedded FetchXML',
    description: 'Extract the FetchXML from this Liquid block and load it into JSON & Data Workbench explore mode.',
    transform: 'extract-liquid-fetchxml'
  },
  {
    id: 'json-data-workbench-explorer-output-to-text-diff-left',
    sourceToolId: 'json-data-workbench',
    sourceOutputId: 'explorer-output',
    targetToolId: 'text-diff',
    targetInputId: 'left',
    acceptKinds: ['json', 'json-schema'],
    label: 'Compare as left text',
    description: 'Use this JSON output as the left side of a text diff.'
  },
  {
    id: 'json-data-workbench-explorer-output-to-text-diff-right',
    sourceToolId: 'json-data-workbench',
    sourceOutputId: 'explorer-output',
    targetToolId: 'text-diff',
    targetInputId: 'right',
    acceptKinds: ['json', 'json-schema'],
    label: 'Compare as right text',
    description: 'Use this JSON output as the right side of a text diff.'
  },
  {
    id: 'json-data-workbench-explorer-output-to-csv-tsv-helper-input',
    sourceToolId: 'json-data-workbench',
    sourceOutputId: 'explorer-output',
    targetToolId: 'csv-tsv-helper',
    targetInputId: 'input',
    acceptKinds: ['text'],
    label: 'Convert to CSV',
    description: 'Transform this JSON output into CSV input for the CSV/TSV helper.',
    transform: 'json-records-to-csv'
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
    id: 'markdown-workbench-table-output-to-csv-tsv-helper-input',
    sourceToolId: 'markdown-workbench',
    sourceOutputId: 'table-output',
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
  },
  {
    id: 'base64-file-converter-output-to-base64-file-converter-content',
    sourceToolId: 'base64-file-converter',
    sourceOutputId: 'output',
    targetToolId: 'base64-file-converter',
    targetMode: 'base64-to-file',
    targetInputId: 'content',
    acceptKinds: ['base64'],
    label: 'Create file',
    description: 'Open this Base64 output in the file creator.'
  }
];

export const TOOL_HANDOVER_ROUTES = [
  ...BASE_TOOL_HANDOVER_ROUTES,
  ...createTextUtilityWorkbenchRoutes(BASE_TOOL_HANDOVER_ROUTES)
];

function createTextRoute(sourceToolId, sourceOutputId, targetToolId, targetInputId, label, description, transform = '', targetMode = '') {
  return {
    id: `${sourceToolId}-${sourceOutputId}-to-${targetToolId}-${targetInputId}`,
    sourceToolId,
    sourceOutputId,
    targetToolId,
    targetInputId,
    acceptKinds: ['text'],
    label,
    description,
    ...(transform ? { transform } : {}),
    ...(targetMode ? { targetMode } : {})
  };
}

function createTextUtilityWorkbenchRoutes(routes) {
  return routes.flatMap(route => {
    const sourceOutputId = TEXT_UTILITY_WORKBENCH_SOURCES[`${route.sourceToolId}:${route.sourceOutputId}`];
    const target = TEXT_UTILITY_WORKBENCH_TARGETS[`${route.targetToolId}:${route.targetInputId}`];
    const generatedRoutes = [];

    if (sourceOutputId && target) {
      generatedRoutes.push(createTextUtilityWorkbenchRoute(route, { sourceOutputId, target }));
    } else if (sourceOutputId) {
      generatedRoutes.push(createTextUtilityWorkbenchRoute(route, { sourceOutputId }));
    } else if (target) {
      generatedRoutes.push(createTextUtilityWorkbenchRoute(route, { target }));
    }

    return generatedRoutes;
  });
}

function createTextUtilityWorkbenchRoute(route, { sourceOutputId = '', target = null } = {}) {
  const sourceToolId = sourceOutputId ? 'text-utilities-workbench' : route.sourceToolId;
  const resolvedSourceOutputId = sourceOutputId || route.sourceOutputId;
  const targetToolId = target ? 'text-utilities-workbench' : route.targetToolId;
  const targetInputId = target?.inputId || route.targetInputId;
  const targetMode = target?.mode || route.targetMode;
  const targetSuffix = target ? `text-utilities-workbench-${target.inputId}` : `${route.targetToolId}-${route.targetInputId}`;

  return {
    ...route,
    id: `${sourceToolId}-${resolvedSourceOutputId}-to-${targetSuffix}${route.transform ? `-${route.transform}` : ''}`,
    sourceToolId,
    sourceOutputId: resolvedSourceOutputId,
    targetToolId,
    targetInputId,
    ...(targetMode ? { targetMode } : {}),
    ...(target ? { description: target.description } : {})
  };
}

function shouldSkipGenericJsonRoute(source, target) {
  if (source.toolId !== target.toolId) {
    return false;
  }

  if (source.toolId !== 'json-data-workbench') {
    return true;
  }

  return getJsonDataWorkbenchOutputMode(source.outputId) === target.targetMode;
}

function getJsonDataWorkbenchOutputMode(outputId) {
  return {
    output: 'format',
    'diff-output': 'diff',
    'validation-output': 'schema',
    'explorer-output': 'explore'
  }[outputId] || '';
}

function getRouteSetFields(source, target) {
  if (!isDataExplorerInputTarget(target)) {
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

  if (source.toolId === 'text-utilities-workbench' && source.outputId === 'regex-output') {
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

  if (source.toolId === 'text-utilities-workbench' && source.outputId === 'diff-output') {
    return [
      {
        selector: '#dataExplorerRecordPath',
        value: 'rows'
      }
    ];
  }

  if (source.toolId === 'json-diff' || (source.toolId === 'json-data-workbench' && source.outputId === 'diff-output')) {
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

function isDataExplorerInputTarget(target) {
  return (
    (target.toolId === 'data-explorer' && target.inputId === 'input') ||
    (target.toolId === 'json-data-workbench' && target.inputId === 'explore-input')
  );
}
