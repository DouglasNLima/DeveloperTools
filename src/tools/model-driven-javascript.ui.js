import {
  COMMAND_BAR_CONTEXTS,
  FORM_EVENT_TYPES,
  FORM_VALIDATION_RULES,
  XRM_WEBAPI_OPERATIONS,
  analyseModelDrivenJavaScript,
  buildClientApiMigrationReport,
  buildCommandBarJavaScriptSnippet,
  buildFormEventHandlerSnippet,
  buildFormValidationSnippet,
  buildXrmWebApiSnippet
} from './model-driven-javascript.js';
import { bindSyntaxHighlight } from './syntax-highlight.js';

export function renderModelDrivenJavaScriptReviewer(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="field-stack">
        <label for="modelDrivenJsReviewInput">JavaScript input</label>
        <textarea id="modelDrivenJsReviewInput" spellcheck="false" placeholder="function onLoad(executionContext) {&#10;  const formContext = executionContext.getFormContext();&#10;}"></textarea>
      </div>

      <div class="button-row">
        <button id="analyseModelDrivenJsButton" class="primary" type="button">Analyse JavaScript</button>
        <button id="clearModelDrivenJsReviewButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="output-toolbar">
        <label for="modelDrivenJsReviewOutput">Review report</label>
        <div class="button-row">
          <button id="copyModelDrivenJsReviewButton" class="primary" type="button" disabled>Copy report</button>
          <a id="downloadModelDrivenJsReviewButton" class="button secondary" href="#" download="model-driven-javascript-review.md" hidden>Download report</a>
        </div>
      </div>

      <textarea id="modelDrivenJsReviewOutput" spellcheck="false" readonly placeholder="The review report will appear here."></textarea>
      ${buildDetailsHtml('modelDrivenJsReview', ['High', 'Medium', 'Low', 'Functions', 'Output size'])}
      <div id="modelDrivenJsReviewStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  return bindTextAnalysisTool(container, {
    inputId: '#modelDrivenJsReviewInput',
    outputId: '#modelDrivenJsReviewOutput',
    copyId: '#copyModelDrivenJsReviewButton',
    downloadId: '#downloadModelDrivenJsReviewButton',
    clearId: '#clearModelDrivenJsReviewButton',
    actionId: '#analyseModelDrivenJsButton',
    statusId: '#modelDrivenJsReviewStatus',
    fileName: 'model-driven-javascript-review.md',
    run: input => analyseModelDrivenJavaScript({ source: input }),
    readOutput: result => result.reportMarkdown,
    success: 'Model-driven JavaScript review completed.',
    emptyCopy: 'There is no JavaScript review report to copy.',
    details: result => ({
      High: result.summary.high.toLocaleString('en-GB'),
      Medium: result.summary.medium.toLocaleString('en-GB'),
      Low: result.summary.low.toLocaleString('en-GB'),
      Functions: result.functions.length.toLocaleString('en-GB'),
      'Output size': result.outputSizeLabel
    })
  });
}

