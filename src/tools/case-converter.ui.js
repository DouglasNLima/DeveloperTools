import { CASE_OUTPUT_FORMATS, convertCase } from './case-converter.js';

export function renderCaseConverter(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="caseOutputFormat">Output format</label>
          <select id="caseOutputFormat">
            ${CASE_OUTPUT_FORMATS.map(format => `<option value="${format.value}">${format.label}</option>`).join('')}
          </select>
        </div>

        <label class="checkbox-row" for="caseConvertEachLine">
          <input id="caseConvertEachLine" type="checkbox" />
          <span>Convert each line separately</span>
        </label>

        <div class="button-row button-row--end">
          <button id="convertCaseButton" class="primary" type="button">Convert case</button>
          <button id="clearCaseButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="field-stack">
        <label for="caseInput">Text input</label>
        <textarea id="caseInput" spellcheck="false" placeholder="customer account ID&#10;PowerPages site setting"></textarea>
      </div>

      <div class="field-stack">
        <label for="casePreview">Converted preview</label>
        <div id="casePreview" class="case-preview" aria-live="polite"></div>
      </div>

      <div class="output-toolbar">
        <label for="caseOutput">Output</label>
        <div class="button-row">
          <button id="copyCaseButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadCaseButton" class="button secondary" href="#" download="case-converter.txt" hidden>Download output</a>
        </div>
      </div>

      <textarea id="caseOutput" spellcheck="false" readonly placeholder="The converted output will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Conversion status</span>
          <strong id="caseStatusDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Mode</span>
          <strong id="caseModeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Input lines</span>
          <strong id="caseLinesDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Words</span>
          <strong id="caseWordsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output type</span>
          <strong id="caseOutputTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="caseOutputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Preview items</span>
          <strong id="casePreviewCountDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="caseWarningsDetail">-</strong>
        </div>
      </div>

      <div id="caseStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const input = container.querySelector('#caseInput');
  const outputFormat = container.querySelector('#caseOutputFormat');
  const convertEachLine = container.querySelector('#caseConvertEachLine');
  const convertButton = container.querySelector('#convertCaseButton');
  const clearButton = container.querySelector('#clearCaseButton');
  const copyButton = container.querySelector('#copyCaseButton');
  const downloadButton = container.querySelector('#downloadCaseButton');
  const preview = container.querySelector('#casePreview');
  const output = container.querySelector('#caseOutput');
  const statusDetail = container.querySelector('#caseStatusDetail');
  const modeDetail = container.querySelector('#caseModeDetail');
  const linesDetail = container.querySelector('#caseLinesDetail');
  const wordsDetail = container.querySelector('#caseWordsDetail');
  const outputTypeDetail = container.querySelector('#caseOutputTypeDetail');
  const outputSizeDetail = container.querySelector('#caseOutputSizeDetail');
  const previewCountDetail = container.querySelector('#casePreviewCountDetail');
  const warningsDetail = container.querySelector('#caseWarningsDetail');
  const status = container.querySelector('#caseStatus');

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
    statusDetail.textContent = '-';
    modeDetail.textContent = '-';
    linesDetail.textContent = '-';
    wordsDetail.textContent = '-';
    outputTypeDetail.textContent = '-';
    outputSizeDetail.textContent = '-';
    previewCountDetail.textContent = '-';
    warningsDetail.textContent = '-';
    preview.innerHTML = '';
  }

  function setInvalidDetails() {
    resetDetails();
    statusDetail.textContent = 'Invalid';
  }

  function setDetails(result) {
    statusDetail.textContent = 'Converted';
    modeDetail.textContent = result.mode;
    linesDetail.textContent = result.inputLineCount.toLocaleString('en-GB');
    wordsDetail.textContent = result.wordCount.toLocaleString('en-GB');
    outputTypeDetail.textContent = result.outputType;
    outputSizeDetail.textContent = result.outputSizeLabel;
    previewCountDetail.textContent = result.previewItems.length.toLocaleString('en-GB');
    warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    renderPreview(result);
    revokeObjectUrl();

    const isReport = result.outputFormat === 'all';
    const fileName = isReport ? 'case-converter.md' : 'case-converter.txt';
    const blob = new Blob([result.output], {
      type: isReport ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
  }

  function renderPreview(result) {
    preview.innerHTML = '';

    result.previewItems.forEach(item => {
      const card = document.createElement('article');
      card.className = 'case-result-card';

      const label = document.createElement('span');
      label.textContent = result.convertEachLine ? `${item.label} · ${item.format}` : item.format;

      const value = document.createElement('code');
      value.textContent = item.value || '(empty)';

      card.append(label, value);
      preview.append(card);
    });
  }

  function handleConvert() {
    try {
      const result = convertCase({
        input: input.value,
        outputFormat: outputFormat.value,
        convertEachLine: convertEachLine.checked
      });

      setOutput(result);
      setStatus(buildSuccessMessage(result), 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      setInvalidDetails();
      setStatus(error.message || 'Unable to convert this text.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no converted output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Converted output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Converted output selected and copied using the browser fallback.', 'success');
    }
  }

  convertButton.addEventListener('click', handleConvert);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    input.value = '';
    outputFormat.value = 'all';
    convertEachLine.checked = false;
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    input.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(result) {
  const message = 'Case conversion completed successfully.';

  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
