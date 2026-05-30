import {
  TOOL_CATALOGUE,
  getAvailableTools,
  getCategories,
  getToolById,
  matchesToolSearch
} from './tools/catalog.js';
import {
  applyHandoverPayload,
  resolveHandoverSuggestions,
  restoreToolState,
  serialiseToolState
} from './tools/tool-handover.js';
import { APP_TITLE } from './app-metadata.js';
import { APP_PHILOSOPHY, TRANSPARENCY_LIBRARY_ENTRIES } from './app-transparency.js';
import { registerAppServiceWorker } from './pwa.js';
import { renderBase64ToFile, renderFileToBase64 } from './tools/base64.ui.js';
import { renderCaseConverter } from './tools/case-converter.ui.js';
import { renderCronRruleBuilder } from './tools/cron-rrule-builder.ui.js';
import { renderCurlFetchConverter } from './tools/curl-fetch-converter.ui.js';
import { renderCsvTsvHelper } from './tools/csv-tsv-helper.ui.js';
import { renderDataExplorer } from './tools/data-explorer.ui.js';
import { renderHashChecksums } from './tools/hash-checksums.ui.js';
import { renderHtmlCleaner } from './tools/html-cleaner.ui.js';
import { renderImageConverter } from './tools/image-converter.ui.js';
import { renderImageOcr } from './tools/image-ocr.ui.js';
import { renderJsonDiff } from './tools/json-diff.ui.js';
import { renderJsonFormatter } from './tools/json-formatter.ui.js';
import { renderJsonSchemaValidator } from './tools/json-schema-validator.ui.js';
import { renderJwtDecoder } from './tools/jwt-decoder.ui.js';
import { renderMarkdownPreviewInspector } from './tools/markdown-preview.ui.js';
import { renderMarkdownTableFormatter } from './tools/markdown-table.ui.js';
import { renderApiWorkflowToMermaid } from './tools/mermaid-api.ui.js';
import { renderDataToMermaid } from './tools/mermaid-data.ui.js';
import { renderMermaidEditor } from './tools/mermaid-editor.ui.js';
import { renderMermaidTemplateBuilder } from './tools/mermaid-template-builder.ui.js';
import {
  renderClientApiMigrationHelper,
  renderCommandBarJavaScriptBuilder,
  renderFormEventHandlerBuilder,
  renderFormNotificationValidationBuilder,
  renderModelDrivenJavaScriptReviewer,
  renderXrmWebApiSnippetBuilder
} from './tools/model-driven-javascript.ui.js';
import {
  renderSolutionJavaScriptEventInspector,
  renderWebResourceDependencyMapper
} from './tools/model-driven-solution-javascript.ui.js';
import { renderPdfTemplateFieldExplorer } from './tools/pdf-template-fields.ui.js';
import { renderDataverseODataQueryBuilder } from './tools/dataverse-odata.ui.js';
import { renderPowerAutomateExpressionFormatter } from './tools/power-automate-expression.ui.js';
import { renderPowerFxSnippetFormatter } from './tools/power-fx-formatter.ui.js';
import { renderPowerPlatformCliCommandBuilder } from './tools/power-platform-cli.ui.js';
import { renderPowerPlatformSolutionImportPreflight } from './tools/power-platform-solution-import-preflight.ui.js';
import { renderPowerPlatformSolutionDocs } from './tools/power-platform-solution-docs.ui.js';
import { renderPowerPlatformSolutionMermaid } from './tools/power-platform-solution-mermaid.ui.js';
import { renderFetchXmlLiquidBuilder } from './tools/power-pages.ui.js';
import { renderPowerPagesSiteSettingsHelper } from './tools/power-pages-site-settings.ui.js';
import { renderPowerPagesTablePermissionsChecklist } from './tools/power-pages-table-permissions.ui.js';
import { renderPowerPagesWebApiSnippetGenerator } from './tools/power-pages-webapi.ui.js';
import { renderRegexTester } from './tools/regex-tester.ui.js';
import { renderSqlFormatter } from './tools/sql-formatter.ui.js';
import { renderSupportPackSanitiser } from './tools/support-pack-sanitiser.ui.js';
import { renderTextDiff } from './tools/text-diff.ui.js';
import { renderUrlCodec } from './tools/url-codec.ui.js';
import { renderUuidGenerator } from './tools/uuid-generator.ui.js';

