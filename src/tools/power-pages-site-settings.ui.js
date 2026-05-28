import { buildSiteSettingsPlan, SITE_SETTING_FEATURES } from './power-pages-site-settings.js';

export function renderPowerPagesSiteSettingsHelper(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="siteSettingsFeature">Feature area</label>
          <select id="siteSettingsFeature">
            ${SITE_SETTING_FEATURES.map(feature => `<option value="${feature.value}">${feature.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="siteSettingsTable">Logical table name</label>
          <input id="siteSettingsTable" type="text" placeholder="account" />
        </div>

        <div class="field-stack">
          <label for="siteSettingsFields">Fields</label>
          <input id="siteSettingsFields" type="text" placeholder="name, accountnumber" />
        </div>
      </div>

      <div class="option-grid">
        <label class="checkbox-row" for="enableWebApi">
          <input id="enableWebApi" type="checkbox" checked />
          <span>Enable Web API for the table</span>
        </label>
        <label class="checkbox-row" for="includeInnerError">
          <input id="includeInnerError" type="checkbox" />
          <span>Include Web API inner error while debugging</span>
        </label>
        <label class="checkbox-row" for="requiresConfirmation">
          <input id="requiresConfirmation" type="checkbox" checked />
          <span>Require registration confirmation</span>
        </label>
        <label class="checkbox-row" for="requiresInvitation">
          <input id="requiresInvitation" type="checkbox" />
          <span>Require invitations for registration</span>
        </label>
        <label class="checkbox-row" for="enableDefaultHtmlEncoding">
          <input id="enableDefaultHtmlEncoding" type="checkbox" checked />
          <span>Keep default HTML encoding enabled</span>
        </label>
      </div>

      <div class="button-row">
        <button id="generateSiteSettingsButton" class="primary" type="button">Generate checklist</button>
        <button id="clearSiteSettingsButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="output-toolbar">
        <label for="siteSettingsOutput">Output</label>
        <div class="button-row">
          <button id="copySiteSettingsButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadSiteSettingsButton" class="button secondary" href="#" download="power-pages-site-settings.md" hidden>Download output</a>
        </div>
      </div>

      <textarea id="siteSettingsOutput" spellcheck="false" readonly placeholder="The site settings checklist will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Feature area</span>
          <strong id="siteSettingsFeatureDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Settings</span>
          <strong id="siteSettingsCount">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="siteSettingsWarnings">-</strong>
        </div>
        <div class="detail-card">
          <span>Output type</span>
          <strong id="siteSettingsOutputType">-</strong>
        </div>
      </div>

      <div id="siteSettingsStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const feature = container.querySelector('#siteSettingsFeature');
  const table = container.querySelector('#siteSettingsTable');
  const fields = container.querySelector('#siteSettingsFields');
  const enableWebApi = container.querySelector('#enableWebApi');
  const includeInnerError = container.querySelector('#includeInnerError');
  const requiresConfirmation = container.querySelector('#requiresConfirmation');
  const requiresInvitation = container.querySelector('#requiresInvitation');
  const enableDefaultHtmlEncoding = container.querySelector('#enableDefaultHtmlEncoding');
  const generateButton = container.querySelector('#generateSiteSettingsButton');
  const clearButton = container.querySelector('#clearSiteSettingsButton');
  const copyButton = container.querySelector('#copySiteSettingsButton');
  const downloadButton = container.querySelector('#downloadSiteSettingsButton');
  const output = container.querySelector('#siteSettingsOutput');
  const featureDetail = container.querySelector('#siteSettingsFeatureDetail');
  const settingCount = container.querySelector('#siteSettingsCount');
  const warnings = container.querySelector('#siteSettingsWarnings');
  const outputType = container.querySelector('#siteSettingsOutputType');
  const status = container.querySelector('#siteSettingsStatus');

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
    featureDetail.textContent = '-';
    settingCount.textContent = '-';
    warnings.textContent = '-';
    outputType.textContent = '-';
  }

  function setDetails(result) {
    featureDetail.textContent = SITE_SETTING_FEATURES.find(item => item.value === result.feature).label;
    settingCount.textContent = result.settingCount.toLocaleString('en-GB');
    warnings.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
    outputType.textContent = 'Markdown checklist';
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const blob = new Blob([result.output], { type: 'text/markdown;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = 'power-pages-site-settings.md';
    downloadButton.textContent = `Download ${downloadButton.download}`;
    downloadButton.hidden = false;
  }

  function handleGenerate() {
    try {
      const result = buildSiteSettingsPlan({
        feature: feature.value,
        logicalTableName: table.value,
        fields: fields.value,
        enableWebApi: enableWebApi.checked,
        includeInnerError: includeInnerError.checked,
        requiresConfirmation: requiresConfirmation.checked,
        requiresInvitation: requiresInvitation.checked,
        enableDefaultHtmlEncoding: enableDefaultHtmlEncoding.checked
      });

      setOutput(result);
      setStatus(buildSuccessMessage('Power Pages site settings checklist generated successfully.', result), 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to generate this site settings checklist.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value) {
      setStatus('There is no output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Output selected and copied using the browser fallback.', 'success');
    }
  }

  generateButton.addEventListener('click', handleGenerate);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    feature.value = 'webapi';
    table.value = '';
    fields.value = '';
    enableWebApi.checked = true;
    includeInnerError.checked = false;
    requiresConfirmation.checked = true;
    requiresInvitation.checked = false;
    enableDefaultHtmlEncoding.checked = true;
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    table.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(message, result) {
  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
