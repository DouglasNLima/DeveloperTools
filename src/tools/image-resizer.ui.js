import { formatBytes } from './base64.js';
import { bindFileDropZone } from './file-drop-zone.js';
import { openFilePreviewModal } from './file-preview-modal.js';
import { assertSafeSvgText, validateImageFile } from './image-converter.js';
import {
  DEFAULT_IMAGE_QUALITY_PERCENT,
  DEFAULT_IMAGE_SCALE_PERCENT,
  IMAGE_RESIZE_MODES,
  IMAGE_RESIZER_FILE_ACCEPT,
  IMAGE_RESIZER_OUTPUT_FORMATS,
  buildImageResizeWarnings,
  buildImageResizerOutputFileName,
  calculateDimensionScale,
  calculateMaxResizeDimensions,
  calculateScaleDimensions,
  normaliseMaxResizeDimensions,
  normaliseOutputImageFormat,
  normaliseQualityPercent,
  normaliseResizeMode,
  normaliseScalePercent,
  normaliseTargetFileSize,
  summariseImageSizeChange
} from './image-resizer.js';

const MIN_TARGET_DIMENSION_SCALE = 0.02;
const TARGET_SCALE_ITERATIONS = 8;
const QUALITY_SEARCH_ITERATIONS = 8;
const MIN_LOSSY_QUALITY = 0.1;

