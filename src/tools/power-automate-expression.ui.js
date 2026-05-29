import { formatPowerAutomateExpression } from './power-automate-expression.js';

export function renderPowerAutomateExpressionFormatter(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="field-stack">
        <label for="flowExpressionInput">Expression input</label>
        <textarea id="flowExpressionInput" spellcheck="false" placeholder="@{concat(triggerOutputs()?['body/name'], ' - ', variables('suffix'))}"></textarea>
      </div>

      <div class="button-row">
        <button id="formatFlowExpressionButton" class="primary" type="button">Format expression</button>
        <button id="clearFlowExpressionButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="field-stack">
        <label for="flowExpressionPreview">Expression preview</label>
        <div id="flowExpressionPreview" class="builder-preview" aria-live="polite"></div>
      </div>

      <div class="output-toolbar">
        <label for="flowExpressionOutput">Output</label>
        <div class="button-row">
          <button id="copyFlowExpressionButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadFlowExpressionButton" class="button secondary" href="#" download="power-automate-expression.txt" hidden>Download output</a>
        </div>
      </div>

      <textarea id="flowExpressionOutput" spellcheck="false" readonly placeholder="The formatted Power Automate expression will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Wrapper</span>
          <strong id="flowExpressionWrapperDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Functions</span>
          <strong id="flowExpressionFunctionsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>References</span>
          <strong id="flowExpressionReferencesDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Unknown functions</span>
          <strong id="flowExpressionUnknownDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="flowExpressionOutputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="flowExpressionWarningsDetail">-</strong>
        </div>
      </div>

      <div id="flowExpressionStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const input = container.querySelector('#flowExpressionInput');
  const preview = container.querySelector('#flowExpressionPreview');
  const output = container.querySelector('#flowExpressionOutput');
  const formatButton = container.querySelector('#formatFlowExpressionButton');
  const clearButton = container.querySelector('#clearFlowExpressionButton');
  const copyButton = container.querySelector('#copyFlowExpressionButton');
  const downloadButton = container.querySelector('#downloadFlowExpressionButton');
  const details = {
    wrapper: container.querySelector('#flowExpressionWrapperDetail'),
    functions: container.querySelector('#flowExpressionFunctionsDetail'),
    references: container.querySelector('#flowExpressionReferencesDetail'),
    unknown: container.querySelector('#flowExpressionUnknownDetail'),
    outputSize: container.querySelector('#flowExpressionOutputSizeDetail'),
    warnings: container.querySelector('#flowExpressionWarningsDetail')
  };
  const status = container.querySelector('#flowExpressionStatus');

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
    details.wrapper.textContent = result.wrapperType;
    details.functions.textContent = result.summary.functionCount.toLocaleString('en-GB');
    details.references.textContent = result.summary.referenceCount.toLocaleString('en-GB');
    details.unknown.textContent = result.summary.unknownFunctionCount.toLocaleString('en-GB');
    details.outputSize.textContent = result.outputSizeLabel;
    details.warnings.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function renderPreview(result) {
    preview.innerHTML = '';

    [
      ['Formatted expression', result.formatted],
      ['Functions', result.functions.join(', ') || 'None'],
      ['References', result.references.join(', ') || 'None']
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
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    renderPreview(result);
    revokeObjectUrl();

    const blob = new Blob([result.output], { type: 'text/plain;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = 'power-automate-expression.txt';
    downloadButton.textContent = 'Download power-automate-expression.txt';
    downloadButton.hidden = false;
  }

  function formatExpression() {
    try {
      const result = formatPowerAutomateExpression({ input: input.value });
      setOutput(result);
      setStatus(buildSuccessMessage(result), 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      details.wrapper.textContent = 'Invalid';
      setStatus(error.message || 'Unable to format this Power Automate expression.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no formatted expression to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Formatted expression copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Formatted expression selected and copied using the browser fallback.', 'success');
    }
  }

  formatButton.addEventListener('click', formatExpression);
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

function buildSuccessMessage(result) {
  const message = 'Power Automate expression formatted successfully.';

  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
