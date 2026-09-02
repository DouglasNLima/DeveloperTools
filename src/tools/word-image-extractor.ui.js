import { formatBytes } from './base64.js';
import { bindFileDropZone } from './file-drop-zone.js';
import { bindFileImportFeedback } from './file-import-feedback.js';
import { storeImageHandover } from './image-handover.js';
import {
  LEGACY_DOC_MESSAGE,
  WORD_IMAGE_FILE_ACCEPT,
  buildWordImageFileNames,
  buildWordImageManifestCsv,
  buildWordImageManifestJson,
  buildWordImageZip,
  filterWordImageAssets,
  nameWordImageAssets,
  readWordImageDocument,
  selectWordImageAssets,
  sanitiseExtractionFileName
} from './word-image-extractor.js';

const FORMAT_OPTIONS = [
  ['all', 'All formats'],
  ['png', 'PNG'],
  ['jpeg', 'JPEG'],
  ['gif', 'GIF'],
  ['webp', 'WebP'],
  ['bmp', 'BMP'],
  ['svg', 'SVG'],
  ['tiff', 'TIFF'],
  ['emf', 'EMF'],
  ['wmf', 'WMF'],
  ['ico', 'ICO'],
  ['unknown', 'Unknown']
];

export function renderWordImageExtractor(container) {
  container.innerHTML = `
    <section class="tool-board word-image-extractor-tool" data-tool-form>
      <div id="wordImageDropZone" class="drop-zone">
        <label for="wordImageFileInput" class="drop-zone-label">
          <span>Drop a Word document here or browse</span>
          <small>Unencrypted .docx files are inspected entirely in this browser. Legacy .doc files are detected and rejected.</small>
        </label>
        <input id="wordImageFileInput" type="file" accept="${WORD_IMAGE_FILE_ACCEPT}" />
      </div>

      <div id="wordImageValidation" class="status-message error" role="alert" hidden></div>

      <div id="wordImageSummary" class="detail-grid" aria-live="polite">
        <div class="detail-card"><span>Assets</span><strong id="wordImageAssetCount">0</strong></div>
        <div class="detail-card"><span>Embedded</span><strong id="wordImageEmbeddedCount">0</strong></div>
        <div class="detail-card"><span>External links</span><strong id="wordImageExternalCount">0</strong></div>
        <div class="detail-card"><span>Duplicates</span><strong id="wordImageDuplicateCount">0</strong></div>
        <div class="detail-card"><span>Selected</span><strong id="wordImageSelectedCount">0</strong></div>
        <div class="detail-card"><span>Document</span><strong id="wordImageDocumentName">None</strong></div>
      </div>

      <section id="wordImageReviewSection" class="word-image-section" hidden aria-labelledby="wordImageReviewTitle">
        <div class="word-image-section-header">
          <div>
            <p class="eyebrow">Review</p>
            <h2 id="wordImageReviewTitle">Embedded image inventory</h2>
            <p class="hint">Review image bytes, metadata and source references before choosing what to extract. Page numbers are not inferred because Word pagination is not stable in a package.</p>
          </div>
          <div class="word-image-filter-count" aria-live="polite"><strong id="wordImageFilteredCount">0</strong> shown</div>
        </div>

        <div class="word-image-filter-panel">
          <div class="form-grid form-grid--triple word-image-filter-grid">
            <div class="field-stack"><label for="wordImageMinWidth">Minimum width (px)</label><input id="wordImageMinWidth" type="number" min="0" step="1" placeholder="Any" /></div>
            <div class="field-stack"><label for="wordImageMaxWidth">Maximum width (px)</label><input id="wordImageMaxWidth" type="number" min="0" step="1" placeholder="Any" /></div>
            <div class="field-stack"><label for="wordImageMinHeight">Minimum height (px)</label><input id="wordImageMinHeight" type="number" min="0" step="1" placeholder="Any" /></div>
            <div class="field-stack"><label for="wordImageMaxHeight">Maximum height (px)</label><input id="wordImageMaxHeight" type="number" min="0" step="1" placeholder="Any" /></div>
            <div class="field-stack"><label for="wordImageMinSize">Minimum file size (bytes)</label><input id="wordImageMinSize" type="number" min="0" step="1" placeholder="Any" /></div>
            <div class="field-stack"><label for="wordImageMaxSize">Maximum file size (bytes)</label><input id="wordImageMaxSize" type="number" min="0" step="1" placeholder="Any" /></div>
            <div class="field-stack"><label for="wordImageFormat">Format</label><select id="wordImageFormat">${FORMAT_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></div>
            <div class="field-stack"><label for="wordImageOrientation">Orientation</label><select id="wordImageOrientation"><option value="all">All orientations</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option><option value="square">Square</option><option value="unknown">Unknown</option></select></div>
            <div class="field-stack"><label for="wordImageSource">Source</label><select id="wordImageSource"><option value="all">All sources</option><option value="body">Document body</option><option value="header">Header</option><option value="footer">Footer</option><option value="other">Other document part</option><option value="unreferenced">Unreferenced media</option><option value="external">External links</option></select></div>
            <div class="field-stack"><label for="wordImageDuplicateStatus">Duplicate status</label><select id="wordImageDuplicateStatus"><option value="all">All assets</option><option value="unique">Unique embedded bytes</option><option value="duplicate">Duplicate embedded bytes</option><option value="external">External links</option></select></div>
          </div>
          <div class="button-row word-image-selection-actions">
            <button id="wordImageSelectAllButton" class="secondary" type="button">Select all</button>
            <button id="wordImageSelectFilteredButton" class="secondary" type="button">Select filtered</button>
            <button id="wordImageClearSelectionButton" class="secondary" type="button">Clear selection</button>
            <button id="wordImageResetFiltersButton" class="secondary" type="button">Reset filters</button>
          </div>
        </div>

        <div id="wordImageInventory" class="word-image-inventory" aria-live="polite">
          <p class="empty-state">No document loaded.</p>
        </div>
        <div id="wordImageWarnings" class="word-image-warnings" hidden>
          <h3>Review notes</h3>
          <ul></ul>
        </div>
      </section>

      <section id="wordImageExtractionSection" class="word-image-section" hidden aria-labelledby="wordImageExtractionTitle">
        <div class="word-image-section-header">
          <div>
            <p class="eyebrow">Extract</p>
            <h2 id="wordImageExtractionTitle">Save selected image bytes</h2>
            <p class="hint">Images are copied without recompression, resizing or conversion. External links and missing package targets cannot be extracted.</p>
          </div>
        </div>

        <div class="form-grid form-grid--triple word-image-output-grid">
          <div class="field-stack"><label for="wordImageDuplicateMode">Extraction selection</label><select id="wordImageDuplicateMode"><option value="all">All selected assets</option><option value="unique">Unique image bytes only</option></select><small class="hint">Choose whether exact duplicate assets are kept or reduced to one copy.</small></div>
          <div class="field-stack"><label for="wordImageNamingStrategy">File naming</label><select id="wordImageNamingStrategy"><option value="original">Original name</option><option value="sequential">Sequential names</option><option value="document-prefix">Document-name prefix</option></select></div>
          <div class="field-stack"><label for="wordImageOutputMode">Output mode</label><select id="wordImageOutputMode"><option value="zip">ZIP archive</option><option value="directory">Selected local folder</option></select><small id="wordImageDirectoryCapability" class="hint" data-supported="false"></small></div>
          <div class="field-stack"><label for="wordImageManifestFormat">Manifest export</label><select id="wordImageManifestFormat"><option value="json">JSON</option><option value="csv">CSV</option></select><label class="checkbox-line"><input id="wordImageIncludeManifest" type="checkbox" /> Include manifest in output</label></div>
        </div>

        <div class="button-row word-image-output-actions">
          <button id="wordImageExtractButton" class="primary" type="button" disabled>Extract selected images</button>
          <button id="wordImageExportManifestButton" class="secondary" type="button" disabled>Export manifest</button>
          <a id="wordImageZipDownload" class="button secondary" href="#" download="word-images.zip" hidden>Download ZIP</a>
          <a id="wordImageManifestDownload" class="button secondary" href="#" download="word-image-manifest.json" hidden>Download manifest</a>
        </div>
        <div id="wordImageExtractionStatus" class="status-message" role="status" aria-live="polite">Select a document to begin.</div>
      </section>

      <div id="wordImageStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </section>
  `;

  const documentRef = container.ownerDocument || document;
  const dropZone = container.querySelector('#wordImageDropZone');
  const fileInput = container.querySelector('#wordImageFileInput');
  const validation = container.querySelector('#wordImageValidation');
  const reviewSection = container.querySelector('#wordImageReviewSection');
  const extractionSection = container.querySelector('#wordImageExtractionSection');
  const inventory = container.querySelector('#wordImageInventory');
  const status = container.querySelector('#wordImageStatus');
  const extractionStatus = container.querySelector('#wordImageExtractionStatus');
  const fileFeedback = bindFileImportFeedback(dropZone, { kind: 'Word document' });
  const filterControls = [
    '#wordImageMinWidth',
    '#wordImageMaxWidth',
    '#wordImageMinHeight',
    '#wordImageMaxHeight',
    '#wordImageMinSize',
    '#wordImageMaxSize',
    '#wordImageFormat',
    '#wordImageOrientation',
    '#wordImageSource',
    '#wordImageDuplicateStatus'
  ].map(selector => container.querySelector(selector));
  const state = {
    file: null,
    document: null,
    selectedIds: new Set(),
    objectUrls: [],
    zipUrl: '',
    manifestUrl: '',
    runId: 0
  };
  let unbindDropZone = null;

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function setExtractionStatus(message, type) {
    extractionStatus.textContent = message;
    extractionStatus.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function revokeObjectUrls() {
    state.objectUrls.forEach(url => URL.revokeObjectURL(url));
    state.objectUrls = [];
  }

  function revokeDownloadUrls() {
    if (state.zipUrl) URL.revokeObjectURL(state.zipUrl);
    if (state.manifestUrl) URL.revokeObjectURL(state.manifestUrl);
    state.zipUrl = '';
    state.manifestUrl = '';
    container.querySelector('#wordImageZipDownload').hidden = true;
    container.querySelector('#wordImageZipDownload').removeAttribute('href');
    container.querySelector('#wordImageManifestDownload').hidden = true;
    container.querySelector('#wordImageManifestDownload').removeAttribute('href');
  }

  function clearRenderedMedia() {
    revokeObjectUrls();
    revokeDownloadUrls();
  }

  function clearValidation() {
    validation.hidden = true;
    validation.textContent = '';
  }

  function renderWarnings() {
    const warningsPanel = container.querySelector('#wordImageWarnings');
    const list = warningsPanel.querySelector('ul');
    list.innerHTML = '';
    const warnings = state.document?.warnings || [];

    if (warnings.length === 0) {
      warningsPanel.hidden = true;
      return;
    }

    warnings.forEach(warning => {
      const item = documentRef.createElement('li');
      item.textContent = warning;
      list.append(item);
    });
    warningsPanel.hidden = false;
  }

  function showValidation(message) {
    validation.textContent = message;
    validation.hidden = false;
  }

  function updateSummary() {
    const summary = state.document?.summary || {};
    container.querySelector('#wordImageAssetCount').textContent = (summary.assetCount || 0).toLocaleString('en-GB');
    container.querySelector('#wordImageEmbeddedCount').textContent = (summary.embeddedCount || 0).toLocaleString('en-GB');
    container.querySelector('#wordImageExternalCount').textContent = (summary.externalCount || 0).toLocaleString('en-GB');
    container.querySelector('#wordImageDuplicateCount').textContent = (summary.duplicateAssetCount || 0).toLocaleString('en-GB');
    container.querySelector('#wordImageSelectedCount').textContent = getSelectedEmbeddedAssets().length.toLocaleString('en-GB');
    container.querySelector('#wordImageDocumentName').textContent = state.document?.documentName || 'None';
  }

  function readFilters() {
    return {
      minWidth: container.querySelector('#wordImageMinWidth').value,
      maxWidth: container.querySelector('#wordImageMaxWidth').value,
      minHeight: container.querySelector('#wordImageMinHeight').value,
      maxHeight: container.querySelector('#wordImageMaxHeight').value,
      minFileSize: container.querySelector('#wordImageMinSize').value,
      maxFileSize: container.querySelector('#wordImageMaxSize').value,
      format: container.querySelector('#wordImageFormat').value,
      orientation: container.querySelector('#wordImageOrientation').value,
      source: container.querySelector('#wordImageSource').value,
      duplicateStatus: container.querySelector('#wordImageDuplicateStatus').value
    };
  }

  function getVisibleAssets() {
    return state.document ? filterWordImageAssets(state.document.assets, readFilters()) : [];
  }

  function getSelectedEmbeddedAssets() {
    return state.document
      ? state.document.assets.filter(asset => state.selectedIds.has(asset.id) && asset.isEmbedded)
      : [];
  }

  function updateActionState() {
    const hasDocument = Boolean(state.document);
    const visibleAssets = getVisibleAssets();
    const selectedAssets = getSelectedEmbeddedAssets();
    const hasSelected = selectedAssets.length > 0;
    container.querySelector('#wordImageSelectAllButton').disabled = !hasDocument || !(state.document?.embeddedAssets?.length);
    container.querySelector('#wordImageSelectFilteredButton').disabled = !hasDocument || !visibleAssets.some(asset => asset.isEmbedded);
    container.querySelector('#wordImageClearSelectionButton').disabled = !hasSelected;
    container.querySelector('#wordImageExtractButton').disabled = !hasSelected;
    container.querySelector('#wordImageExportManifestButton').disabled = !hasSelected;
    updateSummary();
  }

  function renderInventory() {
    revokeObjectUrls();
    inventory.innerHTML = '';

    if (!state.document) {
      inventory.innerHTML = '<p class="empty-state">No document loaded.</p>';
      container.querySelector('#wordImageFilteredCount').textContent = '0';
      updateActionState();
      return;
    }

    const visibleAssets = getVisibleAssets();
    container.querySelector('#wordImageFilteredCount').textContent = `${visibleAssets.length.toLocaleString('en-GB')} of ${state.document.assets.length.toLocaleString('en-GB')}`;

    if (visibleAssets.length === 0) {
      inventory.innerHTML = '<p class="empty-state">No assets match the current filters.</p>';
      updateActionState();
      return;
    }

    const fragment = documentRef.createDocumentFragment();
    visibleAssets.forEach(asset => fragment.append(createAssetCard(asset)));
    inventory.append(fragment);
    updateActionState();
  }

  function createAssetCard(asset) {
    const card = documentRef.createElement('article');
    card.className = `word-image-asset-card${asset.isExternal ? ' external' : ''}${asset.missing ? ' missing' : ''}`;
    card.dataset.assetId = asset.id;

    const header = documentRef.createElement('div');
    header.className = 'word-image-asset-header';
    const titleBlock = documentRef.createElement('div');
    titleBlock.className = 'word-image-asset-title';

    if (asset.isEmbedded) {
      const checkbox = documentRef.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `wordImageSelect-${asset.id}`;
      checkbox.dataset.wordImageSelect = asset.id;
      checkbox.checked = state.selectedIds.has(asset.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) state.selectedIds.add(asset.id);
        else state.selectedIds.delete(asset.id);
        updateActionState();
      });
      const checkboxLabel = documentRef.createElement('label');
      checkboxLabel.className = 'word-image-checkbox-label';
      checkboxLabel.htmlFor = checkbox.id;
      checkboxLabel.textContent = 'Select';
      titleBlock.append(checkbox, checkboxLabel);
    }

    const name = documentRef.createElement('strong');
    name.textContent = asset.originalName || 'Unnamed image';
    name.title = asset.packagePath || asset.externalTarget || name.textContent;
    titleBlock.append(name);
    header.append(titleBlock, createAssetBadge(asset));
    card.append(header);

    const body = documentRef.createElement('div');
    body.className = 'word-image-asset-body';
    const preview = documentRef.createElement('div');
    preview.className = 'word-image-asset-preview';

    if (asset.isEmbedded && asset.previewSupported && asset.bytes instanceof Uint8Array) {
      const url = URL.createObjectURL(new Blob([asset.bytes], { type: asset.mimeType }));
      state.objectUrls.push(url);
      const image = documentRef.createElement('img');
      image.src = url;
      image.alt = asset.altText ? `Preview of ${asset.originalName}: ${asset.altText}` : `Preview of ${asset.originalName}`;
      image.loading = 'lazy';
      preview.append(image);
    } else {
      const message = documentRef.createElement('span');
      message.textContent = asset.isExternal ? 'Not retrieved' : asset.missing ? 'Package target missing' : 'Preview unavailable';
      preview.append(message);
    }

    const details = documentRef.createElement('dl');
    details.className = 'word-image-asset-details';
    addDetail(details, 'Format', asset.formatLabel || 'Unknown');
    addDetail(details, 'Dimensions', formatDimensions(asset));
    addDetail(details, 'File size', asset.isEmbedded ? formatBytes(asset.fileSize) : 'Not embedded');
    addDetail(details, 'Source', asset.sourceLabel || asset.source || 'Other');
    addDetail(details, 'Alt text', asset.altText || 'Not provided');
    addDetail(details, 'Title', asset.title || 'Not provided');
    addDetail(details, 'Hash', asset.hash || 'Not available');
    if (asset.externalTarget) addDetail(details, 'External target', asset.externalTarget);
    body.append(preview, details);

    if (asset.isEmbedded) {
      const actions = documentRef.createElement('div');
      actions.className = 'button-row word-image-asset-actions';
      const converterButton = documentRef.createElement('button');
      converterButton.className = 'secondary';
      converterButton.type = 'button';
      converterButton.textContent = 'Open in Image Converter & Optimiser';
      converterButton.addEventListener('click', () => openImageHandover(asset, 'image-converter-optimiser'));
      actions.append(converterButton);

      if (['png', 'jpeg', 'jpg', 'webp', 'bmp', 'gif'].includes(asset.format)) {
        const ocrButton = documentRef.createElement('button');
        ocrButton.className = 'secondary';
        ocrButton.type = 'button';
        ocrButton.textContent = 'Open in Image OCR';
        ocrButton.addEventListener('click', () => openImageHandover(asset, 'image-ocr'));
        actions.append(ocrButton);
      }

      body.append(actions);
    }

    card.append(body);
    return card;
  }

  function createAssetBadge(asset) {
    const badge = documentRef.createElement('span');
    badge.className = `word-image-asset-badge${asset.isDuplicate ? ' duplicate' : ''}${asset.isExternal ? ' external' : ''}`;
    if (asset.isExternal) badge.textContent = 'External / not embedded';
    else if (asset.missing) badge.textContent = 'Missing target';
    else if (asset.isDuplicate) badge.textContent = 'Exact duplicate';
    else if (!asset.previewSupported) badge.textContent = 'Extractable · preview unavailable';
    else badge.textContent = 'Embedded';
    return badge;
  }

  function addDetail(list, label, value) {
    const term = documentRef.createElement('dt');
    const description = documentRef.createElement('dd');
    term.textContent = label;
    description.textContent = String(value ?? '');
    description.title = String(value ?? '');
    list.append(term, description);
  }

  async function inspectFile(file) {
    if (!file) return;
    const runId = state.runId + 1;
    state.runId = runId;
    state.file = file;
    state.document = null;
    state.selectedIds.clear();
    clearRenderedMedia();
    clearValidation();
    reviewSection.hidden = true;
    extractionSection.hidden = true;
    renderWarnings();
    renderInventory();
    fileFeedback.loading(file, 'Reading locally; no document data leaves this browser.');
    setStatus('Inspecting the Word package locally...', null);
    setExtractionStatus('Select a document to begin.', null);

    try {
      const result = await readWordImageDocument(file, { fileName: file.name });

      if (runId !== state.runId) return;
      state.document = result;
      reviewSection.hidden = false;
      extractionSection.hidden = false;
      renderWarnings();
      renderInventory();
      fileFeedback.loaded(file, `${result.embeddedAssets.length.toLocaleString('en-GB')} embedded image${result.embeddedAssets.length === 1 ? '' : 's'} inventoried locally`);
      const warningText = result.warnings.length ? ` ${result.warnings.length.toLocaleString('en-GB')} warning${result.warnings.length === 1 ? '' : 's'} shown in the inventory.` : '';
      setStatus(result.assets.length ? `Word image inventory ready.${warningText}` : 'Word document loaded. No image assets were found.', result.assets.length ? 'success' : null);
      setExtractionStatus(result.embeddedAssets.length ? 'Choose an extraction mode and output.' : 'There are no embedded image bytes to extract.', result.embeddedAssets.length ? null : 'error');
    } catch (error) {
      if (runId !== state.runId) return;
      const message = error.message || 'The Word document could not be inspected.';
      fileFeedback.error(file, message);
      showValidation(message);
      setStatus(message, 'error');
      setExtractionStatus('Resolve the document validation message before extracting.', 'error');
      updateActionState();
    }
  }

  async function extractSelected() {
    const selectedAssets = selectWordImageAssets(state.document?.assets || [], {
      selectedIds: [...state.selectedIds],
      mode: container.querySelector('#wordImageDuplicateMode').value
    });

    if (selectedAssets.length === 0) {
      setExtractionStatus('Select at least one embedded image before extracting.', 'error');
      return;
    }

    const namingStrategy = container.querySelector('#wordImageNamingStrategy').value;
    const namedAssets = nameWordImageAssets(selectedAssets, {
      strategy: namingStrategy,
      documentName: state.document.documentName
    });
    const outputMode = container.querySelector('#wordImageOutputMode').value;
    const includeManifest = container.querySelector('#wordImageIncludeManifest').checked;
    const manifestFormat = container.querySelector('#wordImageManifestFormat').value;
    const extractButton = container.querySelector('#wordImageExtractButton');
    extractButton.disabled = true;
    revokeDownloadUrls();
    setExtractionStatus('Preparing original image bytes locally...', null);

    try {
      if (outputMode === 'directory' && isDirectoryPickerSupported()) {
        await writeToSelectedDirectory(namedAssets, { includeManifest, manifestFormat });
        setExtractionStatus(`${namedAssets.length.toLocaleString('en-GB')} image${namedAssets.length === 1 ? '' : 's'} written to the selected folder.`, 'success');
        setStatus('Folder extraction completed successfully.', 'success');
      } else {
        const zipBytes = buildWordImageZip(selectedAssets, {
          namedAssets,
          includeManifest,
          manifestFormat
        });
        const zipName = `${sanitiseExtractionFileName(state.document.documentName, 'document')}-images.zip`;
        const zipLink = container.querySelector('#wordImageZipDownload');
        state.zipUrl = URL.createObjectURL(new Blob([zipBytes], { type: 'application/zip' }));
        zipLink.href = state.zipUrl;
        zipLink.download = zipName;
        zipLink.textContent = `Download ${zipName}`;
        zipLink.hidden = false;

        if (includeManifest) {
          setManifestDownload(namedAssets, manifestFormat);
        }

        const fallback = outputMode === 'directory' ? ' Folder access is unavailable, so a ZIP download is ready instead.' : '';
        setExtractionStatus(`${namedAssets.length.toLocaleString('en-GB')} image${namedAssets.length === 1 ? '' : 's'} prepared with original bytes.${fallback}`, 'success');
        setStatus('ZIP extraction completed successfully.', 'success');
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        setExtractionStatus('Folder selection was cancelled. No files were written.', null);
        setStatus('Folder extraction cancelled.', null);
      } else {
        setExtractionStatus(error.message || 'Image extraction failed.', 'error');
        setStatus(error.message || 'Image extraction failed.', 'error');
      }
    } finally {
      extractButton.disabled = getSelectedEmbeddedAssets().length === 0;
    }
  }

  async function writeToSelectedDirectory(namedAssets, options) {
    const directory = await documentRef.defaultView.showDirectoryPicker({ mode: 'readwrite' });
    const files = namedAssets.map(asset => ({ name: asset.outputName, bytes: asset.bytes }));

    if (options.includeManifest) {
      files.push({
        name: `manifest.${options.manifestFormat}`,
        bytes: new TextEncoder().encode(options.manifestFormat === 'csv'
          ? buildWordImageManifestCsv(namedAssets, { namedAssets })
          : buildWordImageManifestJson(namedAssets, { namedAssets }))
      });
    }

    for (const file of files) {
      const handle = await directory.getFileHandle(file.name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file.bytes);
      await writable.close();
    }
  }

  function setManifestDownload(namedAssets, format) {
    const content = format === 'csv'
      ? buildWordImageManifestCsv(namedAssets, { namedAssets })
      : buildWordImageManifestJson(namedAssets, { namedAssets });
    const extension = format === 'csv' ? 'csv' : 'json';
    const link = container.querySelector('#wordImageManifestDownload');
    state.manifestUrl = URL.createObjectURL(new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' }));
    link.href = state.manifestUrl;
    link.download = `${sanitiseExtractionFileName(state.document.documentName, 'document')}-image-manifest.${extension}`;
    link.textContent = `Download manifest (${format.toUpperCase()})`;
    link.hidden = false;
  }

  function exportManifest() {
    const selectedAssets = selectWordImageAssets(state.document?.assets || [], {
      selectedIds: [...state.selectedIds],
      mode: container.querySelector('#wordImageDuplicateMode').value
    });

    if (selectedAssets.length === 0) {
      setExtractionStatus('Select at least one embedded image before exporting a manifest.', 'error');
      return;
    }

    const manifestFormat = container.querySelector('#wordImageManifestFormat').value;
    const namedAssets = nameWordImageAssets(selectedAssets, {
      strategy: container.querySelector('#wordImageNamingStrategy').value,
      documentName: state.document.documentName
    });
    setManifestDownload(namedAssets, manifestFormat);
    setExtractionStatus(`Manifest ready as ${manifestFormat.toUpperCase()}.`, 'success');
  }

  function openImageHandover(asset, targetToolId) {
    if (!(asset.bytes instanceof Uint8Array)) return;

    try {
      storeImageHandover({
        targetToolId,
        fileName: asset.originalName,
        mimeType: asset.mimeType,
        bytes: asset.bytes
      });
      documentRef.defaultView.location.hash = `#${targetToolId}`;
    } catch {
      setStatus('This image is too large for a session handover. Extract it first, then open it in the target tool.', 'error');
    }
  }

  function isDirectoryPickerSupported() {
    return typeof documentRef.defaultView?.showDirectoryPicker === 'function';
  }

  function updateDirectoryCapability() {
    const supported = isDirectoryPickerSupported();
    const capability = container.querySelector('#wordImageDirectoryCapability');
    capability.dataset.supported = String(supported);
    capability.textContent = supported
      ? 'This browser can write files to a folder you choose.'
      : 'Folder access is unavailable here; this mode will fall back to a ZIP download.';
    const outputMode = container.querySelector('#wordImageOutputMode').value;
    const extractButton = container.querySelector('#wordImageExtractButton');
    extractButton.textContent = outputMode === 'directory' && supported
      ? 'Choose folder & extract images'
      : outputMode === 'directory'
        ? 'Extract images as ZIP'
        : 'Extract selected images';
  }

  function resetFilters() {
    filterControls.forEach(control => {
      control.value = control.tagName === 'SELECT' ? control.options[0].value : '';
    });
    renderInventory();
  }

  fileInput.addEventListener('change', event => inspectFile(event.target.files?.[0] || null));
  unbindDropZone = bindFileDropZone(dropZone, {
    accept: WORD_IMAGE_FILE_ACCEPT,
    onFile: inspectFile,
    onReject: file => {
      const message = file?.name?.toLocaleLowerCase('en-GB').endsWith('.doc')
        ? LEGACY_DOC_MESSAGE
        : 'Choose a Word .docx file. Legacy .doc files are not supported.';
      showValidation(message);
      setStatus(message, 'error');
      fileFeedback.error([], message);
    }
  });

  filterControls.forEach(control => control.addEventListener('input', renderInventory));
  filterControls.forEach(control => control.addEventListener('change', renderInventory));
  container.querySelector('#wordImageSelectAllButton').addEventListener('click', () => {
    state.document?.embeddedAssets.forEach(asset => state.selectedIds.add(asset.id));
    renderInventory();
  });
  container.querySelector('#wordImageSelectFilteredButton').addEventListener('click', () => {
    getVisibleAssets().filter(asset => asset.isEmbedded).forEach(asset => state.selectedIds.add(asset.id));
    renderInventory();
  });
  container.querySelector('#wordImageClearSelectionButton').addEventListener('click', () => {
    state.selectedIds.clear();
    renderInventory();
  });
  container.querySelector('#wordImageResetFiltersButton').addEventListener('click', resetFilters);
  container.querySelector('#wordImageOutputMode').addEventListener('change', updateDirectoryCapability);
  container.querySelector('#wordImageIncludeManifest').addEventListener('change', event => {
    container.querySelector('#wordImageManifestFormat').disabled = !event.target.checked;
  });
  container.querySelector('#wordImageExtractButton').addEventListener('click', extractSelected);
  container.querySelector('#wordImageExportManifestButton').addEventListener('click', exportManifest);

  updateDirectoryCapability();
  container.querySelector('#wordImageManifestFormat').disabled = true;
  renderInventory();

  return () => {
    state.runId += 1;
    unbindDropZone?.();
    clearRenderedMedia();
  };
}

function formatDimensions(asset) {
  if (!asset.width || !asset.height) return 'Unknown';
  return `${asset.width.toLocaleString('en-GB')} × ${asset.height.toLocaleString('en-GB')} px (${asset.orientation})`;
}
