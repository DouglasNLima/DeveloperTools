import { formatBytes } from './base64.js';
import { bindFileDropZone } from './file-drop-zone.js';
import { openFilePreviewModal } from './file-preview-modal.js';
import {
  IMAGE_FILE_ACCEPT,
  IMAGE_FORMATS,
  assertSafeSvgText,
  buildEmbeddedRasterSvg,
  buildImageConversionWarnings,
  buildImageOutputFileName,
  calculateContainDimensions,
  determineConversionMode,
  normaliseBackgroundColour,
  normaliseImageFormat,
  normaliseRasterQuality,
  normaliseResizeOptions,
  validateImageFile
} from './image-converter.js';

export function renderImageConverter(container) {
  container.innerHTML = `
    <form class="tool-board image-converter-tool" data-tool-form>
      <div id="imageConverterDropZone" class="drop-zone">
        <label for="imageConverterFileInput" class="drop-zone-label">
          <span>Drop images here or browse</span>
          <small>SVG, PNG, JPEG and WebP files are read locally in this browser.</small>
        </label>
        <input id="imageConverterFileInput" type="file" accept="${IMAGE_FILE_ACCEPT}" multiple />
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="imageTargetFormat">Target format</label>
          <select id="imageTargetFormat">
            ${IMAGE_FORMATS.map(format => `<option value="${format.value}">${format.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="imageQuality">JPEG/WebP quality</label>
          <input id="imageQuality" type="number" min="10" max="100" step="1" value="92" />
        </div>

        <div class="button-row button-row--end">
          <button id="convertImagesButton" class="primary" type="button">Convert images</button>
          <button id="clearImageConverterButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="imageMaxWidth">Max width (px)</label>
          <input id="imageMaxWidth" type="number" min="1" max="12000" step="1" placeholder="Original width" />
        </div>

        <div class="field-stack">
          <label for="imageMaxHeight">Max height (px)</label>
          <input id="imageMaxHeight" type="number" min="1" max="12000" step="1" placeholder="Original height" />
        </div>

        <div class="field-stack">
          <label for="imageBackgroundColour">JPEG background colour</label>
          <input id="imageBackgroundColour" type="color" value="#ffffff" />
        </div>
      </div>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Selected files</span>
          <strong id="imageSelectedCount">0</strong>
        </div>
        <div class="detail-card">
          <span>Converted files</span>
          <strong id="imageConvertedCount">0</strong>
        </div>
        <div class="detail-card">
          <span>Target</span>
          <strong id="imageTargetDetail">PNG</strong>
        </div>
        <div class="detail-card">
          <span>Resize</span>
          <strong id="imageResizeDetail">Original size</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="imageWarningsDetail">None</strong>
        </div>
        <div class="detail-card">
          <span>Failed files</span>
          <strong id="imageFailedCount">0</strong>
        </div>
        <div class="detail-card">
          <span>Quality</span>
          <strong id="imageQualityDetail">Not used</strong>
        </div>
        <div class="detail-card">
          <span>Background</span>
          <strong id="imageBackgroundDetail">Not used</strong>
        </div>
      </div>

      <div class="output-toolbar">
        <label for="imageConversionResults">Results</label>
      </div>

      <div id="imageConversionResults" class="image-converter-results" aria-live="polite">
        <p class="empty-state">No images selected.</p>
      </div>

      <div id="imageConverterStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const dropZone = container.querySelector('#imageConverterDropZone');
  const fileInput = container.querySelector('#imageConverterFileInput');
  const targetFormat = container.querySelector('#imageTargetFormat');
  const quality = container.querySelector('#imageQuality');
  const maxWidth = container.querySelector('#imageMaxWidth');
  const maxHeight = container.querySelector('#imageMaxHeight');
  const backgroundColour = container.querySelector('#imageBackgroundColour');
  const convertButton = container.querySelector('#convertImagesButton');
  const clearButton = container.querySelector('#clearImageConverterButton');
  const selectedCount = container.querySelector('#imageSelectedCount');
  const convertedCount = container.querySelector('#imageConvertedCount');
  const targetDetail = container.querySelector('#imageTargetDetail');
  const resizeDetail = container.querySelector('#imageResizeDetail');
  const warningsDetail = container.querySelector('#imageWarningsDetail');
  const failedCount = container.querySelector('#imageFailedCount');
  const qualityDetail = container.querySelector('#imageQualityDetail');
  const backgroundDetail = container.querySelector('#imageBackgroundDetail');
  const results = container.querySelector('#imageConversionResults');
  const status = container.querySelector('#imageConverterStatus');

  const state = {
    files: [],
    objectUrls: [],
    runId: 0
  };
  let unbindDropZone = null;
  let closePreviewDialog = null;

  function closeOpenPreviewDialog() {
    closePreviewDialog?.();
    closePreviewDialog = null;
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function revokeObjectUrls() {
    closeOpenPreviewDialog();
    state.objectUrls.forEach(url => URL.revokeObjectURL(url));
    state.objectUrls = [];
  }

  function trackObjectUrl(url) {
    state.objectUrls.push(url);
    return url;
  }

  function resetSummary() {
    selectedCount.textContent = state.files.length.toLocaleString('en-GB');
    convertedCount.textContent = '0';
    failedCount.textContent = '0';
    warningsDetail.textContent = 'None';
    updateSettingSummary();
  }

  function updateSettingSummary() {
    const target = normaliseImageFormat(targetFormat.value);
    let resizeText = 'Original size';

    try {
      const resize = normaliseResizeOptions({
        maxWidth: maxWidth.value,
        maxHeight: maxHeight.value
      });

      if (resize.hasResize) {
        resizeText = [
          resize.maxWidth ? `${resize.maxWidth.toLocaleString('en-GB')} px wide` : '',
          resize.maxHeight ? `${resize.maxHeight.toLocaleString('en-GB')} px high` : ''
        ].filter(Boolean).join(' / ');
      }
    } catch {
      resizeText = 'Invalid resize';
    }

    targetDetail.textContent = target.label;
    resizeDetail.textContent = resizeText;
    quality.disabled = target.value !== 'jpeg' && target.value !== 'webp';
    backgroundColour.disabled = target.value !== 'jpeg';
    qualityDetail.textContent = quality.disabled ? 'Not used' : `${quality.value || '92'}%`;
    backgroundDetail.textContent = backgroundColour.disabled ? 'Not used' : backgroundColour.value.toLowerCase();
  }

  function renderQueuedFiles() {
    results.innerHTML = '';

    if (state.files.length === 0) {
      results.innerHTML = '<p class="empty-state">No images selected.</p>';
      resetSummary();
      return;
    }

    const fragment = document.createDocumentFragment();

    state.files.forEach(file => {
      fragment.append(createPendingCard(file));
    });

    results.append(fragment);
    resetSummary();
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

  function setSelectedFiles(files) {
    state.files = Array.from(files || []);
    state.runId += 1;
    revokeObjectUrls();
    renderQueuedFiles();

    if (state.files.length === 0) {
      setStatus('Ready.', null);
      return;
    }

    const count = state.files.length.toLocaleString('en-GB');
    setStatus(`${count} image file${state.files.length === 1 ? '' : 's'} selected.`, null);
  }

  function readSettings() {
    const target = normaliseImageFormat(targetFormat.value);
    const resize = normaliseResizeOptions({
      maxWidth: maxWidth.value,
      maxHeight: maxHeight.value
    });
    const parsedQuality = normaliseRasterQuality(quality.value.trim() ? Number(quality.value) / 100 : '', target);

    return {
      targetFormat: target,
      resize,
      quality: parsedQuality,
      backgroundColour: normaliseBackgroundColour(backgroundColour.value)
    };
  }

  async function handleConvert() {
    const runId = state.runId + 1;
    state.runId = runId;
    revokeObjectUrls();

    if (state.files.length === 0) {
      renderQueuedFiles();
      setStatus('Select one or more image files before converting.', 'error');
      return;
    }

    let settings;

    try {
      settings = readSettings();
    } catch (error) {
      updateSettingSummary();
      setStatus(error.message || 'Review the image conversion settings.', 'error');
      return;
    }

    results.innerHTML = '';
    convertButton.disabled = true;
    setStatus('Converting images locally...', null);

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
        const result = await convertImageFile(file, settings);

        if (runId !== state.runId) {
          result.objectUrl && URL.revokeObjectURL(result.objectUrl);
          break;
        }

        converted += 1;
        warningCount += result.warnings.length;
        trackObjectUrl(result.objectUrl);
        renderSuccessCard(card, result);
      } catch (error) {
        failed += 1;
        firstErrorMessage ||= error.message || 'Unable to convert this image.';
        renderErrorCard(card, file, error);
      }

      convertedCount.textContent = converted.toLocaleString('en-GB');
      failedCount.textContent = failed.toLocaleString('en-GB');
      warningsDetail.textContent = warningCount === 0 ? 'None' : `${warningCount.toLocaleString('en-GB')} warning${warningCount === 1 ? '' : 's'}`;
    }

    convertButton.disabled = false;
    updateSettingSummary();

    if (failed > 0 && converted > 0) {
      setStatus(`${converted.toLocaleString('en-GB')} image${converted === 1 ? '' : 's'} converted. ${failed.toLocaleString('en-GB')} failed.`, 'error');
    } else if (failed > 0) {
      setStatus(firstErrorMessage || 'Image conversion failed. Review the file type and settings.', 'error');
    } else {
      setStatus('Image conversion completed successfully.', 'success');
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
          <span>Converting</span>
        </div>
        <p>${escapeHtml(formatBytes(file.size || 0))}</p>
      </div>
    `;

    return { element };
  }

  function renderSuccessCard(card, result) {
    card.element.className = `image-result-card success${result.warnings.length ? ' has-warning' : ''}`;
    card.element.innerHTML = `
      <div class="image-result-preview">
        <img src="${result.objectUrl}" alt="" />
      </div>
      <div class="image-result-body">
        <div class="image-result-header">
          <strong>${escapeHtml(result.outputName)}</strong>
          <span>Converted</span>
        </div>
        <p>${escapeHtml(result.sourceFormat.label)} to ${escapeHtml(result.targetFormat.label)} · ${escapeHtml(result.outputDimensionsLabel)} · ${escapeHtml(formatBytes(result.blob.size))}</p>
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
        <p>${escapeHtml(error.message || 'Unable to convert this image.')}</p>
      </div>
    `;
  }

  fileInput.addEventListener('change', event => {
    setSelectedFiles(event.target.files);
  });

  unbindDropZone = bindFileDropZone(dropZone, {
    accept: IMAGE_FILE_ACCEPT,
    multiple: true,
    onFiles: setSelectedFiles,
    onReject: (_file, rejectedFiles = []) => {
      const count = rejectedFiles.length || 1;
      setStatus(`${count.toLocaleString('en-GB')} unsupported file${count === 1 ? '' : 's'} skipped.`, 'error');
    }
  });

  targetFormat.addEventListener('change', updateSettingSummary);
  quality.addEventListener('input', updateSettingSummary);
  maxWidth.addEventListener('input', updateSettingSummary);
  maxHeight.addEventListener('input', updateSettingSummary);
  backgroundColour.addEventListener('input', updateSettingSummary);
  convertButton.addEventListener('click', handleConvert);
  clearButton.addEventListener('click', () => {
    state.files = [];
    state.runId += 1;
    fileInput.value = '';
    targetFormat.value = 'png';
    quality.value = '92';
    maxWidth.value = '';
    maxHeight.value = '';
    backgroundColour.value = '#ffffff';
    revokeObjectUrls();
    renderQueuedFiles();
    setStatus('Ready.', null);
  });

  updateSettingSummary();

  return () => {
    state.runId += 1;
    closeOpenPreviewDialog();
    unbindDropZone?.();
    revokeObjectUrls();
  };
}

async function convertImageFile(file, settings) {
  const sourceFormat = validateImageFile(file);
  const targetFormat = settings.targetFormat;
  const mode = determineConversionMode(sourceFormat, targetFormat);
  const outputName = buildImageOutputFileName(file.name, targetFormat);

  if (mode === 'svg-pass-through') {
    const svgText = assertSafeSvgText(await file.text());
    const blob = new Blob([svgText], { type: `${targetFormat.mimeType};charset=utf-8` });
    const objectUrl = URL.createObjectURL(blob);
    const dimensions = await readImageDimensions(objectUrl).catch(() => null);

    return {
      sourceFormat,
      targetFormat,
      outputName,
      blob,
      objectUrl,
      outputDimensionsLabel: dimensions ? formatDimensions(dimensions.width, dimensions.height) : 'SVG',
      warnings: buildImageConversionWarnings({ sourceFormat, targetFormat })
    };
  }

  if (mode === 'raster-to-svg') {
    const dataUrl = await readFileAsDataUrl(file);
    const dimensions = await readImageDimensions(dataUrl);
    const resizedDimensions = calculateContainDimensions(dimensions.width, dimensions.height, settings.resize);
    const svgText = buildEmbeddedRasterSvg({
      dataUrl,
      width: resizedDimensions.width,
      height: resizedDimensions.height,
      title: file.name || 'Embedded raster image'
    });
    const blob = new Blob([svgText], { type: `${targetFormat.mimeType};charset=utf-8` });
    const objectUrl = URL.createObjectURL(blob);

    return {
      sourceFormat,
      targetFormat,
      outputName,
      blob,
      objectUrl,
      outputDimensionsLabel: formatDimensions(resizedDimensions.width, resizedDimensions.height),
      warnings: buildImageConversionWarnings({
        sourceFormat,
        targetFormat,
        resized: resizedDimensions.scale < 1
      })
    };
  }

  if (mode === 'svg-to-raster') {
    const svgText = assertSafeSvgText(await file.text());
    const svgBlob = new Blob([svgText], { type: `${sourceFormat.mimeType};charset=utf-8` });
    const sourceUrl = URL.createObjectURL(svgBlob);

    try {
      return await convertDrawableToRaster({
        sourceUrl,
        sourceFormat,
        targetFormat,
        outputName,
        settings
      });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    return await convertDrawableToRaster({
      sourceUrl,
      sourceFormat,
      targetFormat,
      outputName,
      settings
    });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function convertDrawableToRaster(options) {
  const image = await loadImage(options.sourceUrl);
  const dimensions = calculateContainDimensions(image.naturalWidth, image.naturalHeight, options.settings.resize);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  if (options.targetFormat.value === 'jpeg') {
    context.fillStyle = options.settings.backgroundColour;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

  const blob = await canvasToBlob(canvas, options.targetFormat.mimeType, options.settings.quality);
  const objectUrl = URL.createObjectURL(blob);

  return {
    sourceFormat: options.sourceFormat,
    targetFormat: options.targetFormat,
    outputName: options.outputName,
    blob,
    objectUrl,
    outputDimensionsLabel: formatDimensions(dimensions.width, dimensions.height),
    warnings: buildImageConversionWarnings({
      sourceFormat: options.sourceFormat,
      targetFormat: options.targetFormat,
      resized: dimensions.scale < 1
    })
  };
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error(`This browser cannot create ${mimeType} image output.`));
        return;
      }

      resolve(blob);
    }, mimeType, quality ?? undefined);
  });
}

function readImageDimensions(sourceUrl) {
  return loadImage(sourceUrl).then(image => ({
    width: image.naturalWidth,
    height: image.naturalHeight
  }));
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected image file.'));
    reader.readAsDataURL(file);
  });
}

function formatDimensions(width, height) {
  return `${Math.round(width).toLocaleString('en-GB')} x ${Math.round(height).toLocaleString('en-GB')} px`;
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
