import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TOOL_CATALOGUE,
  buildToolHash,
  getAvailableTools,
  getCategories,
  getToolById,
  getVisibleTools,
  matchesToolSearch,
  resolveToolRoute,
  validateToolCatalogue
} from '../../src/tools/catalog.js';

const FIXTURE_CATALOGUE = [
  {
    id: 'json-data-workbench',
    title: 'JSON & Data Workbench',
    category: 'JSON & data',
    status: 'available',
    summary: 'Format, compare, validate and explore JSON or XML payloads locally.',
    renderer: 'json-data-workbench',
    modes: [
      { id: 'format', title: 'Format JSON' },
      { id: 'diff', title: 'Compare JSON' },
      { id: 'schema', title: 'Schema validation' },
      { id: 'explore', title: 'Explore data' }
    ],
    defaultMode: 'format',
    legacyIds: ['json-formatter'],
    modeAliases: {
      '#json-diff': 'diff',
      'json-schema-validator': 'schema',
      'data-explorer': 'explore'
    },
    searchTerms: [
      'JSON formatter/validator',
      'JSON diff',
      'JSON Schema validator',
      'JSON/XML data explorer'
    ]
  },
  {
    id: 'csv-tsv-helper',
    title: 'CSV/TSV helper',
    category: 'JSON & data',
    status: 'available',
    summary: 'Inspect delimited data.',
    renderer: 'csv-tsv-helper'
  },
  {
    id: 'planned-helper',
    title: 'Planned helper',
    category: 'Roadmap',
    status: 'planned',
    summary: 'Visible disabled preview.',
    renderer: 'planned-helper'
  },
  {
    id: 'hidden-legacy-tool',
    title: 'Hidden legacy tool',
    category: 'Hidden category',
    status: 'available',
    summary: 'Hidden technical route.',
    renderer: 'hidden-legacy-tool',
    hidden: true
  }
];

test('validates the real catalogue and keeps the current visible tool count', () => {
  const result = validateToolCatalogue();

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(TOOL_CATALOGUE.length, 59);
  assert.equal(getVisibleTools().length, 21);
  assert.equal(getAvailableTools().length, 21);
  assert.equal(getToolById('base64-to-file').hidden, true);
  assert.equal(getToolById('file-to-base64').hidden, true);
  assert.equal(getToolById('image-converter').hidden, true);
  assert.equal(getToolById('image-resizer-compressor').hidden, true);
  assert.equal(getToolById('mermaid-editor').hidden, true);
  assert.equal(getToolById('mermaid-template-builder').hidden, true);
  assert.equal(getToolById('data-to-mermaid').hidden, true);
  assert.equal(getToolById('api-workflow-to-mermaid').hidden, true);
  assert.equal(getToolById('json-formatter').hidden, true);
  assert.equal(getToolById('json-diff').hidden, true);
  assert.equal(getToolById('json-schema-validator').hidden, true);
  assert.equal(getToolById('data-explorer').hidden, true);
  assert.equal(getToolById('jwt-decoder').hidden, true);
  assert.equal(getToolById('cron-rrule-builder').hidden, true);
  assert.equal(getToolById('curl-fetch-converter').hidden, true);
  assert.equal(getToolById('fetchxml-liquid-builder').hidden, true);
  assert.equal(getToolById('power-pages-web-api-snippets').hidden, true);
  assert.equal(getToolById('power-pages-site-settings').hidden, true);
  assert.equal(getToolById('power-pages-table-permissions').hidden, true);
  assert.equal(getToolById('power-platform-solution-mermaid').hidden, true);
  assert.equal(getToolById('power-platform-solution-docs').hidden, true);
  assert.equal(getToolById('power-platform-solution-import-preflight').hidden, true);
  assert.equal(getToolById('model-driven-javascript-reviewer').hidden, true);
  assert.equal(getToolById('client-api-migration-helper').hidden, true);
  assert.equal(getToolById('form-event-handler-builder').hidden, true);
  assert.equal(getToolById('xrm-webapi-snippet-builder').hidden, true);
  assert.equal(getToolById('form-notification-validation-builder').hidden, true);
  assert.equal(getToolById('command-bar-javascript-builder').hidden, true);
  assert.equal(getToolById('solution-javascript-event-inspector').hidden, true);
  assert.equal(getToolById('web-resource-dependency-mapper').hidden, true);
  assert.equal(getToolById('markdown-preview-inspector').hidden, true);
  assert.equal(getToolById('markdown-table-formatter').hidden, true);
  assert.equal(getToolById('regex-tester').hidden, true);
  assert.equal(getToolById('sql-query-formatter').hidden, true);
  assert.equal(getToolById('support-pack-sanitiser').hidden, true);
  assert.equal(getToolById('text-diff').hidden, true);
  assert.equal(getToolById('case-converter').hidden, true);
  assert.equal(getToolById('uuid-generator').hidden, true);
});

