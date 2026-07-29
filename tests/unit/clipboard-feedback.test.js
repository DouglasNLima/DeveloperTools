import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  showCopyFeedback,
  writeTextToClipboard
} from '../../src/tools/clipboard-feedback.js';

test('writes text and gives the active copy button visible feedback', async () => {
  const button = createButton('Copy output');
  const clipboard = {
    async writeText(value) {
      assert.equal(value, 'ready');
    }
  };
  let reset = null;

  await writeTextToClipboard('ready', {
    clipboard,
    documentRef: { activeElement: button },
    schedule: callback => {
      reset = callback;
      return 1;
    }
  });

  assert.equal(button.textContent, 'Copied');
  assert.equal(button.classList.has('copy-feedback-success'), true);
  assert.equal(button.attributes.get('aria-live'), 'polite');

  reset();
  assert.equal(button.textContent, 'Copy output');
  assert.equal(button.classList.has('copy-feedback-success'), false);
  assert.equal(button.attributes.has('aria-live'), false);
});

test('uses the local document fallback before confirming the copy', async () => {
  const button = createButton('Copy JSON');
  const fallback = {
    value: '',
    setAttribute() {},
    selectCalled: false,
    select() {
      this.selectCalled = true;
    },
    removeCalled: false,
    remove() {
      this.removeCalled = true;
    }
  };
  const documentRef = {
    activeElement: button,
    body: {
      append(node) {
        assert.equal(node, fallback);
      }
    },
    createElement(tagName) {
      assert.equal(tagName, 'textarea');
      return fallback;
    },
    execCommand(command) {
      assert.equal(command, 'copy');
      return true;
    }
  };

  await writeTextToClipboard('fallback value', {
    clipboard: {
      async writeText() {
        throw new Error('denied');
      }
    },
    documentRef,
    schedule: () => 1
  });

  assert.equal(fallback.value, 'fallback value');
  assert.equal(fallback.selectCalled, true);
  assert.equal(fallback.removeCalled, true);
  assert.equal(button.textContent, 'Copied');
});

test('shows failure feedback when native and fallback copying both fail', async () => {
  const button = createButton('Copy XML');

  await assert.rejects(
    () => writeTextToClipboard('value', {
      clipboard: {
        async writeText() {
          throw new Error('denied');
        }
      },
      documentRef: { activeElement: button },
      schedule: () => 1
    }),
    /denied/
  );

  assert.equal(button.textContent, 'Copy failed');
  assert.equal(button.classList.has('copy-feedback-error'), true);
});

test('ignores non-copy controls', () => {
  const button = createButton('Generate');

  showCopyFeedback(button, 'Copied', 'success', {
    schedule: () => 1
  });

  assert.equal(button.textContent, 'Generate');
});

test('routes every browser copy action through the shared feedback helper', async () => {
  const toolsDirectory = new URL('../../src/tools/', import.meta.url);
  const fileNames = (await readdir(toolsDirectory))
    .filter(fileName => fileName.endsWith('.ui.js'));
  const sources = await Promise.all(fileNames.map(async fileName => ({
    fileName,
    source: await readFile(new URL(fileName, toolsDirectory), 'utf8')
  })));
  const copyModules = sources.filter(item => item.source.includes('writeTextToClipboard('));

  assert.ok(copyModules.length >= 40);
  assert.deepEqual(
    sources.filter(item => item.source.includes('navigator.clipboard.writeText')).map(item => item.fileName),
    []
  );
  assert.deepEqual(
    copyModules
      .filter(item => !item.source.includes("import { writeTextToClipboard } from './clipboard-feedback.js';"))
      .map(item => item.fileName),
    []
  );
});

function createButton(text) {
  const attributes = new Map();
  const classes = new Set();

  return {
    tagName: 'BUTTON',
    textContent: text,
    dataset: {},
    attributes,
    classList: {
      add(...values) {
        values.forEach(value => classes.add(value));
      },
      remove(...values) {
        values.forEach(value => classes.delete(value));
      },
      has(value) {
        return classes.has(value);
      }
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    removeAttribute(name) {
      attributes.delete(name);
    }
  };
}
