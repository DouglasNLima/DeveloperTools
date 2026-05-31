import { renderApiWorkflowToMermaid } from './mermaid-api.ui.js';
import { renderDataToMermaid } from './mermaid-data.ui.js';
import { renderMermaidEditor } from './mermaid-editor.ui.js';
import { renderMermaidTemplateBuilder } from './mermaid-template-builder.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderMermaidStudio(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'editor',
        label: 'Editor',
        summary: 'Validate, preview and export Mermaid diagrams.',
        renderer: renderMermaidEditor
      },
      {
        id: 'templates',
        label: 'Templates',
        summary: 'Generate starter Mermaid snippets.',
        renderer: renderMermaidTemplateBuilder
      },
      {
        id: 'data',
        label: 'Data',
        summary: 'Convert JSON, CSV or TSV data into Mermaid diagrams.',
        renderer: renderDataToMermaid
      },
      {
        id: 'api-workflow',
        label: 'API/workflow',
        summary: 'Convert API requests, endpoint notes and step lists into Mermaid diagrams.',
        renderer: renderApiWorkflowToMermaid
      }
    ]
  });
}
