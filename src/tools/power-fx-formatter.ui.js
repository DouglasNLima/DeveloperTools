import { formatPowerFxSnippet } from './power-fx-formatter.js';
import { bindSyntaxHighlight } from './syntax-highlight.js';

export function renderPowerFxSnippetFormatter(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="field-stack">
        <label for="powerFxInput">Formula input</label>
        <textarea id="powerFxInput" spellcheck="false" placeholder="If(IsBlank(TextInput1.Text), Notify(&quot;Missing&quot;), Patch(Accounts, Defaults(Accounts), { Name: TextInput1.Text }))"></textarea>
      </div>

      <div class="button-row">
        <button id="formatPowerFxButton" class="primary" type="button">Format formula</button>
        <button id="clearPowerFxButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="field-stack">
        <label for="powerFxPreview">Formula preview</label>
        <div id="powerFxPreview" class="builder-preview" aria-live="polite"></div>
      </div>

      <div class="output-toolbar">
        <label for="powerFxOutput">Output</label>
        <div class="button-row">
          <button id="copyPowerFxButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadPowerFxButton" class="button secondary" href="#" download="power-fx-formula.txt" hidden>Download output</a>
        </div>
      </div>

      <textarea id="powerFxOutput" spellcheck="false" readonly placeholder="The formatted Power Fx formula will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Functions</span>
          <strong id="powerFxFunctionsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Lines</span>
          <strong id="powerFxLinesDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Unknown functions</span>
          <strong id="powerFxUnknownDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output type</span>
          <strong id="powerFxOutputTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="powerFxOutputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="powerFxWarningsDetail">-</strong>
        </div>
      </div>

      <div id="powerFxStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const input = container.querySelector('#powerFxInput');
  const preview = container.querySelector('#powerFxPreview');
  const output = container.querySelector('#powerFxOutput');
  const formatButton = container.querySelector('#formatPowerFxButton');
  const clearButton = container.querySelector('#clearPowerFxButton');
  const copyButton = container.querySelector('#copyPowerFxButton');
  const downloadButton = container.querySelector('#downloadPowerFxButton');
  const details = {
    functions: container.querySelector('#powerFxFunctionsDetail'),
    lines: container.querySelector('#powerFxLinesDetail'),
    unknown: container.querySelector('#powerFxUnknownDetail'),
    outputType: container.querySelector('#powerFxOutputTypeDetail'),
    outputSize: container.querySelector('#powerFxOutputSizeDetail'),
    warnings: container.querySelector('#powerFxWarningsDetail')
  };
  const status = container.querySelector('#powerFxStatus');
  const inputHighlight = bindSyntaxHighlight(input, { language: 'expression' });
  const outputHighlight = bindSyntaxHighlight(output, { language: 'expression' });

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
    Object.values(details).forEach(element => {
      element.textContent = '-';
    });
    preview.innerHTML = '';
  }

  function setDetails(result) {
    details.functions.textContent = result.summary.functionCount.toLocaleString('en-GB');
    details.lines.textContent = result.summary.lineCount.toLocaleString('en-GB');
    details.unknown.textContent = result.summary.unknownFunctionCount.toLocaleString('en-GB');
    details.outputType.textContent = result.outputType;
    details.outputSize.textContent = result.outputSizeLabel;
    details.warnings.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function renderPreview(result) {
    preview.innerHTML = '';

    [
      ['Formatted formula', result.formatted],
      ['Functions', result.functions.join(', ') || 'None'],
      ['Warnings', result.warnings.join('\n') || 'None']
    ].forEach(([label, value]) => {
      const card = document.createElement('article');
      card.className = 'builder-card';
      const title = document.createElement('span');
      title.textContent = label;
      const content = document.createElement('code');
      content.textContent = value;
      card.append(title, content);
      preview.append(card);
    });
  }

  function setOutput(result) {
    outputHighlight.setLanguage('expression');
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    renderPreview(result);
    revokeObjectUrl();

    const blob = new Blob([result.output], { type: 'text/plain;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = 'power-fx-formula.txt';
    downloadButton.textContent = 'Download power-fx-formula.txt';
    downloadButton.hidden = false;
  }

  function formatFormula() {
    try {
      const result = formatPowerFxSnippet({ input: input.value });
      setOutput(result);
      setStatus(buildSuccessMessage(result), 'success');
    } catch (error) {
      outputHighlight.setLanguage('plain');
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      details.outputType.textContent = 'Invalid';
      setStatus(error.message || 'Unable to format this Power Fx formula.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no formatted formula to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Formatted formula copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Formatted formula selected and copied using the browser fallback.', 'success');
    }
  }

  formatButton.addEventListener('click', formatFormula);
  copyButton.addEventListener('click', copyOutput);
  clearButton.addEventListener('click', () => {
    input.value = '';
    outputHighlight.setLanguage('expression');
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

function buildSuccessMessage(result) {
  const message = 'Power Fx formula formatted successfully.';

  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
