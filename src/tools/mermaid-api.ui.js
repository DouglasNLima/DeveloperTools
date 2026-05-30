import {
  API_MERMAID_DIAGRAMS,
  API_MERMAID_MODES,
  buildMermaidDownloadFileName,
  convertApiWorkflowToMermaid
} from './mermaid.js';

export function renderApiWorkflowToMermaid(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="apiMermaidMode">Input mode</label>
          <select id="apiMermaidMode">
            ${API_MERMAID_MODES.map(mode => `<option value="${mode.value}">${mode.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="apiMermaidDiagramType">Diagram</label>
          <select id="apiMermaidDiagramType">
            ${API_MERMAID_DIAGRAMS.map(diagram => `<option value="${diagram.value}">${diagram.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="apiMermaidTitle">Title</label>
          <input id="apiMermaidTitle" type="text" spellcheck="false" placeholder="API workflow" />
        </div>
      </div>

      <div class="button-row">
        <button id="generateApiMermaidButton" class="primary" type="button">Generate Mermaid</button>
        <button id="clearApiMermaidButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="field-stack">
        <label for="apiMermaidInput">Request, endpoint note or step list</label>
        <textarea id="apiMermaidInput" spellcheck="false" placeholder="curl -X POST https://api.example.test/orders -H 'Content-Type: application/json' --data-raw '{&quot;status&quot;:&quot;new&quot;}'"></textarea>
      </div>

      <div class="output-toolbar">
        <label for="apiMermaidOutput">Mermaid output</label>
        <div class="button-row">
          <button id="copyApiMermaidButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadApiMermaidButton" class="button secondary" href="#" download="api-workflow.mmd" hidden>Download output</a>
        </div>
      </div>

      <textarea id="apiMermaidOutput" spellcheck="false" readonly placeholder="The generated Mermaid source will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Parsed as</span>
          <strong id="apiMermaidModeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Diagram type</span>
          <strong id="apiMermaidTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Request method</span>
          <strong id="apiMermaidMethodDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="apiMermaidWarningsDetail">-</strong>
        </div>
      </div>

      <div id="apiMermaidStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const mode = container.querySelector('#apiMermaidMode');
  const diagramType = container.querySelector('#apiMermaidDiagramType');
  const title = container.querySelector('#apiMermaidTitle');
  const input = container.querySelector('#apiMermaidInput');
  const output = container.querySelector('#apiMermaidOutput');
  const generateButton = container.querySelector('#generateApiMermaidButton');
  const clearButton = container.querySelector('#clearApiMermaidButton');
  const copyButton = container.querySelector('#copyApiMermaidButton');
  const downloadButton = container.querySelector('#downloadApiMermaidButton');
  const modeDetail = container.querySelector('#apiMermaidModeDetail');
  const typeDetail = container.querySelector('#apiMermaidTypeDetail');
  const methodDetail = container.querySelector('#apiMermaidMethodDetail');
  const warningsDetail = container.querySelector('#apiMermaidWarningsDetail');
  const status = container.querySelector('#apiMermaidStatus');

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
    modeDetail.textContent = '-';
    typeDetail.textContent = '-';
    methodDetail.textContent = '-';
    warningsDetail.textContent = '-';
  }

  function handleGenerate() {
    try {
      const result = convertApiWorkflowToMermaid({
        input: input.value,
        mode: mode.value,
        diagramType: diagramType.value,
        title: title.value
      });

      output.value = result.output;
      copyButton.disabled = false;
      modeDetail.textContent = result.modeLabel;
      typeDetail.textContent = result.outputType;
      methodDetail.textContent = result.request?.method || '-';
      warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
      revokeObjectUrl();

      const blob = new Blob([result.output], { type: 'text/plain;charset=utf-8' });
      const fileName = buildMermaidDownloadFileName(title.value || 'api-workflow', 'mmd');
      currentObjectUrl = URL.createObjectURL(blob);
      downloadButton.href = currentObjectUrl;
      downloadButton.download = fileName;
      downloadButton.textContent = `Download ${fileName}`;
      downloadButton.hidden = false;
      setStatus(result.warnings[0] || 'API workflow Mermaid diagram generated successfully.', result.warnings.length ? null : 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to generate Mermaid from this workflow.', 'error');
    }
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

  generateButton.addEventListener('click', handleGenerate);
  copyButton.addEventListener('click', copyOutput);
  clearButton.addEventListener('click', () => {
    mode.value = 'auto';
    diagramType.value = 'sequence';
    title.value = '';
    input.value = '';
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    input.focus();
  });

  return () => revokeObjectUrl();
}
