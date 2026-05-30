import { formatSqlQuery } from './sql-formatter.js';
import { bindSyntaxHighlight } from './syntax-highlight.js';

export function renderSqlFormatter(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="button-row button-row--end">
        <button id="formatSqlButton" class="primary" type="button">Format SQL</button>
        <button id="lineariseSqlButton" class="secondary" type="button">Linearise SQL</button>
        <button id="clearSqlButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="field-stack">
        <label for="sqlInput">SQL input</label>
        <textarea id="sqlInput" spellcheck="false" placeholder="select id, name from users where active = 1 order by name"></textarea>
      </div>

      <div class="output-toolbar">
        <label for="sqlOutput">Output</label>
        <div class="button-row">
          <button id="copySqlButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadSqlButton" class="button secondary" href="#" download="formatted-sql.sql" hidden>Download output</a>
        </div>
      </div>

      <textarea id="sqlOutput" spellcheck="false" readonly placeholder="The organised SQL will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>SQL status</span>
          <strong id="sqlStatusDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Mode</span>
          <strong id="sqlModeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output lines</span>
          <strong id="sqlLinesDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Tokens</span>
          <strong id="sqlTokensDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Comments</span>
          <strong id="sqlCommentsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="sqlOutputSizeDetail">-</strong>
        </div>
      </div>

      <div id="sqlStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const input = container.querySelector('#sqlInput');
  const output = container.querySelector('#sqlOutput');
  const formatButton = container.querySelector('#formatSqlButton');
  const lineariseButton = container.querySelector('#lineariseSqlButton');
  const clearButton = container.querySelector('#clearSqlButton');
  const copyButton = container.querySelector('#copySqlButton');
  const downloadButton = container.querySelector('#downloadSqlButton');
  const statusDetail = container.querySelector('#sqlStatusDetail');
  const modeDetail = container.querySelector('#sqlModeDetail');
  const linesDetail = container.querySelector('#sqlLinesDetail');
  const tokensDetail = container.querySelector('#sqlTokensDetail');
  const commentsDetail = container.querySelector('#sqlCommentsDetail');
  const outputSizeDetail = container.querySelector('#sqlOutputSizeDetail');
  const status = container.querySelector('#sqlStatus');
  const inputHighlight = bindSyntaxHighlight(input, { language: 'sql' });
  const outputHighlight = bindSyntaxHighlight(output, { language: 'sql' });

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
    statusDetail.textContent = '-';
    modeDetail.textContent = '-';
    linesDetail.textContent = '-';
    tokensDetail.textContent = '-';
    commentsDetail.textContent = '-';
    outputSizeDetail.textContent = '-';
  }

  function setInvalidDetails() {
    resetDetails();
    statusDetail.textContent = 'Invalid';
  }

  function setDetails(result) {
    statusDetail.textContent = 'Ready';
    modeDetail.textContent = result.modeLabel;
    linesDetail.textContent = result.lineCount.toLocaleString('en-GB');
    tokensDetail.textContent = result.tokenCount.toLocaleString('en-GB');
    commentsDetail.textContent = result.commentCount.toLocaleString('en-GB');
    outputSizeDetail.textContent = result.outputSizeLabel;
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const fileName = result.mode === 'linearise' ? 'linearised-sql.sql' : 'formatted-sql.sql';
    const blob = new Blob([result.output], { type: 'text/sql;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
  }

  function handleProcess(mode) {
    try {
      const result = formatSqlQuery({
        input: input.value,
        mode
      });

      setOutput(result);
      setStatus(`${result.outputType} created successfully.`, 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      setInvalidDetails();
      setStatus(error.message || 'Unable to process this SQL.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no SQL output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('SQL output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('SQL output selected and copied using the browser fallback.', 'success');
    }
  }

  formatButton.addEventListener('click', () => handleProcess('format'));
  lineariseButton.addEventListener('click', () => handleProcess('linearise'));
  copyButton.addEventListener('click', copyOutput);
  clearButton.addEventListener('click', () => {
    input.value = '';
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    input.focus();
  });

  return () => {
    inputHighlight.destroy();
    outputHighlight.destroy();
    revokeObjectUrl();
  };
}
