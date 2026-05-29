import {
  TOOL_CATALOGUE,
  getCategories,
  getDefaultTool,
  getToolById,
  matchesToolSearch
} from './tools/catalog.js';
import { renderBase64ToFile, renderFileToBase64 } from './tools/base64.ui.js';
import { renderCaseConverter } from './tools/case-converter.ui.js';
import { renderCurlFetchConverter } from './tools/curl-fetch-converter.ui.js';
import { renderCsvTsvHelper } from './tools/csv-tsv-helper.ui.js';
import { renderDataExplorer } from './tools/data-explorer.ui.js';
import { renderHashChecksums } from './tools/hash-checksums.ui.js';
import { renderJsonDiff } from './tools/json-diff.ui.js';
import { renderJsonFormatter } from './tools/json-formatter.ui.js';
import { renderJwtDecoder } from './tools/jwt-decoder.ui.js';
import { renderPdfTemplateFieldExplorer } from './tools/pdf-template-fields.ui.js';
import { renderDataverseODataQueryBuilder } from './tools/dataverse-odata.ui.js';
import { renderPowerAutomateExpressionFormatter } from './tools/power-automate-expression.ui.js';
import { renderPowerFxSnippetFormatter } from './tools/power-fx-formatter.ui.js';
import { renderPowerPlatformCliCommandBuilder } from './tools/power-platform-cli.ui.js';
import { renderFetchXmlLiquidBuilder } from './tools/power-pages.ui.js';
import { renderPowerPagesSiteSettingsHelper } from './tools/power-pages-site-settings.ui.js';
import { renderPowerPagesTablePermissionsChecklist } from './tools/power-pages-table-permissions.ui.js';
import { renderPowerPagesWebApiSnippetGenerator } from './tools/power-pages-webapi.ui.js';
import { renderRegexTester } from './tools/regex-tester.ui.js';
import { renderTextDiff } from './tools/text-diff.ui.js';
import { renderUrlCodec } from './tools/url-codec.ui.js';
import { renderUuidGenerator } from './tools/uuid-generator.ui.js';

const renderers = {
  'base64-to-file': renderBase64ToFile,
  'case-converter': renderCaseConverter,
  'curl-fetch-converter': renderCurlFetchConverter,
  'csv-tsv-helper': renderCsvTsvHelper,
  'data-explorer': renderDataExplorer,
  'dataverse-odata-query-builder': renderDataverseODataQueryBuilder,
  'file-to-base64': renderFileToBase64,
  'hash-checksums': renderHashChecksums,
  'json-diff': renderJsonDiff,
  'json-formatter': renderJsonFormatter,
  'jwt-decoder': renderJwtDecoder,
  'pdf-template-field-explorer': renderPdfTemplateFieldExplorer,
  'power-automate-expression-formatter': renderPowerAutomateExpressionFormatter,
  'power-fx-snippet-formatter': renderPowerFxSnippetFormatter,
  'fetchxml-liquid-builder': renderFetchXmlLiquidBuilder,
  'power-platform-cli-command-builder': renderPowerPlatformCliCommandBuilder,
  'power-pages-web-api-snippets': renderPowerPagesWebApiSnippetGenerator,
  'power-pages-site-settings': renderPowerPagesSiteSettingsHelper,
  'power-pages-table-permissions': renderPowerPagesTablePermissionsChecklist,
  'regex-tester': renderRegexTester,
  'text-diff': renderTextDiff,
  'url-codec': renderUrlCodec,
  'uuid-generator': renderUuidGenerator
};

const toolNav = document.getElementById('toolNav');
const toolSearch = document.getElementById('toolSearch');
const navToggle = document.getElementById('navToggle');
const navBackdrop = document.getElementById('navBackdrop');
const activeToolCategory = document.getElementById('activeToolCategory');
const activeToolStatus = document.getElementById('activeToolStatus');
const activeToolTitle = document.getElementById('activeToolTitle');
const activeToolSummary = document.getElementById('activeToolSummary');
const toolMount = document.getElementById('toolMount');

