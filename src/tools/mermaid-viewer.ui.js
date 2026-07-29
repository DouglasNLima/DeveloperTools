import { writeTextToClipboard } from './clipboard-feedback.js';
import { renderMermaidToSvg, svgToPngBlob } from './mermaid-runtime.js';
import {
  buildMermaidViewerFileNames,
  calculateMermaidFitTransform,
  calculateMermaidZoomTransform,
  clampMermaidViewerZoom
} from './mermaid-viewer.js';

const ZOOM_STEP = 1.2;
const PAN_STEP = 36;

export function bindMermaidViewer(root, options = {}) {
  const label = options.label || 'Mermaid diagram';
  const emptyMessage = options.emptyMessage || 'Choose a diagram to render.';
  const setStatus = typeof options.setStatus === 'function' ? options.setStatus : () => {};
  const onSourceChange = typeof options.onSourceChange === 'function' ? options.onSourceChange : () => {};

  root.className = 'mermaid-viewer';
  root.innerHTML = `
    <div class="mermaid-viewer-toolbar" data-mermaid-viewer-toolbar hidden>
      <div class="button-row">
        <button class="secondary" type="button" data-mermaid-copy-source>Copy Mermaid</button>
        <button class="secondary" type="button" data-mermaid-copy-svg>Copy SVG</button>
        <a class="button secondary" href="#" download="diagram.mmd" data-mermaid-download-source hidden>Download MMD</a>
        <a class="button secondary" href="#" download="diagram.svg" data-mermaid-download-svg hidden>Download SVG</a>
        <a class="button secondary" href="#" download="diagram.png" data-mermaid-download-png hidden>Download PNG</a>
      </div>
      <div class="button-row mermaid-viewer-navigation" aria-label="Diagram navigation">
        <button class="secondary" type="button" aria-label="Zoom out" title="Zoom out" data-mermaid-zoom-out>−</button>
        <span class="pill" data-mermaid-zoom-level aria-label="Zoom level">100%</span>
        <button class="secondary" type="button" aria-label="Zoom in" title="Zoom in" data-mermaid-zoom-in>+</button>
        <button class="secondary" type="button" data-mermaid-fit>Fit diagram</button>
      </div>
    </div>
    <div
      class="mermaid-viewer-viewport"
      tabindex="0"
      role="img"
      aria-label="${escapeAttribute(label)}. Drag to pan, use the mouse wheel or controls to zoom."
      data-mermaid-viewport
    >
      <div class="mermaid-viewer-canvas is-empty" data-mermaid-canvas>
        <p class="empty-state">${escapeHtml(emptyMessage)}</p>
      </div>
    </div>
    <p class="hint mermaid-viewer-hint" data-mermaid-viewer-hint hidden>Drag to pan · use the mouse wheel to zoom · arrow keys pan the diagram</p>
  `;

  const toolbar = root.querySelector('[data-mermaid-viewer-toolbar]');
  const viewport = root.querySelector('[data-mermaid-viewport]');
  const canvas = root.querySelector('[data-mermaid-canvas]');
  const hint = root.querySelector('[data-mermaid-viewer-hint]');
  const copySourceButton = root.querySelector('[data-mermaid-copy-source]');
  const copySvgButton = root.querySelector('[data-mermaid-copy-svg]');
  const sourceDownload = root.querySelector('[data-mermaid-download-source]');
  const svgDownload = root.querySelector('[data-mermaid-download-svg]');
  const pngDownload = root.querySelector('[data-mermaid-download-png]');
  const zoomOutButton = root.querySelector('[data-mermaid-zoom-out]');
  const zoomInButton = root.querySelector('[data-mermaid-zoom-in]');
  const zoomLevel = root.querySelector('[data-mermaid-zoom-level]');
  const fitButton = root.querySelector('[data-mermaid-fit]');

  let source = '';
  let svgText = '';
  let transform = { zoom: 1, x: 0, y: 0 };
  let diagramSize = { width: 1, height: 1 };
  let dragState = null;
  let renderSequence = 0;
  const objectUrls = new Set();

  function applyTransform() {
    canvas.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`;
    zoomLevel.textContent = `${Math.round(transform.zoom * 100)}%`;
    zoomOutButton.disabled = transform.zoom <= 0.25;
    zoomInButton.disabled = transform.zoom >= 4;
  }

  function fit() {
    if (!svgText) {
      return;
    }

    transform = calculateMermaidFitTransform(
      { width: viewport.clientWidth, height: viewport.clientHeight },
      diagramSize
    );
    applyTransform();
  }

  function zoom(nextZoom, anchor = null) {
    if (!svgText) {
      return;
    }

    const resolvedAnchor = anchor || {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2
    };
    transform = calculateMermaidZoomTransform(transform, nextZoom, resolvedAnchor);
    applyTransform();
  }

  function setLoading(message = 'Rendering diagram...') {
    renderSequence += 1;
    revokeObjectUrls();
    source = '';
    svgText = '';
    onSourceChange('');
    toolbar.hidden = true;
    hint.hidden = true;
    canvas.removeAttribute('style');
    canvas.classList.add('is-empty');
    canvas.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
  }

  function clear(message = emptyMessage) {
    setLoading(message);
  }

  async function render(sourceText, renderOptions = {}) {
    const sequence = ++renderSequence;
    revokeObjectUrls();
    source = '';
    svgText = '';
    onSourceChange('');
    toolbar.hidden = true;
    hint.hidden = true;
    canvas.removeAttribute('style');
    canvas.classList.add('is-empty');
    canvas.innerHTML = '<p class="empty-state">Rendering diagram...</p>';

    const rendered = await renderMermaidToSvg(sourceText);

    if (sequence !== renderSequence) {
      return null;
    }

    source = rendered.source;
    svgText = rendered.svg;
    onSourceChange(source);
    canvas.classList.remove('is-empty');
    canvas.innerHTML = rendered.svg;
    rendered.bindFunctions?.(canvas);

    const svg = canvas.querySelector('svg');
    diagramSize = readSvgSize(svg);
    svg.style.width = `${diagramSize.width}px`;
    svg.style.height = `${diagramSize.height}px`;
    svg.style.maxWidth = 'none';
    svg.style.maxHeight = 'none';
    canvas.style.width = `${diagramSize.width}px`;
    canvas.style.height = `${diagramSize.height}px`;

    const names = buildMermaidViewerFileNames(renderOptions.fileName || 'workflow-diagram');
    setTextDownload(sourceDownload, source, 'text/plain;charset=utf-8', names.source);
    setTextDownload(svgDownload, svgText, 'image/svg+xml;charset=utf-8', names.svg);
    toolbar.hidden = false;
    hint.hidden = false;
    copySourceButton.disabled = false;
    copySvgButton.disabled = false;

    requestAnimationFrame(fit);
    createPngDownload(svgText, names.png, sequence);

    return rendered;
  }

  function setTextDownload(link, content, mimeType, name) {
    const url = trackObjectUrl(URL.createObjectURL(new Blob([content], { type: mimeType })));
    link.href = url;
    link.download = name;
    link.hidden = false;
  }

  async function createPngDownload(svg, name, sequence) {
    pngDownload.hidden = true;
    pngDownload.removeAttribute('href');

    try {
      const blob = await svgToPngBlob(svg);

      if (sequence !== renderSequence) {
        return;
      }

      pngDownload.href = trackObjectUrl(URL.createObjectURL(blob));
      pngDownload.download = name;
      pngDownload.hidden = false;
    } catch {
      if (sequence === renderSequence) {
        setStatus('The diagram is ready. PNG export is unavailable in this browser.', null);
      }
    }
  }

  async function copyText(value, successMessage) {
    if (!value) {
      setStatus('Render a diagram before copying it.', 'error');
      return;
    }

    try {
      await writeTextToClipboard(value);
    } catch {
      const fallback = document.createElement('textarea');
      fallback.value = value;
      fallback.setAttribute('readonly', '');
      fallback.className = 'visually-hidden';
      document.body.append(fallback);
      fallback.select();
      document.execCommand('copy');
      fallback.remove();
    }

    setStatus(successMessage, 'success');
  }

  function onPointerDown(event) {
    if (!svgText || event.button !== 0) {
      return;
    }

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: transform.x,
      y: transform.y
    };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-panning');
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    transform = {
      ...transform,
      x: dragState.x + event.clientX - dragState.startX,
      y: dragState.y + event.clientY - dragState.startY
    };
    applyTransform();
  }

  function endPointerPan(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragState = null;
    viewport.classList.remove('is-panning');

    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  }

  function onWheel(event) {
    if (!svgText) {
      return;
    }

    const bounds = viewport.getBoundingClientRect();
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoom(transform.zoom * factor, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    });
    event.preventDefault();
  }

  function onKeyDown(event) {
    if (!svgText) {
      return;
    }

    if (event.key === '+' || event.key === '=') {
      zoom(transform.zoom * ZOOM_STEP);
    } else if (event.key === '-') {
      zoom(transform.zoom / ZOOM_STEP);
    } else if (event.key === '0') {
      fit();
    } else if (event.key === 'ArrowLeft') {
      transform.x -= PAN_STEP;
    } else if (event.key === 'ArrowRight') {
      transform.x += PAN_STEP;
    } else if (event.key === 'ArrowUp') {
      transform.y -= PAN_STEP;
    } else if (event.key === 'ArrowDown') {
      transform.y += PAN_STEP;
    } else {
      return;
    }

    applyTransform();
    event.preventDefault();
  }

  function trackObjectUrl(url) {
    objectUrls.add(url);
    return url;
  }

  function revokeObjectUrls() {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls.clear();
    [sourceDownload, svgDownload, pngDownload].forEach(link => {
      link.hidden = true;
      link.removeAttribute('href');
    });
  }

  function destroy() {
    renderSequence += 1;
    revokeObjectUrls();
    viewport.removeEventListener('pointerdown', onPointerDown);
    viewport.removeEventListener('pointermove', onPointerMove);
    viewport.removeEventListener('pointerup', endPointerPan);
    viewport.removeEventListener('pointercancel', endPointerPan);
    viewport.removeEventListener('wheel', onWheel);
    viewport.removeEventListener('keydown', onKeyDown);
  }

  copySourceButton.addEventListener('click', () => copyText(source, 'Mermaid source copied to the clipboard.'));
  copySvgButton.addEventListener('click', () => copyText(svgText, 'Rendered SVG copied to the clipboard.'));
  zoomOutButton.addEventListener('click', () => zoom(transform.zoom / ZOOM_STEP));
  zoomInButton.addEventListener('click', () => zoom(transform.zoom * ZOOM_STEP));
  fitButton.addEventListener('click', fit);
  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', endPointerPan);
  viewport.addEventListener('pointercancel', endPointerPan);
  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('keydown', onKeyDown);

  return {
    clear,
    destroy,
    fit,
    render,
    setLoading,
    zoomIn: () => zoom(transform.zoom * ZOOM_STEP),
    zoomOut: () => zoom(transform.zoom / ZOOM_STEP)
  };
}

function readSvgSize(svg) {
  const viewBox = svg?.viewBox?.baseVal;
  const width = positiveSize(viewBox?.width)
    || positiveSize(svg?.width?.baseVal?.value)
    || positiveSize(svg?.getAttribute('width'))
    || 800;
  const height = positiveSize(viewBox?.height)
    || positiveSize(svg?.height?.baseVal?.value)
    || positiveSize(svg?.getAttribute('height'))
    || 600;

  return { width, height };
}

function positiveSize(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
