import { URL_TOOL_MODES, processUrlTool } from './url-codec.js';

export function renderUrlCodec(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="urlToolMode">Mode</label>
          <select id="urlToolMode">
            ${URL_TOOL_MODES.map(mode => `<option value="${mode.value}">${mode.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="urlOutputFormat">Query parse output</label>
          <select id="urlOutputFormat">
            <option value="json">JSON entries</option>
            <option value="markdown">Markdown table</option>
          </select>
        </div>

        <div class="button-row button-row--end">
          <button id="processUrlButton" class="primary" type="button">Process</button>
          <button id="clearUrlButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="option-grid">
        <label class="checkbox-row" for="urlSortKeys">
          <input id="urlSortKeys" type="checkbox" />
          <span>Sort keys when building a query string</span>
        </label>
        <label class="checkbox-row" for="urlIncludeQuestionMark">
          <input id="urlIncludeQuestionMark" type="checkbox" />
          <span>Prefix built query strings with ?</span>
        </label>
      </div>

      <div class="field-stack">
        <label for="urlInput">Input</label>
        <textarea id="urlInput" spellcheck="false" placeholder="https://example.test/search?q=hello%20world&tag=alpha"></textarea>
      </div>

      <div class="output-toolbar">
        <label for="urlOutput">Output</label>
        <div class="button-row">
          <button id="copyUrlButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadUrlButton" class="button secondary" href="#" download="url-output.txt" hidden>Download output</a>
        </div>
      </div>

      <textarea id="urlOutput" spellcheck="false" readonly placeholder="The URL or query string output will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Mode</span>
          <strong id="urlModeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Items</span>
          <strong id="urlItemCount">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="urlOutputSize">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="urlWarnings">-</strong>
        </div>
      </div>

      <div id="urlStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const mode = container.querySelector('#urlToolMode');
  const outputFormat = container.querySelector('#urlOutputFormat');
  const sortKeys = container.querySelector('#urlSortKeys');
  const includeQuestionMark = container.querySelector('#urlIncludeQuestionMark');
  const input = container.querySelector('#urlInput');
  const processButton = container.querySelector('#processUrlButton');
  const clearButton = container.querySelector('#clearUrlButton');
  const copyButton = container.querySelector('#copyUrlButton');
  const downloadButton = container.querySelector('#downloadUrlButton');
  const output = container.querySelector('#urlOutput');
  const modeDetail = container.querySelector('#urlModeDetail');
  const itemCount = container.querySelector('#urlItemCount');
  const outputSize = container.querySelector('#urlOutputSize');
  const warnings = container.querySelector('#urlWarnings');
  const status = container.querySelector('#urlStatus');

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
    modeDetail.textContent = '-';
    itemCount.textContent = '-';
    outputSize.textContent = '-';
    warnings.textContent = '-';
  }

  function setDetails(result) {
    modeDetail.textContent = URL_TOOL_MODES.find(item => item.value === result.mode).label;
    itemCount.textContent = result.itemCount.toLocaleString('en-GB');
    outputSize.textContent = result.outputSizeLabel;
    warnings.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const isJson = result.outputType === 'JSON query entries';
    const isMarkdown = result.outputType === 'Markdown table';
    const blob = new Blob([result.output], {
      type: isJson ? 'application/json;charset=utf-8' : isMarkdown ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    });
    const extension = isJson ? 'json' : isMarkdown ? 'md' : 'txt';
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = `url-query-output.${extension}`;
    downloadButton.textContent = `Download ${downloadButton.download}`;
    downloadButton.hidden = false;
  }

  function handleProcess() {
    try {
      const result = processUrlTool({
        mode: mode.value,
        input: input.value,
        outputFormat: outputFormat.value,
        sortKeys: sortKeys.checked,
        includeQuestionMark: includeQuestionMark.checked
      });

      setOutput(result);
      setStatus(buildSuccessMessage(`${result.outputType} created successfully.`, result), 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to process this URL or query string.', 'error');
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

  processButton.addEventListener('click', handleProcess);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    mode.value = 'encode-component';
    outputFormat.value = 'json';
    sortKeys.checked = false;
    includeQuestionMark.checked = false;
    input.value = '';
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    input.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(message, result) {
  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