export function renderClientApiMigrationHelper(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="field-stack">
        <label for="clientApiMigrationInput">Legacy JavaScript input</label>
        <textarea id="clientApiMigrationInput" spellcheck="false" placeholder="function onLoad() {&#10;  var name = Xrm.Page.getAttribute(&quot;name&quot;).getValue();&#10;}"></textarea>
      </div>

      <div class="form-grid">
        <div class="field-stack">
          <label for="clientApiMigrationNamespace">Namespace</label>
          <input id="clientApiMigrationNamespace" type="text" value="Contoso.ModelDriven" />
        </div>
        <div class="field-stack">
          <label for="clientApiMigrationFunction">Skeleton function</label>
          <input id="clientApiMigrationFunction" type="text" value="onLoad" />
        </div>
      </div>

      <div class="button-row">
        <button id="buildClientApiMigrationButton" class="primary" type="button">Build migration report</button>
        <button id="clearClientApiMigrationButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="output-toolbar">
        <label for="clientApiMigrationOutput">Migration report</label>
        <div class="button-row">
          <button id="copyClientApiMigrationButton" class="primary" type="button" disabled>Copy report</button>
          <a id="downloadClientApiMigrationButton" class="button secondary" href="#" download="client-api-migration.md" hidden>Download report</a>
        </div>
      </div>

      <textarea id="clientApiMigrationOutput" spellcheck="false" readonly placeholder="The migration report will appear here."></textarea>
      ${buildDetailsHtml('clientApiMigration', ['Replacements', 'Findings', 'High risk', 'Output size'])}
      <div id="clientApiMigrationStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  return bindTextAnalysisTool(container, {
    inputId: '#clientApiMigrationInput',
    outputId: '#clientApiMigrationOutput',
    copyId: '#copyClientApiMigrationButton',
    downloadId: '#downloadClientApiMigrationButton',
    clearId: '#clearClientApiMigrationButton',
    actionId: '#buildClientApiMigrationButton',
    statusId: '#clientApiMigrationStatus',
    fileName: 'client-api-migration.md',
    run: input => buildClientApiMigrationReport({
      source: input,
      namespace: container.querySelector('#clientApiMigrationNamespace').value,
      functionName: container.querySelector('#clientApiMigrationFunction').value
    }),
    readOutput: result => result.reportMarkdown,
    success: 'Client API migration report built successfully.',
    emptyCopy: 'There is no migration report to copy.',
    details: result => ({
      Replacements: result.summary.replacementCount.toLocaleString('en-GB'),
      Findings: result.summary.findingCount.toLocaleString('en-GB'),
      'High risk': result.summary.highCount.toLocaleString('en-GB'),
      'Output size': result.outputSizeLabel
    })
  });
}

export function renderFormEventHandlerBuilder(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid">
        ${selectField('formEventType', 'Event type', FORM_EVENT_TYPES)}
        ${inputField('formEventNamespace', 'Namespace', 'Contoso.ModelDriven')}
        ${inputField('formEventFunction', 'Function name', 'onLoad')}
        ${inputField('formEventField', 'Field logical name', 'name')}
        ${inputField('formEventControl', 'Control logical name', 'name')}
      </div>
      ${snippetButtons('formEvent', 'Generate handler')}
      ${outputArea('formEventHandlerOutput', 'Generated handler')}
      ${buildDetailsHtml('formEvent', ['Output type', 'Lines', 'Warnings', 'Output size'])}
      <div id="formEventStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  return bindSnippetTool(container, {
    outputId: '#formEventHandlerOutput',
    copyId: '#copyFormEventButton',
    downloadId: '#downloadFormEventButton',
    clearId: '#clearFormEventButton',
    actionId: '#buildFormEventButton',
    statusId: '#formEventStatus',
    fileName: 'form-event-handler.js',
    run: () => buildFormEventHandlerSnippet({
      eventType: value(container, '#formEventType'),
      namespace: value(container, '#formEventNamespace'),
      functionName: value(container, '#formEventFunction'),
      fieldName: value(container, '#formEventField'),
      controlName: value(container, '#formEventControl')
    }),
    success: 'Form event handler generated successfully.'
  });
}

export function renderXrmWebApiSnippetBuilder(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid">
        ${selectField('xrmWebApiOperation', 'Operation', XRM_WEBAPI_OPERATIONS)}
        ${inputField('xrmWebApiEntity', 'Table logical name', 'account')}
        ${inputField('xrmWebApiFunction', 'Function name', 'retrieveAccount')}
        ${inputField('xrmWebApiRecordId', 'Record ID', '')}
        ${inputField('xrmWebApiSelect', '$select columns', 'name,accountnumber')}
        ${inputField('xrmWebApiFilter', '$filter', 'statecode eq 0')}
      </div>
      <div class="field-stack">
        <label for="xrmWebApiData">Data JSON</label>
        <textarea id="xrmWebApiData" spellcheck="false" placeholder="{&quot;name&quot;:&quot;Contoso&quot;}"></textarea>
      </div>
      ${snippetButtons('xrmWebApi', 'Generate Web API snippet')}
      ${outputArea('xrmWebApiSnippetOutput', 'Generated snippet')}
      ${buildDetailsHtml('xrmWebApi', ['Output type', 'Lines', 'Warnings', 'Output size'])}
      <div id="xrmWebApiStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  return bindSnippetTool(container, {
    outputId: '#xrmWebApiSnippetOutput',
    copyId: '#copyXrmWebApiButton',
    downloadId: '#downloadXrmWebApiButton',
    clearId: '#clearXrmWebApiButton',
    actionId: '#buildXrmWebApiButton',
    statusId: '#xrmWebApiStatus',
    fileName: 'xrm-webapi-snippet.js',
    run: () => buildXrmWebApiSnippet({
      operation: value(container, '#xrmWebApiOperation'),
      entityName: value(container, '#xrmWebApiEntity'),
      functionName: value(container, '#xrmWebApiFunction'),
      recordId: value(container, '#xrmWebApiRecordId'),
      select: value(container, '#xrmWebApiSelect'),
      filter: value(container, '#xrmWebApiFilter'),
      dataJson: value(container, '#xrmWebApiData')
    }),
    success: 'Xrm.WebApi snippet generated successfully.'
  });
}

