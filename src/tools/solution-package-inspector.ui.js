import { renderPowerPlatformSolutionDocs } from './power-platform-solution-docs.ui.js';
import { renderPowerPlatformSolutionImportPreflight } from './power-platform-solution-import-preflight.ui.js';
import { renderPowerPlatformSolutionMermaid } from './power-platform-solution-mermaid.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderSolutionPackageInspector(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'diagrams',
        label: 'Diagrams',
        summary: 'Generate Mermaid dependency maps and component diagrams from exported solution ZIP files.',
        renderer: renderPowerPlatformSolutionMermaid
      },
      {
        id: 'documentation',
        label: 'Documentation',
        summary: 'Generate operational Markdown documentation from exported solution ZIP files.',
        renderer: renderPowerPlatformSolutionDocs
      },
      {
        id: 'preflight',
        label: 'Preflight',
        summary: 'Generate import preflight reports and pac import command checklists.',
        renderer: renderPowerPlatformSolutionImportPreflight
      }
    ]
  });
}