const renderers = {
  'base64-to-file': renderBase64ToFile,
  'case-converter': renderCaseConverter,
  'cron-rrule-builder': renderCronRruleBuilder,
  'curl-fetch-converter': renderCurlFetchConverter,
  'csv-tsv-helper': renderCsvTsvHelper,
  'data-explorer': renderDataExplorer,
  'dataverse-odata-query-builder': renderDataverseODataQueryBuilder,
  'file-to-base64': renderFileToBase64,
  'hash-checksums': renderHashChecksums,
  'html-cleaner-converter': renderHtmlCleaner,
  'image-converter': renderImageConverter,
  'image-ocr': renderImageOcr,
  'json-diff': renderJsonDiff,
  'json-formatter': renderJsonFormatter,
  'json-schema-validator': renderJsonSchemaValidator,
  'jwt-decoder': renderJwtDecoder,
  'markdown-preview-inspector': renderMarkdownPreviewInspector,
  'markdown-table-formatter': renderMarkdownTableFormatter,
  'client-api-migration-helper': renderClientApiMigrationHelper,
  'command-bar-javascript-builder': renderCommandBarJavaScriptBuilder,
  'form-event-handler-builder': renderFormEventHandlerBuilder,
  'form-notification-validation-builder': renderFormNotificationValidationBuilder,
  'model-driven-javascript-reviewer': renderModelDrivenJavaScriptReviewer,
  'api-workflow-to-mermaid': renderApiWorkflowToMermaid,
  'data-to-mermaid': renderDataToMermaid,
  'mermaid-editor': renderMermaidEditor,
  'mermaid-template-builder': renderMermaidTemplateBuilder,
  'pdf-template-field-explorer': renderPdfTemplateFieldExplorer,
  'power-automate-expression-formatter': renderPowerAutomateExpressionFormatter,
  'power-platform-solution-import-preflight': renderPowerPlatformSolutionImportPreflight,
  'power-platform-solution-docs': renderPowerPlatformSolutionDocs,
  'power-platform-solution-mermaid': renderPowerPlatformSolutionMermaid,
  'power-fx-snippet-formatter': renderPowerFxSnippetFormatter,
  'solution-javascript-event-inspector': renderSolutionJavaScriptEventInspector,
  'fetchxml-liquid-builder': renderFetchXmlLiquidBuilder,
  'power-platform-cli-command-builder': renderPowerPlatformCliCommandBuilder,
  'power-pages-web-api-snippets': renderPowerPagesWebApiSnippetGenerator,
  'power-pages-site-settings': renderPowerPagesSiteSettingsHelper,
  'power-pages-table-permissions': renderPowerPagesTablePermissionsChecklist,
  'regex-tester': renderRegexTester,
  'sql-query-formatter': renderSqlFormatter,
  'support-pack-sanitiser': renderSupportPackSanitiser,
  'text-diff': renderTextDiff,
  'url-codec': renderUrlCodec,
  'uuid-generator': renderUuidGenerator,
  'web-resource-dependency-mapper': renderWebResourceDependencyMapper,
  'xrm-webapi-snippet-builder': renderXrmWebApiSnippetBuilder
};