export function renderFormNotificationValidationBuilder(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid">
        ${selectField('formValidationRule', 'Validation rule', FORM_VALIDATION_RULES)}
        ${inputField('formValidationNamespace', 'Namespace', 'Contoso.ModelDriven')}
        ${inputField('formValidationFunction', 'Function name', 'validateName')}
        ${inputField('formValidationField', 'Field logical name', 'name')}
        ${inputField('formValidationNotificationId', 'Notification ID', 'name_validation')}
        ${inputField('formValidationMaxLength', 'Maximum length', '100')}
        ${inputField('formValidationPattern', 'Regex pattern', '^[A-Za-z0-9 ]+$')}
      </div>
      <div class="field-stack">
        <label for="formValidationMessage">Validation message</label>
        <input id="formValidationMessage" type="text" value="Check this value before saving." />
      </div>
      <label class="checkbox-row">
        <input id="formValidationRunOnSave" type="checkbox" checked />
        <span>Prevent save when invalid</span>
      </label>
      ${snippetButtons('formValidation', 'Generate validation snippet')}
      ${outputArea('formValidationOutput', 'Generated validation')}
      ${buildDetailsHtml('formValidation', ['Output type', 'Lines', 'Warnings', 'Output size'])}
      <div id="formValidationStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  return bindSnippetTool(container, {
    outputId: '#formValidationOutput',
    copyId: '#copyFormValidationButton',
    downloadId: '#downloadFormValidationButton',
    clearId: '#clearFormValidationButton',
    actionId: '#buildFormValidationButton',
    statusId: '#formValidationStatus',
    fileName: 'form-validation-snippet.js',
    run: () => buildFormValidationSnippet({
      ruleType: value(container, '#formValidationRule'),
      namespace: value(container, '#formValidationNamespace'),
      functionName: value(container, '#formValidationFunction'),
      fieldName: value(container, '#formValidationField'),
      notificationId: value(container, '#formValidationNotificationId'),
      maxLength: value(container, '#formValidationMaxLength'),
      pattern: value(container, '#formValidationPattern'),
      message: value(container, '#formValidationMessage'),
      runOnSave: container.querySelector('#formValidationRunOnSave').checked
    }),
    success: 'Form validation snippet generated successfully.'
  });
}

