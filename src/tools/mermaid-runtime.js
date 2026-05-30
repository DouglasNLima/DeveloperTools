import mermaid from '../vendor/mermaid/mermaid.esm.min.mjs';

import {
  MERMAID_THEME_OPTIONS,
  extractMermaidSource,
  normaliseMermaidSource
} from './mermaid.js';

let configured = false;
let renderCounter = 0;

export async function renderMermaidToSvg(source, options = {}) {
  const diagramSource = normaliseMermaidSource(extractMermaidSource(source));

  if (!diagramSource) {
    throw new Error('Enter Mermaid source before rendering.');
  }

  configureMermaid(options.theme);
  await mermaid.parse(diagramSource);

  renderCounter += 1;
  const id = `developer-tools-mermaid-${Date.now()}-${renderCounter}`;
  const result = await mermaid.render(id, diagramSource);

  return {
    source: diagramSource,
    svg: result.svg,
    bindFunctions: result.bindFunctions,
    diagramType: detectMermaidType(diagramSource)
  };
}

export async function svgToPngBlob(svg, options = {}) {
  const svgText = String(svg ?? '').trim();

  if (!svgText) {
    throw new Error('Render a diagram before exporting PNG.');
  }

  const image = await loadSvgImage(svgText);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const padding = Number.isFinite(options.padding) ? options.padding : 24;
  const background = options.background || '#ffffff';

  canvas.width = Math.max(1, Math.ceil(image.width + padding * 2));
  canvas.height = Math.max(1, Math.ceil(image.height + padding * 2));
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, padding, padding);

  return canvasToBlob(canvas, 'image/png');
}

function configureMermaid(theme) {
  const selectedTheme = MERMAID_THEME_OPTIONS.some(option => option.value === theme) ? theme : 'default';

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: selectedTheme,
    htmlLabels: false,
    flowchart: {
      htmlLabels: false,
      useMaxWidth: true
    },
    sequence: {
      useMaxWidth: true
    }
  });
  configured = true;
}

function detectMermaidType(source) {
  try {
    return mermaid.detectType(source);
  } catch {
    return '';
  }
}

function loadSvgImage(svg) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        image,
        width: image.naturalWidth || 800,
        height: image.naturalHeight || 600
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The rendered SVG could not be rasterised by this browser.'));
    };
    image.src = url;
  }).then(result => {
    result.image.width = result.width;
    result.image.height = result.height;
    return result.image;
  });
}

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('This browser could not create a PNG export.'));
        return;
      }

      resolve(blob);
    }, mimeType);
  });
}