const toolNav = document.getElementById('toolNav');
const toolSearch = document.getElementById('toolSearch');
const navToggle = document.getElementById('navToggle');
const navBackdrop = document.getElementById('navBackdrop');
const themeToggle = document.getElementById('themeToggle');
const sidebarCollapse = document.getElementById('sidebarCollapse');
const activeToolCategory = document.getElementById('activeToolCategory');
const activeToolStatus = document.getElementById('activeToolStatus');
const activeToolTitle = document.getElementById('activeToolTitle');
const activeToolSummary = document.getElementById('activeToolSummary');
const handoverTrail = document.getElementById('handoverTrail');
const toolMount = document.getElementById('toolMount');
const toolHandover = document.getElementById('toolHandover');
const brandHomeLinks = document.querySelectorAll('.brand-home-link');

const HOME_VIEW = 'home';
const THEME_STORAGE_KEY = 'developer-tools-theme';
const SIDEBAR_STORAGE_KEY = 'developer-tools-sidebar-collapsed';
const HANDOVER_HISTORY_STORAGE_KEY = 'developer-tools-handover-history';

let activeView = HOME_VIEW;
let activeTool = null;
let activeCleanup = null;
let selectedTheme = readStorage(THEME_STORAGE_KEY);
let handoverHistory = readHandoverHistory();
let pendingHandover = null;
let pendingRestore = null;
let handoverRefreshTimer = null;

document.title = APP_TITLE;

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function readSessionStorage(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session storage can be unavailable in private or restricted browser contexts.
  }
}

function readHandoverHistory() {
  try {
    const parsedHistory = JSON.parse(readSessionStorage(HANDOVER_HISTORY_STORAGE_KEY) || '[]');
    return Array.isArray(parsedHistory) ? parsedHistory.filter(entry => entry?.toolId && entry?.state) : [];
  } catch {
    return [];
  }
}

function writeHandoverHistory() {
  writeSessionStorage(HANDOVER_HISTORY_STORAGE_KEY, JSON.stringify(handoverHistory));
}

function clearHandoverHistory() {
  handoverHistory = [];
  pendingHandover = null;
  pendingRestore = null;
  writeHandoverHistory();
  renderHandoverTrail();
}

function resolveSystemTheme() {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

function applyTheme(theme, source = selectedTheme ? 'manual' : 'system') {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeSource = source;
  updateThemeToggle(theme);
}

function updateThemeToggle(theme) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const label = `Use ${nextTheme} theme`;
  const text = themeToggle.querySelector('.sidebar-action-text');
  const icons = themeToggle.querySelectorAll('.theme-icon');

  themeToggle.setAttribute('aria-label', label);
  themeToggle.title = label;
  themeToggle.dataset.nextTheme = nextTheme;

  icons.forEach(icon => {
    icon.toggleAttribute('hidden', icon.dataset.themeIcon !== nextTheme);
  });

  if (text) {
    text.textContent = `${capitalise(nextTheme)} theme`;
  }
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';

  selectedTheme = nextTheme;
  writeStorage(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme, 'manual');
}