export function renderCommandBarJavaScriptBuilder(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid">
        ${selectField('commandBarContext', 'Command context', COMMAND_BAR_CONTEXTS)}
        ${inputField('commandBarNamespace', 'Namespace', 'Contoso.Commands')}
        ${inputField('commandBarFunction', 'Function name', 'runCommand')}
        ${inputField('commandBarEntity', 'Table logical name', 'account')}
      </div>
      <label class="checkbox-row">
        <input id="commandBarConfirm" type="checkbox" checked />
        <span>Show confirmation dialog</span>
      </label>
      <label class="checkbox-row">
        <input id="commandBarWebApiUpdate" type="checkbox" checked />
        <span>Include Xrm.WebApi update pattern</span>
      </label>
      ${snippetButtons('commandBar', 'Generate command handler')}
      ${outputArea('commandBarJavascriptOutput', 'Generated command handler')}
      ${buildDetailsHtml('commandBar', ['Output type', 'Lines', 'Warnings', 'Output size'])}
      <div id="commandBarStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  return bindSnippetTool(container, {
    outputId: '#commandBarJavascriptOutput',
    copyId: '#copyCommandBarButton',
    downloadId: '#downloadCommandBarButton',
    clearId: '#clearCommandBarButton',
    actionId: '#buildCommandBarButton',
    statusId: '#commandBarStatus',
    fileName: 'command-bar-javascript.js',
    run: () => buildCommandBarJavaScriptSnippet({
      contextType: value(container, '#commandBarContext'),
      namespace: value(container, '#commandBarNamespace'),
      functionName: value(container, '#commandBarFunction'),
      entityName: value(container, '#commandBarEntity'),
      useConfirmation: container.querySelector('#commandBarConfirm').checked,
      includeWebApiUpdate: container.querySelector('#commandBarWebApiUpdate').checked
    }),
    success: 'Command bar JavaScript handler generated successfully.'
  });
}

function bindTextAnalysisTool(container, options) {
  const input = container.querySelector(options.inputId);
  const output = container.querySelector(options.outputId);
  const copyButton = container.querySelector(options.copyId);
  const downloadButton = container.querySelector(options.downloadId);
  const clearButton = container.querySelector(options.clearId);
  const actionButton = container.querySelector(options.actionId);
  const status = container.querySelector(options.statusId);
  const inputHighlight = bindSyntaxHighlight(input, { language: 'plain' });
  const outputHighlight = bindSyntaxHighlight(output, { language: 'markdown' });
  const details = collectDetails(container);
  let objectUrl = '';

  function run() {
    try {
      const result = options.run(input.value);
      output.value = options.readOutput(result);
      copyButton.disabled = false;
      setDownload(downloadButton, objectUrl, options.fileName, output.value, nextUrl => { objectUrl = nextUrl; });
      setDetails(details, options.details(result));
      setStatus(status, options.success, 'success');
      dispatchOutputChange(output);
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      clearDownload(downloadButton, objectUrl);
      objectUrl = '';
      resetDetails(details);
      setStatus(status, error.message || 'Unable to analyse this JavaScript.', 'error');
      dispatchOutputChange(output);
    }
  }

  actionButton.addEventListener('click', run);
  copyButton.addEventListener('click', () => copyOutput(output, copyButton, status, options.emptyCopy));
  clearButton.addEventListener('click', () => {
    input.value = '';
    output.value = '';
    copyButton.disabled = true;
    clearDownload(downloadButton, objectUrl);
    objectUrl = '';
    resetDetails(details);
    setStatus(status, 'Ready.', null);
    dispatchOutputChange(output);
    input.focus();
  });

  return () => {
    inputHighlight.destroy();
    outputHighlight.destroy();
    clearDownload(downloadButton, objectUrl);
  };
}

function bindSnippetTool(container, options) {
  const output = container.querySelector(options.outputId);
  const copyButton = container.querySelector(options.copyId);
  const downloadButton = container.querySelector(options.downloadId);
  const clearButton = container.querySelector(options.clearId);
  const actionButton = container.querySelector(options.actionId);
  const status = container.querySelector(options.statusId);
  const outputHighlight = bindSyntaxHighlight(output, { language: 'plain' });
  const details = collectDetails(container);
  let objectUrl = '';

  function run() {
    try {
      const result = options.run();
      output.value = result.output;
      copyButton.disabled = false;
      setDownload(downloadButton, objectUrl, options.fileName, result.output, nextUrl => { objectUrl = nextUrl; });
      setDetails(details, {
        'Output type': result.outputType,
        Lines: result.summary.lineCount.toLocaleString('en-GB'),
        Warnings: result.warnings.length === 0 ? 'None' : result.warnings.length.toLocaleString('en-GB'),
        'Output size': result.outputSizeLabel
      });
      setStatus(status, options.success, 'success');
      dispatchOutputChange(output);
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      clearDownload(downloadButton, objectUrl);
      objectUrl = '';
      resetDetails(details);
      setStatus(status, error.message || 'Unable to generate this snippet.', 'error');
      dispatchOutputChange(output);
    }
  }

  actionButton.addEventListener('click', run);
  copyButton.addEventListener('click', () => copyOutput(output, copyButton, status, 'There is no generated snippet to copy.'));
  clearButton.addEventListener('click', () => {
    output.value = '';
    copyButton.disabled = true;
    clearDownload(downloadButton, objectUrl);
    objectUrl = '';
    resetDetails(details);
    setStatus(status, 'Ready.', null);
    dispatchOutputChange(output);
  });

  return () => {
    outputHighlight.destroy();
    clearDownload(downloadButton, objectUrl);
  };
}