let activeTool = resolveInitialTool();
let activeCleanup = null;

function resolveInitialTool() {
  const hashTool = getToolById(window.location.hash.replace('#', ''));

  if (hashTool && hashTool.status === 'available') {
    return hashTool;
  }

  return getDefaultTool();
}

function renderToolList() {
  const searchTerm = toolSearch.value.trim();
  const categories = getCategories();
  let renderedCount = 0;

  toolNav.innerHTML = '';

  categories.forEach(category => {
    const tools = TOOL_CATALOGUE.filter(tool => tool.category === category && matchesToolSearch(tool, searchTerm));

    if (tools.length === 0) {
      return;
    }

    renderedCount += tools.length;

    const group = document.createElement('section');
    group.className = 'tool-group';

    const heading = document.createElement('h3');
    heading.textContent = category;
    group.append(heading);

    const list = document.createElement('div');
    list.className = 'tool-list';

    tools.forEach(tool => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `tool-item ${tool.status === 'available' ? 'available' : 'planned'}`;
      button.dataset.toolId = tool.id;
      button.disabled = tool.status !== 'available';
      button.setAttribute('aria-disabled', String(tool.status !== 'available'));

      if (tool.id === activeTool.id) {
        button.setAttribute('aria-current', 'page');
      }

      button.innerHTML = `
        <span class="tool-item-title">${tool.title}</span>
        <span class="tool-item-summary">${tool.summary}</span>
        <span class="tool-item-status">${tool.status === 'available' ? 'Available' : 'Planned'}</span>
      `;

      if (tool.status === 'available') {
        button.addEventListener('click', () => selectTool(tool.id));
      }

      list.append(button);
    });

    group.append(list);
    toolNav.append(group);
  });

  if (renderedCount === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No tools match that search.';
    toolNav.append(emptyState);
  }
}

function selectTool(toolId) {
  const nextTool = getToolById(toolId);

  if (!nextTool || nextTool.status !== 'available') {
    return;
  }

  activeTool = nextTool;
  history.replaceState(null, '', `#${nextTool.id}`);
  closeNavigation();
  renderToolList();
  renderActiveTool();
}

function renderActiveTool() {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  const renderer = renderers[activeTool.renderer];

  activeToolCategory.textContent = activeTool.category;
  activeToolStatus.textContent = 'Available';
  activeToolTitle.textContent = activeTool.title;
  activeToolSummary.textContent = activeTool.summary;
  toolMount.innerHTML = '';

  if (!renderer) {
    const unavailable = document.createElement('div');
    unavailable.className = 'tool-board';
    unavailable.textContent = 'This tool is not available yet.';
    toolMount.append(unavailable);
    return;
  }

  activeCleanup = renderer(toolMount);
}

function openNavigation() {
  document.documentElement.classList.add('nav-open');
  navToggle.setAttribute('aria-expanded', 'true');
  navToggle.setAttribute('aria-label', 'Close tool menu');
}

function closeNavigation() {
  document.documentElement.classList.remove('nav-open');
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.setAttribute('aria-label', 'Open tool menu');
}

function toggleNavigation() {
  if (document.documentElement.classList.contains('nav-open')) {
    closeNavigation();
  } else {
    openNavigation();
  }
}

toolSearch.addEventListener('input', renderToolList);
navToggle.addEventListener('click', toggleNavigation);
navBackdrop.addEventListener('click', closeNavigation);

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeNavigation();
  }
});

window.addEventListener('hashchange', () => {
  const hashTool = getToolById(window.location.hash.replace('#', ''));

  if (hashTool && hashTool.status === 'available' && hashTool.id !== activeTool.id) {
    activeTool = hashTool;
    renderToolList();
    renderActiveTool();
  }
});

renderToolList();
renderActiveTool();
