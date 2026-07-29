import { writeTextToClipboard } from './clipboard-feedback.js';
import {
  POWER_AUTOMATE_EMAIL_OUTPUT_SCOPES,
  POWER_AUTOMATE_EMAIL_TEMPLATES,
  buildPowerAutomateEmailTemplate
} from './power-automate-email-template.js';
import { bindSyntaxHighlight } from './syntax-highlight.js';

export function renderPowerAutomateEmailTemplateBuilder(container) {
  container.innerHTML = `
    <form class="tool-board power-automate-email-tool" data-tool-form>
      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="flowEmailTemplate">Template</label>
          <select id="flowEmailTemplate">
            ${POWER_AUTOMATE_EMAIL_TEMPLATES.map(template => `<option value="${template.id}">${template.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="flowEmailOutputScope">Output scope</label>
          <select id="flowEmailOutputScope">
            ${POWER_AUTOMATE_EMAIL_OUTPUT_SCOPES.map(scope => `<option value="${scope.value}">${scope.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <label class="checkbox-row" for="flowEmailUseHeading">
        <input id="flowEmailUseHeading" type="checkbox" checked>
        <span>Use first line as heading</span>
      </label>

      <div class="field-stack">
        <label for="flowEmailInput">Email text</label>
        <textarea id="flowEmailInput" spellcheck="false" placeholder="Deployment complete&#10;The nightly job finished successfully.&#10;- Accounts updated&#10;- Contacts checked&#10;Owner: @{triggerOutputs()?['body/owner']}"></textarea>
      </div>

      <div class="button-row">
        <button id="generateFlowEmailButton" class="primary" type="button">Generate email HTML</button>
        <button id="clearFlowEmailButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="field-stack">
        <label for="flowEmailPreviewFrame">Email preview</label>
        <iframe id="flowEmailPreviewFrame" class="email-template-preview-frame" title="Email preview" sandbox=""></iframe>
      </div>

      <div class="output-toolbar">
        <label for="flowEmailOutput">Generated HTML</label>
        <div class="button-row">
          <button id="copyFlowEmailButton" class="primary" type="button" disabled>Copy HTML</button>
          <a id="downloadFlowEmailButton" class="button secondary" href="#" download="power-automate-email-body.html" hidden>Download HTML</a>
        </div>
      </div>

      <textarea id="flowEmailOutput" spellcheck="false" readonly placeholder="The Outlook-friendly HTML will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Template</span>
          <strong id="flowEmailTemplateDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Paragraphs</span>
          <strong id="flowEmailParagraphsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Lists</span>
          <strong id="flowEmailListsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Detected tokens</span>
          <strong id="flowEmailTokensDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="flowEmailOutputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="flowEmailWarningsDetail">-</strong>
        </div>
      </div>

      <div id="flowEmailStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const templateSelect = container.querySelector('#flowEmailTemplate');
  const outputScopeSelect = container.querySelector('#flowEmailOutputScope');
  const useHeading = container.querySelector('#flowEmailUseHeading');
  const input = container.querySelector('#flowEmailInput');
  const previewFrame = container.querySelector('#flowEmailPreviewFrame');
  const output = container.querySelector('#flowEmailOutput');
  const generateButton = container.querySelector('#generateFlowEmailButton');
  const clearButton = container.querySelector('#clearFlowEmailButton');
  const copyButton = container.querySelector('#copyFlowEmailButton');
  const downloadButton = container.querySelector('#downloadFlowEmailButton');
  const details = {
    template: container.querySelector('#flowEmailTemplateDetail'),
    paragraphs: container.querySelector('#flowEmailParagraphsDetail'),
    lists: container.querySelector('#flowEmailListsDetail'),
    tokens: container.querySelector('#flowEmailTokensDetail'),
    outputSize: container.querySelector('#flowEmailOutputSizeDetail'),
    warnings: container.querySelector('#flowEmailWarningsDetail')
  };
  const status = container.querySelector('#flowEmailStatus');
  const outputHighlight = bindSyntaxHighlight(output, { language: 'xml' });

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
  }

  function setInvalidDetails() {
    resetDetails();
    details.template.textContent = 'Invalid';
  }

  function setDetails(result) {
    details.template.textContent = result.template.label;
    details.paragraphs.textContent = result.paragraphCount.toLocaleString('en-GB');
    details.lists.textContent = result.listCount.toLocaleString('en-GB');
    details.tokens.textContent = result.tokenCount.toLocaleString('en-GB');
    details.outputSize.textContent = result.outputSizeLabel;
    details.warnings.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function setOutput(result) {
    output.value = result.html;
    previewFrame.srcdoc = result.previewHtml;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const fileName = result.outputScope === 'document'
      ? 'power-automate-email.html'
      : 'power-automate-email-body.html';
    const blob = new Blob([result.html], { type: 'text/html;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
  }

  function generateEmailHtml() {
    try {
      const result = buildPowerAutomateEmailTemplate({
        input: input.value,
        templateId: templateSelect.value,
        useFirstLineAsHeading: useHeading.checked,
        outputScope: outputScopeSelect.value
      });

      setOutput(result);
      setStatus(buildSuccessMessage(result), 'success');
    } catch (error) {
      output.value = '';
      previewFrame.removeAttribute('srcdoc');
      copyButton.disabled = true;
      revokeObjectUrl();
      setInvalidDetails();
      setStatus(error.message || 'Unable to generate email HTML.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no generated HTML to copy.', 'error');
      return;
    }

    try {
      await writeTextToClipboard(output.value);
      setStatus('Generated HTML copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Generated HTML selected and copied using the browser fallback.', 'success');
    }
  }

  generateButton.addEventListener('click', generateEmailHtml);
  copyButton.addEventListener('click', copyOutput);
  clearButton.addEventListener('click', () => {
    templateSelect.value = POWER_AUTOMATE_EMAIL_TEMPLATES[0].id;
    outputScopeSelect.value = POWER_AUTOMATE_EMAIL_OUTPUT_SCOPES[0].value;
    useHeading.checked = true;
    input.value = '';
    output.value = '';
    previewFrame.removeAttribute('srcdoc');
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    input.focus();
  });

  return () => {
    outputHighlight.destroy();
    revokeObjectUrl();
  };
}

function buildSuccessMessage(result) {
  const message = 'Email HTML generated successfully.';

  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
