import { bindFileDropZone } from './file-drop-zone.js';
import { bindFileImportFeedback } from './file-import-feedback.js';
import {
  LEGACY_DOC_MESSAGE,
  WORD_IMAGE_FILE_ACCEPT
} from './word-image-extractor.js';
import {
  DEFAULT_WORD_OPTIMISATION_PRESET,
  WORD_OPTIMISATION_PRESETS,
  WORD_OPTIMISER_STATUS,
  analyseWordDocument,
  buildWordOptimisationPlan,
  buildWordOptimisationSummary,
  optimiseWordDocument
} from './word-document-optimiser.js';

export function renderWordDocumentOptimiser(container) {
  container.innerHTML = `
    <section class="tool-board word-document-optimiser-tool" data-tool-form>
      <div id="wordOptimiserDropZone" class="drop-zone">
        <label for="wordOptimiserFileInput" class="drop-zone-label">
          <span>Drop a Word document here or browse</span>
          <small>Processing happens locally in this browser. The original file is never modified. Only unencrypted .docx files are supported.</small>
        </label>
        <input id="wordOptimiserFileInput" type="file" accept="${WORD_IMAGE_FILE_ACCEPT}" />
      </div>

      <div id="wordOptimiserValidation" class="status-message error" role="alert" hidden></div>

      <section id="wordOptimiserAnalysisSection" class="word-image-section" hidden aria-labelledby="wordOptimiserAnalysisTitle">
        <div class="word-image-section-header">
          <div>
            <p class="eyebrow">Step 1 · Analyse</p>
            <h2 id="wordOptimiserAnalysisTitle">Document size analysis</h2>
            <p class="hint">Image recommendations use the largest reliable DrawingML display size for each embedded asset. Word page numbers and pagination are not inferred.</p>
          </div>
          <div id="wordOptimiserAnalysisStatus" class="word-optimiser-analysis-status" aria-live="polite">Ready</div>
        </div>

        <div id="wordOptimiserSummary" class="detail-grid" aria-live="polite">
          <div class="detail-card"><span>Original document</span><strong id="wordOptimiserOriginalSize">0 B</strong></div>
          <div class="detail-card"><span>Embedded image archive bytes</span><strong id="wordOptimiserImageBytes">0 B</strong><small>ZIP compressed media contribution</small></div>
          <div class="detail-card"><span>Image share</span><strong id="wordOptimiserImageShare">0%</strong></div>
          <div class="detail-card"><span>Embedded raster images</span><strong id="wordOptimiserRasterCount">0</strong></div>
          <div class="detail-card"><span>Oversized images</span><strong id="wordOptimiserOversizedCount">0</strong></div>
          <div class="detail-card"><span>Vector/unsupported preserved</span><strong id="wordOptimiserPreservedCount">0</strong></div>
          <div class="detail-card"><span>Display size unavailable</span><strong id="wordOptimiserUnknownDisplayCount">0</strong></div>
          <div class="detail-card"><span>Estimated optimised size</span><strong id="wordOptimiserEstimatedSize">0 B</strong><small>Estimate before encoding</small></div>
          <div class="detail-card"><span>Estimated saving</span><strong id="wordOptimiserEstimatedSaving">0 B / 0%</strong><small>Estimate before encoding</small></div>
        </div>

        <div class="word-optimiser-controls">
          <div class="field-stack">
            <label for="wordOptimiserPreset">Optimisation preset</label>
            <select id="wordOptimiserPreset">
              ${WORD_OPTIMISATION_PRESETS.map(preset => `<option value="${preset.id}"${preset.id === DEFAULT_WORD_OPTIMISATION_PRESET ? ' selected' : ''}>${preset.label}</option>`).join('')}
            </select>
            <small id="wordOptimiserPresetHint" class="hint"></small>
          </div>
          <div class="word-optimiser-control-note">
            <strong>Legibility-first default</strong>
            <span>Documentation targets approximately 180 PPI, preserves aspect ratio and never upscales.</span>
          </div>
        </div>

        <div class="word-image-section-header word-optimiser-review-header">
          <div>
            <p class="eyebrow">Review</p>
            <h2 id="wordOptimiserReviewTitle">Image-level recommendations</h2>
            <p class="hint">Keep original overrides remain selected while you filter or change presets. Vector and unsupported assets stay unchanged.</p>
          </div>
          <div class="word-image-filter-count" aria-live="polite"><strong id="wordOptimiserFilteredCount">0</strong> shown</div>
        </div>

        <div class="word-image-filter-panel word-optimiser-filter-panel">
          <div class="field-stack">
            <label for="wordOptimiserReviewFilter">Review filter</label>
            <select id="wordOptimiserReviewFilter">
              <option value="all">All embedded images</option>
              <option value="optimise">Optimise</option>
              <option value="already-efficient">Already efficient</option>
              <option value="preserve">Preserve/unsupported</option>
              <option value="unable-to-determine-display-size">Unable to determine display size</option>
            </select>
          </div>
        </div>

        <div id="wordOptimiserInventory" class="word-optimiser-inventory" aria-live="polite">
          <p class="empty-state">No document loaded.</p>
        </div>

        <div class="button-row word-optimiser-actions">
          <button id="wordOptimiserButton" class="primary" type="button" disabled>Optimise document</button>
          <span id="wordOptimiserActionHint" class="hint">Analyse a document to build a deterministic optimisation plan.</span>
        </div>
      </section>

      <section id="wordOptimiserResultSection" class="word-image-section word-optimiser-result" hidden aria-labelledby="wordOptimiserResultTitle">
        <div class="word-image-section-header">
          <div>
            <p class="eyebrow">Step 2 · Optimise</p>
            <h2 id="wordOptimiserResultTitle">Validated output</h2>
            <p class="hint">The rebuilt package was reopened locally and checked before download was enabled.</p>
          </div>
        </div>
        <div id="wordOptimiserResultSummary" class="detail-grid" aria-live="polite">
          <div class="detail-card"><span>Original</span><strong id="wordOptimiserResultOriginal">0 B</strong></div>
          <div class="detail-card"><span>Optimised</span><strong id="wordOptimiserResultOptimised">0 B</strong></div>
          <div class="detail-card"><span>Saved</span><strong id="wordOptimiserResultSaved">0 B</strong></div>
          <div class="detail-card"><span>Reduction</span><strong id="wordOptimiserResultReduction">0%</strong></div>
          <div class="detail-card"><span>Images changed</span><strong id="wordOptimiserResultChanged">0</strong></div>
          <div class="detail-card"><span>Original image archive bytes</span><strong id="wordOptimiserResultOriginalImageBytes">0 B</strong></div>
          <div class="detail-card"><span>Optimised image archive bytes</span><strong id="wordOptimiserResultImageBytes">0 B</strong></div>
          <div class="detail-card"><span>Original non-image archive bytes</span><strong id="wordOptimiserResultNonImageBytes">0 B</strong></div>
          <div class="detail-card"><span>Optimised non-image archive bytes</span><strong id="wordOptimiserResultOptimisedNonImageBytes">0 B</strong></div>
          <div class="detail-card"><span>Already efficient</span><strong id="wordOptimiserResultAlreadyEfficient">0</strong></div>
          <div class="detail-card"><span>Preserved unchanged</span><strong id="wordOptimiserResultPreserved">0</strong></div>
          <div class="detail-card"><span>Processing failures preserved</span><strong id="wordOptimiserResultProcessingFailures">0</strong></div>
        </div>
        <div class="button-row word-optimiser-output-actions">
          <a id="wordOptimiserDownload" class="button secondary" href="#" download="document-optimised.docx" hidden>Download optimised DOCX</a>
          <button id="wordOptimiserReopenButton" class="secondary" type="button" hidden>Re-analyse optimised document</button>
        </div>
        <div id="wordOptimiserResultStatus" class="status-message" role="status" aria-live="polite"></div>
      </section>

      <div id="wordOptimiserStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </section>
  `;

  const documentRef = container.ownerDocument || document;
  const dropZone = container.querySelector('#wordOptimiserDropZone');
  const fileInput = container.querySelector('#wordOptimiserFileInput');
  const validation = container.querySelector('#wordOptimiserValidation');
  const analysisSection = container.querySelector('#wordOptimiserAnalysisSection');
  const resultSection = container.querySelector('#wordOptimiserResultSection');
  const inventory = container.querySelector('#wordOptimiserInventory');
  const status = container.querySelector('#wordOptimiserStatus');
  const resultStatus = container.querySelector('#wordOptimiserResultStatus');
  const fileFeedback = bindFileImportFeedback(dropZone, { kind: 'Word document' });
  const state = {
    file: null,
    analysis: null,
    result: null,
    keepOriginalIds: new Set(),
    previewUrls: [],
    downloadUrl: '',
    runId: 0
  };
  let unbindDropZone = null;

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function setResultStatus(message, type) {
    resultStatus.textContent = message;
    resultStatus.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function revokePreviewUrls() {
    state.previewUrls.forEach(url => URL.revokeObjectURL(url));
    state.previewUrls = [];
  }

  function revokeDownloadUrl() {
    if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
    state.downloadUrl = '';
    const link = container.querySelector('#wordOptimiserDownload');
    link.hidden = true;
    link.removeAttribute('href');
  }

  function clearOutput() {
    state.result = null;
    revokeDownloadUrl();
    resultSection.hidden = true;
    setResultStatus('', null);
    container.querySelector('#wordOptimiserReopenButton').hidden = true;
  }

  function showValidation(message) {
    validation.textContent = message;
    validation.hidden = false;
  }

  function clearValidation() {
    validation.textContent = '';
    validation.hidden = true;
  }

  function getPlan() {
    return state.analysis?.plan || [];
  }

  function getDisplayedPlan() {
    const processedById = new Map((state.result?.processed || []).map(item => [item.id, item]));

    return getPlan().map(item => {
      const actual = processedById.get(item.id);
      if (!actual) return item;

      return {
        ...item,
        ...actual,
        status: actual.actualStatus || item.status,
        statusLabel: actual.statusLabel || item.statusLabel
      };
    });
  }

  function updatePlan() {
    if (!state.analysis?.document) return;

    const preset = container.querySelector('#wordOptimiserPreset').value;
    state.analysis.plan = buildWordOptimisationPlan(state.analysis.document, {
      preset,
      keepOriginalIds: [...state.keepOriginalIds]
    });
    state.analysis.summary = buildWordOptimisationSummary({
      document: state.analysis.document,
      plan: state.analysis.plan,
      preset
    });
    clearOutput();
    renderAnalysis();
  }

  function renderSummary() {
    const summary = state.analysis?.summary || {};
    container.querySelector('#wordOptimiserOriginalSize').textContent = formatBytes(summary.originalBytes);
    container.querySelector('#wordOptimiserImageBytes').textContent = formatBytes(summary.originalImageBytes);
    container.querySelector('#wordOptimiserImageShare').textContent = `${summary.imageSharePercent || 0}%`;
    container.querySelector('#wordOptimiserRasterCount').textContent = formatNumber(summary.embeddedRasterCount);
    container.querySelector('#wordOptimiserOversizedCount').textContent = formatNumber(summary.oversizedCount);
    container.querySelector('#wordOptimiserPreservedCount').textContent = formatNumber(summary.unsupportedCount);
    container.querySelector('#wordOptimiserUnknownDisplayCount').textContent = formatNumber(summary.unknownDisplayCount);
    container.querySelector('#wordOptimiserEstimatedSize').textContent = formatBytes(summary.estimatedOptimisedBytes);
    container.querySelector('#wordOptimiserEstimatedSaving').textContent = `${formatBytes(summary.estimatedSavingBytes)} / ${summary.estimatedSavingPercent || 0}%`;

    const preset = WORD_OPTIMISATION_PRESETS.find(candidate => candidate.id === summary.preset);
    container.querySelector('#wordOptimiserPresetHint').textContent = preset?.description || '';
    container.querySelector('#wordOptimiserAnalysisStatus').textContent = `${formatNumber(getPlan().length)} embedded image${getPlan().length === 1 ? '' : 's'} planned`;
  }

  function renderAnalysis() {
    revokePreviewUrls();
    renderSummary();
    renderInventory();
    updateActionState();
  }

  function visiblePlan() {
    const filter = container.querySelector('#wordOptimiserReviewFilter').value;
    return getDisplayedPlan().filter(item => filter === 'all' || item.status === filter || (filter === 'preserve' && [
      WORD_OPTIMISER_STATUS.PRESERVE,
      WORD_OPTIMISER_STATUS.UNSUPPORTED
    ].includes(item.status)));
  }

  function renderInventory() {
    revokePreviewUrls();
    inventory.innerHTML = '';
    const plan = visiblePlan();
    container.querySelector('#wordOptimiserFilteredCount').textContent = `${formatNumber(plan.length)} of ${formatNumber(getPlan().length)}`;

    if (!state.analysis) {
      inventory.innerHTML = '<p class="empty-state">No document loaded.</p>';
      return;
    }

    if (!plan.length) {
      inventory.innerHTML = '<p class="empty-state">No images match the current review filter.</p>';
      return;
    }

    const fragment = documentRef.createDocumentFragment();
    plan.forEach(item => fragment.append(createPlanCard(item)));
    inventory.append(fragment);
  }

  function createPlanCard(item) {
    const asset = state.analysis.document.assets.find(candidate => candidate.id === item.id);
    const card = documentRef.createElement('article');
    card.className = `word-optimiser-card status-${item.status}`;
    card.dataset.assetId = item.id;
    card.dataset.packagePath = item.packagePath;

    const header = documentRef.createElement('div');
    header.className = 'word-image-asset-header';
    const titleBlock = documentRef.createElement('div');
    titleBlock.className = 'word-image-asset-title';
    const name = documentRef.createElement('strong');
    name.textContent = item.originalName;
    name.title = item.packagePath;
    titleBlock.append(name);
    header.append(titleBlock, createStatusBadge(item));
    card.append(header);

    const body = documentRef.createElement('div');
    body.className = 'word-optimiser-card-body';
    body.append(createPreviewPanel(asset, item));

    const details = documentRef.createElement('dl');
    details.className = 'word-image-asset-details word-optimiser-details';
    addDetail(details, 'Original dimensions', formatDimensions(item.originalDimensions));
    addDetail(details, 'Displayed size', item.displayedDimensions ? `${formatInches(item.displayedDimensions.widthInches)} × ${formatInches(item.displayedDimensions.heightInches)} in` : 'Unable to determine safely');
    addDetail(details, 'Effective PPI', item.effectivePpi ? `${Math.round(item.effectivePpi).toLocaleString('en-GB')} PPI` : 'Not available');
    addDetail(details, 'Original image bytes (raw)', formatBytes(item.originalBytes));
    addDetail(details, 'Archive contribution (ZIP)', formatBytes(item.originalArchiveBytes));
    addDetail(details, 'Proposed dimensions', item.proposedDimensions ? formatDimensions(item.proposedDimensions) : 'Preserved unchanged');
    addDetail(details, 'Target PPI', item.targetPpi ? `Approximately ${item.targetPpi.toLocaleString('en-GB')} PPI` : 'Lossless clean-up');
    addDetail(details, 'References', `${formatNumber(item.referenceCount)} usage${item.referenceCount === 1 ? '' : 's'} · largest usage selected`);
    addDetail(details, 'Expected saving (raw estimate)', item.recommended ? `${formatBytes(item.estimatedSavingBytes)} (estimate)` : 'None before encoding');
    addDetail(details, 'Reason', item.reason);
    body.append(details);

    if (item.status !== WORD_OPTIMISER_STATUS.UNSUPPORTED && item.status !== WORD_OPTIMISER_STATUS.UNKNOWN_DISPLAY) {
      const override = documentRef.createElement('label');
      override.className = 'checkbox-line word-optimiser-override';
      const checkbox = documentRef.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = state.keepOriginalIds.has(item.id);
      checkbox.dataset.keepOriginal = item.id;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) state.keepOriginalIds.add(item.id);
        else state.keepOriginalIds.delete(item.id);
        updatePlan();
      });
      override.append(checkbox, documentRef.createTextNode('Keep original'));
      body.append(override);
    }

    card.append(body);
    return card;
  }

  function createStatusBadge(item) {
    const badge = documentRef.createElement('span');
    badge.className = 'word-image-asset-badge word-optimiser-status-badge';
    badge.textContent = item.statusLabel;
    return badge;
  }

  function createPreviewPanel(asset, item) {
    const panel = documentRef.createElement('div');
    panel.className = 'word-optimiser-preview-panel';

    if (!asset?.previewSupported || !(asset.bytes instanceof Uint8Array)) {
      panel.textContent = 'Preview unavailable for this preserved asset.';
      return panel;
    }

    const original = createPreviewFigure(asset.bytes, asset.mimeType, `Original · ${item.originalName}`, `Original preview of ${item.originalName}`);
    panel.append(original);
    const replacement = getReplacement(item);

    if (replacement) {
      panel.append(createPreviewFigure(replacement.bytes, replacement.mimeType || asset.mimeType, `Optimised · ${item.originalName}`, `Optimised preview of ${item.originalName}`));
    } else if (item.recommended && item.actualStatus !== WORD_OPTIMISER_STATUS.PRESERVE) {
      const waiting = documentRef.createElement('div');
      waiting.className = 'word-optimiser-preview-pending';
      waiting.textContent = 'Optimised preview appears after encoding.';
      panel.append(waiting);
    }

    return panel;
  }

  function createPreviewFigure(bytes, mimeType, label, alt) {
    const figure = documentRef.createElement('figure');
    figure.className = 'word-optimiser-preview-figure';
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'application/octet-stream' }));
    state.previewUrls.push(url);
    const image = documentRef.createElement('img');
    image.src = url;
    image.alt = alt;
    image.loading = 'lazy';
    const caption = documentRef.createElement('figcaption');
    caption.textContent = label;
    figure.append(image, caption);
    return figure;
  }

  function getReplacement(item) {
    const replacements = state.result?.replacements;
    if (!replacements) return null;
    const replacement = replacements.get(item.packagePath.toLocaleLowerCase('en-GB')) || replacements.get(item.packagePath);
    return replacement ? { ...replacement, mimeType: item.mimeType } : null;
  }

  function addDetail(list, label, value) {
    const term = documentRef.createElement('dt');
    const description = documentRef.createElement('dd');
    term.textContent = label;
    description.textContent = String(value ?? '');
    description.title = String(value ?? '');
    list.append(term, description);
  }

  function updateActionState() {
    const button = container.querySelector('#wordOptimiserButton');
    const recommended = getPlan().filter(item => item.status === WORD_OPTIMISER_STATUS.OPTIMISE).length;
    button.disabled = !state.analysis;
    container.querySelector('#wordOptimiserActionHint').textContent = recommended
      ? `${formatNumber(recommended)} image${recommended === 1 ? '' : 's'} are recommended for optimisation. The package will be validated before download.`
      : 'No image requires a resize for this preset; a validated unchanged copy can still be produced.';
  }

  async function inspectFile(file) {
    if (!file) return;
    const runId = state.runId + 1;
    state.runId = runId;
    state.file = file;
    state.analysis = null;
    state.keepOriginalIds.clear();
    revokePreviewUrls();
    clearOutput();
    clearValidation();
    analysisSection.hidden = true;
    fileFeedback.loading(file, 'Reading locally; no document data leaves this browser.');
    setStatus('Analysing the Word package locally...', null);

    try {
      const result = await analyseWordDocument(file, {
        fileName: file.name,
        preset: container.querySelector('#wordOptimiserPreset').value
      });

      if (runId !== state.runId) return;
      state.analysis = result;
      analysisSection.hidden = false;
      fileFeedback.loaded(file, `${formatNumber(result.document.embeddedAssets.length)} embedded image${result.document.embeddedAssets.length === 1 ? '' : 's'} analysed locally`);
      renderAnalysis();
      setStatus(`Analysis ready. ${formatNumber(result.summary.oversizedCount)} image${result.summary.oversizedCount === 1 ? '' : 's'} recommended for optimisation.`, 'success');
    } catch (error) {
      if (runId !== state.runId) return;
      const message = error.message || 'The Word document could not be analysed.';
      showValidation(message);
      fileFeedback.error(file, message);
      setStatus(message, 'error');
      updateActionState();
    }
  }

  async function optimiseDocument() {
    if (!state.analysis) return;
    const button = container.querySelector('#wordOptimiserButton');
    button.disabled = true;
    clearOutput();
    revokePreviewUrls();
    setStatus('Encoding selected raster images locally and rebuilding the DOCX...', null);

    try {
      state.result = await optimiseWordDocument(state.analysis, {
        preset: container.querySelector('#wordOptimiserPreset').value
      });
      const outputName = `${sanitiseDocumentName(state.analysis.document.documentName)}-optimised.docx`;
      state.downloadUrl = URL.createObjectURL(new Blob([state.result.bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }));
      const download = container.querySelector('#wordOptimiserDownload');
      download.href = state.downloadUrl;
      download.download = outputName;
      download.textContent = state.result.summary.noBeneficialOptimisation
        ? `Download unchanged validated copy ${outputName}`
        : `Download ${outputName}`;
      download.hidden = false;
      container.querySelector('#wordOptimiserReopenButton').hidden = false;
      renderResultSummary(state.result.summary);
      resultSection.hidden = false;
      renderInventory();
      const finalGuardTriggered = state.result.summary.noBeneficialOptimisation
        && state.result.summary.attemptedReplacementCount > 0;
      setResultStatus(finalGuardTriggered
        ? 'The validated rebuilt DOCX was not smaller than the original, so the original package was retained.'
        : state.result.summary.noBeneficialOptimisation
          ? 'No beneficial optimisation was produced. The validated original package was retained because the rebuilt DOCX was not smaller.'
        : 'The optimised DOCX was reopened and validated locally. Untouched package content and relationships were checked.', 'success');
      setStatus(state.result.summary.changedCount
        ? `Optimisation completed and validated. ${formatNumber(state.result.summary.changedCount)} image${state.result.summary.changedCount === 1 ? '' : 's'} changed.`
        : finalGuardTriggered
          ? 'The validated rebuilt DOCX was not smaller than the original; the validated original package was retained. Saving: 0 B / 0%.'
        : state.result.summary.noBeneficialOptimisation
          ? 'No replacement was smaller and no beneficial optimisation was produced; the validated original package was retained. Saving: 0 B / 0%.'
          : 'No replacement was smaller than its original; the validated document preserves the source image bytes.', 'success');
    } catch (error) {
      state.result = null;
      const message = error.message || 'The DOCX could not be optimised safely.';
      setStatus(message, 'error');
      setResultStatus('', null);
      resultSection.hidden = true;
      container.querySelector('#wordOptimiserReopenButton').hidden = true;
      container.querySelector('#wordOptimiserDownload').hidden = true;
    } finally {
      updateActionState();
    }
  }

  function renderResultSummary(summary) {
    container.querySelector('#wordOptimiserResultOriginal').textContent = formatBytes(summary.originalBytes);
    container.querySelector('#wordOptimiserResultOptimised').textContent = formatBytes(summary.optimisedBytes);
    container.querySelector('#wordOptimiserResultSaved').textContent = formatBytes(summary.savingBytes);
    container.querySelector('#wordOptimiserResultReduction').textContent = `${summary.savingPercent || 0}%`;
    container.querySelector('#wordOptimiserResultChanged').textContent = formatNumber(summary.changedCount);
    container.querySelector('#wordOptimiserResultOriginalImageBytes').textContent = formatBytes(summary.originalImageBytes);
    container.querySelector('#wordOptimiserResultImageBytes').textContent = formatBytes(summary.optimisedImageBytes);
    container.querySelector('#wordOptimiserResultNonImageBytes').textContent = formatBytes(summary.nonImagePackageBytes);
    container.querySelector('#wordOptimiserResultOptimisedNonImageBytes').textContent = formatBytes(summary.optimisedNonImagePackageBytes);
    container.querySelector('#wordOptimiserResultAlreadyEfficient').textContent = formatNumber(summary.alreadyEfficientCount);
    container.querySelector('#wordOptimiserResultPreserved').textContent = formatNumber(summary.preservedCount);
    container.querySelector('#wordOptimiserResultProcessingFailures').textContent = formatNumber(summary.processingFailureCount);
  }

  function reopenOutput() {
    if (!state.result?.bytes) return;
    inspectFile(new File([state.result.bytes], `${sanitiseDocumentName(state.analysis.document.documentName)}-optimised.docx`, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }));
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
  container.querySelector('#wordOptimiserPreset').addEventListener('change', updatePlan);
  container.querySelector('#wordOptimiserReviewFilter').addEventListener('change', renderInventory);
  container.querySelector('#wordOptimiserButton').addEventListener('click', optimiseDocument);
  container.querySelector('#wordOptimiserReopenButton').addEventListener('click', reopenOutput);

  return () => {
    state.runId += 1;
    unbindDropZone?.();
    revokePreviewUrls();
    revokeDownloadUrl();
  };
}

function formatDimensions(dimensions) {
  if (!dimensions?.width || !dimensions?.height) return 'Unknown';
  return `${Number(dimensions.width).toLocaleString('en-GB')} × ${Number(dimensions.height).toLocaleString('en-GB')} px`;
}

function formatInches(value) {
  return Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 });
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes.toLocaleString('en-GB')} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value) {
  return (Number(value) || 0).toLocaleString('en-GB');
}

function sanitiseDocumentName(value) {
  const name = String(value || 'document')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return name || 'document';
}
