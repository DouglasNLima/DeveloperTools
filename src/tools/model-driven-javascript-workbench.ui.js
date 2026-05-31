import {
  renderClientApiMigrationHelper,
  renderCommandBarJavaScriptBuilder,
  renderFormEventHandlerBuilder,
  renderFormNotificationValidationBuilder,
  renderModelDrivenJavaScriptReviewer,
  renderXrmWebApiSnippetBuilder
} from './model-driven-javascript.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderModelDrivenJavaScriptWorkbench(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'review',
        label: 'Review',
        summary: 'Review pasted model-driven app JavaScript for Client API and platform risks.',
        renderer: renderModelDrivenJavaScriptReviewer
      },
      {
        id: 'migration',
        label: 'Migration',
        summary: 'Build formContext migration notes from legacy Xrm.Page scripts.',
        renderer: renderClientApiMigrationHelper
      },
      {
        id: 'form-events',
        label: 'Form events',
        summary: 'Generate OnLoad, OnSave, OnChange and subgrid handler boilerplate.',
        renderer: renderFormEventHandlerBuilder
      },
      {
        id: 'web-api',
        label: 'Web API',
        summary: 'Generate guarded Xrm.WebApi snippets for model-driven apps.',
        renderer: renderXrmWebApiSnippetBuilder
      },
      {
        id: 'validation',
        label: 'Validation',
        summary: 'Build form notification and validation snippets.',
        renderer: renderFormNotificationValidationBuilder
      },
      {
        id: 'command-bar',
        label: 'Command bar',
        summary: 'Generate command bar JavaScript handlers for form and grid commands.',
        renderer: renderCommandBarJavaScriptBuilder
      }
    ]
  });
}
