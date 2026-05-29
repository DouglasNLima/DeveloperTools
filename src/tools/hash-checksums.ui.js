import {
  HASH_ALGORITHMS,
  buildHashChecksum,
  buildHashOutputFileName
} from './hash-checksums.js';
import { bindFileDropZone } from './file-drop-zone.js';

export function renderHashChecksums(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="hashAlgorithm">Algorithm</label>
          <select id="hashAlgorithm">
            ${HASH_ALGORITHMS.map(algorithm => `<option value="${algorithm.value}">${algorithm.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="hashInputType">Input type</label>
          <select id="hashInputType">
            <option value="text">Text</option>
            <option value="file">File</option>
          </select>
        </div>

        <div class="button-row button-row--end">
          <button id="generateHashButton" class="primary" type="button">Generate hash</button>
          <button id="clearHashButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="field-stack">
        <label for="expectedHashDigest">Expected digest</label>
        <input id="expectedHashDigest" type="text" placeholder="Optional hex or Base64 digest to compare" />
      </div>

      <div id="hashTextPanel" class="field-stack">
        <label for="hashTextInput">Text input</label>
        <textarea id="hashTextInput" spellcheck="false" placeholder="Paste text to hash locally."></textarea>
      </div>

      <div id="hashFilePanel" class="drop-zone" hidden>
        <label for="hashFileInput" class="drop-zone-label">
          <span>Drop a file here or browse</span>
          <small>The selected file is read locally in your browser.</small>
        </label>
        <input id="hashFileInput" type="file" />
      </div>

      <div class="output-toolbar">
        <label for="hashOutput">Output</label>
        <div class="button-row">
          <button id="copyHashButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadHashButton" class="button secondary" href="#" download="hash-checksum.sha.txt" hidden>Download output</a>
        </div>
      </div>

      <textarea id="hashOutput" spellcheck="false" readonly placeholder="The generated hash output will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Algorithm</span>
          <strong id="hashAlgorithmDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Input</span>
          <strong id="hashInputDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Input size</span>
          <strong id="hashSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Expected digest</span>
          <strong id="hashMatchDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Hex length</span>
          <strong id="hashHexLengthDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Base64 length</span>
          <strong id="hashBase64LengthDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Duration</span>
          <strong id="hashDurationDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="hashWarningsDetail">-</strong>
        </div>
      </div>

      <div id="hashStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const algorithm = container.querySelector('#hashAlgorithm');
  const inputType = container.querySelector('#hashInputType');
  const expectedDigest = container.querySelector('#expectedHashDigest');
  const textPanel = container.querySelector('#hashTextPanel');
  const textInput = container.querySelector('#hashTextInput');
  const filePanel = container.querySelector('#hashFilePanel');
  const fileInput = container.querySelector('#hashFileInput');
  const generateButton = container.querySelector('#generateHashButton');
  const clearButton = container.querySelector('#clearHashButton');
  const copyButton = container.querySelector('#copyHashButton');
  const downloadButton = container.querySelector('#downloadHashButton');
  const output = container.querySelector('#hashOutput');
  const algorithmDetail = container.querySelector('#hashAlgorithmDetail');
  const inputDetail = container.querySelector('#hashInputDetail');
  const sizeDetail = container.querySelector('#hashSizeDetail');
  const matchDetail = container.querySelector('#hashMatchDetail');
  const hexLengthDetail = container.querySelector('#hashHexLengthDetail');
  const base64LengthDetail = container.querySelector('#hashBase64LengthDetail');
  const durationDetail = container.querySelector('#hashDurationDetail');
  const warningsDetail = container.querySelector('#hashWarningsDetail');
  const status = container.querySelector('#hashStatus');

  let selectedFile = null;
  let currentObjectUrl = null;
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
    algorithmDetail.textContent = '-';
    inputDetail.textContent = '-';
    sizeDetail.textContent = '-';
    matchDetail.textContent = '-';
    hexLengthDetail.textContent = '-';
    base64LengthDetail.textContent = '-';
    durationDetail.textContent = '-';
    warningsDetail.textContent = '-';
  }

  function setDetails(result, durationMs) {
    algorithmDetail.textContent = result.algorithm;
    inputDetail.textContent = result.inputName;
    sizeDetail.textContent = result.inputSizeLabel;
    matchDetail.textContent = result.match.label;
    hexLengthDetail.textContent = result.hex.length.toLocaleString('en-GB');
    base64LengthDetail.textContent = result.base64.length.toLocaleString('en-GB');
    durationDetail.textContent = `${Math.max(1, Math.round(durationMs)).toLocaleString('en-GB')} ms`;
    warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function setOutput(result, durationMs) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result, durationMs);
    revokeObjectUrl();

    const blob = new Blob([result.output], { type: 'text/plain;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = buildHashOutputFileName(result.inputName);
    downloadButton.textContent = `Download ${downloadButton.download}`;
    downloadButton.hidden = false;
  }

  function updateInputMode() {
    const fileMode = inputType.value === 'file';
    textPanel.hidden = fileMode;
    filePanel.hidden = !fileMode;
  }

  function resetOutput() {
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
  }

  async function getFileBytes(file) {
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async function handleGenerate() {
    setStatus('Generating hash...', null);
    resetOutput();

    try {
      const startedAt = performance.now();
      const fileBytes = inputType.value === 'file' && selectedFile ? await getFileBytes(selectedFile) : null;
      const result = await buildHashChecksum({
        algorithm: algorithm.value,
        inputType: inputType.value,
        text: textInput.value,
        fileBytes,
        fileName: selectedFile?.name,
        expectedDigest: expectedDigest.value
      });
      const durationMs = performance.now() - startedAt;

      setOutput(result, durationMs);
      setStatus(buildSuccessMessage('Hash generated successfully.', result), result.match.status === 'mismatch' ? 'error' : 'success');
    } catch (error) {
      resetOutput();
      setStatus(error.message || 'Unable to generate this hash.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no hash output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Hash output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Hash output selected and copied using the browser fallback.', 'success');
    }
  }

  function setSelectedFile(file) {
    selectedFile = file || null;
    resetOutput();

    if (selectedFile) {
      setStatus(`Selected ${selectedFile.name}.`, null);
    }
  }

  inputType.addEventListener('change', () => {
    updateInputMode();
    resetOutput();
    setStatus('Ready.', null);
  });

  fileInput.addEventListener('change', event => {
    setSelectedFile(event.target.files && event.target.files[0]);
  });

  unbindDropZone = bindFileDropZone(filePanel, {
    onFile: setSelectedFile
  });

  generateButton.addEventListener('click', handleGenerate);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    selectedFile = null;
    algorithm.value = 'SHA-256';
    inputType.value = 'text';
    expectedDigest.value = '';
    textInput.value = '';
    fileInput.value = '';
    updateInputMode();
    resetOutput();
    setStatus('Ready.', null);
    textInput.focus();
  });

  updateInputMode();

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
