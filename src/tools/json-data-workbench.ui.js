import { renderDataExplorer } from './data-explorer.ui.js';
import { renderJsonDiff } from './json-diff.ui.js';
import { renderJsonFormatter } from './json-formatter.ui.js';
import { renderJsonSchemaValidator } from './json-schema-validator.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderJsonDataWorkbench(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'format',
        label: 'Format',
        summary: 'Format, validate, sort, minify and inspect JSON paths.',
        renderer: renderJsonFormatter
      },
      {
        id: 'diff',
        label: 'Compare',
        summary: 'Compare JSON documents with structure-aware path differences.',
        renderer: renderJsonDiff
      },
      {
        id: 'schema',
        label: 'Schema',
        summary: 'Validate JSON against local JSON Schema rules.',
        renderer: renderJsonSchemaValidator
      },
      {
        id: 'explore',
        label: 'Explore',
        summary: 'Query JSON records and flatten JSON or XML into a local grid.',
        renderer: renderDataExplorer
      }
    ]
  });
}
