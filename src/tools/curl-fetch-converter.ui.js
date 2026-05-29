import { CURL_FETCH_MODES, convertCurlFetch } from './curl-fetch-converter.js';

export function renderCurlFetchConverter(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="curlFetchMode">Conversion mode</label>
          <select id="curlFetchMode">
            ${CURL_FETCH_MODES.map(mode => `<option value="${mode.value}">${mode.label}</option>`).join('')}
          </select>
        </div>

        <div class="button-row button-row--end">
          <button id="convertCurlFetchButton" class="primary" type="button">Convert request</button>
          <button id="clearCurlFetchButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="field-stack">
        <label for="curlFetchInput">Request input</label>
        <textarea id="curlFetchInput" spellcheck="false" placeholder="curl -X POST https://api.example.test/items -H 'Content-Type: application/json' --data-raw '{&quot;name&quot;:&quot;Contoso&quot;}'"></textarea>
      </div>

      <div class="field-stack">
        <label for="curlFetchPreview">Request preview</label>
        <div id="curlFetchPreview" class="curl-fetch-preview" aria-live="polite"></div>
      </div>

      <div class="output-toolbar">
        <label for="curlFetchOutput">Output</label>
        <div class="button-row">
          <button id="copyCurlFetchButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadCurlFetchButton" class="button secondary" href="#" download="request-conversion.txt" hidden>Download output</a>
        </div>
      </div>

      <textarea id="curlFetchOutput" spellcheck="false" readonly placeholder="The converted request will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Mode</span>
          <strong id="curlFetchModeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Method</span>
          <strong id="curlFetchMethodDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>URL</span>
          <strong id="curlFetchUrlDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Headers</span>
          <strong id="curlFetchHeadersDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Body</span>
          <strong id="curlFetchBodyDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output type</span>
          <strong id="curlFetchOutputTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="curlFetchOutputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="curlFetchWarningsDetail">-</strong>
        </div>
      </div>

      <div id="curlFetchStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const mode = container.querySelector('#curlFetchMode');
  const input = container.querySelector('#curlFetchInput');
  const preview = container.querySelector('#curlFetchPreview');
  const convertButton = container.querySelector('#convertCurlFetchButton');
  const clearButton = container.querySelector('#clearCurlFetchButton');
  const copyButton = container.querySelector('#copyCurlFetchButton');
  const downloadButton = container.querySelector('#downloadCurlFetchButton');
  const output = container.querySelector('#curlFetchOutput');
  const modeDetail = container.querySelector('#curlFetchModeDetail');
  const methodDetail = container.querySelector('#curlFetchMethodDetail');
  const urlDetail = container.querySelector('#curlFetchUrlDetail');
  const headersDetail = container.querySelector('#curlFetchHeadersDetail');
  const bodyDetail = container.querySelector('#curlFetchBodyDetail');
  const outputTypeDetail = container.querySelector('#curlFetchOutputTypeDetail');
  const outputSizeDetail = container.querySelector('#curlFetchOutputSizeDetail');
  const warningsDetail = container.querySelector('#curlFetchWarningsDetail');
  const status = container.querySelector('#curlFetchStatus');

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
    methodDetail.textContent = '-';
    urlDetail.textContent = '-';
    headersDetail.textContent = '-';
    bodyDetail.textContent = '-';
    outputTypeDetail.textContent = '-';
    outputSizeDetail.textContent = '-';
    warningsDetail.textContent = '-';
    preview.innerHTML = '';
  }

  function setDetails(result) {
    modeDetail.textContent = result.modeLabel;
    methodDetail.textContent = result.request.method || '-';
    urlDetail.textContent = result.request.url || '-';
    headersDetail.textContent = result.request.headers.length.toLocaleString('en-GB');
    bodyDetail.textContent = result.request.body ? 'Present' : 'None';
    outputTypeDetail.textContent = result.outputType;
    outputSizeDetail.textContent = result.outputSizeLabel;
    warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    renderPreview(result);
    revokeObjectUrl();

    const isFetch = result.outputType.includes('fetch');
    const fileName = isFetch ? 'request.fetch.js' : 'request.curl.sh';
    const blob = new Blob([result.output], {
      type: isFetch ? 'text/javascript;charset=utf-8' : 'text/x-shellscript;charset=utf-8'
    });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
  }

  function renderPreview(result) {
    preview.innerHTML = '';

    const rows = [
      ['Direction', result.direction],
      ['Method', result.request.method || '-'],
      ['URL', result.request.url || '-'],
      ['Headers', result.request.headers.map(header => `${header.name}: ${header.value}`).join('\n') || 'None'],
      ['Body', result.request.body || 'None']
    ];

    rows.forEach(([label, value]) => {
      const card = document.createElement('article');
      card.className = 'curl-fetch-card';

      const title = document.createElement('span');
      title.textContent = label;

      const content = document.createElement('code');
      content.textContent = value;

      card.append(title, content);
      preview.append(card);
    });
  }

  function handleConvert() {
    try {
      const result = convertCurlFetch({
        mode: mode.value,
        input: input.value
      });

      setOutput(result);
      setStatus(buildSuccessMessage('Request converted successfully.', result), result.warnings.length === 0 ? 'success' : 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      modeDetail.textContent = 'Invalid';
      setStatus(error.message || 'Unable to convert this request.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no converted request to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Converted request copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Converted request selected and copied using the browser fallback.', 'success');
    }
  }

  convertButton.addEventListener('click', handleConvert);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    mode.value = 'curl-to-fetch';
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
