import {
  DATA_MERMAID_DIAGRAMS,
  DATA_MERMAID_FORMATS,
  buildMermaidDownloadFileName,
  convertDataToMermaid
} from './mermaid.js';

export function renderDataToMermaid(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="dataMermaidInputFormat">Input format</label>
          <select id="dataMermaidInputFormat">
            ${DATA_MERMAID_FORMATS.map(format => `<option value="${format.value}">${format.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="dataMermaidDiagramType">Diagram</label>
          <select id="dataMermaidDiagramType">
            ${DATA_MERMAID_DIAGRAMS.map(diagram => `<option value="${diagram.value}">${diagram.label}</option>`).join('')}
          </select>
        </div>

        <div class="button-row button-row--end">
          <button id="generateDataMermaidButton" class="primary" type="button">Generate Mermaid</button>
          <button id="clearDataMermaidButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="dataMermaidLabelField">Label field</label>
          <input id="dataMermaidLabelField" type="text" spellcheck="false" placeholder="name, status or category" />
        </div>

        <div class="field-stack">
          <label for="dataMermaidValueField">Value field</label>
          <input id="dataMermaidValueField" type="text" spellcheck="false" placeholder="count, total or amount" />
        </div>

        <div class="field-stack">
          <label for="dataMermaidEntityName">Entity name</label>
          <input id="dataMermaidEntityName" type="text" spellcheck="false" placeholder="Record" />
        </div>
      </div>

      <div class="field-stack">
        <label for="dataMermaidInput">JSON, CSV or TSV input</label>
        <textarea id="dataMermaidInput" spellcheck="false" placeholder='[{"name":"Active","count":12},{"name":"Paused","count":4}]'></textarea>
      </div>

      <div class="output-toolbar">
        <label for="dataMermaidOutput">Mermaid output</label>
        <div class="button-row">
          <button id="copyDataMermaidButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadDataMermaidButton" class="button secondary" href="#" download="data-mermaid.mmd" hidden>Download output</a>
        </div>
      </div>

      <textarea id="dataMermaidOutput" spellcheck="false" readonly placeholder="The generated Mermaid source will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Detected input</span>
          <strong id="dataMermaidInputDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Diagram type</span>
          <strong id="dataMermaidTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Records</span>
          <strong id="dataMermaidRecordsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="dataMermaidWarningsDetail">-</strong>
        </div>
      </div>

      <div id="dataMermaidStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const inputFormat = container.querySelector('#dataMermaidInputFormat');
  const diagramType = container.querySelector('#dataMermaidDiagramType');
  const labelField = container.querySelector('#dataMermaidLabelField');
  const valueField = container.querySelector('#dataMermaidValueField');
  const entityName = container.querySelector('#dataMermaidEntityName');
  const input = container.querySelector('#dataMermaidInput');
  const output = container.querySelector('#dataMermaidOutput');
  const generateButton = container.querySelector('#generateDataMermaidButton');
  const clearButton = container.querySelector('#clearDataMermaidButton');
  const copyButton = container.querySelector('#copyDataMermaidButton');
  const downloadButton = container.querySelector('#downloadDataMermaidButton');
  const inputDetail = container.querySelector('#dataMermaidInputDetail');
  const typeDetail = container.querySelector('#dataMermaidTypeDetail');
  const recordsDetail = container.querySelector('#dataMermaidRecordsDetail');
  const warningsDetail = container.querySelector('#dataMermaidWarningsDetail');
  const status = container.querySelector('#dataMermaidStatus');

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
    inputDetail.textContent = '-';
    typeDetail.textContent = '-';
    recordsDetail.textContent = '-';
    warningsDetail.textContent = '-';
  }

  function handleGenerate() {
    try {
      const result = convertDataToMermaid({
        input: input.value,
        inputFormat: inputFormat.value,
        diagramType: diagramType.value,
        labelField: labelField.value,
        valueField: valueField.value,
        entityName: entityName.value
      });

      output.value = result.output;
      copyButton.disabled = false;
      inputDetail.textContent = result.inputFormatLabel;
      typeDetail.textContent = result.outputType;
      recordsDetail.textContent = (result.recordCount || 0).toLocaleString('en-GB');
      warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
      revokeObjectUrl();

      const blob = new Blob([result.output], { type: 'text/plain;charset=utf-8' });
      const fileName = buildMermaidDownloadFileName(result.diagramTypeLabel, 'mmd');
      currentObjectUrl = URL.createObjectURL(blob);
      downloadButton.href = currentObjectUrl;
      downloadButton.download = fileName;
      downloadButton.textContent = `Download ${fileName}`;
      downloadButton.hidden = false;
      setStatus(result.warnings[0] || 'Mermaid diagram generated from data successfully.', result.warnings.length ? null : 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to generate Mermaid from this data.', 'error');
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
    inputFormat.value = 'auto';
    diagramType.value = 'tree';
    labelField.value = '';
    valueField.value = '';
    entityName.value = '';
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
