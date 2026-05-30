import { formatBytes } from './base64.js';
import { bindFileDropZone } from './file-drop-zone.js';
import {
  IMAGE_OCR_FILE_ACCEPT,
  IMAGE_OCR_LANGUAGE,
  buildOcrOutputFileName,
  createOcrTextBlob,
  detectOcrImageFileType,
  normaliseOcrProgressStatus,
  recogniseImageFile,
  validateOcrImageFile
} from './image-ocr.js';

export function renderImageOcr(container) {
  container.innerHTML = `
    <form class="tool-board image-ocr-tool" data-tool-form>
      <div id="imageOcrDropZone" class="drop-zone">
        <label for="imageOcrFileInput" class="drop-zone-label">
          <span>Drop an image here or browse</span>
          <small>PNG, JPEG, WebP, BMP and non-animated GIF files are read locally in this browser.</small>
        </label>
        <input id="imageOcrFileInput" type="file" accept="${IMAGE_OCR_FILE_ACCEPT}" />
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="imageOcrLanguage">Language</label>
          <select id="imageOcrLanguage" disabled>
            <option value="${IMAGE_OCR_LANGUAGE.code}">${IMAGE_OCR_LANGUAGE.label}</option>
          </select>
        </div>

        <div class="field-stack">
          <label for="imageOcrOutputName">Output file name</label>
          <input id="imageOcrOutputName" type="text" placeholder="image.ocr.txt" />
        </div>

        <div class="button-row button-row--end">
          <button id="runImageOcrButton" class="primary" type="button">Run OCR</button>
          <button id="clearImageOcrButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Selected file</span>
          <strong id="imageOcrSelectedFile">None</strong>
        </div>
        <div class="detail-card">
          <span>Type</span>
          <strong id="imageOcrTypeDetail">None</strong>
        </div>
        <div class="detail-card">
          <span>Language</span>
          <strong id="imageOcrLanguageDetail">${IMAGE_OCR_LANGUAGE.label}</strong>
        </div>
        <div class="detail-card">
          <span>Confidence</span>
          <strong id="imageOcrConfidenceDetail">Not run</strong>
        </div>
        <div class="detail-card">
          <span>Words</span>
          <strong id="imageOcrWordsDetail">0</strong>
        </div>
        <div class="detail-card">
          <span>Elapsed time</span>
          <strong id="imageOcrElapsedDetail">Not run</strong>
        </div>
        <div class="detail-card">
          <span>Output</span>
          <strong id="imageOcrOutputDetail">No text</strong>
        </div>
        <div class="detail-card">
          <span>Engine</span>
          <strong id="imageOcrEngineDetail">Local Tesseract</strong>
        </div>
      </div>

      <div id="imageOcrPreview" class="image-converter-results" aria-live="polite">
        <p class="empty-state">No image selected.</p>
      </div>

      <div class="output-toolbar">
        <label for="imageOcrOutput">Extracted text</label>
        <div class="button-row">
          <button id="copyImageOcrButton" class="secondary" type="button" disabled>Copy text</button>
          <a id="downloadImageOcrButton" class="button secondary" href="#" download="image.ocr.txt" hidden>Download text</a>
        </div>
      </div>

      <textarea id="imageOcrOutput" rows="12" readonly placeholder="OCR text will appear here."></textarea>

      <div id="imageOcrStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const dropZone = container.querySelector('#imageOcrDropZone');
  const fileInput = container.querySelector('#imageOcrFileInput');
  const outputName = container.querySelector('#imageOcrOutputName');
  const runButton = container.querySelector('#runImageOcrButton');
  const clearButton = container.querySelector('#clearImageOcrButton');
  const selectedFile = container.querySelector('#imageOcrSelectedFile');
  const typeDetail = container.querySelector('#imageOcrTypeDetail');
  const confidenceDetail = container.querySelector('#imageOcrConfidenceDetail');
  const wordsDetail = container.querySelector('#imageOcrWordsDetail');
  const elapsedDetail = container.querySelector('#imageOcrElapsedDetail');
  const outputDetail = container.querySelector('#imageOcrOutputDetail');
  const preview = container.querySelector('#imageOcrPreview');
  const copyButton = container.querySelector('#copyImageOcrButton');
  const downloadButton = container.querySelector('#downloadImageOcrButton');
  const output = container.querySelector('#imageOcrOutput');
  const status = container.querySelector('#imageOcrStatus');

  const state = {
    file: null,
    previewUrl: '',
    outputUrl: '',
    runId: 0
  };

  let unbindDropZone = null;

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function revokePreviewUrl() {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = '';
    }
  }

  function revokeOutputUrl() {
    if (state.outputUrl) {
      URL.revokeObjectURL(state.outputUrl);
      state.outputUrl = '';
    }
  }

  function resetOutput() {
    revokeOutputUrl();
    output.value = '';
    copyButton.disabled = true;
    downloadButton.hidden = true;
    downloadButton.removeAttribute('href');
    downloadButton.download = buildOcrOutputFileName(outputName.value || state.file?.name);
    downloadButton.textContent = 'Download text';
    confidenceDetail.textContent = 'Not run';
    wordsDetail.textContent = '0';
    elapsedDetail.textContent = 'Not run';
    outputDetail.textContent = 'No text';
  }

  function updateSelectedSummary() {
    selectedFile.textContent = state.file?.name || 'None';
    const format = detectOcrImageFileType(state.file);
    typeDetail.textContent = format ? format.label : 'None';
  }

  function renderEmptyPreview() {
    preview.innerHTML = '<p class="empty-state">No image selected.</p>';
  }

  function renderFilePreview(file, stateLabel = 'Ready', stateClass = 'pending', message = '') {
    revokePreviewUrl();
    const format = detectOcrImageFileType(file);
    const previewContent = format
      ? createImagePreviewMarkup(file)
      : `<span>${escapeHtml(getFileInitials(file.name))}</span>`;

    preview.innerHTML = `
      <article class="image-result-card ${stateClass}">
        <div class="image-result-preview">
          ${previewContent}
        </div>
        <div class="image-result-body">
          <div class="image-result-header">
            <strong>${escapeHtml(file.name || 'Selected image')}</strong>
            <span>${escapeHtml(stateLabel)}</span>
          </div>
          <p>${escapeHtml(message || formatSelectedFileMeta(file))}</p>
        </div>
      </article>
    `;
  }

  function createImagePreviewMarkup(file) {
    state.previewUrl = URL.createObjectURL(file);
    return `<img src="${state.previewUrl}" alt="" />`;
  }

  function setSelectedFile(file) {
    state.runId += 1;
    state.file = file || null;
    resetOutput();

    if (!state.file) {
      revokePreviewUrl();
      fileInput.value = '';
      outputName.value = '';
      updateSelectedSummary();
      renderEmptyPreview();
      setStatus('Ready.', null);
      return;
    }

    outputName.value = buildOcrOutputFileName(state.file.name);
    updateSelectedSummary();
    renderFilePreview(state.file);

    try {
      validateOcrImageFile(state.file);
      setStatus(`${state.file.name || 'Image'} selected.`, null);
    } catch (error) {
      typeDetail.textContent = 'Unsupported';
      setStatus(error.message || 'Choose a supported image file.', 'error');
    }
  }

  function setBusy(isBusy) {
    runButton.disabled = isBusy;
    clearButton.disabled = isBusy;
    fileInput.disabled = isBusy;
    outputName.disabled = isBusy;
  }

  async function handleRunOcr() {
    const runId = state.runId + 1;
    state.runId = runId;
    resetOutput();

    if (!state.file) {
      setStatus('Select an image before running OCR.', 'error');
      return;
    }

    let sourceFormat;

    try {
      sourceFormat = validateOcrImageFile(state.file);
      assertWorkerCapableOrigin();
    } catch (error) {
      renderFilePreview(state.file, 'Failed', 'error', error.message || 'Choose a supported image file.');
      setStatus(error.message || 'Choose a supported image file.', 'error');
      return;
    }

    setBusy(true);
    renderFilePreview(state.file, 'Running', 'pending', 'Preparing local OCR assets.');
    setStatus('Loading OCR engine locally...', null);
    confidenceDetail.textContent = 'Running';
    elapsedDetail.textContent = 'Running';
    outputDetail.textContent = 'Running';

    const startedAt = performance.now();

    try {
      const result = await recogniseImageFile(state.file, {
        onProgress: progress => {
          if (runId === state.runId) {
            setStatus(normaliseOcrProgressStatus(progress), null);
          }
        }
      });

      if (runId !== state.runId) {
        return;
      }

      result.outputName = buildOcrOutputFileName(outputName.value || state.file.name);
      output.value = result.displayText;
      notifyOutputChanged();
      confidenceDetail.textContent = result.confidenceLabel;
      wordsDetail.textContent = result.wordCount.toLocaleString('en-GB');
      elapsedDetail.textContent = formatElapsedTime(performance.now() - startedAt);
      outputDetail.textContent = result.text ? 'Text extracted' : 'No text detected';
      typeDetail.textContent = sourceFormat.label;
      updateDownload(result);
      renderFilePreview(state.file, 'Recognised', result.text ? 'success' : 'has-warning', `${result.confidenceLabel} confidence · ${result.wordCount.toLocaleString('en-GB')} word${result.wordCount === 1 ? '' : 's'}`);
      setStatus(result.text ? 'OCR completed successfully.' : 'OCR completed. No text was detected.', 'success');
    } catch (error) {
      if (runId !== state.runId) {
        return;
      }

      const message = getOcrErrorMessage(error);
      confidenceDetail.textContent = 'Failed';
      elapsedDetail.textContent = formatElapsedTime(performance.now() - startedAt);
      outputDetail.textContent = 'Failed';
      renderFilePreview(state.file, 'Failed', 'error', message);
      setStatus(message, 'error');
    } finally {
      if (runId === state.runId) {
        setBusy(false);
      }
    }
  }

  function updateDownload(result) {
    revokeOutputUrl();
    const blob = createOcrTextBlob(result.displayText);

    state.outputUrl = URL.createObjectURL(blob);
    copyButton.disabled = false;
    downloadButton.href = state.outputUrl;
    downloadButton.download = result.outputName;
    downloadButton.textContent = `Download ${result.outputName}`;
    downloadButton.hidden = false;
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('OCR text copied.', 'success');
    } catch {
      setStatus('Copy failed. Select the extracted text and copy it manually.', 'error');
    }
  }

  function notifyOutputChanged() {
    output.dispatchEvent(new Event('input', { bubbles: true }));
    output.dispatchEvent(new Event('change', { bubbles: true }));
  }

  fileInput.addEventListener('change', event => {
    setSelectedFile(event.target.files?.[0] || null);
  });

  outputName.addEventListener('input', () => {
    if (!output.value) {
      downloadButton.download = buildOcrOutputFileName(outputName.value || state.file?.name);
      return;
    }

    downloadButton.download = buildOcrOutputFileName(outputName.value || state.file?.name);
    downloadButton.textContent = `Download ${downloadButton.download}`;
  });

  unbindDropZone = bindFileDropZone(dropZone, {
    accept: IMAGE_OCR_FILE_ACCEPT,
    onFile: setSelectedFile,
    onReject: file => {
      setSelectedFile(file);
    }
  });

  runButton.addEventListener('click', handleRunOcr);
  copyButton.addEventListener('click', copyOutput);
  clearButton.addEventListener('click', () => {
    state.runId += 1;
    state.file = null;
    fileInput.value = '';
    outputName.value = '';
    resetOutput();
    revokePreviewUrl();
    updateSelectedSummary();
    renderEmptyPreview();
    setBusy(false);
    setStatus('Ready.', null);
  });

  return () => {
    state.runId += 1;
    unbindDropZone?.();
    revokePreviewUrl();
    revokeOutputUrl();
  };
}

function formatSelectedFileMeta(file) {
  const format = detectOcrImageFileType(file);
  const type = format?.label || 'Unsupported type';

  return `${type} · ${formatBytes(file.size || 0)}`;
}

function formatElapsedTime(milliseconds) {
  const seconds = Math.max(0, milliseconds / 1000);

  return `${seconds.toLocaleString('en-GB', {
    maximumFractionDigits: 1
  })} s`;
}

function assertWorkerCapableOrigin() {
  if (window.location.protocol === 'file:') {
    throw new Error('Image OCR needs the app to be served from localhost, HTTPS or GitHub Pages because browsers block local worker assets from file URLs.');
  }
}

function getOcrErrorMessage(error) {
  const message = String(error?.message || error || '').trim();

  if (/network error while fetching|failed to fetch|importscripts|worker/i.test(message)) {
    return 'OCR assets could not be loaded. Serve the static app from localhost, HTTPS or GitHub Pages and try again.';
  }

  return message || 'OCR failed. Review the image and try again.';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getFileInitials(fileName) {
  const extension = String(fileName || 'file')
    .split('.')
    .pop()
    .slice(0, 3);

  return extension.toUpperCase() || 'IMG';
}
