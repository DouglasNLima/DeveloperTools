import {
  DELIMITER_OPTIONS,
  OUTPUT_FORMATS,
  buildDelimitedOutputFileName,
  processDelimitedData
} from './csv-tsv-helper.js';
import { bindFileDropZone } from './file-drop-zone.js';

const CSV_FILE_ACCEPT = '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain';

export function renderCsvTsvHelper(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="csvDelimiter">Delimiter</label>
          <select id="csvDelimiter">
            ${DELIMITER_OPTIONS.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="csvOutputFormat">Output format</label>
          <select id="csvOutputFormat">
            ${OUTPUT_FORMATS.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
          </select>
        </div>

        <div class="button-row button-row--end">
          <button id="processCsvButton" class="primary" type="button">Process data</button>
          <button id="clearCsvButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="option-grid">
        <label class="checkbox-row" for="csvFirstRowHeaders">
          <input id="csvFirstRowHeaders" type="checkbox" checked />
          <span>First row contains headers</span>
        </label>
        <div id="csvFileDropZone" class="drop-zone">
          <label for="csvFileInput" class="drop-zone-label">
            <span>Drop a CSV, TSV or text file here or browse</span>
            <small>The selected file is read locally into the input area.</small>
          </label>
          <input id="csvFileInput" type="file" accept="${CSV_FILE_ACCEPT}" />
        </div>
      </div>

      <div class="field-stack">
        <label for="csvInput">CSV/TSV input</label>
        <textarea id="csvInput" spellcheck="false" placeholder="name,email&#10;Ada Lovelace,ada@example.test&#10;Grace Hopper,grace@example.test"></textarea>
      </div>

      <div class="output-toolbar">
        <label for="csvOutput">Output</label>
        <div class="button-row">
          <button id="copyCsvButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadCsvButton" class="button secondary" href="#" download="delimited-output.json" hidden>Download output</a>
        </div>
      </div>

      <textarea id="csvOutput" spellcheck="false" readonly placeholder="Converted data will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Delimiter</span>
          <strong id="csvDelimiterDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Rows</span>
          <strong id="csvRowsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Columns</span>
          <strong id="csvColumnsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Empty cells</span>
          <strong id="csvEmptyCellsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Inconsistent rows</span>
          <strong id="csvInconsistentRowsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output type</span>
          <strong id="csvOutputTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="csvOutputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="csvWarningsDetail">-</strong>
        </div>
      </div>

      <div id="csvIssueList" class="csv-issue-list" aria-live="polite"></div>
      <div id="csvStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const delimiter = container.querySelector('#csvDelimiter');
  const outputFormat = container.querySelector('#csvOutputFormat');
  const firstRowHeaders = container.querySelector('#csvFirstRowHeaders');
  const fileInput = container.querySelector('#csvFileInput');
  const input = container.querySelector('#csvInput');
  const output = container.querySelector('#csvOutput');
  const processButton = container.querySelector('#processCsvButton');
  const clearButton = container.querySelector('#clearCsvButton');
  const copyButton = container.querySelector('#copyCsvButton');
  const downloadButton = container.querySelector('#downloadCsvButton');
  const delimiterDetail = container.querySelector('#csvDelimiterDetail');
  const rowsDetail = container.querySelector('#csvRowsDetail');
  const columnsDetail = container.querySelector('#csvColumnsDetail');
  const emptyCellsDetail = container.querySelector('#csvEmptyCellsDetail');
  const inconsistentRowsDetail = container.querySelector('#csvInconsistentRowsDetail');
  const outputTypeDetail = container.querySelector('#csvOutputTypeDetail');
  const outputSizeDetail = container.querySelector('#csvOutputSizeDetail');
  const warningsDetail = container.querySelector('#csvWarningsDetail');
  const issueList = container.querySelector('#csvIssueList');
  const status = container.querySelector('#csvStatus');

  let currentObjectUrl = null;
  let currentSourceName = '';
  let unbindDropZone = null;

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
    delimiterDetail.textContent = '-';
    rowsDetail.textContent = '-';
    columnsDetail.textContent = '-';
    emptyCellsDetail.textContent = '-';
    inconsistentRowsDetail.textContent = '-';
    outputTypeDetail.textContent = '-';
    outputSizeDetail.textContent = '-';
    warningsDetail.textContent = '-';
    issueList.innerHTML = '';
  }

  function setDetails(result) {
    delimiterDetail.textContent = result.delimiter.detected ? `${result.delimiter.label} detected` : result.delimiter.label;
    rowsDetail.textContent = `${result.analysis.totalRows.toLocaleString('en-GB')} total / ${result.analysis.dataRows.toLocaleString('en-GB')} data`;
    columnsDetail.textContent = result.analysis.columns.toLocaleString('en-GB');
    emptyCellsDetail.textContent = result.analysis.emptyCellCount.toLocaleString('en-GB');
    inconsistentRowsDetail.textContent = result.analysis.inconsistentRows.length.toLocaleString('en-GB');
    outputTypeDetail.textContent = result.outputType;
    outputSizeDetail.textContent = result.outputSizeLabel;
    warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
    setIssues(result.warnings);
  }

  function setIssues(warnings) {
    issueList.innerHTML = '';

    warnings.forEach(warning => {
      const item = document.createElement('p');
      item.textContent = warning;
      issueList.append(item);
    });
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const fileName = buildDelimitedOutputFileName(result.outputFormat, currentSourceName);
    const blob = new Blob([result.output], {
      type: result.outputFormat === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8'
    });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
  }

  function handleProcess() {
    try {
      const result = processDelimitedData({
        input: input.value,
        delimiter: delimiter.value,
        outputFormat: outputFormat.value,
        firstRowHeaders: firstRowHeaders.checked
      });

      setOutput(result);
      setStatus(buildSuccessMessage('Delimited data processed successfully.', result), 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to process this delimited data.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Output selected and copied using the browser fallback.', 'success');
    }
  }

  async function readSelectedFile(file) {
    if (!file) {
      return;
    }

    try {
      currentSourceName = file.name;
      input.value = await file.text();
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(`Loaded ${file.name}.`, 'success');
    } catch {
      setStatus('Unable to read the selected file.', 'error');
    }
  }

  processButton.addEventListener('click', handleProcess);
  copyButton.addEventListener('click', copyOutput);
  fileInput.addEventListener('change', event => readSelectedFile(event.target.files && event.target.files[0]));
  unbindDropZone = bindFileDropZone(container.querySelector('#csvFileDropZone'), {
    accept: CSV_FILE_ACCEPT,
    onFile: readSelectedFile,
    onReject: () => setStatus('Choose a CSV, TSV or text file.', 'error')
  });

  clearButton.addEventListener('click', () => {
    delimiter.value = 'auto';
    outputFormat.value = 'json';
    firstRowHeaders.checked = true;
    fileInput.value = '';
    input.value = '';
    output.value = '';
    currentSourceName = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    input.focus();
  });

  return () => {
    unbindDropZone?.();
    revokeObjectUrl();
  };
}

function buildSuccessMessage(message, result) {
  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