export function renderImageResizerCompressor(container) {
  container.innerHTML = `
    <form class="tool-board image-resizer-tool" data-tool-form>
      <div id="imageResizerDropZone" class="drop-zone">
        <label for="imageResizerFileInput" class="drop-zone-label">
          <span>Drop images here or browse</span>
          <small>SVG, PNG, JPEG and WebP files are resized locally in this browser.</small>
        </label>
        <input id="imageResizerFileInput" type="file" accept="${IMAGE_RESIZER_FILE_ACCEPT}" multiple />
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="imageResizeMode">Mode</label>
          <select id="imageResizeMode">
            ${IMAGE_RESIZE_MODES.map(mode => `<option value="${mode.value}">${mode.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="imageResizerTargetFormat">Output format</label>
          <select id="imageResizerTargetFormat">
            ${IMAGE_RESIZER_OUTPUT_FORMATS.map(format => `<option value="${format.value}"${format.value === 'jpeg' ? ' selected' : ''}>${format.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack image-range-field">
          <label for="imageResizeQualityRange">JPEG/WebP quality</label>
          <div class="image-range-row">
            <input id="imageResizeQualityRange" type="range" min="10" max="100" step="1" value="${DEFAULT_IMAGE_QUALITY_PERCENT}" />
            <span id="imageResizeQualityValue" class="image-range-value">${DEFAULT_IMAGE_QUALITY_PERCENT}%</span>
          </div>
        </div>
      </div>

      <div id="imageResizeScalePanel" class="image-resizer-mode-panel">
        <div class="field-stack image-range-field">
          <label for="imageResizeScaleRange">Scale</label>
          <div class="image-range-row">
            <input id="imageResizeScaleRange" type="range" min="1" max="100" step="1" value="${DEFAULT_IMAGE_SCALE_PERCENT}" />
            <input id="imageResizeScaleInput" class="compact-number-input" type="number" min="1" max="100" step="1" value="${DEFAULT_IMAGE_SCALE_PERCENT}" aria-label="Scale percentage" />
            <span aria-hidden="true">%</span>
          </div>
        </div>
      </div>

      <div id="imageResizeDimensionsPanel" class="image-resizer-mode-panel" hidden>
        <div class="form-grid form-grid--double">
          <div class="field-stack">
            <label for="imageResizeMaxWidth">Max width (px)</label>
            <input id="imageResizeMaxWidth" type="number" min="1" max="12000" step="1" placeholder="Original width" />
          </div>
          <div class="field-stack">
            <label for="imageResizeMaxHeight">Max height (px)</label>
            <input id="imageResizeMaxHeight" type="number" min="1" max="12000" step="1" placeholder="Original height" />
          </div>
        </div>
      </div>

      <div id="imageResizeTargetPanel" class="image-resizer-mode-panel" hidden>
        <div class="form-grid form-grid--double">
          <div class="field-stack">
            <label for="imageResizeTargetSize">Target size</label>
            <input id="imageResizeTargetSize" type="number" min="1" step="0.1" placeholder="Example: 250" />
          </div>
          <div class="field-stack">
            <label for="imageResizeTargetUnit">Target unit</label>
            <select id="imageResizeTargetUnit">
              <option value="KB">KB</option>
              <option value="MB">MB</option>
            </select>
          </div>
        </div>
      </div>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Selected files</span>
          <strong id="imageResizerSelectedCount">0</strong>
        </div>
        <div class="detail-card">
          <span>Source size</span>
          <strong id="imageResizerSourceSizeDetail">None</strong>
        </div>
        <div class="detail-card">
          <span>Live output</span>
          <strong id="imageResizerOutputSizeDetail">No output yet</strong>
        </div>
        <div class="detail-card">
          <span>Dimensions</span>
          <strong id="imageResizerDimensionsDetail">No image</strong>
        </div>
        <div class="detail-card">
          <span>Reduction</span>
          <strong id="imageResizerReductionDetail">None</strong>
        </div>
        <div class="detail-card">
          <span>Target</span>
          <strong id="imageResizerTargetDetail">Not used</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="imageResizerWarningsDetail">None</strong>
        </div>
        <div class="detail-card">
          <span>Quality</span>
          <strong id="imageResizerQualityDetail">${DEFAULT_IMAGE_QUALITY_PERCENT}%</strong>
        </div>
      </div>

      <div class="image-resizer-preview-grid" aria-live="polite">
        <figure class="image-resizer-preview">
          <figcaption>Original preview</figcaption>
          <div id="imageResizerSourcePreview" class="image-resizer-preview-media">
            <span>No image selected</span>
          </div>
        </figure>
        <figure class="image-resizer-preview">
          <figcaption>Live resized preview</figcaption>
          <div id="imageResizerOutputPreview" class="image-resizer-preview-media">
            <span>No output yet</span>
          </div>
        </figure>
      </div>

      <div class="button-row button-row--end">
        <button id="resizeImagesButton" class="primary" type="button">Resize images</button>
        <button id="clearImageResizerButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="output-toolbar">
        <label for="imageResizerResults">Results</label>
      </div>

      <div id="imageResizerResults" class="image-converter-results" aria-live="polite">
        <p class="empty-state">No images selected.</p>
      </div>

      <div id="imageResizerStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const dropZone = container.querySelector('#imageResizerDropZone');
  const fileInput = container.querySelector('#imageResizerFileInput');
  const mode = container.querySelector('#imageResizeMode');
  const targetFormat = container.querySelector('#imageResizerTargetFormat');
  const qualityRange = container.querySelector('#imageResizeQualityRange');
  const qualityValue = container.querySelector('#imageResizeQualityValue');
  const scaleRange = container.querySelector('#imageResizeScaleRange');
  const scaleInput = container.querySelector('#imageResizeScaleInput');
  const maxWidth = container.querySelector('#imageResizeMaxWidth');
  const maxHeight = container.querySelector('#imageResizeMaxHeight');
  const targetSize = container.querySelector('#imageResizeTargetSize');
  const targetUnit = container.querySelector('#imageResizeTargetUnit');
  const scalePanel = container.querySelector('#imageResizeScalePanel');
  const dimensionsPanel = container.querySelector('#imageResizeDimensionsPanel');
  const targetPanel = container.querySelector('#imageResizeTargetPanel');
  const resizeButton = container.querySelector('#resizeImagesButton');
  const clearButton = container.querySelector('#clearImageResizerButton');
  const selectedCount = container.querySelector('#imageResizerSelectedCount');
  const sourceSizeDetail = container.querySelector('#imageResizerSourceSizeDetail');
  const outputSizeDetail = container.querySelector('#imageResizerOutputSizeDetail');
  const dimensionsDetail = container.querySelector('#imageResizerDimensionsDetail');
  const reductionDetail = container.querySelector('#imageResizerReductionDetail');
  const targetDetail = container.querySelector('#imageResizerTargetDetail');
  const warningsDetail = container.querySelector('#imageResizerWarningsDetail');
  const qualityDetail = container.querySelector('#imageResizerQualityDetail');
  const sourcePreview = container.querySelector('#imageResizerSourcePreview');
  const outputPreview = container.querySelector('#imageResizerOutputPreview');
  const results = container.querySelector('#imageResizerResults');
  const status = container.querySelector('#imageResizerStatus');

  const state = {
    files: [],
    objectUrls: [],
    resultObjectUrls: [],
    sourcePreviewUrl: null,
    livePreviewUrl: null,
    previewTimer: null,
    sourcePreviewRunId: 0,
    livePreviewRunId: 0,
    runId: 0
  };

  let unbindDropZone = null;
  let closePreviewDialog = null;

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function closeOpenPreviewDialog() {
    closePreviewDialog?.();
    closePreviewDialog = null;
  }

  function trackObjectUrl(url) {
    state.objectUrls.push(url);
    return url;
  }

  function revokeResultObjectUrls() {
    closeOpenPreviewDialog();
    state.resultObjectUrls.forEach(url => URL.revokeObjectURL(url));
    state.objectUrls = state.objectUrls.filter(url => !state.resultObjectUrls.includes(url));
    state.resultObjectUrls = [];
  }

  function revokePreviewObjectUrls() {
    const previewUrls = [state.sourcePreviewUrl, state.livePreviewUrl].filter(Boolean);

    previewUrls.forEach(url => URL.revokeObjectURL(url));
    state.objectUrls = state.objectUrls.filter(url => !previewUrls.includes(url));
    state.sourcePreviewUrl = null;
    state.livePreviewUrl = null;
  }

  function revokeAllObjectUrls() {
    closeOpenPreviewDialog();
    state.objectUrls.forEach(url => URL.revokeObjectURL(url));
    state.objectUrls = [];
    state.resultObjectUrls = [];
    state.sourcePreviewUrl = null;
    state.livePreviewUrl = null;
  }

  function setPreviewObjectUrl(kind, url) {
    const key = kind === 'source' ? 'sourcePreviewUrl' : 'livePreviewUrl';
    const previousUrl = state[key];

    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      state.objectUrls = state.objectUrls.filter(objectUrl => objectUrl !== previousUrl);
    }

    state[key] = trackObjectUrl(url);
  }

  function updateControlState() {
    const selectedMode = mode.value;
    const format = normaliseOutputImageFormat(targetFormat.value);
    const usesQuality = format.value === 'jpeg' || format.value === 'webp';

    scalePanel.hidden = selectedMode !== 'scale';
    dimensionsPanel.hidden = selectedMode !== 'dimensions';
    targetPanel.hidden = selectedMode !== 'target-size';
    qualityRange.disabled = !usesQuality;
    qualityValue.textContent = usesQuality ? `${qualityRange.value}%` : 'Not used';
    qualityDetail.textContent = usesQuality ? `${qualityRange.value}%` : 'Not used';

    try {
      const settings = readSettings();

      targetDetail.textContent = settings.targetBytes ? formatBytes(settings.targetBytes) : 'Not used';
    } catch {
      targetDetail.textContent = selectedMode === 'target-size' ? 'Invalid target' : 'Not used';
    }
  }

  function resetSummary() {
    selectedCount.textContent = state.files.length.toLocaleString('en-GB');
    sourceSizeDetail.textContent = state.files[0] ? formatBytes(state.files[0].size || 0) : 'None';
    outputSizeDetail.textContent = 'No output yet';
    dimensionsDetail.textContent = state.files[0] ? 'Waiting for preview' : 'No image';
    reductionDetail.textContent = 'None';
    warningsDetail.textContent = 'None';
    updateControlState();
  }

  function readSettings() {
    const outputFormat = normaliseOutputImageFormat(targetFormat.value);
    const selectedMode = normaliseResizeMode(mode.value);
    const qualityPercent = normaliseQualityPercent(qualityRange.value, outputFormat);
    const settings = {
      mode: selectedMode,
      targetFormat: outputFormat,
      qualityPercent,
      quality: qualityPercent === null ? null : qualityPercent / 100,
      maxQuality: qualityPercent === null ? null : qualityPercent / 100,
      targetBytes: null
    };

    if (selectedMode === 'scale') {
      settings.scalePercent = normaliseScalePercent(scaleInput.value);
    } else if (selectedMode === 'dimensions') {
      settings.dimensions = normaliseMaxResizeDimensions({
        maxWidth: maxWidth.value,
        maxHeight: maxHeight.value
      });
    } else {
      settings.targetBytes = normaliseTargetFileSize(targetSize.value, targetUnit.value);
    }

    return settings;
  }

  function setSelectedFiles(files) {
    state.files = Array.from(files || []);
    state.runId += 1;
    state.sourcePreviewRunId += 1;
    state.livePreviewRunId += 1;
    revokeResultObjectUrls();
    revokePreviewObjectUrls();
    renderQueuedFiles();
    resetSummary();
    updateSourcePreview();
    scheduleLivePreview();

    if (state.files.length === 0) {
      setStatus('Ready.', null);
      return;
    }

    const count = state.files.length.toLocaleString('en-GB');
    setStatus(`${count} image file${state.files.length === 1 ? '' : 's'} selected.`, null);
  }

  function renderQueuedFiles() {
    results.innerHTML = '';

    if (state.files.length === 0) {
      results.innerHTML = '<p class="empty-state">No images selected.</p>';
      return;
    }

    const fragment = document.createDocumentFragment();

    state.files.forEach(file => {
      fragment.append(createPendingCard(file));
    });

    results.append(fragment);
  }

  function createPendingCard(file) {
    const card = document.createElement('article');
    card.className = 'image-result-card pending';
    card.innerHTML = `
      <div class="image-result-preview" aria-hidden="true">
        <span>${escapeHtml(getFileInitials(file.name))}</span>
      </div>
      <div class="image-result-body">
        <div class="image-result-header">
          <strong>${escapeHtml(file.name || 'Selected image')}</strong>
          <span>Ready</span>
        </div>
        <p>${escapeHtml(formatBytes(file.size || 0))}</p>
      </div>
    `;

    return card;
  }

  async function updateSourcePreview() {
    const runId = ++state.sourcePreviewRunId;
    const file = state.files[0];

    if (!file) {
      revokePreviewObjectUrls();
      sourcePreview.innerHTML = '<span>No image selected</span>';
      return;
    }

    sourcePreview.innerHTML = '<span>Loading preview</span>';

    try {
      const sourceFormat = validateImageFile(file);
      const source = await createDrawableSource(file, sourceFormat);

      if (runId !== state.sourcePreviewRunId) {
        source.revoke();
        return;
      }

      setPreviewObjectUrl('source', source.url);
      sourcePreview.innerHTML = `<img src="${source.url}" alt="" />`;
    } catch (error) {
      if (state.sourcePreviewUrl) {
        URL.revokeObjectURL(state.sourcePreviewUrl);
        state.objectUrls = state.objectUrls.filter(url => url !== state.sourcePreviewUrl);
        state.sourcePreviewUrl = null;
      }
      sourcePreview.innerHTML = `<span>${escapeHtml(error.message || 'Unable to preview image')}</span>`;
    }
  }

  function scheduleLivePreview() {
    clearTimeout(state.previewTimer);

    state.previewTimer = window.setTimeout(() => {
      updateLivePreview();
    }, 160);
  }

  async function updateLivePreview() {
    const runId = ++state.livePreviewRunId;
    const file = state.files[0];

    if (!file) {
      outputPreview.innerHTML = '<span>No output yet</span>';
      resetSummary();
      return;
    }

    let settings;

    try {
      settings = readSettings();
    } catch (error) {
      if (state.livePreviewUrl) {
        URL.revokeObjectURL(state.livePreviewUrl);
        state.objectUrls = state.objectUrls.filter(url => url !== state.livePreviewUrl);
        state.livePreviewUrl = null;
      }
      outputPreview.innerHTML = '<span>Review settings</span>';
      outputSizeDetail.textContent = 'Invalid settings';
      dimensionsDetail.textContent = error.message || 'Review settings';
      reductionDetail.textContent = 'None';
      warningsDetail.textContent = 'None';
      updateControlState();
      return;
    }

    outputPreview.innerHTML = '<span>Building preview</span>';
    outputSizeDetail.textContent = 'Calculating...';

    try {
      const result = await resizeImageFile(file, settings);

      if (runId !== state.livePreviewRunId) {
        URL.revokeObjectURL(result.objectUrl);
        return;
      }

      setPreviewObjectUrl('live', result.objectUrl);
      outputPreview.innerHTML = `<img src="${result.objectUrl}" alt="" />`;
      updateLiveDetails(result);
    } catch (error) {
      if (state.livePreviewUrl) {
        URL.revokeObjectURL(state.livePreviewUrl);
        state.objectUrls = state.objectUrls.filter(url => url !== state.livePreviewUrl);
        state.livePreviewUrl = null;
      }
      outputPreview.innerHTML = `<span>${escapeHtml(error.message || 'Unable to build preview')}</span>`;
      outputSizeDetail.textContent = 'Preview failed';
      dimensionsDetail.textContent = error.message || 'Unable to build preview';
      reductionDetail.textContent = 'None';
      warningsDetail.textContent = 'None';
    }
  }

  function updateLiveDetails(result) {
    const sizeChange = summariseImageSizeChange(result.sourceBytes, result.blob.size);

    sourceSizeDetail.textContent = formatBytes(result.sourceBytes);
    outputSizeDetail.textContent = formatBytes(result.blob.size);
    dimensionsDetail.textContent = formatDimensions(result.dimensions.width, result.dimensions.height);
    reductionDetail.textContent = formatReduction(sizeChange);
    warningsDetail.textContent = result.warnings.length === 0
      ? 'None'
      : `${result.warnings.length.toLocaleString('en-GB')} warning${result.warnings.length === 1 ? '' : 's'}`;
    targetDetail.textContent = result.targetBytes ? formatBytes(result.targetBytes) : 'Not used';
    qualityDetail.textContent = result.qualityPercent ? `${Math.round(result.qualityPercent)}%` : 'Not used';
  }

  async function handleResize() {
    const runId = state.runId + 1;
    state.runId = runId;
    revokeResultObjectUrls();

    if (state.files.length === 0) {
      renderQueuedFiles();
      setStatus('Select one or more image files before resizing.', 'error');
      return;
    }

    let settings;

    try {
      settings = readSettings();
    } catch (error) {
      updateControlState();
      scheduleLivePreview();
      setStatus(error.message || 'Review the image resize settings.', 'error');
      return;
    }

    results.innerHTML = '';
    resizeButton.disabled = true;
    setStatus('Resizing images locally...', null);

    let converted = 0;
    let failed = 0;
    let warningCount = 0;
    let firstErrorMessage = '';

    for (const file of state.files) {
      if (runId !== state.runId) {
        break;
      }

      const card = createWorkingCard(file);
      results.append(card.element);

      try {
        const result = await resizeImageFile(file, settings);

        if (runId !== state.runId) {
          URL.revokeObjectURL(result.objectUrl);
          break;
        }

        converted += 1;
        warningCount += result.warnings.length;
        state.resultObjectUrls.push(trackObjectUrl(result.objectUrl));
        renderSuccessCard(card, result);
      } catch (error) {
        failed += 1;
        firstErrorMessage ||= error.message || 'Unable to resize this image.';
        renderErrorCard(card, file, error);
      }

      selectedCount.textContent = state.files.length.toLocaleString('en-GB');
      warningsDetail.textContent = warningCount === 0
        ? 'None'
        : `${warningCount.toLocaleString('en-GB')} warning${warningCount === 1 ? '' : 's'}`;
    }

    resizeButton.disabled = false;
    scheduleLivePreview();

    if (failed > 0 && converted > 0) {
      setStatus(`${converted.toLocaleString('en-GB')} image${converted === 1 ? '' : 's'} resized. ${failed.toLocaleString('en-GB')} failed.`, 'error');
    } else if (failed > 0) {
      setStatus(firstErrorMessage || 'Image resizing failed. Review the file type and settings.', 'error');
    } else {
      setStatus('Image resizing completed successfully.', 'success');
    }
  }

  function createWorkingCard(file) {
    const element = document.createElement('article');
    element.className = 'image-result-card working';
    element.innerHTML = `
      <div class="image-result-preview" aria-hidden="true">
        <span>${escapeHtml(getFileInitials(file.name))}</span>
      </div>
      <div class="image-result-body">
        <div class="image-result-header">
          <strong>${escapeHtml(file.name || 'Selected image')}</strong>
          <span>Resizing</span>
        </div>
        <p>${escapeHtml(formatBytes(file.size || 0))}</p>
      </div>
    `;

    return { element };
  }

  function renderSuccessCard(card, result) {
    const sizeChange = summariseImageSizeChange(result.sourceBytes, result.blob.size);

    card.element.className = `image-result-card success${result.warnings.length ? ' has-warning' : ''}`;
    card.element.dataset.outputBytes = String(result.blob.size);
    card.element.dataset.outputWidth = String(result.dimensions.width);
    card.element.dataset.outputHeight = String(result.dimensions.height);
    card.element.innerHTML = `
      <div class="image-result-preview">
        <img src="${result.objectUrl}" alt="" />
      </div>
      <div class="image-result-body">
        <div class="image-result-header">
          <strong>${escapeHtml(result.outputName)}</strong>
          <span>Resized</span>
        </div>
        <p>${escapeHtml(result.sourceFormat.label)} to ${escapeHtml(result.targetFormat.label)} · ${escapeHtml(formatDimensions(result.dimensions.width, result.dimensions.height))} · ${escapeHtml(formatBytes(result.blob.size))} · ${escapeHtml(formatReduction(sizeChange))}</p>
        ${result.warnings.length ? `<ul class="image-warning-list">${result.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>` : ''}
        <div class="button-row image-result-actions">
          <a class="button primary image-download-link" href="${result.objectUrl}" download="${escapeHtml(result.outputName)}">Download ${escapeHtml(result.outputName)}</a>
        </div>
      </div>
    `;

    const actions = card.element.querySelector('.image-result-actions');
    const previewButton = document.createElement('button');
    previewButton.className = 'secondary image-preview-button';
    previewButton.type = 'button';
    previewButton.textContent = 'Preview image';
    previewButton.title = `Preview ${result.outputName}`;
    previewButton.addEventListener('click', () => {
      closeOpenPreviewDialog();
      closePreviewDialog = openFilePreviewModal(container, {
        blob: result.blob,
        downloadUrl: result.objectUrl,
        fileInfo: {
          label: `${result.targetFormat.label} image`,
          mimeType: result.targetFormat.mimeType
        },
        fileName: result.outputName,
        objectUrl: result.objectUrl,
        previewKind: 'image',
        trigger: previewButton
      });
    });
    actions.append(previewButton);
  }

  function renderErrorCard(card, file, error) {
    card.element.className = 'image-result-card error';
    card.element.innerHTML = `
      <div class="image-result-preview" aria-hidden="true">
        <span>${escapeHtml(getFileInitials(file.name))}</span>
      </div>
      <div class="image-result-body">
        <div class="image-result-header">
          <strong>${escapeHtml(file.name || 'Selected image')}</strong>
          <span>Failed</span>
        </div>
        <p>${escapeHtml(error.message || 'Unable to resize this image.')}</p>
      </div>
    `;
  }

  function resetTool() {
    state.files = [];
    state.runId += 1;
    state.sourcePreviewRunId += 1;
    state.livePreviewRunId += 1;
    clearTimeout(state.previewTimer);
    fileInput.value = '';
    mode.value = 'scale';
    targetFormat.value = 'jpeg';
    qualityRange.value = String(DEFAULT_IMAGE_QUALITY_PERCENT);
    scaleRange.value = String(DEFAULT_IMAGE_SCALE_PERCENT);
    scaleInput.value = String(DEFAULT_IMAGE_SCALE_PERCENT);
    maxWidth.value = '';
    maxHeight.value = '';
    targetSize.value = '';
    targetUnit.value = 'KB';
    revokeAllObjectUrls();
    sourcePreview.innerHTML = '<span>No image selected</span>';
    outputPreview.innerHTML = '<span>No output yet</span>';
    renderQueuedFiles();
    resetSummary();
    setStatus('Ready.', null);
  }

  function syncScaleFromRange() {
    scaleInput.value = scaleRange.value;
    updateControlState();
    scheduleLivePreview();
  }

  function syncScaleFromInput() {
    scaleRange.value = scaleInput.value;
    updateControlState();
    scheduleLivePreview();
  }

  fileInput.addEventListener('change', event => {
    setSelectedFiles(event.target.files);
  });

  unbindDropZone = bindFileDropZone(dropZone, {
    accept: IMAGE_RESIZER_FILE_ACCEPT,
    multiple: true,
    onFiles: setSelectedFiles,
    onReject: (_file, rejectedFiles = []) => {
      const count = rejectedFiles.length || 1;
      setStatus(`${count.toLocaleString('en-GB')} unsupported file${count === 1 ? '' : 's'} skipped.`, 'error');
    }
  });

  mode.addEventListener('change', () => {
    updateControlState();
    scheduleLivePreview();
  });
  targetFormat.addEventListener('change', () => {
    updateControlState();
    scheduleLivePreview();
  });
  qualityRange.addEventListener('input', () => {
    updateControlState();
    scheduleLivePreview();
  });
  scaleRange.addEventListener('input', syncScaleFromRange);
  scaleInput.addEventListener('input', syncScaleFromInput);
  maxWidth.addEventListener('input', scheduleLivePreview);
  maxHeight.addEventListener('input', scheduleLivePreview);
  targetSize.addEventListener('input', scheduleLivePreview);
  targetUnit.addEventListener('change', scheduleLivePreview);
  resizeButton.addEventListener('click', handleResize);
  clearButton.addEventListener('click', resetTool);

  updateControlState();

  return () => {
    state.runId += 1;
    state.sourcePreviewRunId += 1;
    state.livePreviewRunId += 1;
    clearTimeout(state.previewTimer);
    unbindDropZone?.();
    revokeAllObjectUrls();
  };
}

async function resizeImageFile(file, settings) {
  const sourceFormat = validateImageFile(file);
  const targetFormat = settings.targetFormat;
  const outputName = buildImageResizerOutputFileName(file.name, targetFormat);
  const source = await createDrawableSource(file, sourceFormat);

  try {
    const image = await loadImage(source.url);
    const sourceDimensions = {
      width: image.naturalWidth,
      height: image.naturalHeight
    };
    const output = settings.mode === 'target-size'
      ? await buildTargetSizeOutput(image, sourceDimensions, settings)
      : await buildDirectResizeOutput(image, sourceDimensions, settings);
    const objectUrl = URL.createObjectURL(output.blob);
    const warnings = buildImageResizeWarnings({
      sourceFormat,
      targetFormat,
      mode: settings.mode,
      dimensions: output.dimensions,
      sourceBytes: file.size || 0,
      outputBytes: output.blob.size,
      targetBytes: settings.targetBytes
    });

    return {
      sourceFormat,
      targetFormat,
      outputName,
      blob: output.blob,
      objectUrl,
      sourceBytes: file.size || 0,
      sourceDimensions,
      dimensions: output.dimensions,
      qualityPercent: output.quality === null ? null : Math.round(output.quality * 100),
      targetBytes: settings.targetBytes,
      warnings
    };
  } finally {
    source.revoke();
  }
}

async function buildDirectResizeOutput(image, sourceDimensions, settings) {
  const dimensions = settings.mode === 'scale'
    ? calculateScaleDimensions(sourceDimensions.width, sourceDimensions.height, settings.scalePercent)
    : calculateMaxResizeDimensions(sourceDimensions.width, sourceDimensions.height, settings.dimensions);
  const blob = await renderRasterBlob(image, dimensions, settings.targetFormat, settings.quality);

  return {
    blob,
    dimensions,
    quality: settings.quality
  };
}

async function buildTargetSizeOutput(image, sourceDimensions, settings) {
  if (settings.targetFormat.value === 'png') {
    return buildPngTargetSizeOutput(image, sourceDimensions, settings);
  }

  return buildLossyTargetSizeOutput(image, sourceDimensions, settings);
}

async function buildLossyTargetSizeOutput(image, sourceDimensions, settings) {
  const sourceScale = 1;
  const sourceDimensionsResult = calculateDimensionScale(sourceDimensions.width, sourceDimensions.height, sourceScale);
  const qualityAttempt = await findBestLossyQuality(image, sourceDimensionsResult, settings);

  if (qualityAttempt.targetReached) {
    return qualityAttempt;
  }

  let smallest = qualityAttempt;
  let bestScaleDimensions = null;
  let low = MIN_TARGET_DIMENSION_SCALE;
  let high = 1;

  for (let index = 0; index < TARGET_SCALE_ITERATIONS; index += 1) {
    const scale = (low + high) / 2;
    const dimensions = calculateDimensionScale(sourceDimensions.width, sourceDimensions.height, scale);
    const blob = await renderRasterBlob(image, dimensions, settings.targetFormat, MIN_LOSSY_QUALITY);
    const candidate = {
      blob,
      dimensions,
      quality: MIN_LOSSY_QUALITY,
      targetReached: blob.size <= settings.targetBytes
    };

    if (candidate.blob.size < smallest.blob.size) {
      smallest = candidate;
    }

    if (candidate.targetReached) {
      bestScaleDimensions = dimensions;
      low = scale;
    } else {
      high = scale;
    }
  }

  if (!bestScaleDimensions) {
    return smallest;
  }

  const scaledQualityAttempt = await findBestLossyQuality(image, bestScaleDimensions, settings);

  return scaledQualityAttempt.targetReached ? scaledQualityAttempt : smallest;
}

async function findBestLossyQuality(image, dimensions, settings) {
  const maxQuality = settings.maxQuality ?? DEFAULT_IMAGE_QUALITY_PERCENT / 100;
  const maxBlob = await renderRasterBlob(image, dimensions, settings.targetFormat, maxQuality);

  if (maxBlob.size <= settings.targetBytes) {
    return {
      blob: maxBlob,
      dimensions,
      quality: maxQuality,
      targetReached: true
    };
  }

  let smallest = {
    blob: maxBlob,
    dimensions,
    quality: maxQuality,
    targetReached: false
  };
  const minBlob = await renderRasterBlob(image, dimensions, settings.targetFormat, MIN_LOSSY_QUALITY);

  if (minBlob.size < smallest.blob.size) {
    smallest = {
      blob: minBlob,
      dimensions,
      quality: MIN_LOSSY_QUALITY,
      targetReached: minBlob.size <= settings.targetBytes
    };
  }

  if (minBlob.size > settings.targetBytes) {
    return smallest;
  }

  let low = MIN_LOSSY_QUALITY;
  let high = maxQuality;
  let best = {
    blob: minBlob,
    dimensions,
    quality: MIN_LOSSY_QUALITY,
    targetReached: true
  };

  for (let index = 0; index < QUALITY_SEARCH_ITERATIONS; index += 1) {
    const quality = (low + high) / 2;
    const blob = await renderRasterBlob(image, dimensions, settings.targetFormat, quality);

    if (blob.size <= settings.targetBytes) {
      best = {
        blob,
        dimensions,
        quality,
        targetReached: true
      };
      low = quality;
    } else {
      high = quality;
    }
  }

  return best;
}

async function buildPngTargetSizeOutput(image, sourceDimensions, settings) {
  const fullDimensions = calculateDimensionScale(sourceDimensions.width, sourceDimensions.height, 1);
  const fullBlob = await renderRasterBlob(image, fullDimensions, settings.targetFormat, null);

  if (fullBlob.size <= settings.targetBytes) {
    return {
      blob: fullBlob,
      dimensions: fullDimensions,
      quality: null,
      targetReached: true
    };
  }

  let smallest = {
    blob: fullBlob,
    dimensions: fullDimensions,
    quality: null,
    targetReached: false
  };
  let best = null;
  let low = MIN_TARGET_DIMENSION_SCALE;
  let high = 1;

  for (let index = 0; index < TARGET_SCALE_ITERATIONS; index += 1) {
    const scale = (low + high) / 2;
    const dimensions = calculateDimensionScale(sourceDimensions.width, sourceDimensions.height, scale);
    const blob = await renderRasterBlob(image, dimensions, settings.targetFormat, null);
    const candidate = {
      blob,
      dimensions,
      quality: null,
      targetReached: blob.size <= settings.targetBytes
    };

    if (candidate.blob.size < smallest.blob.size) {
      smallest = candidate;
    }

    if (candidate.targetReached) {
      best = candidate;
      low = scale;
    } else {
      high = scale;
    }
  }

  return best || smallest;
}

async function createDrawableSource(file, sourceFormat) {
  if (sourceFormat.value === 'svg') {
    const svgText = assertSafeSvgText(await file.text());
    const blob = new Blob([svgText], { type: `${sourceFormat.mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);

    return {
      url,
      revoke: () => URL.revokeObjectURL(url)
    };
  }

  const url = URL.createObjectURL(file);

  return {
    url,
    revoke: () => URL.revokeObjectURL(url)
  };
}

function renderRasterBlob(image, dimensions, targetFormat, quality) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  if (targetFormat.value === 'jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

  return canvasToBlob(canvas, targetFormat.mimeType, quality ?? undefined);
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error(`This browser cannot create ${mimeType} image output.`));
        return;
      }

      resolve(blob);
    }, mimeType, quality);
  });
}

function loadImage(sourceUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('Image dimensions could not be detected.'));
        return;
      }

      resolve(image);
    };
    image.onerror = () => reject(new Error('Unable to decode this image in the browser.'));
    image.src = sourceUrl;
  });
}

function formatDimensions(width, height) {
  return `${Math.round(width).toLocaleString('en-GB')} x ${Math.round(height).toLocaleString('en-GB')} px`;
}

function formatReduction(sizeChange) {
  if (sizeChange.savedBytes > 0) {
    return `${Math.abs(sizeChange.savedPercent).toLocaleString('en-GB')}% smaller`;
  }

  if (sizeChange.savedBytes < 0) {
    return `${Math.abs(sizeChange.savedPercent).toLocaleString('en-GB')}% larger`;
  }

  return 'No change';
}

function getFileInitials(fileName) {
  const extension = String(fileName || 'image')
    .split('.')
    .pop()
    .slice(0, 3);

  return extension.toUpperCase() || 'IMG';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
