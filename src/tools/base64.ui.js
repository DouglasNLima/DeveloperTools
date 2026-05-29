import {
  bytesToBase64,
  decodeBase64Input,
  formatBytes,
  normaliseFileName,
  normaliseTextFileName
} from './base64.js';
import { bindFileDropZone } from './file-drop-zone.js';

export function renderBase64ToFile(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="field-stack">
        <label for="base64Input">Base64 content</label>
        <textarea id="base64Input" spellcheck="false" autocomplete="off" placeholder="Paste Base64 here, for example: JVBERi0xLjQK... or data:application/pdf;base64,JVBERi0xLjQK..."></textarea>
        <p class="hint">Recognises PDF, common images, text, JSON, XML, HTML, ZIP, Office files, audio and video formats.</p>
      </div>

      <div class="form-grid form-grid--actions">
        <div class="field-stack">
          <label for="fileNameInput">File name override</label>
          <input id="fileNameInput" type="text" placeholder="Leave blank to use the recognised extension" />
        </div>

        <div class="button-row">
          <button class="primary" type="submit">Create file</button>
          <button id="clearBase64Button" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="button-row">
        <a id="downloadButton" class="button primary" href="#" download="converted.bin" hidden>Download file</a>
      </div>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Recognised type</span>
          <strong id="recognisedType">-</strong>
        </div>
        <div class="detail-card">
          <span>Extension</span>
          <strong id="recognisedExtension">-</strong>
        </div>
        <div class="detail-card">
          <span>File size</span>
          <strong id="recognisedSize">-</strong>
        </div>
        <div class="detail-card">
          <span>Output file</span>
          <strong id="recognisedFileName">-</strong>
        </div>
      </div>

      <div id="base64Status" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const form = container.querySelector('[data-tool-form]');
  const base64Input = container.querySelector('#base64Input');
  const fileNameInput = container.querySelector('#fileNameInput');
  const clearButton = container.querySelector('#clearBase64Button');
  const downloadButton = container.querySelector('#downloadButton');
  const statusBox = container.querySelector('#base64Status');
  const recognisedType = container.querySelector('#recognisedType');
  const recognisedExtension = container.querySelector('#recognisedExtension');
  const recognisedSize = container.querySelector('#recognisedSize');
  const recognisedFileName = container.querySelector('#recognisedFileName');

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
    statusBox.textContent = message;
    statusBox.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function resetDetails() {
    recognisedType.textContent = '-';
    recognisedExtension.textContent = '-';
    recognisedSize.textContent = '-';
    recognisedFileName.textContent = '-';
  }

  function setDetails(fileInfo, blob, fileName) {
    recognisedType.textContent = fileInfo.mimeType || 'application/octet-stream';
    recognisedExtension.textContent = fileInfo.extension ? `.${fileInfo.extension}` : '.bin';
    recognisedSize.textContent = blob ? formatBytes(blob.size) : '-';
    recognisedFileName.textContent = fileName || '-';
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    revokeObjectUrl();
    resetDetails();

    try {
      const result = decodeBase64Input(base64Input.value);
      const fileName = normaliseFileName(fileNameInput.value, result.fileInfo.extension);
      const blob = new Blob([result.bytes], { type: result.fileInfo.mimeType });

      currentObjectUrl = URL.createObjectURL(blob);
      downloadButton.href = currentObjectUrl;
      downloadButton.download = fileName;
      downloadButton.textContent = `Download ${fileName}`;
      downloadButton.hidden = false;

      setDetails(result.fileInfo, blob, fileName);
      setStatus(`File created successfully as ${result.fileInfo.label}.`, 'success');
    } catch (error) {
      setStatus(error.message || 'Unable to create the file from the provided Base64 string.', 'error');
    }
  });

  clearButton.addEventListener('click', () => {
    revokeObjectUrl();
    resetDetails();
    base64Input.value = '';
    fileNameInput.value = '';
    downloadButton.textContent = 'Download file';
    setStatus('Ready.', null);
    base64Input.focus();
  });

  return () => revokeObjectUrl();
}

