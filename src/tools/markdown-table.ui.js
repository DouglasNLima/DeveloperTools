import {
  MARKDOWN_TABLE_ALIGNMENT_OPTIONS,
  MARKDOWN_TABLE_OUTPUT_FORMATS,
  buildMarkdownTableOutputFileName,
  processMarkdownTables
} from './markdown-table.js';

export function renderMarkdownTableFormatter(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="markdownTableOutputFormat">Output format</label>
          <select id="markdownTableOutputFormat">
            ${MARKDOWN_TABLE_OUTPUT_FORMATS.map(format => `<option value="${format.value}">${format.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="markdownTableAlignment">Alignment</label>
          <select id="markdownTableAlignment">
            ${MARKDOWN_TABLE_ALIGNMENT_OPTIONS.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
          </select>
        </div>

        <div class="button-row button-row--end">
          <button id="formatMarkdownTableButton" class="primary" type="button">Format table</button>
          <button id="clearMarkdownTableButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="field-stack">
        <label for="markdownTableInput">Markdown table input</label>
        <textarea id="markdownTableInput" spellcheck="false" placeholder="| Name | Count |&#10;| :--- | ---: |&#10;| Ada | 12 |&#10;| Grace | 4 |"></textarea>
      </div>

      <div class="output-toolbar">
        <label for="markdownTableOutput">Output</label>
        <div class="button-row">
          <button id="copyMarkdownTableButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadMarkdownTableButton" class="button secondary" href="#" download="markdown-table.md" hidden>Download output</a>
        </div>
      </div>

      <textarea id="markdownTableOutput" spellcheck="false" readonly placeholder="The formatted table or delimited output will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Tables</span>
          <strong id="markdownTableCountDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Rows</span>
          <strong id="markdownTableRowsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Columns</span>
          <strong id="markdownTableColumnsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output type</span>
          <strong id="markdownTableOutputTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="markdownTableOutputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="markdownTableWarningsDetail">-</strong>
        </div>
      </div>

      <div id="markdownTableIssueList" class="markdown-table-issue-list" aria-live="polite"></div>
      <div id="markdownTableStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const outputFormat = container.querySelector('#markdownTableOutputFormat');
  const alignment = container.querySelector('#markdownTableAlignment');
  const input = container.querySelector('#markdownTableInput');
  const output = container.querySelector('#markdownTableOutput');
  const formatButton = container.querySelector('#formatMarkdownTableButton');
  const clearButton = container.querySelector('#clearMarkdownTableButton');
  const copyButton = container.querySelector('#copyMarkdownTableButton');
  const downloadButton = container.querySelector('#downloadMarkdownTableButton');
  const tableCountDetail = container.querySelector('#markdownTableCountDetail');
  const rowsDetail = container.querySelector('#markdownTableRowsDetail');
  const columnsDetail = container.querySelector('#markdownTableColumnsDetail');
  const outputTypeDetail = container.querySelector('#markdownTableOutputTypeDetail');
  const outputSizeDetail = container.querySelector('#markdownTableOutputSizeDetail');
  const warningsDetail = container.querySelector('#markdownTableWarningsDetail');
  const issueList = container.querySelector('#markdownTableIssueList');
  const status = container.querySelector('#markdownTableStatus');

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
    tableCountDetail.textContent = '-';
    rowsDetail.textContent = '-';
    columnsDetail.textContent = '-';
    outputTypeDetail.textContent = '-';
    outputSizeDetail.textContent = '-';
    warningsDetail.textContent = '-';
    issueList.innerHTML = '';
  }

  function setDetails(result) {
    tableCountDetail.textContent = result.tableCount.toLocaleString('en-GB');
    rowsDetail.textContent = `${result.totalRows.toLocaleString('en-GB')} total / ${result.totalDataRows.toLocaleString('en-GB')} data`;
    columnsDetail.textContent = result.maxColumns.toLocaleString('en-GB');
    outputTypeDetail.textContent = result.outputType;
    outputSizeDetail.textContent = result.outputSizeLabel;
    warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
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
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const fileName = buildMarkdownTableOutputFileName(result.outputFormat);
    const blob = new Blob([result.output], {
      type: result.outputFormat === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
    dispatchControlEvents(output);
  }

  function handleFormat() {
    try {
      const result = processMarkdownTables({
        input: input.value,
        outputFormat: outputFormat.value,
        alignment: alignment.value
      });

      setOutput(result);
      setStatus(buildSuccessMessage(result), result.warnings.length ? null : 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      dispatchControlEvents(output);
      setStatus(error.message || 'Unable to format this Markdown table.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no table output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Table output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Table output selected and copied using the browser fallback.', 'success');
    }
  }

  formatButton.addEventListener('click', handleFormat);
  copyButton.addEventListener('click', copyOutput);
  clearButton.addEventListener('click', () => {
    outputFormat.value = 'markdown';
    alignment.value = 'preserve';
    input.value = '';
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    dispatchControlEvents(output);
    setStatus('Ready.', null);
    input.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(result) {
  const base = result.outputFormat === 'markdown'
    ? 'Markdown table formatted successfully.'
    : 'Markdown table converted successfully.';

  if (result.warnings.length === 0) {
    return base;
  }

  return `${base} ${result.warnings[0]}`;
}

function dispatchControlEvents(control) {
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}
