import { buildLiquidFetchXml, formatFetchXml } from './power-pages.js';

export function renderFetchXmlLiquidBuilder(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="field-stack">
        <label for="fetchXmlInput">FetchXML input</label>
        <textarea id="fetchXmlInput" spellcheck="false" autocomplete="off" placeholder="<fetch><entity name=&quot;account&quot;><attribute name=&quot;name&quot;></attribute></entity></fetch>"></textarea>
        <p class="hint">Formats common FetchXML and can generate a Power Pages Liquid fetchxml block. All processing stays in this browser.</p>
      </div>

      <div class="form-grid form-grid--actions">
        <div class="field-stack">
          <label for="liquidVariableName">Liquid variable name</label>
          <input id="liquidVariableName" type="text" placeholder="powerPagesResults" />
        </div>

        <div class="button-row">
          <button id="formatFetchXmlButton" class="primary" type="button">Format FetchXML</button>
          <button id="buildLiquidButton" class="primary" type="button">Build Liquid</button>
          <button id="clearPowerPagesButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="output-toolbar">
        <label for="powerPagesOutput">Output</label>
        <div class="button-row">
          <button id="copyPowerPagesOutputButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadPowerPagesOutputButton" class="button secondary" href="#" download="power-pages-fetchxml.liquid" hidden>Download output</a>
        </div>
      </div>

      <textarea id="powerPagesOutput" spellcheck="false" readonly placeholder="Formatted FetchXML or Liquid output will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Root status</span>
          <strong id="fetchXmlRootStatus">-</strong>
        </div>
        <div class="detail-card">
          <span>Tag count</span>
          <strong id="fetchXmlTagCount">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="fetchXmlWarnings">-</strong>
        </div>
        <div class="detail-card">
          <span>Output type</span>
          <strong id="powerPagesOutputType">-</strong>
        </div>
      </div>

      <div id="powerPagesStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const fetchXmlInput = container.querySelector('#fetchXmlInput');
  const liquidVariableName = container.querySelector('#liquidVariableName');
  const formatButton = container.querySelector('#formatFetchXmlButton');
  const buildLiquidButton = container.querySelector('#buildLiquidButton');
  const clearButton = container.querySelector('#clearPowerPagesButton');
  const copyButton = container.querySelector('#copyPowerPagesOutputButton');
  const downloadButton = container.querySelector('#downloadPowerPagesOutputButton');
  const output = container.querySelector('#powerPagesOutput');
  const rootStatus = container.querySelector('#fetchXmlRootStatus');
  const tagCount = container.querySelector('#fetchXmlTagCount');
  const warnings = container.querySelector('#fetchXmlWarnings');
  const outputType = container.querySelector('#powerPagesOutputType');
  const status = container.querySelector('#powerPagesStatus');

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
    rootStatus.textContent = '-';
    tagCount.textContent = '-';
    warnings.textContent = '-';
    outputType.textContent = '-';
  }

  function setDetails(analysis, type) {
    rootStatus.textContent = analysis.rootName === 'fetch' ? 'Valid <fetch> root' : '-';
    tagCount.textContent = analysis.tagCount.toLocaleString('en-GB');
    warnings.textContent = analysis.warnings.length === 0 ? 'None' : `${analysis.warnings.length} warning${analysis.warnings.length === 1 ? '' : 's'}`;
    outputType.textContent = type;
  }

  function setOutput(value, type, analysis) {
    output.value = value;
    copyButton.disabled = false;
    setDetails(analysis, type);
    revokeObjectUrl();

    const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = type === 'Liquid' ? 'power-pages-fetchxml.liquid' : 'formatted-fetchxml.xml';
    downloadButton.textContent = `Download ${downloadButton.download}`;
    downloadButton.hidden = false;
  }

  function handleFormat() {
    try {
      const result = formatFetchXml(fetchXmlInput.value);
      setOutput(result.formatted, 'Formatted FetchXML', result.analysis);
      setStatus(buildSuccessMessage('FetchXML formatted successfully.', result.analysis), 'success');
    } catch (error) {
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to format this FetchXML.', 'error');
    }
  }

  function handleBuildLiquid() {
    try {
      const result = buildLiquidFetchXml(fetchXmlInput.value, liquidVariableName.value);
      liquidVariableName.value = result.variableName;
      setOutput(result.liquid, 'Liquid', result.analysis);
      setStatus(buildSuccessMessage(`Liquid fetchxml block built as ${result.variableName}.`, result.analysis), 'success');
    } catch (error) {
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to build this Liquid block.', 'error');
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

  formatButton.addEventListener('click', handleFormat);
  buildLiquidButton.addEventListener('click', handleBuildLiquid);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    fetchXmlInput.value = '';
    liquidVariableName.value = '';
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    fetchXmlInput.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(message, analysis) {
  if (analysis.warnings.length === 0) {
    return message;
  }

  return `${message} ${analysis.warnings[0]}`;
}
