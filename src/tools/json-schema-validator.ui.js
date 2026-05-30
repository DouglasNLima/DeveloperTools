import {
  JSON_SCHEMA_VALIDATOR_OUTPUT_FORMATS,
  validateJsonAgainstSchema
} from './json-schema-validator.js';
import { bindSyntaxHighlight } from './syntax-highlight.js';

export function renderJsonSchemaValidator(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="jsonSchemaValidatorOutputFormat">Output format</label>
          <select id="jsonSchemaValidatorOutputFormat">
            ${JSON_SCHEMA_VALIDATOR_OUTPUT_FORMATS.map(format => `<option value="${format.value}">${format.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="jsonSchemaValidatorMode">Reference support</label>
          <select id="jsonSchemaValidatorMode" disabled>
            <option>Local refs only</option>
          </select>
        </div>

        <div class="button-row button-row--end">
          <button id="validateJsonSchemaButton" class="primary" type="button">Validate JSON</button>
          <button id="clearJsonSchemaButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="jsonSchemaValidatorInput">JSON input</label>
          <textarea id="jsonSchemaValidatorInput" spellcheck="false" placeholder='{"name":"Contoso","active":true}'></textarea>
        </div>

        <div class="field-stack">
          <label for="jsonSchemaValidatorSchema">JSON Schema input</label>
          <textarea id="jsonSchemaValidatorSchema" spellcheck="false" placeholder='{"type":"object","required":["name"]}'></textarea>
        </div>
      </div>

      <div class="output-toolbar">
        <label for="jsonSchemaValidatorOutput">Output</label>
        <div class="button-row">
          <button id="copyJsonSchemaReportButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadJsonSchemaReportButton" class="button secondary" href="#" download="json-schema-validation.md" hidden>Download output</a>
        </div>
      </div>

      <textarea id="jsonSchemaValidatorOutput" spellcheck="false" readonly placeholder="The validation report will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Validation status</span>
          <strong id="jsonSchemaValidationStatusDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Error count</span>
          <strong id="jsonSchemaErrorCountDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warning count</span>
          <strong id="jsonSchemaWarningCountDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Schema draft</span>
          <strong id="jsonSchemaDraftDetail">-</strong>
        </div>
      </div>

      <div id="jsonSchemaValidatorStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const jsonInput = container.querySelector('#jsonSchemaValidatorInput');
  const schemaInput = container.querySelector('#jsonSchemaValidatorSchema');
  const outputFormat = container.querySelector('#jsonSchemaValidatorOutputFormat');
  const validateButton = container.querySelector('#validateJsonSchemaButton');
  const clearButton = container.querySelector('#clearJsonSchemaButton');
  const copyButton = container.querySelector('#copyJsonSchemaReportButton');
  const downloadButton = container.querySelector('#downloadJsonSchemaReportButton');
  const output = container.querySelector('#jsonSchemaValidatorOutput');
  const statusDetail = container.querySelector('#jsonSchemaValidationStatusDetail');
  const errorCountDetail = container.querySelector('#jsonSchemaErrorCountDetail');
  const warningCountDetail = container.querySelector('#jsonSchemaWarningCountDetail');
  const schemaDraftDetail = container.querySelector('#jsonSchemaDraftDetail');
  const status = container.querySelector('#jsonSchemaValidatorStatus');
  const jsonHighlight = bindSyntaxHighlight(jsonInput, { language: 'json' });
  const schemaHighlight = bindSyntaxHighlight(schemaInput, { language: 'json' });
  const outputHighlight = bindSyntaxHighlight(output, { language: 'markdown' });

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
    errorCountDetail.textContent = '-';
    warningCountDetail.textContent = '-';
    schemaDraftDetail.textContent = '-';
  }

  function setDetails(result) {
    statusDetail.textContent = result.valid ? 'Valid' : 'Invalid';
    errorCountDetail.textContent = result.summary.errorCount.toLocaleString('en-GB');
    warningCountDetail.textContent = result.summary.warningCount.toLocaleString('en-GB');
    schemaDraftDetail.textContent = result.schemaDraft;
  }

  function setOutput(result) {
    outputHighlight.setLanguage(result.outputFormat === 'json' ? 'json' : 'markdown');
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const extension = result.outputFormat === 'json' ? 'json' : 'md';
    const mimeType = result.outputFormat === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8';
    const blob = new Blob([result.output], { type: mimeType });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = `json-schema-validation.${extension}`;
    downloadButton.textContent = `Download ${downloadButton.download}`;
    downloadButton.hidden = false;
  }

  function handleValidate() {
    try {
      const result = validateJsonAgainstSchema(jsonInput.value, schemaInput.value, {
        outputFormat: outputFormat.value
      });

      setOutput(result);

      if (result.valid && result.summary.warningCount > 0) {
        setStatus('JSON matches the schema, but schema warnings were reported.', 'success');
        return;
      }

      setStatus(result.valid ? 'JSON matches the schema.' : 'JSON does not match the schema.', result.valid ? 'success' : 'error');
    } catch (error) {
      outputHighlight.setLanguage('plain');
      output.value = error.details?.parseError?.snippet || '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      statusDetail.textContent = 'Invalid';
      setStatus(error.message || 'Unable to validate this JSON against the schema.', 'error');
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

  validateButton.addEventListener('click', handleValidate);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    jsonInput.value = '';
    schemaInput.value = '';
    outputHighlight.setLanguage('markdown');
    output.value = '';
    outputFormat.value = 'markdown';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    jsonInput.focus();
  });

  return () => {
    jsonHighlight.destroy();
    schemaHighlight.destroy();
    outputHighlight.destroy();
    revokeObjectUrl();
  };
}
