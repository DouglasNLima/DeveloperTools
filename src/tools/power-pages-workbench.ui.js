import { renderFetchXmlLiquidBuilder } from './power-pages.ui.js';
import { renderPowerPagesSiteSettingsHelper } from './power-pages-site-settings.ui.js';
import { renderPowerPagesTablePermissionsChecklist } from './power-pages-table-permissions.ui.js';
import { renderPowerPagesWebApiSnippetGenerator } from './power-pages-webapi.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderPowerPagesWorkbench(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'fetchxml',
        label: 'FetchXML',
        summary: 'Format FetchXML and build Power Pages Liquid fetchxml blocks.',
        renderer: renderFetchXmlLiquidBuilder
      },
      {
        id: 'web-api',
        label: 'Web API',
        summary: 'Generate Power Pages Web API safeAjax snippets and setup notes.',
        renderer: renderPowerPagesWebApiSnippetGenerator
      },
      {
        id: 'site-settings',
        label: 'Site settings',
        summary: 'Build Power Pages site setting checklists.',
        renderer: renderPowerPagesSiteSettingsHelper
      },
      {
        id: 'table-permissions',
        label: 'Table permissions',
        summary: 'Review table permissions, web roles and Web API access.',
        renderer: renderPowerPagesTablePermissionsChecklist
      }
    ]
  });
}
