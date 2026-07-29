import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMermaidViewerFileNames,
  calculateMermaidFitTransform,
  calculateMermaidZoomTransform,
  clampMermaidViewerZoom
} from '../../src/tools/mermaid-viewer.js';

test('clamps Mermaid viewer zoom to safe limits', () => {
  assert.equal(clampMermaidViewerZoom(0.1), 0.25);
  assert.equal(clampMermaidViewerZoom(2), 2);
  assert.equal(clampMermaidViewerZoom(10), 4);
  assert.equal(clampMermaidViewerZoom('invalid'), 1);
});

test('fits and centres a Mermaid diagram inside its viewport', () => {
  assert.deepEqual(
    calculateMermaidFitTransform(
      { width: 1000, height: 600 },
      { width: 800, height: 400 },
      { padding: 20 }
    ),
    { zoom: 1, x: 100, y: 100 }
  );

  const reduced = calculateMermaidFitTransform(
    { width: 500, height: 300 },
    { width: 1000, height: 500 },
    { padding: 20 }
  );
  assert.equal(reduced.zoom, 0.46);
  assert.equal(reduced.x, 20);
  assert.equal(reduced.y, 35);
});

test('keeps the selected anchor stable while zooming', () => {
  assert.deepEqual(
    calculateMermaidZoomTransform(
      { zoom: 1, x: 20, y: 30 },
      2,
      { x: 100, y: 110 }
    ),
    { zoom: 2, x: -60, y: -50 }
  );
});

test('builds safe source and image export names', () => {
  assert.deepEqual(buildMermaidViewerFileNames('Account: review/diagram.svg'), {
    source: 'Account_ review_diagram.mmd',
    svg: 'Account_ review_diagram.svg',
    png: 'Account_ review_diagram.png'
  });
});
