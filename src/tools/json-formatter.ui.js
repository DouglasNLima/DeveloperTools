import { generateJsonShape, JSON_SCHEMA_OUTPUT_FORMATS, processJson } from './json-formatter.js';

export function renderJsonFormatter(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="jsonIndent">Indentation</label>
          <select id="jsonIndent">
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
          </select>
        </div>

        <div class="field-stack">
          <label for="jsonSchemaOutputFormat">Shape/schema output</label>
          <select id="jsonSchemaOutputFormat">
            ${JSON_SCHEMA_OUTPUT_FORMATS.map(format => `<option value="${format.value}">${format.label}</option>`).join('')}
          </select>
        </div>

        <div class="button-row button-row--end">
          <button id="formatJsonButton" class="primary" type="button">Format JSON</button>
          <button id="minifyJsonButton" class="secondary" type="button">Minify JSON</button>
          <button id="shapeJsonButton" class="secondary" type="button">Generate shape/schema</button>
          <button id="clearJsonButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <label class="checkbox-row" for="jsonSortKeys">
        <input id="jsonSortKeys" type="checkbox" />
        <span>Sort object keys</span>
      </label>

      <div class="field-stack">
        <label for="jsonInput">JSON input</label>
        <textarea id="jsonInput" spellcheck="false" placeholder='{"name":"Contoso","active":true}'></textarea>
      </div>

      <div class="output-toolbar">
        <label for="jsonOutput">Output</label>
        <div class="button-row">
          <button id="copyJsonButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadJsonButton" class="button secondary" href="#" download="formatted-json.json" hidden>Download output</a>
        </div>
      </div>

      <textarea id="jsonOutput" spellcheck="false" readonly placeholder="The processed JSON will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>JSON status</span>
          <strong id="jsonStatusDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="jsonSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Depth</span>
          <strong id="jsonDepthDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Objects / arrays</span>
          <strong id="jsonStructureDetail">-</strong>
        </div>
      </div>

      <div id="jsonStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const input = container.querySelector('#jsonInput');
  const indent = container.querySelector('#jsonIndent');
  const sortKeys = container.querySelector('#jsonSortKeys');
  const schemaOutputFormat = container.querySelector('#jsonSchemaOutputFormat');
  const formatButton = container.querySelector('#formatJsonButton');
  const minifyButton = container.querySelector('#minifyJsonButton');
  const shapeButton = container.querySelector('#shapeJsonButton');
  const clearButton = container.querySelector('#clearJsonButton');
  const copyButton = container.querySelector('#copyJsonButton');
  const downloadButton = container.querySelector('#downloadJsonButton');
  const output = container.querySelector('#jsonOutput');
  const statusDetail = container.querySelector('#jsonStatusDetail');
  const sizeDetail = container.querySelector('#jsonSizeDetail');
  const depthDetail = container.querySelector('#jsonDepthDetail');
  const structureDetail = container.querySelector('#jsonStructureDetail');
  const status = container.querySelector('#jsonStatus');

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
    sizeDetail.textContent = '-';
    depthDetail.textContent = '-';
    structureDetail.textContent = '-';
  }

  function setValidDetails(result) {
    statusDetail.textContent = 'Valid';
    sizeDetail.textContent = result.outputSizeLabel || result.stats.outputSizeLabel;
    const summary = result.shape?.summary || result.stats;
    depthDetail.textContent = summary.depth.toLocaleString('en-GB');
    structureDetail.textContent = `${summary.objectCount.toLocaleString('en-GB')} / ${summary.arrayCount.toLocaleString('en-GB')}`;
  }

  function setInvalidDetails() {
    statusDetail.textContent = 'Invalid';
    sizeDetail.textContent = '-';
    depthDetail.textContent = '-';
    structureDetail.textContent = '-';
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setValidDetails(result);
    revokeObjectUrl();

    const download = resolveJsonDownload(result);
    const blob = new Blob([result.output], { type: download.mimeType });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = download.fileName;
    downloadButton.textContent = `Download ${downloadButton.download}`;
    downloadButton.hidden = false;
  }

  function handleProcess(mode) {
    try {
      const result = processJson(input.value, {
        mode,
        indent: indent.value,
        sortKeys: sortKeys.checked
      });

      setOutput(result);
      setStatus(`${result.outputType} created successfully.`, 'success');
    } catch (error) {
      output.value = error.details?.snippet || '';
      copyButton.disabled = true;
      revokeObjectUrl();
      setInvalidDetails();
      setStatus(error.message || 'Unable to process this JSON.', 'error');
    }
  }

  function handleGenerateShape() {
    try {
      const result = generateJsonShape(input.value, {
        outputFormat: schemaOutputFormat.value
      });

      setOutput(result);
      setStatus(`${result.outputType} generated successfully.`, 'success');
    } catch (error) {
      output.value = error.details?.snippet || '';
      copyButton.disabled = true;
      revokeObjectUrl();
      setInvalidDetails();
      setStatus(error.message || 'Unable to generate this JSON shape.', 'error');
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

  formatButton.addEventListener('click', () => handleProcess('format'));
  minifyButton.addEventListener('click', () => handleProcess('minify'));
  shapeButton.addEventListener('click', handleGenerateShape);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    input.value = '';
    output.value = '';
    indent.value = '2';
    schemaOutputFormat.value = 'markdown';
    sortKeys.checked = false;
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    input.focus();
  });

  return () => revokeObjectUrl();
}

function resolveJsonDownload(result) {
  if (result.outputType === 'JSON Schema') {
    return {
      fileName: 'json-schema.json',
      mimeType: 'application/json;charset=utf-8'
    };
  }

  if (result.outputType === 'Markdown contract') {
    return {
      fileName: 'json-shape-contract.md',
      mimeType: 'text/markdown;charset=utf-8'
    };
  }

  return {
    fileName: result.mode === 'minify' ? 'minified-json.json' : 'formatted-json.json',
    mimeType: 'application/json;charset=utf-8'
  };
}
