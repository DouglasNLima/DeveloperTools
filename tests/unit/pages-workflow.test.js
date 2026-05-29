import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('GitHub Pages publish workflow includes PWA static assets', async () => {
  const workflow = await readFile('.github/workflows/pages.yml', 'utf8');

  assert.match(workflow, /manifest\.webmanifest/);
  assert.match(workflow, /sw\.js/);
  assert.match(workflow, /cp -R assets _site\/assets/);
});
