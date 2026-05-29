import { HTML_OUTPUT_FORMATS, processHtmlContent } from './html-cleaner.js';

export function renderHtmlCleaner(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--actions">
        <div class="field-stack">
          <label for="htmlCleanerOutputFormat">Output format</label>
          <select id="htmlCleanerOutputFormat">
            ${HTML_OUTPUT_FORMATS.map(format => `<option value="${format.value}">${format.label}</option>`).join('')}
          </select>
        </div>

        <div class="button-row button-row--end">
          <button id="convertHtmlButton" class="primary" type="button">Convert HTML</button>
          <button id="clearHtmlButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="field-stack">
        <label for="htmlCleanerInput">HTML input</label>
        <textarea id="htmlCleanerInput" spellcheck="false" placeholder="&lt;article&gt;&#10;  &lt;h1&gt;Release notes&lt;/h1&gt;&#10;  &lt;p&gt;Read the &lt;a href=&quot;https://example.test&quot;&gt;guide&lt;/a&gt;.&lt;/p&gt;&#10;&lt;/article&gt;"></textarea>
      </div>

      <div class="output-toolbar">
        <label for="htmlCleanerOutput">Output</label>
        <div class="button-row">
          <button id="copyHtmlButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadHtmlButton" class="button secondary" href="#" download="html-cleaner.txt" hidden>Download output</a>
        </div>
      </div>

      <textarea id="htmlCleanerOutput" spellcheck="false" readonly placeholder="The cleaned text or Markdown output will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Output type</span>
          <strong id="htmlOutputTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Input size</span>
          <strong id="htmlInputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="htmlOutputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Elements</span>
          <strong id="htmlElementCountDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>References</span>
          <strong id="htmlReferenceCountDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="htmlWarningsDetail">-</strong>
        </div>
      </div>

      <div id="htmlCleanerStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const input = container.querySelector('#htmlCleanerInput');
  const outputFormat = container.querySelector('#htmlCleanerOutputFormat');
  const convertButton = container.querySelector('#convertHtmlButton');
  const clearButton = container.querySelector('#clearHtmlButton');
  const copyButton = container.querySelector('#copyHtmlButton');
  const downloadButton = container.querySelector('#downloadHtmlButton');
  const output = container.querySelector('#htmlCleanerOutput');
  const outputTypeDetail = container.querySelector('#htmlOutputTypeDetail');
  const inputSizeDetail = container.querySelector('#htmlInputSizeDetail');
  const outputSizeDetail = container.querySelector('#htmlOutputSizeDetail');
  const elementCountDetail = container.querySelector('#htmlElementCountDetail');
  const referenceCountDetail = container.querySelector('#htmlReferenceCountDetail');
  const warningsDetail = container.querySelector('#htmlWarningsDetail');
  const status = container.querySelector('#htmlCleanerStatus');

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
    outputTypeDetail.textContent = '-';
    inputSizeDetail.textContent = '-';
    outputSizeDetail.textContent = '-';
    elementCountDetail.textContent = '-';
    referenceCountDetail.textContent = '-';
    warningsDetail.textContent = '-';
  }

  function setInvalidDetails() {
    resetDetails();
    outputTypeDetail.textContent = 'Invalid';
  }

  function setDetails(result) {
    outputTypeDetail.textContent = result.outputType;
    inputSizeDetail.textContent = result.inputSizeLabel;
    outputSizeDetail.textContent = result.outputSizeLabel;
    elementCountDetail.textContent = result.elementCount.toLocaleString('en-GB');
    referenceCountDetail.textContent = result.referenceCount.toLocaleString('en-GB');
    warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const isMarkdown = result.outputFormat === 'markdown';
    const fileName = isMarkdown ? 'html-cleaner.md' : 'html-cleaner.txt';
    const blob = new Blob([result.output], {
      type: isMarkdown ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
  }

  function handleConvert() {
    try {
      const result = processHtmlContent({
        input: input.value,
        outputFormat: outputFormat.value
      });

      setOutput(result);
      setStatus(buildSuccessMessage(result), 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      setInvalidDetails();
      setStatus(error.message || 'Unable to convert this HTML.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no HTML output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('HTML output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('HTML output selected and copied using the browser fallback.', 'success');
    }
  }

  convertButton.addEventListener('click', handleConvert);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    input.value = '';
    outputFormat.value = 'plain-text';
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    input.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(result) {
  const message = `${result.outputType} created successfully.`;

  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
