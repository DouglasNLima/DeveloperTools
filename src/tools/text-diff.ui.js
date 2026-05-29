import { TEXT_DIFF_OUTPUT_FORMATS, buildTextDiff } from './text-diff.js';

export function renderTextDiff(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="textDiffOutputFormat">Output format</label>
          <select id="textDiffOutputFormat">
            ${TEXT_DIFF_OUTPUT_FORMATS.map(format => `<option value="${format.value}">${format.label}</option>`).join('')}
          </select>
        </div>

        <label class="checkbox-row" for="textDiffIgnoreWhitespace">
          <input id="textDiffIgnoreWhitespace" type="checkbox" />
          <span>Ignore whitespace changes</span>
        </label>

        <label class="checkbox-row" for="textDiffIgnoreCase">
          <input id="textDiffIgnoreCase" type="checkbox" />
          <span>Ignore case</span>
        </label>
      </div>

      <div class="button-row">
        <button id="compareTextButton" class="primary" type="button">Compare text</button>
        <button id="clearTextDiffButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="textDiffLeft">Left text</label>
          <textarea id="textDiffLeft" spellcheck="false" placeholder="alpha&#10;beta&#10;gamma"></textarea>
        </div>

        <div class="field-stack">
          <label for="textDiffRight">Right text</label>
          <textarea id="textDiffRight" spellcheck="false" placeholder="alpha&#10;beta updated&#10;gamma"></textarea>
        </div>
      </div>

      <div class="field-stack">
        <label for="textDiffPreview">Diff preview</label>
        <div id="textDiffPreview" class="text-diff-preview" aria-live="polite"></div>
      </div>

      <div class="output-toolbar">
        <label for="textDiffOutput">Output</label>
        <div class="button-row">
          <button id="copyTextDiffButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadTextDiffButton" class="button secondary" href="#" download="text-diff.diff" hidden>Download output</a>
        </div>
      </div>

      <textarea id="textDiffOutput" spellcheck="false" readonly placeholder="The text diff report will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Diff status</span>
          <strong id="textDiffStatusDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Total changes</span>
          <strong id="textDiffChangesDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Added / removed</span>
          <strong id="textDiffAddedRemovedDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Changed / unchanged</span>
          <strong id="textDiffChangedUnchangedDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Lines</span>
          <strong id="textDiffLinesDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output type</span>
          <strong id="textDiffOutputTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Options</span>
          <strong id="textDiffOptionsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="textDiffWarningsDetail">-</strong>
        </div>
      </div>

      <div id="textDiffStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const leftInput = container.querySelector('#textDiffLeft');
  const rightInput = container.querySelector('#textDiffRight');
  const outputFormat = container.querySelector('#textDiffOutputFormat');
  const ignoreWhitespace = container.querySelector('#textDiffIgnoreWhitespace');
  const ignoreCase = container.querySelector('#textDiffIgnoreCase');
  const compareButton = container.querySelector('#compareTextButton');
  const clearButton = container.querySelector('#clearTextDiffButton');
  const copyButton = container.querySelector('#copyTextDiffButton');
  const downloadButton = container.querySelector('#downloadTextDiffButton');
  const preview = container.querySelector('#textDiffPreview');
  const output = container.querySelector('#textDiffOutput');
  const statusDetail = container.querySelector('#textDiffStatusDetail');
  const changesDetail = container.querySelector('#textDiffChangesDetail');
  const addedRemovedDetail = container.querySelector('#textDiffAddedRemovedDetail');
  const changedUnchangedDetail = container.querySelector('#textDiffChangedUnchangedDetail');
  const linesDetail = container.querySelector('#textDiffLinesDetail');
  const outputTypeDetail = container.querySelector('#textDiffOutputTypeDetail');
  const optionsDetail = container.querySelector('#textDiffOptionsDetail');
  const warningsDetail = container.querySelector('#textDiffWarningsDetail');
  const status = container.querySelector('#textDiffStatus');

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
    linesDetail.textContent = '-';
    outputTypeDetail.textContent = '-';
    optionsDetail.textContent = '-';
    warningsDetail.textContent = '-';
    preview.innerHTML = '';
  }

  function setDetails(result) {
    statusDetail.textContent = result.equal ? 'Identical' : 'Different';
    changesDetail.textContent = result.summary.totalChanges.toLocaleString('en-GB');
    addedRemovedDetail.textContent = `${result.summary.added.toLocaleString('en-GB')} / ${result.summary.removed.toLocaleString('en-GB')}`;
    changedUnchangedDetail.textContent = `${result.summary.changed.toLocaleString('en-GB')} / ${result.summary.unchanged.toLocaleString('en-GB')}`;
    linesDetail.textContent = `${result.leftLineCount.toLocaleString('en-GB')} / ${result.rightLineCount.toLocaleString('en-GB')}`;
    outputTypeDetail.textContent = result.outputType;
    optionsDetail.textContent = formatOptions(result.options);
    warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    renderPreview(result);
    revokeObjectUrl();

    const extension = getOutputExtension(result.outputFormat);
    const mimeType = getOutputMimeType(result.outputFormat);
    const fileName = `text-diff.${extension}`;
    const blob = new Blob([result.output], { type: mimeType });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
  }

  function renderPreview(result) {
    preview.innerHTML = '';

    if (result.rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Both inputs are empty.';
      preview.append(empty);
      return;
    }

    result.previewRows.forEach(row => {
      preview.append(createPreviewRow(row));
    });

    if (result.previewTruncated) {
      const truncated = document.createElement('p');
      truncated.className = 'hint';
      truncated.textContent = 'Preview truncated; the full report is still available in the output.';
      preview.append(truncated);
    }
  }

  function createPreviewRow(row) {
    const item = document.createElement('div');
    item.className = `text-diff-row ${row.type}`;

    const leftNumber = document.createElement('span');
    leftNumber.className = 'text-diff-line-number';
    leftNumber.textContent = row.leftLineNumber || '';

    const rightNumber = document.createElement('span');
    rightNumber.className = 'text-diff-line-number';
    rightNumber.textContent = row.rightLineNumber || '';

    const marker = document.createElement('span');
    marker.className = 'text-diff-marker';
    marker.textContent = getRowMarker(row.type);

    const content = document.createElement('code');

    if (row.type === 'changed') {
      const oldValue = document.createElement('del');
      oldValue.textContent = row.leftText || '(empty line)';
      const newValue = document.createElement('ins');
      newValue.textContent = row.rightText || '(empty line)';
      content.append(oldValue, document.createTextNode(' '), newValue);
    } else {
      content.textContent = getRowText(row) || '(empty line)';
    }

    item.append(leftNumber, rightNumber, marker, content);
    return item;
  }

  function handleCompare() {
    const result = buildTextDiff({
      leftText: leftInput.value,
      rightText: rightInput.value,
      outputFormat: outputFormat.value,
      ignoreWhitespace: ignoreWhitespace.checked,
      ignoreCase: ignoreCase.checked
    });

    setOutput(result);
    setStatus(buildSuccessMessage(result), 'success');
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no text diff output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Text diff output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Text diff output selected and copied using the browser fallback.', 'success');
    }
  }

  compareButton.addEventListener('click', handleCompare);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    leftInput.value = '';
    rightInput.value = '';
    outputFormat.value = 'unified';
    ignoreWhitespace.checked = false;
    ignoreCase.checked = false;
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    leftInput.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(result) {
  const baseMessage = result.equal
    ? 'Text inputs are identical for the selected options.'
    : 'Text diff report created successfully.';

  if (result.warnings.length === 0) {
    return baseMessage;
  }

  return `${baseMessage} ${result.warnings[0]}`;
}

function formatOptions(options) {
  const enabled = [];

  if (options.ignoreWhitespace) {
    enabled.push('Whitespace');
  }

  if (options.ignoreCase) {
    enabled.push('Case');
  }

  return enabled.length === 0 ? 'Exact' : `Ignoring ${enabled.join(' + ')}`;
}

function getRowMarker(type) {
  if (type === 'added') {
    return '+';
  }

  if (type === 'removed') {
    return '-';
  }

  if (type === 'changed') {
    return '~';
  }

  return ' ';
}

function getRowText(row) {
  if (row.type === 'added') {
    return row.rightText;
  }

  return row.leftText;
}

function getOutputExtension(format) {
  if (format === 'json') {
    return 'json';
  }

  if (format === 'markdown') {
    return 'md';
  }

  return 'diff';
}

function getOutputMimeType(format) {
  if (format === 'json') {
    return 'application/json;charset=utf-8';
  }

  if (format === 'markdown') {
    return 'text/markdown;charset=utf-8';
  }

  return 'text/x-diff;charset=utf-8';
}