test('resolves the phase 1 legacy hashes to consolidated workbench modes', () => {
  assert.deepEqual(resolveSummary('#base64-to-file'), {
    toolId: 'base64-file-converter',
    mode: 'base64-to-file',
    canonicalHash: '#base64-file-converter'
  });
  assert.deepEqual(resolveSummary('#file-to-base64'), {
    toolId: 'base64-file-converter',
    mode: 'file-to-base64',
    canonicalHash: '#base64-file-converter/file-to-base64'
  });
  assert.deepEqual(resolveSummary('#image-converter'), {
    toolId: 'image-converter-optimiser',
    mode: 'convert',
    canonicalHash: '#image-converter-optimiser'
  });
  assert.deepEqual(resolveSummary('#image-resizer-compressor'), {
    toolId: 'image-converter-optimiser',
    mode: 'optimise',
    canonicalHash: '#image-converter-optimiser/optimise'
  });
  assert.deepEqual(resolveSummary('#markdown-preview-inspector'), {
    toolId: 'markdown-workbench',
    mode: 'preview',
    canonicalHash: '#markdown-workbench'
  });
  assert.deepEqual(resolveSummary('#markdown-table-formatter'), {
    toolId: 'markdown-workbench',
    mode: 'tables',
    canonicalHash: '#markdown-workbench/tables'
  });
  assert.deepEqual(resolveSummary('#mermaid-editor'), {
    toolId: 'mermaid-studio',
    mode: 'editor',
    canonicalHash: '#mermaid-studio'
  });
  assert.deepEqual(resolveSummary('#mermaid-template-builder'), {
    toolId: 'mermaid-studio',
    mode: 'templates',
    canonicalHash: '#mermaid-studio/templates'
  });
  assert.deepEqual(resolveSummary('#data-to-mermaid'), {
    toolId: 'mermaid-studio',
    mode: 'data',
    canonicalHash: '#mermaid-studio/data'
  });
  assert.deepEqual(resolveSummary('#api-workflow-to-mermaid'), {
    toolId: 'mermaid-studio',
    mode: 'api-workflow',
    canonicalHash: '#mermaid-studio/api-workflow'
  });
  assert.deepEqual(resolveSummary('#json-formatter'), {
    toolId: 'json-data-workbench',
    mode: 'format',
    canonicalHash: '#json-data-workbench'
  });
  assert.deepEqual(resolveSummary('#json-diff'), {
    toolId: 'json-data-workbench',
    mode: 'diff',
    canonicalHash: '#json-data-workbench/diff'
  });
  assert.deepEqual(resolveSummary('#json-schema-validator'), {
    toolId: 'json-data-workbench',
    mode: 'schema',
    canonicalHash: '#json-data-workbench/schema'
  });
  assert.deepEqual(resolveSummary('#data-explorer'), {
    toolId: 'json-data-workbench',
    mode: 'explore',
    canonicalHash: '#json-data-workbench/explore'
  });
  assert.deepEqual(resolveSummary('#jwt-decoder'), {
    toolId: 'web-api-workbench',
    mode: 'jwt',
    canonicalHash: '#web-api-workbench'
  });
  assert.deepEqual(resolveSummary('#cron-rrule-builder'), {
    toolId: 'web-api-workbench',
    mode: 'schedule',
    canonicalHash: '#web-api-workbench/schedule'
  });
  assert.deepEqual(resolveSummary('#curl-fetch-converter'), {
    toolId: 'web-api-workbench',
    mode: 'request',
    canonicalHash: '#web-api-workbench/request'
  });
  assert.deepEqual(resolveSummary('#fetchxml-liquid-builder'), {
    toolId: 'power-pages-workbench',
    mode: 'fetchxml',
    canonicalHash: '#power-pages-workbench'
  });
  assert.deepEqual(resolveSummary('#power-pages-web-api-snippets'), {
    toolId: 'power-pages-workbench',
    mode: 'web-api',
    canonicalHash: '#power-pages-workbench/web-api'
  });
  assert.deepEqual(resolveSummary('#power-pages-site-settings'), {
    toolId: 'power-pages-workbench',
    mode: 'site-settings',
    canonicalHash: '#power-pages-workbench/site-settings'
  });
  assert.deepEqual(resolveSummary('#power-pages-table-permissions'), {
    toolId: 'power-pages-workbench',
    mode: 'table-permissions',
    canonicalHash: '#power-pages-workbench/table-permissions'
  });
  assert.deepEqual(resolveSummary('#power-platform-solution-mermaid'), {
    toolId: 'solution-package-inspector',
    mode: 'diagrams',
    canonicalHash: '#solution-package-inspector'
  });
  assert.deepEqual(resolveSummary('#power-platform-solution-docs'), {
    toolId: 'solution-package-inspector',
    mode: 'documentation',
    canonicalHash: '#solution-package-inspector/documentation'
  });
  assert.deepEqual(resolveSummary('#power-platform-solution-import-preflight'), {
    toolId: 'solution-package-inspector',
    mode: 'preflight',
    canonicalHash: '#solution-package-inspector/preflight'
  });
  assert.deepEqual(resolveSummary('#model-driven-javascript-reviewer'), {
    toolId: 'model-driven-javascript-workbench',
    mode: 'review',
    canonicalHash: '#model-driven-javascript-workbench'
  });
  assert.deepEqual(resolveSummary('#client-api-migration-helper'), {
    toolId: 'model-driven-javascript-workbench',
    mode: 'migration',
    canonicalHash: '#model-driven-javascript-workbench/migration'
  });
  assert.deepEqual(resolveSummary('#form-event-handler-builder'), {
    toolId: 'model-driven-javascript-workbench',
    mode: 'form-events',
    canonicalHash: '#model-driven-javascript-workbench/form-events'
  });
  assert.deepEqual(resolveSummary('#xrm-webapi-snippet-builder'), {
    toolId: 'model-driven-javascript-workbench',
    mode: 'web-api',
    canonicalHash: '#model-driven-javascript-workbench/web-api'
  });
  assert.deepEqual(resolveSummary('#form-notification-validation-builder'), {
    toolId: 'model-driven-javascript-workbench',
    mode: 'validation',
    canonicalHash: '#model-driven-javascript-workbench/validation'
  });
  assert.deepEqual(resolveSummary('#command-bar-javascript-builder'), {
    toolId: 'model-driven-javascript-workbench',
    mode: 'command-bar',
    canonicalHash: '#model-driven-javascript-workbench/command-bar'
  });
  assert.deepEqual(resolveSummary('#solution-javascript-event-inspector'), {
    toolId: 'model-driven-solution-inspector',
    mode: 'events',
    canonicalHash: '#model-driven-solution-inspector'
  });
  assert.deepEqual(resolveSummary('#web-resource-dependency-mapper'), {
    toolId: 'model-driven-solution-inspector',
    mode: 'dependencies',
    canonicalHash: '#model-driven-solution-inspector/dependencies'
  });
  assert.deepEqual(resolveSummary('#regex-tester'), {
    toolId: 'text-utilities-workbench',
    mode: 'regex',
    canonicalHash: '#text-utilities-workbench'
  });
  assert.deepEqual(resolveSummary('#sql-query-formatter'), {
    toolId: 'text-utilities-workbench',
    mode: 'sql',
    canonicalHash: '#text-utilities-workbench/sql'
  });
  assert.deepEqual(resolveSummary('#support-pack-sanitiser'), {
    toolId: 'text-utilities-workbench',
    mode: 'sanitise',
    canonicalHash: '#text-utilities-workbench/sanitise'
  });
  assert.deepEqual(resolveSummary('#text-diff'), {
    toolId: 'text-utilities-workbench',
    mode: 'diff',
    canonicalHash: '#text-utilities-workbench/diff'
  });
  assert.deepEqual(resolveSummary('#case-converter'), {
    toolId: 'text-utilities-workbench',
    mode: 'case',
    canonicalHash: '#text-utilities-workbench/case'
  });
  assert.deepEqual(resolveSummary('#uuid-generator'), {
    toolId: 'text-utilities-workbench',
    mode: 'uuid',
    canonicalHash: '#text-utilities-workbench/uuid'
  });
});