function setDownload(downloadButton, previousUrl, fileName, value, setObjectUrl) {
  clearDownload(downloadButton, previousUrl);
  const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  downloadButton.href = objectUrl;
  downloadButton.download = fileName;
  downloadButton.textContent = `Download ${fileName}`;
  downloadButton.hidden = false;
  setObjectUrl(objectUrl);
}

function clearDownload(downloadButton, objectUrl) {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }

  downloadButton.hidden = true;
  downloadButton.removeAttribute('href');
}

async function copyOutput(output, copyButton, status, emptyMessage) {
  if (!output.value || copyButton.disabled) {
    setStatus(status, emptyMessage, 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(output.value);
    setStatus(status, 'Output copied to the clipboard.', 'success');
  } catch {
    output.focus();
    output.select();
    document.execCommand('copy');
    setStatus(status, 'Output selected and copied using the browser fallback.', 'success');
  }
}

function buildDetailsHtml(prefix, labels) {
  return `
    <div class="detail-grid" aria-live="polite">
      ${labels.map(label => `
        <div class="detail-card">
          <span>${label}</span>
          <strong id="${prefix}${toIdSuffix(label)}Detail">-</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function collectDetails(container) {
  return [...container.querySelectorAll('.detail-card')].map(card => ({
    label: card.querySelector('span').textContent,
    value: card.querySelector('strong')
  }));
}

function setDetails(details, values) {
  details.forEach(detail => {
    detail.value.textContent = values[detail.label] ?? '-';
  });
}

function resetDetails(details) {
  details.forEach(detail => {
    detail.value.textContent = '-';
  });
}

function snippetButtons(prefix, actionLabel) {
  return `
    <div class="button-row">
      <button id="build${capitalise(prefix)}Button" class="primary" type="button">${actionLabel}</button>
      <button id="clear${capitalise(prefix)}Button" class="secondary" type="button">Clear output</button>
      <button id="copy${capitalise(prefix)}Button" class="secondary" type="button" disabled>Copy output</button>
      <a id="download${capitalise(prefix)}Button" class="button secondary" href="#" hidden>Download output</a>
    </div>
  `;
}

function outputArea(id, label) {
  return `
    <div class="field-stack">
      <label for="${id}">${label}</label>
      <textarea id="${id}" spellcheck="false" readonly placeholder="The generated output will appear here."></textarea>
    </div>
  `;
}

function selectField(id, label, options) {
  return `
    <div class="field-stack">
      <label for="${id}">${label}</label>
      <select id="${id}">
        ${options.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
      </select>
    </div>
  `;
}

function inputField(id, label, value) {
  return `
    <div class="field-stack">
      <label for="${id}">${label}</label>
      <input id="${id}" type="text" value="${escapeAttribute(value)}" />
    </div>
  `;
}

function setStatus(status, message, type) {
  status.textContent = message;
  status.className = `status-message${type ? ` ${type}` : ''}`;
}

function dispatchOutputChange(output) {
  output.dispatchEvent(new Event('input', { bubbles: true }));
}

function value(container, selector) {
  return container.querySelector(selector)?.value || '';
}

function toIdSuffix(value) {
  return String(value).replace(/[^A-Za-z0-9]+(.)/g, (_, character) => character.toLocaleUpperCase('en-GB')).replace(/[^A-Za-z0-9]/g, '');
}

function capitalise(value) {
  return String(value).charAt(0).toLocaleUpperCase('en-GB') + String(value).slice(1);
}

function escapeAttribute(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
