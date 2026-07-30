import { writeTextToClipboard } from './clipboard-feedback.js';
import {
  PCF_SCRIPT_FIELDS,
  PCF_SCRIPT_PHASES,
  buildPcfScriptCommand,
  getPcfActionsForPhase
} from './pcf-development.js';

export function renderPcfScriptCommandBuilder(container, context = {}) {
  const phase = PCF_SCRIPT_PHASES[context.mode] ? context.mode : 'create';
  const actions = getPcfActionsForPhase(phase);

  container.innerHTML = `
    <form class="tool-board pcf-development-tool" data-tool-form>
      <section class="pcf-boundary-note" aria-label="How PCF launchers work">
        <strong>Prepared here, run by you</strong>
        <p>This static app cannot start local PowerShell processes. It validates the parameters and creates a command plus a downloadable launcher for you to review and run on Windows. Nothing is executed or sent anywhere.</p>
      </section>

      <div class="form-grid form-grid--actions">
        <div class="field-stack">
          <label for="pcfAction">Action</label>
          <select id="pcfAction">
            ${actions.map(action => `<option value="${action.value}">${action.label}</option>`).join('')}
          </select>
        </div>

        <div class="button-row button-row--end">
          <button id="buildPcfLauncherButton" class="primary" type="button">Build launcher</button>
          <button id="clearPcfLauncherButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <p id="pcfPhaseSummary" class="hint">${PCF_SCRIPT_PHASES[phase].summary}</p>

      <div id="pcfTextFields" class="pcf-field-grid"></div>
      <div id="pcfOptionFields" class="option-grid"></div>

      <div class="output-toolbar">
        <label for="pcfCommandOutput">PowerShell command</label>
        <div class="button-row">
          <button id="copyPcfCommandButton" class="primary" type="button" disabled>Copy command</button>
          <button id="copyPcfLauncherButton" class="secondary" type="button" disabled>Copy launcher</button>
          <a id="downloadPcfLauncherButton" class="button secondary" href="#" download hidden>Download launcher</a>
        </div>
      </div>

      <textarea id="pcfCommandOutput" class="pcf-command-output" spellcheck="false" readonly placeholder="The validated PowerShell command will appear here."></textarea>

      <div class="field-stack">
        <label for="pcfLauncherOutput">Launcher preview</label>
        <textarea id="pcfLauncherOutput" class="pcf-launcher-output" spellcheck="false" readonly placeholder="The downloadable .ps1 launcher will appear here."></textarea>
      </div>

      <div id="pcfPreview" class="builder-preview" aria-live="polite"></div>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Phase</span>
          <strong id="pcfPhaseDetail">${PCF_SCRIPT_PHASES[phase].label}</strong>
        </div>
        <div class="detail-card">
          <span>Script</span>
          <strong id="pcfScriptDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Parameters</span>
          <strong id="pcfParametersDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="pcfWarningsDetail">-</strong>
        </div>
      </div>

      <div id="pcfStatus" class="status-message" role="status" aria-live="polite">Ready to prepare a PCF launcher.</div>
    </form>
  `;

  const actionSelect = container.querySelector('#pcfAction');
  const textFields = container.querySelector('#pcfTextFields');
  const optionFields = container.querySelector('#pcfOptionFields');
  const buildButton = container.querySelector('#buildPcfLauncherButton');
  const clearButton = container.querySelector('#clearPcfLauncherButton');
  const copyCommandButton = container.querySelector('#copyPcfCommandButton');
  const copyLauncherButton = container.querySelector('#copyPcfLauncherButton');
  const downloadButton = container.querySelector('#downloadPcfLauncherButton');
  const commandOutput = container.querySelector('#pcfCommandOutput');
  const launcherOutput = container.querySelector('#pcfLauncherOutput');
  const preview = container.querySelector('#pcfPreview');
  const status = container.querySelector('#pcfStatus');
  const details = {
    script: container.querySelector('#pcfScriptDetail'),
    parameters: container.querySelector('#pcfParametersDetail'),
    warnings: container.querySelector('#pcfWarningsDetail')
  };

  const savedValues = {};
  let fieldControls = {};
  let currentObjectUrl = null;

  function getAction() {
    return actions.find(action => action.value === actionSelect.value) || actions[0];
  }

  function renderFields(action, reset = false) {
    if (!reset) {
      saveCurrentValues();
    }

    textFields.innerHTML = '';
    optionFields.innerHTML = '';
    fieldControls = {};

    action.fields.forEach(fieldName => {
      const definition = PCF_SCRIPT_FIELDS[fieldName];
      const controlId = `pcf${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}`;
      const value = reset
        ? definition.defaultValue
        : (savedValues[fieldName] ?? definition.defaultValue);

      if (definition.type === 'checkbox') {
        const row = document.createElement('label');
        row.className = 'checkbox-row';
        row.htmlFor = controlId;
        const input = document.createElement('input');
        input.id = controlId;
        input.type = 'checkbox';
        input.checked = Boolean(value);
        input.dataset.pcfField = fieldName;
        const label = document.createElement('span');
        label.textContent = definition.label;
        row.append(input, label);
        optionFields.append(row);
        fieldControls[fieldName] = input;

        if (fieldName === 'deploy') {
          input.addEventListener('change', updateDependentFields);
        }

        return;
      }

      const stack = document.createElement('div');
      stack.className = 'field-stack';
      const label = document.createElement('label');
      label.htmlFor = controlId;
      label.textContent = definition.label;
      const control = createFieldControl(controlId, fieldName, definition, value);
      stack.append(label, control);

      if (definition.help) {
        const help = document.createElement('small');
        help.className = 'pcf-field-help';
        help.textContent = definition.help;
        stack.append(help);
      }

      textFields.append(stack);
      fieldControls[fieldName] = control;
    });

    textFields.className = `pcf-field-grid${action.fields.filter(fieldName => PCF_SCRIPT_FIELDS[fieldName].type !== 'checkbox').length === 1 ? ' pcf-field-grid--single' : ''}`;
    optionFields.hidden = optionFields.childElementCount === 0;
    updateDependentFields();
  }

  function saveCurrentValues() {
    Object.entries(fieldControls).forEach(([fieldName, control]) => {
      savedValues[fieldName] = control.type === 'checkbox' ? control.checked : control.value;
    });
  }

  function updateDependentFields() {
    if (getAction().value !== 'build-and-deploy') {
      return;
    }

    const deployEnabled = Boolean(fieldControls.deploy?.checked);

    if (fieldControls.environmentUrl) {
      fieldControls.environmentUrl.disabled = !deployEnabled;
    }

    if (fieldControls.deployManaged) {
      fieldControls.deployManaged.disabled = !deployEnabled;
    }
  }

  function readOptions() {
    const options = { action: actionSelect.value };

    Object.entries(fieldControls).forEach(([fieldName, control]) => {
      options[fieldName] = control.type === 'checkbox' ? control.checked : control.value;
    });

    return options;
  }

  function revokeObjectUrl() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    downloadButton.hidden = true;
    downloadButton.removeAttribute('href');
  }

  function resetOutput() {
    commandOutput.value = '';
    launcherOutput.value = '';
    preview.innerHTML = '';
    copyCommandButton.disabled = true;
    copyLauncherButton.disabled = true;
    details.script.textContent = '-';
    details.parameters.textContent = '-';
    details.warnings.textContent = '-';
    revokeObjectUrl();
  }

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function setOutput(result) {
    commandOutput.value = result.command;
    launcherOutput.value = result.launcher;
    copyCommandButton.disabled = false;
    copyLauncherButton.disabled = false;
    details.script.textContent = result.scriptName;
    details.parameters.textContent = result.summary.parameterCount.toLocaleString('en-GB');
    details.warnings.textContent = result.warnings.length === 0
      ? 'None'
      : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
    renderPreview(result);
    revokeObjectUrl();

    const blob = new Blob([result.launcher], { type: 'text/plain;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = result.launcherFilename;
    downloadButton.textContent = `Download ${result.launcherFilename}`;
    downloadButton.hidden = false;
  }

  function renderPreview(result) {
    preview.innerHTML = '';

    [
      ['Run checklist', result.checklist.join('\n')],
      ['Review before running', result.warnings.join('\n') || 'No action-specific warnings.']
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

  function buildLauncher() {
    try {
      const result = buildPcfScriptCommand(readOptions());
      setOutput(result);
      const warning = result.warnings[0];
      setStatus(
        warning
          ? `PCF launcher built successfully. ${warning}`
          : 'PCF launcher built successfully.',
        warning ? 'warning' : 'success'
      );
    } catch (error) {
      resetOutput();
      details.script.textContent = 'Invalid';
      setStatus(error.message || 'Unable to build this PCF launcher.', 'error');
    }
  }

  async function copyOutput(output, trigger, emptyMessage, successMessage) {
    if (!output.value || trigger.disabled) {
      setStatus(emptyMessage, 'error');
      return;
    }

    try {
      await writeTextToClipboard(output.value, { trigger });
      setStatus(successMessage, 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus(`${successMessage} Browser fallback used.`, 'success');
    }
  }

  actionSelect.addEventListener('change', () => {
    resetOutput();
    renderFields(getAction());
    setStatus('Ready to prepare the selected PCF launcher.');
  });
  buildButton.addEventListener('click', buildLauncher);
  clearButton.addEventListener('click', () => {
    Object.keys(savedValues).forEach(key => delete savedValues[key]);
    resetOutput();
    renderFields(getAction(), true);
    setStatus('PCF launcher fields cleared.');
    Object.values(fieldControls)[0]?.focus();
  });
  copyCommandButton.addEventListener('click', () => copyOutput(
    commandOutput,
    copyCommandButton,
    'There is no PCF command to copy.',
    'PCF command copied to the clipboard.'
  ));
  copyLauncherButton.addEventListener('click', () => copyOutput(
    launcherOutput,
    copyLauncherButton,
    'There is no PCF launcher to copy.',
    'PCF launcher copied to the clipboard.'
  ));

  renderFields(getAction());

  return () => revokeObjectUrl();

  function createFieldControl(controlId, fieldName, definition, value) {
    let control;

    if (definition.type === 'select') {
      control = document.createElement('select');
      definition.options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        control.append(optionElement);
      });
    } else {
      control = document.createElement('input');
      control.type = definition.type || 'text';
      control.spellcheck = false;

      if (definition.placeholder) {
        control.placeholder = definition.placeholder;
      }

      if (definition.min !== undefined) {
        control.min = String(definition.min);
      }

      if (definition.step !== undefined) {
        control.step = String(definition.step);
      }
    }

    control.id = controlId;
    control.dataset.pcfField = fieldName;
    control.value = value ?? '';

    return control;
  }
}
