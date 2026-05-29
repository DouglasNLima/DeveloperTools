import { sanitiseSupportPack } from './support-pack-sanitiser.js';

export function renderSupportPackSanitiser(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="field-stack">
        <label for="supportPackInput">Support pack input</label>
        <textarea id="supportPackInput" spellcheck="false" placeholder="Paste logs, JSON, payloads, config snippets or stack traces here."></textarea>
      </div>

      <div class="button-row">
        <button id="sanitiseSupportPackButton" class="primary" type="button">Sanitise support pack</button>
        <button id="clearSupportPackButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="output-toolbar">
        <label for="supportPackOutput">Sanitised output</label>
        <div class="button-row">
          <button id="copySupportPackButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadSupportPackButton" class="button secondary" href="#" download="sanitised-support-pack.md" hidden>Download output</a>
        </div>
      </div>

      <textarea id="supportPackOutput" spellcheck="false" readonly placeholder="The sanitised support pack will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Sanitiser status</span>
          <strong id="supportPackStatusDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Sensitive values</span>
          <strong id="supportPackSensitiveDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Detection types</span>
          <strong id="supportPackTypesDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="supportPackSizeDetail">-</strong>
        </div>
      </div>

      <div id="supportPackStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const input = container.querySelector('#supportPackInput');
  const output = container.querySelector('#supportPackOutput');
  const sanitiseButton = container.querySelector('#sanitiseSupportPackButton');
  const clearButton = container.querySelector('#clearSupportPackButton');
  const copyButton = container.querySelector('#copySupportPackButton');
  const downloadButton = container.querySelector('#downloadSupportPackButton');
  const statusDetail = container.querySelector('#supportPackStatusDetail');
  const sensitiveDetail = container.querySelector('#supportPackSensitiveDetail');
  const typesDetail = container.querySelector('#supportPackTypesDetail');
  const sizeDetail = container.querySelector('#supportPackSizeDetail');
  const status = container.querySelector('#supportPackStatus');

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
    sensitiveDetail.textContent = '-';
    typesDetail.textContent = '-';
    sizeDetail.textContent = '-';
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    statusDetail.textContent = 'Sanitised';
    sensitiveDetail.textContent = result.totalDetected.toLocaleString('en-GB');
    typesDetail.textContent = result.detectedValues.length === 0
      ? 'None'
      : result.detectedValues.length.toLocaleString('en-GB');
    sizeDetail.textContent = result.outputSizeLabel;
    revokeObjectUrl();

    const blob = new Blob([result.output], { type: 'text/markdown;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = 'sanitised-support-pack.md';
    downloadButton.textContent = 'Download sanitised-support-pack.md';
    downloadButton.hidden = false;
  }

  function handleSanitise() {
    try {
      const result = sanitiseSupportPack(input.value);

      setOutput(result);
      setStatus('Support pack sanitised successfully.', 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to sanitise this support pack.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no sanitised output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Sanitised output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Sanitised output selected and copied using the browser fallback.', 'success');
    }
  }

  sanitiseButton.addEventListener('click', handleSanitise);
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

  return () => revokeObjectUrl();
}
