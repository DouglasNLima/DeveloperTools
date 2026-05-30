import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  APP_BUILD,
  APP_NAME,
  APP_TITLE,
  APP_VERSION,
  formatAppTitle
} from '../../src/app-metadata.js';

const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
const indexHtml = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const devtoolsHtml = await readFile(new URL('../../devtools.html', import.meta.url), 'utf8');
const serviceWorkerSource = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');

test('formats the versioned app title consistently', () => {
  assert.equal(APP_TITLE, 'Developer Tools v0.1.0 (build 14)');
  assert.equal(formatAppTitle(), APP_TITLE);
  assert.equal(formatAppTitle({
    name: 'Developer Tools',
    version: '1.2.3',
    build: '42'
  }), 'Developer Tools v1.2.3 (build 42)');
});

test('keeps app metadata aligned with package and static shell files', () => {
  assert.equal(APP_NAME, 'Developer Tools');
  assert.equal(APP_VERSION, packageJson.version);
  assert.match(indexHtml, new RegExp(`<title>${escapeRegExp(APP_TITLE)}</title>`));
  assert.match(devtoolsHtml, new RegExp(`<title>${escapeRegExp(APP_TITLE)}</title>`));
});

test('keeps the visible build stamp aligned with the offline cache version', () => {
  assert.match(serviceWorkerSource, new RegExp(`developer-tools-static-v${escapeRegExp(APP_BUILD)}`));
  assert.match(serviceWorkerSource, /'\.\/src\/app-metadata\.js'/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
