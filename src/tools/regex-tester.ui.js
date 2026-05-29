import { REGEX_OUTPUT_FORMATS, processRegexTest } from './regex-tester.js';

export function renderRegexTester(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="regexPattern">Pattern</label>
          <input id="regexPattern" type="text" spellcheck="false" placeholder="(?<name>[A-Z][a-z]+)\\s+(?<email>[^\\s]+@[^\\s]+)" />
        </div>

        <div class="field-stack">
          <label for="regexFlags">Flags</label>
          <input id="regexFlags" type="text" spellcheck="false" placeholder="gim" />
        </div>

        <div class="field-stack">
          <label for="regexOutputFormat">Output format</label>
          <select id="regexOutputFormat">
            ${REGEX_OUTPUT_FORMATS.map(format => `<option value="${format.value}">${format.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="button-row">
        <button id="runRegexButton" class="primary" type="button">Run test</button>
        <button id="clearRegexButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="field-stack">
        <label for="regexText">Test text</label>
        <textarea id="regexText" spellcheck="false" placeholder="Ada ada@example.test&#10;Grace grace@example.test"></textarea>
      </div>

      <div class="field-stack">
        <label for="regexPreview">Highlighted text</label>
        <pre id="regexPreview" class="regex-preview" aria-live="polite"></pre>
      </div>

      <div id="regexMatchList" class="regex-match-list" aria-live="polite"></div>

      <div class="output-toolbar">
        <label for="regexOutput">Output</label>
        <div class="button-row">
          <button id="copyRegexButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadRegexButton" class="button secondary" href="#" download="regex-report.json" hidden>Download output</a>
        </div>
      </div>

      <textarea id="regexOutput" spellcheck="false" readonly placeholder="The regex report will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Pattern status</span>
          <strong id="regexStatusDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Flags</span>
          <strong id="regexFlagsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Matches</span>
          <strong id="regexMatchCountDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Groups</span>
          <strong id="regexGroupCountDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Named groups</span>
          <strong id="regexNamedGroupCountDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output type</span>
          <strong id="regexOutputTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="regexOutputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="regexWarningsDetail">-</strong>
        </div>
      </div>

      <div id="regexStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const pattern = container.querySelector('#regexPattern');
  const flags = container.querySelector('#regexFlags');
  const outputFormat = container.querySelector('#regexOutputFormat');
  const text = container.querySelector('#regexText');
  const preview = container.querySelector('#regexPreview');
  const matchList = container.querySelector('#regexMatchList');
  const runButton = container.querySelector('#runRegexButton');
  const clearButton = container.querySelector('#clearRegexButton');
  const copyButton = container.querySelector('#copyRegexButton');
  const downloadButton = container.querySelector('#downloadRegexButton');
  const output = container.querySelector('#regexOutput');
  const statusDetail = container.querySelector('#regexStatusDetail');
  const flagsDetail = container.querySelector('#regexFlagsDetail');
  const matchCountDetail = container.querySelector('#regexMatchCountDetail');
  const groupCountDetail = container.querySelector('#regexGroupCountDetail');
  const namedGroupCountDetail = container.querySelector('#regexNamedGroupCountDetail');
  const outputTypeDetail = container.querySelector('#regexOutputTypeDetail');
  const outputSizeDetail = container.querySelector('#regexOutputSizeDetail');
  const warningsDetail = container.querySelector('#regexWarningsDetail');
  const status = container.querySelector('#regexStatus');

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
    flagsDetail.textContent = '-';
    matchCountDetail.textContent = '-';
    groupCountDetail.textContent = '-';
    namedGroupCountDetail.textContent = '-';
    outputTypeDetail.textContent = '-';
    outputSizeDetail.textContent = '-';
    warningsDetail.textContent = '-';
    preview.textContent = '';
    matchList.innerHTML = '';
  }

  function setDetails(result) {
    statusDetail.textContent = 'Valid';
    flagsDetail.textContent = result.flags || '(none)';
    matchCountDetail.textContent = result.matchCount.toLocaleString('en-GB');
    groupCountDetail.textContent = result.groupsCount.toLocaleString('en-GB');
    namedGroupCountDetail.textContent = result.namedGroupsCount.toLocaleString('en-GB');
    outputTypeDetail.textContent = result.outputType;
    outputSizeDetail.textContent = result.outputSizeLabel;
    warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function setInvalidDetails() {
    statusDetail.textContent = 'Invalid';
    flagsDetail.textContent = '-';
    matchCountDetail.textContent = '-';
    groupCountDetail.textContent = '-';
    namedGroupCountDetail.textContent = '-';
    outputTypeDetail.textContent = '-';
    outputSizeDetail.textContent = '-';
    warningsDetail.textContent = '-';
    preview.textContent = '';
    matchList.innerHTML = '';
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    renderPreview(result);
    renderMatches(result.matches);
    revokeObjectUrl();

    const isJson = result.outputFormat === 'json';
    const blob = new Blob([result.output], {
      type: isJson ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8'
    });
    const fileName = isJson ? 'regex-report.json' : 'regex-report.md';
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
  }

  function renderPreview(result) {
    preview.innerHTML = '';

    result.segments.forEach(segment => {
      const node = document.createElement(segment.type === 'match' ? 'mark' : 'span');
      node.textContent = segment.value;

      if (segment.type === 'match') {
        node.className = 'regex-highlight';
        node.title = `Match ${segment.index}`;
      }

      preview.append(node);
    });
  }

  function renderMatches(matches) {
    matchList.innerHTML = '';

    if (matches.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'No matches to list.';
      matchList.append(empty);
      return;
    }

    matches.forEach(match => {
      const card = document.createElement('article');
      card.className = 'regex-match-card';

      const groups = match.groups
        .filter(group => group.matched)
        .map(group => `Group ${group.index}: ${group.value}`)
        .join(' | ');
      const namedGroups = match.namedGroups
        .filter(group => group.matched)
        .map(group => `${group.name}: ${group.value}`)
        .join(' | ');

      card.innerHTML = `
        <strong>Match ${match.matchNumber}</strong>
        <code></code>
        <span>Index ${match.index}, line ${match.line}, column ${match.column}</span>
        ${groups ? `<span>${escapeHtml(groups)}</span>` : ''}
        ${namedGroups ? `<span>Named: ${escapeHtml(namedGroups)}</span>` : ''}
      `;
      card.querySelector('code').textContent = match.value || '(zero-length match)';
      matchList.append(card);
    });
  }

  function handleRun() {
    try {
      const result = processRegexTest({
        pattern: pattern.value,
        flags: flags.value,
        text: text.value,
        outputFormat: outputFormat.value
      });

      setOutput(result);
      setStatus(buildSuccessMessage('Regex test completed successfully.', result), 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      setInvalidDetails();
      setStatus(error.message || 'Unable to run this regular expression.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no regex output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Regex output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Regex output selected and copied using the browser fallback.', 'success');
    }
  }

  runButton.addEventListener('click', handleRun);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    pattern.value = '';
    flags.value = '';
    outputFormat.value = 'json';
    text.value = '';
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    pattern.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(message, result) {
  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