test('filters hidden tools from visible and available catalogue helpers', () => {
  assert.deepEqual(getVisibleTools(FIXTURE_CATALOGUE).map(tool => tool.id), [
    'json-data-workbench',
    'csv-tsv-helper',
    'planned-helper'
  ]);
  assert.deepEqual(getAvailableTools(FIXTURE_CATALOGUE).map(tool => tool.id), [
    'json-data-workbench',
    'csv-tsv-helper'
  ]);
  assert.deepEqual(getCategories(FIXTURE_CATALOGUE), ['JSON & data', 'Roadmap']);
  assert.equal(getToolById('hidden-legacy-tool', FIXTURE_CATALOGUE)?.hidden, true);
});

test('searches titles, summaries, mode labels and legacy search terms', () => {
  const workbench = getToolById('json-data-workbench', FIXTURE_CATALOGUE);

  assert.equal(matchesToolSearch(workbench, 'JSON diff'), true);
  assert.equal(matchesToolSearch(workbench, 'schema validation'), true);
  assert.equal(matchesToolSearch(workbench, 'XML data explorer'), true);
  assert.equal(matchesToolSearch(workbench, 'image'), false);
});

test('resolves canonical tool routes and mode routes', () => {
  const defaultRoute = resolveToolRoute('#json-data-workbench', FIXTURE_CATALOGUE);
  const modeRoute = resolveToolRoute('#json-data-workbench/diff', FIXTURE_CATALOGUE);

  assert.equal(defaultRoute.tool.id, 'json-data-workbench');
  assert.equal(defaultRoute.mode, 'format');
  assert.equal(defaultRoute.canonicalHash, '#json-data-workbench');
  assert.equal(defaultRoute.isAlias, false);
  assert.equal(defaultRoute.isCanonical, true);

  assert.equal(modeRoute.tool.id, 'json-data-workbench');
  assert.equal(modeRoute.mode, 'diff');
  assert.equal(modeRoute.canonicalHash, '#json-data-workbench/diff');
  assert.equal(modeRoute.isAlias, false);
  assert.equal(modeRoute.isCanonical, true);
});

