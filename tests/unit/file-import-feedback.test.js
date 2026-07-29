import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  formatFileImportState,
  formatFileSelectionTitle,
  formatFileSize
} from '../../src/tools/file-import-feedback.js';

test('formats a selected file with a local processing confirmation', () => {
  const file = { name: 'solution.zip', size: 13_926 };

  assert.equal(formatFileSelectionTitle(file), 'solution.zip');
  assert.equal(
    formatFileImportState(file, { kind: 'ZIP' }),
    'ZIP selected · 13.6 KB · ready to process'
  );
  assert.equal(
    formatFileImportState(file, { kind: 'ZIP', state: 'loaded' }),
    'ZIP loaded successfully · 13.6 KB'
  );
});

test('summarises multiple files and their combined size', () => {
  const files = [
    { name: 'one.png', size: 1024 },
    { name: 'two.png', size: 2048 }
  ];

  assert.equal(formatFileSelectionTitle(files), '2 files selected');
  assert.equal(
    formatFileImportState(files, { kind: 'Image' }),
    '2 images selected · 3 KB · ready to process'
  );
});

test('formats bounded file sizes using British English', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(1024), '1 KB');
  assert.equal(formatFileSize(1_572_864), '1.5 MB');
});

test('all file drop-zone tools use the shared visual feedback controller', async () => {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const toolsDirectory = path.resolve(testDirectory, '../../src/tools');
  const files = (await readdir(toolsDirectory))
    .filter(file => file.endsWith('.ui.js'));
  const missing = [];

  for (const file of files) {
    const source = await readFile(path.join(toolsDirectory, file), 'utf8');

    if (source.includes('class="drop-zone"') && !source.includes('bindFileImportFeedback')) {
      missing.push(file);
    }
  }

  assert.deepEqual(missing, []);
});
