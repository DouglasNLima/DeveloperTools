import {
  buildFieldNamesText,
  buildFieldsCsvExport,
  buildFieldsJsonExport,
  buildPdfFieldOutputFileName,
  buildPdfFieldHandoverMarkdown,
  createPdfFieldModel,
  filterPdfFields,
  analysePdfFields,
  isPdfFieldAnnotation
} from './pdf-template-fields.js';
import { bindFileDropZone } from './file-drop-zone.js';

const PDFJS_MODULE_URL = new URL('../vendor/pdfjs/pdf.min.mjs', import.meta.url).href;
const PDFJS_WORKER_URL = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2, 2.5];
const PDF_FILE_ACCEPT = '.pdf,application/pdf';

let pdfJsPromise = null;

export function renderPdfTemplateFieldExplorer(container) {
  container.innerHTML = `
    <form class="tool-board pdf-template-tool" data-tool-form>
      <div id="pdfTemplateDropZone" class="drop-zone pdf-template-drop-zone">
        <label for="pdfTemplateFileInput" class="drop-zone-label">
          <span>Drop a PDF here or browse</span>
          <small>Only local PDF files are read. Fillable fields are detected in this browser.</small>
        </label>
        <input id="pdfTemplateFileInput" type="file" accept="${PDF_FILE_ACCEPT}" />
      </div>

      <div class="pdf-template-toolbar">
        <div class="field-stack pdf-template-zoom">
          <label for="pdfTemplateZoom">Zoom</label>
          <select id="pdfTemplateZoom" disabled>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5" selected>150%</option>
            <option value="2">200%</option>
            <option value="2.5">250%</option>
          </select>
        </div>

        <button id="copyPdfFieldNamesButton" class="secondary" type="button" disabled>Copy names</button>
        <button id="exportPdfFieldsJsonButton" class="secondary" type="button" disabled>Export JSON</button>
        <button id="exportPdfFieldsCsvButton" class="secondary" type="button" disabled>Export CSV</button>
        <button id="exportPdfFieldsReportButton" class="secondary" type="button" disabled>Export report</button>
      </div>

      <div class="pdf-template-layout">
        <section class="pdf-template-panel" aria-label="PDF fields">
          <div class="field-stack">
            <label for="pdfFieldSearch">Search fields</label>
            <input id="pdfFieldSearch" type="search" placeholder="Search name, type, value or page" disabled />
          </div>

          <div class="option-grid pdf-template-options">
            <label class="checkbox-row" for="pdfShowOverlays">
              <input id="pdfShowOverlays" type="checkbox" checked disabled />
              <span>Show overlays</span>
            </label>
            <label class="checkbox-row" for="pdfShowLabels">
              <input id="pdfShowLabels" type="checkbox" checked disabled />
              <span>Show labels</span>
            </label>
            <label class="checkbox-row" for="pdfHideEmptyFields">
              <input id="pdfHideEmptyFields" type="checkbox" disabled />
              <span>Hide empty fields</span>
            </label>
          </div>

          <div class="pdf-field-list" id="pdfFieldList">
            <p class="empty-state">No PDF loaded.</p>
          </div>
        </section>

        <section class="pdf-viewer-area" aria-label="PDF preview">
          <div id="pdfViewer" class="pdf-viewer">
            <div class="pdf-template-empty">
              <strong>Open a fillable PDF template</strong>
              <span>Fields are detected locally in your browser. Nothing is uploaded.</span>
            </div>
          </div>
        </section>

        <section class="pdf-template-panel" aria-label="Selected field">
          <div>
            <span class="eyebrow">Selected field</span>
            <h3 id="pdfSelectedFieldTitle">No field selected</h3>
            <p id="pdfSelectedFieldSummary" class="hint">Click a field overlay or select a field from the list.</p>
          </div>

          <div id="pdfFieldDetails" class="pdf-field-details">
            <div class="detail-card">
              <span>Status</span>
              <strong>Waiting for PDF.</strong>
            </div>
          </div>

          <div class="field-stack">
            <label for="pdfFieldRequirement">Review tag</label>
            <select id="pdfFieldRequirement" disabled>
              <option value="unreviewed">Unreviewed</option>
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </select>
          </div>

          <div class="field-stack">
            <label for="pdfFieldNotes">Review notes</label>
            <textarea id="pdfFieldNotes" spellcheck="false" placeholder="Add mapping notes for this field." disabled></textarea>
          </div>

          <div class="button-row">
            <button id="copyPdfSelectedNameButton" class="primary" type="button" disabled>Copy name</button>
            <button id="copyPdfSelectedJsonButton" class="secondary" type="button" disabled>Copy JSON</button>
            <button id="goToPdfSelectedFieldButton" class="secondary" type="button" disabled>Go to field</button>
          </div>
        </section>
      </div>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Document</span>
          <strong id="pdfDocumentDetail">No PDF</strong>
        </div>
        <div class="detail-card">
          <span>Pages</span>
          <strong id="pdfPageCount">-</strong>
        </div>
        <div class="detail-card">
          <span>Fields</span>
          <strong id="pdfFieldCount">-</strong>
        </div>
        <div class="detail-card">
          <span>Selected</span>
          <strong id="pdfSelectedFieldDetail">None</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="pdfWarningsDetail">-</strong>
        </div>
      </div>

      <div id="pdfTemplateStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
      <textarea id="pdfFieldsJsonOutput" hidden readonly aria-hidden="true"></textarea>
    </form>
  `;

  const fileInput = container.querySelector('#pdfTemplateFileInput');
  const dropZone = container.querySelector('#pdfTemplateDropZone');
  const zoom = container.querySelector('#pdfTemplateZoom');
  const copyNamesButton = container.querySelector('#copyPdfFieldNamesButton');
  const exportJsonButton = container.querySelector('#exportPdfFieldsJsonButton');
  const exportCsvButton = container.querySelector('#exportPdfFieldsCsvButton');
  const exportReportButton = container.querySelector('#exportPdfFieldsReportButton');
  const search = container.querySelector('#pdfFieldSearch');
  const showOverlays = container.querySelector('#pdfShowOverlays');
  const showLabels = container.querySelector('#pdfShowLabels');
  const hideEmpty = container.querySelector('#pdfHideEmptyFields');
  const fieldList = container.querySelector('#pdfFieldList');
  const viewer = container.querySelector('#pdfViewer');
  const selectedFieldTitle = container.querySelector('#pdfSelectedFieldTitle');
  const selectedFieldSummary = container.querySelector('#pdfSelectedFieldSummary');
  const fieldDetails = container.querySelector('#pdfFieldDetails');
  const fieldRequirement = container.querySelector('#pdfFieldRequirement');
  const fieldNotes = container.querySelector('#pdfFieldNotes');
  const copySelectedNameButton = container.querySelector('#copyPdfSelectedNameButton');
  const copySelectedJsonButton = container.querySelector('#copyPdfSelectedJsonButton');
  const goToSelectedButton = container.querySelector('#goToPdfSelectedFieldButton');
  const documentDetail = container.querySelector('#pdfDocumentDetail');
  const pageCount = container.querySelector('#pdfPageCount');
  const fieldCount = container.querySelector('#pdfFieldCount');
  const selectedFieldDetail = container.querySelector('#pdfSelectedFieldDetail');
  const warningsDetail = container.querySelector('#pdfWarningsDetail');
  const status = container.querySelector('#pdfTemplateStatus');
  const handoverOutput = container.querySelector('#pdfFieldsJsonOutput');

  const state = {
    pdf: null,
    fileName: '',
    fields: [],
    reviews: {},
    selectedFieldId: null,
    renderVersion: 0,
    objectUrls: []
  };
  let unbindDropZone = null;

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function syncHandoverOutput() {
    handoverOutput.value = state.pdf && state.fields.length > 0
      ? buildFieldsJsonExport({
          fields: state.fields,
          fileName: state.fileName,
          pageCount: state.pdf?.numPages || 0
        })
      : '';

    handoverOutput.dispatchEvent(new Event('input', { bubbles: true }));
    handoverOutput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setControlsEnabled(enabled) {
    const hasPdf = enabled && Boolean(state.pdf);
    const hasFields = hasPdf && state.fields.length > 0;

    zoom.disabled = !hasPdf;
    search.disabled = !hasPdf;
    showOverlays.disabled = !hasPdf;
    showLabels.disabled = !hasPdf;
    hideEmpty.disabled = !hasPdf;
    copyNamesButton.disabled = !hasFields;
    exportJsonButton.disabled = !hasFields;
    exportCsvButton.disabled = !hasFields;
    exportReportButton.disabled = !hasFields;
  }

  function updateSummary() {
    documentDetail.textContent = state.fileName || 'No PDF';
    pageCount.textContent = state.pdf ? state.pdf.numPages.toLocaleString('en-GB') : '-';
    fieldCount.textContent = state.pdf ? state.fields.length.toLocaleString('en-GB') : '-';
    selectedFieldDetail.textContent = getSelectedField()?.name || 'None';
    const warningCount = analysePdfFields(state.fields).warnings.length;
    warningsDetail.textContent = state.pdf ? (warningCount === 0 ? 'None' : `${warningCount} warning${warningCount === 1 ? '' : 's'}`) : '-';
  }

  function renderFieldList() {
    const filteredFields = filterPdfFields(state.fields, {
      search: search.value,
      hideEmpty: hideEmpty.checked
    });

    fieldList.innerHTML = '';

    if (!state.pdf) {
      fieldList.innerHTML = '<p class="empty-state">No PDF loaded.</p>';
      return;
    }

    if (state.fields.length === 0) {
      fieldList.innerHTML = '<p class="empty-state">No fields available in this PDF.</p>';
      return;
    }

    if (filteredFields.length === 0) {
      fieldList.innerHTML = '<p class="empty-state">No fields match the current filter.</p>';
      return;
    }

    const fragment = document.createDocumentFragment();

    filteredFields.forEach(field => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pdf-field-item${field.id === state.selectedFieldId ? ' selected' : ''}`;
      button.dataset.fieldId = field.id;
      button.innerHTML = `
        <span class="pdf-field-name">${escapeHtml(field.name || '(unnamed)')}</span>
        <span class="pdf-field-meta">Page ${field.page} · ${escapeHtml(field.type || 'Unknown')}${field.required ? ' · Required' : ''}${field.value ? ` · ${escapeHtml(field.value)}` : ''}</span>
      `;
      button.addEventListener('click', () => selectField(field.id, true));
      fragment.append(button);
    });

    fieldList.append(fragment);
  }

  function selectField(fieldId, scrollToField) {
    const field = state.fields.find(item => item.id === fieldId);

    if (!field) {
      return;
    }

    state.selectedFieldId = fieldId;
    container.querySelectorAll('.pdf-field-overlay.selected, .pdf-field-item.selected').forEach(item => item.classList.remove('selected'));
    container.querySelector(`.pdf-field-overlay[data-field-id="${cssEscape(fieldId)}"]`)?.classList.add('selected');
    selectedFieldTitle.textContent = field.name || '(unnamed)';
    selectedFieldSummary.textContent = `Page ${field.page} · ${field.type || 'Unknown type'}`;
    selectedFieldDetail.textContent = field.name || '(unnamed)';
    fieldRequirement.disabled = false;
    fieldNotes.disabled = false;
    fieldRequirement.value = getFieldReview(field).requirement;
    fieldNotes.value = getFieldReview(field).notes;
    copySelectedNameButton.disabled = false;
    copySelectedJsonButton.disabled = false;
    goToSelectedButton.disabled = false;
    fieldDetails.innerHTML = [
      detailCard('Name', field.name),
      detailCard('Type', field.type || 'Unknown'),
      detailCard('Required flag', field.required ? 'Yes' : 'No'),
      detailCard('Page', String(field.page)),
      detailCard('Value', field.value || '(empty)'),
      detailCard('Default value', field.defaultValue || '(empty)'),
      detailCard('Alternative text', field.alternativeText || '(empty)'),
      detailCard('PDF rectangle', JSON.stringify(field.rect.pdf, null, 2)),
      detailCard('Viewport rectangle', JSON.stringify(field.rect.viewport, null, 2))
    ].join('');
    renderFieldList();

    if (scrollToField) {
      container.querySelector(`.pdf-field-overlay[data-field-id="${cssEscape(fieldId)}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    }
  }

  function clearSelection(renderList = true) {
    state.selectedFieldId = null;
    container.querySelectorAll('.pdf-field-overlay.selected, .pdf-field-item.selected').forEach(item => item.classList.remove('selected'));
    selectedFieldTitle.textContent = 'No field selected';
    selectedFieldSummary.textContent = state.fields.length
      ? 'Click a field overlay or select a field from the list.'
      : 'No fillable field selected.';
    fieldDetails.innerHTML = detailCard('Status', state.fields.length ? `${state.fields.length} field(s) available.` : 'Waiting for PDF.');
    copySelectedNameButton.disabled = true;
    copySelectedJsonButton.disabled = true;
    goToSelectedButton.disabled = true;
    fieldRequirement.value = 'unreviewed';
    fieldRequirement.disabled = true;
    fieldNotes.value = '';
    fieldNotes.disabled = true;
    selectedFieldDetail.textContent = 'None';

    if (renderList) {
      renderFieldList();
    }
  }

  function getSelectedField() {
    return state.fields.find(field => field.id === state.selectedFieldId) || null;
  }

  function applyViewerClasses() {
    viewer.classList.toggle('pdf-hide-overlays', !showOverlays.checked);
    viewer.classList.toggle('pdf-show-labels', showLabels.checked);
  }

  async function handleFile(file) {
    if (!file) {
      return;
    }

    if (!isPdfFile(file)) {
      setStatus('Choose a PDF file.', 'error');
      return;
    }

    try {
      setStatus('Loading PDF locally...', null);
      setControlsEnabled(false);
      const pdfjs = await loadPdfJs();
      const bytes = new Uint8Array(await file.arrayBuffer());
      state.pdf = await pdfjs.getDocument({ data: bytes }).promise;
      state.fileName = file.name;
      state.reviews = {};
      await renderPdf();
      setStatus(`PDF loaded successfully. ${state.fields.length.toLocaleString('en-GB')} field${state.fields.length === 1 ? '' : 's'} found.`, 'success');
    } catch (error) {
      state.pdf = null;
      state.fileName = '';
      state.fields = [];
      state.reviews = {};
      viewer.innerHTML = emptyState('Unable to read this PDF', 'The file may not be a valid PDF or may use unsupported form features.');
      syncHandoverOutput();
      setStatus(error.message || 'Unable to load this PDF.', 'error');
    } finally {
      updateSummary();
      setControlsEnabled(true);
      renderFieldList();
      clearSelection(false);
    }
  }

  async function renderPdf() {
    const version = state.renderVersion + 1;
    state.renderVersion = version;
    state.fields = [];
    viewer.innerHTML = '';
    applyViewerClasses();

    const scale = Number(zoom.value) || 1.5;
    const pdfContainer = document.createElement('div');
    pdfContainer.className = 'pdf-pages';
    viewer.append(pdfContainer);

    for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber += 1) {
      if (version !== state.renderVersion) {
        return;
      }

      const page = await state.pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page-wrapper';
      wrapper.style.width = `${viewport.width}px`;
      wrapper.style.height = `${viewport.height}px`;

      const badge = document.createElement('span');
      badge.className = 'pdf-page-badge';
      badge.textContent = `Page ${pageNumber}`;
      wrapper.append(badge);

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      wrapper.append(canvas);
      pdfContainer.append(wrapper);

      await page.render({ canvasContext: context, viewport }).promise;

      const annotations = await page.getAnnotations({ intent: 'display' });

      annotations
        .filter(isPdfFieldAnnotation)
        .forEach((annotation, index) => {
          const viewportRect = viewport.convertToViewportRectangle(annotation.rect);
          const field = createPdfFieldModel({
            annotation,
            pageNumber,
            viewportRect,
            index: state.fields.length + index
          });
          const overlay = createFieldOverlay(field);
          state.fields.push(field);
          wrapper.append(overlay);
        });
    }

    if (state.fields.length === 0) {
      viewer.innerHTML = emptyState('No fillable fields found', 'This PDF loaded, but PDF.js did not report AcroForm field annotations.');
    }

    syncHandoverOutput();
  }

  function createFieldOverlay(field) {
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'pdf-field-overlay';
    overlay.dataset.fieldId = field.id;
    overlay.title = field.name || '(unnamed)';
    overlay.setAttribute('aria-label', `Field ${field.name || 'unnamed'}`);
    overlay.style.left = `${field.rect.viewport.x}px`;
    overlay.style.top = `${field.rect.viewport.y}px`;
    overlay.style.width = `${field.rect.viewport.width}px`;
    overlay.style.height = `${field.rect.viewport.height}px`;

    const label = document.createElement('span');
    label.className = 'pdf-field-label';
    label.textContent = field.name || '(unnamed)';
    overlay.append(label);

    overlay.addEventListener('click', async event => {
      event.stopPropagation();
      selectField(field.id, false);
      await copyText(field.name);
      setStatus(`Copied field name: ${field.name || '(unnamed)'}`, 'success');
    });

    return overlay;
  }

  function exportText(fileName, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    state.objectUrls.push(url);
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.append(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
  }

  function getFieldReview(field) {
    const review = state.reviews[field.id] || {};

    return {
      requirement: review.requirement || (field.required ? 'required' : 'unreviewed'),
      notes: review.notes || ''
    };
  }

  function updateSelectedReview() {
    const field = getSelectedField();

    if (!field) {
      return;
    }

    state.reviews[field.id] = {
      requirement: fieldRequirement.value,
      notes: fieldNotes.value.trim()
    };
  }

  fileInput.addEventListener('change', () => handleFile(fileInput.files?.[0]));
  unbindDropZone = bindFileDropZone(dropZone, {
    accept: PDF_FILE_ACCEPT,
    onFile: handleFile,
    onReject: () => setStatus('Choose a PDF file.', 'error')
  });
  zoom.addEventListener('change', () => {
    if (state.pdf) {
      renderPdf().then(() => {
        renderFieldList();
        clearSelection(false);
      });
    }
  });
  search.addEventListener('input', renderFieldList);
  showOverlays.addEventListener('change', applyViewerClasses);
  showLabels.addEventListener('change', applyViewerClasses);
  hideEmpty.addEventListener('change', renderFieldList);

  copyNamesButton.addEventListener('click', async () => {
    await copyText(buildFieldNamesText(state.fields));
    setStatus('Field names copied to the clipboard.', 'success');
  });
  exportJsonButton.addEventListener('click', () => {
    exportText(
      buildPdfFieldOutputFileName(state.fileName, 'pdf-fields', 'json'),
      buildFieldsJsonExport({
        fields: state.fields,
        fileName: state.fileName,
        pageCount: state.pdf?.numPages || 0
      }),
      'application/json;charset=utf-8'
    );
    setStatus('Field mapping exported as JSON.', 'success');
  });
  exportCsvButton.addEventListener('click', () => {
    exportText(
      buildPdfFieldOutputFileName(state.fileName, 'pdf-fields', 'csv'),
      buildFieldsCsvExport(state.fields),
      'text/csv;charset=utf-8'
    );
    setStatus('Field mapping exported as CSV.', 'success');
  });
  exportReportButton.addEventListener('click', () => {
    exportText(
      buildPdfFieldOutputFileName(state.fileName, 'pdf-field-handover', 'md'),
      buildPdfFieldHandoverMarkdown({
        fields: state.fields,
        fileName: state.fileName,
        pageCount: state.pdf?.numPages || 0,
        reviews: state.reviews
      }),
      'text/markdown;charset=utf-8'
    );
    setStatus('Field handover report exported as Markdown.', 'success');
  });
  fieldRequirement.addEventListener('change', updateSelectedReview);
  fieldNotes.addEventListener('input', updateSelectedReview);
  copySelectedNameButton.addEventListener('click', async () => {
    const field = getSelectedField();
    if (field) {
      await copyText(field.name);
      setStatus(`Copied field name: ${field.name || '(unnamed)'}`, 'success');
    }
  });
  copySelectedJsonButton.addEventListener('click', async () => {
    const field = getSelectedField();
    if (field) {
      await copyText(JSON.stringify(field, null, 2));
      setStatus('Selected field JSON copied to the clipboard.', 'success');
    }
  });
  goToSelectedButton.addEventListener('click', () => {
    const field = getSelectedField();
    if (field) {
      selectField(field.id, true);
    }
  });

  return () => {
    unbindDropZone?.();
    state.renderVersion += 1;
    state.objectUrls.forEach(url => URL.revokeObjectURL(url));
  };
}

function isPdfFile(file) {
  const fileName = String(file?.name ?? '').toLocaleLowerCase('en-GB');
  const fileType = String(file?.type ?? '').toLocaleLowerCase('en-GB');

  return fileType === 'application/pdf' || fileName.endsWith('.pdf');
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(PDFJS_MODULE_URL).then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    });
  }

  return pdfJsPromise;
}

function detailCard(label, value) {
  return `
    <div class="detail-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function emptyState(title, text) {
  return `
    <div class="pdf-template-empty">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }

  return String(value).replace(/["\\]/g, '\\$&');
}
