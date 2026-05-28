import { buildPowerPagesWebApiSnippet, WEB_API_OPERATIONS } from './power-pages-webapi.js';

export function renderPowerPagesWebApiSnippetGenerator(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="webApiOperation">Operation</label>
          <select id="webApiOperation">
            ${WEB_API_OPERATIONS.map(operation => `<option value="${operation.value}">${operation.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="entitySetName">EntitySetName</label>
          <input id="entitySetName" type="text" placeholder="accounts" />
        </div>

        <div class="field-stack">
          <label for="logicalTableName">Logical table name</label>
          <input id="logicalTableName" type="text" placeholder="account" />
        </div>
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="recordId">Record ID</label>
          <input id="recordId" type="text" placeholder="Required for retrieve, update and delete" />
        </div>

        <div class="field-stack">
          <label for="selectColumns">Columns / Web API fields</label>
          <input id="selectColumns" type="text" placeholder="name, accountnumber" />
        </div>

        <div class="field-stack">
          <label for="topRows">$top</label>
          <input id="topRows" type="text" inputmode="numeric" placeholder="10" />
        </div>
      </div>

      <div class="field-stack">
        <label for="filterExpression">$filter</label>
        <input id="filterExpression" type="text" placeholder="statecode eq 0" />
      </div>

      <div class="field-stack">
        <label for="payloadJson">Payload JSON</label>
        <textarea id="payloadJson" spellcheck="false" autocomplete="off" placeholder="{&#10;  &quot;name&quot;: &quot;Contoso&quot;&#10;}"></textarea>
        <p class="hint">Payload is required only for create and update. The generator never calls your tenant or Dataverse environment.</p>
      </div>

      <div class="button-row">
        <button id="generateWebApiSnippetButton" class="primary" type="button">Generate snippet</button>
        <button id="clearWebApiSnippetButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="output-toolbar">
        <label for="webApiSnippetOutput">Output</label>
        <div class="button-row">
          <button id="copyWebApiSnippetButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadWebApiSnippetButton" class="button secondary" href="#" download="power-pages-web-api-snippet.js" hidden>Download output</a>
        </div>
      </div>

      <textarea id="webApiSnippetOutput" spellcheck="false" readonly placeholder="The Web API snippet and setup checklist will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>HTTP method</span>
          <strong id="webApiMethod">-</strong>
        </div>
        <div class="detail-card">
          <span>Endpoint</span>
          <strong id="webApiEndpoint">-</strong>
        </div>
        <div class="detail-card">
          <span>Site settings</span>
          <strong id="webApiSiteSettingsCount">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="webApiWarnings">-</strong>
        </div>
      </div>

      <div id="webApiSnippetStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const operation = container.querySelector('#webApiOperation');
  const entitySetName = container.querySelector('#entitySetName');
  const logicalTableName = container.querySelector('#logicalTableName');
  const recordId = container.querySelector('#recordId');
  const selectColumns = container.querySelector('#selectColumns');
  const topRows = container.querySelector('#topRows');
  const filterExpression = container.querySelector('#filterExpression');
  const payloadJson = container.querySelector('#payloadJson');
  const generateButton = container.querySelector('#generateWebApiSnippetButton');
  const clearButton = container.querySelector('#clearWebApiSnippetButton');
  const copyButton = container.querySelector('#copyWebApiSnippetButton');
  const downloadButton = container.querySelector('#downloadWebApiSnippetButton');
  const output = container.querySelector('#webApiSnippetOutput');
  const method = container.querySelector('#webApiMethod');
  const endpoint = container.querySelector('#webApiEndpoint');
  const settingsCount = container.querySelector('#webApiSiteSettingsCount');
  const warnings = container.querySelector('#webApiWarnings');
  const status = container.querySelector('#webApiSnippetStatus');

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
    method.textContent = '-';
    endpoint.textContent = '-';
    settingsCount.textContent = '-';
    warnings.textContent = '-';
  }

  function setDetails(result) {
    method.textContent = result.method;
    endpoint.textContent = result.endpoint;
    settingsCount.textContent = result.siteSettingsCount.toLocaleString('en-GB');
    warnings.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const blob = new Blob([result.output], { type: 'text/javascript;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = 'power-pages-web-api-snippet.js';
    downloadButton.textContent = `Download ${downloadButton.download}`;
    downloadButton.hidden = false;
  }

  function handleGenerate() {
    try {
      const result = buildPowerPagesWebApiSnippet({
        operation: operation.value,
        entitySetName: entitySetName.value,
        logicalTableName: logicalTableName.value,
        recordId: recordId.value,
        selectColumns: selectColumns.value,
        filter: filterExpression.value,
        top: topRows.value,
        payloadJson: payloadJson.value
      });

      setOutput(result);
      setStatus(buildSuccessMessage('Power Pages Web API snippet generated successfully.', result), 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to generate this Web API snippet.', 'error');
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
    operation.value = 'list';
    entitySetName.value = '';
    logicalTableName.value = '';
    recordId.value = '';
    selectColumns.value = '';
    topRows.value = '';
    filterExpression.value = '';
    payloadJson.value = '';
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    entitySetName.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(message, result) {
  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
