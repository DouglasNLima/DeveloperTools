import { renderMarkdownPreviewInspector } from './markdown-preview.ui.js';
import { renderMarkdownTableFormatter } from './markdown-table.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderMarkdownWorkbench(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'preview',
        label: 'Preview',
        summary: 'Preview Markdown and inspect headings, references and Mermaid fences.',
        renderer: renderMarkdownPreviewInspector
      },
      {
        id: 'tables',
        label: 'Tables',
        summary: 'Format Markdown tables and convert them to CSV or TSV.',
        renderer: renderMarkdownTableFormatter
      }
    ]
  });
}
