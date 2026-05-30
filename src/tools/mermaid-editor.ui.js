import {
  MERMAID_THEME_OPTIONS,
  MERMAID_VERSION,
  analyseMermaidSource,
  buildMermaidDownloadFileName,
  extractMermaidSource
} from './mermaid.js';
import {
  renderMermaidToSvg,
  svgToPngBlob
} from './mermaid-runtime.js';

export function renderMermaidEditor(container) {
  container.innerHTML = `
    <form class="tool-board mermaid-tool" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="mermaidTheme">Theme</label>
          <select id="mermaidTheme">
            ${MERMAID_THEME_OPTIONS.map(theme => `<option value="${theme.value}">${theme.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="mermaidFileName">File name</label>
          <input id="mermaidFileName" type="text" spellcheck="false" value="mermaid-diagram" />
        </div>

        <div class="button-row button-row--end">
          <button id="renderMermaidButton" class="primary" type="button">Render diagram</button>
          <button id="clearMermaidButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="field-stack">
        <label for="mermaidSourceInput">Mermaid source</label>
        <textarea id="mermaidSourceInput" spellcheck="false" placeholder="flowchart TD&#10;  start([Start]) --> done([Done])"></textarea>
      </div>

      <div class="output-toolbar">
        <label for="mermaidPreview">Preview</label>
        <div class="button-row">
          <button id="copyMermaidSourceButton" class="primary" type="button" disabled>Copy source</button>
          <a id="downloadMermaidSourceButton" class="button secondary" href="#" download="mermaid-diagram.mmd" hidden>Download MMD</a>
          <a id="downloadMermaidSvgButton" class="button secondary" href="#" download="mermaid-diagram.svg" hidden>Download SVG</a>
          <a id="downloadMermaidPngButton" class="button secondary" href="#" download="mermaid-diagram.png" hidden>Download PNG</a>
        </div>
      </div>

      <div id="mermaidPreview" class="mermaid-preview" aria-live="polite">
        <p class="empty-state">Render a Mermaid diagram to preview it here.</p>
      </div>

      <textarea id="mermaidSvgOutput" spellcheck="false" readonly hidden></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Diagram type</span>
          <strong id="mermaidTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Source size</span>
          <strong id="mermaidSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Lines</span>
          <strong id="mermaidLinesDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Runtime</span>
          <strong id="mermaidRuntimeDetail">Mermaid ${MERMAID_VERSION}</strong>
        </div>
      </div>

      <div id="mermaidStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const sourceInput = container.querySelector('#mermaidSourceInput');
  const theme = container.querySelector('#mermaidTheme');
  const fileName = container.querySelector('#mermaidFileName');
  const renderButton = container.querySelector('#renderMermaidButton');
  const clearButton = container.querySelector('#clearMermaidButton');
  const copyButton = container.querySelector('#copyMermaidSourceButton');
  const sourceDownload = container.querySelector('#downloadMermaidSourceButton');
  const svgDownload = container.querySelector('#downloadMermaidSvgButton');
  const pngDownload = container.querySelector('#downloadMermaidPngButton');
  const preview = container.querySelector('#mermaidPreview');
  const svgOutput = container.querySelector('#mermaidSvgOutput');
  const typeDetail = container.querySelector('#mermaidTypeDetail');
  const sizeDetail = container.querySelector('#mermaidSizeDetail');
  const linesDetail = container.querySelector('#mermaidLinesDetail');
  const status = container.querySelector('#mermaidStatus');

  const objectUrls = [];

  function trackObjectUrl(url) {
    objectUrls.push(url);
    return url;
  }

  function revokeObjectUrls() {
    while (objectUrls.length > 0) {
      URL.revokeObjectURL(objectUrls.pop());
    }

    [sourceDownload, svgDownload, pngDownload].forEach(link => {
      link.hidden = true;
      link.removeAttribute('href');
    });
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function resetDetails() {
    typeDetail.textContent = '-';
    sizeDetail.textContent = '-';
    linesDetail.textContent = '-';
  }

  function setDetails(analysis, renderedType = '') {
    typeDetail.textContent = renderedType || analysis.diagramType;
    sizeDetail.textContent = analysis.outputSizeLabel;
    linesDetail.textContent = analysis.lineCount.toLocaleString('en-GB');
  }

  async function renderDiagram() {
    const source = extractMermaidSource(sourceInput.value);

    if (!source) {
      setStatus('Enter Mermaid source before rendering.', 'error');
      return;
    }

    renderButton.disabled = true;
    setStatus('Rendering Mermaid locally...', null);

    try {
      const analysis = analyseMermaidSource(source);
      const rendered = await renderMermaidToSvg(source, { theme: theme.value });
      const baseName = fileName.value || 'mermaid-diagram';

      revokeObjectUrls();
      sourceInput.value = rendered.source;
      svgOutput.value = rendered.svg;
      preview.innerHTML = rendered.svg;
      rendered.bindFunctions?.(preview);
      copyButton.disabled = false;

      setDownload(sourceDownload, rendered.source, 'text/plain;charset=utf-8', buildMermaidDownloadFileName(baseName, 'mmd'), 'Download MMD');
      setDownload(svgDownload, rendered.svg, 'image/svg+xml;charset=utf-8', buildMermaidDownloadFileName(baseName, 'svg'), 'Download SVG');

      setDetails(analysis, rendered.diagramType || analysis.diagramType);

      try {
        const pngBlob = await svgToPngBlob(rendered.svg);
        const pngUrl = trackObjectUrl(URL.createObjectURL(pngBlob));
        const pngFileName = buildMermaidDownloadFileName(baseName, 'png');
        pngDownload.href = pngUrl;
        pngDownload.download = pngFileName;
        pngDownload.textContent = `Download ${pngFileName}`;
        pngDownload.hidden = false;
        setStatus('Mermaid diagram rendered successfully.', 'success');
      } catch {
        pngDownload.hidden = true;
        pngDownload.removeAttribute('href');
        setStatus('Mermaid diagram rendered successfully. PNG export is unavailable in this browser.', null);
      }
    } catch (error) {
      preview.innerHTML = '<p class="empty-state">The diagram could not be rendered.</p>';
      svgOutput.value = '';
      copyButton.disabled = !sourceInput.value.trim();
      revokeObjectUrls();
      const analysis = analyseMermaidSource(sourceInput.value);
      setDetails(analysis);
      setStatus(error.message || 'Unable to render this Mermaid diagram.', 'error');
    } finally {
      renderButton.disabled = false;
    }
  }

  function setDownload(link, content, mimeType, downloadName, label) {
    const blob = new Blob([content], { type: mimeType });
    const url = trackObjectUrl(URL.createObjectURL(blob));
    link.href = url;
    link.download = downloadName;
    link.textContent = `${label.replace(/ .*/, '')} ${downloadName}`;
    link.hidden = false;
  }

  async function copySource() {
    const source = extractMermaidSource(sourceInput.value);

    if (!source) {
      setStatus('There is no Mermaid source to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(source);
      setStatus('Mermaid source copied to the clipboard.', 'success');
    } catch {
      sourceInput.focus();
      sourceInput.select();
      document.execCommand('copy');
      setStatus('Mermaid source selected and copied using the browser fallback.', 'success');
    }
  }

  sourceInput.addEventListener('input', () => {
    const analysis = analyseMermaidSource(sourceInput.value);
    copyButton.disabled = !analysis.source;
    setDetails(analysis);
  });
  renderButton.addEventListener('click', renderDiagram);
  copyButton.addEventListener('click', copySource);
  clearButton.addEventListener('click', () => {
    sourceInput.value = '';
    svgOutput.value = '';
    theme.value = 'default';
    fileName.value = 'mermaid-diagram';
    preview.innerHTML = '<p class="empty-state">Render a Mermaid diagram to preview it here.</p>';
    copyButton.disabled = true;
    revokeObjectUrls();
    resetDetails();
    setStatus('Ready.', null);
    sourceInput.focus();
  });

  return () => revokeObjectUrls();
}
