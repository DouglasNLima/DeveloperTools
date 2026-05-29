import { buildJsonDiff } from './json-diff.js';
import { bindSyntaxHighlight } from './syntax-highlight.js';

export function renderJsonDiff(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="jsonDiffOutputFormat">Output format</label>
          <select id="jsonDiffOutputFormat">
            <option value="markdown">Markdown report</option>
            <option value="json">JSON report</option>
          </select>
        </div>

        <label class="checkbox-row" for="jsonDiffSortKeys">
          <input id="jsonDiffSortKeys" type="checkbox" checked />
          <span>Sort object keys before comparing</span>
        </label>

        <div class="button-row button-row--end">
          <button id="compareJsonButton" class="primary" type="button">Compare JSON</button>
          <button id="clearJsonDiffButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="jsonDiffLeft">Left JSON</label>
          <textarea id="jsonDiffLeft" spellcheck="false" placeholder='{"name":"Contoso","active":true}'></textarea>
        </div>

        <div class="field-stack">
          <label for="jsonDiffRight">Right JSON</label>
          <textarea id="jsonDiffRight" spellcheck="false" placeholder='{"name":"Fabrikam","active":true}'></textarea>
        </div>
      </div>

      <div class="output-toolbar">
        <label for="jsonDiffOutput">Output</label>
        <div class="button-row">
          <button id="copyJsonDiffButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadJsonDiffButton" class="button secondary" href="#" download="json-diff.md" hidden>Download output</a>
        </div>
      </div>

      <textarea id="jsonDiffOutput" spellcheck="false" readonly placeholder="The JSON diff report will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Diff status</span>
          <strong id="jsonDiffStatusDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Total changes</span>
          <strong id="jsonDiffChangesDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Added / removed</span>
          <strong id="jsonDiffAddedRemovedDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Changed / unchanged</span>
          <strong id="jsonDiffChangedUnchangedDetail">-</strong>
        </div>
      </div>

      <div id="jsonDiffStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const leftInput = container.querySelector('#jsonDiffLeft');
  const rightInput = container.querySelector('#jsonDiffRight');
  const outputFormat = container.querySelector('#jsonDiffOutputFormat');
  const sortKeys = container.querySelector('#jsonDiffSortKeys');
  const compareButton = container.querySelector('#compareJsonButton');
  const clearButton = container.querySelector('#clearJsonDiffButton');
  const copyButton = container.querySelector('#copyJsonDiffButton');
  const downloadButton = container.querySelector('#downloadJsonDiffButton');
  const output = container.querySelector('#jsonDiffOutput');
  const statusDetail = container.querySelector('#jsonDiffStatusDetail');
  const changesDetail = container.querySelector('#jsonDiffChangesDetail');
  const addedRemovedDetail = container.querySelector('#jsonDiffAddedRemovedDetail');
  const changedUnchangedDetail = container.querySelector('#jsonDiffChangedUnchangedDetail');
  const status = container.querySelector('#jsonDiffStatus');
  const leftHighlight = bindSyntaxHighlight(leftInput, { language: 'json' });
  const rightHighlight = bindSyntaxHighlight(rightInput, { language: 'json' });
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
    statusDetail.textContent = '-';
    changesDetail.textContent = '-';
    addedRemovedDetail.textContent = '-';
    changedUnchangedDetail.textContent = '-';
  }

  function setDetails(result) {
    statusDetail.textContent = result.equal ? 'Identical' : 'Different';
    changesDetail.textContent = result.summary.totalChanges.toLocaleString('en-GB');
    addedRemovedDetail.textContent = `${result.summary.added.toLocaleString('en-GB')} / ${result.summary.removed.toLocaleString('en-GB')}`;
    changedUnchangedDetail.textContent = `${result.summary.changed.toLocaleString('en-GB')} / ${result.summary.unchanged.toLocaleString('en-GB')}`;
  }

  function setOutput(result) {
    outputHighlight.setLanguage(result.outputFormat === 'json' ? 'json' : 'markdown');
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const mimeType = result.outputFormat === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8';
    const extension = result.outputFormat === 'json' ? 'json' : 'md';
    const blob = new Blob([result.output], { type: mimeType });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = `json-diff.${extension}`;
    downloadButton.textContent = `Download ${downloadButton.download}`;
    downloadButton.hidden = false;
  }

  function handleCompare() {
    try {
      const result = buildJsonDiff(leftInput.value, rightInput.value, {
        outputFormat: outputFormat.value,
        sortKeys: sortKeys.checked
      });

      setOutput(result);
      setStatus(result.equal ? 'JSON documents are structurally identical.' : 'JSON diff report created successfully.', 'success');
    } catch (error) {
      outputHighlight.setLanguage('plain');
      output.value = error.details?.parseError?.snippet || '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      statusDetail.textContent = 'Invalid';
      setStatus(error.message || 'Unable to compare these JSON documents.', 'error');
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

  compareButton.addEventListener('click', handleCompare);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    leftInput.value = '';
    rightInput.value = '';
    outputHighlight.setLanguage('markdown');
    output.value = '';
    outputFormat.value = 'markdown';
    sortKeys.checked = true;
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    leftInput.focus();
  });

  return () => {
    leftHighlight.destroy();
    rightHighlight.destroy();
    outputHighlight.destroy();
    revokeObjectUrl();
  };
}