test('resolves legacy ids to canonical workbench modes', () => {
  const defaultAliasRoute = resolveToolRoute('#json-formatter', FIXTURE_CATALOGUE);
  const modeAliasRoute = resolveToolRoute('json-diff', FIXTURE_CATALOGUE);

  assert.equal(defaultAliasRoute.tool.id, 'json-data-workbench');
  assert.equal(defaultAliasRoute.mode, 'format');
  assert.equal(defaultAliasRoute.canonicalHash, '#json-data-workbench');
  assert.equal(defaultAliasRoute.isAlias, true);
  assert.equal(defaultAliasRoute.isCanonical, false);

  assert.equal(modeAliasRoute.tool.id, 'json-data-workbench');
  assert.equal(modeAliasRoute.mode, 'diff');
  assert.equal(modeAliasRoute.canonicalHash, '#json-data-workbench/diff');
  assert.equal(modeAliasRoute.isAlias, true);
});

test('falls back to default modes and ignores unknown hashes', () => {
  const invalidModeRoute = resolveToolRoute('#json-data-workbench/not-real', FIXTURE_CATALOGUE);

  assert.equal(invalidModeRoute.tool.id, 'json-data-workbench');
  assert.equal(invalidModeRoute.mode, 'format');
  assert.equal(invalidModeRoute.canonicalHash, '#json-data-workbench');
  assert.equal(resolveToolRoute('#missing-tool', FIXTURE_CATALOGUE), null);
  assert.equal(resolveToolRoute('#hidden-legacy-tool', FIXTURE_CATALOGUE), null);
});

test('builds canonical hashes with default modes omitted', () => {
  const workbench = getToolById('json-data-workbench', FIXTURE_CATALOGUE);

  assert.equal(buildToolHash(workbench), '#json-data-workbench');
  assert.equal(buildToolHash(workbench, 'format'), '#json-data-workbench');
  assert.equal(buildToolHash(workbench, 'schema'), '#json-data-workbench/schema');
});

test('reports invalid catalogue aliases and modes', () => {
  const result = validateToolCatalogue([
    {
      id: 'alpha',
      title: 'Alpha',
      category: 'One',
      status: 'available',
      summary: 'Alpha.',
      renderer: 'alpha',
      modes: ['one', 'one'],
      defaultMode: 'missing',
      legacyIds: ['old-alpha'],
      modeAliases: {
        'old-alpha-mode': 'missing'
      }
    },
    {
      id: 'alpha',
      title: 'Alpha duplicate',
      category: 'One',
      status: 'available',
      summary: 'Duplicate.',
      renderer: 'alpha-duplicate'
    },
    {
      id: 'beta',
      title: 'Beta',
      category: 'One',
      status: 'available',
      summary: 'Beta.',
      renderer: 'beta',
      legacyIds: ['old-alpha'],
      modeAliases: []
    },
    {
      id: 'visible-old',
      title: 'Visible old',
      category: 'One',
      status: 'available',
      summary: 'Visible old.',
      renderer: 'visible-old'
    },
    {
      id: 'gamma',
      title: 'Gamma',
      category: 'One',
      status: 'available',
      summary: 'Gamma.',
      renderer: 'gamma',
      legacyIds: ['visible-old']
    }
  ]);
  const errors = result.errors.join('\n');

  assert.equal(result.valid, false);
  assert.match(errors, /Duplicate tool id alpha\./);
  assert.match(errors, /alpha defaultMode missing does not match a mode\./);
  assert.match(errors, /alpha has duplicate mode one\./);
  assert.match(errors, /alpha mode alias old-alpha-mode references unknown mode missing\./);
  assert.match(errors, /beta modeAliases must be an object\./);
  assert.match(errors, /beta alias old-alpha is already used by alpha\./);
  assert.match(errors, /gamma alias visible-old conflicts with a visible tool id\./);
});

function resolveSummary(hashOrId) {
  const route = resolveToolRoute(hashOrId);

  return {
    toolId: route.tool.id,
    mode: route.mode,
    canonicalHash: route.canonicalHash
  };
}
