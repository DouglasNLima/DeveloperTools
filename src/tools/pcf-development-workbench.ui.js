import { renderPcfScriptCommandBuilder } from './pcf-development.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderPcfDevelopmentWorkbench(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'create',
        label: 'Create',
        summary: 'Initialise a complete PCF control and Dataverse solution structure.',
        renderer: renderPcfScriptCommandBuilder
      },
      {
        id: 'develop',
        label: 'Develop',
        summary: 'Check local prerequisites and start the PCF test harness.',
        renderer: renderPcfScriptCommandBuilder
      },
      {
        id: 'build',
        label: 'Version & build',
        summary: 'Update versions, build the control and package its solution.',
        renderer: renderPcfScriptCommandBuilder
      },
      {
        id: 'deploy',
        label: 'Deploy',
        summary: 'Prepare rapid control pushes and complete solution imports.',
        renderer: renderPcfScriptCommandBuilder
      },
      {
        id: 'quality',
        label: 'Quality',
        summary: 'Prepare Solution Checker quality-gate runs.',
        renderer: renderPcfScriptCommandBuilder
      }
    ]
  });
}
