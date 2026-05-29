import {
  DATAVERSE_ENDPOINT_MODES,
  DATAVERSE_ENDPOINT_PRESETS,
  buildDataverseODataQuery,
  buildGuidedExpand,
  getEndpointPreset
} from './dataverse-odata.js';
import { bindSyntaxHighlight } from './syntax-highlight.js';

export function renderDataverseODataQueryBuilder(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="odataEndpointMode">Endpoint mode</label>
          <select id="odataEndpointMode">
            ${DATAVERSE_ENDPOINT_MODES.map(mode => `<option value="${mode.value}">${mode.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="odataEndpointPreset">Endpoint preset</label>
          <select id="odataEndpointPreset">
            ${DATAVERSE_ENDPOINT_PRESETS.map(preset => `<option value="${preset.value}">${preset.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="odataEntitySetName">EntitySetName</label>
          <input id="odataEntitySetName" type="text" spellcheck="false" placeholder="accounts" />
        </div>
      </div>

      <div class="button-row button-row--end">
        <button id="buildOdataButton" class="primary" type="button">Build query</button>
        <button id="clearOdataButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="odataExpandRelationship">Guided $expand relationship</label>
          <input id="odataExpandRelationship" type="text" spellcheck="false" placeholder="primarycontactid" />
        </div>

        <div class="field-stack">
          <label for="odataExpandNestedSelect">Nested $select</label>
          <input id="odataExpandNestedSelect" type="text" spellcheck="false" placeholder="fullname, emailaddress1" />
        </div>

        <div class="field-stack">
          <label for="odataExpandNestedOrderBy">Nested $orderby</label>
          <input id="odataExpandNestedOrderBy" type="text" spellcheck="false" placeholder="fullname asc" />
        </div>
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="odataExpandNestedFilter">Nested $filter</label>
          <input id="odataExpandNestedFilter" type="text" spellcheck="false" placeholder="statecode eq 0" />
        </div>
        <div class="button-row button-row--end">
          <button id="addGuidedExpandButton" class="secondary" type="button">Add guided $expand</button>
        </div>
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="odataSelect">Columns / $select</label>
          <textarea id="odataSelect" spellcheck="false" placeholder="name, accountnumber, primarycontactid"></textarea>
        </div>

        <div class="field-stack">
          <label for="odataExpand">Relationships / $expand</label>
          <textarea id="odataExpand" spellcheck="false" placeholder="primarycontactid($select=fullname,emailaddress1)"></textarea>
        </div>
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="odataFilter">$filter</label>
          <input id="odataFilter" type="text" spellcheck="false" placeholder="statecode eq 0" />
        </div>

        <div class="field-stack">
          <label for="odataOrderBy">$orderby</label>
          <input id="odataOrderBy" type="text" spellcheck="false" placeholder="name asc, createdon desc" />
        </div>
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="odataTop">$top</label>
          <input id="odataTop" type="number" min="1" max="5000" step="1" placeholder="50" />
        </div>

        <div class="field-stack">
          <label for="odataMaxPageSize">Max page size</label>
          <input id="odataMaxPageSize" type="number" min="1" max="5000" step="1" placeholder="100" />
        </div>

        <div class="option-grid">
          <label class="checkbox-row" for="odataIncludeCount">
            <input id="odataIncludeCount" type="checkbox" />
            <span>Include $count</span>
          </label>
          <label class="checkbox-row" for="odataFormattedValues">
            <input id="odataFormattedValues" type="checkbox" />
            <span>Include formatted values</span>
          </label>
        </div>
      </div>

      <div class="field-stack">
        <label for="odataPreview">Query preview</label>
        <div id="odataPreview" class="builder-preview" aria-live="polite"></div>
      </div>

      <div class="output-toolbar">
        <label for="odataOutput">Output</label>
        <div class="button-row">
          <button id="copyOdataButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadOdataButton" class="button secondary" href="#" download="dataverse-odata-query.md" hidden>Download output</a>
        </div>
      </div>

      <textarea id="odataOutput" spellcheck="false" readonly placeholder="The Dataverse OData query report will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Mode</span>
          <strong id="odataModeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Query options</span>
          <strong id="odataQueryOptionsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Headers</span>
          <strong id="odataHeadersDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>$select columns</span>
          <strong id="odataSelectCountDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>$expand items</span>
          <strong id="odataExpandCountDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Endpoint</span>
          <strong id="odataEndpointDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="odataOutputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="odataWarningsDetail">-</strong>
        </div>
      </div>

      <div id="odataStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const fields = {
    endpointPreset: container.querySelector('#odataEndpointPreset'),
    endpointMode: container.querySelector('#odataEndpointMode'),
    entitySetName: container.querySelector('#odataEntitySetName'),
    select: container.querySelector('#odataSelect'),
    expand: container.querySelector('#odataExpand'),
    expandRelationship: container.querySelector('#odataExpandRelationship'),
    expandNestedSelect: container.querySelector('#odataExpandNestedSelect'),
    expandNestedFilter: container.querySelector('#odataExpandNestedFilter'),
    expandNestedOrderBy: container.querySelector('#odataExpandNestedOrderBy'),
    filter: container.querySelector('#odataFilter'),
    orderBy: container.querySelector('#odataOrderBy'),
    top: container.querySelector('#odataTop'),
    maxPageSize: container.querySelector('#odataMaxPageSize'),
    includeCount: container.querySelector('#odataIncludeCount'),
    formattedValues: container.querySelector('#odataFormattedValues')
  };
  const preview = container.querySelector('#odataPreview');
  const output = container.querySelector('#odataOutput');
  const buildButton = container.querySelector('#buildOdataButton');
  const addGuidedExpandButton = container.querySelector('#addGuidedExpandButton');
  const clearButton = container.querySelector('#clearOdataButton');
  const copyButton = container.querySelector('#copyOdataButton');
  const downloadButton = container.querySelector('#downloadOdataButton');
  const details = {
    mode: container.querySelector('#odataModeDetail'),
    queryOptions: container.querySelector('#odataQueryOptionsDetail'),
    headers: container.querySelector('#odataHeadersDetail'),
    selectCount: container.querySelector('#odataSelectCountDetail'),
    expandCount: container.querySelector('#odataExpandCountDetail'),
    endpoint: container.querySelector('#odataEndpointDetail'),
    outputSize: container.querySelector('#odataOutputSizeDetail'),
    warnings: container.querySelector('#odataWarningsDetail')
  };
  const status = container.querySelector('#odataStatus');
  const selectHighlight = bindSyntaxHighlight(fields.select, { language: 'expression' });
  const expandHighlight = bindSyntaxHighlight(fields.expand, { language: 'expression' });
  const outputHighlight = bindSyntaxHighlight(output, { language: 'markdown' });

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
    Object.values(details).forEach(element => {
      element.textContent = '-';
    });
    preview.innerHTML = '';
  }

  function setDetails(result) {
    details.mode.textContent = result.endpointModeLabel;
    details.queryOptions.textContent = result.summary.queryOptionCount.toLocaleString('en-GB');
    details.headers.textContent = result.summary.headerCount.toLocaleString('en-GB');
    details.selectCount.textContent = result.summary.selectCount.toLocaleString('en-GB');
    details.expandCount.textContent = result.summary.expandCount.toLocaleString('en-GB');
    details.endpoint.textContent = result.endpoint;
    details.outputSize.textContent = result.outputSizeLabel;
    details.warnings.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function renderPreview(result) {
    preview.innerHTML = '';
    [
      ['Endpoint', result.endpoint],
      ['Headers', result.headers.map(header => `${header.name}: ${header.value}`).join('\n')],
      ['fetch snippet', result.fetchSnippet]
    ].forEach(([label, value]) => {
      const card = document.createElement('article');
      card.className = 'builder-card';
      const title = document.createElement('span');
      title.textContent = label;
      const content = document.createElement('code');
      content.textContent = value || 'None';
      card.append(title, content);
      preview.append(card);
    });
  }

  function setOutput(result) {
    outputHighlight.setLanguage('markdown');
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    renderPreview(result);
    revokeObjectUrl();
    const blob = new Blob([result.output], { type: 'text/markdown;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = 'dataverse-odata-query.md';
    downloadButton.textContent = 'Download dataverse-odata-query.md';
    downloadButton.hidden = false;
  }

  function buildQuery() {
    try {
      const result = buildDataverseODataQuery({
        endpointPreset: fields.endpointPreset.value,
        endpointMode: fields.endpointMode.value,
        entitySetName: fields.entitySetName.value,
        selectColumns: fields.select.value,
        expand: fields.expand.value,
        filter: fields.filter.value,
        orderBy: fields.orderBy.value,
        top: fields.top.value,
        maxPageSize: fields.maxPageSize.value,
        includeCount: fields.includeCount.checked,
        includeFormattedValues: fields.formattedValues.checked
      });
      setOutput(result);
      setStatus(buildSuccessMessage(result), 'success');
    } catch (error) {
      outputHighlight.setLanguage('plain');
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      details.mode.textContent = 'Invalid';
      setStatus(error.message || 'Unable to build this Dataverse query.', 'error');
    }
  }

  function addGuidedExpand() {
    try {
      const expandExpression = buildGuidedExpand({
        relationshipName: fields.expandRelationship.value,
        selectColumns: fields.expandNestedSelect.value,
        filter: fields.expandNestedFilter.value,
        orderBy: fields.expandNestedOrderBy.value
      });
      const existing = fields.expand.value.trim();
      fields.expand.value = existing ? `${existing},\n${expandExpression}` : expandExpression;
      fields.expandRelationship.value = '';
      fields.expandNestedSelect.value = '';
      fields.expandNestedFilter.value = '';
      fields.expandNestedOrderBy.value = '';
      setStatus('Guided $expand added to the query.', 'success');
      fields.expand.focus();
    } catch (error) {
      setStatus(error.message || 'Unable to add this guided $expand.', 'error');
    }
  }

  function applyEndpointPreset() {
    const preset = getEndpointPreset(fields.endpointPreset.value);

    fields.endpointMode.value = preset.endpointMode;
    fields.entitySetName.value = preset.entitySetName;
    fields.select.value = preset.selectColumns;
    fields.expand.value = preset.expand;
    fields.filter.value = preset.filter;
    fields.orderBy.value = preset.orderBy;
    fields.top.value = preset.top;
    fields.maxPageSize.value = preset.maxPageSize;
    fields.includeCount.checked = preset.includeCount;
    fields.formattedValues.checked = preset.includeFormattedValues;
    setStatus(preset.value === 'custom' ? 'Ready.' : `${preset.label} preset applied.`, preset.value === 'custom' ? null : 'success');
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no Dataverse query output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Dataverse query output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Dataverse query output selected and copied using the browser fallback.', 'success');
    }
  }

  fields.endpointPreset.addEventListener('change', applyEndpointPreset);
  buildButton.addEventListener('click', buildQuery);
  addGuidedExpandButton.addEventListener('click', addGuidedExpand);
  copyButton.addEventListener('click', copyOutput);
  clearButton.addEventListener('click', () => {
    fields.endpointPreset.value = 'custom';
    fields.endpointMode.value = 'dataverse';
    fields.entitySetName.value = '';
    fields.select.value = '';
    fields.expand.value = '';
    fields.expandRelationship.value = '';
    fields.expandNestedSelect.value = '';
    fields.expandNestedFilter.value = '';
    fields.expandNestedOrderBy.value = '';
    fields.filter.value = '';
    fields.orderBy.value = '';
    fields.top.value = '';
    fields.maxPageSize.value = '';
    fields.includeCount.checked = false;
    fields.formattedValues.checked = false;
    outputHighlight.setLanguage('markdown');
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    fields.entitySetName.focus();
  });

  return () => {
    selectHighlight.destroy();
    expandHighlight.destroy();
    outputHighlight.destroy();
    revokeObjectUrl();
  };
}

function buildSuccessMessage(result) {
  const message = 'Dataverse OData query built successfully.';

  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
