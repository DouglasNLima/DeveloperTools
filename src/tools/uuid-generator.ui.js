import { generateUuidBatch, restoreUuidHyphens, validateUuidInput } from './uuid-generator.js';

export function renderUuidGenerator(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="uuidCount">UUID count</label>
          <input id="uuidCount" type="number" min="1" max="100" step="1" value="1" />
        </div>

        <label class="checkbox-row" for="uuidUppercase">
          <input id="uuidUppercase" type="checkbox" />
          <span>Uppercase output</span>
        </label>

        <label class="checkbox-row" for="uuidBraces">
          <input id="uuidBraces" type="checkbox" />
          <span>Wrap output in braces</span>
        </label>
      </div>

      <div class="button-row">
        <button id="generateUuidButton" class="primary" type="button">Generate UUIDs</button>
        <button id="restoreUuidButton" class="secondary" type="button">Restore hyphens</button>
        <button id="validateUuidButton" class="secondary" type="button">Validate UUIDs</button>
        <button id="clearUuidButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="field-stack">
        <label for="uuidInput">UUID input</label>
        <textarea id="uuidInput" spellcheck="false" placeholder="Paste UUIDs to validate or restore, one per line."></textarea>
      </div>

      <div class="field-stack">
        <label for="uuidPreview">UUID preview</label>
        <div id="uuidPreview" class="uuid-preview" aria-live="polite"></div>
      </div>

      <div class="output-toolbar">
        <label for="uuidOutput">Output</label>
        <div class="button-row">
          <button id="copyUuidButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadUuidButton" class="button secondary" href="#" download="uuid-list.txt" hidden>Download output</a>
        </div>
      </div>

      <textarea id="uuidOutput" spellcheck="false" readonly placeholder="Generated UUIDs, restored UUIDs or the validation report will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Mode</span>
          <strong id="uuidModeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Total entries</span>
          <strong id="uuidTotalDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Valid / invalid</span>
          <strong id="uuidValidInvalidDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Version 4</span>
          <strong id="uuidVersion4Detail">-</strong>
        </div>
        <div class="detail-card">
          <span>Nil UUIDs</span>
          <strong id="uuidNilDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Duplicates</span>
          <strong id="uuidDuplicatesDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output type</span>
          <strong id="uuidOutputTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="uuidWarningsDetail">-</strong>
        </div>
      </div>

      <div id="uuidStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const countInput = container.querySelector('#uuidCount');
  const uppercase = container.querySelector('#uuidUppercase');
  const braces = container.querySelector('#uuidBraces');
  const input = container.querySelector('#uuidInput');
  const preview = container.querySelector('#uuidPreview');
  const generateButton = container.querySelector('#generateUuidButton');
  const restoreButton = container.querySelector('#restoreUuidButton');
  const validateButton = container.querySelector('#validateUuidButton');
  const clearButton = container.querySelector('#clearUuidButton');
  const copyButton = container.querySelector('#copyUuidButton');
  const downloadButton = container.querySelector('#downloadUuidButton');
  const output = container.querySelector('#uuidOutput');
  const modeDetail = container.querySelector('#uuidModeDetail');
  const totalDetail = container.querySelector('#uuidTotalDetail');
  const validInvalidDetail = container.querySelector('#uuidValidInvalidDetail');
  const version4Detail = container.querySelector('#uuidVersion4Detail');
  const nilDetail = container.querySelector('#uuidNilDetail');
  const duplicatesDetail = container.querySelector('#uuidDuplicatesDetail');
  const outputTypeDetail = container.querySelector('#uuidOutputTypeDetail');
  const warningsDetail = container.querySelector('#uuidWarningsDetail');
  const status = container.querySelector('#uuidStatus');

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
    totalDetail.textContent = '-';
    validInvalidDetail.textContent = '-';
    version4Detail.textContent = '-';
    nilDetail.textContent = '-';
    duplicatesDetail.textContent = '-';
    outputTypeDetail.textContent = '-';
    warningsDetail.textContent = '-';
    preview.innerHTML = '';
  }

  function setDetails(result) {
    modeDetail.textContent = result.mode;
    totalDetail.textContent = result.summary.total.toLocaleString('en-GB');
    validInvalidDetail.textContent = `${result.summary.valid.toLocaleString('en-GB')} / ${result.summary.invalid.toLocaleString('en-GB')}`;
    version4Detail.textContent = result.summary.version4.toLocaleString('en-GB');
    nilDetail.textContent = result.summary.nil.toLocaleString('en-GB');
    duplicatesDetail.textContent = result.summary.duplicates.toLocaleString('en-GB');
    outputTypeDetail.textContent = result.outputType;
    warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function setOutput(result, fileName) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    renderPreview(result.records);
    revokeObjectUrl();

    const isMarkdown = fileName.endsWith('.md');
    const blob = new Blob([result.output], {
      type: isMarkdown ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
  }

  function renderPreview(records) {
    preview.innerHTML = '';

    records.forEach(record => {
      const card = document.createElement('article');
      card.className = `uuid-result-card ${record.valid ? 'valid' : 'invalid'}`;

      const label = document.createElement('span');
      label.textContent = record.valid
        ? `Entry ${record.index} · ${record.format}`
        : `Entry ${record.index} · Invalid`;

      const value = document.createElement('code');
      value.textContent = record.valid ? (record.displayValue || record.normalised) : record.input;

      const meta = document.createElement('small');
      meta.textContent = record.valid
        ? `${record.version ? `Version ${record.version}` : 'No version'} · ${record.variant}${record.duplicate ? ' · Duplicate' : ''}${record.issue ? ` · ${record.issue}` : ''}`
        : record.issue;

      card.append(label, value, meta);
      preview.append(card);
    });
  }

  function handleGenerate() {
    try {
      const result = generateUuidBatch({
        count: countInput.value,
        uppercase: uppercase.checked,
        braces: braces.checked,
        randomBytes: getBrowserRandomBytes
      });

      input.value = result.output;
      setOutput(result, 'uuid-list.txt');
      setStatus(buildSuccessMessage('UUIDs generated successfully.', result), 'success');
    } catch (error) {
      handleError(error);
    }
  }

  function handleValidate() {
    try {
      const result = validateUuidInput(input.value);
      setOutput(result, 'uuid-validation-report.md');
      setStatus(buildSuccessMessage('UUID validation report created successfully.', result), result.summary.invalid === 0 ? 'success' : 'error');
    } catch (error) {
      handleError(error);
    }
  }

  function handleRestore() {
    try {
      const result = restoreUuidHyphens(input.value, {
        uppercase: uppercase.checked,
        braces: braces.checked
      });
      setOutput(result, 'uuid-restored-list.txt');
      setStatus(buildSuccessMessage('UUID hyphens restored successfully.', result), 'success');
    } catch (error) {
      handleError(error);
    }
  }

  function handleError(error) {
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    modeDetail.textContent = 'Invalid';
    setStatus(error.message || 'Unable to process these UUIDs.', 'error');
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no UUID output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('UUID output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('UUID output selected and copied using the browser fallback.', 'success');
    }
  }

  generateButton.addEventListener('click', handleGenerate);
  restoreButton.addEventListener('click', handleRestore);
  validateButton.addEventListener('click', handleValidate);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    countInput.value = '1';
    uppercase.checked = false;
    braces.checked = false;
    input.value = '';
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    countInput.focus();
  });

  return () => revokeObjectUrl();
}

function getBrowserRandomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function buildSuccessMessage(message, result) {
  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
