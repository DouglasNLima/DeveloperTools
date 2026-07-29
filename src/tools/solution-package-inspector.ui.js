import { renderPowerPlatformClassicWorkflowPackageEditor } from './power-platform-classic-workflow-package.ui.js';
import { renderPowerPlatformFlowPackageEditor } from './power-platform-flow-package.ui.js';
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
        id: 'flows',
        label: 'Flow editor',
        summary: 'Review, compare and replace cloud flow JSON in unmanaged solution ZIP files.',
        renderer: renderPowerPlatformFlowPackageEditor
      },
      {
        id: 'classic-workflows',
        label: 'Classic workflow editor',
        summary: 'Review, compare and replace classic workflow XAML in unmanaged solution ZIP files.',
        renderer: renderPowerPlatformClassicWorkflowPackageEditor
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