export function renderFileToBase64(container) {
  container.innerHTML = `
    <form class="tool-board">
      <div id="dropZone" class="drop-zone">
        <label for="fileInput" class="drop-zone-label">
          <span>Drop a file here or browse</span>
          <small>Any file type is accepted. Very large files may take longer to encode in the browser.</small>
        </label>
        <input id="fileInput" type="file" />
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="base64OutputFileName">Base64 text file name</label>
          <input id="base64OutputFileName" type="text" placeholder="Leave blank to use the selected file name" />
        </div>

        <div class="field-stack">
          <label for="base64OutputMode">Output format</label>
          <select id="base64OutputMode">
            <option value="raw">Raw Base64</option>
            <option value="dataUrl">Data URL</option>
          </select>
        </div>

        <div class="button-row button-row--end">
          <button id="resetFileToolButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="output-toolbar">
        <label for="base64Output">Base64 output</label>
        <div class="button-row">
          <button id="copyBase64Button" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadBase64Button" class="button secondary" href="#" download="converted-base64.txt" hidden>Download text</a>
        </div>
      </div>

      <textarea id="base64Output" spellcheck="false" readonly placeholder="The Base64 result will appear here after you select a file."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Selected file</span>
          <strong id="sourceFileName">-</strong>
        </div>
        <div class="detail-card">
          <span>MIME type</span>
          <strong id="sourceMimeType">-</strong>
        </div>
        <div class="detail-card">
          <span>File size</span>
          <strong id="sourceFileSize">-</strong>
        </div>
        <div class="detail-card">
          <span>Base64 length</span>
          <strong id="base64Length">-</strong>
        </div>
      </div>

      <div id="fileToolStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const dropZone = container.querySelector('#dropZone');
  const fileInput = container.querySelector('#fileInput');
  const base64OutputFileName = container.querySelector('#base64OutputFileName');
  const base64OutputMode = container.querySelector('#base64OutputMode');
  const resetFileToolButton = container.querySelector('#resetFileToolButton');
  const copyBase64Button = container.querySelector('#copyBase64Button');
  const downloadBase64Button = container.querySelector('#downloadBase64Button');
  const base64Output = container.querySelector('#base64Output');
  const sourceFileName = container.querySelector('#sourceFileName');
  const sourceMimeType = container.querySelector('#sourceMimeType');
  const sourceFileSize = container.querySelector('#sourceFileSize');
  const base64Length = container.querySelector('#base64Length');
  const fileToolStatus = container.querySelector('#fileToolStatus');

  let currentBase64TextUrl = null;
  let currentFileResult = null;
  let unbindDropZone = null;

  function revokeBase64TextUrl() {
    if (currentBase64TextUrl) {
      URL.revokeObjectURL(currentBase64TextUrl);
      currentBase64TextUrl = null;
    }

    downloadBase64Button.hidden = true;
    downloadBase64Button.removeAttribute('href');
  }

  function setStatus(message, type) {
    fileToolStatus.textContent = message;
    fileToolStatus.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function setSourceDetails(file, rawBase64) {
    sourceFileName.textContent = file ? file.name : '-';
    sourceMimeType.textContent = file && file.type ? file.type : 'application/octet-stream';
    sourceFileSize.textContent = file ? formatBytes(file.size) : '-';
    base64Length.textContent = rawBase64 ? rawBase64.length.toLocaleString('en-GB') : '-';
  }

  function resetFileToolDetails() {
    sourceFileName.textContent = '-';
    sourceMimeType.textContent = '-';
    sourceFileSize.textContent = '-';
    base64Length.textContent = '-';
  }

  function updateBase64Output() {
    if (!currentFileResult) {
      base64Output.value = '';
      copyBase64Button.disabled = true;
      revokeBase64TextUrl();
      return;
    }

    const output = base64OutputMode.value === 'dataUrl'
      ? currentFileResult.dataUrl
      : currentFileResult.rawBase64;

    base64Output.value = output;
    copyBase64Button.disabled = false;

    revokeBase64TextUrl();

    const textBlob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    currentBase64TextUrl = URL.createObjectURL(textBlob);
    downloadBase64Button.href = currentBase64TextUrl;
    downloadBase64Button.download = normaliseTextFileName(base64OutputFileName.value, currentFileResult.file.name);
    downloadBase64Button.textContent = `Download ${downloadBase64Button.download}`;
    downloadBase64Button.hidden = false;
  }

  async function readFileAsDataUrl(file) {
    if (typeof file.arrayBuffer === 'function') {
      const buffer = await file.arrayBuffer();
      const rawBase64 = bytesToBase64(new Uint8Array(buffer));
      const mimeType = file.type || 'application/octet-stream';

      return {
        rawBase64,
        dataUrl: `data:${mimeType};base64,${rawBase64}`
      };
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const commaIndex = dataUrl.indexOf(',');

        if (commaIndex < 0) {
          reject(new Error('Unable to read the selected file as Base64.'));
          return;
        }

        resolve({
          rawBase64: dataUrl.slice(commaIndex + 1),
          dataUrl
        });
      };

      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  async function handleSelectedFile(file) {
    if (!file) {
      return;
    }

    setStatus('Reading file...', null);
    revokeBase64TextUrl();
    copyBase64Button.disabled = true;
    base64Output.value = '';

    try {
      const fileData = await readFileAsDataUrl(file);
      currentFileResult = {
        file,
        dataUrl: fileData.dataUrl,
        rawBase64: fileData.rawBase64
      };

      if (!base64OutputFileName.value.trim()) {
        base64OutputFileName.value = `${file.name}.base64.txt`;
      }

      setSourceDetails(file, fileData.rawBase64);
      updateBase64Output();
      setStatus('File converted to Base64 successfully.', 'success');
    } catch (error) {
      setStatus(error.message || 'Unable to read the selected file.', 'error');
    }
  }

  async function copyOutputToClipboard() {
    const value = base64Output.value;

    if (!value) {
      setStatus('There is no Base64 output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setStatus('Base64 output copied to the clipboard.', 'success');
    } catch {
      base64Output.focus();
      base64Output.select();
      document.execCommand('copy');
      setStatus('Base64 output selected and copied using the browser fallback.', 'success');
    }
  }

  fileInput.addEventListener('change', event => {
    handleSelectedFile(event.target.files && event.target.files[0]);
  });

  unbindDropZone = bindFileDropZone(dropZone, {
    onFile: handleSelectedFile
  });

  base64OutputMode.addEventListener('change', updateBase64Output);
  base64OutputFileName.addEventListener('input', updateBase64Output);
  copyBase64Button.addEventListener('click', copyOutputToClipboard);

  resetFileToolButton.addEventListener('click', () => {
    currentFileResult = null;
    fileInput.value = '';
    base64Output.value = '';
    base64OutputFileName.value = '';
    base64OutputMode.value = 'raw';
    copyBase64Button.disabled = true;
    revokeBase64TextUrl();
    resetFileToolDetails();
    setStatus('Ready.', null);
  });

  return () => {
    unbindDropZone?.();
    revokeBase64TextUrl();
  };
}
