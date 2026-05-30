import {
  MERMAID_TEMPLATE_TYPES,
  analyseMermaidSource,
  buildMermaidDownloadFileName,
  buildMermaidTemplate
} from './mermaid.js';

export function renderMermaidTemplateBuilder(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="mermaidTemplateType">Template type</label>
          <select id="mermaidTemplateType">
            ${MERMAID_TEMPLATE_TYPES.map(template => `<option value="${template.value}">${template.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="mermaidTemplateTitle">Title</label>
          <input id="mermaidTemplateTitle" type="text" spellcheck="false" placeholder="Release workflow" />
        </div>

        <div class="button-row button-row--end">
          <button id="buildMermaidTemplateButton" class="primary" type="button">Use template</button>
          <button id="clearMermaidTemplateButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="mermaidTemplatePrimary">Primary item</label>
          <input id="mermaidTemplatePrimary" type="text" spellcheck="false" placeholder="Client" />
        </div>

        <div class="field-stack">
          <label for="mermaidTemplateSecondary">Secondary item</label>
          <input id="mermaidTemplateSecondary" type="text" spellcheck="false" placeholder="Service" />
        </div>
      </div>

      <div class="output-toolbar">
        <label for="mermaidTemplateOutput">Mermaid output</label>
        <div class="button-row">
          <button id="copyMermaidTemplateButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadMermaidTemplateButton" class="button secondary" href="#" download="mermaid-template.mmd" hidden>Download output</a>
        </div>
      </div>

      <textarea id="mermaidTemplateOutput" spellcheck="false" readonly placeholder="The generated Mermaid source will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Template type</span>
          <strong id="mermaidTemplateTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Diagram type</span>
          <strong id="mermaidTemplateDiagramDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Lines</span>
          <strong id="mermaidTemplateLinesDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="mermaidTemplateSizeDetail">-</strong>
        </div>
      </div>

      <div id="mermaidTemplateStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const templateType = container.querySelector('#mermaidTemplateType');
  const title = container.querySelector('#mermaidTemplateTitle');
  const primary = container.querySelector('#mermaidTemplatePrimary');
  const secondary = container.querySelector('#mermaidTemplateSecondary');
  const buildButton = container.querySelector('#buildMermaidTemplateButton');
  const clearButton = container.querySelector('#clearMermaidTemplateButton');
  const copyButton = container.querySelector('#copyMermaidTemplateButton');
  const downloadButton = container.querySelector('#downloadMermaidTemplateButton');
  const output = container.querySelector('#mermaidTemplateOutput');
  const typeDetail = container.querySelector('#mermaidTemplateTypeDetail');
  const diagramDetail = container.querySelector('#mermaidTemplateDiagramDetail');
  const linesDetail = container.querySelector('#mermaidTemplateLinesDetail');
  const sizeDetail = container.querySelector('#mermaidTemplateSizeDetail');
  const status = container.querySelector('#mermaidTemplateStatus');

  let currentObjectUrl = null;

  function revokeObjectUrl() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    downloadButton.hidden = true;
    downloadButton.removeAttribute('href');
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function resetDetails() {
    typeDetail.textContent = '-';
    diagramDetail.textContent = '-';
    linesDetail.textContent = '-';
    sizeDetail.textContent = '-';
  }

  function handleBuild() {
    const result = buildMermaidTemplate({
      template: templateType.value,
      title: title.value,
      primary: primary.value,
      secondary: secondary.value
    });

    output.value = result.output;
    copyButton.disabled = false;
    typeDetail.textContent = result.templateLabel;
    diagramDetail.textContent = result.outputType;
    linesDetail.textContent = result.lineCount.toLocaleString('en-GB');
    sizeDetail.textContent = result.outputSizeLabel;
    revokeObjectUrl();

    const blob = new Blob([result.output], { type: 'text/plain;charset=utf-8' });
    const fileName = buildMermaidDownloadFileName(result.title || result.templateLabel, 'mmd');
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
    setStatus('Mermaid template generated successfully.', 'success');
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no Mermaid output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Mermaid output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Mermaid output selected and copied using the browser fallback.', 'success');
    }
  }

  output.addEventListener('input', () => {
    const analysis = analyseMermaidSource(output.value);
    diagramDetail.textContent = analysis.diagramType;
    linesDetail.textContent = analysis.lineCount.toLocaleString('en-GB');
    sizeDetail.textContent = analysis.outputSizeLabel;
  });
  buildButton.addEventListener('click', handleBuild);
  copyButton.addEventListener('click', copyOutput);
  clearButton.addEventListener('click', () => {
    templateType.value = 'flowchart';
    title.value = '';
    primary.value = '';
    secondary.value = '';
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    title.focus();
  });

  return () => revokeObjectUrl();
}
