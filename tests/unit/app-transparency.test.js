import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APP_PHILOSOPHY,
  TRANSPARENCY_LIBRARY_ENTRIES
} from '../../src/app-transparency.js';
import { TOOL_CATALOGUE } from '../../src/tools/catalog.js';

test('defines concise local-first philosophy copy', () => {
  assert.ok(APP_PHILOSOPHY.length >= 3);

  for (const item of APP_PHILOSOPHY) {
    assert.equal(typeof item.title, 'string');
    assert.notEqual(item.title.trim(), '');
    assert.equal(typeof item.summary, 'string');
    assert.notEqual(item.summary.trim(), '');
  }
});

test('defines complete library transparency entries with official HTTPS links', () => {
  assert.deepEqual(
    TRANSPARENCY_LIBRARY_ENTRIES.map(entry => entry.name),
    ['PDF.js', 'Playwright', 'pdf-lib', 'Node.js test runner']
  );

  for (const entry of TRANSPARENCY_LIBRARY_ENTRIES) {
    assert.equal(typeof entry.name, 'string');
    assert.equal(typeof entry.scope, 'string');
    assert.equal(typeof entry.usage, 'string');
    assert.equal(typeof entry.note, 'string');
    assert.ok(entry.usedBy.length > 0);

    const website = new URL(entry.website);
    assert.equal(website.protocol, 'https:');
  }
});

test('maps runtime libraries to available tools and keeps testing libraries out of the published app', () => {
  const availableToolTitles = new Set(
    TOOL_CATALOGUE
      .filter(tool => tool.status === 'available')
      .map(tool => tool.title)
  );

  const runtimeEntries = TRANSPARENCY_LIBRARY_ENTRIES.filter(entry => entry.loadedByPublishedApp);
  assert.deepEqual(runtimeEntries.map(entry => entry.name), ['PDF.js']);

  for (const entry of runtimeEntries) {
    for (const toolTitle of entry.usedBy) {
      assert.equal(availableToolTitles.has(toolTitle), true);
    }
  }

  const testingOnlyEntries = TRANSPARENCY_LIBRARY_ENTRIES.filter(entry => entry.scope === 'Testing only');
  assert.ok(testingOnlyEntries.length > 0);
  testingOnlyEntries.forEach(entry => {
    assert.equal(entry.loadedByPublishedApp, false);
    assert.match(entry.note, /not loaded by the published app/i);
  });
});
