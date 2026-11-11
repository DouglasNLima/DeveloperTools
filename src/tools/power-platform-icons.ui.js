import { writeTextToClipboard } from './clipboard-feedback.js';
import {
  DEFAULT_ICON_SETTINGS, ICONS, ICON_EXPORT_SIZES, ICON_PREVIEW_SIZES,
  buildIconSvg, buildIconZip, filterIcons, getIconById, getIconCategories,
  getIconFilename, isIconCustomised, normaliseIconSettings
} from './power-platform-icons.js';

export function renderPowerPlatformIconLibrary(container) {
  container.innerHTML = `
    <section class="tool-board pp-icons" aria-label="Icon library">
      <div class="pp-icons-intro">
        <p class="hint">${ICONS.length} reusable SVG icons · ${getIconCategories().length} categories · All previews and downloads stay in this browser.</p>
        <details class="pp-icons-help"><summary>Using icons in Power Platform</summary>
          <p>Download an SVG and add it to your project's solution as an SVG web resource. Apply your project's publisher naming convention when creating the resource.</p>
          <p>Theme-adaptive icons use <code>currentColor</code>. Inline SVG can follow the host text colour; an SVG displayed through an image element does not inherit that colour automatically. Use a fixed colour when needed and review the result in your target app.</p>
        </details>
      </div>
      <div class="pp-icons-filters">
        <div class="field-stack"><label for="ppIconSearch">Search icons</label><input id="ppIconSearch" type="search" placeholder="Search names, purposes or keywords" autocomplete="off" /></div>
        <div class="field-stack"><label for="ppIconCategory">Category</label><select id="ppIconCategory"><option value="">All categories</option></select></div>
        <div class="field-stack"><label for="ppIconCollection">Collection</label><select id="ppIconCollection"><option value="">All collections</option><option value="original">Original (49)</option><option value="new">New (252)</option></select></div>
        <button class="secondary" type="button" data-reset-filters>Reset filters</button>
      </div>
      <details class="pp-icons-customise" open>
        <summary>Customise icons <span id="ppIconSettingsSummary">Original style</span></summary>
        ${settingsFields('ppIcon')}
      </details>
      <p id="ppIconValidation" class="pp-icons-error" role="alert" hidden></p>
      <div class="pp-icons-toolbar">
        <div><strong>Download the collection</strong><p class="hint">Every icon uses these settings. Filters do not restrict the ZIP.</p></div>
        <button id="ppIconDownloadAll" class="primary" type="button" data-icon-export>Download all ${ICONS.length} icons (ZIP)</button>
      </div>
      <p id="ppIconDownloadStatus" class="hint" role="status"></p>
      <div class="pp-icons-toolbar">
        <p id="ppIconResults" class="hint" role="status"></p>
        <div class="button-row">
          <label for="ppIconPreviewSize">Preview size</label><select id="ppIconPreviewSize">${ICON_PREVIEW_SIZES.map(size => `<option value="${size}"${size === 32 ? ' selected' : ''}>${size} px</option>`).join('')}</select>
          <button id="ppIconCanvas" class="secondary" type="button" aria-pressed="false">Dark canvas</button>
        </div>
      </div>
      <div id="ppIconGrid" class="pp-icons-grid" aria-label="Icons"></div>
      <div id="ppIconEmpty" class="empty-state" hidden><p>No icons match these filters.</p><button class="secondary" type="button" data-reset-filters>Reset filters</button></div>
      <dialog id="ppIconDetail" class="pp-icons-dialog" aria-labelledby="ppIconDetailName">
        <div class="pp-icons-toolbar"><div><h2 id="ppIconDetailName"></h2><code id="ppIconDetailFilename"></code></div><button id="ppIconClose" class="secondary" type="button" aria-label="Close icon details">Close</button></div>
        <div class="pp-icons-detail-overview"><div id="ppIconDetailPreview" class="pp-icons-detail-preview" aria-hidden="true"></div><div><strong id="ppIconDetailCategory"></strong><p id="ppIconDetailDescription"></p></div></div>
        <div id="ppIconSamples" class="pp-icons-samples" aria-label="Light and dark previews at 16, 24, 32 and 48 pixels"></div>
        <p id="ppIconDetailMetaphor" class="hint"></p><p id="ppIconDetailProperties" class="hint"></p><p id="ppIconDetailKeywords" class="hint"></p>
        <details class="pp-icons-customise"><summary>Adjust customisation</summary><p class="hint">Changes apply to all icon previews and downloads.</p>${settingsFields('ppIconDetail')}</details>
        <p id="ppIconDetailValidation" class="pp-icons-error" role="alert" hidden></p>
        <div class="button-row">
          <button id="ppIconDownload" class="primary" type="button" data-icon-export>Download SVG</button>
          <button id="ppIconOriginal" class="secondary" type="button" hidden>Download original</button>
          <button id="ppIconCopySvg" class="secondary" type="button" data-icon-export>Copy SVG</button>
          <button id="ppIconCopyName" class="secondary" type="button" data-icon-export>Copy filename</button>
        </div>
        <p id="ppIconDetailStatus" class="hint" role="status"></p>
        <details id="ppIconSourceDisclosure"><summary>View SVG source</summary><div class="field-stack"><label for="ppIconSource">SVG source</label><textarea id="ppIconSource" readonly spellcheck="false" rows="5"></textarea></div></details>
      </dialog>
    </section>`;

  const $ = selector => container.querySelector(selector);
  const $$ = selector => [...container.querySelectorAll(selector)];
  const lifecycle = new AbortController();
  const on = (element, event, handler) => element.addEventListener(event, handler, { signal: lifecycle.signal });
  const dialog = $('#ppIconDetail');
  const grid = $('#ppIconGrid');
  const invalidFields = new Map();
  const downloadUrls = new Map();
  let settings = { ...DEFAULT_ICON_SETTINGS };
  let selected = null;
  let selectedSvg = '';
  let disposed = false;

  for (const category of getIconCategories()) $('#ppIconCategory').add(new Option(category, category));
  const cards = new Map(ICONS.map(icon => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pp-icons-card';
    card.dataset.iconId = icon.id;
    card.setAttribute('aria-label', `Inspect ${icon.displayName}`);
    const glyph = document.createElement('span');
    glyph.className = 'pp-icons-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    const label = document.createElement('strong');
    label.textContent = icon.displayName;
    const description = document.createElement('span');
    description.className = 'pp-icons-card-category';
    description.textContent = icon.category;
    card.append(glyph, label, description);
    on(card, 'click', () => inspect(icon.id));
    grid.append(card);
    return [icon.id, card];
  }));

  function updateFilters() {
    const visible = filterIcons({ search: $('#ppIconSearch').value, category: $('#ppIconCategory').value, collection: $('#ppIconCollection').value });
    const visibleIds = new Set(visible.map(icon => icon.id));
    for (const [id, card] of cards) card.hidden = !visibleIds.has(id);
    $('#ppIconResults').textContent = `${visible.length} of ${ICONS.length} icons`;
    $('#ppIconEmpty').hidden = visible.length !== 0;
  }

  function updateValidation() {
    const message = [...invalidFields.values()][0] || '';
    for (const target of [$('#ppIconValidation'), $('#ppIconDetailValidation')]) {
      target.hidden = !message;
      target.textContent = message;
    }
    for (const button of $$('[data-icon-export]')) button.disabled = invalidFields.size > 0;
  }

  function updateSettings(origin) {
    for (const field of $$('[data-icon-property]')) {
      if (field !== origin && !invalidFields.has(field)) field.value = String(settings[field.dataset.iconProperty]);
    }
    for (const output of $$('[data-icon-output="strokeWidth"]')) output.textContent = `${settings.strokeWidth} units`;
    for (const output of $$('[data-icon-output="opacity"]')) output.textContent = `${settings.opacity}%`;
    $('#ppIconSettingsSummary').textContent = isIconCustomised(settings)
      ? `${settings.colourMode === 'fixed' ? settings.colour : 'Theme adaptive'} · ${settings.exportSize} px · ${settings.strokeWidth} units · ${settings.opacity}% · ${settings.rotation}°`
      : 'Original style';
    for (const [id, card] of cards) card.querySelector('.pp-icons-glyph').innerHTML = previewSvg(buildIconSvg(id, settings), 32);
    refreshDetail();
    updateValidation();
    $('#ppIconDownloadStatus').textContent = '';
    $('#ppIconDetailStatus').textContent = '';
  }

  function changeSetting(event) {
    const field = event.currentTarget;
    const property = field.dataset.iconProperty;
    try {
      settings = normaliseIconSettings({ ...settings, [property]: field.value, ...(property === 'colour' ? { colourMode: 'fixed' } : {}) });
      for (const invalid of invalidFields.keys()) {
        if (invalid.dataset.iconProperty === property) {
          invalidFields.delete(invalid);
          invalid.removeAttribute('aria-invalid');
        }
      }
      updateSettings(field);
    } catch (error) {
      invalidFields.set(field, error.message);
      field.setAttribute('aria-invalid', 'true');
      updateValidation();
    }
  }

  function inspect(id) {
    selected = getIconById(id);
    $('#ppIconDetailName').textContent = selected.displayName;
    $('#ppIconDetailCategory').textContent = selected.category;
    $('#ppIconDetailDescription').textContent = selected.description;
    $('#ppIconDetailMetaphor').textContent = selected.visualMetaphor;
    $('#ppIconDetailKeywords').textContent = `Keywords: ${selected.keywords.join(', ')}`;
    $('#ppIconDetailStatus').textContent = '';
    refreshDetail();
    dialog.showModal();
    $('#ppIconClose').focus();
  }

  function refreshDetail() {
    if (!selected) return;
    selectedSvg = buildIconSvg(selected.id, settings);
    $('#ppIconDetailFilename').textContent = getIconFilename(selected.id, settings);
    $('#ppIconDetailPreview').innerHTML = previewSvg(selectedSvg, 80);
    $('#ppIconSamples').innerHTML = ['light', 'dark'].map(theme => `
      <div class="pp-icons-sample-row pp-icons-canvas-${theme}"><span>${theme === 'light' ? 'Light' : 'Dark'}</span>${ICON_PREVIEW_SIZES.map(size => `<div>${previewSvg(selectedSvg, size)}<small>${size} px</small></div>`).join('')}</div>`).join('');
    $('#ppIconDetailProperties').textContent = `${new TextEncoder().encode(selectedSvg).byteLength} bytes · ${settings.exportSize} × ${settings.exportSize} px · ${settings.colourMode === 'fixed' ? settings.colour : 'Theme-adaptive colour'} · Transparent background`;
    $('#ppIconSource').value = selectedSvg;
    $('#ppIconDownload').textContent = isIconCustomised(settings) ? 'Download customised SVG' : 'Download SVG';
    $('#ppIconOriginal').hidden = !isIconCustomised(settings);
  }

  function download(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    container.append(link);
    link.click();
    link.remove();
    const timer = setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 30000);
    downloadUrls.set(url, timer);
  }

  async function copy(value, trigger, label) {
    try {
      await writeTextToClipboard(value, { trigger });
      if (!disposed) $('#ppIconDetailStatus').textContent = `${label} copied.`;
    } catch {
      if (disposed) return;
      $('#ppIconDetailStatus').textContent = label === 'SVG' ? 'Select and copy the SVG source below.' : `Filename: ${value}`;
      $('#ppIconSourceDisclosure').open = true;
      $('#ppIconSource').focus();
      $('#ppIconSource').select();
    }
  }

  for (const field of $$('[data-icon-property]')) on(field, 'input', changeSetting);
  for (const field of [$('#ppIconSearch'), $('#ppIconCategory'), $('#ppIconCollection')]) on(field, 'input', updateFilters);
  for (const button of $$('[data-reset-filters]')) on(button, 'click', () => {
    for (const field of [$('#ppIconSearch'), $('#ppIconCategory'), $('#ppIconCollection')]) field.value = '';
    updateFilters();
    $('#ppIconSearch').focus();
  });
  for (const button of $$('[data-reset-icons]')) on(button, 'click', () => {
    settings = { ...DEFAULT_ICON_SETTINGS };
    for (const field of invalidFields.keys()) field.removeAttribute('aria-invalid');
    invalidFields.clear();
    updateSettings();
  });
  on($('#ppIconPreviewSize'), 'input', () => grid.style.setProperty('--pp-icon-size', `${Number($('#ppIconPreviewSize').value)}px`));
  on($('#ppIconCanvas'), 'click', () => {
    const dark = grid.classList.toggle('pp-icons-canvas-dark');
    $('#ppIconCanvas').setAttribute('aria-pressed', String(dark));
    $('#ppIconCanvas').textContent = dark ? 'Light canvas' : 'Dark canvas';
  });
  on($('#ppIconClose'), 'click', () => dialog.close());
  on(dialog, 'click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  on(dialog, 'close', () => cards.get(selected?.id)?.focus());
  on($('#ppIconDownload'), 'click', () => download(selectedSvg, getIconFilename(selected.id, settings), 'image/svg+xml'));
  on($('#ppIconOriginal'), 'click', () => download(selected.svg, `${selected.id}.svg`, 'image/svg+xml'));
  on($('#ppIconCopySvg'), 'click', event => copy(selectedSvg, event.currentTarget, 'SVG'));
  on($('#ppIconCopyName'), 'click', event => copy(getIconFilename(selected.id, settings), event.currentTarget, 'Filename'));
  on($('#ppIconDownloadAll'), 'click', () => {
    try {
      download(buildIconZip(settings), isIconCustomised(settings) ? 'consulting-icons-customised.zip' : 'consulting-icons-original.zip', 'application/zip');
      $('#ppIconDownloadStatus').textContent = `ZIP prepared: all ${ICONS.length} icons with your selected settings.`;
    } catch {
      $('#ppIconDownloadStatus').textContent = 'The ZIP could not be prepared. Please try again.';
    }
  });
  on(document, 'keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.altKey && !event.metaKey && !dialog.open
      && !event.target.closest('input, textarea, select, [contenteditable="true"]')) {
      event.preventDefault();
      $('#ppIconSearch').focus();
    }
  });
  updateSettings();
  updateFilters();

  return () => {
    disposed = true;
    lifecycle.abort();
    if (dialog.open) dialog.close();
    for (const [url, timer] of downloadUrls) { clearTimeout(timer); URL.revokeObjectURL(url); }
    downloadUrls.clear();
  };
}

