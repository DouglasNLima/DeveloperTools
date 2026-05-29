import {
  DATA_EXPLORER_FILTER_OPERATORS,
  DATA_EXPLORER_INPUT_FORMATS,
  processDataExplorer
} from './data-explorer.js';
import { bindFileDropZone } from './file-drop-zone.js';

const DATA_EXPLORER_FILE_ACCEPT = '.json,.xml,.txt,application/json,text/xml,application/xml,text/plain';

export function renderDataExplorer(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="dataExplorerFormat">Input format</label>
          <select id="dataExplorerFormat">
            ${DATA_EXPLORER_INPUT_FORMATS.map(format => `<option value="${format.value}">${format.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="dataExplorerRecordPath">JSON record path</label>
          <input id="dataExplorerRecordPath" type="text" spellcheck="false" placeholder="items or data.records" />
        </div>

        <div id="dataExplorerFileDropZone" class="drop-zone">
          <label for="dataExplorerFileInput" class="drop-zone-label">
            <span>Drop a JSON, XML or text file here or browse</span>
            <small>The selected file is read locally into the input area.</small>
          </label>
          <input id="dataExplorerFileInput" type="file" accept="${DATA_EXPLORER_FILE_ACCEPT}" />
        </div>
      </div>

      <div class="field-stack">
        <label for="dataExplorerInput">JSON or XML input</label>
        <textarea id="dataExplorerInput" spellcheck="false" placeholder='{"items":[{"name":"Ada","role":"Engineer"}]}'></textarea>
      </div>

      <div class="data-query-panel" aria-label="Guided JSON filters">
        <div class="data-query-panel-header">
          <strong>Guided JSON filters</strong>
          <button id="addDataFilterButton" class="secondary" type="button">Add filter</button>
        </div>
        <div id="dataFilterList" class="data-filter-list"></div>
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="dataExplorerSortField">Sort field</label>
          <input id="dataExplorerSortField" type="text" spellcheck="false" placeholder="name" />
        </div>

        <div class="field-stack">
          <label for="dataExplorerSortDirection">Sort direction</label>
          <select id="dataExplorerSortDirection">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <div class="field-stack">
          <label for="dataExplorerLimit">Result limit</label>
          <input id="dataExplorerLimit" type="number" min="1" max="10000" step="1" placeholder="100" />
        </div>
      </div>

      <div class="field-stack">
        <label for="dataExplorerColumns">Grid columns</label>
        <input id="dataExplorerColumns" type="text" spellcheck="false" placeholder="name, email, address.city" />
      </div>

      <div class="button-row button-row--end">
        <button id="exploreDataButton" class="primary" type="button">Explore data</button>
        <button id="clearDataExplorerButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="field-stack">
        <label for="dataExplorerGrid">Grid preview</label>
        <div id="dataExplorerGrid" class="data-grid-preview" aria-live="polite"></div>
      </div>

      <div class="output-toolbar">
        <label for="dataExplorerOutput">JSON output</label>
        <div class="button-row">
          <button id="copyDataExplorerButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadDataExplorerButton" class="button secondary" href="#" download="data-explorer-output.json" hidden>Download output</a>
        </div>
      </div>

      <textarea id="dataExplorerOutput" spellcheck="false" readonly placeholder="Filtered records will appear here as JSON."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Format</span>
          <strong id="dataExplorerFormatDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Record path</span>
          <strong id="dataExplorerPathDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Source records</span>
          <strong id="dataExplorerSourceDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Results</span>
          <strong id="dataExplorerResultsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Columns</span>
          <strong id="dataExplorerColumnsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="dataExplorerSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="dataExplorerWarningsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Query mode</span>
          <strong id="dataExplorerQueryModeDetail">-</strong>
        </div>
      </div>

      <div id="dataExplorerIssueList" class="data-issue-list" aria-live="polite"></div>
      <div id="dataExplorerStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const inputFormat = container.querySelector('#dataExplorerFormat');
  const recordPath = container.querySelector('#dataExplorerRecordPath');
  const fileInput = container.querySelector('#dataExplorerFileInput');
  const input = container.querySelector('#dataExplorerInput');
  const filterList = container.querySelector('#dataFilterList');
  const addFilterButton = container.querySelector('#addDataFilterButton');
  const sortField = container.querySelector('#dataExplorerSortField');
  const sortDirection = container.querySelector('#dataExplorerSortDirection');
  const limit = container.querySelector('#dataExplorerLimit');
  const selectedColumns = container.querySelector('#dataExplorerColumns');
  const exploreButton = container.querySelector('#exploreDataButton');
  const clearButton = container.querySelector('#clearDataExplorerButton');
  const grid = container.querySelector('#dataExplorerGrid');
  const output = container.querySelector('#dataExplorerOutput');
  const copyButton = container.querySelector('#copyDataExplorerButton');
  const downloadButton = container.querySelector('#downloadDataExplorerButton');
  const status = container.querySelector('#dataExplorerStatus');
  const issueList = container.querySelector('#dataExplorerIssueList');
  const details = {
    format: container.querySelector('#dataExplorerFormatDetail'),
    path: container.querySelector('#dataExplorerPathDetail'),
    source: container.querySelector('#dataExplorerSourceDetail'),
    results: container.querySelector('#dataExplorerResultsDetail'),
    columns: container.querySelector('#dataExplorerColumnsDetail'),
    size: container.querySelector('#dataExplorerSizeDetail'),
    warnings: container.querySelector('#dataExplorerWarningsDetail'),
    queryMode: container.querySelector('#dataExplorerQueryModeDetail')
  };

  let currentObjectUrl = null;
  let currentSourceName = '';
  let unbindDropZone = null;

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
    issueList.innerHTML = '';
    grid.innerHTML = '';
  }

  function setDetails(result) {
    details.format.textContent = result.inputFormat.toUpperCase();
    details.path.textContent = result.recordPath;
    details.source.textContent = result.sourceCount.toLocaleString('en-GB');
    details.results.textContent = result.matchedCount.toLocaleString('en-GB');
    details.columns.textContent = result.gridColumns.length.toLocaleString('en-GB');
    details.size.textContent = result.outputSizeLabel;
    details.warnings.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
    details.queryMode.textContent = result.inputFormat === 'xml' ? 'XML grid' : 'JSON filters';
    setIssues(result.warnings);
  }

  function setIssues(warnings) {
    issueList.innerHTML = '';

    warnings.forEach(warning => {
      const item = document.createElement('p');
      item.textContent = warning;
      issueList.append(item);
    });
  }

  function setOutput(result) {
    output.value = result.outputJson;
    copyButton.disabled = false;
    setDetails(result);
    renderGrid(result);
    revokeObjectUrl();

    const fileName = buildOutputFileName(currentSourceName);
    const blob = new Blob([result.outputJson], { type: 'application/json;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
  }

  function renderGrid(result) {
    grid.innerHTML = '';

    if (result.gridColumns.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No columns were found for the current records.';
      grid.append(emptyState);
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-grid-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    result.gridColumns.forEach(column => {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = column;
      headerRow.append(cell);
    });
    thead.append(headerRow);

    const tbody = document.createElement('tbody');

    if (result.gridRows.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = result.gridColumns.length;
      cell.textContent = 'No records matched the current filters.';
      row.append(cell);
      tbody.append(row);
    } else {
      result.gridRows.forEach(gridRow => {
        const row = document.createElement('tr');
        result.gridColumns.forEach(column => {
          const cell = document.createElement('td');
          cell.textContent = gridRow[column];
          row.append(cell);
        });
        tbody.append(row);
      });
    }

    table.append(thead, tbody);
    grid.append(table);
  }

  function getFilters() {
    return Array.from(filterList.querySelectorAll('.data-filter-row')).map(row => ({
      field: row.querySelector('[data-filter-field]').value,
      operator: row.querySelector('[data-filter-operator]').value,
      value: row.querySelector('[data-filter-value]').value
    }));
  }

  function handleExplore() {
    try {
      const result = processDataExplorer({
        input: input.value,
        inputFormat: inputFormat.value,
        recordPath: recordPath.value,
        filters: getFilters(),
        sort: {
          field: sortField.value,
          direction: sortDirection.value
        },
        selectedColumns: selectedColumns.value,
        limit: limit.value
      });

      setOutput(result);
      setStatus(buildSuccessMessage(result), 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to explore this data.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
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

  async function readSelectedFile(file) {
    if (!file) {
      return;
    }

    try {
      currentSourceName = file.name;
      input.value = await file.text();
      const extension = file.name.toLocaleLowerCase('en-GB').split('.').pop();

      if (extension === 'json') {
        inputFormat.value = 'json';
      } else if (extension === 'xml') {
        inputFormat.value = 'xml';
      }

      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      syncQueryControls();
      setStatus(`Loaded ${file.name}.`, 'success');
    } catch {
      setStatus('Unable to read the selected file.', 'error');
    }
  }

  function addFilterRow(filter = {}) {
    const row = document.createElement('div');
    row.className = 'data-filter-row';
    row.innerHTML = `
      <div class="field-stack">
        <label>Field</label>
        <input data-filter-field aria-label="Filter field" type="text" spellcheck="false" placeholder="status" value="${escapeAttribute(filter.field || '')}" />
      </div>
      <div class="field-stack">
        <label>Operator</label>
        <select data-filter-operator aria-label="Filter operator">
          ${DATA_EXPLORER_FILTER_OPERATORS.map(operator => `<option value="${operator.value}">${operator.label}</option>`).join('')}
        </select>
      </div>
      <div class="field-stack">
        <label>Value</label>
        <input data-filter-value aria-label="Filter value" type="text" spellcheck="false" placeholder="active" value="${escapeAttribute(filter.value || '')}" />
      </div>
      <div class="button-row button-row--end">
        <button class="secondary" data-remove-filter type="button">Remove</button>
      </div>
    `;

    row.querySelector('[data-filter-operator]').value = filter.operator || 'equals';
    row.querySelector('[data-remove-filter]').addEventListener('click', () => {
      row.remove();

      if (filterList.children.length === 0) {
        addFilterRow();
      }
    });

    filterList.append(row);
    syncQueryControls();
  }

  function syncQueryControls() {
    const xmlSelected = inputFormat.value === 'xml';
    filterList.querySelectorAll('input, select, button').forEach(element => {
      element.disabled = xmlSelected;
    });
    addFilterButton.disabled = xmlSelected;
    sortField.disabled = xmlSelected;
    sortDirection.disabled = xmlSelected;
  }

  addFilterButton.addEventListener('click', () => addFilterRow());
  exploreButton.addEventListener('click', handleExplore);
  copyButton.addEventListener('click', copyOutput);
  fileInput.addEventListener('change', event => readSelectedFile(event.target.files && event.target.files[0]));
  unbindDropZone = bindFileDropZone(container.querySelector('#dataExplorerFileDropZone'), {
    accept: DATA_EXPLORER_FILE_ACCEPT,
    onFile: readSelectedFile,
    onReject: () => setStatus('Choose a JSON, XML or text file.', 'error')
  });
  inputFormat.addEventListener('change', syncQueryControls);

  clearButton.addEventListener('click', () => {
    inputFormat.value = 'auto';
    recordPath.value = '';
    fileInput.value = '';
    input.value = '';
    filterList.innerHTML = '';
    addFilterRow();
    sortField.value = '';
    sortDirection.value = 'asc';
    limit.value = '';
    selectedColumns.value = '';
    output.value = '';
    currentSourceName = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    syncQueryControls();
    setStatus('Ready.', null);
    input.focus();
  });

  addFilterRow();

  return () => {
    unbindDropZone?.();
    revokeObjectUrl();
  };
}

function buildSuccessMessage(result) {
  const noun = result.inputFormat === 'xml' ? 'XML data' : 'JSON data';
  const message = `${noun} explored successfully.`;

  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}

function buildOutputFileName(sourceName = '') {
  const base = String(sourceName || 'data-explorer-output')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.(json|xml|txt)$/i, '') || 'data-explorer-output';

  return `${base}.json`;
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
