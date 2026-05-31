import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  TOOL_CATALOGUE,
  getVisibleTools
} from '../../src/tools/catalog.js';

const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
const roadmap = await readFile(new URL('../../docs/ROADMAP.md', import.meta.url), 'utf8');

test('keeps the README available tool list aligned with the visible catalogue', () => {
  const visibleToolTitles = getVisibleTools().map(tool => tool.title);
  const readmeToolTitles = extractBulletsAfter(
    readme,
    'The catalogue currently exposes these available tools in the app menu:'
  );

  assert.deepEqual(readmeToolTitles, visibleToolTitles);

  const platformCapabilities = extractBulletsAfter(
    readme,
    'The implemented platform capabilities around those tools include:'
  );

  assert.equal(platformCapabilities.some(item => visibleToolTitles.includes(item)), false);
});

test('documents legacy catalogue aliases as compatibility routes', () => {
  const visibleToolCount = getVisibleTools().length;
  const hiddenAliasCount = TOOL_CATALOGUE.filter(tool => tool.hidden).length;

  assert.match(
    readme,
    new RegExp(`The catalogue currently has ${visibleToolCount} visible tools and ${hiddenAliasCount} hidden legacy alias entries\\.`)
  );
  assert.match(readme, /compatibility routes rather than separate menu items/);
  assert.match(
    roadmap,
    new RegExp(`The app menu currently exposes ${visibleToolCount} available tools`)
  );
  assert.match(
    roadmap,
    new RegExp(`The catalogue preserves ${hiddenAliasCount} hidden legacy alias entries`)
  );
});

test('keeps planned tool documentation aligned with the current visible catalogue', () => {
  const visiblePlannedTools = getVisibleTools().filter(tool => tool.status === 'planned');

  assert.equal(visiblePlannedTools.length, 0);
  assert.match(roadmap, /There are currently no visible planned tools/);
});

function extractBulletsAfter(markdown, marker) {
  const markerIndex = markdown.indexOf(marker);

  assert.notEqual(markerIndex, -1, `Missing marker: ${marker}`);

  const afterMarker = markdown.slice(markerIndex + marker.length).trimStart();
  const bulletBlock = afterMarker.split(/\r?\n\r?\n/)[0];

  return bulletBlock
    .split(/\r?\n/)
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2).trim());
}