function settingsFields(prefix) {
  return `<fieldset class="pp-icons-settings"><legend class="visually-hidden">Icon customisation</legend>
    <div class="field-stack"><label for="${prefix}ColourMode">Colour mode</label><select id="${prefix}ColourMode" data-icon-property="colourMode"><option value="theme">Theme adaptive</option><option value="fixed">Fixed colour</option></select></div>
    <div class="field-stack"><label for="${prefix}Hex">Hex colour</label><div class="pp-icons-colour"><input id="${prefix}Colour" type="color" value="#096d68" data-icon-property="colour" aria-label="Icon colour" /><input id="${prefix}Hex" type="text" value="#096d68" data-icon-property="colour" maxlength="7" spellcheck="false" autocomplete="off" aria-describedby="${prefix}Validation" /></div></div>
    <div class="field-stack"><label for="${prefix}ExportSize">SVG size</label><select id="${prefix}ExportSize" data-icon-property="exportSize">${ICON_EXPORT_SIZES.map(size => `<option value="${size}"${size === 32 ? ' selected' : ''}>${size} × ${size} px</option>`).join('')}</select></div>
    <div class="field-stack"><label for="${prefix}Stroke">Stroke width <output data-icon-output="strokeWidth">2 units</output></label><input id="${prefix}Stroke" type="range" min="1" max="4" step="0.25" value="2" data-icon-property="strokeWidth" /></div>
    <div class="field-stack"><label for="${prefix}Opacity">Opacity <output data-icon-output="opacity">100%</output></label><input id="${prefix}Opacity" type="range" min="25" max="100" step="5" value="100" data-icon-property="opacity" /></div>
    <div class="field-stack"><label for="${prefix}Rotation">Rotation</label><select id="${prefix}Rotation" data-icon-property="rotation">${[0, 90, 180, 270].map(rotation => `<option value="${rotation}">${rotation}°${rotation ? ' clockwise' : ''}</option>`).join('')}</select></div>
  </fieldset><div class="pp-icons-toolbar"><p class="hint">Transparent background. SVG size controls downloads; preview size only changes the grid.</p><button class="secondary" type="button" data-reset-icons>Reset customisation</button></div>`;
}

// Only bundled, hash-checked geometry and validated numeric/colour settings reach innerHTML.
function previewSvg(svg, size) {
  return svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}" aria-hidden="true" focusable="false"`);
}
