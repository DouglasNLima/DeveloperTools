import {
  renderSolutionJavaScriptEventInspector,
  renderWebResourceDependencyMapper
} from './model-driven-solution-javascript.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderModelDrivenSolutionInspector(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'events',
        label: 'Events',
        summary: 'Inspect JavaScript libraries, handlers and source findings from exported solution ZIP files.',
        renderer: renderSolutionJavaScriptEventInspector
      },
      {
        id: 'dependencies',
        label: 'Dependencies',
        summary: 'Map web resource dependencies, forms and HTML source references from exported solution ZIP files.',
        renderer: renderWebResourceDependencyMapper
      }
    ]
  });
}