function capitalise(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function applyInitialSidebarState() {
  const collapsed = readStorage(SIDEBAR_STORAGE_KEY) === 'true';

  setSidebarCollapsed(collapsed, false);
}

function setSidebarCollapsed(collapsed, persist = true) {
  const label = collapsed ? 'Expand tool menu' : 'Collapse tool menu';
  const text = sidebarCollapse.querySelector('.sidebar-action-text');
  const icon = sidebarCollapse.querySelector('.sidebar-action-icon');

  document.documentElement.classList.toggle('nav-collapsed', collapsed);
  sidebarCollapse.setAttribute('aria-pressed', String(collapsed));
  sidebarCollapse.setAttribute('aria-label', label);
  sidebarCollapse.title = label;

  if (text) {
    text.textContent = collapsed ? 'Expand' : 'Collapse';
  }

  if (icon) {
    icon.textContent = collapsed ? '>' : '<';
  }

  if (persist) {
    writeStorage(SIDEBAR_STORAGE_KEY, String(collapsed));
  }
}

function toggleSidebarCollapsed() {
  setSidebarCollapsed(!document.documentElement.classList.contains('nav-collapsed'));
}

function resolveRoute() {
  const hash = window.location.hash.replace('#', '');

  if (!hash || hash === HOME_VIEW) {
    return { view: HOME_VIEW, tool: null };
  }

  const hashTool = getToolById(hash);

  if (hashTool && hashTool.status === 'available') {
    return { view: 'tool', tool: hashTool };
  }

  return { view: HOME_VIEW, tool: null };
}

function renderToolList() {
  const searchTerm = toolSearch.value.trim();
  const categories = getCategories();
  let renderedCount = 0;

  toolNav.innerHTML = '';

  const homeButton = document.createElement('button');
  homeButton.type = 'button';
  homeButton.className = 'tool-item home-item available';
  homeButton.dataset.viewId = HOME_VIEW;
  homeButton.dataset.shortLabel = 'HM';
  homeButton.setAttribute('aria-label', 'Home');
  homeButton.innerHTML = `
    <span class="tool-item-title">Home</span>
    <span class="tool-item-summary">Browse every local utility by category.</span>
    <span class="tool-item-status">Overview</span>
  `;

  if (activeView === HOME_VIEW) {
    homeButton.setAttribute('aria-current', 'page');
  }

  homeButton.addEventListener('click', selectHome);
  toolNav.append(homeButton);

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
      button.dataset.shortLabel = getCompactLabel(tool.title);
      button.disabled = tool.status !== 'available';
      button.setAttribute('aria-disabled', String(tool.status !== 'available'));
      button.setAttribute('aria-label', `${tool.title}, ${tool.status === 'available' ? 'available' : 'planned'}`);
      button.title = tool.title;

      if (activeTool && tool.id === activeTool.id) {
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

function getCompactLabel(title) {
  const words = title
    .replace(/&/g, ' ')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  return words.slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase() || 'TL';
}

function selectHome() {
  clearHandoverHistory();
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  closeNavigation();
  renderRoute({ view: HOME_VIEW, tool: null });
}

function selectTool(toolId, options = {}) {
  const nextTool = getToolById(toolId);

  if (!nextTool || nextTool.status !== 'available') {
    return;
  }

  if (!options.preserveHandoverTrail) {
    clearHandoverHistory();
  }

  history.replaceState(null, '', `#${nextTool.id}`);
  closeNavigation();
  renderRoute({ view: 'tool', tool: nextTool });
}

function renderRoute(route) {
  activeView = route.view;
  activeTool = route.tool;
  renderToolList();
  renderHandoverTrail();

  if (route.view === HOME_VIEW) {
    renderHome();
  } else {
    renderActiveTool();
  }
}

function resetActiveTool() {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  clearTimeout(handoverRefreshTimer);
  handoverRefreshTimer = null;
  toolMount.innerHTML = '';
  toolHandover.innerHTML = '';
  toolHandover.hidden = true;
}

function renderHome() {
  resetActiveTool();

  const availableTools = getAvailableTools();

  activeToolCategory.textContent = 'Overview';
  activeToolStatus.textContent = `${availableTools.length} tools`;
  activeToolTitle.textContent = 'Developer Tools';
  activeToolSummary.textContent = 'Choose a browser-only utility or scan the catalogue by category.';

  const homeBoard = document.createElement('div');
  homeBoard.className = 'home-board';

  const summary = document.createElement('div');
  summary.className = 'home-summary';
  summary.innerHTML = `
    <div class="home-summary-card">
      <span>Available now</span>
      <strong>${availableTools.length}</strong>
    </div>
    <div class="home-summary-card">
      <span>Categories</span>
      <strong>${getCategories().length}</strong>
    </div>
    <div class="home-summary-card">
      <span>Runtime</span>
      <strong>Browser only</strong>
    </div>
  `;
  homeBoard.append(summary);
  homeBoard.append(createTransparencySection());

  getCategories().forEach(category => {
    const categoryTools = TOOL_CATALOGUE.filter(tool => tool.category === category);
    const section = document.createElement('section');
    section.className = 'home-category';

    const heading = document.createElement('h3');
    heading.textContent = category;
    section.append(heading);

    const grid = document.createElement('div');
    grid.className = 'home-tool-grid';

    categoryTools.forEach(tool => {
      grid.append(createHomeToolCard(tool));
    });

    section.append(grid);
    homeBoard.append(section);
  });

  toolMount.append(homeBoard);
}

function createTransparencySection() {
  const section = document.createElement('section');
  section.className = 'home-transparency';
  section.setAttribute('aria-labelledby', 'homeTransparencyTitle');

  const header = document.createElement('div');
  header.className = 'home-section-header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Transparency';

  const title = document.createElement('h2');
  title.id = 'homeTransparencyTitle';
  title.textContent = 'Local-first by design';

  const summary = document.createElement('p');
  summary.textContent = 'Developer Tools is built to stay inspectable: the app runs locally, avoids external runtime services and names the libraries behind each workflow.';

  header.append(eyebrow, title, summary);

  const philosophyGrid = document.createElement('div');
  philosophyGrid.className = 'home-philosophy-grid';
  APP_PHILOSOPHY.forEach(item => {
    philosophyGrid.append(createPhilosophyCard(item));
  });

  const librariesHeader = document.createElement('div');
  librariesHeader.className = 'home-library-header';

  const librariesTitle = document.createElement('h3');
  librariesTitle.textContent = 'Library transparency';

  const librariesSummary = document.createElement('p');
  librariesSummary.textContent = 'Runtime libraries are bundled locally. Testing-only libraries support development and are not loaded by the published app.';

  librariesHeader.append(librariesTitle, librariesSummary);

  const libraryGrid = document.createElement('div');
  libraryGrid.className = 'home-library-grid';
  TRANSPARENCY_LIBRARY_ENTRIES.forEach(entry => {
    libraryGrid.append(createLibraryCard(entry));
  });

  const note = document.createElement('p');
  note.className = 'home-transparency-note';
  note.textContent = 'All other tools use first-party code and built-in browser APIs.';

  section.append(header, philosophyGrid, librariesHeader, libraryGrid, note);
  return section;
}

function createPhilosophyCard(item) {
  const card = document.createElement('article');
  card.className = 'home-philosophy-card';

  const title = document.createElement('h3');
  title.textContent = item.title;

  const summary = document.createElement('p');
  summary.textContent = item.summary;

  card.append(title, summary);
  return card;
}

function createLibraryCard(entry) {
  const card = document.createElement('article');
  card.className = 'home-library-card';
  card.dataset.libraryName = entry.name;

  const header = document.createElement('div');
  header.className = 'home-library-card-header';

  const link = document.createElement('a');
  link.className = 'home-library-link';
  link.href = entry.website;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = entry.name;

  const scope = document.createElement('span');
  scope.className = `home-library-scope ${getLibraryScopeClass(entry.scope)}`;
  scope.textContent = entry.scope;

  header.append(link, scope);

  const usage = document.createElement('p');
  usage.className = 'home-library-usage';
  usage.textContent = entry.usage;

  const details = document.createElement('dl');
  details.className = 'home-library-details';
  details.append(
    createDefinitionItem('Used by', entry.usedBy.join(', ')),
    createDefinitionItem('Published app', entry.loadedByPublishedApp ? 'Loaded by published app' : 'Not loaded by published app')
  );

  const note = document.createElement('p');
  note.className = 'home-library-note';
  note.textContent = entry.note;

  card.append(header, usage, details, note);
  return card;
}

function createDefinitionItem(term, description) {
  const fragment = document.createDocumentFragment();
  const termElement = document.createElement('dt');
  const descriptionElement = document.createElement('dd');

  termElement.textContent = term;
  descriptionElement.textContent = description;
  fragment.append(termElement, descriptionElement);

  return fragment;
}

function getLibraryScopeClass(scope) {
  return scope.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function renderActiveTool() {
  resetActiveTool();

  const renderer = renderers[activeTool.renderer];

  activeToolCategory.textContent = activeTool.category;
  activeToolStatus.textContent = 'Available';
  activeToolTitle.textContent = activeTool.title;
  activeToolSummary.textContent = activeTool.summary;
  if (!renderer) {
    const unavailable = document.createElement('div');
    unavailable.className = 'tool-board';
    unavailable.textContent = 'This tool is not available yet.';
    toolMount.append(unavailable);
    return;
  }

  activeCleanup = renderer(toolMount);
  applyPendingToolState();
  renderHandoverTrail();
  renderHandoverSuggestions();
}

function applyPendingToolState() {
  if (pendingRestore && pendingRestore.toolId === activeTool.id) {
    restoreToolState(toolMount, pendingRestore.state);
    pendingRestore = null;
  }

  if (pendingHandover && pendingHandover.targetToolId === activeTool.id) {
    applyHandoverPayload(
      toolMount,
      pendingHandover.targetToolId,
      pendingHandover.targetInputId,
      pendingHandover.value,
      undefined,
      pendingHandover
    );
    pendingHandover = null;
  }
}

function renderHandoverTrail() {
  handoverTrail.innerHTML = '';

  if (activeView !== 'tool' || !activeTool || handoverHistory.length === 0) {
    handoverTrail.hidden = true;
    return;
  }

  const label = document.createElement('span');
  label.className = 'handover-trail-label';
  label.textContent = 'Handover trail';
  handoverTrail.append(label);

  handoverHistory.forEach((entry, index) => {
    const tool = getToolById(entry.toolId);
    const title = entry.title || tool?.title || entry.toolId;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'handover-trail-button';
    button.textContent = title;
    button.title = `Return to ${title}`;
    button.addEventListener('click', () => restoreHandoverEntry(index));
    handoverTrail.append(button);

    const separator = document.createElement('span');
    separator.className = 'handover-trail-separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '›';
    handoverTrail.append(separator);
  });

  const current = document.createElement('span');
  current.className = 'handover-trail-current';
  current.setAttribute('aria-current', 'page');
  current.textContent = activeTool.title;
  handoverTrail.append(current);
  handoverTrail.hidden = false;
}

function renderHandoverSuggestions() {
  toolHandover.innerHTML = '';

  if (activeView !== 'tool' || !activeTool) {
    toolHandover.hidden = true;
    return;
  }

  const suggestions = resolveHandoverSuggestions({
    sourceToolId: activeTool.id,
    root: toolMount,
    availableTools: getAvailableTools()
  });

  if (suggestions.length === 0) {
    toolHandover.hidden = true;
    return;
  }

  const header = document.createElement('div');
  header.className = 'handover-header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Handover';

  const title = document.createElement('h2');
  title.id = 'toolHandoverTitle';
  title.textContent = getHandoverSectionTitle(suggestions);

  const summary = document.createElement('p');
  summary.textContent = 'Send the populated output to another local tool with the input already filled.';

  header.append(eyebrow, title, summary);

  const actions = document.createElement('div');
  actions.className = 'handover-action-grid';

  suggestions.forEach(suggestion => {
    actions.append(createHandoverSuggestionButton(suggestion));
  });

  toolHandover.append(header, actions);
  toolHandover.hidden = false;
}

  function getHandoverSectionTitle(suggestions) {
    const kinds = new Set(suggestions.map(suggestion => suggestion.kind));
    const sourceKinds = new Set([...kinds].filter(kind => kind !== 'mermaid'));

    if (sourceKinds.has('base64') && sourceKinds.size === 1) {
      return 'Continue with this Base64';
    }

    if (sourceKinds.has('text') && sourceKinds.size === 1) {
      return 'Continue with this text';
    }

    if (sourceKinds.has('xml') && sourceKinds.size === 1) {
      return 'Continue with this XML';
    }

    if (sourceKinds.has('json-schema')) {
      return 'Continue with this JSON or schema';
    }

    if (sourceKinds.has('json') && sourceKinds.size === 1) {
      return 'Continue with this JSON';
    }

    if (kinds.has('mermaid') && kinds.size === 1) {
      return 'Continue with this Mermaid';
    }

    return 'Continue with this output';
  }

function createHandoverSuggestionButton(suggestion) {
  const targetTool = getToolById(suggestion.targetToolId);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'handover-action';
  button.dataset.handoverTarget = suggestion.targetToolId;
  button.dataset.handoverInput = suggestion.targetInputId;

  const title = document.createElement('strong');
  title.textContent = `${suggestion.sourceLabel}: ${suggestion.label}`;

  const detail = document.createElement('span');
  detail.textContent = `${targetTool?.title || suggestion.targetToolId}: ${suggestion.description}`;

  button.append(title, detail);
  button.addEventListener('click', () => startHandover(suggestion));

  return button;
}

function startHandover(suggestion) {
  if (!activeTool) {
    return;
  }

  handoverHistory = [
    ...handoverHistory,
    {
      toolId: activeTool.id,
      title: activeTool.title,
      state: serialiseToolState(activeTool.id, toolMount),
      createdAt: Date.now()
    }
  ].slice(-8);
  writeHandoverHistory();

  pendingHandover = suggestion;
  selectTool(suggestion.targetToolId, { preserveHandoverTrail: true });
}

function restoreHandoverEntry(index) {
  const entry = handoverHistory[index];
  const tool = entry ? getToolById(entry.toolId) : null;

  if (!entry || !tool || tool.status !== 'available') {
    return;
  }

  handoverHistory = handoverHistory.slice(0, index);
  writeHandoverHistory();
  pendingRestore = entry;
  selectTool(entry.toolId, { preserveHandoverTrail: true });
}

function scheduleHandoverRefresh() {
  if (activeView !== 'tool' || !activeTool) {
    return;
  }

  clearTimeout(handoverRefreshTimer);
  handoverRefreshTimer = window.setTimeout(() => {
    renderHandoverSuggestions();
  }, 0);
}

function createHomeToolCard(tool) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `home-tool-card ${tool.status === 'available' ? 'available' : 'planned'}`;
  card.dataset.homeToolId = tool.id;
  card.disabled = tool.status !== 'available';
  card.setAttribute('aria-disabled', String(tool.status !== 'available'));

  const title = document.createElement('span');
  title.className = 'home-tool-title';
  title.textContent = tool.title;

  const summary = document.createElement('span');
  summary.className = 'home-tool-summary';
  summary.textContent = tool.summary;

  const status = document.createElement('span');
  status.className = 'home-tool-status';
  status.textContent = tool.status === 'available' ? 'Available' : 'Planned';

  card.append(title, summary, status);

  if (tool.status === 'available') {
    card.addEventListener('click', () => selectTool(tool.id));
  }

  return card;
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
toolMount.addEventListener('input', scheduleHandoverRefresh);
toolMount.addEventListener('change', scheduleHandoverRefresh);
toolMount.addEventListener('click', scheduleHandoverRefresh);
navToggle.addEventListener('click', toggleNavigation);
navBackdrop.addEventListener('click', closeNavigation);
themeToggle.addEventListener('click', toggleTheme);
sidebarCollapse.addEventListener('click', toggleSidebarCollapsed);
brandHomeLinks.forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    selectHome();
  });
});

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeNavigation();
  }
});

window.addEventListener('hashchange', () => {
  clearHandoverHistory();
  renderRoute(resolveRoute());
});

const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

systemThemeQuery.addEventListener('change', event => {
  if (!selectedTheme) {
    applyTheme(event.matches ? 'dark' : 'light', 'system');
  }
});

if (selectedTheme !== 'light' && selectedTheme !== 'dark') {
  selectedTheme = null;
}

applyTheme(selectedTheme || resolveSystemTheme());
applyInitialSidebarState();
renderRoute(resolveRoute());
registerAppServiceWorker();
