import {
  TOOL_CATALOGUE,
  getAvailableTools,
  getCategories,
  getToolById,
  matchesToolSearch
} from './tools/catalog.js';
import { APP_TITLE } from './app-metadata.js';
import { registerAppServiceWorker } from './pwa.js';
import { renderBase64ToFile, renderFileToBase64 } from './tools/base64.ui.js';
import { renderCaseConverter } from './tools/case-converter.ui.js';
import { renderCronRruleBuilder } from './tools/cron-rrule-builder.ui.js';
import { renderCurlFetchConverter } from './tools/curl-fetch-converter.ui.js';
import { renderCsvTsvHelper } from './tools/csv-tsv-helper.ui.js';
import { renderDataExplorer } from './tools/data-explorer.ui.js';
import { renderHashChecksums } from './tools/hash-checksums.ui.js';
import { renderHtmlCleaner } from './tools/html-cleaner.ui.js';
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
  'support-pack-sanitiser': renderSupportPackSanitiser,
  'text-diff': renderTextDiff,
  'url-codec': renderUrlCodec,
  'uuid-generator': renderUuidGenerator
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
const toolMount = document.getElementById('toolMount');
const brandHomeLinks = document.querySelectorAll('.brand-home-link');

const HOME_VIEW = 'home';
const THEME_STORAGE_KEY = 'developer-tools-theme';
const SIDEBAR_STORAGE_KEY = 'developer-tools-sidebar-collapsed';

let activeView = HOME_VIEW;
let activeTool = null;
let activeCleanup = null;
let selectedTheme = readStorage(THEME_STORAGE_KEY);

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
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  closeNavigation();
  renderRoute({ view: HOME_VIEW, tool: null });
}

function selectTool(toolId) {
  const nextTool = getToolById(toolId);

  if (!nextTool || nextTool.status !== 'available') {
    return;
  }

  history.replaceState(null, '', `#${nextTool.id}`);
  closeNavigation();
  renderRoute({ view: 'tool', tool: nextTool });
}

function renderRoute(route) {
  activeView = route.view;
  activeTool = route.tool;
  renderToolList();

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

  toolMount.innerHTML = '';
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
